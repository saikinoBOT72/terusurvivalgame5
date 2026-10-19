// 画面表示だけで使うローポリの形（ゲージのアイコン）。icons.js の iconUrl(id, make) で絵にする
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { rng, pick, shape, makeMesh } from '../style/lowpoly.js';
import { fish as fishGeo } from '../survival/materialShapes.js';

// アイコンは斜めから描くので（icons.js）、少し戻して正面寄りに見せる
function front(mesh) {
  const g = new THREE.Group();
  mesh.rotation.y = 0.55;
  g.add(mesh);
  g.userData.upright = true;
  return g;
}

// ハート（HP）: 角ばったハートの形を厚みのある板にする
function heart() {
  const r = rng(11);
  const s = new THREE.Shape();
  const pts = [[0, -0.5], [0.42, -0.05], [0.5, 0.22], [0.38, 0.42], [0.18, 0.44], [0, 0.26], [-0.18, 0.44], [-0.38, 0.42], [-0.5, 0.22], [-0.42, -0.05]];
  s.moveTo(...pts[0]);
  for (const p of pts.slice(1)) s.lineTo(...p);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.1, bevelSegments: 1 });
  g.translate(0, 0, -0.11);
  return front(makeMesh(shape(g, (f) => (f.nz > 0.6 ? pick(r, [P.food[1], P.food[2]]) : P.food[0]), r, { jit: 0.02 }), { shadow: false }));
}

// 魚（おなか）: 持ち物の魚と同じ形
const fishIcon = () => front(makeMesh(fishGeo(rng(12)), { shadow: false }));

// しずく（水分）: 下が丸く上がとがった形を、6 角のろくろで回す
function drop() {
  const r = rng(13);
  const prof = [[0, -0.42], [0.22, -0.36], [0.32, -0.16], [0.28, 0.06], [0.15, 0.26], [0, 0.48]].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(prof, 6);
  return front(makeMesh(shape(g, (f) => (f.y > 0.1 ? P.water[2] : pick(r, [P.water[1], P.water[2]])), r, { jit: 0.015 }), { shadow: false }));
}

// 泡（息）: 大きい泡 1 つと小さい泡 2 つ
function bubbles() {
  const r = rng(14), parts = [[0, -0.1, 0.3], [0.28, 0.28, 0.14], [-0.2, 0.36, 0.1]].map(([x, y, s]) => {
    const g = new THREE.IcosahedronGeometry(s, 1).translate(x, y, 0);
    return shape(g, (f) => (f.y > y ? P.water[4] : pick(r, [P.water[2], P.water[3]])), r);
  });
  const g = new THREE.Group();
  parts.forEach((p) => g.add(makeMesh(p, { shadow: false })));
  return front(g);
}

// 炎（燃料）: 外の大きい炎（だいだい）と、中の小さい炎（黄）。どちらも少しねじった 5 角すい
function flame() {
  const r = rng(15), g = new THREE.Group();
  for (const [rad, h, col, y, tw] of [[0.36, 0.95, P.fire[0], -0.45, 0.3], [0.2, 0.6, P.fire[2], -0.42, -0.4]]) {
    const c = new THREE.ConeGeometry(rad, h, 5, 2);
    const q = c.attributes.position;
    for (let i = 0; i < q.count; i++) { const t = (q.getY(i) + h / 2) / h, a = t * tw; const x = q.getX(i), z = q.getZ(i); q.setX(i, x * Math.cos(a) - z * Math.sin(a)); q.setZ(i, x * Math.sin(a) + z * Math.cos(a)); }
    c.translate(0, y + h / 2, rad > 0.3 ? 0 : 0.12);
    g.add(makeMesh(shape(c, () => pick(r, [col, P.fire[1]]), r, { jit: 0.02 }), { shadow: false }));
  }
  return front(g);
}

// いなずま（スタミナ。weapons.md）: ジグザグの板
function bolt() {
  const r = rng(16);
  const s = new THREE.Shape();
  const pts = [[0.1, 0.5], [-0.3, 0.02], [-0.02, 0.02], [-0.14, -0.5], [0.3, 0.06], [0.03, 0.06], [0.22, 0.5]];
  s.moveTo(...pts[0]);
  for (const p of pts.slice(1)) s.lineTo(...p);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.05, bevelSegments: 1 });
  g.translate(0, 0, -0.08);
  return front(makeMesh(shape(g, (f) => (f.nz > 0.6 ? pick(r, [P.fx.spark[0], P.fx.spark[2]]) : P.fx.spark[1]), r, { jit: 0.01 }), { shadow: false }));
}

export const UI_SHAPES = { heart, fish: fishIcon, drop, bubbles, flame, bolt };
