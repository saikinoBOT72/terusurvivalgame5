// スポットの地形の手当て（docs/rules/terrain.md「スポットの地形の手当て」）
// 下絵から作った 1 つの角の高さ v・種類 cls・差の上限 lim に、スポットごとの形を足す。丸めて整える前に使う
// 形は islandMap.js の spots の shape（配列）。a: 向き（ラジアン。(cos a, sin a) が (x, z)）、h: 高さ（m、そのまま）
import { P } from '../style/palette.js';

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const CLIFF = 99;

// (x, z) を、中心 (sx, sz) から向き a の線にそって測る: u 前へ、w 横へ
const along = (s, sh, x, z) => {
  const ca = Math.cos(sh.a), sa = Math.sin(sh.a), dx = x - (sh.x ?? s.x), dz = z - (sh.z ?? s.z);
  return { u: dx * ca + dz * sa, w: -dx * sa + dz * ca };
};

const SHAPES = {
  // 平らにする: 半径 r の中を高さ h に。ふち edge m でなめらかに戻す
  flat(s, sh, d, x, z, o) { const k = 1 - sm(sh.r - (sh.edge ?? 4), sh.r, d); o.v += (sh.h - o.v) * k; },
  // 窪地（d > 0）と小山（d < 0）: 真ん中が d 低い。ふちはゆるい
  bowl(s, sh, d, x, z, o) { if (d < sh.r) o.v -= sh.d * (1 - (d / sh.r) ** 2); },
  // 段にしない（岩の区域の中でも、なめらかな坂にする。登れるように）: islandGen.js が段を作る前に使う
  calm() {},
  // 浅瀬: 半径 r の中で h より低い所を h まで上げる（川の渡り場）
  raise(s, sh, d, x, z, o) { if (d < sh.r) o.v = Math.max(o.v, sh.h); },
  // 谷: 向き a・長さ len・幅 w・深さ d の溝。両側は崖、両はしはゆるく上がる
  trench(s, sh, d, x, z, o) {
    const { u, w } = along(s, sh, x, z), L = sh.len / 2;
    if (Math.abs(w) > sh.w / 2 + 0.75 || Math.abs(u) > L) return;
    const k = 1 - sm(L - 8, L, Math.abs(u)); // はしの 8m は坂
    if (Math.abs(w) <= sh.w / 2) o.v -= sh.d * k;
    if (Math.abs(Math.abs(w) - sh.w / 2) < 0.75 && k > 0.9) o.lim = CLIFF;
  },
  // 段々の穴: rings（外から内へ）の円ごとに step m 下がる。境は崖、向き a の道（幅 rw）だけゆるい坂
  steps(s, sh, d, x, z, o) {
    const R = sh.rings[0];
    if (d > R + 1) return;
    const { u, w } = along(s, sh, x, z), ramp = u > 0 && Math.abs(w) < sh.rw / 2;
    let lv = 0;
    for (const r of sh.rings) if (d < r) lv++;
    const inner = sh.rings[sh.rings.length - 1];
    if (ramp) { o.v = sh.h - sh.step * sh.rings.length * (1 - sm(inner, R, d)); return; }
    o.v = sh.h - sh.step * lv;
    if (sh.rings.some((r) => Math.abs(d - r) < 0.75)) o.lim = CLIFF;
  },
  // 崖下の浜: 半径 r の中を高さ h の平らな浜に。ふちは崖、向き a の細い坂道（幅 rw・長さ rl）だけで上がる
  cove(s, sh, d, x, z, o) {
    const { u, w } = along(s, sh, x, z);
    if (u > 0 && u < sh.r + sh.rl && Math.abs(w) < sh.rw / 2) { // 坂道
      const k = Math.max(0, (u - sh.r * 0.6) / (sh.r * 0.4 + sh.rl));
      o.v = Math.min(o.v, sh.h + (o.v - sh.h) * k); return;
    }
    if (d < sh.r && o.v > sh.h) { o.v = sh.h; if (d > sh.r - 0.75) o.lim = CLIFF; } // 海は埋めない
  },
  // 崩れた坂: 峡谷の道を、中心から向き a へ前後 len/2 の帯だけ深さ d 下げる。境は崖（cls = crack）。
  // top: これより低い岩棚も同じに切る（谷底と同じ高さの棚を歩いて回り込めないように）
  crack(s, sh, d, x, z, o) {
    const { u } = along(s, sh, x, z);
    if (Math.abs(u) > sh.len / 2 || d > 12 || (o.cls !== 'floor' && !(o.v < (sh.top ?? -Infinity)))) return;
    o.v -= sh.d; o.cls = 'crack';
  },
};

// スポットの地面の色（terrain.md「スポットの地形の手当て」）。spot.ground = { kind, r }。ふちは乱数でまだらに混ぜる
const pick = (r, list) => list[Math.floor(r() * list.length)];
const GROUND = {
  // 露天掘り: 段の崖は石炭と岩の地層、底は黒い土と石炭のくず
  pit: (f, r, cliff) => cliff ? [P.coal[0], P.coal[1], P.coal[2], P.coal[1]][Math.floor(f.y / 0.5) & 3] : pick(r, [P.rockGray[2], P.rockGray[2], P.soil[1], P.rockGray[3], P.coal[2]]),
  mud: (f, r) => pick(r, [P.soil[0], P.soil[1], P.soil[1], P.moss[0]]),           // ぬかるんだ窪地
  dirt: (f, r) => pick(r, [P.soil[1], P.soil[2], P.soil[2], P.dryGrass[1]]),      // 踏み固められた土
  moss: (f, r) => pick(r, [P.moss[0], P.moss[1], P.moss[2], P.grass[0]]),        // 湿った苔
  stone: (f, r) => pick(r, [P.rockGray[1], P.rockGray[2], P.rockGray[2], P.moss[0]]), // 濡れた岩の床
  copper: (f, r, cliff) => cliff ? [P.rockBrown[1], P.copper[0], P.rockBrown[2], P.copper[1]][Math.floor(f.y / 0.5) & 3] : null, // 崖の緑の筋
  rust: (f, r) => pick(r, [P.iron[0], P.rockBrown[1], P.iron[1], P.rockBrown[2]]), // 赤茶の岩肌
};

export function spotGround(spots) {
  const list = spots.filter((s) => s.ground);
  return (f, r) => {
    for (const s of list) {
      const g = s.ground, d = Math.hypot(f.x - s.x, f.z - s.z);
      if (d > g.r || r() > 1 - sm(g.r * 0.65, g.r, d)) continue;
      const cliff = Math.abs(f.ny) < 0.2;
      if (cliff && g.kind !== 'pit' && g.kind !== 'copper') continue; // 崖の面は地層のまま（露天掘りと銅の壁だけ塗る）
      const c = GROUND[g.kind](f, r, cliff);
      if (c) return c;
    }
    return null;
  };
}

// v, cls, lim を受け取り、手当てしたものを返す
export function shapeSpots(spots, x, z, v, cls, lim) {
  const o = { v, cls, lim };
  for (const s of spots) {
    if (!s.shape) continue;
    const d = Math.hypot(x - s.x, z - s.z);
    if (d > 45) continue;
    for (const sh of s.shape) SHAPES[sh.type](s, sh, d, x, z, o);
  }
  return o;
}
