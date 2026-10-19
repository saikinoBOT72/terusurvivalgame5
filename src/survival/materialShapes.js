// 素材・食べ物・入れ物の形（docs/rules/objects.md「序盤の自然物と素材の形」）。itemShapes.js の SHAPES に足して使う
// どれも rand（rng）を受け取ってジオメトリを返す。寝かせた物は長い向きが x
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { pick, shape, merge } from '../style/lowpoly.js';
import { shellGeo } from '../world/spotBeach.js';
import { glowShroomItem } from '../world/spotNature.js';
import { mushrooms } from '../world/props.js';
import { sapling, eggGeo } from '../world/flora.js';

// 焼いた物: 元の形の色を焦げ茶（wood の暗い段）へ寄せる
const TOAST = new THREE.Color(P.wood[1]);
function toasted(geo, k = 0.55) {
  const c = geo.attributes.color, col = new THREE.Color();
  for (let i = 0; i < c.count; i++) { col.fromBufferAttribute(c, i).lerp(TOAST, k); c.setXYZ(i, col.r, col.g, col.b); }
  return geo;
}

// 魚: とがった胴に、三角のしっぽを少しめり込ませてつなぐ。目は × 印。頭が +x
// s: 大きさ、col: 一色で塗るとき（釣り竿のえさ）、eyes: 目を付けるか
export function fish(r, { s = 1, col = null, eyes = true } = {}) {
  const body = new THREE.IcosahedronGeometry(0.15, 0);
  body.scale(1.6, 0.9, 0.5);
  const tail = new THREE.ConeGeometry(0.11, 0.16, 5);
  tail.rotateZ(-Math.PI / 2).scale(1, 1, 0.35).translate(-0.27, 0, 0);
  const bodyCol = col ? () => col : (f) => (f.ny < -0.3 ? P.water[3] : pick(r, [P.water[1], P.water[2]]));
  const bodyGeo = shape(body, bodyCol, r, { jit: 0.005 });
  const parts = [bodyGeo, shape(tail, col ?? P.water[1], r)];
  if (eyes) { // × 印を、胴の表面にぴったり付ける（外から胴に向けて線を飛ばし、当たった所）
    const ray = new THREE.Raycaster(), m = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial());
    for (const side of [-1, 1]) {
      ray.set(new THREE.Vector3(0.13, 0.03, side), new THREE.Vector3(0, 0, -side));
      const z = ray.intersectObject(m)[0]?.point.z ?? 0.05 * side;
      for (const a of [0.8, -0.8]) {
        const bar = new THREE.BoxGeometry(0.045, 0.01, 0.01);
        bar.rotateZ(a).translate(0.13, 0.03, z);
        parts.push(shape(bar, P.eye, r));
      }
    }
  }
  const g = merge(parts);
  g.scale(s, s, s).translate(0, 0.07 * s, 0);
  return g;
}
export const berry = (r) => merge([[0, 0.06, 0], [0.09, 0.05, 0.03], [0.03, 0.05, 0.09]].map(([x, y, z]) => {
  const g = new THREE.IcosahedronGeometry(0.06, 0);
  g.translate(x, y, z);
  return shape(g, () => pick(r, [P.catOrange[1], P.catOrange[2]]), r);
}));
const egg = (r) => shape(eggGeo(0.065).translate(0, 0.085, 0), () => pick(r, [P.catWhite[1], P.catWhite[2]]), r);

// 竹筒: コップの形（厚みのある壁を、ろくろで外 → ふち → 内 → 底の順に回す）。下に節。中身は液体の面で見せる
const TUBE_R = 0.09, TUBE_H = 0.3, TUBE_FLOOR = 0.04;
function tube(r, liquid = null) {
  const prof = [[0, 0], [TUBE_R, 0], [TUBE_R + 0.012, 0.03], [TUBE_R, 0.06], [TUBE_R, TUBE_H], [TUBE_R - 0.016, TUBE_H], [TUBE_R - 0.016, TUBE_FLOOR], [0, TUBE_FLOOR]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(prof, 8);
  const parts = [shape(g, (f) => (f.y > TUBE_H - 0.01 || Math.hypot(f.x, f.z) < TUBE_R - 0.01 ? P.bamboo[3] : pick(r, [P.bamboo[1], P.bamboo[2]])), r)];
  if (liquid) { // 7 分目まで入った水の面
    const w = new THREE.CylinderGeometry(TUBE_R - 0.017, TUBE_R - 0.017, 0.01, 8);
    w.translate(0, TUBE_FLOOR + (TUBE_H - TUBE_FLOOR) * 0.7, 0);
    parts.push(shape(w, liquid, r, { vary: 0.01 }));
  }
  return merge(parts);
}

// ひも: 細いひもを 2 巻き半ぐるぐる巻いて、はしを少し出す
function rope(r) {
  const pts = [];
  for (let k = 0; k <= 20; k++) {
    const a = (k / 20) * Math.PI * 5, rad = 0.11 - k * 0.0015;
    pts.push(new THREE.Vector3(Math.cos(a) * rad, 0.016 + k * 0.0022, Math.sin(a) * rad));
  }
  pts.push(new THREE.Vector3(0.2, 0.02, 0.05), new THREE.Vector3(0.26, 0.016, 0.1)); // はし
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 34, 0.014, 3);
  return shape(g, () => pick(r, [P.straw[1], P.straw[2]]), r);
}

const ore = (r, color) => {
  const g = new THREE.IcosahedronGeometry(0.1, 0);
  g.scale(1.2, 0.8, 1).translate(0, 0.08, 0);
  return shape(g, color, r, { jit: 0.025 });
};
const itemPotato = (r) => shape(new THREE.IcosahedronGeometry(0.08, 1).scale(1.35, 0.85, 1).translate(0, 0.07, 0), () => pick(r, P.potato), r, { jit: 0.01 });
export const MATERIAL_SHAPES = {
  // 植物繊維: 細い草の束を 3 本、真ん中でゆわえる
  fiber: (r) => {
    const parts = [-0.04, 0, 0.04].map((z, i) => {
      const g = new THREE.CylinderGeometry(0.012, 0.02, 0.4, 3);
      g.rotateZ(Math.PI / 2).rotateY((i - 1) * 0.15).translate(0, 0.03, z);
      return shape(g, () => pick(r, [P.dryGrass[1], P.dryGrass[2]]), r);
    });
    const band = new THREE.CylinderGeometry(0.06, 0.06, 0.05, 6);
    band.rotateZ(Math.PI / 2).translate(0, 0.03, 0);
    return merge([...parts, shape(band, P.straw[0], r)]);
  },
  rope,
  // 火打ち石: とがった黒っぽい石
  flint: (r) => {
    const g = new THREE.IcosahedronGeometry(0.09, 0);
    g.scale(1.5, 0.65, 0.9).translate(0, 0.06, 0);
    return shape(g, () => pick(r, [P.stone[0], P.stone[1]]), r, { jit: 0.02 });
  },
  // 墜落した飛行機から出た物: 機内食（ふたつきの平たい箱）、水のボトル（八角の透けた青い筒とふた）、救急セット（白い小箱に赤い十字）
  // 機内食: 下が少しすぼまった白い容器に、しわのあるアルミのふた。真ん中に航空会社の帯（赤）と白いラベル
  meal: (r) => {
    const tub = new THREE.BoxGeometry(0.24, 0.05, 0.16), tp = tub.attributes.position;
    for (let i = 0; i < tp.count; i++) if (tp.getY(i) < 0) { tp.setX(i, tp.getX(i) * 0.86); tp.setZ(i, tp.getZ(i) * 0.86); }
    tub.translate(0, 0.025, 0);
    const lid = new THREE.BoxGeometry(0.246, 0.008, 0.166, 2, 1, 2), lp = lid.attributes.position;
    for (let i = 0; i < lp.count; i++) if (Math.abs(lp.getX(i)) < 0.01 && lp.getY(i) > 0) lp.setY(i, lp.getY(i) + 0.006); // ふたのふくらみ
    lid.translate(0, 0.054, 0);
    return merge([
      shape(tub, () => pick(r, [P.plane[1], P.plane[2]]), r),
      shape(lid, () => pick(r, P.foil), r),
      shape(new THREE.BoxGeometry(0.075, 0.064, 0.172).translate(0.03, 0.03, 0), P.planeStripe[1], r),
      shape(new THREE.BoxGeometry(0.05, 0.004, 0.07).translate(0.03, 0.064, 0), P.plane[2], r),
    ]);
  },
  waterBottle: (r) => merge([
    shape(new THREE.CylinderGeometry(0.045, 0.05, 0.22, 8).translate(0, 0.11, 0), () => pick(r, [P.water[2], P.water[3]]), r),
    shape(new THREE.CylinderGeometry(0.025, 0.025, 0.04, 8).translate(0, 0.24, 0), P.planeStripe[0], r),
  ]),
  // 救急セット（置いてある救急箱も同じ形。wreck.js）: 薄くて大きい、角を落とした白いケース、まわりのファスナーの帯、ふたの上に出た赤い十字
  firstAid: (r) => {
    const W = 0.3, H = 0.08, D = 0.2;
    const body = new THREE.BoxGeometry(W, H, D, 2, 1, 2), bp = body.attributes.position;
    for (let i = 0; i < bp.count; i++) { // 縦の角を落とす
      const x = bp.getX(i), z = bp.getZ(i);
      if (Math.abs(x) > W / 2 - 0.01 && Math.abs(z) > D / 2 - 0.01) { bp.setX(i, x * 0.9); bp.setZ(i, z * 0.86); }
    }
    body.translate(0, H / 2, 0);
    return merge([
      shape(body, () => pick(r, [P.plane[1], P.plane[2]]), r),
      shape(new THREE.BoxGeometry(W + 0.004, 0.012, D + 0.004).translate(0, H * 0.5, 0), P.stone[0], r),
      shape(new THREE.BoxGeometry(0.14, 0.008, 0.045).translate(0, H + 0.004, 0), P.food[1], r),
      shape(new THREE.BoxGeometry(0.045, 0.008, 0.14).translate(0, H + 0.005, 0), P.food[1], r),
    ]);
  },
  // 鉱石: 角ばった塊。石炭は黒、銅鉱石は石に青緑とオレンジ、鉄鉱石は赤茶
  coal: (r) => ore(r, () => pick(r, P.coal)),
  copperOre: (r) => ore(r, (f) => (f.y > 0.08 ? pick(r, [P.copper[0], P.copper[1], P.copper[2]]) : P.stone[2])),
  ironOre: (r) => ore(r, () => pick(r, P.iron)),
  clay: (r) => {
    const g = new THREE.IcosahedronGeometry(0.12, 0);
    g.scale(1.2, 0.55, 1).translate(0, 0.06, 0);
    return shape(g, () => pick(r, [P.clay[1], P.clay[2]]), r, { jit: 0.02 });
  },
  brick: (r) => {
    const g = new THREE.BoxGeometry(0.26, 0.1, 0.13, 2, 1, 1);
    g.translate(0, 0.05, 0);
    return shape(g, () => pick(r, [P.clay[0], P.clay[1]]), r, { jit: 0.01 });
  },
  // 竹: 切った竹。はしの近くに節を 1 つ（少し太い輪）。切り口は明るい
  bamboo: (r) => {
    const g = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6, 4);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (Math.abs(p.getY(i) + 0.125) < 0.01) { p.setX(i, p.getX(i) * 1.12); p.setZ(i, p.getZ(i) * 1.12); }
    g.rotateZ(Math.PI / 2).translate(0, 0.05, 0);
    return shape(g, (f) => (Math.abs(f.nx) > 0.9 ? P.bamboo[3] : pick(r, [P.bamboo[1], P.bamboo[2]])), r);
  },
  // ヤシの葉: 細長いひし形の葉と、短い軸
  palmLeaf: (r) => {
    const leaf = new THREE.IcosahedronGeometry(0.1, 0);
    leaf.scale(3.2, 0.12, 0.8).translate(0.06, 0.02, 0);
    const stem = new THREE.CylinderGeometry(0.012, 0.015, 0.16, 4);
    stem.rotateZ(Math.PI / 2).translate(-0.33, 0.02, 0);
    return merge([shape(leaf, () => pick(r, [P.broadleaf[2], P.broadleaf[3]]), r), shape(stem, P.wood[3], r)]);
  },
  // 羽根: 平たい羽根の真ん中を、軸が根元から先まで通る
  feather: (r) => {
    const vane = new THREE.IcosahedronGeometry(0.1, 0);
    vane.scale(1.3, 0.1, 0.4).translate(0.03, 0.012, 0);
    const quill = new THREE.CylinderGeometry(0.006, 0.01, 0.34, 4);
    quill.rotateZ(Math.PI / 2).translate(-0.03, 0.012, 0);
    return merge([shape(vane, () => pick(r, [P.catWhite[1], P.catWhite[2]]), r), shape(quill, P.catWhite[0], r)]);
  },
  sapling: (r) => sapling(r, 0),
  mushroom: (r) => mushrooms(r),
  egg,
  // ヤシの実: 茶色の多面体
  coconut: (r) => {
    const g = new THREE.IcosahedronGeometry(0.16, 1);
    g.scale(1, 1.1, 1).translate(0, 0.17, 0);
    return shape(g, () => pick(r, [P.wood[0], P.wood[1]]), r, { jit: 0.02 });
  },
  fish: (r) => fish(r),
  cookedBerry: (r) => toasted(berry(r)),
  cookedMushroom: (r) => toasted(mushrooms(r)),
  cookedEgg: (r) => toasted(egg(r), 0.75),
  cookedFish: (r) => toasted(fish(r), 0.7),
  cookedPotato: (r) => toasted(itemPotato(r), 0.6),
  shell: (r) => shellGeo(r), // 貝（世界に置く形と同じ）
  cookedShell: (r) => shellGeo(r, true),
  glowShroom: (r) => glowShroomItem(r), // 1 本を折った形（光る面は持ったときに main.js で足す）
  tubeEmpty: (r) => tube(r),
  tubeSea: (r) => tube(r, P.water[0]),
  tubeFresh: (r) => tube(r, P.water[2]),
};
