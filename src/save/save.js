// セーブ（docs/rules/survival.md「セーブ」）: ブラウザの localStorage に 1 つだけ保存する
// 島は名前から同じ形に作れるので、島そのものは保存しない。変えた所（消えた物・落とした袋・苗木）、建てた物、乗り物、持ち物、時刻、HP、いる場所を保存する
import { loadStation, stationData } from '../survival/stations.js';
import { loadPlanter, planterData } from '../survival/farm.js';
import { placeDrop, dropGeometry } from '../survival/death.js';
import { REMOVED, ITEMS } from '../survival/items.js';
import { takeKeys } from '../survival/keyItems.js';

// VERSION 3（2026-10-16）: 島がランダムから固定の「墜落島」になった。前のセーブ（別の島）は読まない
// VERSION 4（2026-10-17）: 墜落島にスポットが入り、島の物の並び（消えた物の番号）が変わった。前のセーブは読まない
// VERSION 5（2026-10-19）: 鉱石の密集地と自然湧き（段階 6）で島の物の並びが変わった。4 は持ち物・建物・箱・大事な物・時刻を読み、島の状態（消えた物・倒した敵）は捨てる
// VERSION 6（2026-10-21）: 自動化（機械の向き・中身、電線、ベルトの上の物）が入った。島の物の並びは 5 と同じなので、5 は島の状態も読む（線・ベルトの欄は省いてよい）
const KEY = 'oasobi5.save', VERSION = 6, KEEP_FROM = 4, SAME_FROM = 5; // KEEP_FROM: ここから前の版でも、島の状態のほかは読む

export function hasSave() {
  return !!readSave(); // 前の島のセーブは「つづきから」に出さない
}
export function readSave() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    return d?.v >= KEEP_FROM && d.v <= VERSION ? d : null;
  } catch { return null; }
}

// 建てたパーツ（島と乗り物で共通）。open: 帆を張っている・ドアが開いている
const partData = (p) => ({ type: p.type, i: p.i, rot: p.rot, y: p.y, store: p.store, ...stationData(p), ...planterData(p), open: p.open || undefined, item: p.item ? { id: p.item.id, t: +p.item.t.toFixed(2) } : undefined });
function addPart(st, x, keys) {
  const p = st.add(x.type, x.i, x.rot, x.y === undefined ? {} : { y: x.y });
  if (x.store) x.store.forEach((s, i) => { p.store[i] = s; }); // 中身の配列は設備のスロットと同じ物なので、入れかえずに写す
  if (p.store) takeKeys(p.store, keys, true); // 前のセーブの箱にあった設計図は大事な物へ
  loadStation(p, x);
  loadPlanter(p, x);
  if (x.item) st.auto.belts.load(p, x.item); // ベルトの上の物
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
    keys: g.keyItems.save(), // 大事な物（設計図など）
    equip: g.equip.save(), // 装備の枠
    mobs: g.spawner?.save(), // 倒したいつもいる敵（islands.md「敵の出方」）
    time: { day: time.state.day, sec: time.state.sec },
    stats: { hp: stats.state.hp, food: stats.state.food, water: stats.state.water },
    player: { x: s.x, y: s.y, z: s.z, yaw: s.yaw, pitch: s.pitch, ride },
    inventory: { slots: inventory.slots, sel: inventory.sel },
    hidden: island.resources.hidden(),
    drops: island.resources.entries().filter((e) => e.store && e.ready && !island.resources.base.includes(e)).map((e) => ({ kind: e.kind, x: e.x, y: e.y, z: e.z, store: e.store })),
    planting: island.planting.save(),
    parts: st.list.map(partData),
    wires: st.wires.save(st.list), // 電線（つないだ 2 つの番号）
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
  // 大事な物: 前のセーブは、読んだ設計図の名前（blueprints）と、持ち物・箱・落とし物にある設計図を移す
  g.keyItems.load(d.keys ?? Object.keys(ITEMS).filter((id) => ITEMS[id].bp && d.blueprints?.includes(ITEMS[id].bp)));
  g.equip.load(d.equip);
  const same = d.v >= SAME_FROM; // 前の版: 島の物の番号が違うので、消えた物・倒した敵は戻さない
  g.spawner?.load(same ? d.mobs : null);
  if (same) island.restoreHidden(d.hidden);
  island.planting.load(d.planting);
  const vs = island.vehicles, made = []; // 乗り物は落ちた物より先に（上に乗っていた物が落ちないように）
  for (const x of d.vehicles ?? []) {
    if (!vs) break;
    if (x.kind === 'raft' && !x.parts.some((q) => q.type === 'raftCore')) { // コアより前のセーブ: 最初の床をコアにする
      const f = x.parts.find((q) => q.type === 'raft');
      if (f) f.type = 'raftCore';
    }
    const v = vs.create(x.x, x.z, x.yaw, x.kind);
    for (const q of x.parts) addPart(v.st, q, g.keyItems);
    made.push(v);
  }
  for (const x of d.drops) {
    x.store = x.store.filter((s) => s && !REMOVED.has(s.id));
    takeKeys(x.store, g.keyItems, true);
    x.store = x.store.filter(Boolean);
    if (!x.store.length) continue;
    placeDrop(island, x.store, x.x, x.y, x.z, x.kind === 'bag' ? { kind: 'bag' } : { kind: 'drop', geo: dropGeometry(x.store[0].id) });
  }
  for (const x of d.parts) addPart(st, x, g.keyItems);
  st.wires.load(d.wires, st.list);
  inventory.slots.splice(0, inventory.slots.length, ...d.inventory.slots.map((s) => (s && REMOVED.has(s.id) ? null : s))); // 長さは保存した広さ（前のセーブは 24 マス）
  takeKeys(inventory.slots, g.keyItems, true);
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
