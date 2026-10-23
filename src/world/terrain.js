// ブロックの地形（docs/rules/terrain.md「地形（ブロック）」）
// 1m × 1m × 高さ 0.5m のブロックの 3D の格子。ブロックの形は上の角 4 つと下の角 4 つ（voxelMesh.js の形のコード）
// はじめは「タイルの 4 つの角の高さ」から埋める（坂・外角・内角・斜めは上が欠けたブロック）。そのあと洞窟などで削る（setCell）
// 形は区画ごとに作る（buildChunk）。広い島でも一部だけ作り直せるようにするため。
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { rng, pick, paint, makeMesh } from '../style/lowpoly.js';
import { meshTriangles, surf, FULL, VH } from './voxelMesh.js';

// 地形が影を落とすか（影の品質「低」で切る。game/renderer.js が変える）
export const terrainShadow = { on: true };

export const STEP = VH;

// tile(tx, tz) → [角0, 角1, 角2, 角3] の高さ（タイルごと。崖ではとなりと違ってよい）
// または corner(x, z): 角の高さ（となりと共有）＋ tileOffset(tx, tz): タイルごとの持ち上げ
export function createTerrain({
  w, d, x0, z0, corner, tileOffset = () => 0, tile = null,
  waterLevel = -10, sandLevel = waterLevel + 0.25, snowLevel = 6, base = -3, seed = 3, ground = null, // ground(面, 乱数): 場所ごとの色（なければ null）
  headroom = 4, // いちばん高い所より上に空けておく高さ（ひさしなどを足せるように）
}) {
  // 1) タイルの角の高さ。1 枚の中で 0.5m より差がある角は、真ん中の高さの段にそろえる（45 度の坂は作らない）
  const tc = new Float32Array(w * d * 4);
  let maxH = base;
  for (let tz = 0; tz < d; tz++) for (let tx = 0; tx < w; tx++) {
    let h;
    if (tile) h = tile(tx, tz);
    else { const x = x0 + tx, z = z0 + tz, off = tileOffset(tx, tz); h = [corner(x, z) + off, corner(x + 1, z) + off, corner(x + 1, z + 1) + off, corner(x, z + 1) + off]; }
    h = h.map((v) => Math.max(base + VH, Math.round(v / VH) * VH));
    let lo = Math.min(...h);
    if (Math.max(...h) - lo > VH) { lo = Math.floor(((h[0] + h[1] + h[2] + h[3]) / 4 - VH / 2) / VH) * VH; h = h.map((v) => Math.min(lo + VH, Math.max(lo, v))); }
    tc.set(h, (tz * w + tx) * 4);
    maxH = Math.max(maxH, ...h);
  }
  const L = Math.ceil((maxH + headroom - base) / VH) + 1; // 1 本の柱のブロックの数
  const cells = new Uint8Array(w * d * L);
  const colMin = new Int16Array(w * d); // 柱の中でいちばん下の、詰まっていないブロック
  const colTop = new Int16Array(w * d); // 柱の中でいちばん上の、空でないブロック
  const layer = (y) => Math.round((y - base) / VH);
  for (let col = 0; col < w * d; col++) {
    const h = tc.subarray(col * 4, col * 4 + 4), m = Math.min(...h), lm = layer(m);
    cells.fill(FULL, col * L, col * L + lm);
    const mask = (h[0] > m) | ((h[1] > m) << 1) | ((h[2] > m) << 2) | ((h[3] > m) << 3);
    if (mask && lm < L) cells[col * L + lm] = mask;
    colMin[col] = lm; colTop[col] = mask ? lm : lm - 1;
  }
  function recount(col) {
    let lo = 0; while (lo < L && cells[col * L + lo] === FULL) lo++;
    let hi = L - 1; while (hi >= 0 && !cells[col * L + hi]) hi--;
    colMin[col] = lo; colTop[col] = hi;
  }
  // ブロックを変える（tx, tz: タイル、ly: 下からの段）。体積のない形は空にする
  function setCell(tx, tz, ly, c) {
    if (tx < 0 || tz < 0 || tx >= w || tz >= d || ly < 0 || ly >= L) return;
    if (((c & 15) & ~(c >> 4)) === 0) c = 0;
    cells[(tz * w + tx) * L + ly] = c;
    recount(tz * w + tx);
  }
  const getCell = (tx, tz, ly) => (tx < 0 || tz < 0 || tx >= w || tz >= d || ly < 0 || ly >= L ? 0 : cells[(tz * w + tx) * L + ly]);
  // 柱をまとめて変える（cs: 下から順の形のコード。洞窟を削るときに使う）
  function setColumn(tx, tz, from, cs) {
    if (tx < 0 || tz < 0 || tx >= w || tz >= d) return;
    const col = tz * w + tx;
    cs.forEach((c, i) => { const ly = from + i; if (ly >= 0 && ly < L) cells[col * L + ly] = ((c & 15) & ~(c >> 4)) === 0 ? 0 : c; });
    recount(col);
  }

  // 位置 → 柱と、その中の位置
  const at = (x, z) => {
    const gx = x - x0, gz = z - z0, tx = Math.floor(gx), tz = Math.floor(gz);
    if (tx < 0 || tz < 0 || tx >= w || tz >= d) return null;
    return { col: tz * w + tx, fx: gx - tx, fz: gz - tz };
  };
  // いちばん上の地面の高さ（外の地面。洞窟の上の地面もこれ）
  function heightAt(x, z) {
    const p = at(x, z);
    if (!p) return base;
    const ly = colTop[p.col];
    if (ly < 0) return base;
    return base + ly * VH + surf(cells[p.col * L + ly] & 15, p.fx, p.fz);
  }
  // 足元の床: y より下で、いちばん高い床の高さ。y がブロックの中なら、そのブロックの上の面（＝高すぎて進めない）
  function floorAt(x, y, z) {
    const p = at(x, z);
    if (!p) return base;
    for (let ly = Math.min(colTop[p.col], Math.floor((y - base) / VH)); ly >= 0; ly--) {
      const c = cells[p.col * L + ly];
      if (!c) continue;
      const yb = base + ly * VH, top = yb + surf(c & 15, p.fx, p.fz);
      if (top <= y + 1e-4 || y >= yb + surf(c >> 4, p.fx, p.fz)) return top;
    }
    return base;
  }
  // 頭の上の天井: y より上で、いちばん低いブロックの下の面の高さ（なければ Infinity）。y がブロックの中なら y
  function ceilingAt(x, y, z) {
    const p = at(x, z);
    if (!p) return Infinity;
    for (let ly = Math.max(0, Math.floor((y - base) / VH)); ly <= colTop[p.col]; ly++) {
      const c = cells[p.col * L + ly];
      if (!c) continue;
      const yb = base + ly * VH, bot = yb + surf(c >> 4, p.fx, p.fz);
      if (bot >= y - 1e-4) return bot;
      if (y < yb + surf(c & 15, p.fx, p.fz)) return y;
    }
    return Infinity;
  }
  // 地面の下（洞窟の中など）にいるか: 頭の上に地形があるか
  const underRock = (x, y, z) => ceilingAt(x, y, z) < Infinity;
  // (x, y, z) が地形の中か（見通し・弾の当たり）
  function solidAt(x, y, z) {
    const p = at(x, z);
    if (!p) return y < base;
    const ly = Math.floor((y - base) / VH);
    if (ly < 0) return true;
    if (ly > colTop[p.col]) return false;
    const c = cells[p.col * L + ly], yb = base + ly * VH;
    return c !== 0 && y < yb + surf(c & 15, p.fx, p.fz) && y >= yb + surf(c >> 4, p.fx, p.fz);
  }
  // y のあたりの地面（演出の破片・土ぼこりなど）: y が地形の中なら、その岩のてっぺん、外なら下の床
  function groundNear(x, z, y = ref.y) {
    if (y === Infinity) return heightAt(x, z);
    const p = at(x, z);
    if (!p) return base;
    if (!solidAt(x, y, z)) return floorAt(x, y, z);
    let ly = Math.floor((y - base) / VH);
    while (ly < colTop[p.col] && (cells[p.col * L + ly] & 15) === 15 && cells[p.col * L + ly + 1] && (cells[p.col * L + ly + 1] >> 4) === 0) ly++;
    return base + ly * VH + surf(cells[p.col * L + ly] & 15, p.fx, p.fz);
  }
  const ref = { y: Infinity }; // 演出の地面の高さのめやす（プレイヤーの高さ。main.js が毎フレーム入れる）

  // いちばん上のタイル 1 枚の情報（物を置く場所選びに使う）
  function tileAt(x, z) {
    const p = at(x, z);
    if (!p) return null;
    const ly = colTop[p.col];
    if (ly < 0) return null;
    const m = cells[p.col * L + ly] & 15, yb = base + ly * VH;
    const min = m === 15 ? yb + VH : yb, max = m ? yb + VH : yb;
    return { min, max, flat: m === 15 };
  }

  // 色: 高さと傾きで決める（docs/rules/terrain.md「地形の見え方」）
  function colorOf(f, r) {
    if (f.ny < -0.2) return pick(r, [P.rockGray[0], P.rockGray[1]]); // 天井・ひさしの下の面
    if (f.ny > 0.2 && f.y < heightAt(f.x, f.z) - 0.75) return pick(r, [P.rockGray[1], P.rockGray[2], P.soil[1], P.rockBrown[1]]); // 洞窟の床（上に岩がある）
    const own = ground?.(f, r); // スポットの地面（spotTerrain.js）
    if (own) return own;
    if (Math.abs(f.ny) < 0.2) { // 崖の壁: 0.5m ごとに岩の色を変えて地層に見せる
      if (f.y < waterLevel) return pick(r, [P.soil[0], P.soil[1]]);
      const band = Math.floor(f.y + 0.25) % 3; // 1m ごとの地層（3 色をくり返す。面ごとに少しまぜる）
      return r() < 0.15 ? P.rockGray[2] : [P.rockBrown[1], P.rockBrown[2], P.rockGray[2]][(band + 3) % 3];
    }
    if (f.y < waterLevel + 0.1) return f.y < waterLevel - 0.5 ? P.sand[0] : P.sand[1];
    if (f.y < sandLevel) return P.sand[2];
    if (f.y > snowLevel) return pick(r, [P.snow[1], P.snow[2]]);
    const g = r();
    if (f.ny < 0.97) return g < 0.85 ? P.grass[1] : P.grass[2]; // 坂は少し暗く
    return g < 0.04 ? P.grass[1] : g < 0.95 ? P.grass[2] : P.grass[3];
  }

  // 角の高さの関数を差し替えて、地形をその場で作り直す（マップ作りの広さ変更だけが使う。高さは作ったときの最大を超えない）
  function reshape(newCorner) {
    for (let tz = 0; tz < d; tz++) for (let tx = 0; tx < w; tx++) {
      const x = x0 + tx, z = z0 + tz;
      let h = [newCorner(x, z), newCorner(x + 1, z), newCorner(x + 1, z + 1), newCorner(x, z + 1)].map((v) => Math.max(base + VH, Math.round(v / VH) * VH));
      let lo = Math.min(...h);
      if (Math.max(...h) - lo > VH) { lo = Math.floor(((h[0] + h[1] + h[2] + h[3]) / 4 - VH / 2) / VH) * VH; h = h.map((v) => Math.min(lo + VH, Math.max(lo, v))); }
      const col = tz * w + tx, m = Math.min(...h), lm = layer(m);
      cells.fill(0, col * L, col * L + L);
      cells.fill(FULL, col * L, col * L + lm);
      const mask = (h[0] > m) | ((h[1] > m) << 1) | ((h[2] > m) << 2) | ((h[3] > m) << 3);
      if (mask && lm < L) cells[col * L + lm] = mask;
      colMin[col] = lm; colTop[col] = mask ? lm : lm - 1;
    }
  }

  const T = { w, d, L, x0, z0, base, cells, colMin, colTop };
  // 区画の三角形（見た目と物理で共通）。pos: 面、steep: 登れない面、lines: 格子の線
  const triangles = (tx0, tz0, tw, td) => meshTriangles(T, tx0, tz0, tw, td);

  // 区画（tx0, tz0 から tw × td タイル）の形とマス目の線を作る
  function buildChunk(tx0, tz0, tw, td) {
    const { pos, steep, lines } = triangles(tx0, tz0, tw, td);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const r = rng(seed + tx0 * 131 + tz0 * 7);
    const mesh = makeMesh(paint(geo, (f) => colorOf(f, r), r, 0.04));
    mesh.castShadow = terrainShadow.on;
    mesh.userData.terrain = true;

    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    const grid = new THREE.LineSegments(lg, GRID_MAT);
    grid.visible = false;

    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(steep, 3));
    const steepMesh = new THREE.Mesh(sg, STEEP_MAT);
    steepMesh.visible = false;
    return { mesh, grid, steep: steepMesh };
  }

  return {
    heightAt, floorAt, ceilingAt, underRock, solidAt, groundNear, ref, tileAt, triangles, buildChunk, waterLevel, base,
    getCell, setCell, setColumn, reshape, layer, L, bounds: { x0, z0, w, d },
  };
}

// マス目の線（G キーで表示）
const GRID_MAT = new THREE.LineBasicMaterial({ color: P.ui.text, transparent: true, opacity: 0.35 });
// 登れない面（H キーで表示）
const STEEP_MAT = new THREE.MeshBasicMaterial({
  color: P.ui.ng, transparent: true, opacity: 0.45, depthWrite: false,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide,
});
