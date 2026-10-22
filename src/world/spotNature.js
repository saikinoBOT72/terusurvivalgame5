// 墜落島のスポットの物（自然）: 立ち枯れの木、石垣、一本木、苔の巨岩、泉、光るキノコ
// docs/rules/objects.md「墜落島のスポットの物」。前は +z、地面は y = 0
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { pick, shape, merge, glowMat } from '../style/lowpoly.js';

// 光るキノコの光る面（光の影響を受けない。炎と同じ例外。objects.md「火と光る物」）
export const GLOW_MAT = glowMat({ vertexColors: true, side: THREE.DoubleSide });

// 枝: base から向き dir へ長さ len の先細りの八角柱。broken: 先を折る（ギザギザ）
function limb(r, base, dir, len, r0, r1, col, broken = true, segs = 3) {
  const g = new THREE.CylinderGeometry(r1, r0, len, 8, segs), p = g.attributes.position;
  if (broken) for (let i = 0; i < p.count; i++) if (p.getY(i) > len / 2 - 0.01) p.setY(i, p.getY(i) - r() * len * 0.12);
  g.translate(0, len / 2, 0);
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())));
  g.translate(base.x, base.y, base.z);
  return shape(g, col, r, { jit: r0 * 0.15 });
}
const dirOf = (a, up) => new THREE.Vector3(Math.cos(a), up, Math.sin(a));

// 立ち枯れの木（大。5〜7m）: 葉のない灰白の幹が少し曲がり、上で 2〜3 本に分かれて先は折れる。樹皮のはがれた面は明るい。根もとが広がる
export function deadTree(r) {
  const H = 5 + r() * 2, bark = () => (r() < 0.25 ? P.deadWood[2] : pick(r, [P.deadWood[0], P.deadWood[1]]));
  const g = new THREE.CylinderGeometry(0.2, 0.32, H, 8, 6), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const t = p.getY(i) / H + 0.5; p.setX(i, p.getX(i) + Math.sin(t * Math.PI) * 0.35); }
  g.translate(0, H / 2, 0);
  const parts = [shape(g, bark, r, { jit: 0.05 })];
  parts.push(shape(new THREE.ConeGeometry(0.62, 0.7, 8, 1, true).translate(0, 0.3, 0), bark, r, { jit: 0.08 })); // 根もと
  const n = 2 + Math.floor(r() * 2), top = new THREE.Vector3(0, H - 0.15, 0);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + r(), len = 1.5 + r() * 1.2;
    parts.push(limb(r, top, dirOf(a, 1.2 + r()), len, 0.16, 0.05, bark));
  }
  for (const y of [H * 0.45, H * 0.65]) parts.push(limb(r, new THREE.Vector3(Math.sin((y / H) * Math.PI) * 0.35, y, 0), dirOf(r() * 6.3, 0.4), 0.55, 0.1, 0.07, bark, true, 1)); // 折れた枝
  return merge(parts);
}

// 石垣の 1 区切り（中。2 × 0.8 × 0.6m）: 大小の平たい石を 2 段。上の段はところどころ欠け、上を向いた面に苔
export function stoneWall(r) {
  const parts = [];
  let x = -1;
  while (x < 0.95) { // 下の段
    const w = 0.42 + r() * 0.18, g = new THREE.BoxGeometry(w, 0.42, 0.58).translate(x + w / 2, 0.21, (r() - 0.5) * 0.06);
    parts.push(shape(g, (f) => (f.ny > 0.8 && r() < 0.35 ? P.moss[1] : pick(r, [P.stone[1], P.stone[2], P.stone[3]])), r, { jit: 0.07 }));
    x += w + 0.02;
  }
  x = -0.85;
  while (x < 0.8) { // 上の段（欠ける所あり）
    const w = 0.36 + r() * 0.2;
    if (r() > 0.22) {
      const g = new THREE.BoxGeometry(w, 0.34, 0.5).rotateY((r() - 0.5) * 0.2).translate(x + w / 2, 0.58, (r() - 0.5) * 0.08);
      parts.push(shape(g, (f) => (f.ny > 0.8 && r() < 0.6 ? pick(r, [P.moss[1], P.moss[2]]) : pick(r, [P.stone[2], P.stone[3]])), r, { jit: 0.07 }));
    }
    x += w + 0.04;
  }
  return merge(parts);
}

// 一本木（特大の木。高さ 18m）: 板根 4 枚の太い幹、低い所から横へ張り出す太い枝 4 本、平たく広い傘の葉のかたまり 7 つ
// 返す crotches: 鳥の巣を置く枝の上の点（スポットで使う）
export function giantTree(r) {
  const T = 9, g = new THREE.CylinderGeometry(0.85, 1.15, T, 8, 6), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { // 板根: 根もとで 1 つおきの角を外へ張り出す
    const y = p.getY(i) + T / 2, a = Math.atan2(p.getZ(i), p.getX(i)), k = Math.round((a / (Math.PI * 2)) * 8 + 8) % 2 === 0;
    const flare = Math.max(0, 1 - y / 2.6) ** 1.6 * (k ? 1.6 : 0.4);
    p.setX(i, p.getX(i) * (1 + flare)); p.setZ(i, p.getZ(i) * (1 + flare));
  }
  g.translate(0, T / 2, 0);
  const bark = () => pick(r, [P.wood[0], P.wood[1], P.wood[1]]);
  const parts = [shape(g, bark, r, { jit: 0.12 })], crotches = [];
  const leaf = (f) => (f.ny > 0.5 ? pick(r, [P.broadleaf[2], P.broadleaf[3]]) : pick(r, [P.broadleaf[0], P.broadleaf[1]]));
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4 + r() * 0.5, y = 5.5 + k * 0.9, len = 6 + r() * 1.5;
    const base = new THREE.Vector3(Math.cos(a) * 0.5, y, Math.sin(a) * 0.5), dir = dirOf(a, 0.55 + r() * 0.2);
    parts.push(limb(r, base, dir, len, 0.5, 0.22, bark, false, 3));
    const tip = base.clone().add(dir.normalize().multiplyScalar(len));
    crotches.push(base.clone().lerp(tip, 0.55).add(new THREE.Vector3(0, 0.45, 0)));
    const c = new THREE.IcosahedronGeometry(2.6 + r() * 0.6, 1).scale(1.25, 0.42, 1.25).translate(tip.x, tip.y + 0.9, tip.z);
    parts.push(shape(c, leaf, r, { jit: 0.45 }));
  }
  for (let k = 0; k < 3; k++) { // 幹の上の、真ん中と間を埋めるかたまり
    const a = (k / 3) * Math.PI * 2 + 1.1, d = k === 0 ? 0 : 3.6;
    const c = new THREE.IcosahedronGeometry(3 + r() * 0.5, 1).scale(1.3, 0.45, 1.3).translate(Math.cos(a) * d, T + 2.2 + r() * 0.8, Math.sin(a) * d);
    parts.push(shape(c, leaf, r, { jit: 0.5 }));
  }
  return { geo: merge(parts), crotches };
}

// 苔の巨岩（特大。12m）: 背の高い丸い大岩に、寄りそう岩 2 つ。上を向いた面と北（-z）の面は苔
export function mossBoulder(r) {
  const col = (f) => (f.ny > 0.45 || f.nz < -0.55 ? pick(r, [P.moss[0], P.moss[1], P.moss[2]]) : pick(r, [P.rockGray[1], P.rockGray[2], P.rockGray[2], P.rockBrown[1]]));
  const main = new THREE.IcosahedronGeometry(5, 3), p = main.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, Math.max(p.getY(i), -2.6)); // 下は地面に埋まって平ら
  main.scale(1, 1.2, 0.9).translate(0, 3.0, 0);
  const parts = [shape(main, col, r, { jit: 0.7 })];
  for (const [s, x, z] of [[2.1, 4.6, 2.2], [1.4, -4.4, 3.0]]) {
    parts.push(shape(new THREE.IcosahedronGeometry(s, 1).scale(1.2, 0.8, 1).translate(x, s * 0.55, z), col, r, { jit: s * 0.15 }));
  }
  return merge(parts);
}

// 泉（大。4m）: 苔の石を積んだ岩の割れ目から細い水の帯が落ち、下に浅い水たまり（直径 3m）。まわりに石の輪
// 返す { geo, pool }: pool は水たまりの水面（水と同じ材質で別に描く）。水面の高さ POOL_Y
export const POOL_Y = 0.08;
export function spring(r) {
  const mossy = (f) => (f.ny > 0.35 ? pick(r, [P.moss[1], P.moss[2]]) : pick(r, [P.stone[2], P.stone[3], P.rockGray[2]]));
  const parts = [];
  for (const [x, y, z, s] of [[-1.05, 0.5, -1.6, 0.9], [1.05, 0.5, -1.7, 0.92], [-0.62, 1.45, -1.95, 0.72], [0.66, 1.45, -2.0, 0.74], [-0.1, 2.25, -2.25, 0.62]]) {
    parts.push(shape(new THREE.IcosahedronGeometry(s, 1).scale(1.2, 0.9, 1).translate(x, y, z), mossy, r, { jit: s * 0.18 }));
  }
  const fall = new THREE.PlaneGeometry(0.34, 1.7, 1, 4), fp = fall.attributes.position; // 割れ目から落ちる水の帯（下は前へ）
  for (let i = 0; i < fp.count; i++) { const t = 0.5 - fp.getY(i) / 1.7; fp.setZ(i, Math.sin(t * 1.4) * 0.45); fp.setX(i, fp.getX(i) * (1 + t * 0.5)); }
  parts.push(shape(fall.translate(0, 0.95, -1.45), () => pick(r, [P.water[3], P.water[4]]), r));
  const ring = new THREE.TorusGeometry(1.55, 0.2, 4, 10).rotateX(Math.PI / 2).scale(1, 0.7, 1).translate(0, 0.08, 0);
  parts.push(shape(ring, mossy, r, { jit: 0.08 }));
  const pool = new THREE.CircleGeometry(1.5, 10).rotateX(-Math.PI / 2).translate(0, POOL_Y, 0);
  return { geo: merge(parts), pool };
}

// 光るキノコ（小。群れで 0.35m）: 細長い柄にベル形の傘を 3 本、間を空けて寄せる。柄と傘は 1 つのろくろ。傘の上に青緑の斑点。
// 傘の下のひだ（細い帯）が光る（GLOW_MAT で別に描く。横から見える）
export function glowShrooms(r) {
  const body = [], glow = [];
  for (let k = 0; k < 3; k++) {
    const h = [0.26, 0.17, 0.12][k] + r() * 0.04, rc = [0.06, 0.045, 0.035][k], a = k * 2.3 + r() * 0.5, d = k ? 0.11 + r() * 0.04 : 0;
    const tilt = (r() - 0.5) * 0.35;
    const at = (g) => g.rotateZ(tilt).translate(Math.cos(a) * d, 0, Math.sin(a) * d);
    const prof = [[0.016, 0], [0.013, h * 0.78], [rc * 0.55, h * 0.8], [rc, h * 0.78], [rc * 1.02, h * 0.86], [rc * 0.8, h * 1.02], [rc * 0.45, h * 1.14], [0, h * 1.18]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    let n = 0;
    body.push(shape(at(new THREE.LatheGeometry(prof, 5)), (f) => (f.y < h * 0.79 ? P.dryGrass[3] : f.ny > 0.4 && n++ % 3 === 1 ? P.magic[2] : pick(r, [P.magic[0], P.magic[1]])), r));
    const gill = new THREE.CylinderGeometry(rc * 0.97, rc * 0.5, 0.025, 5, 1, true).translate(0, h * 0.79, 0); // ひだ
    glow.push(shape(at(gill), P.magic[2], r, { vary: 0 }));
  }
  return { body: merge(body), glow: merge(glow) };
}

// 泉の水面（地形の水と同じ材質の色と透け方）
export const poolMesh = (geo) => {
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: P.water[2], transparent: true, opacity: 0.78, flatShading: true }));
  m.receiveShadow = true;
  return m;
};

// 持ち物の光るキノコ: 1 本を折った形（高さ 0.22m）。光るひだは glowShroomGill（同じ位置。持ったときに GLOW_MAT で足す）
const ITEM_H = 0.22, ITEM_RC = 0.07;
export function glowShroomItem(r) {
  const h = ITEM_H, rc = ITEM_RC;
  const prof = [[0.02, 0], [0.016, h * 0.78], [rc * 0.55, h * 0.8], [rc, h * 0.78], [rc * 1.02, h * 0.86], [rc * 0.8, h * 1.02], [rc * 0.45, h * 1.14], [0, h * 1.18]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  let n = 0;
  return shape(new THREE.LatheGeometry(prof, 6), (f) => (f.y < h * 0.79 ? P.dryGrass[3] : f.ny > 0.4 && n++ % 3 === 1 ? P.magic[2] : pick(r, [P.magic[0], P.magic[1]])), r);
}
export function glowShroomGill(r) {
  return shape(new THREE.CylinderGeometry(ITEM_RC * 0.97, ITEM_RC * 0.5, 0.03, 6, 1, true).translate(0, ITEM_H * 0.79, 0), P.magic[2], r, { vary: 0 });
}

// 谷にかかる大きな倒木（大。長さ len m）: 太い八角の丸太、上を向いた面に苔、切り口でなく折れた先。長い向きは x
export function bridgeLog(r, len = 9) {
  const g = new THREE.CylinderGeometry(0.42, 0.5, len, 8, 4).rotateZ(Math.PI / 2), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getX(i) > len / 2 - 0.01) p.setX(i, p.getX(i) - r() * 0.6); // 折れた先
  return shape(g, (f) => (f.ny > 0.6 ? pick(r, [P.moss[1], P.moss[2]]) : Math.abs(f.nx) > 0.8 ? P.wood[3] : pick(r, [P.wood[0], P.wood[1]])), r, { jit: 0.06 });
}
