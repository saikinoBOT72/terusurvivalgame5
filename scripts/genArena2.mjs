// PvP マップ「アリーナ 2」（夜の立体駐車場の建物と吹き抜け）を作って maps/arena-02.json に書き出す
// 使い方: node scripts/genArena2.mjs
// 座標は m。記録は 0.25m 単位。地面の高さは 1.5m（mapWorld.js の GROUND）。
// 3 層: 地上・2 階（床の上面 y=4）・屋上（y=8）。床は板 4m（4×0.5×4）を 4m 格子に敷く（中心が 4 の倍数）。
// 中央 12×12 は 2 階と屋上の床を抜いた吹き抜け。形は 180 度対称（spin）
import { writeFileSync, mkdirSync } from 'node:fs';

const Q = 0.25, GROUND = 1.5;
const parts = [];
const r3 = (v) => Math.round(v * 1000) / 1000; // 0.25m の格子にない高さ（床の裏の灯り）は小数のまま記録する
const add = (type, x, y, z, rot, c) => parts.push({ type, i: { x: r3(x / Q), y: r3((GROUND + y) / Q), z: r3(z / Q) }, rot: ((rot % 8) + 8) % 8, c });
// 180 度回して 2 つ置く。位置 (x, z) → (-x, -z)、向き +4
const spin = (type, x, y, z, rot, c) => { add(type, x, y, z, rot, c); add(type, -x, y, -z, rot + 4, c); };

const CONC = 2, COL = 1, COVER = 3, WHITE = 0, TEAM = [9, 6];
const F2 = 4, ROOF = 8;       // 床の上面の高さ
const tiles = []; for (let t = -28; t <= 28; t += 4) tiles.push(t);

// 床を抜く所: 吹き抜け（中心 -4・0・4 の 3 × 3 枚）と、坂の上の穴
const hole = (x, z) => Math.abs(x) <= 4 && Math.abs(z) <= 4;
const rampHole2 = (x, z) => (x === 24 && (z === 16 || z === 20)) || (x === -24 && (z === -16 || z === -20)); // 地上 → 2 階の坂
const rampHoleR = (x, z) => (x === -24 && (z === 16 || z === 20)) || (x === 24 && (z === -16 || z === -20)); // 2 階 → 屋上の坂
const open2 = (x, z) => hole(x, z) || rampHole2(x, z);
const openR = (x, z) => hole(x, z) || rampHoleR(x, z);

// 床: 板の上面が F2 / ROOF
for (const x of tiles) for (const z of tiles) {
  if (!open2(x, z)) add('slab4', x, F2 - 0.5, z, 0, CONC);
  if (!openR(x, z)) add('slab4', x, ROOF - 0.5, z, 0, CONC);
}

// 柱: 12m 間隔（吹き抜けの中は除く）。地上 → 2 階、2 階 → 屋上
for (const x of [-24, -12, 0, 12, 24]) for (const z of [-24, -12, 0, 12, 24]) {
  if (Math.abs(x) < 6 && Math.abs(z) < 6) continue;
  add('column4', x, 0, z, 0, COL);
  add('column4', x, F2, z, 0, COL);
}

// ふちの手すり: 外周は箱 2m、吹き抜けのふちは箱 1m
for (const y of [0, F2, ROOF]) {
  for (let t = -29; t <= 29; t += 2) { add('block2', t, y, -29, 0, CONC); add('block2', t, y, 29, 0, CONC); }
  for (let t = -27; t <= 27; t += 2) { add('block2', -29, y, t, 0, CONC); add('block2', 29, y, t, 0, CONC); }
}
for (const y of [F2, ROOF]) {
  for (let t = -6.5; t <= 6.5; t += 1) { add('block1', t, y, -6.5, 0, CONC); add('block1', t, y, 6.5, 0, CONC); }
  for (let t = -5.5; t <= 5.5; t += 1) { add('block1', -6.5, y, t, 0, CONC); add('block1', 6.5, y, t, 0, CONC); }
}

// 坂: 坂 4m を 2 つ続けて 4m 上がる（-z の向きに上る）。地上 → 2 階は x=±24、2 階 → 屋上は反対側
spin('ramp4', 24, 0, 20, 0, CONC); spin('ramp4', 24, 2, 16, 0, CONC);
spin('ramp4', -24, F2, 20, 0, CONC); spin('ramp4', -24, F2 + 2, 16, 0, CONC);

// 吹き抜けの中（地上）から 2 階へ跳ぶジャンプ台
spin('jumpPad', 5, 0, 0, 0, TEAM[0]);

// 遮蔽物（坂の穴・柱をよけて置く）
spin('block4', 6, 0, -14, 0, COVER); spin('block2', 16, 0, -6, 0, COVER); spin('panel4', 16, 0, 6, 2, COVER); spin('block2', 18, 0, -18, 0, COVER);
spin('block4', 8, F2, -18, 0, COVER); spin('block2', 18, F2, -6, 0, COVER); spin('panel4', 16, F2, 8, 2, COVER); spin('block4', 18, F2, 18, 0, COVER);
spin('block4', 6, ROOF, 14, 0, COVER); spin('block2', 18, ROOF, 0, 0, COVER); spin('panel4', 8, ROOF, -8, 0, COVER); spin('tower8', 16, ROOF, -20, 0, COVER);

// 蛍光灯: 床の裏に、白い光る線 2m を 2 本つなげた長い灯りを並べる（z は 8 の倍数の列、x は 8m ごと）
for (const [level, open] of [[F2, open2], [ROOF, openR]]) {
  for (let z = -24; z <= 24; z += 8) for (let x = -28; x <= 28; x += 8) {
    if (open(x, z)) continue;
    add('glowLine2', x - 1, level - 0.5 - 0.09, z, 0, WHITE);
    add('glowLine2', x + 1, level - 0.5 - 0.09, z, 0, WHITE);
  }
}

// スタートの印（地上、180 度で青緑と赤）
for (let k = 0; k < 6; k++) {
  add('glowLine2', -29 + 0 + k * 2 + 6, 0, 24.5 - 2, 0, TEAM[0]);
  add('glowLine2', 29 - 6 - k * 2, 0, -24.5 + 2, 0, TEAM[1]);
}

mkdirSync(new URL('../maps/', import.meta.url), { recursive: true });
const data = { kind: 'oasobi-map', v: 2, size: 60, env: { hour: 23, hemiK: 1.3, bloom: 1.0, stars: 'on' }, parts };
writeFileSync(new URL('../maps/arena-02.json', import.meta.url), JSON.stringify(data));
console.log(`${parts.length} parts`);
