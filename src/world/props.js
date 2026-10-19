// 小物（docs/rules/objects.md）
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { pick, shape, merge, makeMesh } from '../style/lowpoly.js';

// 炎は光の影響を受けない材質（暗い所でも炎の色のまま見える）
const FIRE_MAT = new THREE.MeshBasicMaterial({ vertexColors: true });

// たき火の石の輪と薪（建築の家具でも使う）
export function campfireBase(rand) {
  const parts = [];
  for (let i = 0; i < 8; i++) { // 石を八角形に並べる
    const a = (i / 8) * Math.PI * 2, g = new THREE.IcosahedronGeometry(0.16, 0);
    g.scale(1.2, 0.75, 1);
    g.rotateY(-a);
    g.translate(Math.cos(a) * 0.36, 0.07, Math.sin(a) * 0.36); // 石どうしを重ねて、1つの物に見せる
    parts.push(shape(g, () => pick(rand, [P.rockGray[2], P.rockGray[3]]), rand, { jit: 0.04 }));
  }
  for (let i = 0; i < 3; i++) { // 薪を三角すいに組む（太さ 0.14m、ルールの最小 0.1m 以上）
    const g = new THREE.CylinderGeometry(0.065, 0.075, 0.62, 8);
    g.translate(0, 0.31, 0);
    g.rotateX(0.6);
    g.translate(0, 0, -0.2);
    g.rotateY((i / 3) * Math.PI * 2);
    parts.push(shape(g, (f) => (f.ny > 0.6 ? P.wood[3] : pick(rand, [P.wood[1], P.wood[2]])), rand, { jit: 0.01 }));
  }
  return merge(parts);
}

// たき火: 石の輪、組んだ薪、揺れる炎、まわりを照らす光。base: false なら炎と光だけ
export function campfire(rand, { base = true } = {}) {
  const root = new THREE.Group();
  if (base) root.add(makeMesh(campfireBase(rand)));

  // 炎: 外側にオレンジの炎を3つ、中央に背の高い黄色の炎
  const flames = [];
  const flame = (r, h, col, x, z) => {
    const g = new THREE.ConeGeometry(r, h, 5, 2);
    g.translate(0, h / 2, 0);
    const m = new THREE.Mesh(shape(g, col, rand, { jit: r * 0.35, vary: 0.03 }), FIRE_MAT);
    m.position.set(x, 0.08, z);
    m.userData.phase = rand() * 10;
    root.add(m);
    flames.push(m);
  };
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    flame(0.16, 0.6, i % 2 ? P.fire[0] : P.fire[1], Math.cos(a) * 0.08, Math.sin(a) * 0.08);
  }
  flame(0.1, 0.82, P.fire[2], 0, 0);

  const light = new THREE.PointLight(P.fire[1], 3, 8, 2);
  light.position.y = 0.6;
  light.layers.enable(1); // 1人称の腕の層も照らす
  root.add(light);

  function update(t) {
    for (const m of flames) {
      const p = m.userData.phase;
      m.scale.set(1 + Math.sin(t * 9 + p) * 0.08, 1 + Math.sin(t * 13 + p) * 0.15 + Math.sin(t * 5.3 + p) * 0.08, 1 + Math.cos(t * 8 + p) * 0.08);
      m.rotation.y = t * 0.8 + p;
    }
    light.intensity = 3 + Math.sin(t * 11) * 0.4 + Math.sin(t * 17.3) * 0.3;
  }
  return { root, update, radius: 0.5, height: 0.3 }; // 当たり判定: 低いので上に乗れる
}

// ---- 見本（モデル確認島。docs/rules/objects.md）----

// キノコ: 白っぽい柄に平たい傘。2 本寄せる
export function mushrooms(rand) {
  const parts = [];
  for (let i = 0; i < 2; i++) {
    const h = 0.1 + rand() * 0.08, r = h * 0.5, x = i * 0.07 - 0.03, z = (rand() - 0.5) * 0.06;
    const stem = new THREE.CylinderGeometry(r * 0.25, r * 0.32, h, 5, 1, true).translate(x, h / 2, z);
    const cap = new THREE.ConeGeometry(r, r * 0.6, 8, 1).translate(x, h + r * 0.15, z);
    parts.push(shape(stem, P.straw[2], rand), shape(cap, () => pick(rand, [P.autumn[1], P.autumn[2]]), rand, { jit: r * 0.08 }));
  }
  return merge(parts);
}

// 樽: 八角形で真ん中がふくらむ。上下に石の色の輪
export function barrel(rand) {
  const H = 0.8, R = 0.28, bulge = (y) => R * (1 + 0.13 * (1 - (2 * y / H) ** 2));
  const body = new THREE.CylinderGeometry(R, R, H, 8, 4);
  const p = body.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = bulge(p.getY(i)) / R;
    p.setXYZ(i, p.getX(i) * k, p.getY(i), p.getZ(i) * k);
  }
  const parts = [shape(body.translate(0, H / 2, 0), (f) => (f.ny > 0.9 ? P.wood[3] : pick(rand, [P.wood[1], P.wood[2]])), rand)];
  for (const y of [-0.24, 0.24]) {
    const r = bulge(y) * 1.03;
    parts.push(shape(new THREE.CylinderGeometry(r, r, 0.06, 8, 1, true).translate(0, H / 2 + y, 0), P.stone[1], rand, { vary: 0.02 }));
  }
  return merge(parts);
}

// 小さな船: 平らな甲板の舟形。前（+x）はとがって少し上がり、後ろは平たく切る。底は細い。ふちに低い板、腰かけ板 1 枚
export function boat(rand) {
  const L = 3.5, W = 1.5, D = 0.55;
  const half = (x) => { const u = 2 * x / L; return (W / 2) * (u > 0 ? Math.max(0.02, 1 - u * u) ** 0.6 : 1 - 0.3 * u ** 4); }; // 位置 x での幅の半分
  const sheer = (x) => 0.2 * Math.max(0, 2 * x / L) ** 2; // 前が上がる
  const hull = new THREE.BoxGeometry(L, D, W, 10, 2, 3);
  const p = hull.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), u = 2 * x / L, low = (D / 2 - y) / D; // low: 0 = 甲板、1 = 底
    p.setXYZ(i, x, y + sheer(x) + low * 0.15 * u * u, p.getZ(i) / (W / 2) * half(x) * (1 - low * 0.4));
  }
  hull.translate(0, D / 2, 0);
  const parts = [shape(hull, (f) => (f.ny > 0.9 ? P.wood[3] : pick(rand, [P.wood[1], P.wood[2]])), rand, { jit: 0.01 })];
  for (const s of [-1, 1]) { // ふちの板: 舟の形に沿って曲げる
    const b = new THREE.BoxGeometry(L * 0.92, 0.2, 0.06, 8, 1, 1);
    const q = b.attributes.position;
    for (let i = 0; i < q.count; i++) { const x = q.getX(i); q.setXYZ(i, x, q.getY(i) + sheer(x), s * (half(x) - 0.03) + q.getZ(i)); }
    parts.push(shape(b.translate(-L * 0.02, D + 0.1, 0), P.wood[2], rand));
  }
  parts.push(shape(new THREE.BoxGeometry(0.28, 0.05, 2 * half(-0.4) - 0.08).translate(-0.4, D + 0.17, 0), P.wood[3], rand));
  return merge(parts);
}
