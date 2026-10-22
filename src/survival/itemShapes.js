// 持ち物の形（アイコンと、手に持ったときの見た目に使う）（docs/rules/objects.md「小物」）
// 道具は柄が y の向き。握る所が y = GRIP。頭（刃）は +z の向きに付ける。
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { rng, pick, shape, merge, makeMesh } from '../style/lowpoly.js';
import { stick, pebble } from '../world/pickups.js';
import { MATERIAL_SHAPES, berry, fish as fishShape } from './materialShapes.js';
import { METAL_SHAPES } from './metalShapes.js';
import { GUN_SHAPES } from './gunShapes.js';
import { CLIP_GUN_SHAPES } from './clipGuns.js';
import { BAG_SHAPES } from './bagShapes.js';
import { WEAR_SHAPES } from './wearShapes.js';
import { CROP_ITEM_SHAPES } from '../world/crops.js';

export const GRIP = 0.12;
export const gripOf = (id) => (id === 'stoneSpear' || id === 'ironSpear' || id === 'paddle' ? 0.4 : GRIP); // やりとかいは柄の中ほどを握る
const woodCol = (r) => () => pick(r, [P.wood[3], P.wood[4]]); // 木の頭は柄より明るい（削った木）
const lashing = (r, y) => shape(new THREE.CylinderGeometry(0.075, 0.075, 0.07, 8).translate(0, y, 0), P.straw[1], r); // 頭を縛るひも
const stoneCol = (r) => () => pick(r, [P.stone[2], P.stone[3]]);

// 八角形の柄と、頭の下に巻いたひも
export function handle(r, len = 0.6) {
  const h = new THREE.CylinderGeometry(0.05, 0.055, len, 8);
  h.translate(0, len / 2, 0);
  const wrap = new THREE.CylinderGeometry(0.068, 0.068, 0.1, 8);
  wrap.translate(0, len - 0.17, 0);
  return [shape(h, () => pick(r, [P.wood[2], P.wood[3]]), r, { jit: 0.008 }), shape(wrap, P.straw[1], r)];
}

// 箱の頂点を動かして作る石の頭。taper(z) で z の位置ごとの太さを決める
// col: 面ごとの色（なければ石の色。鉄の道具は金属の色。metalShapes.js）
export function stoneHead(r, w, h, d, taper, y, col = null) {
  const g = new THREE.BoxGeometry(w, h, d, 1, 1, 2), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = taper(p.getZ(i) / (d / 2));
    p.setX(i, p.getX(i) * k.x);
    p.setY(i, p.getY(i) * k.y);
  }
  g.translate(0, y, 0);
  return shape(g, col ?? stoneCol(r), r, { jit: 0.012 });
}

// 火打ち石の刃: 平らな形 pts（x, y）に厚みを付け、edge(x) が true の側を薄くする（刃）。刃の面は x-y
export function flintBlade(r, pts, depth, edge, col = null) {
  const sh = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (edge(p.getX(i))) p.setZ(i, p.getZ(i) * 0.25);
  return shape(g, col ?? ((f) => (Math.abs(f.nz) > 0.5 ? pick(r, [P.stone[0], P.stone[1]]) : P.stone[2])), r);
}

// スリング: Y 字の枝（frame）と、先から袋へのびるひも 2 本・袋（bag。引くと袋だけ動く。avatar/fpSling.js）
const SLING_TIPS = [new THREE.Vector3(-0.096, 0.455, 0), new THREE.Vector3(0.096, 0.455, 0)], SLING_POUCH = new THREE.Vector3(0, 0.39, 0);
export function strapGeo(r, tip, pouch) {
  const mid = tip.clone().add(pouch).multiplyScalar(0.5);
  const g = new THREE.CylinderGeometry(0.007, 0.007, tip.distanceTo(pouch), 4);
  g.rotateZ(Math.atan2(pouch.x - tip.x, tip.y - pouch.y)).translate(mid.x, mid.y, mid.z);
  return shape(g, P.straw[1], r);
}
export function slingParts(r) {
  const col = () => pick(r, [P.wood[2], P.wood[3]]);
  const grip = new THREE.CylinderGeometry(0.035, 0.04, 0.3, 6);
  grip.translate(0, 0.15, 0);
  const frame = [shape(grip, col, r, { jit: 0.005 })];
  for (const s of [-1, 1]) {
    const arm = new THREE.CylinderGeometry(0.03, 0.035, 0.2, 6);
    arm.translate(0, 0.1, 0).rotateZ(-0.5 * s).translate(0, 0.28, 0);
    frame.push(shape(arm, col, r));
  }
  const bag = shape(new THREE.BoxGeometry(0.045, 0.02, 0.035).translate(SLING_POUCH.x, SLING_POUCH.y, SLING_POUCH.z), P.straw[0], r);
  return { frame, bag: [bag], tips: SLING_TIPS, pouch: SLING_POUCH };
}

const SHAPES = {
  stick: (r) => stick(r),
  stone: (r) => pebble(r, 0.12),
  // 木材: 短い八角形の丸太。切り口は明るい色
  wood: (r) => {
    const g = new THREE.CylinderGeometry(0.11, 0.11, 0.45, 8);
    g.rotateZ(Math.PI / 2);
    g.translate(0, 0.11, 0);
    return shape(g, (f) => (Math.abs(f.nx) > 0.9 ? P.wood[4] : pick(r, [P.wood[1], P.wood[2]])), r, { jit: 0.01 });
  },
  berry, // 木の実: 3つ寄せる
  ...MATERIAL_SHAPES,
  ...METAL_SHAPES,
  ...GUN_SHAPES,
  ...CLIP_GUN_SHAPES,
  ...BAG_SHAPES,
  ...WEAR_SHAPES,
  ...CROP_ITEM_SHAPES,
  // 石のナイフ: 短い柄に、火打ち石の片刃の刃。背はまっすぐ、刃（+z）はふくらんで先がとがる。刃先ほど薄い
  stoneKnife: (r) => {
    const blade = flintBlade(r, [[-0.022, 0.27], [0.05, 0.27], [0.062, 0.35], [0.05, 0.44], [0.0, 0.56], [-0.022, 0.46]], 0.03, (x) => x > 0.03);
    blade.rotateY(-Math.PI / 2); // 刃を +z へ
    return merge([...handle(r, 0.3), blade]);
  },
  sling: (r) => {
    const { frame, bag, tips, pouch } = slingParts(r);
    return merge([...frame, ...tips.map((t) => strapGeo(r, t, pouch)), ...bag]);
  },
  // 釣り竿: 竹の竿と、先から垂れた糸、糸の先に水色の小さな魚の形のえさ
  fishingRod: (r) => {
    const rod = new THREE.CylinderGeometry(0.018, 0.035, 1.2, 6);
    rod.translate(0, 0.6, 0);
    const wrap = new THREE.CylinderGeometry(0.045, 0.045, 0.12, 6);
    wrap.translate(0, 0.12, 0);
    const line = new THREE.CylinderGeometry(0.005, 0.005, 0.4, 3);
    line.translate(0, 1.0, 0.025);
    const lure = fishShape(r, { s: 0.22, col: P.water[3], eyes: false });
    lure.rotateZ(Math.PI / 2).translate(0, 0.75, 0.025); // 頭を上（糸の側）へ
    return merge([shape(rod, () => pick(r, [P.bamboo[1], P.bamboo[2]]), r), shape(wrap, P.straw[1], r), shape(line, P.catWhite[2], r), lure]);
  },
  // 松明: 柄の先に、ヤシの葉を巻いた束と、小さな炎（光の材質ではなく、ふつうの塗り）
  torch: (r) => {
    const head = new THREE.CylinderGeometry(0.07, 0.095, 0.17, 8);
    head.translate(0, 0.72, 0);
    const flame = (rad, h, col, y) => {
      const g = new THREE.ConeGeometry(rad, h, 5);
      g.translate(0, y + h / 2, 0);
      return shape(g, col, r, { jit: rad * 0.3 });
    };
    return merge([...handle(r, 0.75), shape(head, () => pick(r, [P.straw[0], P.straw[1]]), r, { jit: 0.01 }), flame(0.085, 0.26, P.fire[0], 0.78), flame(0.05, 0.22, P.fire[2], 0.8)]);
  },
  // 木の斧・木のピッケル: 石の道具と同じ長さと握り。頭は削った木のかたまりを、ひもで縛る
  woodAxe: (r) => merge([...handle(r), stoneHead(r, 0.12, 0.16, 0.3, (t) => ({ x: t > 0 ? 1 - t * 0.6 : 1, y: t > 0 ? 1 + t * 0.2 : 1 }), 0.5, woodCol(r)), lashing(r, 0.44)]),
  woodPick: (r) => merge([...handle(r), stoneHead(r, 0.1, 0.11, 0.56, (t) => ({ x: 1 - Math.abs(t) * 0.75, y: 1 - Math.abs(t) * 0.75 }), 0.5, woodCol(r)), lashing(r, 0.44)]),
  // 斧: 刃に向かって薄くなるくさび
  stoneAxe: (r) => merge([...handle(r), stoneHead(r, 0.11, 0.18, 0.3, (t) => ({ x: t > 0 ? 1 - t * 0.75 : 1, y: t > 0 ? 1 + t * 0.35 : 1 }), 0.5)]),
  // ピッケル: 両側がとがった、長い頭
  stonePick: (r) => {
    const g = stoneHead(r, 0.1, 0.11, 0.56, (t) => ({ x: 1 - Math.abs(t) * 0.8, y: 1 - Math.abs(t) * 0.8 }), 0.5);
    return merge([...handle(r), g]);
  },
  // ハンマー: 四角いずんぐりした頭
  stoneHammer: (r) => merge([...handle(r, 0.55), stoneHead(r, 0.17, 0.17, 0.28, () => ({ x: 1, y: 1 }), 0.47)]),
  // やり: 長い柄の先に、ナイフと同じ作りの両刃の穂先（木の葉の形、ふちが薄い）。ひもで留める
  stoneSpear: (r) => {
    const h = new THREE.CylinderGeometry(0.04, 0.045, 1.15, 8);
    h.translate(0, 0.575, 0);
    const wrap = new THREE.CylinderGeometry(0.058, 0.058, 0.1, 8);
    wrap.translate(0, 1.1, 0);
    const tip = flintBlade(r, [[-0.04, 1.08], [0.04, 1.08], [0.07, 1.2], [0.0, 1.42], [-0.07, 1.2]], 0.04, (x) => Math.abs(x) > 0.035);
    return merge([shape(h, () => pick(r, [P.wood[2], P.wood[3]]), r, { jit: 0.006 }), shape(wrap, P.straw[1], r), tip]);
  },
  // かい: 細い柄の先に平たい板（x-y の面）。板は先が丸くなるよう角を落とす。長さ 1.2m
  paddle: (r) => {
    const h = new THREE.CylinderGeometry(0.035, 0.04, 0.9, 8);
    h.translate(0, 0.45, 0);
    const knob = new THREE.BoxGeometry(0.14, 0.05, 0.06);
    knob.translate(0, 0.02, 0);
    const blade = new THREE.BoxGeometry(0.22, 0.36, 0.035, 2, 2, 1), q = blade.attributes.position;
    for (let i = 0; i < q.count; i++) { // 柄の側は細く、先の角は丸く
      const x = q.getX(i), y = q.getY(i);
      q.setX(i, y < 0 ? x * 0.55 : y > 0.1 ? x * 0.8 : x);
    }
    blade.translate(0, 1.02, 0);
    return merge([shape(h, () => pick(r, [P.wood[2], P.wood[3]]), r, { jit: 0.005 }), shape(knob, P.wood[1], r), shape(blade, () => pick(r, [P.wood[3], P.wood[2]]), r, { jit: 0.008 })]);
  },
};

const cache = new Map();
export function itemGeometry(id) {
  if (!cache.has(id)) cache.set(id, SHAPES[id](rng(id.length * 31 + id.charCodeAt(0))));
  return cache.get(id);
}
export const itemMesh = (id) => makeMesh(itemGeometry(id), { shadow: false });
