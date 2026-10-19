// 間合い取り（enemies.md「ブンブン」）: 間合い（表の bands）をときどきランダムに選び、その距離へ寄る・下がる。
// その間もプレイヤーのまわりを横へ回り（向きはときどき変える）、プレイヤーのほうを向いたまま、横へ動くほうへ体を傾ける
// bands: { near: [下, 上], mid, far, every: [次に選ぶまでの秒], weight: [near, mid, far の重み] }
const NAMES = ['near', 'mid', 'far'];
const rand = (a, b) => a + Math.random() * (b - a);

function pick(m, B) {
  const sum = B.weight.reduce((a, b) => a + b, 0);
  let x = Math.random() * sum, i = 0;
  while (i < NAMES.length - 1 && (x -= B.weight[i]) > 0) i++;
  m.band = NAMES[i];
  m.bandT = rand(...B.every);
}

// 1 フレーム動く。dx, dz: プレイヤーへの向き（長さ dist）。k: 速さの倍率（休む間は遅く）
export function space(m, dt, { dx, dz, dist, speed, steer, list, px, pz, k = 1 }) {
  const B = m.def.bands;
  if (!m.band || (m.bandT -= dt) <= 0) pick(m, B);
  if ((m.orbitT = (m.orbitT ?? 0) - dt) <= 0) { m.orbit = Math.random() < 0.5 ? 1 : -1; m.orbitT = rand(1.2, 2.8); }
  const [lo, hi] = B[m.band];
  const l = dist || 1, ux = dx / l, uz = dz / l;
  const out = dist < lo ? dist - lo : dist > hi ? dist - hi : 0; // 間合いからのずれ（+ は遠すぎ）
  const rad = Math.max(-1, Math.min(1, out / 1.5)); // 寄る（+）・下がる（-）
  const side = m.orbit * (out ? 0.5 : 1) + steer.surround(m, px, pz, list) * 2; // 横へ回る（囲む仲間とは散らばる）
  const vx = ux * rad + uz * side, vz = uz * rad - ux * side;
  const x0 = m.x, z0 = m.z;
  const sp = speed * k * (out ? 1 : 0.7);
  steer.move(m, vx, vz, sp, dt, list);
  // 傾き: 体の左（+x）へ動く速さ
  const mx = (m.x - x0) / (dt || 1), mz = (m.z - z0) / (dt || 1);
  m.model.lean?.((mx * Math.cos(m.yaw) - mz * Math.sin(m.yaw)) / (speed || 1));
}

// ---- ほしい距離（犬。enemies.md「ガラクタ犬」の距離をわざと変える）: 表の wander { near, mid, far: [下, 上], every, weight } ----
// 2〜4 秒ごとに間合い（m.band）とその中の距離（m.wanD）をランダムに選び直す。not: 選ばない間合い（同じ攻撃を続けないため）
export function pickWander(m, not) {
  const W = m.def.wander, w = W.weight.map((x, i) => (NAMES[i] === not ? 0 : x));
  let x = Math.random() * w.reduce((a, b) => a + b, 0), i = 0;
  while (i < NAMES.length - 1 && (x -= w[i]) > 0) i++;
  m.band = NAMES[i];
  m.wanD = rand(...W[m.band]);
  m.wanT = rand(...W.every);
}

// 遠すぎれば 'come'（呼んだ側が弧を描いて寄る）。近すぎれば下がり、ちょうどよければ横へ回る（向きはプレイヤーへ）。'done' は動いた
export function wanderMove(m, dt, { dx, dz, dist, speed, steer, list, px, pz }) {
  if ((m.orbitT = (m.orbitT ?? 0) - dt) <= 0) { m.orbit = Math.random() < 0.5 ? 1 : -1; m.orbitT = rand(1.2, 2.8); }
  const err = dist - m.wanD, l = dist || 1, ux = dx / l, uz = dz / l;
  if (err > 1) return 'come';
  const rad = err < -0.6 ? -1 : Math.max(-0.5, Math.min(0.5, err * 0.5)); // 下がる / 少しずつ合わせる
  const side = m.orbit + steer.surround(m, px, pz, list) * 2;
  steer.move(m, ux * rad + uz * side, uz * rad - ux * side, speed * (err < -0.6 ? 0.9 : 0.7), dt, list);
  return 'done';
}
