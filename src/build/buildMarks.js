// 建築の目印（docs/rules/ui.md「建築の操作」）: プレビューの向きの矢印、撤去で消えるパーツの赤い重ね
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { PARTS, partGeometry } from './parts.js';

// 向きの矢印: 床に寝かせた平らな矢印。-z の向きを指す（長さ 0.7m）
export function createArrow() {
  const s = new THREE.Shape();
  [[-0.06, 0.3], [0.06, 0.3], [0.06, -0.1], [0.16, -0.1], [0, -0.4], [-0.16, -0.1], [-0.06, -0.1]].forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
  const g = new THREE.ShapeGeometry(s);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: P.ui.ok, depthTest: false, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  m.renderOrder = 3;
  return m;
}
// パーツの「前」の向き（矢印の回り方）。向きに意味のない物は null
export function arrowYaw(type) {
  const d = PARTS[type];
  if (d.boat) return -Math.PI / 2; // 小舟の前は +x
  if (d.stairs || d.roof || d.sail || d.helm) return 0; // 上る向き・帆が押す向き・舵の前（-z）
  return null;
}

// 撤去で消えるパーツを赤く重ねる
const MAT = new THREE.MeshBasicMaterial({ color: P.ui.ng, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
export function createRemoveMarks() {
  const group = new THREE.Group(), pool = [];
  return {
    group,
    // parts: 消えるパーツ（世界での位置は part.mesh から）
    show(parts) {
      parts.forEach((p, i) => {
        let m = pool[i];
        if (!m) { m = new THREE.Mesh(undefined, MAT); m.matrixAutoUpdate = false; m.renderOrder = 2; pool.push(m); group.add(m); }
        m.geometry = partGeometry(p.type, PARTS[p.type].frame ? 'frame' : 'build');
        p.mesh.updateWorldMatrix(true, false);
        m.matrix.copy(p.mesh.matrixWorld);
        m.visible = true;
      });
      for (let i = parts.length; i < pool.length; i++) pool[i].visible = false;
    },
  };
}
