// ブロックの地形の面を作る（docs/rules/terrain.md「地形（ブロック）」）
// ブロックの形のコード: 下 4 ビット = 上の角（1 なら 0.5m の高さ、0 ならブロックの底）、上 4 ビット = 下の角（1 なら 0.5m 上がる）
// 角の並び: 0=(x,z) 1=(x+1,z) 2=(x+1,z+1) 3=(x,z+1)。外に出ている面だけ作る（隣のブロックに隠れた面は作らない）
export const FULL = 0x0f;
export const VH = 0.5; // ブロックの高さ

// 角 k の高さ（ブロックの底から 0 か 0.5）
const bit = (m, k) => ((m >> k) & 1) * VH;
// 面の対角線: 0 なら 1-3 で分ける / 1 なら 0-2 で分ける（なるべく折れ目が谷と尾根に沿うように）
export const diagOf = (m) => (bit(m, 0) === bit(m, 2) && bit(m, 1) !== bit(m, 3) ? 1 : 0);
// 4 つの角の高さが m のビットの面の、(fx, fz)（0〜1）での高さ
export function surf(m, fx, fz) {
  const a = bit(m, 0), b = bit(m, 1), c = bit(m, 2), e = bit(m, 3);
  if (diagOf(m) === 0) return fx + fz <= 1 ? a + (b - a) * fx + (e - a) * fz : c + (e - c) * (1 - fx) + (b - c) * (1 - fz);
  return fx >= fz ? a + (b - a) * fx + (c - b) * fz : a + (e - a) * fz + (c - e) * fx;
}

// 側面: 自分の角 [e, e+1] と、隣（dx, dz）の向かい合う角
const SIDES = [
  { dx: 0, dz: -1, nk: [3, 2], want: [0, 0, -1] },
  { dx: 1, dz: 0, nk: [0, 3], want: [1, 0, 0] },
  { dx: 0, dz: 1, nk: [1, 0], want: [0, 0, 1] },
  { dx: -1, dz: 0, nk: [2, 1], want: [-1, 0, 0] },
];
const CX = [0, 1, 1, 0], CZ = [0, 0, 1, 1];

// T: { w, d, L, x0, z0, base, cells, colMin, colTop }。区画（tx0, tz0 から tw × td）の三角形
// pos: 面、steep: 登れない面（崖の壁。H キー）、lines: 上を向いた面のマス目（G キー）
export function meshTriangles(T, tx0, tz0, tw, td) {
  const { w, d, L, x0, z0, base, cells, colMin, colTop } = T;
  const pos = [], steep = [], lines = [];
  const code = (tx, tz, ly) => (tx < 0 || tz < 0 || tx >= w || tz >= d || ly < 0 || ly >= L ? 0 : cells[(tz * w + tx) * L + ly]);
  const lowOf = (tx, tz) => (tx < 0 || tz < 0 || tx >= w || tz >= d ? 0 : colMin[tz * w + tx]);
  // 三角形（頂点はばらの数で受ける。want: 面が向いてほしい方向）
  function tri(px, py, pz, qx, qy, qz, sx, sy, sz, want) {
    const ux = qx - px, uy = qy - py, uz = qz - pz, vx = sx - px, vy = sy - py, vz = sz - pz;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l2 = nx * nx + ny * ny + nz * nz;
    if (l2 < 1e-12) return;
    const out = Math.abs(ny) < 0.8 * Math.sqrt(l2) ? steep : null;
    if (nx * want[0] + ny * want[1] + nz * want[2] < 0) {
      pos.push(px, py, pz, sx, sy, sz, qx, qy, qz);
      out?.push(px, py, pz, sx, sy, sz, qx, qy, qz);
    } else {
      pos.push(px, py, pz, qx, qy, qz, sx, sy, sz);
      out?.push(px, py, pz, qx, qy, qz, sx, sy, sz);
    }
  }
  const UP = [0, 1, 0], DOWN = [0, -1, 0];
  // 上か下の面（m: 角のビット、y: ブロックの底、want: 向き）
  function cap(x, z, y, m, want, grid) {
    const a = y + bit(m, 0), b = y + bit(m, 1), c = y + bit(m, 2), e = y + bit(m, 3), X = x + 1, Z = z + 1;
    if (diagOf(m) === 0) { tri(x, a, z, x, e, Z, X, b, z, want); tri(x, e, Z, X, c, Z, X, b, z, want); }
    else { tri(x, a, z, x, e, Z, X, c, Z, want); tri(x, a, z, X, c, Z, X, b, z, want); }
    if (grid) lines.push(x, a + 0.02, z, X, b + 0.02, z, X, b + 0.02, z, X, c + 0.02, Z, X, c + 0.02, Z, x, e + 0.02, Z, x, e + 0.02, Z, x, a + 0.02, z);
  }
  // 側面の帯（t0〜t1、下 b、上 t。端ごとの値）を四角に
  function band(ax, az, bx, bz, t0, t1, b0, b1, u0, u1, want) {
    if (u0 - b0 < 1e-4 && u1 - b1 < 1e-4) return;
    const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0, x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1;
    tri(x0, b0, z0, x0, u0, z0, x1, u1, z1, want);
    tri(x0, b0, z0, x1, u1, z1, x1, b1, z1, want);
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  // 2 本の直線（端の値 a0→a1, b0→b1）が交わる t（0〜1 の中だけ）
  const cross = (a0, a1, b0, b1, out) => { const da = a0 - b0, db = a1 - b1; if (da * db < 0) out.push(da / (da - db)); };

  for (let tz = tz0; tz < tz0 + td; tz++) {
    for (let tx = tx0; tx < tx0 + tw; tx++) {
      const col = tz * w + tx, top = colTop[col];
      const lo = Math.max(0, Math.min(colMin[col], lowOf(tx - 1, tz), lowOf(tx + 1, tz), lowOf(tx, tz - 1), lowOf(tx, tz + 1)) - 1);
      const x = x0 + tx, z = z0 + tz;
      for (let ly = lo; ly <= top; ly++) {
        const c = cells[col * L + ly];
        if (!c) continue;
        const tb = c & 15, bb = c >> 4, y = base + ly * VH;
        const above = code(tx, tz, ly + 1), below = code(tx, tz, ly - 1);
        if (!(tb === 15 && above && (above >> 4) === 0)) cap(x, z, y, tb, UP, true);
        if (ly > 0 && !(bb === 0 && below && (below & 15) === 15)) cap(x, z, y, bb, DOWN, false);
        for (let e = 0; e < 4; e++) {
          const s = SIDES[e], k0 = e, k1 = (e + 1) % 4;
          const lo0 = y + bit(bb, k0), lo1 = y + bit(bb, k1), hi0 = y + bit(tb, k0), hi1 = y + bit(tb, k1);
          if (hi0 - lo0 < 1e-4 && hi1 - lo1 < 1e-4) continue;
          const ax = x + CX[k0], az = z + CZ[k0], bx = x + CX[k1], bz = z + CZ[k1];
          const n = code(tx + s.dx, tz + s.dz, ly);
          let has = false, nl0 = 0, nl1 = 0, nh0 = 0, nh1 = 0;
          if (n) {
            const nt = n & 15, nb = n >> 4;
            nl0 = y + bit(nb, s.nk[0]); nl1 = y + bit(nb, s.nk[1]); nh0 = y + bit(nt, s.nk[0]); nh1 = y + bit(nt, s.nk[1]);
            has = nh0 - nl0 > 1e-4 || nh1 - nl1 > 1e-4;
          }
          if (!has) { band(ax, az, bx, bz, 0, 1, lo0, lo1, hi0, hi1, s.want); continue; }
          if (Math.abs(nl0 - lo0) < 1e-4 && Math.abs(nl1 - lo1) < 1e-4 && Math.abs(nh0 - hi0) < 1e-4 && Math.abs(nh1 - hi1) < 1e-4) continue; // ぴったり隠れる
          // 自分の帯から隣の帯を引く。交わる所で区切って、区切りの中は直線
          const ts = [0, 1];
          cross(lo0, lo1, nh0, nh1, ts); cross(hi0, hi1, nl0, nl1, ts); cross(lo0, lo1, nl0, nl1, ts); cross(hi0, hi1, nh0, nh1, ts);
          cross(lo0, lo1, hi0, hi1, ts); cross(nl0, nl1, nh0, nh1, ts);
          ts.sort((a, b) => a - b);
          for (let i = 1; i < ts.length; i++) {
            const t0 = ts[i - 1], t1 = ts[i];
            if (t1 - t0 < 1e-5) continue;
            const v = (a0, a1, t) => lerp(a0, a1, t);
            const L0 = v(lo0, lo1, t0), L1 = v(lo0, lo1, t1), U0 = v(hi0, hi1, t0), U1 = v(hi0, hi1, t1);
            const NL0 = v(nl0, nl1, t0), NL1 = v(nl0, nl1, t1), NH0 = v(nh0, nh1, t0), NH1 = v(nh0, nh1, t1);
            // 隣より下の部分と、隣より上の部分
            band(ax, az, bx, bz, t0, t1, L0, L1, Math.max(L0, Math.min(U0, NL0)), Math.max(L1, Math.min(U1, NL1)), s.want);
            band(ax, az, bx, bz, t0, t1, Math.min(U0, Math.max(L0, NH0)), Math.min(U1, Math.max(L1, NH1)), U0, U1, s.want);
          }
        }
      }
    }
  }
  return { pos, steep, lines };
}
