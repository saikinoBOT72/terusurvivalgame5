// 土台の下の草を隠す（docs/rules/building.md）。草1本ごとに「何枚の土台に覆われているか」を数える。
import * as THREE from 'three';
import { circleHitsShape } from '../build/grid.js';

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const key = (x, z) => `${Math.floor(x)},${Math.floor(z)}`;

export function createGrassCover() {
  const cells = new Map(); // 1m のマス → [{x, z, n, show(v)}]
  return {
    // インスタンス描画の草
    addInstanced(mesh, items) {
      items.forEach((it, i) => {
        const m = new THREE.Matrix4();
        mesh.getMatrixAt(i, m);
        this.add(it.x, it.z, (v) => { mesh.setMatrixAt(i, v ? m : HIDDEN); mesh.instanceMatrix.needsUpdate = true; });
      });
    },
    add(x, z, show) {
      const k = key(x, z);
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k).push({ x, z, n: 0, show });
    },
    // shapes に覆われる草を、d = +1 で隠し、-1 で戻す
    cover(shapes, d) {
      for (const b of shapes) {
        for (let x = Math.floor(b.cx - b.radius); x <= b.cx + b.radius; x++) {
          for (let z = Math.floor(b.cz - b.radius); z <= b.cz + b.radius; z++) {
            for (const g of cells.get(key(x, z)) || []) {
              if (!circleHitsShape(g.x, g.z, 0.15, b)) continue;
              g.n += d;
              g.show(g.n <= 0);
            }
          }
        }
      }
    },
  };
}
