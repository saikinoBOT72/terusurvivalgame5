// レンガのパーツの形（docs/rules/building.md「家具と石のパーツ」）。レンガを半分ずつずらして積んだ・並べた見た目
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { pick, shape, merge } from '../style/lowpoly.js';

const box = (w, h, d, x, y, z) => {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
};
const brick = (r) => () => pick(r, [P.clay[1], P.clay[2], P.clay[2]]);
// 段 j のレンガの切れ目（偶数段は 3 つ、奇数段は両はしが半分の 4 つ）
const cuts = (j) => (j % 2 ? [-0.5, -1 / 3, 0, 1 / 3, 0.5] : [-0.5, -1 / 6, 1 / 6, 0.5]);

// レンガの土台: 暗い台の上に、レンガを 6 段、半分ずつずらして並べる。上面は y = 0
export function brickFloorGeo(r) {
  const parts = [shape(box(1, 0.2, 1, 0, -0.15, 0), P.clay[0], r)];
  const rows = 6, d = 1 / rows;
  for (let j = 0; j < rows; j++) {
    const xs = cuts(j), h = 0.07 + r() * 0.02;
    for (let i = 0; i < xs.length - 1; i++) {
      parts.push(shape(box(xs[i + 1] - xs[i] - 0.02, h, d - 0.02, (xs[i] + xs[i + 1]) / 2, -h / 2, -0.5 + d * (j + 0.5)), brick(r), r, { jit: 0.008 }));
    }
  }
  return merge(parts);
}

// レンガの壁: 暗い芯のまわりに、レンガを 8 段、半分ずつずらして積む。幅 1m、高さ 2m、下端の中心が原点
export function brickWallGeo(r) {
  const rows = 8, h = 2 / rows, parts = [shape(box(1, 2, 0.1, 0, 1, 0), P.clay[0], r)];
  for (let j = 0; j < rows; j++) {
    const xs = cuts(j);
    for (let i = 0; i < xs.length - 1; i++) {
      parts.push(shape(box(xs[i + 1] - xs[i] - 0.02, h - 0.02, 0.15 + r() * 0.02, (xs[i] + xs[i + 1]) / 2, h * (j + 0.5), 0), brick(r), r, { jit: 0.008 }));
    }
  }
  return merge(parts);
}
