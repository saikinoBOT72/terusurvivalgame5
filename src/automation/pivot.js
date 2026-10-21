// 動く部分を、決まった点（at）を中心に回せるようにする（showcase.js の pivot と同じ）
import * as THREE from 'three';

export function pivot(mesh, at) {
  const g = new THREE.Group();
  g.position.set(...at);
  mesh.position.set(0, 0, 0);
  g.add(mesh);
  return g;
}
