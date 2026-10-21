// 生き物の共通部品（docs/rules/creatures.md「作り方」）。ロボットの parts.js は使わない。
// 低分割の球・円柱・円すいをゆがめて組む。形は原点まわりに作り、warp（ゆがめる）→ scale → rot → at の順で置く。
// 色は 3 段（暗い・中・明るい）の配列か、面の情報 → 色 の関数。上を向いた面は明るく、下は暗い。
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { shape, merge, makeMesh } from '../style/lowpoly.js';

export const byFace = (pal) => (f) => (f.ny > 0.55 ? pal[pal.length - 1] : f.ny < -0.55 ? pal[0] : pal[Math.min(1, pal.length - 1)]);

function put(geo, { warp, scale, rot = [0, 0, 0], at = [0, 0, 0] } = {}) {
  if (warp) {
    const p = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { warp(v.fromBufferAttribute(p, i)); p.setXYZ(i, v.x, v.y, v.z); }
  }
  if (scale) geo.scale(...scale);
  if (rot[0] || rot[1] || rot[2]) geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot)));
  return geo.translate(...at);
}

const paintAs = (geo, pal, rand, o = {}) =>
  shape(put(geo, o), typeof pal === 'function' ? pal : typeof pal === 'string' ? pal : byFace(pal), rand, { jit: o.jit ?? 0, vary: o.vary ?? 0.05, pairs: o.pairs ?? true });

// 塗った形を 1 つのメッシュに（動かない部分）。動く部品は at に原点（関節）を置いた Group
export const solid = (geos) => makeMesh(merge(geos));
export function limb(geos, at = [0, 0, 0]) {
  const g = new THREE.Group();
  g.add(solid(geos));
  g.position.set(...at);
  return g;
}

export const flesh = {
  // かたまり（胴、頭）: 直径 1 の球を [幅, 高さ, 長さ] にのばす。o.seg = [まわり, 縦]
  blob: (rand, size, pal, o = {}) => {
    const [a, b] = o.seg ?? [8, 5];
    return paintAs(new THREE.SphereGeometry(0.5, a, b), pal, rand, { ...o, scale: size });
  },
  // 柱（脚、鼻づら、しっぽ）: 上の太さ r、下の太さ rBottom、高さ h（y 向き）。o.seg 角の数、o.rings 縦の段
  tube: (rand, r, rBottom, h, pal, o = {}) =>
    paintAs(new THREE.CylinderGeometry(r, rBottom, h, o.seg ?? 6, o.rings ?? 1), pal, rand, o),
  // とがり（耳、牙、房）: 下の太さ r、高さ h（先が +y）
  cone: (rand, r, h, pal, o = {}) => paintAs(new THREE.ConeGeometry(r, h, o.seg ?? 5), pal, rand, o),
  loft,
  leaf,
};

// 耳（葉の形）: ロフトを上へ立て、前の面の真ん中をくぼませて内側を inner の色に。先は bend m だけ後ろへ反る
// rings はロフトと同じ（z が付け根からの長さ）。原点は付け根、くぼみは +z を向く
function leaf(rand, rings, outer, inner, { cup = 0.75, bend = 0.03, seg = 8 } = {}) {
  const len = rings[rings.length - 1].z;
  const halfW = (z) => { // その高さの幅の半分
    const i = Math.max(1, rings.findIndex((q) => q.z >= z)), a = rings[i - 1], b = rings[i];
    return (a.w + (b.w - a.w) * Math.min(1, (z - a.z) / (b.z - a.z || 1))) / 2;
  };
  return loft(rand, rings, (f) => (f.nz > 0.25 ? inner[f.ny > 0.2 ? 1 : 0] : byFace(outer)(f)), {
    seg, start: null, tip: 0.012, pairs: false, rot: [-Math.PI / 2, 0, 0],
    warp: (v) => {
      if (v.y < 0) v.y = -v.y * (cup - (cup + 0.2) * Math.min(1, Math.abs(v.x) / halfW(v.z))); // 前（-y）の真ん中を奥へ: くぼみ
      v.y += (v.z / len) ** 2 * bend; // 先が後ろへ反る
    },
  });
}

// ロフト（胴・頭・脚）: 輪切りの形を +z へ並べてつなぎ、ひと続きの面にする（creatures.md「ロフト」）。左右対称。
// ring: { z, x, y（輪の中心）, w（幅）, t（中心から上）, b（下。なければ t）, sq（2 で楕円、大きいほど角ばる）, c（この輪から次の輪までの色） }
// o.seg 輪の点の数（偶数）、o.jit ゆがみ（左右で同じ）、o.start / o.end 前後のふたの色（null なら閉じない）、o.tip ふたの中心を前後へ出す m
function loft(rand, rings, pal, o = {}) {
  const n = o.seg ?? 10, jit = o.jit ?? 0;
  const offs = new Map();
  const off = (ri, k) => { // 左右で同じゆがみ（x だけ向きを反対に）
    const m = Math.min(k, n - k), key = ri * 100 + m;
    if (!offs.has(key)) offs.set(key, [0, 1, 2].map(() => (rand() - 0.5) * jit));
    const [dx, dy, dz] = offs.get(key);
    return [k === 0 || k === n / 2 ? 0 : k > n / 2 ? -dx : dx, dy, dz];
  };
  const f = (v, sq) => Math.sign(v) * Math.abs(v) ** (2 / sq);
  const P = rings.map((r, ri) => Array.from({ length: n }, (_, k) => {
    const a = Math.PI / 2 - (2 * Math.PI * k) / n, c = Math.cos(a), s = Math.sin(a), sq = r.sq ?? 2;
    const [dx, dy, dz] = ri === 0 || ri === rings.length - 1 ? [0, 0, 0] : off(ri, k);
    return [(r.x ?? 0) + (r.w / 2) * f(c, sq) + dx, (r.y ?? 0) + (s >= 0 ? r.t : r.b ?? r.t) * f(s, sq) + dy, r.z + dz];
  }));
  const v = [], band = [];
  const tri = (a, b, c, col) => { v.push(...a, ...b, ...c); band.push(col); };
  for (let i = 0; i < rings.length - 1; i++) {
    const col = rings[i].c ?? pal;
    for (let k = 0; k < n; k++) {
      const A = P[i][k], B = P[i][(k + 1) % n], C = P[i + 1][(k + 1) % n], D = P[i + 1][k];
      tri(A, D, B, col); tri(B, D, C, col);
    }
  }
  const cap = (ri, col, dir) => {
    const r = rings[ri], c = [r.x ?? 0, r.y ?? 0, r.z + dir * (o.tip ?? 0)];
    for (let k = 0; k < n; k++) dir < 0 ? tri(c, P[ri][k], P[ri][(k + 1) % n], col) : tri(c, P[ri][(k + 1) % n], P[ri][k], col);
  };
  if (o.start !== null) cap(0, o.start ?? pal, -1);
  if (o.end !== null) cap(rings.length - 1, o.end ?? pal, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  const color = (face) => { const b = band[face.i]; return typeof b === 'function' ? b(face) : typeof b === 'string' ? b : byFace(b)(face); };
  return shape(put(g, o), color, rand, { vary: o.vary ?? 0.05, pairs: o.pairs ?? true });
}

// 目: 黒い丸い目と、小さな白い光の点（ロボットの赤い目と分ける）。close(0〜1) で細い線になる
export function roundEyes(rand, { at = [0, 0, 0], gap = 0.15, r = 0.035, out = 0.4 } = {}) {
  const group = new THREE.Group();
  group.position.set(...at);
  const eyes = [1, -1].map((s) => {
    const g = new THREE.Group();
    g.position.set(s * gap, 0, 0);
    g.rotation.y = s * out; // 顔の横を向く
    const ball = paintAs(new THREE.IcosahedronGeometry(1, 0), P.creatureEye, rand, { scale: [r, r, r * 0.6], vary: 0.02, pairs: false });
    const shine = paintAs(new THREE.OctahedronGeometry(1, 0), P.eyeShine, rand, { scale: [r * 0.3, r * 0.3, r * 0.2], at: [s * r * 0.15, r * 0.4, r * 0.55], vary: 0, pairs: false });
    g.add(makeMesh(merge([ball, shine]), { shadow: false }));
    group.add(g);
    return g;
  });
  return { group, eyes };
}
