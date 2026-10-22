// ローポリの共通処理。すべての物はここを通して作る（docs/rules/style.md）。
import * as THREE from 'three';

// 決まった種から同じ乱数列を作る
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];

export function nonIndexed(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'color') g.deleteAttribute(name);
  }
  return g;
}

// 頂点を少しずらす。同じ位置の頂点は同じだけずらすので、すき間はできない。
export function jitter(geo, amount, rand) {
  const g = nonIndexed(geo);
  const pos = g.attributes.position;
  const seen = new Map();
  const k = (v) => Math.round(v * 1e4) + 0;
  for (let i = 0; i < pos.count; i++) {
    const key = `${k(pos.getX(i))},${k(pos.getY(i))},${k(pos.getZ(i))}`;
    let o = seen.get(key);
    if (!o) {
      o = [(rand() - 0.5) * amount, (rand() - 0.5) * amount, (rand() - 0.5) * amount];
      seen.set(key, o);
    }
    pos.setXYZ(i, pos.getX(i) + o[0], pos.getY(i) + o[1], pos.getZ(i) + o[2]);
  }
  return g;
}

// 面ごとに1色で塗る。明るさだけ ±vary の範囲で揺らす。
// color は色の文字列か、面の情報 {x,y,z,nx,ny,nz} を受け取って色を返す関数。
// pairs: 辺を共有する隣どうしの三角形（球の四角い面など）を同じ色にする。色の境目がギザギザにならない。
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const _n = new THREE.Vector3(), _col = new THREE.Color();
export function paint(geo, color, rand, vary = 0.04, pairs = false) {
  const g = nonIndexed(geo);
  const pos = g.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const fn = typeof color === 'function' ? color : () => color;
  let pairedPrev = false;
  for (let i = 0; i < pos.count; i += 3) {
    _a.fromBufferAttribute(pos, i);
    _b.fromBufferAttribute(pos, i + 1);
    _c.fromBufferAttribute(pos, i + 2);
    _n.subVectors(_c, _b).cross(_b.clone().sub(_a)).normalize().negate();
    const face = {
      x: (_a.x + _b.x + _c.x) / 3, y: (_a.y + _b.y + _c.y) / 3, z: (_a.z + _b.z + _c.z) / 3,
      nx: _n.x, ny: _n.y, nz: _n.z, i: i / 3, // i: 三角形の番号
    };
    if (pairs && i + 5 < pos.count && sharesEdge(pos, i, i + 3) && !pairedPrev) {
      _col.set(fn(face)); // 隣の三角形と同じ色（次の三角形はこの色を使う）
      pairedCol.copy(_col);
      pairedPrev = true;
    } else if (pairs && pairedPrev) {
      _col.copy(pairedCol);
      pairedPrev = false;
    } else {
      _col.set(fn(face));
      pairedPrev = false;
    }
    const s = 1 + (rand() * 2 - 1) * vary;
    for (let j = 0; j < 3; j++) {
      cols[(i + j) * 3] = _col.r * s;
      cols[(i + j) * 3 + 1] = _col.g * s;
      cols[(i + j) * 3 + 2] = _col.b * s;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return g;
}

const pairedCol = new THREE.Color();
// 三角形 i と j が辺（2つの頂点）を共有しているか
function sharesEdge(pos, i, j) {
  let n = 0;
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
    if (pos.getX(i + a) === pos.getX(j + b) && pos.getY(i + a) === pos.getY(j + b) && pos.getZ(i + a) === pos.getZ(j + b)) n++;
  }
  return n === 2;
}

// ゆがませて塗る、をまとめて行う
export function shape(geo, color, rand, { jit = 0, vary = 0.04, pairs = false } = {}) {
  let g = nonIndexed(geo);
  if (jit) g = jitter(g, jit, rand);
  return paint(g, color, rand, vary, pairs);
}

// 塗り終えた形を1つにまとめる
export function merge(geos) {
  let n = 0;
  for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, o);
    col.set(g.attributes.color.array, o);
    o += g.attributes.position.count * 3;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeVertexNormals();
  return out;
}

// 全部の物で共通の材質
export const MAT = {
  solid: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  double: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }),
};

// 光る物の材質（style.md「画面の効果」）: 照明を受けず、明るさ 1 を超えて光る。超えた所だけブルームでにじむ（game/postfx.js）
export const GLOW = 5; // 日なたの砂（1.16）より十分明るく、ブルームのしきい値（postfx.js の 1.7）を超える
// 光る物が描かれたフレームだけブルームを作る（postfx.js が毎フレーム false に戻し、描いた後に見る）
export const glowSeen = { v: false };
// 光る材質に印をつける。on(): いま光っているか（透明・数 0・大きさ 0 の物は数えない）
export function markGlow(m, on = () => m.opacity > 0.01) {
  m.onBeforeRender = (r, sc, cam, geo, obj) => { if (on() && obj.scale.x !== 0 && !(obj.isInstancedMesh && obj.count === 0)) glowSeen.v = true; };
  return m;
}
export function glowMat(opts = {}, k = GLOW) {
  const m = new THREE.MeshBasicMaterial(opts);
  m.color.multiplyScalar(k);
  return markGlow(m);
}

export function makeMesh(geo, { double = false, shadow = true } = {}) {
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, double ? MAT.double : MAT.solid);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}
