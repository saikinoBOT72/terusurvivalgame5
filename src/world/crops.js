// 畑の形（docs/rules/objects.md「畑と作物」）: プランター、作物の 3 段（芽・育ち中・実り）、畑で採れる物の持ち物の形
// 作物は 1 つのプランターに 3 株（奥のうねに 2、手前に 1）。野生の作物は実りの 1 株を地面に直接（crop(kind, 2, 1)）
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { pick, shape, merge } from '../style/lowpoly.js';

export const SOIL_Y = 0.19; // プランターの土の面の高さ（囲いは 0.22m。2026-10-16 に低くした）

// プランター（建築・中）: 4 枚の板の囲い（継ぎ目で 2 段の板に見せる。角は板どうしを重ねる）、中に盛り上がった 2 列のうねのある土
export function planterGeo(r) {
  const wood = (f) => (Math.floor((f.y + 0.001) / 0.11) % 2 ? pick(r, [P.wood[2], P.wood[3]]) : pick(r, [P.wood[1], P.wood[2]]));
  const parts = [];
  for (const [w, d, x, z] of [[1, 0.08, 0, -0.46], [1, 0.08, 0, 0.46], [0.08, 0.84, -0.46, 0], [0.08, 0.84, 0.46, 0]]) {
    parts.push(shape(new THREE.BoxGeometry(w, 0.22, d, 1, 2, 1).translate(x, 0.11, z), wood, r, { jit: 0.004 }));
  }
  const soil = new THREE.BoxGeometry(0.86, 0.06, 0.86);
  soil.translate(0, SOIL_Y - 0.03, 0);
  parts.push(shape(soil, () => pick(r, [P.soil[0], P.soil[1]]), r, { jit: 0.012 }));
  for (const z of [-0.2, 0.2]) { // うね
    const g = new THREE.CylinderGeometry(0.09, 0.11, 0.8, 5, 2);
    g.rotateZ(Math.PI / 2).scale(1, 0.45, 1).translate(0, SOIL_Y, z);
    parts.push(shape(g, () => pick(r, [P.soil[1], P.soil[2]]), r, { jit: 0.01 }));
  }
  return merge(parts);
}

// 葉 1 枚: 先がとがった平たいひし形。向き a（y まわり）、立ち上がり tilt（芽の双葉）
function leaf(r, len, wid, a, tilt, x, y, z, cols) {
  const g = new THREE.OctahedronGeometry(0.5, 0);
  g.scale(len, 0.04, wid).translate(len / 2, 0, 0).rotateZ(tilt).rotateY(a).translate(x, y, z);
  return shape(g, () => pick(r, cols), r, { jit: len * 0.06 });
}
// 麻の葉: 細い葉 7 枚がてのひらのように広がる 1 枚の形（平ら。両面で描く）。L: 一番長い葉の長さ
function fanLeaf(r, L, a, tilt, x, y, z) {
  const sh = new THREE.Shape(), n = 7, spread = Math.PI * 1.25;
  for (let i = 0; i < n; i++) {
    const t = -spread / 2 + (spread * i) / (n - 1), len = L * (1 - Math.abs(i - 3) * 0.17); // 真ん中ほど長い
    const tip = [Math.sin(t) * len, Math.cos(t) * len], v = t + spread / (n - 1) / 2;
    if (i === 0) sh.moveTo(Math.sin(t - 0.2) * L * 0.12, Math.cos(t - 0.2) * L * 0.12);
    sh.lineTo(...tip);
    if (i < n - 1) sh.lineTo(Math.sin(v) * L * 0.34, Math.cos(v) * L * 0.34); // 葉と葉の間の切れこみ（浅いほど葉が太い）
  }
  sh.lineTo(0, -L * 0.08);
  const g = new THREE.ShapeGeometry(sh);
  g.rotateX(-Math.PI / 2 + tilt).rotateY(a).translate(x, y, z);
  return shape(g, () => pick(r, [P.grass[3], P.broadleaf[3]]), r);
}
const GREEN = [P.broadleaf[2], P.broadleaf[3]];

// 1 株（原点が根もと）。stage: 0 芽、1 育ち中、2 実り。大きい部品を少しにする（style.md の目安）
function plant(r, kind, stage) {
  const parts = [];
  if (stage === 0) { // 芽: 短い茎に双葉
    parts.push(shape(new THREE.CylinderGeometry(0.01, 0.014, 0.1, 4).translate(0, 0.05, 0), P.broadleaf[1], r));
    for (const a of [0, Math.PI]) parts.push(leaf(r, 0.09, 0.06, a + r() * 0.4, 0.5, 0, 0.095, 0, [P.broadleaf[3], P.grass[4]]));
    return merge(parts);
  }
  if (kind === 'potato') { // イモ: こんもりした葉のかたまり 2〜3 つ。実りは大きく、1 つは黄ばみ、根もとにイモがのぞく
    const blobs = stage === 1 ? [[0, 0.1, 0, 0.13], [0.09, 0.07, 0.05, 0.09]] : [[0, 0.18, 0, 0.19], [0.14, 0.11, 0.06, 0.13], [-0.12, 0.1, -0.08, 0.12]];
    blobs.forEach(([x, y, z, s], i) => {
      const g = new THREE.IcosahedronGeometry(s, 0).scale(1.25, 0.8, 1.15).translate(x, y, z);
      parts.push(shape(g, () => pick(r, stage === 2 && i === 2 ? [P.dryGrass[2], P.broadleaf[3]] : GREEN), r, { jit: s * 0.18 }));
    });
    if (stage === 2) parts.push(shape(new THREE.IcosahedronGeometry(0.06, 0).scale(1.3, 0.85, 1).translate(0.15, 0.015, -0.1), () => pick(r, P.potato), r, { jit: 0.008 }));
    return merge(parts);
  }
  // 麻: 細く背の高い茎 1 本に、てのひらの形の葉。実りは背が高く葉が 2 段、てっぺんに種の穂
  const H = stage === 1 ? 0.45 : 0.9;
  parts.push(shape(new THREE.CylinderGeometry(0.012, 0.018, H, 4).translate(0, H / 2, 0), P.conifer[1], r));
  const levels = stage === 1 ? [[0.9, 0.28, 0]] : [[0.5, 0.35, 0.6], [0.88, 0.28, 2.4]];
  for (const [lv, L, a] of levels) parts.push(fanLeaf(r, L, a + r() * 0.5, 0.35, 0, H * lv, 0));
  if (stage === 2) parts.push(shape(new THREE.ConeGeometry(0.045, 0.14, 4).translate(0, H + 0.06, 0), () => pick(r, [P.dryGrass[1], P.dryGrass[2]]), r));
  return merge(parts);
}

// 作物の形: プランターなら 4 株を 2 列（うねの上）、野生なら 1 株
export function crop(r, kind, stage, n = 3) {
  if (n === 1) return plant(r, kind, stage);
  return merge([[-0.2, -0.2], [0.22, -0.2], [0.02, 0.2]].map(([x, z]) => plant(r, kind, stage).rotateY(r() * 6).translate(x, SOIL_Y + 0.03, z)));
}

// 持ち物: 土（ごろっとした土くれ）、種イモ（小さなイモから緑の芽）、イモ、麻の種（小さな種の小山）
export const CROP_ITEM_SHAPES = {
  soil: (r) => merge([[0, 0, 0, 0.1], [0.07, -0.01, 0.04, 0.06], [-0.05, -0.015, 0.05, 0.05]].map(([x, y, z, s]) =>
    shape(new THREE.IcosahedronGeometry(s, 0).scale(1.2, 0.75, 1).translate(x, 0.07 + y, z), () => pick(r, [P.soil[1], P.soil[2]]), r, { jit: s * 0.15 }))),
  seedPotato: (r) => merge([
    shape(new THREE.IcosahedronGeometry(0.06, 0).scale(1.3, 0.9, 1).translate(0, 0.055, 0), () => pick(r, P.potato), r, { jit: 0.008 }),
    shape(new THREE.ConeGeometry(0.015, 0.05, 4).translate(0.03, 0.12, 0), P.broadleaf[3], r),
  ]),
  potato: (r) => shape(new THREE.IcosahedronGeometry(0.08, 1).scale(1.35, 0.85, 1).translate(0, 0.07, 0), () => pick(r, P.potato), r, { jit: 0.01 }),
  hempSeed: (r) => merge([[0, 0], [0.04, 0.02], [-0.03, 0.03], [0.01, -0.04], [-0.04, -0.02]].map(([x, z], i) =>
    shape(new THREE.OctahedronGeometry(0.022, 0).scale(1.3, 0.9, 1).translate(x, 0.02 + (i === 0 ? 0.02 : 0), z), () => pick(r, [P.dryGrass[0], P.dryGrass[1]]), r))),
};
