// 島の高さの生成（docs/rules/islands.md「島の作り方」、terrain.md「地形（ブロック）」）
// タイルごとに: 区域の下絵（islandMap.js）をゆがめてなめらかに読み、区域ごとの大きな起伏を混ぜる
// → 岩の区域は段（垂直の壁＋足元のがれ場の坂）にする → 川・滝つぼ・峡谷の道・スポットの手当て
// → 0.5m に丸め、段の壁でない所は隣との差を 0.5m までに整える → タイルの角の高さ（坂は低い方のタイルが上がる）
// できたブロックの地形に、崖の上の縁のひさしと洞窟を足す（decorate）
import { rng } from '../style/lowpoly.js';
import { ISLANDS } from './islandMap.js';
import { shapeSpots } from './spotTerrain.js';
import { carveCaves } from './caveCarve.js';
import { FULL } from './voxelMesh.js';

export const ISLAND = ISLANDS.crash.size; // 地図の一辺（タイル数 = m）。陸はおよそ 400m（今は墜落島だけ）
export const SEA = 0;        // 海と湖の水面の高さ
export const SNOW = 99;      // これより高い所は雪（最初の島は雪なし）

function makeNoise(rand) {
  const perm = new Uint8Array(512), p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const G = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  const corner = (gi, x, y) => {
    let t = 0.5 - x * x - y * y;
    if (t < 0) return 0;
    const g = G[perm[gi] & 7];
    t *= t;
    return t * t * (g[0] * x + g[1] * y);
  };
  return (x, y) => { // 2D シンプレックスノイズ（およそ -1〜1）
    const s = (x + y) * F2, i = Math.floor(x + s), j = Math.floor(y + s), t = (i + j) * G2;
    const x0 = x - (i - t), y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const ii = i & 255, jj = j & 255;
    return 70 * (corner(ii + perm[jj], x0, y0)
      + corner(ii + i1 + perm[jj + j1], x0 - i1 + G2, y0 - j1 + G2)
      + corner(ii + 1 + perm[jj + 1], x0 - 1 + 2 * G2, y0 - 1 + 2 * G2));
  };
}

const fbm = (n, x, z, oct) => {
  let s = 0, a = 1, f = 1, t = 0;
  for (let o = 0; o < oct; o++) { s += n(x * f, z * f) * a; t += a; a *= 0.5; f *= 2; }
  return s / t;
};
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// 折れ線までの距離 d と、はじめからの道のりの割合 t
export function polyDist(pts, x, z) {
  let best = Infinity, at = 0, run = 0, total = 0;
  for (let k = 1; k < pts.length; k++) total += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
  for (let k = 1; k < pts.length; k++) {
    const [ax, az] = pts[k - 1], dx = pts[k][0] - ax, dz = pts[k][1] - az, len = Math.hypot(dx, dz);
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (len * len)));
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best) { best = d; at = (run + t * len) / total; }
    run += len;
  }
  return { d: best, t: at };
}

// 段: 高さ v を S m ごとの段にする。段の中は平ら、次の壁の手前で a m だけ坂で上がる（がれ場）、そこから垂直の壁
const terrace = (v, S, a) => { const k = Math.floor(v / S), f = v / S - k; return k * S + a * sm(0.72, 1, f); };

export function generateIsland(id = 'crash') {
  const def = ISLANDS[id], r = rng(def.seed);
  const nA = makeNoise(r), nB = makeNoise(r), nC = makeNoise(r), nD = makeNoise(r), nE = makeNoise(r);
  const N = ISLAND, half = ISLAND / 2, C = def.cell;
  const map = def.map, at = (c, w) => map[w]?.[c] ?? '~';

  // 下絵の重み: マスの中心どうしをなめらかにつなぐ。境目がまっすぐにならないよう、ゆがめた位置で読む
  const warp = (x, z) => [
    x + fbm(nD, x * 0.022, z * 0.022, 2) * 12 + nD(x * 0.07 + 50, z * 0.07) * 2,
    z + fbm(nD, x * 0.022 + 40, z * 0.022 - 70, 2) * 12 + nD(x * 0.07, z * 0.07 + 50) * 2,
  ];
  function weights(x, z) {
    const [wx, wz] = warp(x, z), u = (wx + half) / C - 0.5, v = (wz + half) / C - 0.5;
    const i = Math.floor(u), j = Math.floor(v), fu = sm(0, 1, u - i), fv = sm(0, 1, v - j), w = {};
    const put = (ch, k) => { w[ch] = (w[ch] || 0) + k; };
    put(at(i, j), (1 - fu) * (1 - fv)); put(at(i + 1, j), fu * (1 - fv));
    put(at(i, j + 1), (1 - fu) * fv); put(at(i + 1, j + 1), fu * fv);
    return w;
  }
  const W = (w, chars) => { let a = 0; for (let i = 0; i < chars.length; i++) a += w[chars[i]] || 0; return a; };
  const end = def.canyon[def.canyon.length - 1];
  const calm = def.spots.flatMap((s) => (s.shape ?? []).filter((sh) => sh.type === 'calm').map((sh) => ({ x: s.x, z: s.z, r: sh.r, edge: sh.edge ?? 6 })));

  // 1 つのタイル（中心 x, z）: なめらかな高さ v、段の強さ m・段の高さ S・がれ場 a、壁を許す印 free
  function sample(x, z) {
    const w = weights(x, z), land = 1 - W(w, '~'), hi = W(w, 'HS'), mesa = w.C || 0, rock = (w.Q || 0) + (w.K || 0);
    // 低い区域: 大きな起伏だけ（細かいノイズで 0.5m の段を細かく並べない）
    const hills = fbm(nB, x * 0.011, z * 0.011, 2) * 0.5 + 0.5, roll = fbm(nC, x * 0.019, z * 0.019, 2) * 0.5 + 0.5;
    const ridge = 1 - Math.abs(fbm(nB, x * 0.011 + 17, z * 0.011, 2)); // 岩場・丘の尾根（大きな棚になるよう粗く）
    let s = 0, t = 0;
    const part = (k, h) => { const q = W(w, k); if (q) { s += q * h; t += q; } };
    part('B', 0.7 + roll * 0.7); part('L', 0.3 + roll * 1.3); if (w.M) part('M', 0.15 + fbm(nA, x * 0.04 + 20, z * 0.04, 2) * 1.1); // 湿地: 低く、ところどころ水たまり
    part('G', 2.2 + hills * 6); part('FrP', 2.4 + roll * 3.2); part('D', 3.5 + roll * 3.8); part('K', 7 + ridge * 7.5); part('Q', 6.5 + ridge * 6.5);
    let v = 0.5 + ((t > 0.01 ? s / t : 4) - 0.5) * sm(0, 0.25, land - 0.5); // 海の近くは砂浜の高さ
    if (land < 0.5) v = Math.max(-4, -0.5 + (land - 0.5) * 16);
    // 高台・海食崖・峡谷の上: 崖の帯は細く、上はゆるい起伏
    const vHigh = def.high + fbm(nB, x * 0.017, z * 0.017, 2) * 1.6 + Math.max(0, nA(x * 0.03 - 60, z * 0.03) - 0.35) * 5;
    const vMesa = def.high + 2 + fbm(nC, x * 0.03, z * 0.03, 2) * 2.5;
    const up = sm(0.33, 0.62, hi + mesa), top = hi + mesa > 0 ? (hi * vHigh + mesa * vMesa) / (hi + mesa) : vHigh;
    v += (Math.max(v, top) - v) * up;
    // 段の崖（terrain.md「崖の作り方」）: どこに・何 m ごとに
    let m = 0, S = 3, a = 0.5;
    const band = sm(0.02, 0.2, up) * (1 - sm(0.9, 0.995, up)); // 高台・峡谷の崖の帯（上は段にしない）
    if (band > m) { m = band; S = 3.5 + nE(x * 0.02, z * 0.02) * 0.5; a = 0.5; }
    const rk = sm(0.3, 0.6, rock) * (1 - up);
    if (rk > m) { m = rk; S = (w.Q || 0) > (w.K || 0) ? 3 : 2.5; a = 1; }
    const scarp = w.G ? sm(0.42, 0.62, nE(x * 0.011 + 40, z * 0.011)) * w.G : 0; // 草原の段丘の小さな崖
    if (scarp > m) { m = scarp; S = 1.5; a = 0; }
    const fd = W(w, 'FD'), out = fd ? sm(0.66, 0.82, fbm(nE, x * 0.02 + 100, z * 0.02, 2)) * fd * (1 - up) : 0; // 林・森の岩の露頭
    if (out > 0.02) { v += out * 3; if (out > m) { m = out; S = 1.5; a = 0; } }
    const pillar = rock > 0.55 ? sm(0.8, 0.9, nA(x * 0.05 + 300, z * 0.05)) * sm(0.55, 0.8, rock) * (1 - up) : 0; // 岩場・見晴らしの丘の岩の柱
    if (pillar > 0.02) { v += pillar * 5; m = Math.max(m, sm(0, 0.3, pillar)); S = 2.5; a = 0.5; }
    let cls = 'land', free = false;
    const pd = Math.hypot(x - def.pond.x, z - def.pond.z);
    // 峡谷の底の道: なめらかに上る。両側の壁は段
    const cy = polyDist(def.canyon, x, z), hw = 3.5 + nA(x * 0.06, z * 0.06) * 1.2, nearEnd = Math.hypot(x - end[0], z - end[1]) < 18;
    if (cy.d < hw + 7 && hi + mesa > 0.15) {
      const fl = def.canyonFrom + (def.canyonTo - def.canyonFrom) * cy.t, k = sm(hw, hw + 6, cy.d);
      v = fl + (v - fl) * k;
      if (cy.d < hw) { cls = 'floor'; m = 0; } else if (!nearEnd) { m = Math.max(m, sm(0, 0.2, k)); S = 3.5; a = 0.5; }
      if (nearEnd) m *= sm(hw, hw + 3, cy.d);
    }
    // 高台のまわりの崖の帯は、隣との差をならさない（ならすと坂道ができて、峡谷の奥の坂道のほかから登れてしまう。islands.md「H」）
    if (band > 0.2 && !nearEnd && cls !== 'floor') free = true;
    // 川（滝つぼ → 入り江）: 岸はゆるい坂。見晴らしの丘の中は段の谷になる
    const rv = polyDist(def.river, x, z), rw = 1.5 + rv.t * 2;
    if (rv.d < rw + 6) v = Math.min(v, -1 + Math.max(0, rv.d - rw) * 0.55 * (1 + m));
    if (pd < def.pond.r) { v = Math.min(v, -2); m = 0; }
    else if (pd < def.pond.r + 18 && z < def.pond.z + 3 && hi > 0.1) { // 滝つぼ: 北と東西を高台の切り立った崖が囲む（滝が高い所から落ちる）
      if (pd < def.pond.r + 4.3) v = Math.min(v, 0.5); else { v = Math.max(v, vHigh); free = true; m = 0; }
    }
    const sp = Math.hypot(x - def.spawn.x, z - def.spawn.z); // 残骸のまわりは平らな砂浜
    if (sp < 22) { v += (1 - v) * (1 - sm(10, 22, sp)); m *= sm(12, 22, sp); }
    const rf = Math.hypot(x - def.reef.x, z - def.reef.z);
    if (rf < def.reef.r + 10) v = Math.max(v, -0.5 - (rf - def.reef.r) * 0.35); // 岩礁のまわりは浅瀬
    if (rf < def.reef.r) { v = Math.max(v, 0.5 + (1 - rf / def.reef.r) * 2.5); m = Math.max(m, 0.6); S = 1.5; a = 0; }
    for (const st of def.stacks) if (Math.hypot(x - st.x, z - st.z) < st.r) { v = st.h; m = 1; S = 99; free = true; } // 海から立つ岩の柱
    for (const c of calm) { const d = Math.hypot(x - c.x, z - c.z); if (d < c.r) m *= sm(c.r - c.edge, c.r, d); } // 段にしない所（スポットの calm）
    v += m * (terrace(v, S, a) - v);
    const o = shapeSpots(def.spots, x, z, v, cls, 0.5); // スポットの地形の手当て（terrain.md）
    if (o.lim > 1) free = true;
    return { v: o.v, m, k: Math.floor(v / S), free, up, band, cls: o.cls, rock: m > 0.45 && (rock > 0.3 || out > 0.3 || pillar > 0.1 || band > 0.3) };
  }

  // 1) タイルごとの高さ。0.5m に丸める
  const lv = new Float32Array(N * N), mk = new Float32Array(N * N), kid = new Int16Array(N * N), fr = new Uint8Array(N * N);
  const rockTile = new Uint8Array(N * N), cls = new Array(N * N), hiT = new Uint8Array(N * N); // hiT: 高台・峡谷の上の側
  for (let tz = 0; tz < N; tz++) for (let tx = 0; tx < N; tx++) {
    const i = tz * N + tx, s = sample(tx - half + 0.5, tz - half + 0.5);
    lv[i] = Math.round(s.v / 0.5) * 0.5; mk[i] = s.m; kid[i] = s.k; fr[i] = s.free ? 1 : 0; rockTile[i] = s.rock ? 1 : 0; cls[i] = s.cls; hiT[i] = s.up > 0.02 ? 1 : 0;
  }
  // 2) 段の壁でない所は、隣（斜めも）との差を 0.5m までにする（高い方を削る）。前向きと後ろ向きに何度かなぞる
  const loose = new Uint8Array(N * N); // 1: 印のついた壁（どこでも崖）、2: 段の区域（段がちがえば崖）
  for (let i = 0; i < N * N; i++) loose[i] = fr[i] || cls[i] === 'crack' ? 1 : mk[i] > 0.25 ? 2 : 0;
  // ならす前の高さ。高台・峡谷の上のまわりで、もとから 2m より差がある所は崖なのでならさない（細い崖の帯から坂が広がって、高台に登れてしまわないように）。峡谷の底の道は除く
  const lv0 = lv.slice(), edge = (i, j) => (hiT[i] || hiT[j]) && cls[i] !== 'floor' && cls[j] !== 'floor' && Math.abs(lv0[i] - lv0[j]) > 2;
  const wall = (i, j) => edge(i, j) || ((loose[i] | loose[j]) !== 0 && ((loose[i] | loose[j]) & 1 || kid[i] !== kid[j]));
  for (let pass = 0; pass < 24; pass++) {
    let changed = false;
    const fix = (i, j) => { if (lv[i] > lv[j] + 0.5 && !wall(i, j)) { lv[i] = lv[j] + 0.5; changed = true; } }; // eslint-disable-line no-loop-func
    for (let tz = 0; tz < N; tz++) for (let tx = 0; tx < N; tx++) {
      const i = tz * N + tx;
      if (tx > 0) fix(i, i - 1);
      if (tz > 0) { fix(i, i - N); if (tx > 0) fix(i, i - N - 1); if (tx < N - 1) fix(i, i - N + 1); }
    }
    for (let tz = N - 1; tz >= 0; tz--) for (let tx = N - 1; tx >= 0; tx--) {
      const i = tz * N + tx;
      if (tx < N - 1) fix(i, i + 1);
      if (tz < N - 1) { fix(i, i + N); if (tx < N - 1) fix(i, i + N + 1); if (tx > 0) fix(i, i + N - 1); }
    }
    if (!changed) break;
  }
  // 3) タイルの角: 角を囲む 4 枚のうち、ちょうど 0.5m 高いタイルがあれば、その角は上がる（坂・外角・内角・斜め）
  const lvAt = (tx, tz) => (tx < 0 || tz < 0 || tx >= N || tz >= N ? -99 : lv[tz * N + tx]);
  const CK = [[0, 0], [1, 0], [1, 1], [0, 1]];
  function tile(tx, tz) {
    const q = lv[tz * N + tx];
    return CK.map(([cx, cz]) => {
      const gx = tx + cx, gz = tz + cz;
      const up = [lvAt(gx - 1, gz - 1), lvAt(gx, gz - 1), lvAt(gx - 1, gz), lvAt(gx, gz)].some((h) => h === q + 0.5);
      return up ? q + 0.5 : q;
    });
  }

  // 4) ひさし（terrain.md「崖の作り方」）: 高台・峡谷・岩場の 3m 以上の壁の上の縁から、ところどころ 1 マス張り出す
  // 低い側のタイルの、壁のてっぺんの 2 段を「詰まった」＋「逆さの坂（壁から離れるほど薄い）」にする
  const DIRS = [[0, -1, 0b1100], [1, 0, 0b1001], [0, 1, 0b0011], [-1, 0, 0b0110]]; // 高い側の向きと、下の面の上がる角
  function overhangs(terrain) {
    let n = 0;
    for (let tz = 1; tz < N - 1; tz++) for (let tx = 1; tx < N - 1; tx++) {
      const i = tz * N + tx, l = lv[i];
      if (l < 0.5) continue;
      for (const [dx, dz, raise] of DIRS) {
        const j = (tz + dz) * N + tx + dx, h = lv[j];
        if (h - l < 3 || !rockTile[j] || cls[i] === 'floor' && h - l < 4) continue;
        const x = tx - half + 0.5, z = tz - half + 0.5;
        if (nE(x * 0.07 + 11, z * 0.07 - 5) < 0.3) continue;
        const ly = terrain.layer(h) - 1;
        if (terrain.getCell(tx, tz, ly) || terrain.getCell(tx, tz, ly - 1)) continue;
        terrain.setCell(tx, tz, ly, FULL);
        terrain.setCell(tx, tz, ly - 1, 15 | (raise << 4));
        n++;
        break;
      }
    }
    return n;
  }
  // 5) できたブロックの地形に足す物（ひさし、洞窟）
  function decorate(terrain) {
    const info = { overhangs: overhangs(terrain) };
    info.caves = carveCaves(terrain, def, half);
    return info;
  }

  const forest = (x, z) => { const w = weights(x, z); return W(w, 'FrPD') * 0.75 + (w.D || 0) * 0.35 + nB(x * 0.03 + 200, z * 0.03 - 100) * 0.25 - 0.1; }; // 森の濃さ（深い森は濃い）
  // その場所の区域（下絵の字）。重みがいちばん大きい字
  const zoneAt = (x, z) => { const w = weights(x, z); let best = '~', bw = -1; for (const k in w) if (w[k] > bw) { bw = w[k]; best = k; } return best; };
  let zones = null; // タイルごとの区域（はじめて使うときに作る）
  const tileZone = (tx, tz) => {
    if (!zones) { zones = []; for (let k = 0; k < ISLAND * ISLAND; k++) zones.push(zoneAt(k % ISLAND - half + 0.5, Math.floor(k / ISLAND) - half + 0.5)); }
    return zones[tz * ISLAND + tx];
  };
  const inCanyon = (x, z, r = 3) => polyDist(def.canyon, x, z).d < r; // 峡谷の底の道の上か
  // 岩の段の上か（上を向いた面を岩の色にまぜる）
  const rockAt = (x, z) => { const tx = Math.floor(x + half), tz = Math.floor(z + half); return tx >= 0 && tz >= 0 && tx < N && tz < N && rockTile[tz * N + tx] === 1; };
  // スポット（islands.md「スポット」）: 区域の物を置かない円。タイルごとの印を先に作る
  const spotMask = new Uint8Array(ISLAND * ISLAND);
  for (const s of def.spots) {
    if (!s.r) continue;
    for (let tz = Math.floor(s.z - s.r); tz <= s.z + s.r; tz++) for (let tx = Math.floor(s.x - s.r); tx <= s.x + s.r; tx++) {
      if (Math.hypot(tx + 0.5 - s.x, tz + 0.5 - s.z) < s.r) spotMask[(tz + half) * ISLAND + tx + half] = 1;
    }
  }
  const inSpot = (x, z) => spotMask[(Math.floor(z) + half) * ISLAND + Math.floor(x) + half] === 1;
  return { tile, decorate, forest, zoneAt, tileZone, inCanyon, inSpot, rockAt, sample, spawn: { ...def.spawn }, def }; // sample: 確認用
}
