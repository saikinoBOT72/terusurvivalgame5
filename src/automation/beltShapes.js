// 曲がりのベルト（objects.md「自動化の機械」、automation.md「ベルトコンベア」）: まっすぐの beltGeo（machineShapes.js）と同じ作りで、
// 横（side = +1 なら +x 側、-1 なら -x 側）から流れ込んで +z へ出る。入る側の縁は開き、奥と反対側に縁をつける
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { merge } from '../style/lowpoly.js';
import { sh, box, woody, BELT_Y } from './machineParts.js';

export function beltCurveGeo(r, side) {
  const wood = woody(r), parts = [], y = BELT_Y;
  parts.push(sh(box(0.05, 0.1, 0.5, -side * 0.225, y - 0.03, 0), wood, r, { jit: 0.004 })); // 反対側の縁（まっすぐ）
  parts.push(sh(box(0.5, 0.1, 0.05, 0, y - 0.03, -0.225), wood, r, { jit: 0.004 }));       // 奥の縁
  const cloth = (f) => (f.ny > 0.5 ? P.canvas[0] : P.soil[0]);
  parts.push(sh(box(0.4, 0.03, 0.45, 0, y - 0.015, 0.025), cloth, r, { vary: 0.02 }));      // 前へ向かう帯
  parts.push(sh(box(0.05, 0.03, 0.4, side * 0.225, y - 0.015, 0), cloth, r, { vary: 0.02 })); // 横から入る帯のはし
  parts.push(sh(new THREE.CylinderGeometry(0.045, 0.045, 0.4, 6).rotateZ(Math.PI / 2).translate(0, y - 0.05, 0.22), () => P.ironMetal[1], r)); // 前のローラー
  for (const [x, z] of [[-side * 0.2, -0.2], [-side * 0.2, 0.2]]) parts.push(sh(box(0.06, y - 0.08, 0.06, x, (y - 0.08) / 2, z), wood, r, { jit: 0.004 })); // 足
  const arrow = new THREE.Shape([[-0.09, -0.04], [0, 0.05], [0.09, -0.04], [0.09, -0.09], [0, 0], [-0.09, -0.09]].map(([a, b]) => new THREE.Vector2(a, b)));
  const flat = () => new THREE.ShapeGeometry(arrow).rotateX(-Math.PI / 2).rotateY(Math.PI);
  parts.push(sh(flat().translate(0, y + 0.002, 0.1), () => P.canvas[2], r, { vary: 0.01 }));                       // 前へ向かう矢印
  parts.push(sh(flat().rotateY(-side * Math.PI / 2).translate(side * 0.12, y + 0.002, -0.02), () => P.canvas[2], r, { vary: 0.01 })); // 横から入る矢印
  return merge(parts);
}
