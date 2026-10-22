// PvP マップ「アリーナ」を作って maps/arena-01.json に書き出す（マップ作りの書き出しと同じ形式 oasobi-map v2）
// 使い方: node scripts/genArena.mjs
// 座標は m。記録は 0.25m 単位（grid.js の Q）。地面の高さは 1.5m（mapWorld.js の GROUND）。
// 形は 1/4 を書き、90 度ずつ回して 4 つ（風車の形）。チームの色は向きごとに交互（青緑 9・赤 6）
import { writeFileSync, mkdirSync } from 'node:fs';

const Q = 0.25, GROUND = 1.5;
const TEAM = [9, 6]; // concrete と glow で同じ番号
const parts = [];
const add = (type, x, y, z, rot, c) => parts.push({ type, i: { x: Math.round(x / Q), y: Math.round((GROUND + y) / Q), z: Math.round(z / Q) }, rot: ((rot % 8) + 8) % 8, c });

// 1 つの形を 4 回、90 度ずつ回して置く。k は何回目か（色の選び）
// 位置 (x, z) → (z, -x)、向き +2（three.js の rotation.y と同じ回り）
function spin(fn) {
  for (let k = 0; k < 4; k++) {
    const put = (type, x, y, z, rot, c) => {
      let px = x, pz = z;
      for (let n = 0; n < k; n++) [px, pz] = [pz, -px];
      add(type, px, y, pz, rot + 2 * k, c);
    };
    fn(put, TEAM[k % 2], k);
  }
}

// 外周: 壁板 4m を 2 段。上に光る線
spin((put, team) => {
  for (let x = -28; x <= 28; x += 4) { put('panel4', x, 0, -29.75, 0, 4); put('panel4', x, 4, -29.75, 0, 4); }
  for (let x = -29; x <= 29; x += 2) put('glowLine2', x, 8, -29.75, 0, team);
});

// 中央: 塔と、高さ 2m の台（板 2m の 6 × 6）。角の下は箱 2m。台のふちに光る線
add('tower8', 0, 0, 0, 0, 3);
for (let x = -5; x <= 5; x += 2) for (let z = -5; z <= 5; z += 2) add('slab2', x, 2, z, 0, 1);
spin((put, team) => {
  put('block2', 5, 0, 5, 0, 2);
  for (let x = -5; x <= 5; x += 2) put('glowLine2', x, 2.25, -5.75, 0, team);
  put('ramp4', 3, 0, 8, 0, 1);       // 台へ上がる坂（-z の向きに上る）。風車の形で、スタート (0, 8) は空ける
  put('jumpPad', 3, 2.25, 3, 0, team); // 台から塔の上へ（約 6m 跳ぶ）
});

// 四隅の砦: 坂 → 踊り場（箱 2m 4 つ）→ 坂 → デッキ（箱 4m）。デッキに遮蔽物
spin((put, team) => {
  put('ramp4', 14, 0, 24, 6, 1);
  for (const x of [15, 17]) for (const z of [23, 25]) put('block2', x + 2, 0, z, 0, 2);
  put('ramp4', 22, 2, 24, 6, 1);
  put('block4', 26, 0, 24, 0, team);
  put('block2', 27, 4, 24, 0, 2);
  put('glowLine2', 26, 4, 22.25, 0, team); // デッキの手前の縁
});

// 辺の真ん中: 飛ばし台（中央向き）と、中間の遮蔽物
spin((put, team) => {
  put('launchPad', 0, 0, 22, 0, team);
  put('block2', 14, 0, 6, 0, 2);
  put('block4', 12, 0, 13, 0, 2);
  put('panel4', 7, 0, 16, 2, 3);
  put('column4', 16, 0, 10, 0, 2);
  put('block1', 9, 0, 9, 0, 2);
});

mkdirSync(new URL('../maps/', import.meta.url), { recursive: true });
const data = { kind: 'oasobi-map', v: 2, size: 60, env: { hour: 17 }, parts };
writeFileSync(new URL('../maps/arena-01.json', import.meta.url), JSON.stringify(data));
console.log(`${parts.length} parts`);
