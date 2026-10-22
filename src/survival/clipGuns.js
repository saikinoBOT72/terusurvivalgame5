// クリップで動く銃の表（weapons.md「銃の仕組み」）: 持ち物の名前 → 形、動きのデータ（gunClips/）、照準（覗き込みで真ん中に来る線）
// 残りの 12 丁はここに 1 行ずつ足す（形は akShapes.js 方式、データは scripts/gunClips.mjs で作る）
import { merge } from '../style/lowpoly.js';
import { akRig } from './akShapes.js';
import { cyberAkRig } from './cyberShapes.js';
import AK from './gunClips/ak.js';

export const CLIP_GUNS = {
  // sight: 後ろの照準のみぞ rear と前の照準の先 front（形の向き: 前が +z）
  ak47: { rig: () => akRig(), data: AK, sight: { rear: [0, 0.06, 0.151], front: [0, 0.079, 0.512] } },
  cyberAk47: { rig: () => cyberAkRig('rose'), data: AK, sight: { rear: [0, 0.067, 0.162], front: [0, 0.075, 0.512] } },
};

// 持ち物の形（アイコン・落ちている物）: 動く形の部品を 1 つにまとめる
export function rigGeometry(rig) {
  rig.updateMatrixWorld(true);
  const geos = [];
  rig.traverse((o) => { if (o.isMesh) geos.push(o.geometry.clone().applyMatrix4(o.matrixWorld)); });
  return merge(geos);
}
export const CLIP_GUN_SHAPES = Object.fromEntries(Object.entries(CLIP_GUNS).map(([id, g]) => [id, () => rigGeometry(g.rig())]));
