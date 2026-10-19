// いかだの動き方（docs/rules/physics.md「いかだ」「いかだを動かす」）: 水平のまま、進む・曲がるだけ
// 動きは自前の式で決め、物理には「動かす物」として渡す（上に落とした物を摩擦で運ぶため）
import { PARTS } from '../build/parts.js';
import { angleOf } from '../build/grid.js';

const DRAG = 0.3, TURN_DRAG = 0.7;              // 水の抵抗（速さが半分になるのは約 2.3 秒・約 1 秒）
const PUSH = 1.5, PUSH_MAX = 1, TURN_MAX = 0.6; // 横から押す: 加速（m/s²）、最大の速さ（m/s）、最大の回る速さ（rad/s）
const STROKE = 0.6, STROKE_GAP = 0.5, PADDLE_MAX = 1.5; // かい: 1 回の速さ、間隔（秒）、こいで出せる速さ
const SAIL = 0.8, SAIL_MAX = 2.5;               // 帆 1 枚の加速、帆で出せる速さ
const HELM_TURN = 0.5, HELM_MAX = 0.4;          // 舵: 回る加速（rad/s²）、最大の回る速さ
const KEEL = 1;                                 // 舵があるとき、横すべりを弱める（1 秒あたり）

// ctx: {world, t（地形）, hits（岩・木・島のパーツに当たるか）, toWorld}
export function raftMotion({ world, t, hits, toWorld }) {
  // 今の姿勢から姿勢 p へ動けるか。地面は、今すでに触れている所より深く入りこまなければよい（岸から押し戻せるように）
  const fits = (v, p) => v.points.every(([lx, lz, y0, y1]) => {
    const [x, z] = toWorld(p, lx, lz), b = v.y + y0, g = t.heightAt(x, z);
    if (g > b && g > t.heightAt(...toWorld(v.state, lx, lz)) + 1e-4) return false;
    return !hits(x, z, b, v.y + y1);
  });
  // 乗り物の中の向き a（パーツの rot の角度）の前（-z）を、世界の向きにする
  const front = (v, a) => [-Math.sin(v.state.yaw + a), -Math.cos(v.state.yaw + a)];

  return {
    attach(v, x, z, yaw) {
      v.body = world.physics.kinematic({ x, y: v.y, z }, yaw);
      v.input = { turn: 0 };
      v.strokeT = 0;
    },
    detach(v) { v.body.dispose(); },
    // パーツが変わったとき: 物理の形、ぶつかる点、大きさ、重さを作り直す。いかだの床がなければ false
    refresh(v) {
      const floors = v.st.list.filter((p) => PARTS[p.type].raft);
      if (!floors.length) return false;
      v.shapes = v.st.list.filter((p) => !PARTS[p.type].noCollide).flatMap((p) => p.shapes.filter((b) => !(b.panel && p.open)));
      v.points = []; // 地面や岩にぶつかるかを調べる点: 形の角・辺の中点・真ん中 [x, z, 下端, 上端]
      for (const S of v.shapes) {
        S.pts.forEach(([x, z], k) => {
          const [x2, z2] = S.pts[(k + 1) % S.pts.length];
          v.points.push([x, z, S.y0, S.y1], [(x + x2) / 2, (z + z2) / 2, S.y0, S.y1]);
        });
        v.points.push([S.cx, S.cz, S.y0, S.y1]);
      }
      v.radius = Math.max(...v.points.map(([x, z]) => Math.hypot(x, z)));
      v.floors = floors.length;
      v.center = [floors.reduce((a, p) => a + p.pos.x, 0) / floors.length, floors.reduce((a, p) => a + p.pos.z, 0) / floors.length];
      // 回りにくさ: 床ごとの真ん中からの距離の 2 乗の平均 + 1m 四方の板のぶん
      v.inertia = floors.reduce((a, p) => a + (p.pos.x - v.center[0]) ** 2 + (p.pos.z - v.center[1]) ** 2, 0) / floors.length + 1 / 6;
      v.helm = v.st.list.find((p) => PARTS[p.type].helm) ?? null;
      v.body.setShapes(v.shapes);
      return true;
    },

    // 固定の歩みごと: 帆と舵、水の抵抗。ぶつからない所だけ進む
    step(v, dt) {
      const s = v.state, sq = Math.sqrt(v.floors);
      v.prev = { x: s.x, z: s.z, yaw: s.yaw };
      for (const p of v.st.list) { // 張った帆は、帆の前へ押す
        if (!PARTS[p.type].sail || !p.open) continue;
        const [fx, fz] = front(v, angleOf(p.rot));
        s.vx += fx * SAIL / sq * dt; s.vz += fz * SAIL / sq * dt;
      }
      const sp = Math.hypot(s.vx, s.vz);
      if (sp > SAIL_MAX) { s.vx *= SAIL_MAX / sp; s.vz *= SAIL_MAX / sp; }
      if (v.input.turn) { // 舵: 速く進んでいるほどよく回る
        s.w += v.input.turn * HELM_TURN * (0.3 + 0.7 * Math.min(1, sp)) * dt;
        s.w = Math.max(-HELM_MAX, Math.min(HELM_MAX, s.w));
      }
      if (v.helm) { // 舵があれば、舵の前の向きに対して横へはすべりにくい
        const [fx, fz] = front(v, angleOf(v.helm.rot)), side = s.vx * -fz + s.vz * fx, k = 1 - Math.exp(-KEEL * dt);
        s.vx -= -fz * side * k; s.vz -= fx * side * k;
      }
      const k = Math.exp(-DRAG * dt), kw = Math.exp(-TURN_DRAG * (v.input.turn ? 0 : 1) * dt);
      s.vx *= k; s.vz *= k; s.w *= kw;
      if (Math.hypot(s.vx, s.vz) < 0.003 && Math.abs(s.w) < 0.002) s.vx = s.vz = s.w = 0;
      if (s.vx || s.vz || s.w) {
        const n = { x: s.x + s.vx * dt, z: s.z + s.vz * dt, yaw: s.yaw + s.w * dt };
        if (fits(v, n)) Object.assign(s, n);
        else if (s.w && fits(v, { ...n, yaw: s.yaw })) { s.x = n.x; s.z = n.z; s.w = 0; } // 回らなければ進める
        else if (s.w && fits(v, { x: s.x, z: s.z, yaw: n.yaw })) { s.yaw = n.yaw; s.vx = s.vz = 0; } // 進めなければ、その場で回る
        else s.vx = s.vz = s.w = 0; // ぶつかって止まる
      }
      v.body.moveTo(s.x, v.y, s.z, s.yaw);
    },
    // フレームごと: 前の歩みとの間の姿勢
    frame(v, alpha) {
      const p = v.prev, s = v.state;
      v.shown = { x: p.x + (s.x - p.x) * alpha, z: p.z + (s.z - p.z) * alpha, yaw: p.yaw + (s.yaw - p.yaw) * alpha };
      v.group.position.set(v.shown.x, v.y, v.shown.z);
      v.group.rotation.y = v.shown.yaw;
    },

    // 横から押す: 世界の (px, pz) を、向き w（単位ベクトル）へ押す
    push(v, px, pz, w, dt) {
      const s = v.state, a = PUSH / Math.sqrt(v.floors);
      s.vx += w.x * a * dt; s.vz += w.z * a * dt;
      const sp = Math.hypot(s.vx, s.vz);
      if (sp > PUSH_MAX) { s.vx *= PUSH_MAX / sp; s.vz *= PUSH_MAX / sp; }
      turnBy(v, px, pz, w.x * a, w.z * a, dt, TURN_MAX);
    },
    // かいで 1 回こぐ: (px, pz) から向き (dx, dz) へ。間隔より早ければ false
    paddle(v, px, pz, dx, dz) {
      if (v.strokeT > performance.now()) return false;
      v.strokeT = performance.now() + STROKE_GAP * 1000;
      const s = v.state, l = Math.hypot(dx, dz) || 1, dv = STROKE / Math.sqrt(v.floors);
      const ux = dx / l, uz = dz / l;
      if (Math.hypot(s.vx + ux * dv, s.vz + uz * dv) <= Math.max(PADDLE_MAX, Math.hypot(s.vx, s.vz))) { s.vx += ux * dv; s.vz += uz * dv; }
      turnBy(v, px, pz, ux * dv, uz * dv, 1, TURN_MAX);
      return true;
    },
  };
  // 真ん中からずれた所を (ax, az) の向きに押すと回る（rz·ax − rx·az が回る向き）
  function turnBy(v, px, pz, ax, az, dt, max) {
    const [cx, cz] = toWorld(v.shown, ...v.center), rx = px - cx, rz = pz - cz, s = v.state;
    s.w = Math.max(-max, Math.min(max, s.w + (rz * ax - rx * az) / v.inertia * dt));
  }
}
