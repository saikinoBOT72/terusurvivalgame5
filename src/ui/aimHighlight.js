// 照準の先の、拾える物・採れる物・叩ける物を目立たせる（docs/rules/ui.md「画面の整理」）。名前や説明は出さない
// さりげなく: 物と同じ形を少し大きくして裏側の面だけ描き、細い黒い輪郭にする
import * as THREE from 'three';
import { P } from '../style/palette.js';

const OUTLINE = 0.025; // 輪郭の太さ（m の目安）
const MAX = 4; // 1 つの物の部品の数（木は幹と葉で 1 つ）

export function createAimHighlight(scene) {
  const edgeMat = new THREE.MeshBasicMaterial({ color: P.ui.edge, side: THREE.BackSide });
  const pool = Array.from({ length: MAX }, () => {
    const m = new THREE.Mesh(undefined, edgeMat);
    m.matrixAutoUpdate = false; m.visible = false; m.frustumCulled = false;
    scene.add(m);
    return m;
  });
  const inst = new THREE.Matrix4(), grow = new THREE.Matrix4(), to = new THREE.Matrix4(), back = new THREE.Matrix4();

  return {
    // e: resources の物 { x, y, z, r, h, parts: [{ mesh, index }] }。null なら消す
    update(e) {
      pool.forEach((m, k) => {
        const part = e?.parts[k];
        m.visible = !!part;
        if (!part) return;
        part.mesh.getMatrixAt(part.index, inst); // 揺れている間もついていく
        inst.premultiply(part.mesh.matrixWorld);
        // 物の真ん中を中心に少し大きくする（小さい物ほど割合を大きく。上限あり）
        const s = Math.min(1.08, 1 + OUTLINE / Math.max(0.15, e.r, e.h / 2));
        to.makeTranslation(e.x, e.y + e.h / 2, e.z);
        back.makeTranslation(-e.x, -(e.y + e.h / 2), -e.z);
        grow.makeScale(s, s, s);
        m.geometry = part.mesh.geometry;
        m.matrix.copy(to).multiply(grow).multiply(back).multiply(inst); // scene の直下なので matrix = 世界での位置
        m.matrixWorldNeedsUpdate = true;
      });
    },
  };
}
