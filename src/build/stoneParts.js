// 石のパーツの形（docs/rules/building.md「家具と石のパーツ」）。石を並べた・積んだ凹凸のある見た目
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { pick, shape, merge } from '../style/lowpoly.js';

const box = (w, h, d, x, y, z) => {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
};
const stone = (r) => () => pick(r, [P.stone[1], P.stone[2], P.stone[3]]);

// 石の土台: 暗い台の上に、平たい石を 4 × 4 枚、高さを少しずつ変えて並べる。上面は y = 0
export function stoneFloorGeo(r) {
  const parts = [shape(box(1, 0.2, 1, 0, -0.15, 0), P.stone[0], r)];
  for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) {
    const h = 0.07 + r() * 0.03;
    parts.push(shape(box(0.235, h, 0.235, -0.375 + i * 0.25, -h / 2, -0.375 + k * 0.25), stone(r), r, { jit: 0.012 }));
  }
  return merge(parts);
}

// 石の壁: 高さ 0.25m ほどの石を、段ごとに半分ずらして積む。幅 1m、高さ 2m、下端の中心が原点
export function stoneWallGeo(r) {
  const parts = [], rows = 8, h = 2 / rows;
  for (let j = 0; j < rows; j++) {
    const off = j % 2 ? 0.25 : 0, xs = [-0.5];
    for (let x = -0.5 + (off || 0.5); x < 0.5 - 0.01; x += 0.5) xs.push(x);
    xs.push(0.5);
    for (let i = 0; i < xs.length - 1; i++) {
      const w = xs[i + 1] - xs[i], d = 0.14 + r() * 0.03;
      parts.push(shape(box(w - 0.02, h - 0.02, d, (xs[i] + xs[i + 1]) / 2, h * (j + 0.5), (r() - 0.5) * 0.01), stone(r), r, { jit: 0.012 }));
    }
  }
  return merge(parts);
}
