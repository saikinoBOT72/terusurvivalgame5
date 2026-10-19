// 序盤の自然物: 倒木、鳥の巣、竹やぶ、ヤシの木、苗木（docs/rules/objects.md「序盤の自然物と素材の形」）
// 採ると消えて戻る部分（キノコ、卵、ヤシの実）は別のジオメトリで返す
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { pick, shape, merge } from '../style/lowpoly.js';
import { mushrooms } from './props.js';

// 卵の形: 細かい多面体を縦にのばし、上を少し細くする（真ん中が原点）
export function eggGeo(rad) {
  const g = new THREE.IcosahedronGeometry(rad, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 1 - 0.16 * (p.getY(i) / rad);
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * 1.3, p.getZ(i) * k);
  }
  return g;
}

// 倒木: 寝かせた八角形の丸太（長い向きが x）、折れ枝 2 本。上のキノコは別（{ log, caps }）
export function fallenLog(rand) {
  const L = 2.5, R = 0.175;
  const g = new THREE.CylinderGeometry(R, R * 1.1, L, 8, 3);
  g.rotateZ(Math.PI / 2).translate(0, R * 0.9, 0);
  const parts = [shape(g, (f) => (Math.abs(f.nx) > 0.9 ? P.wood[4] : pick(rand, [P.wood[1], P.wood[2]])), rand, { jit: 0.03 })];
  for (const [x, a] of [[-0.5, 0.7], [0.6, -0.9]]) {
    const b = new THREE.CylinderGeometry(0.05, 0.07, 0.35, 6);
    b.translate(0, 0.17, 0).rotateZ(a).rotateX(0.5).translate(x, R * 1.5, 0.05);
    parts.push(shape(b, P.wood[1], rand, { jit: 0.01 }));
  }
  const caps = [-0.2, 0.9].map((x) => mushrooms(rand).translate(x, R * 1.7, -0.02));
  return { log: merge(parts), caps: merge(caps) };
}

// 鳥の巣: 枝を編んだ浅いお椀（ろくろで外と内の壁を作る）。卵 2 個は別（{ nest, eggs }）
export function birdNest(rand) {
  const prof = [[0.02, 0], [0.16, 0.02], [0.21, 0.1], [0.2, 0.14], [0.15, 0.1], [0.08, 0.07], [0, 0.07]].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(prof, 7);
  const nest = shape(g, () => pick(rand, [P.wood[3], P.straw[0], P.straw[1]]), rand, { jit: 0.015 });
  const eggs = merge([[-0.04, 0.02], [0.05, -0.02]].map(([x, z]) => {
    const e = eggGeo(0.05).rotateZ(0.5).translate(x, 0.11, z);
    return shape(e, () => pick(rand, [P.catWhite[1], P.catWhite[2]]), rand, { jit: 0.004 });
  }));
  return { nest, eggs };
}

// 竹やぶ: 六角形の竹を 5 本、少しずつ傾けて寄せる。節は頂点を少し太らせて作る（部品を増やさない）。上に葉の束
export function bambooGrove(rand) {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const h = 3 + rand() * 1.5, a = (i / 5) * Math.PI * 2 + rand() * 0.5, d = 0.25 + rand() * 0.35;
    const g = new THREE.CylinderGeometry(0.05, 0.055, h, 6, 6);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const t = (p.getY(k) + h / 2) / h;
      if (t > 0.01 && t < 0.99 && Math.round(t * 6) === t * 6) { p.setX(k, p.getX(k) * 1.25); p.setZ(k, p.getZ(k) * 1.25); }
    }
    // 上に垂れた細い葉を 3 枚。葉の付け根を竹のてっぺんの点にそろえて、1 本の竹で 1 つの部品にする
    const tuft = [0, 1, 2].map((k) => droopLeaf(0.7 + rand() * 0.3, 0.09, 0.5, 2).rotateZ(0.6).rotateY((k / 3) * Math.PI * 2 + rand()).translate(0, h, 0));
    const lean = 0.06 + rand() * 0.08;
    const place = (x) => x.rotateZ(lean * Math.cos(a)).rotateX(lean * Math.sin(a)).translate(Math.cos(a) * d, 0, Math.sin(a) * d);
    g.translate(0, h / 2, 0);
    parts.push(shape(place(g), () => pick(rand, [P.bamboo[1], P.bamboo[2]]), rand));
    for (const l of tuft) parts.push(shape(place(l), () => pick(rand, [P.bamboo[0], P.broadleaf[2]]), rand));
  }
  return merge(parts);
}

// 垂れた細長い葉: 付け根から先へ、真ん中で少し折れた帯（V 字）。先ほど下がる。下から見ても見えるよう、裏の面も作る
function droopLeaf(len, width, droop, segs = 4) {
  const mid = (t) => [t * len, -droop * t * t + 0.25 * t * (1 - t), 0];
  const edge = (t, side) => {
    const [x, y] = mid(t), w = width * Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.1)) * side;
    return [x, y - Math.abs(w) * 0.25, w];
  };
  const pos = [];
  const tri = (a, b, c) => pos.push(...a, ...b, ...c, ...a, ...c, ...b); // 表と裏
  for (let s = 0; s < segs; s++) {
    const t0 = s / segs, t1 = (s + 1) / segs;
    for (const side of [-1, 1]) {
      tri(mid(t0), edge(t0, side), edge(t1, side));
      tri(mid(t0), edge(t1, side), mid(t1));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

// ヤシの木: 少し曲がった八角形の幹（上ほど細い）、垂れた葉 7 枚。実は別（{ tree, nuts }）
export function palmTree(rand, height = 5 + rand() * 1) {
  const bend = 0.6 + rand() * 0.4;
  const g = new THREE.CylinderGeometry(0.12, 0.2, height, 8, 8);
  const p = g.attributes.position;
  for (let k = 0; k < p.count; k++) {
    const t = (p.getY(k) + height / 2) / height;
    p.setX(k, p.getX(k) + bend * t * t);
  }
  g.translate(0, height / 2, 0);
  const trunk = shape(g, (f) => (Math.round(f.y * 2.5) % 2 ? P.wood[1] : P.wood[2]), rand, { jit: 0.015 });
  const parts = [trunk];
  const top = new THREE.Vector3(bend, height, 0);
  for (let i = 0; i < 7; i++) {
    const leaf = droopLeaf(1.8 + rand() * 0.5, 0.28, 1.1 + rand() * 0.4);
    leaf.rotateZ(0.35).rotateY((i / 7) * Math.PI * 2 + rand() * 0.3).translate(top.x, top.y, top.z);
    parts.push(shape(leaf, () => pick(rand, [P.broadleaf[1], P.broadleaf[2], P.broadleaf[3]]), rand));
  }
  const nuts = merge([0, 1, 2].map((i) => {
    const n = new THREE.IcosahedronGeometry(0.16, 0);
    const a = (i / 3) * Math.PI * 2 + 0.4;
    n.translate(top.x + Math.cos(a) * 0.2, top.y - 0.22, top.z + Math.sin(a) * 0.2);
    return shape(n, () => pick(rand, [P.wood[0], P.wood[1]]), rand, { jit: 0.015 });
  }));
  return { tree: merge(parts), nuts };
}

// 苗木: stage 0 = 苗木（0.4m、細い茎と葉 3 枚）、1 = 若木（1.5m、細い幹と葉のかたまり）。2 は今の木を使う
export function sapling(rand, stage = 0) {
  const leafCol = () => pick(rand, [P.broadleaf[2], P.broadleaf[3]]);
  if (stage === 0) {
    const stem = new THREE.CylinderGeometry(0.015, 0.025, 0.32, 5);
    stem.translate(0, 0.16, 0);
    const parts = [shape(stem, P.wood[2], rand)];
    for (let i = 0; i < 3; i++) {
      const l = new THREE.OctahedronGeometry(0.09, 0);
      l.scale(1.6, 0.25, 0.8).translate(0.11, 0, 0).rotateZ(0.4).rotateY((i / 3) * Math.PI * 2).translate(0, 0.2 + i * 0.06, 0);
      parts.push(shape(l, leafCol, rand));
    }
    return merge(parts);
  }
  const trunk = new THREE.CylinderGeometry(0.04, 0.06, 1.0, 6);
  trunk.translate(0, 0.5, 0);
  const crown = new THREE.IcosahedronGeometry(0.38, 0);
  crown.scale(1, 0.9, 1).translate(0, 1.15, 0);
  return merge([shape(trunk, P.wood[1], rand, { jit: 0.01 }), shape(crown, leafCol, rand, { jit: 0.06 })]);
}
