// 建築の格子・向き・形の計算（docs/rules/building.md）
// パーツの形は「水平面の凸多角形 + 高さの範囲」で表す。
export const G = 0.5;                       // 格子の間隔（m）。吸い付きの刻み
export const Q = 0.25;                      // 記録の単位（m）。あとで細かい刻みを足してもセーブの形を変えないため
export const SQRT2 = Math.SQRT2;
export const toI = (v) => Math.round(v / Q); // m → 記録の整数
export const fromI = (i) => i * Q;           // 記録の整数 → m
export const snap = (v) => Math.round(v / G) * G;
export const angleOf = (rot) => (rot * Math.PI) / 4; // 向き 0〜7 → 角度

// 向き rot のとき、パーツの x 軸が向く方向 (cos a, -sin a) から rot を求める
export function rotOfDir(dx, dz) {
  return (((Math.round(Math.atan2(-dz, dx) / (Math.PI / 4))) % 8) + 8) % 8;
}

const axesOf = (pts) => pts.map(([x, z], i) => {
  const [x2, z2] = pts[(i + 1) % pts.length], l = Math.hypot(x2 - x, z2 - z);
  return [-(z2 - z) / l, (x2 - x) / l];
});
const project = (pts, [ax, az]) => {
  let lo = Infinity, hi = -Infinity;
  for (const [x, z] of pts) { const v = x * ax + z * az; lo = Math.min(lo, v); hi = Math.max(hi, v); }
  return [lo, hi];
};

// local: {poly: [[x, z], ...], y: [下, 上]}、pos: 置く位置(m)、rot: 向き
export function makeShape(local, pos, rot) {
  const a = angleOf(rot), c = Math.cos(a), s = Math.sin(a);
  const pts = local.poly.map(([x, z]) => [pos.x + x * c + z * s, pos.z - x * s + z * c]);
  const cx = pts.reduce((t, p) => t + p[0], 0) / pts.length, cz = pts.reduce((t, p) => t + p[1], 0) / pts.length;
  const width = Math.min(...axesOf(pts).map((ax) => { const [lo, hi] = project(pts, ax); return hi - lo; }));
  const radius = Math.max(...pts.map(([x, z]) => Math.hypot(x - cx, z - cz)));
  return { pts, cx, cz, width, radius, y0: pos.y + local.y[0], y1: pos.y + local.y[1] };
}

// 2つの形が重なるか。重なりの幅が tol 未満なら重なりにしない（角や辺で触れるのはよい）
export function shapesOverlap(A, B, tol = Math.min(0.16, 0.6 * Math.max(A.width, 0.15), 0.6 * Math.max(B.width, 0.15))) {
  if (A.y1 - 0.01 <= B.y0 || B.y1 - 0.01 <= A.y0) return false;
  for (const ax of [...axesOf(A.pts), ...axesOf(B.pts)]) { // 分離軸の判定
    const [a0, a1] = project(A.pts, ax), [b0, b1] = project(B.pts, ax);
    if (Math.min(a1, b1) - Math.max(a0, b0) < tol) return false;
  }
  return true;
}

// 点から線分までの距離
function segDist(x, z, [ax, az], [bx, bz]) {
  const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
}

// 円（x, z, 半径 r）と形が水平面で重なるか
export function circleHitsShape(x, z, r, S) {
  let pos = false, neg = false;
  S.pts.forEach(([ax, az], i) => {
    const [bx, bz] = S.pts[(i + 1) % S.pts.length];
    const cr = (bx - ax) * (z - az) - (bz - az) * (x - ax);
    if (cr > 0) pos = true; else if (cr < 0) neg = true;
  });
  if (!(pos && neg)) return true; // 内側
  return S.pts.some((p, i) => segDist(x, z, p, S.pts[(i + 1) % S.pts.length]) <= r);
}

// 形の辺の一覧: {a, b, mid, len, dir（a→b の単位ベクトル）, n（外向き）, dist(x, z)}
export function edgesOf(S) {
  return S.pts.map((a, i) => {
    const b = S.pts[(i + 1) % S.pts.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dir = [(b[0] - a[0]) / len, (b[1] - a[1]) / len], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let n = [-dir[1], dir[0]];
    if (n[0] * (mid[0] - S.cx) + n[1] * (mid[1] - S.cz) < 0) n = [-n[0], -n[1]];
    return { a, b, mid, len, dir, n, dist: (x, z) => segDist(x, z, a, b) };
  });
}
