// 拾える物・採れる物の登録（島）。同じ形はまとめて描いてあるので、インスタンスを1つずつ消したり戻したりする
import * as THREE from 'three';

const CELL = 8;
const _m = new THREE.Matrix4(), _r = new THREE.Matrix4(), _back = new THREE.Matrix4(), _axis = new THREE.Vector3(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const SHAKE = 0.3, FALL = 1; // 揺れる時間、倒れる時間（秒）

export function createResources() {
  const cells = new Map(), waiting = [], moving = [];
  let base = null; // 島ができた時点の物（セーブで、番号で指す）
  const key = (cx, cz) => `${cx},${cz}`;

  // e: { kind, x, y, z, r, h, parts: [{ mesh, index }] }。r と h は照準で当てる円柱の太さと高さ
  // 照準では当てないが、消したり戻したりする物（倒木のキノコ、巣の卵、ヤシの実）
  function track(e) {
    e.ready = true;
    for (const p of e.parts) p.mesh.getMatrixAt(p.index, (p.matrix = new THREE.Matrix4()));
    return e;
  }
  function add(e) {
    track(e);
    const k = key(Math.floor(e.x / CELL), Math.floor(e.z / CELL));
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(e);
    return e;
  }
  function setShown(e, on) {
    e.ready = on;
    for (const p of e.parts) {
      p.mesh.setMatrixAt(p.index, on ? p.matrix : ZERO);
      p.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  // 照準の線（o から向き d）が最初に当たる物 { e, t }。地面に隠れている物は除く
  function aim(o, d, reach, terrain) {
    let best = null;
    const x0 = Math.floor((o.x - reach) / CELL), x1 = Math.floor((o.x + reach) / CELL);
    const z0 = Math.floor((o.z - reach) / CELL), z1 = Math.floor((o.z + reach) / CELL);
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
      for (const e of cells.get(key(cx, cz)) || []) {
        if (!e.ready) continue;
        const t = hitCylinder(o, d, e);
        if (t !== null && t <= reach && (!best || t < best.t)) best = { e, t };
      }
    }
    if (best) { // 手前に地面があれば当たらない
      for (let s = 0.1; s < best.t - 0.1; s += 0.1) {
        const x = o.x + d.x * s, y = o.y + d.y * s, z = o.z + d.z * s;
        if (terrain.solidAt ? terrain.solidAt(x, y + 0.02, z) : y < terrain.heightAt(x, z) - 0.02) return null; // 洞窟の中でも
      }
    }
    return best;
  }

  // 根元を中心に、(dx, dz) の向きへ angle だけ傾け、sink だけ沈める
  function tilt(e, dx, dz, angle, sink) {
    const l = Math.hypot(dx, dz) || 1;
    _r.makeRotationAxis(_axis.set(dz / l, 0, -dx / l), angle);
    for (const p of e.parts) {
      _m.makeTranslation(e.x, e.y - sink, e.z).multiply(_r);
      _m.multiply(_back.makeTranslation(-e.x, -e.y, -e.z)).multiply(p.matrix);
      p.mesh.setMatrixAt(p.index, _m);
      p.mesh.instanceMatrix.needsUpdate = true;
    }
  }
  function animate(e, type, dx, dz) {
    const i = moving.findIndex((a) => a.e === e);
    if (i >= 0) { if (moving[i].type === 'fall') return; moving.splice(i, 1); }
    moving.push({ e, type, dx, dz, t: 0 });
  }

  return {
    add, aim, track,
    shake(e, dx, dz) { animate(e, 'shake', dx, dz); },          // 叩かれて揺れる
    fall(e, dx, dz) { e.ready = false; animate(e, 'fall', dx, dz); }, // 倒れて沈み、消える
    entries: () => [...cells.values()].flat(), // 確認用
    // 島ができたら呼ぶ。このあとに足された物（落とした袋、苗木が育った木）は、セーブで別に扱う
    freeze() { base = [...cells.values()].flat(); },
    get base() { return base; },
    // セーブ用: 消えている物 [[番号, 戻るまでの秒（戻らないなら -1）], ...]
    hidden() {
      const out = [];
      base.forEach((e, i) => {
        if (e.ready) return;
        const w = waiting.find((a) => a.e === e);
        out.push([i, e.gone || !w ? -1 : Math.max(0.1, w.t)]);
      });
      return out;
    },
    // 戻るまでの秒を決め直す（セーブから戻すとき）
    retime(e, seconds) { const w = waiting.find((a) => a.e === e); if (w) w.t = seconds; },
    remove(e) { e.gone = true; setShown(e, false); e.onGone?.(); }, // もう戻らない（戻る途中でも）
    // 物理で動く物（落ちた物）: 位置と見た目を動かし、別のマスへ移ったら入れ直す。matrix: 1 つめの部品の見た目
    move(e, x, y, z, matrix) {
      const from = key(Math.floor(e.x / CELL), Math.floor(e.z / CELL)), to = key(Math.floor(x / CELL), Math.floor(z / CELL));
      if (from !== to) {
        const list = cells.get(from);
        if (list) list.splice(list.indexOf(e) >>> 0, 1);
        if (!cells.has(to)) cells.set(to, []);
        cells.get(to).push(e);
      }
      Object.assign(e, { x, y, z });
      const p = e.parts[0];
      p.matrix.copy(matrix);
      if (e.ready) { p.mesh.setMatrixAt(p.index, matrix); p.mesh.instanceMatrix.needsUpdate = true; }
    },
    // しばらく消して、seconds 秒後に戻す（木の実）。onBack: 戻ったとき（当たり判定を戻すなど）
    regrow(e, seconds, onBack) { setShown(e, false); waiting.push({ e, t: seconds, onBack }); },
    update(dt) {
      for (let i = moving.length - 1; i >= 0; i--) {
        const a = moving[i];
        a.t += dt;
        if (a.type === 'shake') {
          const u = Math.min(1, a.t / SHAKE);
          tilt(a.e, a.dx, a.dz, Math.sin(a.t * 45) * 0.05 * (1 - u), 0);
          if (u >= 1) moving.splice(i, 1);
        } else {
          const u = Math.min(1, a.t / FALL);
          tilt(a.e, a.dx, a.dz, u * u * 1.45, Math.max(0, u - 0.6) * 2 * a.e.h * 0.3);
          if (u >= 1) { setShown(a.e, false); moving.splice(i, 1); }
        }
      }
      for (let i = waiting.length - 1; i >= 0; i--) {
        if ((waiting[i].t -= dt) > 0) continue;
        if (!waiting[i].e.gone) { setShown(waiting[i].e, true); waiting[i].onBack?.(); }
        waiting.splice(i, 1);
      }
    },
  };
}

// 線と、縦の円柱（e.x, e.z が中心、e.y から e.y + e.h まで、太さ e.r）が最初に当たる距離。当たらなければ null
export function hitCylinder(o, d, e) {
  const ox = o.x - e.x, oz = o.z - e.z, y0 = e.y, y1 = e.y + e.h;
  const a = d.x * d.x + d.z * d.z, b = 2 * (ox * d.x + oz * d.z), c = ox * ox + oz * oz - e.r * e.r;
  let tIn = 0, tOut = Infinity;
  if (a < 1e-9) { if (c > 0) return null; }
  else {
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    tIn = Math.max(0, (-b - s) / (2 * a));
    tOut = (-b + s) / (2 * a);
    if (tOut < 0) return null;
  }
  // 高さの範囲で切る
  if (Math.abs(d.y) < 1e-9) return o.y >= y0 && o.y <= y1 ? tIn : null;
  let ta = (y0 - o.y) / d.y, tb = (y1 - o.y) / d.y;
  if (ta > tb) [ta, tb] = [tb, ta];
  const t0 = Math.max(tIn, ta), t1 = Math.min(tOut, tb);
  return t0 <= t1 && t1 >= 0 ? Math.max(0, t0) : null;
}
