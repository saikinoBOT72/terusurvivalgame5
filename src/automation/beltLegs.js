// ベルトの足（automation.md「ベルトコンベア」）: 地面に置いたベルトが地面より浮いているとき、四隅の細い木の足を地面まで伸ばして水平にする
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { MAT, rng, shape, pick } from '../style/lowpoly.js';

const SINK = 0.05; // 地面に埋める深さ
let geo = null;
const legGeo = () => {
  if (!geo) {
    const r = rng(41), g = new THREE.BoxGeometry(0.06, 1, 0.06).translate(0, -0.5, 0); // 上端が y = 0、下へ 1m
    geo = shape(g, () => pick(r, [P.wood[1], P.wood[2]]), r);
  }
  return geo;
};

export function beltLegs(part, world) {
  if (part.y === undefined) return; // 床の上（足は要らない）
  for (const [dx, dz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
    const len = part.pos.y - world.terrain.heightAt(part.pos.x + dx, part.pos.z + dz) + SINK;
    if (len < 0.12) continue; // 組み込みの足の板で足りる
    const m = new THREE.Mesh(legGeo(), MAT.solid);
    m.scale.y = len;
    m.position.set(dx, 0, dz);
    m.castShadow = m.receiveShadow = true;
    part.mesh.add(m);
  }
}
