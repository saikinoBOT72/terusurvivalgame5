// 島の図のウィジェット用のデータを、遊んでいる島から取り出す（ブラウザの javascript_tool でこのまま実行。返り値は JSON の文字列）
// 4m ごとに区域の字と高さ（3m 刻み、a〜j、海は .）を読み、行ごとの連長圧縮（"12F" = F が 12 個）。スポット・敵の行は islandMap.js から
const { ISLANDS } = await import('/src/world/islandMap.js?t=' + Date.now());
const w = __game.world, I = ISLANDS[w.id];
if (!I) throw new Error('島ではない: ' + w.id);
const SIZE = I.size ?? 480, STEP = 4, N = SIZE / STEP, X0 = -SIZE / 2;
const rle = (s) => { let o = '', i = 0; while (i < s.length) { let j = i; while (j < s.length && s[j] === s[i] && j - i < 99) j++; o += (j - i > 1 ? j - i : '') + s[i]; i = j; } return o; };
let zs = '', hs = '';
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const x = X0 + i * STEP + STEP / 2, z = X0 + j * STEP + STEP / 2, h = w.terrain.heightAt(x, z);
  zs += (w.zoneAt(x, z) || '~')[0];
  hs += h < 0 ? '.' : 'abcdefghij'[Math.min(9, Math.floor(h / 3))];
}
const SP = I.spots.map((s) => [s.n, s.name, s.x, s.z]);
// 固定湧きの行: [行の番号, 種類, スポット（なければ null）, 数, 動き, x, z]
// 自然湧きの範囲 WILD: [番号, 名前, 区域の字, x, z, 半径, 敵（"drone,dog×2"）, 夜の上限, 昼の上限]
const OLD = [];
const WILD = (I.wild ?? []).map((w, i) => [i, w.name, w.zones, w.x, w.z, w.r, w.mobs.map(([k, n]) => k + (n > 1 ? '×' + n : '')).join(','), w.night, w.day]);
I.spawns.forEach((e, i) => {
  const s = e.spot ? I.spots.find((o) => o.n === e.spot) : null, at = s ?? e.at;
  OLD.push([i, e.kind, e.spot ?? null, e.n ?? 1, e.when === 'night' ? 'visit' : e.mode ?? 'guard', at.x, at.z]);
});
JSON.stringify({ name: I.name, size: SIZE, step: STEP, ZR: rle(zs), HR: rle(hs), SP, OLD, WILD });
