// なめらかな形（距離の関数）から、面を間引いたローポリの形を作る（docs/rules/avatar.md）
// 1. 距離の関数の表面を、細かい三角形でおおう（サーフェスネッツ）
// 2. 形が変わりにくい辺からつぶして、面を減らす（二次誤差）。形に沿った不ぞろいな三角形が残る
// symmetric: x=0 で左右対称に間引く。距離の関数も左右対称にしておくこと（x の代わりに |x| を使う）
import * as THREE from 'three';

// ---- 距離の関数の部品（中が負、外が正） ----
export const sdf = {
  ellipsoid(x, y, z, rx, ry, rz) {
    const k0 = Math.hypot(x / rx, y / ry, z / rz), k1 = Math.hypot(x / (rx * rx), y / (ry * ry), z / (rz * rz));
    return k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
  },
  capsule(x, y, z, ax, ay, az, bx, by, bz, r) { // 線分 a-b のまわり半径 r
    const px = x - ax, py = y - ay, pz = z - az, dx = bx - ax, dy = by - ay, dz = bz - az;
    const h = Math.max(0, Math.min(1, (px * dx + py * dy + pz * dz) / (dx * dx + dy * dy + dz * dz)));
    return Math.hypot(px - dx * h, py - dy * h, pz - dz * h) - r;
  },
  smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }, // なめらかにつなぐ
  smax(a, b, k) { return -sdf.smin(-a, -b, k); },                                                           // なめらかに削る
};

// f(x, y, z) の表面を作り、三角形 tris 枚まで間引く。bounds: [[x0, y0, z0], [x1, y1, z1]]（形より少し広く）
export function sculpt(f, bounds, { tris = 200, cell = 0.02, symmetric = true, evenness = 0.002 } = {}) {
  const { pos, idx } = surfaceNets(f, bounds, cell, symmetric);
  const mirror = symmetric ? mirrorMap(pos) : null;
  const out = decimate(pos, idx, tris, mirror, evenness);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out, 3));
  return g;
}

// ---- 1. サーフェスネッツ: 表面をまたぐ小部屋ごとに頂点を1つ置き、となりの4つを四角でつなぐ ----
function surfaceNets(f, [[x0, y0, z0], [x1, y1, z1]], h, symmetric) {
  let nx;
  if (symmetric) { const n = Math.ceil(Math.max(-x0, x1) / h) + 1; x0 = -n * h; nx = 2 * n + 1; }
  else nx = Math.ceil((x1 - x0) / h) + 1;
  const ny = Math.ceil((y1 - y0) / h) + 1, nz = Math.ceil((z1 - z0) / h) + 1;
  const at = (i, j, k) => i + nx * (j + ny * k);
  const val = new Float64Array(nx * ny * nz);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) val[at(i, j, k)] = f(x0 + i * h, y0 + j * h, z0 + k * h);

  const pos = [], cellV = new Int32Array(nx * ny * nz).fill(-1);
  const cor = new Float64Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let neg = 0;
    for (let c = 0; c < 8; c++) { cor[c] = val[at(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1))]; if (cor[c] < 0) neg++; }
    if (neg === 0 || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (let c = 0; c < 8; c++) for (const bit of [1, 2, 4]) {
      if (c & bit) continue;
      const d = c | bit, a = cor[c], b = cor[d];
      if ((a < 0) === (b < 0)) continue;
      const t = a / (a - b);
      sx += (c & 1) + ((d & 1) - (c & 1)) * t;
      sy += ((c >> 1) & 1) + (((d >> 1) & 1) - ((c >> 1) & 1)) * t;
      sz += ((c >> 2) & 1) + (((d >> 2) & 1) - ((c >> 2) & 1)) * t;
      n++;
    }
    cellV[at(i, j, k)] = pos.length / 3;
    pos.push(x0 + (i + sx / n) * h, y0 + (j + sy / n) * h, z0 + (k + sz / n) * h);
  }

  // 表面をまたぐ格子の辺ごとに、まわりの4つの小部屋の頂点で四角を作る。真ん中に頂点を足して4つの三角形にする（左右対称を保つため）
  const idx = [], dims = [nx, ny, nz];
  for (let a = 0; a < 3; a++) {
    const u = (a + 1) % 3, v = (a + 2) % 3, p = [0, 0, 0];
    for (p[2] = 0; p[2] < nz; p[2]++) for (p[1] = 0; p[1] < ny; p[1]++) for (p[0] = 0; p[0] < nx; p[0]++) {
      if (p[a] >= dims[a] - 1 || p[u] < 1 || p[v] < 1) continue;
      const v0 = val[at(p[0], p[1], p[2])], q = [...p];
      q[a]++;
      if ((v0 < 0) === (val[at(q[0], q[1], q[2])] < 0)) continue;
      const quad = [[-1, -1], [0, -1], [0, 0], [-1, 0]].map(([du, dv]) => {
        const c = [...p];
        c[u] += du; c[v] += dv;
        return cellV[at(c[0], c[1], c[2])];
      });
      if (v0 > 0) quad.reverse(); // 外向きにそろえる
      const m = pos.length / 3;
      let cx = 0, cy = 0, cz = 0;
      for (const w of quad) { cx += pos[w * 3]; cy += pos[w * 3 + 1]; cz += pos[w * 3 + 2]; }
      pos.push(cx / 4, cy / 4, cz / 4);
      for (let e = 0; e < 4; e++) idx.push(quad[e], quad[(e + 1) % 4], m);
    }
  }
  return { pos: Float64Array.from(pos), idx };
}

// 頂点ごとに、x=0 で映した相手の頂点。x=0 の上の頂点は自分自身
function mirrorMap(pos) {
  const n = pos.length / 3, key = (x, y, z) => `${Math.round(x * 1e5)},${Math.round(y * 1e5)},${Math.round(z * 1e5)}`;
  const map = new Map();
  for (let i = 0; i < n; i++) {
    if (Math.abs(pos[i * 3]) < 1e-7) pos[i * 3] = 0;
    map.set(key(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]), i);
  }
  const m = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const j = map.get(key(-pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]));
    m[i] = j === undefined ? -1 : j;
    if (j !== undefined && j > i) pos[j * 3] = -pos[i * 3], pos[j * 3 + 1] = pos[i * 3 + 1], pos[j * 3 + 2] = pos[i * 3 + 2];
  }
  return m;
}

// ---- 2. 間引き（二次誤差）。辺 a-b をつぶして a を t に動かす。左右対称のときは映した辺も一緒につぶす ----
function decimate(pos, idx, target, mirror, evenness) {
  const nv = pos.length / 3, nt = idx.length / 3;
  const tri = Int32Array.from(idx), live = new Uint8Array(nt).fill(1), ver = new Int32Array(nv);
  const vt = Array.from({ length: nv }, () => new Set());
  const Q = new Float64Array(nv * 10);
  const P = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
  const normal = (a, b, c) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
    return [uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx];
  };
  for (let t = 0; t < nt; t++) {
    const [a, b, c] = [tri[t * 3], tri[t * 3 + 1], tri[t * 3 + 2]];
    for (const v of [a, b, c]) vt[v].add(t);
    const n = normal(P(a), P(b), P(c)), l = Math.hypot(...n);
    if (l < 1e-12) continue;
    const [x, y, z] = [n[0] / l, n[1] / l, n[2] / l], d = -(x * pos[a * 3] + y * pos[a * 3 + 1] + z * pos[a * 3 + 2]);
    const q = [x * x, x * y, x * z, x * d, y * y, y * z, y * d, z * z, z * d, d * d];
    for (const v of [a, b, c]) for (let k = 0; k < 10; k++) Q[v * 10 + k] += q[k];
  }
  const err = (a, b, [x, y, z]) => {
    const q = (k) => Q[a * 10 + k] + Q[b * 10 + k];
    return q(0) * x * x + 2 * q(1) * x * y + 2 * q(2) * x * z + 2 * q(3) * x + q(4) * y * y + 2 * q(5) * y * z + 2 * q(6) * y + q(7) * z * z + 2 * q(8) * z + q(9);
  };
  const nbr = (v) => { const s = new Set(); for (const t of vt[v]) for (let k = 0; k < 3; k++) s.add(tri[t * 3 + k]); s.delete(v); return s; };

  // 辺をつぶす先の候補と、その誤差
  function plan(a, b) {
    const A = P(a), B = P(b), M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2];
    let cands = [A, B, M];
    if (mirror) {
      const ma = mirror[a], mb = mirror[b];
      if (ma < 0 || mb < 0) return null;
      if (ma === b) cands = [[0, M[1], M[2]]];    // x=0 をまたぐ辺: 真ん中（x=0）へ
      else if ((ma === a) !== (mb === b)) return null; // 片方だけ x=0 の上: つぶさない
    }
    let best = null, cost = Infinity;
    for (const t of cands) { const e = err(a, b, t); if (e < cost) { cost = e; best = t; } }
    const len2 = (A[0] - B[0]) ** 2 + (A[1] - B[1]) ** 2 + (A[2] - B[2]) ** 2;
    return { c: cost + evenness * len2, a, b, t: best, va: ver[a], vb: ver[b] };
  }

  // つぶしてよいか: 辺がまだあり、まわりの形が裏返らず、穴やひだができない
  function ok(a, b, t) {
    const na = nbr(a);
    if (!na.has(b)) return false;
    let common = 0;
    for (const v of nbr(b)) if (na.has(v)) common++;
    if (common !== 2) return false;
    for (const v of [a, b]) for (const f of vt[v]) {
      const ids = [tri[f * 3], tri[f * 3 + 1], tri[f * 3 + 2]];
      if (ids.includes(a) && ids.includes(b)) continue;
      const before = ids.map(P), after = ids.map((i) => (i === v ? t : P(i)));
      const n0 = normal(...before), n1 = normal(...after), l0 = Math.hypot(...n0), l1 = Math.hypot(...n1);
      if (l1 < 1e-10 || (n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2]) / (l0 * l1) < 0.2) return false;
    }
    return true;
  }

  let count = nt;
  function collapse(a, b, t) {
    pos[a * 3] = t[0]; pos[a * 3 + 1] = t[1]; pos[a * 3 + 2] = t[2];
    for (let k = 0; k < 10; k++) Q[a * 10 + k] += Q[b * 10 + k];
    for (const f of vt[b]) {
      let hasA = false;
      for (let k = 0; k < 3; k++) if (tri[f * 3 + k] === a) hasA = true;
      if (hasA) {
        live[f] = 0; count--;
        for (let k = 0; k < 3; k++) if (tri[f * 3 + k] !== b) vt[tri[f * 3 + k]].delete(f);
      } else {
        for (let k = 0; k < 3; k++) if (tri[f * 3 + k] === b) tri[f * 3 + k] = a;
        vt[a].add(f);
      }
    }
    vt[b].clear();
    ver[a]++; ver[b]++;
  }

  const heap = new Heap();
  const pushAround = (a) => { for (const n of nbr(a)) { const p = plan(a, n); if (p) heap.push(p); } };
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) {
    const a = tri[t * 3 + k], b = tri[t * 3 + (k + 1) % 3];
    if (a < b) { const p = plan(a, b); if (p) heap.push(p); }
  }
  while (count > target && heap.size) {
    const { a, b, t, va, vb } = heap.pop();
    if (ver[a] !== va || ver[b] !== vb) continue;
    const ma = mirror ? mirror[a] : -1, mb = mirror ? mirror[b] : -1;
    if (!mirror || ma === b || (ma === a && mb === b)) { // 対称の相手がいない、または自分が対称
      if (!ok(a, b, t)) continue;
      collapse(a, b, t);
      if (mirror) mirror[a] = a;
      pushAround(a);
      continue;
    }
    const mt = [-t[0], t[1], t[2]];
    const near = new Set([a, b, ...nbr(a), ...nbr(b)]);
    if (near.has(ma) || near.has(mb) || !ok(a, b, t) || !ok(ma, mb, mt)) continue;
    collapse(a, b, t);
    collapse(ma, mb, mt);
    pushAround(a);
    pushAround(ma);
  }

  const out = [];
  for (let f = 0; f < nt; f++) if (live[f]) for (let k = 0; k < 3; k++) out.push(...P(tri[f * 3 + k]));
  return Float32Array.from(out);
}

// 誤差の小さい順に取り出す
class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(x) {
    const a = this.a;
    a.push(x);
    for (let i = a.length - 1; i > 0;) {
      const p = (i - 1) >> 1;
      if (a[p].c <= a[i].c) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      for (let i = 0; ;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].c < a[m].c) m = l;
        if (r < a.length && a[r].c < a[m].c) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}
