// 砂の塊・砂の鉱床の形（objects.md「砂の塊」「砂の鉱床」、survival.md「道具の段階・木の道具・砂とガラス」）
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { shape, merge, pick } from '../style/lowpoly.js';

export const SAND_BED_R = 4.6; // 砂の鉱床の半径（m）。oreBed.js の BED_R と同じ

// 砂の面の色: 上を向いた面は明るく、横は暗め
const sandCol = (rand) => (f) => (f.ny > 0.5 ? pick(rand, [P.sand[2], P.sand[3], P.sand[2]]) : pick(rand, [P.sand[1], P.sand[2]]));

// 砂の塊（小、1.2m）: ふくらんだ山 1 つに小さな山 2 つが寄りそう。底は地面に埋める
export function sandMound(rand) {
  const parts = [[0, 0, 0.5, 0.42], [0.46, 0.18, 0.28, 0.24], [-0.3, 0.38, 0.24, 0.2]].map(([x, z, r, h]) => {
    const g = new THREE.IcosahedronGeometry(r, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setY(i, 0); // 下半分は平らにして地面に埋める
    g.scale(1.2, h / r, 1).rotateY(rand() * Math.PI).translate(x, -0.04, z);
    return shape(g, sandCol(rand), rand, { jit: r * 0.1 });
  });
  return merge(parts);
}

// 砂の鉱床（例外の大きさ）: 直径 9〜10m の平たい砂丘。うねを 3〜4 本。高さは 0.2m まで
export function sandBed(rand) {
  const R = SAND_BED_R, parts = [];
  // うね: 細長くつぶした山を、同じ向きに並べる（中ほど高く）
  const ridges = 3 + Math.floor(rand() * 2), dir = rand() * Math.PI;
  for (let i = 0; i < ridges; i++) {
    const off = ((i + 0.5) / ridges - 0.5) * R * 1.5, len = R * (1.5 - Math.abs(off) / R * 0.7), w = 1.5 + rand() * 0.5;
    const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position;
    for (let k = 0; k < p.count; k++) if (p.getY(k) < 0) p.setY(k, 0);
    g.scale(len * 0.5, 0.18, w).rotateY(dir).translate(Math.sin(dir) * off, -0.02, Math.cos(dir) * off);
    parts.push(shape(g, sandCol(rand), rand, { jit: 0.03 }));
  }
  // 小さな砂のこぶ: うねのすき間に（部品を増やして表情を出す）
  for (let i = 0; i < 8; i++) {
    const a = rand() * Math.PI * 2, d = R * (0.35 + rand() * 0.6), sz = 0.35 + rand() * 0.35, g = new THREE.IcosahedronGeometry(sz, 0);
    g.scale(1.5, 0.3, 1).rotateY(rand() * Math.PI).translate(Math.cos(a) * d, 0.02, Math.sin(a) * d);
    parts.push(shape(g, sandCol(rand), rand, { jit: sz * 0.1 }));
  }
  // 土台: ごく低く広い砂の面（うねの根元をつなぐ）
  const base = new THREE.CylinderGeometry(R * 0.95, R, 0.1, 10, 1);
  base.translate(0, -0.01, 0);
  parts.push(shape(base, (f) => (f.ny > 0.5 ? pick(rand, [P.sand[1], P.sand[2]]) : P.sand[0]), rand, { jit: 0.04 }));
  return merge(parts);
}
