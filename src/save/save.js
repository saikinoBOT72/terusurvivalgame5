// セーブ（docs/rules/survival.md「セーブ」）: ブラウザの localStorage に 1 つだけ保存する
// 島は名前から同じ形に作れるので、島そのものは保存しない。変えた所（消えた物・落とした袋・苗木）、建てた物、乗り物、持ち物、時刻、HP、いる場所を保存する
import { loadStation, stationData } from '../survival/stations.js';
import { loadPlanter, planterData } from '../survival/farm.js';
import { placeDrop, dropGeometry } from '../survival/death.js';

// VERSION 3（2026-10-16）: 島がランダムから固定の「墜落島」になった。前のセーブ（別の島）は読まない
// VERSION 4（2026-10-17）: 墜落島にスポットが入り、島の物の並び（消えた物の番号）が変わった。前のセーブは読まない
const KEY = 'oasobi5.save', VERSION = 4;

export function hasSave() {
  return !!readSave(); // 前の島のセーブは「つづきから」に出さない
}
export function readSave() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    return d?.v === VERSION ? d : null;
  } catch { return null; }
}

// 建てたパーツ（島と乗り物で共通）。open: 帆を張っている・ドアが開いている
const partData = (p) => ({ type: p.type, i: p.i, rot: p.rot, y: p.y, store: p.store, ...stationData(p), ...planterData(p), open: p.open || undefined });
function addPart(st, x) {
  const p = st.add(x.type, x.i, x.rot, x.y === undefined ? {} : { y: x.y });
  if (x.store) x.store.forEach((s, i) => { p.store[i] = s; }); // 中身の配列は設備のスロットと同じ物なので、入れかえずに写す
  loadStation(p, x);
  loadPlanter(p, x);
  if (x.open) st.toggle(p);
}

// g: { islandId, island, structures, inventory, time, stats, player }
export function snapshot(g) {
  const { island, structures: st, inventory, time, stats, player } = g, s = player.state;
  const vs = island.vehicles?.list ?? [];
  // 舵を持っている・小舟に座っている: 乗り物と舵の番号
  const ride = s.ride && { v: vs.indexOf(s.ride.v), kind: s.ride.kind, part: s.ride.part ? s.ride.v.st.list.indexOf(s.ride.part) : -1 };
  return {
    v: VERSION,
    island: g.islandId,
    blueprints: g.blueprints.save(), // 読んだ設計図
    mobs: g.spawner?.save(), // 倒したいつもいる敵（islands.md「敵の出方」）
    time: { day: time.state.day, sec: time.state.sec },
    stats: { hp: stats.state.hp, food: stats.state.food, water: stats.state.water },
    player: { x: s.x, y: s.y, z: s.z, yaw: s.yaw, pitch: s.pitch, ride },
    inventory: { slots: inventory.slots, sel: inventory.sel },
    hidden: island.resources.hidden(),
    drops: island.resources.entries().filter((e) => e.store && e.ready && !island.resources.base.includes(e)).map((e) => ({ kind: e.kind, x: e.x, y: e.y, z: e.z, store: e.store })),
    planting: island.planting.save(),
    parts: st.list.map(partData),
    // 乗り物（physics.md）: 位置と向き、上のパーツ。小舟の傾きは保存しない
    vehicles: vs.map((v) => ({ kind: v.kind, x: v.shown.x, z: v.shown.z, yaw: v.shown.yaw, parts: v.st.list.map(partData) })),
  };
}

export function save(g) {
  try { localStorage.setItem(KEY, JSON.stringify(snapshot(g))); return true; } catch { return false; }
}

// 作り直した島（同じ名前）に、保存した状態を戻す。島の世界の建築 st は作ってあること
export function restore(d, g) {
  const { island, structures: st, inventory, time, stats, player } = g;
  g.blueprints.load(d.blueprints);
  g.spawner?.load(d.mobs);
  island.restoreHidden(d.hidden);
  island.planting.load(d.planting);
  const vs = island.vehicles, made = []; // 乗り物は落ちた物より先に（上に乗っていた物が落ちないように）
  for (const x of d.vehicles ?? []) {
    if (!vs) break;
    if (x.kind === 'raft' && !x.parts.some((q) => q.type === 'raftCore')) { // コアより前のセーブ: 最初の床をコアにする
      const f = x.parts.find((q) => q.type === 'raft');
      if (f) f.type = 'raftCore';
    }
    const v = vs.create(x.x, x.z, x.yaw, x.kind);
    for (const q of x.parts) addPart(v.st, q);
    made.push(v);
  }
  for (const x of d.drops) {
    placeDrop(island, x.store, x.x, x.y, x.z, x.kind === 'bag' ? { kind: 'bag' } : { kind: 'drop', geo: dropGeometry(x.store[0].id) });
  }
  for (const x of d.parts) addPart(st, x);
  inventory.slots.splice(0, inventory.slots.length, ...d.inventory.slots);
  inventory.select(d.inventory.sel);
  inventory.changed();
  time.state.day = d.time.day;
  time.state.sec = d.time.sec;
  stats.reset();
  Object.assign(stats.state, d.stats);
  const { ride, ...at } = d.player;
  Object.assign(player.state, at, { vy: 0 });
  const rv = ride && made[ride.v];
  if (rv) player.state.ride = { v: rv, kind: ride.kind, ...(ride.part >= 0 ? { part: rv.st.list[ride.part] } : {}) };
}
