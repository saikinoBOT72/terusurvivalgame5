// 家具: 作業台・たき火・チェスト（docs/rules/building.md「家具と石のパーツ」、objects.md「家具」）
// 位置の基準は下面の中心。向き 0 のとき、長い辺が x 方向。
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { pick, shape, merge } from '../style/lowpoly.js';
import { campfireBase } from '../world/props.js';
import { itemGeometry } from '../survival/itemShapes.js';
import { planterGeo } from '../world/crops.js';

const box = (w, h, d, x, y, z) => {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
};
const rect = (x0, x1, z0, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const board = (r) => () => pick(r, [P.wood[2], P.wood[3]]);

// 作業台: 板2枚の天板、四隅の脚、脚の間の横木
function workbenchGeo(r) {
  const parts = [];
  for (const z of [-0.125, 0.125]) parts.push(shape(box(1, 0.1, 0.24, 0, 0.7, z), board(r), r, { jit: 0.004 }));
  for (const [x, z] of [[-0.4, -0.15], [0.4, -0.15], [0.4, 0.15], [-0.4, 0.15]]) {
    parts.push(shape(box(0.12, 0.66, 0.12, x, 0.33, z), P.wood[1], r, { jit: 0.004 }));
  }
  parts.push(shape(box(0.7, 0.1, 0.1, 0, 0.22, 0), P.wood[1], r));
  // 天板の上の道具: のこぎり（ギザギザの刃と柄）と、石のハンマー
  const blade = new THREE.BoxGeometry(0.34, 0.012, 0.09, 8, 1, 1), bp = blade.attributes.position;
  for (let i = 0; i < bp.count; i++) if (bp.getZ(i) > 0.04) bp.setZ(i, bp.getZ(i) + (Math.round((bp.getX(i) + 0.17) / 0.0425) % 2 ? 0.02 : 0)); // 歯
  blade.translate(-0.12, 0, 0);
  const sawHandle = box(0.13, 0.03, 0.06, 0.1, 0, -0.005);
  for (const g of [blade, sawHandle]) g.rotateY(0.35).translate(-0.18, 0.765, 0.02);
  parts.push(shape(blade, () => pick(r, [P.stone[3], P.stone[4]]), r), shape(sawHandle, P.wood[1], r));
  const hammer = itemGeometry('stoneHammer').clone();
  hammer.scale(0.75, 0.75, 0.75).rotateZ(Math.PI / 2).rotateY(-0.4).translate(0.38, 0.815, -0.06); // 寝かせる（頭は横向き）
  parts.push(hammer);
  return merge(parts);
}

// チェスト: 箱とふた、暗い木の帯2本、前の留め金（使える物なので明るい色）
function chestGeo(r) {
  const parts = [
    shape(box(0.9, 0.44, 0.44, 0, 0.22, 0), board(r), r, { jit: 0.004 }),
    shape(box(0.94, 0.14, 0.48, 0, 0.51, 0), P.wood[2], r, { jit: 0.004 }),
  ];
  for (const x of [-0.28, 0.28]) parts.push(shape(box(0.1, 0.6, 0.5, x, 0.3, 0), P.wood[0], r));
  parts.push(shape(box(0.12, 0.14, 0.06, 0, 0.42, 0.25), P.catOrange[1], r));
  return merge(parts);
}

// 寝床: 4 本の短い脚、木の枠、わらのふとん、ヤシの葉の枕。長い辺が x 方向（2m × 1m）
export function bedGeo(r) {
  const parts = [];
  for (const x of [-0.9, 0.9]) for (const z of [-0.4, 0.4]) parts.push(shape(box(0.12, 0.2, 0.12, x, 0.1, z), P.wood[1], r));
  parts.push(shape(box(2, 0.1, 1, 0, 0.25, 0), board(r), r, { jit: 0.004 }));
  parts.push(shape(box(1.9, 0.12, 0.9, 0, 0.36, 0), () => pick(r, [P.straw[1], P.straw[2]]), r, { jit: 0.01 }));
  parts.push(shape(box(0.4, 0.1, 0.7, -0.7, 0.47, 0), () => pick(r, [P.broadleaf[1], P.broadleaf[2]]), r, { jit: 0.012 }));
  return merge(parts);
}

// floors: 家具をのせられる床の種類
export function furnitureParts(floors) {
  const common = { furniture: true, rotStep: 1, restsOn: floors };
  return {
    workbench: { ...common, name: '作業台', shape: { poly: rect(-0.5, 0.5, -0.25, 0.25), y: [0, 0.75] }, build: workbenchGeo },
    campfire: { ...common, name: 'たき火', fire: true, shape: { poly: rect(-0.5, 0.5, -0.5, 0.5), y: [0, 0.3] }, build: campfireBase },
    bed: { ...common, name: '寝床', bed: true, shape: { poly: rect(-1, 1, -0.5, 0.5), y: [0, 0.45] }, build: bedGeo },
    purifier: { ...common, name: '浄水器', purifier: true, shape: { poly: rect(-0.3, 0.85, -0.3, 0.3), y: [0, 0.65] }, build: purifierGeo },
    planter: { ...common, name: 'プランター', planter: true, shape: { poly: rect(-0.5, 0.5, -0.5, 0.5), y: [0, 0.22] }, build: planterGeo },
    furnace: { ...common, name: '炉', furnace: true, bp: 'furnace', shape: { poly: rect(-0.5, 0.5, -0.5, 0.5), y: [0, 1.4] }, build: furnaceGeo },
    chest: { ...common, name: 'チェスト', store: 12, shape: { poly: rect(-0.5, 0.5, -0.25, 0.25), y: [0, 0.6] }, build: chestGeo },
  };
}

// 浄水器（7-9 で家具に登録する）: 石で囲んだ火の場所の上に、ふたをした粘土のつぼ（海水を煮る）。
// 竹の管が、横の受け皿（厚みのある粘土の鉢）へのびる。受け皿の水の面は purifierWater で別に作り、水位で高さを変える
export const BASIN = { x: 0.68, r: 0.17, h: 0.28, floor: 0.04 }; // 受け皿
export function purifierGeo(r) {
  const parts = [];
  for (let i = 0; i < 4; i++) { // 火のまわりの石
    const a = (i / 4) * Math.PI * 2 + 0.4, st = new THREE.IcosahedronGeometry(0.13, 0);
    st.scale(1, 0.8, 1).translate(Math.cos(a) * 0.27, 0.09, Math.sin(a) * 0.27);
    parts.push(shape(st, () => pick(r, [P.stone[2], P.stone[3]]), r, { jit: 0.025 }));
  }
  const potProf = [[0, 0], [0.18, 0.02], [0.25, 0.15], [0.22, 0.3], [0.1, 0.36], [0.06, 0.42], [0, 0.42]].map(([x, y]) => new THREE.Vector2(x, y));
  const pot = new THREE.LatheGeometry(potProf, 7);
  pot.translate(0, 0.2, 0);
  parts.push(shape(pot, () => pick(r, [P.clay[1], P.clay[2]]), r, { jit: 0.008 }));
  const from = new THREE.Vector3(0.03, 0.6, 0), to = new THREE.Vector3(BASIN.x - 0.04, BASIN.h + 0.06, 0);
  const pipe = new THREE.CylinderGeometry(0.035, 0.035, from.distanceTo(to) + 0.08, 6);
  pipe.rotateZ(Math.atan2(-(to.x - from.x), to.y - from.y)).translate((from.x + to.x) / 2, (from.y + to.y) / 2, 0);
  parts.push(shape(pipe, () => pick(r, [P.bamboo[1], P.bamboo[2]]), r));
  const { x, r: br, h, floor } = BASIN;
  const basinProf = [[0, 0], [br * 0.8, 0], [br, h * 0.6], [br, h], [br - 0.025, h], [br - 0.03, floor], [0, floor]].map(([u, v]) => new THREE.Vector2(u, v));
  const basin = new THREE.LatheGeometry(basinProf, 7);
  basin.translate(x, 0, 0);
  parts.push(shape(basin, (f) => (Math.hypot(f.x - x, f.z) < br - 0.02 ? P.clay[2] : pick(r, [P.clay[0], P.clay[1]])), r));
  return merge(parts);
}
// 受け皿の水の面（y = 0 に置いてある。水位 level 0〜1 で position.y = purifierWaterY(level) にする）
export function purifierWater(r) {
  const g = new THREE.CylinderGeometry(BASIN.r - 0.03, BASIN.r - 0.03, 0.01, 7);
  g.translate(BASIN.x, 0, 0);
  return shape(g, P.water[3], r, { vary: 0.01 });
}
export const purifierWaterY = (level) => BASIN.floor + 0.005 + level * (BASIN.h - BASIN.floor - 0.04);

// 炉（家具・中。objects.md「炉と金属」）: 石を積んだ八角の塔（上がすぼまる。少し後ろに寄せる）。上に粘土の首と煙突。
// 正面の 1 面を下から 0.44m までくり抜いた焚き口。中はすすけた空洞で、薪が井げたに組んである（最初から）。
// 口の上に石 3 つの低いアーチ、両横に柱の石、前に低い敷居の石（どれも壁の面にはめこむ）。全部 1m 四方の中（当たり判定と同じ）。
// 火は燃えている間だけ、薪の上に stations.js が置く（FURNACE_FIRE）
const FZ = -0.06, MOUTH_H = 0.44; // 塔の中心の z、焚き口の高さ
export const FURNACE_FIRE = { y: 0.1, z: 0.17 };
export function furnaceGeo(r) {
  const prof = [[0, 0], [0.43, 0], [0.425, 0.18], [0.415, MOUTH_H], [0.37, 0.7], [0.29, 0.9], [0.19, 1.0], [0, 1.0]].map(([x, y]) => new THREE.Vector2(x, y));
  const lathe = new THREE.LatheGeometry(prof, 8, -Math.PI / 8).toNonIndexed(); // 1 つの面が正面（+z）を向く
  const lp = lathe.attributes.position, keep = [];
  for (let t = 0; t < lp.count; t += 3) { // 正面の面の、焚き口の高さより下の三角形を抜く
    const cx = (lp.getX(t) + lp.getX(t + 1) + lp.getX(t + 2)) / 3, cy = (lp.getY(t) + lp.getY(t + 1) + lp.getY(t + 2)) / 3, cz = (lp.getZ(t) + lp.getZ(t + 1) + lp.getZ(t + 2)) / 3;
    if (Math.abs(Math.atan2(cx, cz)) < Math.PI / 8 && cy < MOUTH_H - 0.01 && Math.hypot(cx, cz) > 0.05) continue;
    for (let k = 0; k < 3; k++) keep.push(lp.getX(t + k), lp.getY(t + k), lp.getZ(t + k));
  }
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
  body.translate(0, 0, FZ);
  // 石を積んだ段: 0.15m ごとに色を替え、ところどころ暗い目地
  const course = (f) => (r() < 0.1 ? P.stone[0] : Math.floor(f.y / 0.15) % 2 ? pick(r, [P.stone[2], P.stone[3]]) : pick(r, [P.stone[1], P.stone[2]]));
  // 焚き口の中の空洞: 内側を向けた箱（外から見える奥・横・天井だけ描かれる）
  const cave = new THREE.BoxGeometry(0.37, MOUTH_H + 0.03, 0.42);
  cave.scale(-1, 1, 1).translate(0, (MOUTH_H + 0.03) / 2, 0.14);
  const soot = (f) => (f.ny < -0.5 ? P.robotScreen[0] : pick(r, [P.robotScreen[0], P.robotScreen[1], P.stone[0]]));
  const front = 0.415 * Math.cos(Math.PI / 8) + FZ; // 正面の面の z（焚き口の高さのところ）
  const stone = () => pick(r, [P.stone[3], P.stone[4]]);
  const rot = (g, z) => g.rotateZ(z);
  const arch = [
    rot(new THREE.BoxGeometry(0.14, 0.11, 0.08), -0.38).translate(-0.12, MOUTH_H + 0.01, front),
    new THREE.BoxGeometry(0.12, 0.13, 0.09).translate(0, MOUTH_H + 0.05, front + 0.005),
    rot(new THREE.BoxGeometry(0.14, 0.11, 0.08), 0.38).translate(0.12, MOUTH_H + 0.01, front),
  ];
  const jambs = [-1, 1].map((sx) => new THREE.BoxGeometry(0.07, MOUTH_H - 0.04, 0.09).translate(sx * 0.18, (MOUTH_H - 0.04) / 2, front - 0.01));
  const sill = new THREE.BoxGeometry(0.44, 0.05, 0.13).translate(0, 0.025, front + 0.1);
  const collar = new THREE.CylinderGeometry(0.2, 0.22, 0.1, 8).translate(0, 1.02, FZ);
  const chimney = new THREE.CylinderGeometry(0.12, 0.15, 0.38, 8).translate(0, 1.25, FZ);
  // 薪: 太めの 5 角の丸太を井げたに組む（下の段は前後、上の段は左右）。切り口は明るい
  const logs = [];
  [[-0.08, 0.035, 0.15, 0], [0.08, 0.035, 0.15, 0], [0, 0.088, 0.1, Math.PI / 2], [0, 0.088, 0.22, Math.PI / 2], [0.02, 0.14, 0.16, 0.4]].forEach(([x, y, z, ry]) => {
    const g = new THREE.CylinderGeometry(0.03, 0.033, 0.27 + r() * 0.04, 5);
    g.rotateX(Math.PI / 2).rotateY(ry).translate(x, y, z);
    const axis = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
    logs.push(shape(g, (f) => (Math.abs(f.nx * axis.x + f.nz * axis.z) > 0.85 ? P.wood[4] : pick(r, [P.wood[1], P.wood[2]])), r, { jit: 0.004 }));
  });
  return merge([
    shape(body, course, r, { jit: 0.018 }),
    shape(cave, soot, r),
    ...arch.map((g) => shape(g, stone, r, { jit: 0.008 })),
    ...jambs.map((g) => shape(g, stone, r, { jit: 0.008 })),
    shape(sill, () => pick(r, [P.stone[1], P.stone[2]]), r, { jit: 0.008 }),
    shape(collar, () => pick(r, [P.clay[1], P.clay[2]]), r, { jit: 0.01 }),
    shape(chimney, (f) => (f.y > 1.4 ? P.stone[0] : pick(r, [P.clay[0], P.clay[1]])), r, { jit: 0.01 }),
    ...logs,
  ]);
}
