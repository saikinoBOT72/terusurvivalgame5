// 自動化の建築パーツの定義（automation.md）: 機械は家具と同じく地面に置き、R で 90 度ずつ向ける（rotStep 2）
// use / gen: 電気を使う・出す量。wirePts: 電線をつなぐ碍子のてっぺん（ローカル座標）。maxWires: つなげる線の数
import { rng } from '../style/lowpoly.js';
import { drillGeo, generatorGeo, windmillGeo, poleGeo, smelterGeo, benchGeo, beltGeo } from './machineShapes.js';

const rect = (x0, x1, z0, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const memo = (fn) => { let v; return () => (v ??= fn(rng(2026))); }; // 形は 1 回だけ作る（動く部分も同じ物を使う）
export const machineGeos = {
  drill: memo(drillGeo), generator: memo(generatorGeo), windmill: memo(windmillGeo), autoFurnace: memo(smelterGeo), autoBench: memo(benchGeo),
};

export function automationParts(floors) {
  const m = { furniture: true, machine: true, rotStep: 2, restsOn: floors, maxWires: 4 };
  const sq = rect(-0.5, 0.5, -0.5, 0.5);
  return {
    generator: { ...m, name: '発電機', bp: 'generator', gen: 20, wirePts: [[0.27, 0.75, 0.02], [0.39, 0.75, 0.02]], shape: { poly: sq, y: [0, 1.2] }, build: () => machineGeos.generator().body },
    windmill: { ...m, name: '風車', bp: 'windmill', gen: 4, wirePts: [[0.18, 0.27, -0.3], [0.3, 0.27, -0.3]], shape: { poly: sq, y: [0, 4] }, build: () => machineGeos.windmill().body },
    pole: { ...m, name: '電柱', bp: 'generator', maxWires: 6, wirePts: [[-0.3, 2.93, 0], [0.3, 2.93, 0]], shape: { poly: rect(-0.125, 0.125, -0.125, 0.125), y: [0, 3] }, build: (r) => poleGeo(r) },
    drill: { ...m, name: '電動ドリル', bp: 'drill', use: 10, onBed: true, wirePts: [[-0.08, 1.38, 0], [0.08, 1.38, 0]], shape: { poly: sq, y: [0, 1.5] }, build: () => machineGeos.drill().body },
    autoFurnace: { ...m, name: '自動炉', bp: 'autoFurnace', use: 8, wirePts: [[-0.46, 0.56, 0.07], [-0.38, 0.56, 0.13]], shape: { poly: sq, y: [0, 1.4] }, build: () => machineGeos.autoFurnace().body },
    autoBench: { ...m, name: '自動作業台', bp: 'autoBench', use: 6, wirePts: [[0.29, 0.99, -0.36], [0.39, 0.99, -0.36]], shape: { poly: sq, y: [0, 1] }, build: () => machineGeos.autoBench().body },
    belt: { ...m, name: 'ベルト', bp: 'belt', maxWires: 0, belt: true, shape: { poly: rect(-0.25, 0.25, -0.25, 0.25), y: [0, 0.25] }, build: beltGeo },
  };
}

// 置くのに必要な素材（automation.md「コストと設計図」）
export const AUTO_COSTS = {
  generator: { ironIngot: 6, copperWire: 6, screw: 4, brick: 4 },
  pole: { wood: 3, copperWire: 1 },
  windmill: { wood: 10, scrap: 6, copperWire: 4, screw: 3 },
  drill: { ironIngot: 6, copperWire: 4, screw: 6, scrap: 4 },
  autoFurnace: { stone: 12, brick: 8, copperWire: 6, ironIngot: 2 },
  autoBench: { wood: 8, ironIngot: 4, copperWire: 4, screw: 4 },
  belt: { wood: 1, rope: 1 },
};
