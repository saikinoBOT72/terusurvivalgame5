// 持ち物を広げるかばんの形（docs/rules/objects.md「草の袋・丈夫なかばん」）。itemShapes.js の SHAPES に足して使う
// 草の袋: 植物繊維を編んだ丸い袋、口をひもで絞る。丈夫なかばん: 革色の箱形、ふたとベルトと金具
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { pick, shape, merge } from '../style/lowpoly.js';

export const BAG_SHAPES = {
  grassBag: (r) => {
    const body = new THREE.SphereGeometry(0.14, 7, 5);
    body.scale(1, 0.85, 0.9).translate(0, 0.12, 0);
    const neck = new THREE.CylinderGeometry(0.045, 0.08, 0.1, 7).translate(0, 0.27, 0); // 絞った口
    const frill = new THREE.ConeGeometry(0.075, 0.1, 6).translate(0, 0.37, 0); // 口からはみ出す繊維
    const tie = new THREE.CylinderGeometry(0.058, 0.058, 0.035, 7).translate(0, 0.295, 0);
    return merge([
      shape(body, () => pick(r, [P.straw[0], P.straw[1]]), r, { jit: 0.012 }),
      shape(neck, P.straw[1], r),
      shape(frill, P.straw[2], r, { jit: 0.015 }),
      shape(tie, P.boots[2], r),
    ]);
  },
  toughBag: (r) => {
    const body = new THREE.BoxGeometry(0.34, 0.24, 0.15).translate(0, 0.12, 0);
    const flap = new THREE.BoxGeometry(0.35, 0.1, 0.16).translate(0, 0.22, 0); // ふた
    const belt = new THREE.BoxGeometry(0.05, 0.3, 0.17).translate(0, 0.14, 0); // 縦のベルト
    const buckle = new THREE.BoxGeometry(0.045, 0.045, 0.02).translate(0, 0.17, 0.088); // 金具
    const screws = [-0.14, 0.14].map((x) => new THREE.CylinderGeometry(0.014, 0.014, 0.02, 6).rotateX(Math.PI / 2).translate(x, 0.2, 0.088));
    return merge([
      shape(body, () => pick(r, [P.boots[1], P.boots[2]]), r, { jit: 0.006 }),
      shape(flap, P.boots[2], r, { jit: 0.006 }),
      shape(belt, P.boots[0], r),
      shape(buckle, P.ironMetal[3], r),
      ...screws.map((g) => shape(g, P.ironMetal[2], r)),
    ]);
  },
};
