// 建築パーツの形と大きさ（docs/rules/building.md）
// 位置の基準: 床は上面の、元になる 1m 四方の中心。壁は下端の中心（半分の壁は下端の左端）。柱は下端の中心。
// 向き 0 のとき、壁は x 方向に伸びる。
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { rng, pick, shape, merge } from '../style/lowpoly.js';
import { SQRT2 } from './grid.js';
import { furnitureParts } from './furniture.js';
import { stoneFloorGeo, stoneWallGeo } from './stoneParts.js';
import { brickFloorGeo, brickWallGeo } from './brickParts.js';
import { raftFloorGeo, raftCoreGeo, sailGeo, sailFrameGeo, sailClothGeo, SAIL_TOP, helmGeo } from './raftParts.js';
import { boat as boatGeo } from '../world/props.js';
import { automationParts, AUTO_COSTS } from '../automation/partDefs.js';

const box = (w, h, d, x, y, z) => {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
};
// 水平面の多角形を、高さ y0〜y1 の柱状にする
const prism = (pts, y0, y1) => {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z))), { depth: y1 - y0, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  return g;
};
const rect = (x0, x1, z0, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const board = (r) => () => pick(r, [P.wood[2], P.wood[3]]);

const SQ = rect(-0.5, 0.5, -0.5, 0.5);
const TRI = [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5]]; // 直角は (-0.5, -0.5)、斜めの辺は x + z = 0
const FLOOR_Y = [-0.25, 0];
const WALL_T = 0.075; // 壁の厚さの半分
export const WALL_H = 2; // 壁・柱・ドア・窓の高さ。急な階段 2 つ（ゆるい階段 4 つ）でちょうど上の階（2026-10-15）
const FLOORS = ['foundation', 'triangle', 'stoneFoundation', 'brickFoundation', 'raft', 'raftCore', 'upperFloor'];
const RAFT_FLOORS = ['raft', 'raftCore'];
const WALLS = ['wall', 'diagWall', 'halfWall', 'stoneWall', 'brickWall'];

// 床: 下に暗い台、上に幅 0.25m の板（間をわずかにあける）。strip(x0, x1) は板1枚の形
function floorGeo(r, base, strip) {
  const parts = [shape(prism(base, -0.25, -0.05), P.wood[0], r)];
  for (let i = 0; i < 4; i++) {
    const x0 = -0.5 + i * 0.25 + 0.0075, x1 = x0 + 0.235;
    parts.push(shape(prism(strip(x0, x1), -0.06, 0), board(r), r, { jit: 0.003 }));
  }
  return merge(parts);
}
// 壁: 幅 0.25m 前後の縦板と、上下の横木
function wallGeo(r, x0, x1) {
  const n = Math.max(1, Math.round((x1 - x0) / 0.25)), w = (x1 - x0) / n;
  const parts = [];
  for (let i = 0; i < n; i++) parts.push(shape(box(w - 0.015, WALL_H - 0.2, 0.12, x0 + w * (i + 0.5), WALL_H / 2, 0), board(r), r, { jit: 0.003 }));
  parts.push(shape(box(x1 - x0, 0.1, 0.15, (x0 + x1) / 2, 0.05, 0), P.wood[1], r));
  parts.push(shape(box(x1 - x0, 0.1, 0.15, (x0 + x1) / 2, WALL_H - 0.05, 0), P.wood[1], r));
  return merge(parts);
}

// 階段: 1m 四方、-z の向きに上る。段の高さ 0.25m。
function stairsGeo(r, rise) {
  const n = Math.round(rise / 0.25), d = 1 / n, parts = [];
  for (let k = 0; k < n; k++) {
    const z1 = 0.5 - k * d, z0 = z1 - d, top = (k + 1) * 0.25;
    parts.push(shape(box(1, top - 0.05, d, 0, (top - 0.05) / 2, (z0 + z1) / 2), P.wood[1], r));       // 段の本体
    parts.push(shape(box(0.98, 0.05, d - 0.01, 0, top - 0.025, (z0 + z1) / 2), board(r), r, { jit: 0.003 })); // 踏み板
  }
  return merge(parts);
}
const stairsShapes = (rise) => {
  const n = Math.round(rise / 0.25), d = 1 / n;
  return Array.from({ length: n }, (_, k) => ({ poly: rect(-0.5, 0.5, 0.5 - (k + 1) * d, 0.5 - k * d), y: [0, (k + 1) * 0.25] }));
};
// 屋根: 1m 四方、-z の向きに rise だけ高くなる。わらのふき板を3枚、少しずつ重ねる。
function roofGeo(r, rise) {
  const L = Math.hypot(1, rise), th = Math.atan2(rise, 1), parts = [];
  for (let k = 0; k < 3; k++) {
    const g = box(1.02, 0.07, L / 3 + 0.06, 0, 0.05 + (k % 2) * 0.012, L / 2 - (k + 0.5) * (L / 3));
    g.rotateX(th);
    g.translate(0, rise / 2, 0); // 低い辺が y=0、z=+0.5 に来る
    parts.push(shape(g, (fc) => (fc.ny < 0 ? P.straw[0] : pick(r, [P.straw[1], P.straw[2]])), r, { jit: 0.004 }));
  }
  return merge(parts);
}

// floor: 床の仲間 / grounded: 足で地面に支えられる / edge: 吸い付く辺の長さ（'half' は辺の半分）
// corner: 床の角に吸い付く / restsOn: 支えてくれるパーツ / ignores: 重なってもよいパーツ
// shapes: 形が複数のとき（階段の段など） / foot: 足をつける形 / rise: 上がる高さ
// stairs・roof: 階段・屋根の仲間 / touch: 接しているだけで支えになる / noCollide: 当たり判定なし
// furniture: 家具（床の上か地面に置く。足なし） / fire: 炎と光を付ける / store: しまえるマスの数
// upper: 床（2 階。壁・柱の上か床の辺に吸い付き、足なし。building.md「床（2 階）」）
// raft: いかだの床の仲間 / core: いかだのコア（水の上に置くと新しいいかだ。physics.md「いかだ」） / onRaft: いかだの床の上にだけ置ける
// sail: 帆（panel が布。開くと張る） / helm: 舵 / boat: 小舟（水の上に置くと物理で浮く乗り物）
export const PARTS = {
  foundation: {
    name: '土台', rotStep: 2, floor: true, grounded: true,
    shape: { poly: SQ, y: FLOOR_Y },
    build: (r) => floorGeo(r, SQ, (x0, x1) => rect(x0, x1, -0.5, 0.5)),
  },
  triangle: {
    name: '三角の床', rotStep: 2, floor: true, grounded: true,
    shape: { poly: TRI, y: FLOOR_Y },
    build: (r) => floorGeo(r, TRI, (x0, x1) => [[x0, -0.5], [x1, -0.5], [x1, -x1], [x0, -x0]]),
  },
  upperFloor: {
    name: '床', rotStep: 2, floor: true, upper: true, touch: true, restsOn: [...WALLS, 'pillar', 'door', 'window', ...FLOORS], ignores: ['pillar'],
    shape: { poly: SQ, y: FLOOR_Y },
    build: (r) => floorGeo(r, SQ, (x0, x1) => rect(x0, x1, -0.5, 0.5)),
  },
  wall: {
    name: '壁', rotStep: 1, edge: 1, restsOn: FLOORS,
    shape: { poly: rect(-0.5, 0.5, -WALL_T, WALL_T), y: [0, WALL_H] },
    build: (r) => wallGeo(r, -0.5, 0.5),
  },
  diagWall: {
    name: '斜めの壁', hidden: true, rotStep: 1, edge: SQRT2, restsOn: ['triangle'], // 選ばない。壁を 45 度回すとこれになる
    shape: { poly: rect(-SQRT2 / 2, SQRT2 / 2, -WALL_T, WALL_T), y: [0, WALL_H] },
    build: (r) => wallGeo(r, -SQRT2 / 2, SQRT2 / 2),
  },
  halfWall: {
    name: '半分の壁', rotStep: 1, edge: 'half', restsOn: FLOORS,
    shape: { poly: rect(0, 0.5, -WALL_T, WALL_T), y: [0, WALL_H] },
    build: (r) => wallGeo(r, 0, 0.5),
  },
  pillar: {
    name: '柱', rotStep: 2, corner: true, restsOn: FLOORS, ignores: WALLS,
    shape: { poly: rect(-0.25, 0.25, -0.25, 0.25), y: [0, WALL_H] },
    build: (r) => merge([
      shape(box(0.36, WALL_H - 0.24, 0.36, 0, WALL_H / 2, 0), board(r), r, { jit: 0.004 }),
      shape(box(0.5, 0.12, 0.5, 0, 0.06, 0), P.wood[1], r),
      shape(box(0.5, 0.12, 0.5, 0, WALL_H - 0.06, 0), P.wood[1], r),
    ]),
  },
};
// ドア: 枠（左右の柱 0.1m と、上の板）と扉（幅 0.8m・高さ 1.8m、x=-0.4 が蝶番）
const DOOR_H = 1.8;
const doorFrameGeo = (r) => merge([
  shape(box(0.1, WALL_H, 0.15, -0.45, WALL_H / 2, 0), P.wood[1], r),
  shape(box(0.1, WALL_H, 0.15, 0.45, WALL_H / 2, 0), P.wood[1], r),
  shape(box(0.8, WALL_H - DOOR_H, 0.12, 0, (WALL_H + DOOR_H) / 2, 0), board(r), r, { jit: 0.003 }),
]);
const doorPanelGeo = (r) => { // 蝶番 (x=0) から +x に伸びる
  const parts = [];
  for (let i = 0; i < 3; i++) parts.push(shape(box(0.255, DOOR_H - 0.02, 0.08, 0.135 + i * 0.265, DOOR_H / 2, 0), board(r), r, { jit: 0.003 }));
  parts.push(shape(box(0.1, 0.1, 0.16, 0.66, 0.9, 0), P.wood[0], r)); // 取っ手
  return merge(parts);
};
// 窓: 下の壁、上の壁、左右の壁、窓枠（穴は x -0.3〜0.3、y 0.8〜1.5）
const WIN = [0.8, 1.5];
function windowGeo(r) {
  const parts = [], [a, b] = WIN;
  for (let i = 0; i < 4; i++) {
    const x = -0.375 + i * 0.25;
    parts.push(shape(box(0.235, a - 0.05, 0.12, x, (a + 0.05) / 2, 0), board(r), r, { jit: 0.003 }));
    parts.push(shape(box(0.235, WALL_H - b - 0.05, 0.12, x, (WALL_H + b - 0.05) / 2, 0), board(r), r, { jit: 0.003 }));
  }
  for (const s of [-1, 1]) parts.push(shape(box(0.2, b - a, 0.12, s * 0.4, (a + b) / 2, 0), board(r), r, { jit: 0.003 }));
  parts.push(shape(box(0.8, 0.1, 0.18, 0, a, 0), P.wood[0], r)); // 窓枠の下
  parts.push(shape(box(0.8, 0.1, 0.18, 0, b, 0), P.wood[0], r)); // 窓枠の上
  for (const s of [-1, 1]) parts.push(shape(box(0.1, b - a, 0.18, s * 0.35, (a + b) / 2, 0), P.wood[0], r)); // 窓枠の横
  parts.push(shape(box(1, 0.1, 0.15, 0, 0.05, 0), P.wood[1], r));
  parts.push(shape(box(1, 0.1, 0.15, 0, WALL_H - 0.05, 0), P.wood[1], r));
  return merge(parts);
}
const wallBand = (x0, x1, y0, y1, extra = {}) => ({ poly: rect(x0, x1, -WALL_T, WALL_T), y: [y0, y1], ...extra });

const ROOF_ON = ['wall', 'stoneWall', 'brickWall', 'door', 'window', 'pillar', 'roof', 'steepRoof'];
Object.assign(PARTS, {
  stairs: {
    name: 'ゆるい階段', rotStep: 2, grounded: true, stairs: true, rise: 0.5, foot: SQ,
    shapes: stairsShapes(0.5), build: (r) => stairsGeo(r, 0.5),
  },
  steepStairs: {
    name: '急な階段', rotStep: 2, grounded: true, stairs: true, rise: 1, foot: SQ,
    shapes: stairsShapes(1), build: (r) => stairsGeo(r, 1),
  },
  roof: {
    name: 'ゆるい屋根', rotStep: 2, roof: true, rise: 0.5, restsOn: ROOF_ON, touch: true, noCollide: true,
    shape: { poly: SQ, y: [0, 0.6] }, build: (r) => roofGeo(r, 0.5),
  },
  steepRoof: {
    name: '急な屋根', rotStep: 2, roof: true, rise: 1, restsOn: ROOF_ON, touch: true, noCollide: true,
    shape: { poly: SQ, y: [0, 1.1] }, build: (r) => roofGeo(r, 1),
  },
});
Object.assign(PARTS, {
  door: {
    name: 'ドア', rotStep: 1, edge: 1, restsOn: FLOORS,
    // 最後の形が扉（開いているときは当たり判定なし）
    shapes: [wallBand(-0.5, -0.4, 0, WALL_H), wallBand(0.4, 0.5, 0, WALL_H), wallBand(-0.4, 0.4, DOOR_H, WALL_H), wallBand(-0.4, 0.4, 0, DOOR_H, { panel: true })],
    build: (r) => merge([doorFrameGeo(r), (() => { const g = doorPanelGeo(r); g.translate(-0.4, 0, 0); return g; })()]),
    frame: doorFrameGeo, panel: doorPanelGeo, hinge: -0.4,
  },
  window: {
    name: '窓', rotStep: 1, edge: 1, restsOn: FLOORS,
    shapes: [wallBand(-0.5, 0.5, 0, WIN[0]), wallBand(-0.5, 0.5, WIN[1], WALL_H), wallBand(-0.5, -0.3, ...WIN), wallBand(0.3, 0.5, ...WIN)],
    build: windowGeo,
  },
});
// 石のパーツと家具（ステップ6）
Object.assign(PARTS, {
  stoneFoundation: { name: '石の土台', rotStep: 2, floor: true, grounded: true, shape: { poly: SQ, y: FLOOR_Y }, build: stoneFloorGeo },
  stoneWall: { name: '石の壁', rotStep: 1, edge: 1, restsOn: FLOORS, shape: { poly: rect(-0.5, 0.5, -WALL_T, WALL_T), y: [0, WALL_H] }, build: stoneWallGeo },
  brickFoundation: { name: 'レンガの土台', rotStep: 2, floor: true, grounded: true, shape: { poly: SQ, y: FLOOR_Y }, build: brickFloorGeo },
  brickWall: { name: 'レンガの壁', rotStep: 1, edge: 1, restsOn: FLOORS, shape: { poly: rect(-0.5, 0.5, -WALL_T, WALL_T), y: [0, WALL_H] }, build: brickWallGeo },
  raftCore: {
    name: 'いかだのコア', rotStep: 2, floor: true, raft: true, core: true,
    shape: { poly: SQ, y: FLOOR_Y }, build: raftCoreGeo,
  },
  raft: { name: 'いかだの床', rotStep: 2, floor: true, raft: true, shape: { poly: SQ, y: FLOOR_Y }, build: raftFloorGeo },
}, furnitureParts(FLOORS), automationParts(FLOORS));
// いかだを動かすパーツと小舟（physics.md「いかだを動かす」「小舟」）
Object.assign(PARTS, {
  sail: {
    name: '帆', furniture: true, onRaft: true, sail: true, rotStep: 1, restsOn: RAFT_FLOORS,
    shape: { poly: rect(-0.1, 0.1, -0.1, 0.1), y: [0, 2.9] }, // 当たり判定は柱だけ
    build: sailGeo, frame: sailFrameGeo, panel: sailClothGeo, hinge: 0, hingeY: SAIL_TOP,
  },
  helm: { name: '舵', furniture: true, onRaft: true, helm: true, rotStep: 1, restsOn: RAFT_FLOORS, shape: { poly: rect(-0.3, 0.3, -0.3, 0.3), y: [0, 1.2] }, build: helmGeo },
  // 小舟: 当たり判定は高くして、歩いて乗り上げられないようにする（右クリックで座る）
  boat: { name: '小舟', boat: true, rotStep: 2, shape: { poly: [[-1.75, -0.7], [0.9, -0.7], [1.75, 0], [0.9, 0.7], [-1.75, 0.7]], y: [0, 2] }, build: boatGeo },
});

export const PART_LIST = Object.keys(PARTS).filter((t) => !PARTS[t].hidden); // 選べるパーツ

// 置くのに必要な素材（docs/rules/building.md）。撤去すると半分（切り捨て）戻る
export const COSTS = {
  foundation: { wood: 4 }, triangle: { wood: 2 }, upperFloor: { wood: 3 }, wall: { wood: 3 }, diagWall: { wood: 4 }, halfWall: { wood: 2 }, pillar: { wood: 2 },
  stairs: { wood: 3 }, steepStairs: { wood: 4 }, roof: { wood: 1, stick: 3 }, steepRoof: { wood: 1, stick: 3 },
  door: { wood: 4, stone: 1 }, window: { wood: 3, glass: 2 },
  stoneFoundation: { stone: 6 }, stoneWall: { stone: 5 },
  brickFoundation: { brick: 4 }, brickWall: { brick: 3 }, raft: { bamboo: 3, rope: 1 }, raftCore: { wood: 12, bamboo: 10, rope: 6, stone: 6 },
  sail: { wood: 4, fiber: 8, rope: 2 }, helm: { wood: 5, rope: 2 }, boat: { wood: 10, rope: 3 },
  workbench: { wood: 10, stone: 6 }, campfire: { stick: 6, stone: 6, flint: 1 }, chest: { wood: 8, rope: 2 }, purifier: { bamboo: 4, clay: 5, stone: 6 }, furnace: { stone: 16, brick: 8 }, planter: { wood: 4, soil: 4 }, bed: { wood: 4, fiber: 6, palmLeaf: 3 }, ...AUTO_COSTS,
};
export const localShapes = (def) => def.shapes || [def.shape];

// 形は種類ごとに1回だけ作って使い回す
const geoCache = {};
export function partGeometry(type, which = 'build') {
  const k = type + ':' + which;
  if (!geoCache[k]) geoCache[k] = PARTS[type][which](rng(type.length * 977));
  return geoCache[k];
}

// プレビュー用の半透明の材質
export const PREVIEW_MAT = {
  ok: new THREE.MeshBasicMaterial({ color: P.ui.ok, transparent: true, opacity: 0.45, depthWrite: false }),
  ng: new THREE.MeshBasicMaterial({ color: P.ui.ng, transparent: true, opacity: 0.45, depthWrite: false }),
};
