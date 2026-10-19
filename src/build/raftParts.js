// いかだの床の形（docs/rules/building.md「いかだの床」）。竹の丸太 4 本、下に横木 2 本、上にひものしばり 2 か所
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { pick, shape, merge } from '../style/lowpoly.js';

const LOG_R = 0.13; // 丸太の太さの半分（6 角の角まで）。横の角どうしが少し重なり、照準がすき間を抜けない
const LOG_H = LOG_R * 0.866; // 平らな上面までの高さ

// 上面は y = 0。丸太は x 方向（長さ 1m）、z 方向に 4 本並べる。cols: 丸太の色、ties: 上のひものしばり
export function raftFloorGeo(r, cols = [P.bamboo[1], P.bamboo[2]], ties = true) {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.CylinderGeometry(LOG_R, LOG_R, 0.98, 6);
    g.rotateZ(Math.PI / 2); // 上面が平らで、横に角が向く
    g.rotateX((r() - 0.5) * 0.16); // 丸太ごとに少し回して、面の向きをばらつかせる
    g.translate((r() - 0.5) * 0.02, -LOG_H, -0.375 + i * 0.25);
    parts.push(shape(g, () => pick(r, cols), r, { jit: 0.004 }));
  }
  // 丸太の上面のすぐ下に薄い板（丸太の間の溝の底に見える）。溝を照準が抜けないように
  parts.push(shape(new THREE.BoxGeometry(0.96, 0.03, 0.96).translate(0, -0.045, 0), P.bamboo[0], r));
  for (const x of [-0.35, 0.35]) { // 下の横木
    const g = new THREE.BoxGeometry(0.08, 0.05, 0.98);
    g.translate(x, -2 * LOG_H - 0.02, 0);
    parts.push(shape(g, P.bamboo[0], r));
    if (!ties) continue;
    const t = new THREE.BoxGeometry(0.05, 0.03, 0.96); // 上のひも
    t.translate(x, 0.005, 0);
    parts.push(shape(t, P.straw[0], r));
  }
  return merge(parts);
}

const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const wood = (r) => () => pick(r, [P.wood[2], P.wood[3]]);
export const SAIL_TOP = 2.74; // 帆の布をつるす高さ（たたむと、ここへ巻き上がる）

// 帆の柱と横木（下面の中心が原点、高さ 2.9m）。布は sailClothGeo で別に作る
export function sailFrameGeo(r) {
  const mast = new THREE.CylinderGeometry(0.05, 0.06, 2.9, 6).translate(0, 1.45, 0);
  return merge([
    shape(box(0.3, 0.12, 0.3, 0, 0.06, 0), P.wood[1], r),
    shape(mast, wood(r), r, { jit: 0.004 }),
    shape(box(1.1, 0.07, 0.07, 0, SAIL_TOP + 0.02, 0), P.wood[1], r),
    shape(box(1.0, 0.05, 0.05, 0, 0.84, 0), P.wood[1], r),
  ]);
}
// 帆の布: 上端が y = 0（つるす所）、下へ 1.85m。前（-z）へふくらむ
export function sailClothGeo(r) {
  const g = new THREE.BoxGeometry(0.98, 1.85, 0.025, 4, 4, 1), q = g.attributes.position;
  for (let i = 0; i < q.count; i++) {
    const u = q.getX(i) / 0.49, v = (q.getY(i) + 0.925) / 1.85; // 横 -1〜1、縦 0〜1
    q.setZ(i, q.getZ(i) - 0.18 * (1 - u * u) * Math.sin(Math.PI * Math.min(1, v * 1.1)));
  }
  g.translate(0, -0.925 - 0.03, -0.06);
  return shape(g, () => pick(r, [P.straw[2], P.dryGrass[3]]), r, { jit: 0.006 });
}
export const sailGeo = (r) => merge([sailFrameGeo(r), sailClothGeo(r).translate(0, SAIL_TOP, 0)]); // 張った姿（見本・プレビュー）

// 舵: 台と柱に、8 本の取っ手のついた輪。輪は後ろ（+z）を向く。高さ 1.2m
export function helmGeo(r) {
  const c = 0.82, parts = [shape(box(0.5, 0.1, 0.5, 0, 0.05, 0), P.wood[1], r), shape(box(0.14, c, 0.14, 0, c / 2, 0), wood(r), r, { jit: 0.004 })];
  const rim = new THREE.TorusGeometry(0.28, 0.03, 4, 8).translate(0, c, 0.12);
  parts.push(shape(rim, P.wood[2], r));
  for (let k = 0; k < 4; k++) parts.push(shape(box(0.76, 0.035, 0.035, 0, 0, 0).rotateZ(k * Math.PI / 4).translate(0, c, 0.12), P.wood[3], r));
  parts.push(shape(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 6).rotateX(Math.PI / 2).translate(0, c, 0.1), P.wood[1], r));
  return merge(parts);
}

// いかだのコア: いかだの床と同じ形で、見た目だけ違う（building.md）。木の色の丸太、上に X のひも、四隅に黒い留め具。上は平ら
export function raftCoreGeo(r) {
  const parts = [raftFloorGeo(r, [P.wood[2], P.wood[3]], false)];
  for (const a of [Math.PI / 4, -Math.PI / 4]) parts.push(shape(box(1.25, 0.025, 0.06, 0, 0.005, 0).rotateY(a), P.straw[0], r));
  for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [0.4, 0.4], [-0.4, 0.4]]) parts.push(shape(box(0.09, 0.04, 0.09, x, 0.01, z), P.wood[0], r));
  return merge(parts);
}
