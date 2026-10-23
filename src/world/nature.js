// 木、岩、草、水、遠くの山（docs/rules/objects.md）
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { pick, shape, merge, makeMesh, MAT } from '../style/lowpoly.js';
import { addFog } from './fog.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// 円すいのすそ（一番下の輪）を 1 つおきに下げて外へ出し、枝先のギザギザにする。radial は偶数
function jagSkirt(g, radial, depth) {
  const p = g.attributes.position;
  let min = Infinity;
  for (let i = 0; i < p.count; i++) min = Math.min(min, p.getY(i));
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    if (Math.abs(p.getY(i) - min) > 1e-4 || Math.hypot(x, z) < 1e-4) continue;
    const k = Math.round(Math.atan2(z, x) / (Math.PI * 2 / radial));
    if (((k % 2) + 2) % 2) p.setXYZ(i, x * 1.08, min - depth, z * 1.08);
  }
  return g;
}

// 針葉樹: 八角形の幹に、すそがギザギザの円すいを3〜5段重ねる。たまに茶色の木を混ぜる。
export function conifer(rand, height = 3 + rand() * 2) {
  const brown = rand() < 0.22;
  const leaf = brown ? [P.dryGrass[0], P.dryGrass[1]] : [P.conifer[1], P.conifer[2], P.conifer[3]];
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.1, 0.15, height * 0.3, 8, 2);
  trunk.translate(0, height * 0.15, 0);
  parts.push(shape(trunk, P.wood[1], rand, { jit: 0.02 }));
  const n = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const r = height * (0.3 - t * 0.17), h = height * (0.5 - t * 0.12);
    const g = jagSkirt(new THREE.ConeGeometry(r, h, 10, 3), 10, h * 0.12);
    g.translate(0, height * (0.42 + t * 0.48), 0);
    parts.push(shape(g, () => pick(rand, leaf), rand, { jit: r * 0.12 }));
  }
  return makeMesh(merge(parts));
}

// 広葉樹: 幹が上で2本の枝に分かれ、ゆがんだ葉のかたまりを3〜5個のせる
export function broadleaf(rand, height = 2.8 + rand() * 1.4) {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.11, 0.16, height * 0.5, 8, 2);
  trunk.translate(0, height * 0.25, 0);
  parts.push(shape(trunk, P.wood[1], rand, { jit: 0.02 }));
  const a0 = rand() * Math.PI, tips = [];
  for (const s of [-1, 1]) { // 枝: 幹の上から斜めに
    const len = height * 0.34, a = a0 + (s > 0 ? 0 : Math.PI), lean = 0.75;
    const b = new THREE.CylinderGeometry(0.05, 0.08, len, 6);
    b.translate(0, len / 2, 0).rotateZ(-lean * s).rotateY(a0);
    b.translate(0, height * 0.46, 0);
    parts.push(shape(b, P.wood[1], rand, { jit: 0.015 }));
    tips.push([Math.cos(a) * Math.sin(lean) * len, height * 0.46 + Math.cos(lean) * len, -Math.sin(a) * Math.sin(lean) * len]);
  }
  const n = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const s = height * (0.21 - i * 0.015);
    const g = new THREE.IcosahedronGeometry(s, 1);
    g.scale(1, 0.85, 1);
    const [tx, ty, tz] = i < 2 ? tips[i] : [(rand() - 0.5) * s * 1.2, height * 0.74 + (rand() - 0.3) * s * 0.5, (rand() - 0.5) * s * 1.2];
    g.translate(tx, ty + s * 0.35, tz);
    parts.push(shape(g, () => pick(rand, [P.broadleaf[1], P.broadleaf[2], P.broadleaf[3]]), rand, { jit: s * 0.15 }));
  }
  return makeMesh(merge(parts));
}

// 切り株: 幹と同じ八角形で低い。上の切り口は明るい木の色（乗れる高さ）
export const STUMP_TOP = 0.3;
export function stump(rand) {
  const g = new THREE.CylinderGeometry(0.13, 0.15, STUMP_TOP + 0.05, 8);
  g.translate(0, (STUMP_TOP + 0.05) / 2, 0);
  return shape(g, (f) => (f.ny > 0.9 ? P.wood[3] : P.wood[1]), rand, { jit: 0.015 });
}

// 岩: 平たいゆがんだ多面体。大きいほど面を細かく（style.md の目安）。上は平らに削り、大きい岩には小さい岩を寄りそわせる
function rockGeo(rand, size) {
  const detail = size < 0.35 ? 0 : size < 0.8 ? 1 : 2;
  const g = new THREE.IcosahedronGeometry(size, detail);
  g.scale(1.2, 0.6, 1);
  const p = g.attributes.position, top = size * 0.6 * 0.6;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > top) p.setY(i, top + (p.getY(i) - top) * 0.25);
  g.translate(0, size * 0.25, 0);
  return shape(g, () => pick(rand, [P.rockGray[2], P.rockGray[3], P.rockGray[3]]), rand, { jit: size * [0.3, 0.22, 0.12][detail] });
}
export function rock(rand, size = 0.4 + rand() * 0.8) {
  const geos = [rockGeo(rand, size)];
  if (size > 0.9) geos.push(rockGeo(rand, size * 0.4).translate(size * 1.05, 0, size * 0.35));
  const m = makeMesh(geos.length > 1 ? merge(geos) : geos[0]);
  m.rotation.y = rand() * Math.PI * 2;
  return m;
}

// 草: 細い三角形の葉を数枚まとめた株
export function grassTuft(rand) {
  const pos = [];
  const n = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI, h = 0.18 + rand() * 0.22, w = 0.035;
    const ox = (rand() - 0.5) * 0.15, oz = (rand() - 0.5) * 0.15;
    const lean = (rand() - 0.5) * 0.15;
    const cx = Math.cos(a) * w, cz = Math.sin(a) * w;
    pos.push(ox - cx, 0, oz - cz, ox + cx, 0, oz + cz, ox + lean, h, oz + lean * 0.5);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const geo = shape(g, () => pick(rand, [P.grass[2], P.grass[3], P.grass[4]]), rand);
  return makeMesh(geo, { double: true, shadow: false });
}

// 海の水面: 少し透ける平らな面が、ゆっくり小さく波打つ。プレイヤーについて動く（PLAN.md「軽くする」）
// 近く（NEAR の 2 倍四方）は細かい格子で波打つ。その外の輪（かすみで見えなくなる所まで）は粗い格子で波なし。波は近くの格子のふちで 0 に絞るので、継ぎ目に隙間は出ない
// 格子は SNAP m ごとにずらすので、頂点はいつも世界の同じ位置にあり、波の模様は動かない（波は世界の位置で計算する）
const SEA = { near: 40, far: 136, cell: 8 / 3, ring: 8, snap: 8 }; // 近くの半分の幅、輪の外の半分の幅、近く・輪の 1 マス、ずらす刻み
function seaGeometry() {
  const n = Math.round((SEA.near * 2) / SEA.cell), parts = [new THREE.PlaneGeometry(SEA.near * 2, SEA.near * 2, n, n)];
  const k = (SEA.far * 2) / SEA.ring;
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
    const x = -SEA.far + (i + 0.5) * SEA.ring, y = -SEA.far + (j + 0.5) * SEA.ring;
    if (Math.abs(x) < SEA.near && Math.abs(y) < SEA.near) continue; // 近くの格子の所は穴
    parts.push(new THREE.PlaneGeometry(SEA.ring, SEA.ring).translate(x, y, 0));
  }
  return mergeGeometries(parts).rotateX(-Math.PI / 2);
}
export function water(level) {
  const g = seaGeometry().translate(0, level, 0);
  const mat = new THREE.MeshLambertMaterial({
    color: P.water[2], transparent: true, opacity: 0.78, flatShading: true,
  });
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  m.frustumCulled = false; // いつもまわりにある
  // 波は描くときに動かす（毎フレーム頂点を書き換えて送り直すと重い）。波の模様は世界の位置、ふちで絞るのは格子の中の位置で決める
  const uTime = { value: 0 };
  mat.onBeforeCompile = (s) => {
    addFog(s); // 霧の値（fog.js）
    s.uniforms.uTime = uTime;
    s.vertexShader = 'uniform float uTime;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec2 wp = transformed.xz + modelMatrix[3].xz;
      float edge = 1.0 - smoothstep(${(SEA.near - 8).toFixed(1)}, ${SEA.near.toFixed(1)}, max(abs(transformed.x), abs(transformed.z)));
      transformed.y += (sin(wp.x * 1.3 + uTime * 0.9) * 0.025 + cos(wp.y * 1.7 + uTime * 0.7) * 0.025) * edge;`);
  };
  // cam: 今の目の位置
  m.userData.update = (t, cam) => {
    uTime.value = t;
    if (cam) m.position.set(Math.round(cam.x / SEA.snap) * SEA.snap, 0, Math.round(cam.z / SEA.snap) * SEA.snap);
  };
  return m;
}

// 遠くの山: 大きな円すいをゆがませる。高い所は雪、低い所は茶と灰色。
export function mountain(rand, radius, height) {
  const g = new THREE.ConeGeometry(radius, height, 16, 8);
  g.translate(0, height / 2, 0);
  const geo = shape(g, (f) => {
    const t = f.y / height;
    if (t > 0.7) return pick(rand, [P.snow[1], P.snow[2]]);
    if (t > 0.35) return pick(rand, [P.rockGray[2], P.rockBrown[2], P.rockGray[3]]);
    return pick(rand, [P.rockBrown[1], P.grass[1], P.rockBrown[2]]);
  }, rand, { jit: radius * 0.15 });
  return makeMesh(geo, { shadow: false });
}

// 同じ形をまとめて描く（インスタンス描画）。items: [{x, y, z, rot, s, q?}]（q があれば傾き込みの向き）
// 島じゅうを 1 つにまとめると、画面や影の外の物まで毎回描くので、CELL m 四方の区画ごとに分ける（見えない区画は描かない）
// 返す物は InstancedMesh と同じ使い方ができる（setMatrixAt・getMatrixAt・instanceMatrix.needsUpdate・geometry）
const CELL = 48, MARGIN = 8; // MARGIN: 木が倒れる・揺れる分、区画の見える範囲を広げる
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const NO_FLAG = { set needsUpdate(v) {} }; // setMatrixAt で区画ごとに印をつけるので、まとめての印はいらない
class Chunked extends THREE.Group {
  constructor(geo, items, { double, shadow }) {
    super();
    this.isChunked = true;
    this.geometry = geo;
    this.instanceMatrix = NO_FLAG;
    const cells = new Map();
    this.where = items.map((it) => {
      const key = `${Math.floor(it.x / CELL)},${Math.floor(it.z / CELL)}`;
      if (!cells.has(key)) cells.set(key, []);
      const list = cells.get(key);
      list.push(it);
      return [list, list.length - 1];
    });
    const meshOf = new Map();
    for (const list of cells.values()) {
      const m = new THREE.InstancedMesh(geo, double ? MAT.double : MAT.solid, list.length);
      list.forEach((it, i) => {
        if (it.q) _q.copy(it.q); else _q.setFromAxisAngle(_up, it.rot);
        m.setMatrixAt(i, _m.compose(_p.set(it.x, it.y, it.z), _q, _s.setScalar(it.s)));
      });
      m.castShadow = shadow;
      m.receiveShadow = true;
      m.computeBoundingSphere();
      m.boundingSphere.radius += MARGIN;
      meshOf.set(list, m);
      this.add(m);
    }
    this.where = this.where.map(([list, i]) => [meshOf.get(list), i]);
  }
  setMatrixAt(k, mat) { const [m, i] = this.where[k]; m.setMatrixAt(i, mat); m.instanceMatrix.needsUpdate = true; } // まとめたあとは batch.js がつなぎ替えた先へ
  getMatrixAt(k, mat) { const [m, i] = this.where[k]; m.getMatrixAt(i, mat); }
}
export function instanced(geo, items, { double = false, shadow = true } = {}) {
  return new Chunked(geo, items, { double, shadow });
}

// 当たり判定の表示（H キー）: 物のまわりの輪。list: [{x, z, r, top}]
export function colliderRings(list) {
  const pos = [];
  for (const c of list) {
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * Math.PI * 2, a1 = ((i + 1) / 12) * Math.PI * 2;
      pos.push(c.x + Math.cos(a0) * c.r, c.top, c.z + Math.sin(a0) * c.r, c.x + Math.cos(a1) * c.r, c.top, c.z + Math.sin(a1) * c.r);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: P.ui.ng }));
  m.visible = false;
  return m;
}

// 鉱石の岩（objects.md「最初の島の物」）: 岩の上半分に、見てわかる色の塊を 6 つ半分埋める。kind: coal / copper / iron
// ふつうの岩より背が高く、でこぼこした大岩。鉱脈（3 方向）のまわりは岩の面も鉱石の色に染め、塊は深くめり込ませる
// small: 小さい鉱石の岩（ひざの高さ。上寄りの鉱脈 2 つに塊 2 つずつ、寄りそう岩なし）
export function oreRock(rand, kind, size = 0.9, small = false) {
  const cols = P[kind], oreCol = (i) => (kind === 'copper' ? (i % 2 ? cols[2] : cols[pick(rand, [0, 1])]) : pick(rand, cols));
  const n = small ? 2 : 3, a0 = rand() * Math.PI * 2;
  const veins = [...Array(n).keys()].map((i) => { // 鉱脈の向き（単位ベクトル）。小さい岩は上寄りに反対向きの 2 つ（どこから見ても見える）
    const a = a0 + (i / n + rand() * 0.1) * Math.PI * 2, el = small ? 0.5 + rand() * 0.35 : 0.1 + rand() * 0.6;
    return new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
  });
  const g = new THREE.IcosahedronGeometry(size, 1), p = g.attributes.position, v = new THREE.Vector3();
  const ph = rand() * 10;
  for (let i = 0; i < p.count; i++) { // でこぼこ: 向きで決める（同じ位置の頂点は同じだけ動く）
    v.fromBufferAttribute(p, i).normalize();
    const k = 1 + 0.16 * Math.sin(v.x * 5.1 + v.y * 3.7 + ph) * Math.cos(v.z * 4.3 - v.y * 2.1 + ph);
    p.setXYZ(i, v.x * size * k * 1.1, v.y * size * k * 0.85, v.z * size * k);
  }
  g.translate(0, size * 0.6, 0);
  const near = (f) => veins.some((d) => v.set(f.x, f.y - size * 0.6, f.z).normalize().dot(d) > 0.9);
  const parts = [shape(g, (f) => (near(f) ? oreCol(0) : pick(rand, [P.rockGray[2], P.rockGray[3], P.rockGray[3]])), rand, { jit: size * 0.06 })];
  if (!small) { // 寄りそう小さな岩
    const lump = new THREE.IcosahedronGeometry(size * 0.45, 0);
    lump.scale(1.2, 0.8, 1).translate(size * 0.95, size * 0.2, size * 0.3);
    parts.push(shape(lump, () => pick(rand, [P.rockGray[2], P.rockGray[3]]), rand, { jit: size * 0.08 }));
  }
  veins.forEach((d, j) => {
    for (let k = 0; k < (j === 0 && !small ? 3 : 2); k++) { // 鉱脈ごとに 2〜3 個。半分以上は岩の中
      const s = size * (small ? 0.28 : 0.2 + rand() * 0.1), c = d.clone().add(new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.35)).normalize();
      const o = new THREE.OctahedronGeometry(s, 0);
      o.scale(1, 0.8, 1).rotateY(rand() * Math.PI).rotateX(rand());
      o.translate(c.x * size * 1.1 * 0.93, size * 0.6 + c.y * size * 0.85 * 0.93, c.z * size * 0.93);
      parts.push(shape(o, oreCol(k + j), rand, { jit: s * 0.12 }));
    }
  });
  const m = makeMesh(merge(parts));
  m.rotation.y = rand() * Math.PI * 2;
  return m;
}

// 滝（islands.md）: 崖の面を落ちる水の帯（下ほど広がり、少し前へふくらむ）、上の口の岩、下のしぶき。h: 落ちる高さ、w: 幅。前は +z
export function waterfall(rand, h = 19, w = 3) {
  const g = new THREE.PlaneGeometry(w, h, 6, 16), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = (h / 2 - p.getY(i)) / h; // 0 = 上、1 = 下
    p.setX(i, p.getX(i) * (1 + t * 0.4));
    p.setZ(i, Math.sin(t * Math.PI * 0.8) * 0.8);
  }
  g.translate(0, h / 2, 0);
  const parts = [shape(g, () => pick(rand, [P.water[2], P.water[3], P.water[3], P.water[4]]), rand, { jit: 0.06 })];
  const lip = new THREE.IcosahedronGeometry(w * 0.45, 0);
  lip.scale(1.3, 0.35, 0.8).translate(0, h + 0.1, -0.3);
  parts.push(shape(lip, () => pick(rand, [P.rockBrown[1], P.rockBrown[2]]), rand, { jit: 0.1 }));
  for (const dx of [-w * 0.45, 0.1, w * 0.5]) { // しぶき
    const f = new THREE.IcosahedronGeometry(w * (0.3 + rand() * 0.1), 0);
    f.scale(1.2, 0.4, 1).translate(dx, 0.1, 0.9 + rand() * 0.4);
    parts.push(shape(f, () => pick(rand, [P.water[3], P.water[4]]), rand, { jit: 0.05 }));
  }
  return makeMesh(merge(parts), { double: true, shadow: false });
}
