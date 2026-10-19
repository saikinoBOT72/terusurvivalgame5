// 鉱床（objects.md「鉱床」、survival.md「鉱床」）: 地面に広がる平たい岩の板の群れに、鉱石の塊が埋まっている。
// 真ん中ほど大きな板、外ほど小さい板。板は少し傾けて深く埋める（上の面が 0.15m ほど出る）。kind: coal / copper / iron
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { shape, merge, makeMesh, pick } from '../style/lowpoly.js';

export const BED_R = 4.6; // 鉱床の半径（m）
const SLABS = 20, NUGGETS = 10, PEBBLES = 6;

// 角ばった平たい板（n 角、角ごとに半径を変える。上の面は少し小さくして面取り）。幅 w、奥行き d、厚さ h
function slab(rand, w, d, h) {
  const n = 5 + Math.floor(rand() * 3), g = new THREE.CylinderGeometry(0.9, 1, h, n, 1);
  const k = Array.from({ length: n }, () => 0.75 + rand() * 0.35), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { // 同じ角の頂点（上と下）は同じだけ動かす
    const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z);
    if (r < 1e-4) continue;
    const a = (Math.atan2(x, z) / (Math.PI * 2) + 1) % 1, j = Math.round(a * n) % n;
    p.setX(i, x * k[j] * w / 2); p.setZ(i, z * k[j] * d / 2);
  }
  return g;
}

export function oreBed(rand, kind) {
  const cols = P[kind], oreCol = () => (kind === 'copper' ? pick(rand, [cols[0], cols[1], cols[2]]) : pick(rand, cols));
  const parts = [], placed = [];
  // 円の中の候補点を真ん中から順に見て、真ん中ほど大きい板を、すき間を少しあけて敷き詰める
  const cand = Array.from({ length: 400 }, () => { const rr = BED_R * Math.sqrt(rand()) * 0.95, a = rand() * Math.PI * 2; return { x: Math.cos(a) * rr, z: Math.sin(a) * rr, rr }; }).sort((p, q) => p.rr - q.rr);
  for (const c of cand) {
    if (placed.length >= SLABS) break;
    const { x, z } = c, size = (4.2 - 2.9 * c.rr / BED_R) * (0.85 + rand() * 0.3);
    if (placed.some((o) => Math.hypot(o.x - x, o.z - z) < (o.s + size) * 0.34)) continue;
    const w = size, d = size * (0.55 + rand() * 0.35), h = 0.4;
    const g = slab(rand, w, d, h);
    g.rotateZ((rand() - 0.5) * 0.1).rotateX((rand() - 0.5) * 0.1).rotateY(rand() * Math.PI);
    const top = Math.min(0.14, 0.03 + size * 0.025); // 深くめり込ませる。大きい板ほど少し高く出る
    g.translate(x, top - h / 2, z);
    parts.push(shape(g, (f) => (f.ny > 0.6 ? pick(rand, [P.rockGray[1], P.rockGray[2], P.rockGray[2]]) : pick(rand, [P.rockGray[0], P.rockGray[1]])), rand, { jit: 0.025 }));
    placed.push({ x, z, s: size, top });
  }
  // 鉱石の塊: 1 枚おきの板の上の面にめり込ませる（真ん中から外まで散らばる）
  placed.filter((_, i) => i % 2 === 0).slice(0, NUGGETS).forEach((o) => {
    const s = 0.17 + rand() * 0.07, g = new THREE.OctahedronGeometry(s, 0);
    g.scale(1.3, 0.6, 1).rotateY(rand() * Math.PI);
    g.translate(o.x + (rand() - 0.5) * o.s * 0.3, o.top + s * 0.05, o.z + (rand() - 0.5) * o.s * 0.2);
    parts.push(shape(g, oreCol(), rand, { jit: s * 0.15 }));
  });
  // まわりの小石
  for (let k = 0; k < PEBBLES; k++) {
    const a = rand() * Math.PI * 2, rr = BED_R * (0.95 + rand() * 0.3), s = 0.08 + rand() * 0.08;
    const g = new THREE.TetrahedronGeometry(s, 0);
    g.rotateY(rand() * 3).translate(Math.cos(a) * rr, s * 0.3, Math.sin(a) * rr);
    parts.push(shape(g, pick(rand, [P.rockGray[1], P.rockGray[2], k % 2 ? oreCol() : P.rockGray[3]]), rand, {}));
  }
  return makeMesh(merge(parts));
}
