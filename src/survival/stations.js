// 設備の中身と動き（docs/rules/survival.md「設備の窓と燃料」、ui.md「設備の窓」）
// どの設備も中身を part.slots（{ id, n } か null の配列）に持つ。スロットの意味は STATIONS の表 1 つで決める
// （窓 stationHud.js も、あとで作る機械やベルトも、この表を見て同じスロットに出し入れする）
// lanes: [入れる番号, 出る番号] の組（1 つずつ作る列）。fuel: 燃料のスロット番号。fuels: 燃料 1 つで燃える秒
// part.burn: 今の燃料の残り秒、part.prog: 列ごとの進み（秒）、part.burning: いま燃えている（動いている）か
import * as THREE from 'three';
import { rng, makeMesh } from '../style/lowpoly.js';
import { campfire } from '../world/props.js';
import { purifierWater, purifierWaterY, FURNACE_FIRE } from '../build/furniture.js';
import { itemGeometry } from './itemShapes.js';
import { ITEMS } from './items.js';

const COOK = { berry: 'cookedBerry', mushroom: 'cookedMushroom', egg: 'cookedEgg', fish: 'cookedFish', potato: 'cookedPotato', shell: 'cookedShell', clay: 'brick' };
const SMELT = { copperOre: ['copperIngot', 1], ironOre: ['ironIngot', 1], scrap: ['ironIngot', 2] }; // [できる物, 入れる数]

// recipe(id): 入れる物 id から { out, need, time }（作れなければ null）
export const STATIONS = {
  campfire: {
    name: 'たき火', slots: ['in', 'out', 'in', 'out', 'fuel'], lanes: [[0, 1], [2, 3]], fuel: 4, fuels: { stick: 20 },
    recipe: (id) => (COOK[id] ? { out: COOK[id], need: 1, time: id === 'clay' ? 20 : 12 } : null),
  },
  furnace: {
    name: '炉', slots: ['in', 'out', 'fuel'], lanes: [[0, 1]], fuel: 2, fuels: { coal: 90, stick: 10 },
    recipe: (id) => (SMELT[id] ? { out: SMELT[id][0], need: SMELT[id][1], time: 30 } : null),
  },
  purifier: {
    name: '浄水器', slots: ['in', 'out'], lanes: [[0, 1]],
    recipe: (id) => (id === 'tubeSea' ? { out: 'tubeFresh', need: 1, time: 60 } : null),
  },
  chest: { name: 'チェスト', slots: Array(12).fill('store') },
  workbench: { name: '作業台', slots: [], recipes: 'workbench' }, // 作業台で作るレシピ（items.js の station）
};
export const stationOf = (part) => (part && STATIONS[part.type]) || null;

// そのスロットに id を入れられるか（出るスロットには入れられない）
export function accepts(type, i, id) {
  const S = STATIONS[type], role = S?.slots[i];
  if (role === 'store') return true;
  if (role === 'fuel') return !!S.fuels[id];
  if (role === 'in') return !!S.recipe(id);
  return false;
}

// 置いたときに呼ぶ: 中身と、燃えているときの見た目（火）を用意する
export function initStation(part, def) {
  const S = STATIONS[part.type];
  if (!S) return;
  part.slots = part.store ?? Array(S.slots.length).fill(null); // チェストは part.store がそのまま中身
  part.burn = 0;
  part.prog = (S.lanes ?? []).map(() => 0);
  part.burning = false;
  if (part.type === 'furnace') { // 薪の上で燃える
    part.fire = campfire(rng(11), { base: false });
    part.fire.root.scale.setScalar(0.45);
    part.fire.root.position.set(0, FURNACE_FIRE.y, FURNACE_FIRE.z);
    part.mesh.add(part.fire.root);
  }
  if (part.type === 'purifier') { // 動いている間だけ、石の間で小さく燃える。受け皿の水
    part.fire = campfire(rng(7), { base: false });
    part.fire.root.scale.setScalar(0.4);
    part.fire.root.position.y = 0.04;
    part.water = makeMesh(purifierWater(rng(9)), { shadow: false });
    part.water.visible = false;
    part.mesh.add(part.fire.root, part.water);
  }
  if (part.type === 'campfire') { // 焼いている物を石の輪の上に見せる
    part.cookRoot = new THREE.Group();
    part.mesh.add(part.cookRoot);
  }
  if (part.fire) part.fire.root.visible = false;
  showContents(part);
}

const SPOTS = [[0.25, 0.22], [-0.25, -0.22]]; // たき火で焼く物を置く所（列ごと）
function showContents(part) {
  const S = STATIONS[part.type];
  if (part.cookRoot) {
    part.cookRoot.clear();
    S.lanes.forEach(([a, b], k) => {
      const s = part.slots[a] ?? part.slots[b];
      if (!s) return;
      const m = makeMesh(itemGeometry(s.id), { shadow: false });
      m.scale.setScalar(0.55);
      m.position.set(SPOTS[k][0], 0.2, SPOTS[k][1]);
      m.rotation.y = k * 1.7;
      part.cookRoot.add(m);
    });
  }
  if (part.water) { // 受け皿の水: 真水の竹筒の数で水位
    const n = part.slots[1]?.n ?? 0;
    part.water.visible = n > 0;
    part.water.position.y = purifierWaterY(n / ITEMS.tubeFresh.stack);
  }
}

// その列が動けるか: 入れる物が足り、出るスロットに入る
function laneReady(part, S, [a, b]) {
  const s = part.slots[a], rc = s && S.recipe(s.id);
  if (!rc || s.n < rc.need) return null;
  const o = part.slots[b];
  if (o && (o.id !== rc.out || o.n >= ITEMS[rc.out].stack)) return null;
  return rc;
}

// 時間を進める（遊んでいる間だけ呼ぶ）。中身が変わったら true
export function tickStation(part, dt) {
  const S = STATIONS[part.type];
  if (!S?.lanes) return false;
  const ready = S.lanes.map((ln) => laneReady(part, S, ln));
  let changed = false;
  if (ready.some(Boolean) && S.fuel !== undefined && part.burn <= 0) { // 燃料を 1 つくべる
    const f = part.slots[S.fuel];
    if (f && S.fuels[f.id]) {
      part.burn += S.fuels[f.id];
      if (!--f.n) part.slots[S.fuel] = null;
      changed = true;
    }
  }
  part.burning = ready.some(Boolean) && (S.fuel === undefined || part.burn > 0);
  if (part.burning) {
    if (S.fuel !== undefined) part.burn = Math.max(0, part.burn - dt);
    S.lanes.forEach(([a, b], k) => {
      const rc = ready[k];
      if (!rc || (part.prog[k] += dt) < rc.time) return;
      part.prog[k] = 0;
      const s = part.slots[a];
      if (!(s.n -= rc.need)) part.slots[a] = null;
      if (part.slots[b]) part.slots[b].n++; else part.slots[b] = { id: rc.out, n: 1 };
      changed = true;
    });
  }
  if (part.fire) part.fire.root.visible = part.burning; // 炎の有無で燃えているかが分かる
  if (changed) showContents(part);
  return changed;
}

// 窓などで中身を変えたあとに呼ぶ（見た目を直す）
export const stationChanged = (part) => showContents(part);

// セーブ: 中身と燃え残り、進み。チェストは store に入っているので省く
export const stationData = (p) => (STATIONS[p.type]?.lanes ? { slots: p.slots, burn: p.burn || undefined, prog: p.prog.some(Boolean) ? p.prog : undefined } : {});
export function loadStation(part, d) {
  if (!part.slots || !d.slots) return;
  d.slots.forEach((s, i) => { part.slots[i] = s; });
  part.burn = d.burn ?? 0;
  if (d.prog) part.prog = d.prog;
  showContents(part);
}

// 撤去したとき中の物を返す: [[id, n], ...]（チェストの中身も。燃えている途中の燃料は戻らない）
export const stationRefund = (part) => (part.slots ?? []).filter(Boolean).map((s) => [s.id, s.n]);
