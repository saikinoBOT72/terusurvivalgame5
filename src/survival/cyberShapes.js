// サイバーガンシリーズ（docs/rules/weapons.md「サイバーガンシリーズ」）: 角を面取りした箱と、銃ごとに 1 色のネオンの線
// 面取りの細い面だけ明るい灰色にして、絵の縁取りを表す（輪郭線は使わない）。ネオンは照明を受けない材質。まわりのもやはなし
// 向きと原点は akShapes.js と同じ（前が +z、上が +y、左の面が +x、右は -x）
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { rng, paint, merge, makeMesh, glowMat } from '../style/lowpoly.js';

const C = P.cyber;
export const NEON_MAT = glowMat({ vertexColors: true });

// 角を面取りした箱（三角形 44）: 6 つの面を c だけ内へ縮め、12 の辺を斜めの帯、8 つの角を三角でつなぐ
function chamferGeo(w, h, d, c) {
  const half = [w / 2, h / 2, d / 2];
  // 面（軸 a・向き sa）の上の点。ほかの 2 軸は向き sg（[x, y, z] の符号。a の分は使わない）の角
  const pt = (a, sa, sg) => [0, 1, 2].map((k) => (k === a ? sa * half[k] : sg[k] * (half[k] - c)));
  const v = [];
  const tri = (A, B, Cc) => {
    const ab = A.map((q, i) => B[i] - q), ac = A.map((q, i) => Cc[i] - q);
    const n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const m = [0, 1, 2].map((i) => A[i] + B[i] + Cc[i]);
    if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < 0) [B, Cc] = [Cc, B]; // 箱は真ん中が原点の凸形なので、外を向くように
    v.push(...A, ...B, ...Cc);
  };
  const quad = (A, B, Cc, D) => { tri(A, B, Cc); tri(A, Cc, D); };
  const S = [1, -1];
  for (let a = 0; a < 3; a++) for (const sa of S) { // 面
    const [u, w2] = [0, 1, 2].filter((k) => k !== a), g = (su, sw) => { const s = [0, 0, 0]; s[u] = su; s[w2] = sw; return pt(a, sa, s); };
    quad(g(1, 1), g(1, -1), g(-1, -1), g(-1, 1));
  }
  for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) for (const sa of S) for (const sb of S) { // 辺
    const k = 3 - a - b, s = (sk) => { const q = [0, 0, 0]; q[a] = sa; q[b] = sb; q[k] = sk; return q; };
    quad(pt(a, sa, s(1)), pt(a, sa, s(-1)), pt(b, sb, s(-1)), pt(b, sb, s(1)));
  }
  for (const sx of S) for (const sy of S) for (const sz of S) tri(pt(0, sx, [sx, sy, sz]), pt(1, sy, [sx, sy, sz]), pt(2, sz, [sx, sy, sz])); // 角
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  return geo;
}

// 面の向きで塗る: まっすぐな面は本体の色（上・横・下）、斜めの面（面取り）はふちの灰色
const byChamfer = (pal) => (f) => {
  if (Math.max(Math.abs(f.nx), Math.abs(f.ny), Math.abs(f.nz)) < 0.97) return f.ny > 0.3 ? C.edge[1] : C.edge[0];
  return f.ny > 0.9 ? pal[2] : f.ny < -0.9 ? pal[0] : pal[1];
};
const place = (geo, rot, at) => geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot))).translate(...at);

// 面取りした箱: 塗ってから回して置く（塗り分けは回す前の向きで決める）
function cbox(r, [w, h, d], pal, at, rot = [0, 0, 0], c = Math.min(0.004, Math.min(w, h, d) * 0.22)) {
  return place(paint(chamferGeo(w, h, d, c), byChamfer(pal), r, 0.03), rot, at);
}
// ネオンの板: 色 1 つ、揺らぎなし。箱の中の位置 local（箱の真ん中から）を、箱と同じ回し方で置く
function neon(r, size, color, at, rot = [0, 0, 0], local = [0, 0, 0]) {
  const p = new THREE.Vector3(...local).applyEuler(new THREE.Euler(...rot)).add(new THREE.Vector3(...at));
  return place(paint(new THREE.BoxGeometry(...size), color, r, 0), rot, p.toArray());
}

// サイバー版 AK47（ネオンは rose）。寸法は akShapes.js と同じ（全長 約 0.89m）
const AK = { muzzle: [0, 0.038, 0.578], eject: [-0.018, 0.03, 0.132] };
const PIVOT = { carrier: [0, 0.03, 0.13], mag: [0, 0, 0.132], trigger: [0, 0, 0.04] };
const MAG_ROT = [[-0.12, 0, 0], [-0.42, 0, 0]], MAG_AT = [[0, -0.045, 0.01], [0, -0.128, 0.034]]; // 弾倉: 上の箱と、前へ曲がった下の箱

function akBody(r, glow) {
  const B = C.black, G = C.gray, out = [], n = [];
  // 機関部（黒い大きな箱）・上のふた・後ろのふた・排莢口のまわりの板・上の突起
  out.push(cbox(r, [0.034, 0.048, 0.29], B, [0, 0.02, 0.059]));
  out.push(cbox(r, [0.026, 0.011, 0.22], G, [0, 0.0495, 0.04]));
  out.push(cbox(r, [0.03, 0.04, 0.012], G, [0, 0.022, -0.088]));
  out.push(cbox(r, [0.004, 0.016, 0.06], G, [-0.0175, 0.03, 0.124]));
  for (const z of [-0.03, 0.03, 0.09]) out.push(cbox(r, [0.012, 0.006, 0.014], G, [0, 0.058, z], [0, 0, 0], 0.0015));
  // 後ろの照準の台と照門
  out.push(cbox(r, [0.022, 0.014, 0.055], G, [0, 0.051, 0.178]));
  out.push(cbox(r, [0.012, 0.01, 0.01], G, [0, 0.062, 0.162], [0, 0, 0], 0.002));
  // ハンドガード（灰色の箱）・ガスの筒・銃身・ガスの台・前の照準・銃口の箱・下の棒
  out.push(cbox(r, [0.036, 0.042, 0.176], G, [0, 0.025, 0.292]));
  out.push(cbox(r, [0.018, 0.012, 0.24], G, [0, 0.052, 0.325]));
  out.push(cbox(r, [0.014, 0.014, 0.17], G, [0, 0.038, 0.464]));
  out.push(cbox(r, [0.022, 0.034, 0.038], G, [0, 0.045, 0.451]));
  out.push(cbox(r, [0.012, 0.03, 0.022], G, [0, 0.06, 0.512], [0, 0, 0], 0.002));
  out.push(cbox(r, [0.026, 0.026, 0.04], G, [0, 0.038, 0.555]));
  out.push(cbox(r, [0.006, 0.006, 0.14], G, [0, 0.024, 0.46], [0, 0, 0], 0.0015));
  // 銃床: 2 本の棒（下の棒は斜め）で後ろの箱をつなぐ。後ろの面に黒い当て板
  out.push(cbox(r, [0.02, 0.018, 0.118], G, [0, 0.012, -0.143], [-0.17, 0, 0]));
  out.push(cbox(r, [0.016, 0.014, 0.135], G, [0, -0.03, -0.138], [-0.39, 0, 0]));
  out.push(cbox(r, [0.036, 0.112, 0.13], G, [0, -0.035, -0.265]));
  out.push(cbox(r, [0.039, 0.116, 0.008], B, [0, -0.035, -0.333]));
  // 握り（黒、後ろへ傾く）・用心金
  out.push(cbox(r, [0.026, 0.1, 0.03], B, [0, -0.05, -0.012], [0.3, 0, 0]));
  out.push(cbox(r, [0.008, 0.006, 0.074], G, [0, -0.027, 0.045], [0, 0, 0], 0.0015));
  out.push(cbox(r, [0.008, 0.028, 0.007], G, [0, -0.016, 0.079], [0, 0, 0], 0.0015));
  // ネオン: 機関部の横の長い線、ハンドガードの横の線（左右）、銃口の前の四角
  for (const s of [1, -1]) {
    n.push(neon(r, [0.001, 0.004, 0.14], glow, [s * 0.0176, 0.026, 0.075]));
    n.push(neon(r, [0.001, 0.004, 0.13], glow, [s * 0.0186, 0.027, 0.29]));
  }
  n.push(neon(r, [0.012, 0.012, 0.001], glow, [0, 0.038, 0.5756]));
  return { solid: out, glow: n };
}

function akMag(r, glow) {
  const out = MAG_AT.map((at, i) => cbox(r, i ? [0.026, 0.085, 0.06] : [0.026, 0.09, 0.056], C.black, at, MAG_ROT[i]));
  out.push(cbox(r, [0.03, 0.016, 0.066], C.gray, [0, -0.09, 0.022], [-0.27, 0, 0], 0.003)); // 2 つの箱のつなぎ目の帯（曲がりのすき間を隠す）
  const n = [1, -1].map((s) => neon(r, [0.001, 0.03, 0.018], glow, MAG_AT[1], MAG_ROT[1], [s * 0.0136, 0, 0])); // 横の四角い窓
  return { solid: out, glow: n };
}

// 動く部品を別にした形（akRig と同じ分け方）。userData: carrier・mag・trigger・muzzle・eject
export function cyberAkRig(color = 'rose', seed = 47) {
  const r = rng(seed), glow = C.neon[color], root = new THREE.Group();
  const add = ({ solid, glow: g = [] }, at = [0, 0, 0]) => {
    const part = new THREE.Group();
    part.position.set(...at);
    part.add(makeMesh(merge(solid)));
    if (g.length) part.add(new THREE.Mesh(merge(g), NEON_MAT));
    root.add(part);
    return part;
  };
  add(akBody(r, glow));
  root.userData.carrier = add({ solid: [cbox(r, [0.017, 0.008, 0.012], C.gray, [-0.0255, 0, 0], [0, 0, 0], 0.002)] }, PIVOT.carrier);
  root.userData.mag = add(akMag(r, glow), PIVOT.mag);
  root.userData.trigger = add({ solid: [cbox(r, [0.005, 0.018, 0.006], C.gray, [0, -0.009, 0], [0.25, 0, 0], 0.0012)] }, PIVOT.trigger);
  for (const [k, at] of [['muzzle', AK.muzzle], ['eject', AK.eject]]) {
    root.userData[k] = new THREE.Object3D();
    root.userData[k].position.set(...at);
    root.add(root.userData[k]);
  }
  return root;
}
