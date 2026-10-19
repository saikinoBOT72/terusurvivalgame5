// 墜落島のスポットの物（AI の物）: 伐採ロボの残骸、丸太の山の丸太と杭、壊れたロボの山
// docs/rules/objects.md「墜落島のスポットの物」。ロボットなので敵と同じ部品（mobs/parts.js）と敵の色で作る。前は +z、地面は y = 0
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { pick, shape, merge } from '../style/lowpoly.js';
import { robot as R } from '../mobs/parts.js';

// 箱を、長い向き（x）にそって弓なりに曲げる（反った金属片）
function bentBox(w, h, d, bend) {
  const g = new THREE.BoxGeometry(w, h, d, 2, 1, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + Math.sin((p.getX(i) / w + 0.5) * Math.PI) * bend);
  return g;
}
import { createDrone } from '../mobs/drone.js';
import { createCrab } from '../mobs/crab.js';
import { createDog } from '../mobs/dog.js';

// 伐採ロボの残骸（大。3.5m）: あおむけに倒れた大きなロボ。箱の胴、割れた画面に × の目、片腕の大きな丸ノコ（黄と黒の帯の 12 角の円盤）、
// 折れたもう片腕、2 本のキャタピラ。つるが胴にからむ
export function loggerWreck(r) {
  const parts = [];
  const lie = { rot: [-1.3, 0.3, 0] }; // あおむけ（後ろへ倒れ、割れた画面が空を見る）
  const T = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...lie.rot));
  const at = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(T).add(new THREE.Vector3(0, 0.3, 0)).toArray();
  parts.push(R.bevel(r, [1.4, 1.1, 1.0], P.robotShell, { rot: lie.rot, at: at(0, 0.55, 0) }));
  parts.push(R.bevel(r, [0.75, 0.5, 0.5], P.robotShell, { rot: lie.rot, at: at(0, 1.35, 0.05) }));
  parts.push(R.block(r, [0.6, 0.34, 0.06], P.robotScreen, { rot: lie.rot, at: at(0, 1.36, 0.3) }));
  parts.push(R.block(r, [1.46, 0.14, 1.04], P.robotHazard, { rot: lie.rot, at: at(0, 0.8, 0) })); // 胴の黄色い帯
  for (const s of [-1, 1]) { // × の目（消えている）。2 本を 1 つの形にする
    const a = 0.065, b = 0.018, X = new THREE.Shape([[0, b], [a - b, a], [a, a - b], [b, 0], [a, b - a], [a - b, -a], [0, -b], [b - a, -a], [-a, b - a], [-b, 0], [-a, a - b], [b - a, a]].map(([u, v]) => new THREE.Vector2(u, v)));
    const x = shape(new THREE.ExtrudeGeometry(X, { depth: 0.03, bevelEnabled: false }), P.robotEye[0], r); // × の形の板
    x.applyMatrix4(T).translate(...at(-0.12 * s, 1.38, 0.34));
    parts.push(x);
  }
  // 丸ノコの腕: 右の肩から横へ出て、円盤は地面に立って刺さる
  parts.push(R.tube(r, 0.12, 1.1, P.robotFrame, { rot: [0, 0, Math.PI / 2 - 0.3], at: [1.15, 0.55, 0.15] }));
  const saw = new THREE.CylinderGeometry(0.78, 0.78, 0.1, 12, 1), sp = saw.attributes.position;
  for (let i = 0; i < sp.count; i++) { // 刃: 1 つおきの角を外へ
    const a = Math.atan2(sp.getZ(i), sp.getX(i)), k = Math.round((a / (Math.PI * 2)) * 12 + 12) % 2;
    if (Math.hypot(sp.getX(i), sp.getZ(i)) > 0.5 && k) { sp.setX(i, sp.getX(i) * 1.12); sp.setZ(i, sp.getZ(i) * 1.12); }
  }
  saw.rotateX(Math.PI / 2).rotateY(0.5).translate(1.75, 0.62, 0.35);
  parts.push(shape(saw, (f) => (Math.abs(f.nx * Math.sin(0.5) + f.nz * Math.cos(0.5)) > 0.8
    ? (Math.floor((Math.atan2(f.y - 0.62, f.x - 1.75) / Math.PI) * 4 + 8) % 2 ? P.robotHazard[1] : P.robotFrame[0]) : P.robotMetal[1]), r, { vary: 0.03 }));
  parts.push(R.tube(r, 0.11, 0.55, P.robotRust, { rot: [0.3, 0, -Math.PI / 2 - 0.4], at: [-1.0, 0.35, 0.3] })); // 折れた左腕
  for (const s of [-1, 1]) { // キャタピラ（後ろに残る脚）。踏み板の帯
    const g = new THREE.BoxGeometry(0.36, 0.42, 1.3, 1, 1, 6).rotateX(-0.25).translate(s * 0.42, 0.3, 0.95); // 足のほう（+z）
    parts.push(shape(g, (f) => (f.ny > 0.6 || f.ny < -0.6 ? (Math.floor((f.z + 2) / 0.22) % 2 ? P.robotFrame[0] : P.robotFrame[1]) : P.robotFrame[1]), r, { vary: 0.03 }));
  }
  parts.push(R.strut(r, [[-0.75, 0.05, -0.5], [-0.5, 0.75, -0.2], [0.1, 0.95, 0.1], [0.55, 0.6, 0.45], [0.75, 0.05, 0.55]], [0.05, 0.05, 0.06, 0.05, 0.04], P.grass)); // つる
  return merge(parts);
}

// 丸太の山の丸太 1 本（長さ 3.6m、八角形、切り口は明るい）。長い向きは x
export function pileLog(r) {
  const g = new THREE.CylinderGeometry(0.22, 0.23, 3.6, 8, 2).rotateZ(Math.PI / 2);
  return shape(g, (f) => (Math.abs(f.nx) > 0.9 ? P.wood[4] : pick(r, [P.wood[1], P.wood[2]])), r, { jit: 0.025 });
}
// 丸太の山の位置（3・2・1 段）と、両はしの止めの杭
export const LOG_PILE = [[-0.46, 0.23], [0, 0.23], [0.46, 0.23], [-0.23, 0.62], [0.23, 0.62], [0, 1.01]];
export function pileStakes(r) {
  return merge([-1, 1].map((s) => shape(new THREE.BoxGeometry(0.12, 1.3, 0.12).translate(0, 0.6, s * 0.78), P.wood[2], r)));
}
export function logPile(r) {
  const log = pileLog(r);
  return merge([...LOG_PILE.map(([z, y]) => log.clone().translate(0, y, z)), pileStakes(r).translate(1.0, 0, 0), pileStakes(r).translate(-1.0, 0, 0)]);
}

// 壊れたロボの山（大。5m）: 敵の見本（ブンブン 2・カニ・犬）を撃墜のポーズで積み、さびの色を混ぜ、すき間を金属片の塚で埋める
// 敵の形をそのまま使うので Group で返す（三角形の数は敵の例外。objects.md）
export function robotHeap(r) {
  const root = new THREE.Group(), rust = new THREE.Color(P.robotRust[1]), c = new THREE.Color();
  const top = (x, z) => 1.1 * Math.max(0, 1 - (x * x + z * z) / 4.4); // 塚の上の高さ
  const mound = new THREE.IcosahedronGeometry(2.0, 1).scale(1.1, 0.18, 1); // すき間を埋める低い土の塚
  const add = (geo) => { const m = new THREE.Mesh(geo, MAT_HEAP); m.castShadow = m.receiveShadow = true; geo.computeVertexNormals(); root.add(m); };
  add(shape(mound, () => pick(r, [P.soil[0], P.soil[1], P.robotRust[0]]), r, { jit: 0.15 }));
  const scrap = []; // 積み上がった金属くず: 反った板・筒・装甲のかたまりを、上ほど少なく
  for (let k = 0; k < 28; k++) {
    const d = Math.sqrt(r()) * 1.9, a = r() * Math.PI * 2, x = Math.cos(a) * d, z = Math.sin(a) * d, y = top(x, z) * (0.35 + r() * 0.55);
    const rot = [r() * 3, r() * 3, r() * 3], col = pick(r, [P.robotShell, P.robotMetal, P.robotRust, P.robotFrame, P.robotRust]), t = k % 3;
    if (t === 0) scrap.push(shape(bentBox(0.5 + r() * 0.4, 0.08, 0.35 + r() * 0.15, 0.08).applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot))).translate(x, y, z), col[1], r, { jit: 0.03 }));
    else if (t === 1) scrap.push(R.tube(r, 0.12 + r() * 0.1, 0.45 + r() * 0.2, col, { rot, at: [x, y, z] }));
    else scrap.push(R.bevel(r, [0.4, 0.28, 0.32], col, { rot, at: [x, y, z] }));
  }
  add(merge(scrap));
  // 敵の見本を撃墜のポーズで、塚の上に載せる
  const pile = [[createDog, [0.3, 0.5], [0.25, 0.9, 1.6], 0.06], [createCrab, [-1.1, 0.6], [0, -0.6, 0.35], 0.02],
    [createDrone, [1.25, -0.5], [0.4, 2.2, 0.8], 0.12], [createDrone, [-0.5, -0.8], [-0.7, 0.4, 2.5], 0.15]];
  pile.forEach(([make, [x, z], rot, lift], k) => {
    const m = make(11 + k);
    m.setPose('down');
    for (let i = 0; i < 60; i++) m.update(0, 1 / 30);
    m.root.position.set(x, top(x, z) + lift, z);
    m.root.rotation.set(...rot);
    m.root.traverse((o) => { // さびを混ぜる（形は共有なので複製してから塗る）。目は消す
      if (!o.isMesh) return;
      o.geometry = o.geometry.clone();
      const col = o.geometry.attributes.color;
      if (col) for (let i = 0; i < col.count; i++) { c.fromBufferAttribute(col, i).lerp(rust, 0.3 + ((i * 7) % 5) * 0.06); col.setXYZ(i, c.r, c.g, c.b); }
      if (o.material.emissive) { o.material = o.material.clone(); o.material.emissiveIntensity = 0; }
      o.castShadow = o.receiveShadow = true;
    });
    root.add(m.root);
  });
  // ばらばらの部品: ファンの囲い 3、折れ線の脚 2、割れた画面 2、胴の筒 1、金属片の板 5
  const bits = [];
  for (const [x, z, a] of [[1.6, 0.6, 1.2], [-1.5, -0.4, 0.5], [0.4, 1.4, 1.9]]) bits.push(R.duct(r, 0.17, 0.03, 0.05, P.robotFrame, { rot: [a, a * 2, 0.3], at: [x, top(x, z) + 0.12, z] }));
  for (const [x, z, s] of [[-0.3, 1.5, 1], [1.0, -1.2, -1]]) {
    const y = top(x, z);
    bits.push(R.strut(r, [[x, y + 0.05, z], [x + 0.3 * s, y + 0.35, z + 0.1], [x + 0.6 * s, y + 0.05, z + 0.15]], [0.035, 0.03, 0], P.robotShell));
  }
  for (const [x, z, a] of [[0.9, 0.9, 0.6], [-1.3, 0.9, -0.4]]) bits.push(R.block(r, [0.3, 0.2, 0.05], P.robotScreen, { rot: [-1.1, a, 0], at: [x, top(x, z) + 0.12, z] }));
  bits.push(R.tube(r, 0.22, 0.6, P.robotShell, { rot: [0, 0.4, 1.4], at: [-0.2, top(-0.2, -1.4) + 0.2, -1.4] }));
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + r(), d = 1.2 + r() * 0.7, x = Math.cos(a) * d, z = Math.sin(a) * d;
    bits.push(shape(new THREE.BoxGeometry(0.8, 0.08, 0.5).rotateZ(0.35 + r() * 0.4).rotateY(a).translate(x, top(x, z) + 0.1, z), k % 2 ? P.robotRust[2] : P.robotMetal[1], r, { jit: 0.04 }));
  }
  add(merge(bits));
  return root;
}
const MAT_HEAP = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

// 壊れたロボ 1 体（AI の跡の、動かない残骸）: 敵の見本を撃墜のポーズで止め、さびを混ぜて目を消す
export function deadRobot(make, seed, rustK = 0.35) {
  const m = make(seed), rust = new THREE.Color(P.robotRust[1]), c = new THREE.Color();
  m.setPose('down');
  for (let i = 0; i < 60; i++) m.update(0, 1 / 30);
  m.root.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry = o.geometry.clone();
    const col = o.geometry.attributes.color;
    if (col) for (let i = 0; i < col.count; i++) { c.fromBufferAttribute(col, i).lerp(rust, rustK + ((i * 7) % 5) * 0.06); col.setXYZ(i, c.r, c.g, c.b); }
    if (o.material.emissive) { o.material = o.material.clone(); o.material.emissiveIntensity = 0; }
    o.castShadow = o.receiveShadow = true;
  });
  return m.root;
}
