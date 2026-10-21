// 機械の向きと口のマス（automation.md「機械の向きと口」「ベルトコンベア」）
// ベルトは 0.5m のマス。向き dir は 0〜3（0 = +z, 1 = +x, 2 = -z, 3 = -x）。機械の向き rot は建築の 0〜7 のうち偶数だけ（dir = rot / 2）
// 機械のローカルは machineParts.js と同じ: 前（出す側）が +z、入れる口は x = -0.25、出す口は x = +0.25
import { BELT_Y, OUT_X, IN_X } from './machineParts.js';

export const CELL = 0.5;
export const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // dir → (x, z) の進む向き
export const BELT_STEP = 0.5; // ベルトと口の高さの差の上限（m）
export const opposite = (dir) => (dir + 2) % 4;

// 建築の向き rot（0〜7）→ dir。45 度の向きは null（口は使えない）
export const dirOfRot = (rot) => (rot % 2 === 0 ? (rot / 2) % 4 : null);

export const cellOf = (x, z) => [Math.floor(x / CELL), Math.floor(z / CELL)];
export const cellCenter = ([ix, iz]) => ({ x: (ix + 0.5) * CELL, z: (iz + 0.5) * CELL });
export const cellKey = ([ix, iz]) => `${ix},${iz}`;
export const nextCell = ([ix, iz], dir) => [ix + DIRS[dir][0], iz + DIRS[dir][1]];

// 機械ごとの大きさ（半幅 x・半奥行き z）と口。口は { x, z, n } = 辺の上の点と外向きの法線（ローカル）
const SQ = [0.5, 0.5];
const front = (x) => ({ x, z: 0.5, n: [0, 1] });
const back = (x) => ({ x, z: -0.5, n: [0, -1] });
export const MACHINES = {
  generator: { half: SQ, ins: [back(IN_X)], outs: [] },
  windmill: { half: SQ, ins: [], outs: [] },
  pole: { half: [0.125, 0.125], ins: [], outs: [] },
  drill: { half: SQ, ins: [], outs: [front(OUT_X)] },
  autoFurnace: { half: SQ, ins: [back(IN_X)], outs: [front(OUT_X)] },
  autoBench: { half: SQ, ins: [back(IN_X)], outs: [front(OUT_X)] },
  // チェスト（1m × 0.5m）: 4 面どこからでも入る。辺の上を 0.125 ずらした 2 点を見て、またがる 2 マスとも口にする
  chest: {
    half: [0.5, 0.25],
    ins: [[1, 0], [-1, 0]].flatMap(([nx]) => [-0.125, 0.125].map((z) => ({ x: nx * 0.5, z, n: [nx, 0] })))
      .concat([[0, 1], [0, -1]].flatMap(([, nz]) => [-0.125, 0.125].map((x) => ({ x, z: nz * 0.25, n: [0, nz] })))),
    outs: [],
  },
};

// ローカル → 世界（建築の makeShape と同じ回し方）
const toWorld = (pos, rot, x, z) => {
  const a = (rot * Math.PI) / 4, c = Math.cos(a), s = Math.sin(a);
  return [pos.x + x * c + z * s, pos.z - x * s + z * c];
};
const dirOfNormal = (rot, [nx, nz]) => { // ローカルの法線 → 世界の dir
  const [wx, wz] = [nx * Math.cos((rot * Math.PI) / 4) + nz * Math.sin((rot * Math.PI) / 4), -nx * Math.sin((rot * Math.PI) / 4) + nz * Math.cos((rot * Math.PI) / 4)];
  return DIRS.findIndex(([dx, dz]) => Math.abs(dx - wx) < 0.01 && Math.abs(dz - wz) < 0.01);
};

// 口のマス。in: ベルトが machine へ向かって流れ込むマス（dir は流れる向き）、out: machine から出た物を受けるマス（dir は machine から離れる向き）
// 戻り値の cell は口の外側のマス。同じマスは 1 つにまとめる。45 度の向きは口なし
export function portsOf(type, pos, rot) {
  const def = MACHINES[type], none = { in: [], out: [], y: pos.y };
  if (!def || dirOfRot(rot) === null) return none;
  const make = (list, inward) => {
    const seen = new Set(), res = [];
    for (const p of list) {
      const out = dirOfNormal(rot, p.n);
      const [fx, fz] = toWorld(pos, rot, p.x, p.z), [dx, dz] = DIRS[out];
      // 辺の外へ: 辺がマスの線の上なら、すぐ外のマスの真ん中。辺がマスの真ん中へ食い込む物（チェストの短い辺）は、体の外の最初のマス
      const beyond = (c, d) => (d > 0 ? Math.ceil(c / CELL - 1e-6) * CELL + CELL / 2 : Math.floor(c / CELL + 1e-6) * CELL - CELL / 2);
      const x = dx ? beyond(fx, dx) : fx, z = dz ? beyond(fz, dz) : fz;
      const cell = cellOf(x, z), key = cellKey(cell);
      if (seen.has(key)) continue;
      seen.add(key);
      res.push({ cell, dir: inward ? opposite(out) : out });
    }
    return res;
  };
  return { in: make(def.ins, true), out: make(def.outs, false), y: pos.y };
}

// 機械の体がふさぐマス（ベルトを置けない）。体の四角と重なるマス（辺で触れるだけは含めない）
export function bodyCells(type, pos, rot) {
  const def = MACHINES[type];
  if (!def) return [];
  const [hx, hz] = def.half, a = (rot * Math.PI) / 4, ca = Math.cos(a), sa = Math.sin(a);
  const r = Math.hypot(hx, hz), res = [];
  const [x0, z0] = cellOf(pos.x - r, pos.z - r), [x1, z1] = cellOf(pos.x + r, pos.z + r);
  for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
    const c = cellCenter([ix, iz]), dx = c.x - pos.x, dz = c.z - pos.z;
    const lx = dx * ca - dz * sa, lz = dx * sa + dz * ca; // 世界 → ローカル
    if (Math.abs(lx) < hx + CELL / 2 - 0.01 && Math.abs(lz) < hz + CELL / 2 - 0.01) res.push([ix, iz]);
  }
  return res;
}

// ベルト（向き beltDir）が口につながるか
export const feedsIn = (port, beltDir) => beltDir === port.dir;       // 機械へ流れ込む向きのベルト
export const takesOut = (port, beltDir) => beltDir !== opposite(port.dir); // 機械へ戻る向き以外のベルト
// 高さの差が 0.5m までなら口とベルトがつながる（machineY: 機械の置き場所の高さ、beltY: ベルトの置き場所の高さ）
export const heightOk = (machineY, beltY) => Math.abs(machineY - beltY) <= BELT_STEP;
export { BELT_Y };
