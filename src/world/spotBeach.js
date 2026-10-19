// 墜落島のスポットの物（浜と水辺）: コンテナ、漁船の残骸、ガラクタの山、粘土の露頭、貝、飛び石
// docs/rules/objects.md「墜落島のスポットの物」。前は +z、地面は y = 0。置き方（傾き・埋め方）は spots.js
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { pick, shape, merge } from '../style/lowpoly.js';

// 箱を、長い向き（x）にそって弓なりに曲げる（反った板）
function bentBox(w, h, d, bend, segs = 3) {
  const g = new THREE.BoxGeometry(w, h, d, segs, 1, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const u = p.getX(i) / w + 0.5; p.setY(i, p.getY(i) + Math.sin(u * Math.PI) * bend); }
  return g;
}

// コンテナ（中。2.4 × 1.2 × 1.2m）: 縦の波板 5 本ずつの側面、四隅の角金具、+x の両開きの扉と縦のロック棒 2 本ずつ
// kind: rust | blue | green。open: 片方の扉が開いて、中の暗がりが見える
export function container(r, kind = 'rust', open = false) {
  const C = P.container[kind], L = 2.4, H = 1.2, W = 1.2;
  const parts = [shape(new THREE.BoxGeometry(L, H, W).translate(0, H / 2, 0),
    (f) => (f.nx > 0.9 ? (open ? P.coal[1] : C[0]) : f.ny > 0.9 ? C[1] : C[0]), r)];
  for (const s of [-1, 1]) for (const x of [-0.84, -0.42, 0, 0.42, 0.84]) { // 波板
    parts.push(shape(new THREE.BoxGeometry(0.14, H - 0.2, 0.1).translate(x, H / 2, s * W / 2), C[1], r));
  }
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { // 角金具（少し外へ出す）
    parts.push(shape(new THREE.BoxGeometry(0.14, H + 0.04, 0.14).translate(x * (L / 2 - 0.04), H / 2, z * (W / 2 - 0.04)), P.rockGray[1], r));
  }
  for (const s of [-1, 1]) { // 扉 2 枚。s = 1 の扉は、外側のちょうつがい（z = +W/2）で開く
    const door = [shape(new THREE.BoxGeometry(0.1, H - 0.1, W / 2 - 0.04).translate(0, H / 2, s * W / 4), C[1], r)];
    for (const dz of [-0.13, 0.13]) {
      door.push(shape(new THREE.CylinderGeometry(0.05, 0.05, H - 0.16, 8).translate(0.09, H / 2, s * W / 4 + dz), P.catOrange[1], r));
    }
    const g = merge(door);
    if (open && s === 1) g.translate(0, 0, -W / 2).rotateY(-0.9).translate(0, 0, W / 2);
    g.translate(L / 2 + 0.05, 0, 0);
    parts.push(g);
  }
  return merge(parts);
}

// 漁船の残骸（大。長さ 6m）: 25 度横倒しで、船首を少し上げる。屋根の抜けた操舵室、船腹の穴と抜けた板、
// 水から斜めに出た折れたマストと帆げた、ちぎれた帆のきれ。舷側に色あせた白い帯
export function fishingBoat(r) {
  const L = 6, H = 1.3, B = 2.2;
  const g = new THREE.BoxGeometry(L, H, B, 10, 4, 2), p = g.attributes.position;
  const sheer = (x) => { const t = x / (L / 2); return H + 0.2 + t * t * 0.28 + Math.max(0, t - 0.5) * 0.3; }; // 舷のふちの高さ
  for (let i = 0; i < p.count; i++) {
    const t = p.getX(i) / (L / 2), top = p.getY(i) > 0; // t: -1 船尾 〜 1 船首
    let z = p.getZ(i), y = p.getY(i);
    if (t > 0.15) z *= 1 - ((t - 0.15) / 0.85) ** 1.7 * 0.97; // 船首へ細く
    if (t < -0.85) z *= 0.86; // 船尾の板
    if (!top && y < -0.2) z *= 0.38; // 船底は V 字
    if (y < -0.6 && Math.abs(t) < 0.9) y -= 0.12 * (1 - t * t); // 竜骨
    if (top) y += t * t * 0.28 + Math.max(0, t - 0.5) * 0.3; // 舷のそり、船首が高い
    p.setXYZ(i, p.getX(i), y, z);
  }
  g.translate(0, H / 2 + 0.2, 0);
  const hole = (f) => f.nz > 0.5 && f.x > -0.6 && f.x < 0.9 && f.y > 0.45 && f.y < 1.05;
  const parts = [shape(g, (f) => {
    if (hole(f)) return P.coal[1];
    if (f.ny > 0.8) return pick(r, [P.wood[2], P.wood[3]]); // 甲板
    if (f.y > sheer(f.x) - 0.3 && f.ny > -0.3) return P.paint[1]; // 舷のふちの白い帯
    return Math.floor(f.y / 0.25) % 2 ? P.wood[1] : P.wood[2]; // 板の段
  }, r, { jit: 0.04 })];
  for (const [x, a] of [[-0.55, 0.5], [0.85, -0.7]]) { // 穴のふちから抜けかけた板
    parts.push(shape(new THREE.BoxGeometry(0.9, 0.12, 0.1).rotateZ(a).rotateY(0.3).translate(x, 0.75, 1.0), P.wood[2], r, { jit: 0.02 }));
  }
  const cab = new THREE.BoxGeometry(1.3, 1.0, 1.5).translate(-1.6, H + 0.75, 0);
  parts.push(shape(cab, (f) => (f.ny > 0.9 ? P.coal[1] : pick(r, [P.paint[0], P.paint[1]])), r, { jit: 0.03 })); // 屋根がなく中が暗い
  parts.push(shape(new THREE.BoxGeometry(0.1, 0.4, 0.8).translate(-0.92, H + 0.95, 0), P.glass[0], r)); // 前の窓
  parts.push(shape(new THREE.BoxGeometry(1.6, 0.1, 0.32).rotateZ(-0.35).translate(-1.75, H + 1.15, 0.45), P.wood[1], r, { jit: 0.02 })); // 屋根の残りの板
  const mast = new THREE.CylinderGeometry(0.08, 0.11, 4.4, 8, 3), mp = mast.attributes.position;
  for (let i = 0; i < mp.count; i++) if (mp.getY(i) > 2.1) mp.setY(i, mp.getY(i) - r() * 0.35); // 折れた先はギザギザ
  mast.translate(0, 2.2 + H, 0).rotateZ(-0.2).translate(0.7, 0, 0);
  parts.push(shape(mast, () => pick(r, [P.wood[1], P.wood[2]]), r));
  parts.push(shape(new THREE.BoxGeometry(0.1, 0.1, 1.7).translate(0, 3.6 + H, 0).applyMatrix4(new THREE.Matrix4().makeRotationZ(-0.2)).translate(0.7, 0, 0), P.wood[1], r));
  const rag = new THREE.BufferGeometry().setFromPoints([ // ちぎれた帆のきれ（帆げたから垂れる三角）
    new THREE.Vector3(0, 0, -0.75), new THREE.Vector3(0, 0, 0.2), new THREE.Vector3(0.25, -1.2, -0.45),
    new THREE.Vector3(0.03, 0, -0.75), new THREE.Vector3(0.28, -1.2, -0.45), new THREE.Vector3(0.03, 0, 0.2),
  ]);
  rag.translate(0, 3.55 + H, 0).applyMatrix4(new THREE.Matrix4().makeRotationZ(-0.2)).translate(0.7, 0, 0);
  parts.push(shape(rag, P.canvas[1], r));
  const out = merge(parts);
  out.rotateZ(0.14).rotateX(-0.44); // 船首を上げ、+z の舷（穴のある側）を上に 25 度倒す
  return out;
}

// ガラクタの山（中。2.5m）: 金属片を押し固めた低い塚に、反った板・曲がった管・ひもの輪・樽の板・ボトルがのぞく
export function junkPile(r) {
  const mound = new THREE.IcosahedronGeometry(1.1, 1);
  mound.scale(1.15, 0.45, 0.95);
  const parts = [shape(mound, () => pick(r, [P.robotMetal[0], P.robotRust[0], P.robotRust[1], P.soil[1]]), r, { jit: 0.14 })];
  for (let k = 0; k < 5; k++) { // 反った板（半分は塚の中）
    const a = (k / 5) * Math.PI * 2 + r() * 0.6, d = 0.4 + r() * 0.4;
    const b = bentBox(0.75, 0.1, 0.42, 0.1, 2).rotateZ(0.4 + r() * 0.6).rotateY(a).translate(Math.cos(a) * d, 0.35, Math.sin(a) * d);
    parts.push(shape(b, k % 2 ? P.robotRust[2] : P.robotMetal[1], r, { jit: 0.03 }));
  }
  const pipe = new THREE.CylinderGeometry(0.08, 0.08, 1.0, 8).rotateZ(1.0).translate(-0.3, 0.55, 0.2);
  const elbow = new THREE.CylinderGeometry(0.08, 0.08, 0.45, 8).rotateZ(-0.4).translate(0.12, 0.98, 0.2);
  parts.push(shape(pipe, P.robotMetal[2], r), shape(elbow, P.robotRust[1], r));
  parts.push(shape(new THREE.TorusGeometry(0.2, 0.06, 4, 6).rotateX(1.1).translate(0.5, 0.42, 0.55), P.straw[1], r)); // ひもの輪
  for (const [x, z, a] of [[-0.75, 0.55, 1.3], [0.2, -0.65, 1.5]]) { // ボトル
    parts.push(shape(new THREE.CylinderGeometry(0.06, 0.07, 0.26, 6).rotateZ(a).rotateY(x * 3).translate(x, 0.3, z), (f) => (Math.abs(f.ny) > 0.9 ? P.water[3] : P.glass[1]), r));
  }
  for (const [x, z] of [[0.8, -0.2], [-0.55, -0.45]]) { // 割れた樽の板
    parts.push(shape(bentBox(0.18, 0.8, 0.1, 0.06, 1).rotateZ(Math.PI / 2).rotateY(x * 2).rotateX(0.5).translate(x, 0.55, z), P.wood[1], r, { jit: 0.02 }));
  }
  return merge(parts);
}

// 粘土の露頭（大。4m）: 斜面にのぞく 3 段の土の層。ふちは崩れ、上の段の上は草、下の段は濡れて暗い
export function clayBank(r) {
  const layers = [[4, 0.6, 2.6, 0], [3.3, 0.6, 2.1, 0.55], [2.5, 0.55, 1.6, 1.1]];
  return merge(layers.map(([w, h, d, y], k) => {
    const g = new THREE.BoxGeometry(w, h, d, 5, 2, 3).translate(0, y + h / 2, -k * 0.35);
    return shape(g, (f) => {
      if (f.ny > 0.7) return k === 2 ? pick(r, [P.grass[1], P.grass[2]]) : pick(r, [P.clay[1], P.soil[1]]);
      if (k === 0) return pick(r, [P.clay[0], P.clay[0], P.soil[0]]);
      return Math.floor(f.y / 0.2) % 2 ? P.clay[1] : P.clay[2];
    }, r, { jit: 0.16 });
  }));
}

// 貝（極小。0.12m）: 扇形の浅い二枚貝の片方。放射状の筋（面の折れ）と波打つふち。ちょうつがいは -z
export function shellGeo(r, cooked = false) {
  const R = 0.06, N = 8, pts = [], idx = [];
  const col = (k) => (cooked ? [P.wood[0], P.wood[1]][k % 2] : [P.shell[1], P.shell[2], P.shell[0]][k % 3]);
  pts.push(0, 0.01, -R * 0.55); // ちょうつがい
  for (let i = 0; i <= N; i++) { // 外のふち（波打つ）と、真ん中の山の線（筋ごとに高さを変える）
    const a = Math.PI * (0.12 + 0.76 * (i / N)), rr = R * (i % 2 ? 1 : 0.92);
    pts.push(Math.cos(a) * rr, 0, -R * 0.55 + Math.sin(a) * rr * 1.05);
    pts.push(Math.cos(a) * rr * 0.5, i % 2 ? 0.026 : 0.02, -R * 0.55 + Math.sin(a) * rr * 0.52);
  }
  for (let i = 0; i < N; i++) {
    const o = 1 + i * 2, m = o + 1, o2 = o + 2, m2 = o + 3;
    idx.push(0, m2, m, m, m2, o2, m, o2, o, 0, o, o2); // 上の 3 枚と、下（裏）の 1 枚
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.setIndex(idx);
  let k = 0;
  return shape(g, (f) => (f.ny < -0.5 ? P.shell[0] : col(k++)), r);
}

// 飛び石（中。0.8〜1.2m）: 平たいゆがんだ石。上の面だけ乾いて明るく、水につかる下は苔
export function steppingStone(r) {
  const g = new THREE.DodecahedronGeometry(0.5, 0);
  g.scale(1.05, 0.38, 0.85);
  return shape(g, (f) => (f.ny > 0.6 ? pick(r, [P.stone[3], P.stone[4]]) : f.y < -0.05 ? P.moss[0] : pick(r, [P.stone[1], P.stone[2]])), r, { jit: 0.09 });
}

// ガラクタ（中。0.9m。叩くと金属片）: 反った板 3 枚と短い管が寄りかかった小さな山
export function scrapBits(r) {
  const parts = [];
  for (let k = 0; k < 3; k++) {
    const a = k * 2.1 + r() * 0.5;
    parts.push(shape(bentBox(0.55, 0.1, 0.36, 0.08, 2).rotateZ(0.5 + r() * 0.5).rotateY(a).translate(Math.cos(a) * 0.18, 0.2, Math.sin(a) * 0.18),
      k === 1 ? P.robotRust[1] : pick(r, [P.robotMetal[0], P.robotMetal[1], P.robotRust[2]]), r, { jit: 0.02 }));
  }
  parts.push(shape(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8).rotateZ(1.2).rotateY(r() * 3).translate(0, 0.14, 0.05), P.robotFrame[1], r));
  return merge(parts);
}
