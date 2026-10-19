// 乗り物（docs/rules/physics.md「乗り物」）: いかだ（移動拠点）と小舟。乗り物ごとの格子に建てたパーツ、乗る・運ぶ・押す
// 乗り物は自分の structures を持ち、パーツは乗り物の中の座標で建てる（いかだは甲板の上面が y = 0）
// 動き方は種類ごとに別のファイル: raftMotion.js（水平のまま）、boatMotion.js（本物の物理）
import * as THREE from 'three';
import { PARTS, COSTS, localShapes } from '../build/parts.js';
import { dropItem, placeDrop } from '../survival/death.js';
import { createStructures } from '../build/structures.js';
import { circleHitsShape, angleOf } from '../build/grid.js';
import { raftMotion } from './raftMotion.js';
import { boatMotion } from './boatMotion.js';

const FREEBOARD = 0.15;  // いかだの甲板の水面からの高さ（m）
const APART = 1.5;       // 新しい乗り物は、ほかの乗り物からこれだけ離す（m）
const STEP_UP = 0.5, HEAD = 1.3, RADIUS = 0.3, DEEP = 1.2; // プレイヤー（player.md）

// 乗り物の中の座標 ↔ 世界の座標（p: 姿勢 {x, z, yaw}。three.js の rotation.y と同じ回り方）
const toWorld = (p, lx, lz) => { const c = Math.cos(p.yaw), s = Math.sin(p.yaw); return [p.x + lx * c + lz * s, p.z - lx * s + lz * c]; };
const toLocal = (p, x, z) => { const c = Math.cos(p.yaw), s = Math.sin(p.yaw), dx = x - p.x, dz = z - p.z; return [dx * c - dz * s, dx * s + dz * c]; };

// world: 島（terrain、colliders、group、physics）、st: 島の建築パーツ、player: {state, keys}
export function createVehicles(world, st, player, { onMessage = () => {} } = {}) {
  const ps = player.state, keys = player.keys, t = world.terrain, list = [];
  const deckY = t.waterLevel + FREEBOARD;
  // 世界の (x, z) で、高さ b〜top の物が岩・木・島のパーツに当たるか
  const hits = (x, z, b, top) => world.colliders(x, z, 0.05).some((c) => c.top > b && (c.bottom ?? -1e9) < top)
    || st.query(x, z, 0.05).some((c) => c.top > b && c.bottom < top);
  const ctx = { world, t, ps, hits, toWorld, time: 0 };
  const motions = { raft: raftMotion(ctx), boat: boatMotion(ctx) };

  function create(x, z, yaw = 0, kind = 'raft') {
    const v = {
      kind,
      state: { x, z, yaw, vx: 0, vz: 0, w: 0 }, // いかだの動きの状態（あとでマルチプレイで同期する）
      prev: { x, z, yaw }, shown: { x, z, yaw }, // 前の歩みの姿勢と、表示している姿勢
      y: deckY, group: new THREE.Group(), shapes: [], radius: 0, floors: 0, rider: false,
    };
    // いかだの中の地面: 甲板（いかだの床とコアの上面、y = 0）の上だけ。土台・階段の足はここまで伸びる
    v.deckAt = (x2, z2) => v.st.list.some((p) => PARTS[p.type].raft && circleHitsShape(x2, z2, 0, p.shapes[0]));
    v.local = { terrain: { heightAt: (x2, z2) => (v.deckAt(x2, z2) ? 0 : -1e9), floorAt: (x2, y2, z2) => (v.deckAt(x2, z2) ? 0 : -1e9), ceilingAt: () => Infinity, waterLevel: -1e9 }, colliders: () => [], changed: () => refresh(v) };
    v.st = createStructures(v.local);
    v.group.add(v.st.group);
    v.toWorld = (lx, lz) => toWorld(v.shown, lx, lz);
    v.toLocal = (x2, z2) => toLocal(v.shown, x2, z2);
    motions[kind].attach(v, x, z, yaw);
    world.group.add(v.group);
    motions[kind].frame(v, 1);
    list.push(v);
    return v;
  }
  function remove(v) {
    const i = list.indexOf(v);
    if (i < 0) return;
    if (ps.ride?.v === v) ps.ride = null;
    list.splice(i, 1);
    motions[v.kind].detach(v);
    world.group.remove(v.group);
  }
  // パーツが変わったとき。いかだの床・小舟がなくなったら消す
  function refresh(v) { if (!motions[v.kind].refresh(v)) remove(v); }

  // type（いかだの床・小舟）を向き rot で置けるか: 足元が深さ DEPTH 以上の水で、何にも当たらない
  // v: 足す先のいかだ（pos はその中の座標）。null なら新しい乗り物（pos は世界の座標。ほかの乗り物から APART 離す）
  function floats(v, pos, type = 'raft', rot = 0) {
    const a = angleOf(rot), c = Math.cos(a), s = Math.sin(a);
    const pts = [[0, 0], ...localShapes(PARTS[type])[0].poly].map(([x, z]) => {
      const lx = pos.x + x * c + z * s, lz = pos.z - x * s + z * c;
      return v ? v.toWorld(lx, lz) : [lx, lz];
    });
    const y0 = type === 'boat' ? t.waterLevel - 0.2 : deckY - 0.25, y1 = type === 'boat' ? t.waterLevel + 0.6 : deckY;
    const depth = type === 'boat' ? 0.4 : 0.3; // 置ける水の深さ（m）
    if (pts.some(([x, z]) => t.heightAt(x, z) > t.waterLevel - depth || hits(x, z, y0, y1))) return false;
    if (v) return true;
    return list.every((o) => !pts.some(([x, z]) => { const [lx, lz] = o.toLocal(x, z); return o.shapes.some((S) => circleHitsShape(lx, lz, APART, S)); }));
  }

  // ---- 固定の歩みごと ----
  function step(dt) {
    ctx.time += dt;
    for (const v of list) motions[v.kind].step(v, dt);
  }

  // ---- フレームごと: 表示の姿勢、乗っている・押されたプレイヤーを運ぶ、乗っている間の操作、横から押す ----
  // いかだの甲板（形の上面）の上にいるか。跳んでいる間も
  const onBoard = (v, lx, lz) => v.kind === 'raft' && v.shapes.some((S) => circleHitsShape(lx, lz, 0, S) && ps.y >= v.y + S.y1 - 0.3 && ps.y <= v.y + S.y1 + 3);
  // プレイヤーの体（x, z、半径 r）を止める形（乗り上げられない高さで、頭より下にある）
  const blocker = (v, lx, lz, r) => v.shapes.find((S) => circleHitsShape(lx, lz, r, S) && v.y + S.y1 - ps.y > STEP_UP + 0.02 && v.y + S.y0 < ps.y + HEAD);
  let spaceWas = false;
  function frame(alpha, dt) {
    let carried = false;
    for (const v of list) {
      const old = v.shown;
      motions[v.kind].frame(v, alpha);
      const now = v.shown, [lx, lz] = toLocal(old, ps.x, ps.z);
      v.rider = ps.ride ? ps.ride.v === v && ps.ride.kind === 'helm' : !carried && onBoard(v, lx, lz);
      // 乗っていれば、いっしょに進んで回る。乗っていなくても、動いた乗り物にめり込むなら押される
      const pushed = !ps.ride && !carried && !v.rider && !!blocker(v, ...toLocal(now, ps.x, ps.z), RADIUS - 0.02);
      if ((v.rider && !ps.ride) || pushed) [ps.x, ps.z] = toWorld(now, lx, lz);
      if (v.rider || ps.ride?.v === v) ps.yaw += now.yaw - old.yaw;
      carried ||= v.rider || pushed;
      v.group.updateMatrixWorld(true); // 同じフレームの照準（建築）で使うため
    }
    if (ps.ride) ride();
    else if (!carried) push(dt);
    spaceWas = !!keys.Space;
  }
  // 乗っている間: 舵の後ろ・腰かけ板に置き、WASD を乗り物へ渡す。Space で離れる・降りる
  let wWas = false, sWas = false;
  function ride() {
    const { v, kind, part } = ps.ride, ax = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0), ws = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    if (kind === 'helm') {
      [ps.x, ps.z] = v.toWorld(...helmStand(part));
      ps.y = v.y + part.pos.y;
      v.input.turn = ax;
      if (keys.KeyW && !wWas) setSails(v, true);
      if (keys.KeyS && !sWas) setSails(v, false);
    } else {
      if (v.up < 0.34) { leave(true); onMessage('小舟がひっくり返った'); return; } // 70 度より傾いた
      const p = motions.boat.seat(v);
      Object.assign(ps, { x: p.x, z: p.z, y: p.y - 0.35 });
      v.input.fwd = ws;
      v.input.turn = ax;
    }
    wWas = !!keys.KeyW; sWas = !!keys.KeyS;
    if (keys.Space && !spaceWas) leave();
  }
  // 舵の後ろの立つ所（いかだの中の座標）
  const helmStand = (p) => { const a = angleOf(p.rot); return [p.pos.x + 0.7 * Math.sin(a), p.pos.z + 0.7 * Math.cos(a)]; };
  function setSails(v, open) { for (const p of v.st.list) if (PARTS[p.type].sail && p.open !== open) v.st.toggle(p); }

  // 降りる・離れる。force: ひっくり返って降ろされる（場所を選ばない）
  function leave(force = false) {
    const r = ps.ride;
    if (!r) return;
    if (r.kind === 'boat' && !force) {
      const at = motions.boat.exits(r.v).map((p) => ({ x: p.x, z: p.z }))
        .find((p) => t.heightAt(p.x, p.z) > t.waterLevel - DEEP && !hits(p.x, p.z, t.heightAt(p.x, p.z) + STEP_UP, t.heightAt(p.x, p.z) + HEAD))
        ?? deckNear(r.v);
      const e = motions.boat.exits(r.v)[0]; // 岸・甲板がなければ、横の水に降りて泳ぐ
      Object.assign(ps, at ? { x: at.x, z: at.z, y: at.y ?? t.heightAt(at.x, at.z) } : { x: e.x, z: e.z, y: t.waterLevel - 0.95 });
    }
    r.v.input.turn = 0;
    if (r.v.input.fwd !== undefined) r.v.input.fwd = 0;
    ps.ride = null;
    ps.vy = 0;
    keys.Space = false; // 降りた Space で跳ばない
  }
  // 小舟のそばの、いかだの甲板の上（降りられる所）
  function deckNear(boat) {
    for (const [x, z] of motions.boat.exits(boat).map((p) => [p.x, p.z])) {
      const top = query(x, z, 0).filter((c) => c.top < t.waterLevel + 1).map((c) => c.top);
      if (top.length) return { x, z, y: Math.max(...top) };
    }
    return null;
  }

  // 横から歩いてぶつかると、いかだを押せる。ps.wish: 歩こうとしている向き（firstPerson.js）
  function push(dt) {
    const w = ps.wish;
    if (!w || (!w.x && !w.z) || ps.swimming) return; // 泳いでいるときは押さずに上がる
    const px = ps.x + w.x * (RADIUS + 0.1), pz = ps.z + w.z * (RADIUS + 0.1);
    const v = list.find((o) => o.kind === 'raft' && blocker(o, ...o.toLocal(px, pz), 0.02));
    if (v) motions.raft.push(v, px, pz, w, dt);
  }

  // プレイヤーの当たり判定（firstPerson.js）: 世界の (x, z) の半径 r と重なる乗り物の形を {top, bottom}（世界の高さ）で
  function query(x, z, r) {
    const out = [];
    for (const v of list) {
      if (ps.ride?.v === v && ps.ride.kind === 'boat') continue;
      if (Math.hypot(x - v.shown.x, z - v.shown.z) > v.radius + r + 0.5) continue;
      const [lx, lz] = v.toLocal(x, z);
      for (const c of v.st.query(lx, lz, r)) out.push({ top: c.top + v.y, bottom: c.bottom + v.y });
    }
    return out;
  }
  // 種類 type の家具が、世界の (x, y, z) から dist 以内にあるか（作業台・たき火のそば）
  const near = (type, x, y, z, dist) => list.some((v) => v.st.list.some((p) => {
    if (p.type !== type) return false;
    const [px, pz] = v.toWorld(p.pos.x, p.pos.z);
    return Math.hypot(px - x, pz - z) < dist && Math.abs(v.y + p.pos.y - y) < dist;
  }));
  const owner = (part) => list.find((v) => v.st.list.includes(part)) ?? null;

  // コアから、辺でとなり合う床をたどってつながる床（gone の床は通らない）
  function linked(v, gone = new Set()) {
    const floors = v.st.list.filter((p) => PARTS[p.type].raft && !gone.has(p)), core = floors.find((p) => PARTS[p.type].core);
    const seen = new Set(core ? [core] : []), todo = [...seen];
    const next = (a, b) => { const dx = Math.abs(a.pos.x - b.pos.x), dz = Math.abs(a.pos.z - b.pos.z); return Math.abs(dx + dz - 1) < 0.01 && Math.min(dx, dz) < 0.01; };
    while (todo.length) {
      const a = todo.pop();
      for (const b of floors) if (!seen.has(b) && next(a, b)) { seen.add(b); todo.push(b); }
    }
    return { floors, seen };
  }
  // 真下に床（seen の床）がない土台・階段か
  const unfooted = (p, seen) => PARTS[p.type].grounded && ![...seen].some((f) => circleHitsShape(p.foot.cx, p.foot.cz, 0, f.shapes[0]));
  // コアから切れた床を壊す（上のパーツもいっしょに）。真下の床がない土台・階段も。壊したパーツの一覧を返す
  function prune(v) {
    const { floors, seen } = linked(v), out = [];
    if (!seen.size) return out;
    for (const p of floors) if (!seen.has(p)) v.st.remove(p, out);
    for (const p of [...v.st.list]) if (unfooted(p, seen)) v.st.remove(p, out);
    return out;
  }
  // part を撤去したら消えるパーツ（実際には消さない。撤去の目印用）。コアなら全部
  function removalOf(v, part) {
    if (PARTS[part.type].core) return [...v.st.list];
    const gone = v.st.chainOf(part), { floors, seen } = linked(v, gone);
    for (const p of floors) if (!seen.has(p)) v.st.chainOf(p, gone);
    for (const p of v.st.list) if (!gone.has(p) && unfooted(p, seen)) v.st.chainOf(p, gone);
    return [...gone];
  }
  // コアが壊れた: パーツを全部消し、素材の半分を水に浮かぶ物として散らばらせる（同じ物は 10 個ずつ）
  // 中身（チェスト、contents(パーツ) → [[id, n]…]）は袋 1 つにまとめて浮かべる
  function breakUp(v, contents = () => []) {
    const mats = {}, bag = [], floors = v.st.list.filter((p) => PARTS[p.type].raft);
    const spots = floors.map((p) => v.toWorld(p.pos.x, p.pos.z)), core = floors.find((p) => PARTS[p.type].core) ?? floors[0];
    const center = core ? v.toWorld(core.pos.x, core.pos.z) : [v.shown.x, v.shown.z];
    for (const p of v.st.list) {
      for (const [id, n] of Object.entries(COSTS[p.type] ?? {})) mats[id] = (mats[id] ?? 0) + Math.floor(n / 2);
      for (const sl of p.store ?? []) if (sl) bag.push(sl);
      for (const [id, n] of contents(p)) bag.push({ id, n });
    }
    const y = v.y + 0.3;
    remove(v);
    const jit = () => (Math.random() - 0.5) * 0.6;
    for (const [id, n] of Object.entries(mats)) {
      for (let k = n; k > 0; k -= 10) {
        const [x, z] = spots[Math.floor(Math.random() * spots.length)] ?? center;
        dropItem(world, id, Math.min(10, k), x + jit(), z + jit(), y);
      }
    }
    if (bag.length) placeDrop(world, bag, center[0], y, center[1], { kind: 'bag' });
  }

  world.physics.onStep(step);
  world.physics.onFrame(frame);
  return {
    list, create, remove, floats, query, near, owner, leave, prune, removalOf, breakUp, deckY,
    // 右クリック: 舵を持つ・小舟に座る・ひっくり返った小舟を起こす。何かしたら true
    use(part) {
      const v = owner(part);
      if (!v || ps.ride) return false;
      if (part.type === 'helm') {
        ps.ride = { v, kind: 'helm', part };
        ps.yaw = v.shown.yaw + angleOf(part.rot); // 舵の前を向く
        return true;
      }
      if (part.type !== 'boat') return false;
      if (v.capsized) { motions.boat.right(v); return true; }
      ps.ride = { v, kind: 'boat' };
      ps.yaw = v.shown.yaw - Math.PI / 2; // 舟の前（+x）を向く
      return true;
    },
    // かいでこぐ（physics.md「いかだを動かす」）: いかだの上に立っていれば、向き (dx, dz) へ。こげたら true、間隔待ちは null
    paddle(dx, dz) {
      const v = !ps.ride && list.find((o) => o.rider && o.kind === 'raft');
      if (!v) return false;
      return motions.raft.paddle(v, ps.x, ps.z, dx, dz) || null;
    },
    // 照準の下のヒント: 乗っている間の操作、乗り物のパーツを見ているときの右クリック
    hint(part) {
      if (ps.ride) return ps.ride.kind === 'helm' // 舵: 速さと張っている帆の数も（ui.md「設定と舵の表示」）
        ? { name: `${PARTS.helm.name} ${Math.hypot(ps.ride.v.state.vx, ps.ride.v.state.vz).toFixed(1)} m/s ・ 帆 ${ps.ride.v.st.list.filter((p) => p.type === 'sail' && p.open).length}/${ps.ride.v.st.list.filter((p) => p.type === 'sail').length}`, key: 'A/D 回る ・ W 帆を張る ・ S たたむ ・ Space 離れる' }
        : { name: PARTS.boat.name, key: 'W/S こぐ ・ A/D 回る ・ Space 降りる' };
      if (!part) return null;
      if (part.type === 'helm') return { name: PARTS.helm.name, key: '右クリック 舵を持つ' };
      if (part.type === 'sail') return { name: PARTS.sail.name, key: part.open ? '右クリック 帆をたたむ' : '右クリック 帆を張る' };
      if (part.type === 'boat') return { name: PARTS.boat.name, key: owner(part)?.capsized ? '右クリック 起こす' : '右クリック 乗る' };
      return null;
    },
    update(dt, run) { for (const v of list) v.st.update(dt, run); }, // 炎・焼く・浄水器・帆
  };
}
