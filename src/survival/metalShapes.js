// 炉と金属の持ち物の形（docs/rules/objects.md「炉と金属」）。itemShapes.js の SHAPES に足して使う
// 延べ棒・銅線・ネジ・金属片・バッテリー・ランタン・鉄の道具・設計図。寝かせた物は長い向きが x
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { pick, shape, merge } from '../style/lowpoly.js';
import { handle, stoneHead, flintBlade } from './itemShapes.js';

// 延べ棒: 上がすぼまった台形の棒。上の面は明るい
function ingot(r, cols) {
  const g = new THREE.BoxGeometry(0.2, 0.05, 0.085, 2, 1, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setX(i, p.getX(i) * 0.82); p.setZ(i, p.getZ(i) * 0.72); }
  g.translate(0, 0.025, 0);
  return shape(g, (f) => (f.ny > 0.9 ? cols[2] : pick(r, [cols[0], cols[1]])), r);
}

// 鉄の道具の頭の色: 刃先（先のほう）ほど明るい
const ironCol = (r, edgeZ) => (f) => (Math.abs(f.z) > edgeZ ? P.ironMetal[3] : pick(r, [P.ironMetal[1], P.ironMetal[2]]));

// 設計図: 丸めた青い紙をひもで留める
export const blueprintRoll = (r) => merge([
  shape(new THREE.CylinderGeometry(0.045, 0.045, 0.4, 8).rotateZ(Math.PI / 2).translate(0, 0.045, 0), () => pick(r, P.blueprint), r),
  shape(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 8).rotateZ(Math.PI / 2).translate(0.06, 0.045, 0), P.straw[1], r),
]);

export const METAL_SHAPES = {
  copperIngot: (r) => ingot(r, P.copperMetal),
  ironIngot: (r) => ingot(r, [P.ironMetal[1], P.ironMetal[2], P.ironMetal[3]]),
  // 銅線: 平たく巻いた輪と、ほどけたはし
  copperWire: (r) => {
    const coil = new THREE.TorusGeometry(0.07, 0.014, 3, 9);
    coil.rotateX(Math.PI / 2).scale(1, 2.2, 1).translate(0, 0.03, 0);
    const tail = new THREE.CylinderGeometry(0.008, 0.008, 0.12, 4);
    tail.rotateZ(Math.PI / 2 - 0.3).translate(0.11, 0.03, 0.02);
    return merge([shape(coil, () => pick(r, P.copperMetal), r), shape(tail, P.copperMetal[2], r)]);
  },
  // ネジ: 六角の頭と、先が細い軸（立てて置く）
  screw: (r) => merge([
    shape(new THREE.CylinderGeometry(0.032, 0.032, 0.022, 6).translate(0, 0.081, 0), () => pick(r, P.robotMetal), r),
    shape(new THREE.CylinderGeometry(0.013, 0.004, 0.07, 6).translate(0, 0.035, 0), P.robotMetal[0], r),
  ]),
  // 金属片: ロボットの装甲がちぎれた、曲がった板。青灰の塗りに、さびの所
  scrap: (r) => {
    const g = new THREE.BoxGeometry(0.22, 0.012, 0.15, 3, 1, 2), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, p.getY(i) + Math.abs(x) * 0.25 + Math.sin(z * 30) * 0.008); // 両はしが反る
      if (x > 0.1) p.setZ(i, z * (0.7 + Math.sin(z * 40) * 0.2)); // ちぎれたはし
    }
    g.translate(0, 0.02, 0);
    return shape(g, (f) => (f.x > 0.05 && f.z < 0 ? pick(r, P.robotRust) : pick(r, [P.robotShell[0], P.robotShell[1]])), r);
  },
  // バッテリー: 暗い筒に黄色い帯、上に小さな端子
  battery: (r) => merge([
    shape(new THREE.CylinderGeometry(0.04, 0.04, 0.13, 8).translate(0, 0.065, 0), () => pick(r, [P.robotFrame[0], P.robotFrame[1]]), r),
    shape(new THREE.CylinderGeometry(0.042, 0.042, 0.03, 8, 1, true).translate(0, 0.1, 0), P.robotHazard[1], r),
    shape(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 6).translate(0, 0.14, 0), P.robotMetal[2], r),
  ]),
  // ランタン: 鉄の台、白く光るガラスの筒、とがったふた、上に弧の持ち手
  lantern: (r) => {
    const hoop = new THREE.TorusGeometry(0.05, 0.007, 3, 8, Math.PI);
    hoop.translate(0, 0.24, 0);
    return merge([
      shape(new THREE.CylinderGeometry(0.07, 0.075, 0.03, 8).translate(0, 0.015, 0), () => pick(r, [P.ironMetal[0], P.ironMetal[1]]), r),
      shape(new THREE.CylinderGeometry(0.052, 0.052, 0.13, 8).translate(0, 0.095, 0), P.lanternGlow, r, { vary: 0.01 }),
      shape(new THREE.ConeGeometry(0.075, 0.08, 8).translate(0, 0.2, 0), () => pick(r, [P.ironMetal[0], P.ironMetal[1]]), r),
      shape(hoop, P.ironMetal[2], r),
    ]);
  },
  // 鉄の道具: 石の道具と同じ形で、頭を金属に（刃先が明るい）
  ironAxe: (r) => merge([...handle(r), stoneHead(r, 0.09, 0.17, 0.3, (t) => ({ x: t > 0 ? 1 - t * 0.85 : 1, y: t > 0 ? 1 + t * 0.45 : 1 }), 0.5, ironCol(r, 0.1))]),
  ironPick: (r) => merge([...handle(r), stoneHead(r, 0.08, 0.09, 0.58, (t) => ({ x: 1 - Math.abs(t) * 0.85, y: 1 - Math.abs(t) * 0.85 }), 0.5, ironCol(r, 0.2))]),
  ironSpear: (r) => {
    const h = new THREE.CylinderGeometry(0.04, 0.045, 1.15, 8);
    h.translate(0, 0.575, 0);
    const collar = new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8);
    collar.translate(0, 1.1, 0);
    const tip = flintBlade(r, [[-0.035, 1.08], [0.035, 1.08], [0.065, 1.22], [0.0, 1.46], [-0.065, 1.22]], 0.03, (x) => Math.abs(x) > 0.03,
      (f) => (Math.abs(f.nz) > 0.5 ? pick(r, [P.ironMetal[2], P.ironMetal[3]]) : P.ironMetal[1]));
    return merge([shape(h, () => pick(r, [P.wood[2], P.wood[3]]), r, { jit: 0.006 }), shape(collar, P.ironMetal[1], r), tip]);
  },
  bpFurnace: blueprintRoll,
  bpIronTools: blueprintRoll,
  bpLantern: blueprintRoll,
  bpJunkPistol: blueprintRoll,
  bpGenerator: blueprintRoll,
  bpWindmill: blueprintRoll,
  bpDrill: blueprintRoll,
  bpAutoFurnace: blueprintRoll,
  bpAutoBench: blueprintRoll,
  bpBelt: blueprintRoll,
};
