// 洞窟を地形から削る（docs/rules/terrain.md「洞窟」）
// 洞窟の設計は islandMap.js の caves: 通路（path: [x, z, 床の高さ] の折れ線、幅 w・高さ h）と広場（room: [x, z, 床]、rx・rz・天井 h）。
// 同じ段（lvl）の部品は 1 つの「床の地図」と「天井の地図」にまとめ、0.5m に丸めて坂（床）と逆さの坂（天井）の形にする。
// 地形は削るだけ（埋めない）。天井の上には岩を 1.5m 以上残す（外の地面に穴が開かない）。残らない所は削らない（＝入口の外）
import { rng } from '../style/lowpoly.js';

const ROOF = 1.5;   // 天井の上に残す岩の厚さ
const MIN_H = 2;    // これより低い所は削らない（入口の外の、地面すれすれの所）
const OPEN = 200;   // 天井なし（切り通し）の印
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const q = (v) => Math.round(v * 2) / 2;

// 2 つの形の重なり（どちらにも詰まっている所）: 上の角は両方の AND、下の角は OR
const meet = (a, b) => { const t = (a & 15) & (b & 15), u = (a >> 4) | (b >> 4); return (t & ~u) ? t | (u << 4) : 0; };

// 線分までの距離と、線分の上の割合
function segDist(ax, az, bx, bz, x, z) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
  return { d: Math.hypot(x - ax - dx * t, z - az - dz * t), t };
}

// 1 つの部品の、(x, z) での床と天井（入っていなければ null）。ns: 揺らぎ（-1〜1 の関数）
function partAt(p, x, z, ns) {
  if (p.path) {
    let best = null;
    for (let k = 1; k < p.path.length; k++) {
      const [ax, az, ay] = p.path[k - 1], [bx, bz, by] = p.path[k], s = segDist(ax, az, bx, bz, x, z);
      if (!best || s.d < best.d) best = { d: s.d, y: ay + (by - ay) * s.t };
    }
    const hw = p.w / 2 * (1.15 + 0.18 * ns(x * 0.13, z * 0.13));
    if (best.d > hw) return null;
    const e = best.d / hw, h = p.h * (1 + 0.12 * ns(x * 0.2 + 7, z * 0.2));
    return { f: best.y + 0.4 * sm(0.6, 1, e), c: best.y + h * (1 - 0.4 * e * e) }; // 床は壁ぎわで少し上がり、天井はアーチ
  }
  const [cx, cz, cy] = p.room, a = p.a ?? 0, ca = Math.cos(a), sa = Math.sin(a), dx = x - cx, dz = z - cz;
  const u = (dx * ca + dz * sa) / p.rx, v = (-dx * sa + dz * ca) / p.rz;
  const e = Math.hypot(u, v) / (1 + 0.18 * ns(x * 0.09, z * 0.09));
  if (e > 1) return null;
  const pit = p.pit ? p.pit * (1 - sm(0, 0.55, e)) : 0; // 真ん中のくぼみ（地下の水たまり）
  return { f: cy + 0.5 * sm(0.55, 1, e) + 0.45 * ns(x * 0.21, z * 0.21) - pit, c: cy + 2.5 + (p.h - 2.5) * (1 - e * e) + 0.5 * ns(x * 0.17 + 3, z * 0.17) };
}

// terrain に caves を削る。half: 島の半分（世界の座標 → タイル）。返り値: 洞窟の暗さを計る caveDim(p)
export function carveCaves(terrain, def, half) {
  const caves = def.caves ?? [];
  const { w: N } = terrain.bounds;
  const mask = new Uint8Array(N * N); // タイルごとの洞窟の番号 + 1
  const mouths = [];
  const r = rng(def.seed + 404);
  for (let ci = 0; ci < caves.length; ci++) {
    const cave = caves[ci], o = r() * 100;
    const ns = (x, z) => Math.sin(x * 1.7 + o) * 0.5 + Math.sin(z * 1.3 - o) * 0.5 * Math.cos(x * 0.6 + z * 0.4); // なめらかな揺らぎ
    mouths.push({ ...cave.mouth, id: ci + 1 });
    for (const lvl of [...new Set(cave.parts.map((p) => p.lvl ?? 0))]) {
      const parts = cave.parts.filter((p) => (p.lvl ?? 0) === lvl);
      // 範囲
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
      for (const p of parts) {
        const pts = p.path ?? [p.room], rr = p.path ? p.w : Math.max(p.rx, p.rz) * 1.3;
        for (const [x, z] of pts) { x0 = Math.min(x0, x - rr); z0 = Math.min(z0, z - rr); x1 = Math.max(x1, x + rr); z1 = Math.max(z1, z + rr); }
      }
      const tx0 = Math.max(1, Math.floor(x0 + half)), tz0 = Math.max(1, Math.floor(z0 + half));
      const tw = Math.min(N - 1, Math.ceil(x1 + half)) - tx0, td = Math.min(N - 1, Math.ceil(z1 + half)) - tz0;
      // 床と天井の地図（NaN = 削らない）
      const F = new Float32Array(tw * td).fill(NaN), Cc = new Float32Array(tw * td).fill(NaN);
      for (let j = 0; j < td; j++) for (let i = 0; i < tw; i++) {
        const x = tx0 + i - half + 0.5, z = tz0 + j - half + 0.5;
        let f = Infinity, c = -Infinity;
        for (const p of parts) { const s = partAt(p, x, z, ns); if (s) { f = Math.min(f, s.f); c = Math.max(c, s.c); } }
        if (f === Infinity) continue;
        const top = Math.min(...[[0, 0], [1, 0], [0, 1], [1, 1]].map(([a, b]) => terrain.heightAt(x - 0.5 + a * 0.999, z - 0.5 + b * 0.999)));
        // 入口のまわり（mouth.open m）で天井の岩が薄い所は、天井なしの切り通しにする（外から入れるように）
        if (c > top - ROOF && Math.hypot(x - cave.mouth.x, z - cave.mouth.z) < (cave.mouth.open ?? 8)) c = OPEN;
        else c = Math.min(c, top - ROOF);
        if (c - f < MIN_H) continue;
        F[j * tw + i] = q(f); Cc[j * tw + i] = q(c);
      }
      // 隣との差を 0.5m までに（床は高い方を下げ、天井は低い方を上げる。天井は岩の厚さを越えない）
      const idx = (i, j) => (i < 0 || j < 0 || i >= tw || j >= td ? -1 : j * tw + i);
      for (let pass = 0; pass < 16; pass++) {
        let ch = false;
        for (let j = 0; j < td; j++) for (let i = 0; i < tw; i++) {
          const a = j * tw + i;
          if (Number.isNaN(F[a])) continue;
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
            const b = idx(i + di, j + dj);
            if (b < 0 || Number.isNaN(F[b])) continue;
            if (F[a] > F[b] + 0.5) { F[a] = F[b] + 0.5; ch = true; }
            if (Cc[a] < Cc[b] - 0.5 && Cc[b] !== OPEN) {
              const x = tx0 + i - half + 0.5, z = tz0 + j - half + 0.5;
              const lim = q(terrain.heightAt(x, z) - ROOF);
              if (Cc[b] - 0.5 <= lim) { Cc[a] = Cc[b] - 0.5; ch = true; }
            }
          }
        }
        if (!ch) break;
      }
      // ブロックを削る。床のブロックは「高い隣に向かって上がる坂」、天井のブロックは「低い隣に向かって下がる逆さの坂」
      const at = (i, j, A) => { const k = idx(i, j); return k < 0 ? NaN : A[k]; };
      const CK = [[0, 0], [1, 0], [1, 1], [0, 1]];
      for (let j = 0; j < td; j++) for (let i = 0; i < tw; i++) {
        const k = j * tw + i, f = F[k], c = Cc[k];
        if (Number.isNaN(f)) continue;
        const tx = tx0 + i, tz = tz0 + j;
        let up = 0, down = 15;
        CK.forEach(([cx, cz], b) => {
          const around = [[i + cx - 1, j + cz - 1], [i + cx, j + cz - 1], [i + cx - 1, j + cz], [i + cx, j + cz]];
          if (around.some(([a, bb]) => at(a, bb, F) === f + 0.5)) up |= 1 << b;
          if (around.some(([a, bb]) => at(a, bb, Cc) === c - 0.5)) down &= ~(1 << b);
        });
        const lf = terrain.layer(f), lc = Math.min(terrain.L, terrain.layer(c));
        for (let ly = lf; ly < lc; ly++) {
          let keep = 0; // 削ったあとに残る形
          if (ly === lf) keep = up;
          else if (ly === lc - 1 && c !== OPEN) keep = 15 | (down << 4);
          terrain.setCell(tx, tz, ly, meet(terrain.getCell(tx, tz, ly), keep || 0));
        }
        mask[tz * N + tx] = ci + 1;
      }
    }
  }
  // 洞窟の奥にいる度合い（0〜1）: 洞窟の中で、頭の上に岩があり、入口から 4m より奥は暗い（terrain.md「洞窟」）
  function caveDim(p) {
    const tx = Math.floor(p.x + half), tz = Math.floor(p.z + half);
    if (tx < 0 || tz < 0 || tx >= N || tz >= N) return 0;
    const id = mask[tz * N + tx];
    if (!id || !terrain.underRock(p.x, p.y, p.z)) return 0;
    const m = mouths.find((o) => o.id === id);
    return sm(4, 11, Math.hypot(p.x - m.x, p.z - m.z));
  }
  const inCave = (x, z) => { const tx = Math.floor(x + half), tz = Math.floor(z + half); return tx >= 0 && tz >= 0 && tx < N && tz < N && mask[tz * N + tx] > 0; };
  return { caveDim, inCave, count: caves.length };
}
