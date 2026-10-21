// 機械の動き（automation.md「電気」「機械の動き」）: 毎フレーム、先に網ごとの出す量・使う量を決めてから、機械を動かす
// 使う量に入るのは、いま仕事がある機械だけ。足りなければ網の機械が全部止まる（進み具合は残る）
import { pivot } from './pivot.js';
import { PARTS } from '../build/parts.js';
import { STATIONS, laneReady, tickStation, stationChanged, benchNeed } from '../survival/stations.js';
import { ITEMS, RECIPES } from '../survival/items.js';
import { makeMesh } from '../style/lowpoly.js';
import { solveNets } from './power.js';
import { machineGeos } from './partDefs.js';
import { bedsOf, bedUnder } from './place.js';
import { makeShape } from '../build/grid.js';
import { createBelts } from './belts.js';
import { beltLegs } from './beltLegs.js';

export const DRILL_SECS = 40;
const COAL_SECS = 120, HIGH = 20;

// 出るスロットに id を n 個入れられるか
function roomFor(part, id, n = 1) {
  const S = STATIONS[part.type];
  return part.slots.some((s, i) => S.slots[i] === 'out' && (!s || (s.id === id && s.n + n <= ITEMS[id].stack)));
}
function addOut(part, id, n = 1) {
  const S = STATIONS[part.type], i = part.slots.findIndex((s, k) => S.slots[k] === 'out' && s?.id === id && s.n + n <= ITEMS[id].stack);
  const j = i >= 0 ? i : part.slots.findIndex((s, k) => S.slots[k] === 'out' && !s);
  if (part.slots[j]) part.slots[j].n += n; else part.slots[j] = { id, n };
}
const have = (part, id) => part.slots.reduce((t, s, i) => t + (STATIONS[part.type].slots[i] === 'in' && s?.id === id ? s.n : 0), 0);
function takeIn(part, id, n) {
  part.slots.forEach((s, i) => {
    if (!n || STATIONS[part.type].slots[i] !== 'in' || s?.id !== id) return;
    const k = Math.min(n, s.n);
    s.n -= k; n -= k;
    if (!s.n) part.slots[i] = null;
  });
}

// 自動作業台: 選んだレシピ。素材がそろい、出るスロットに入るとき rc を返す
export function benchReady(part) {
  const rc = part.recipe != null ? RECIPES[part.recipe] : null;
  if (!rc || !Object.entries(rc.need).every(([id, n]) => have(part, id) >= n) || !roomFor(part, rc.out, rc.n)) return null;
  return rc;
}
export const benchSecs = (rc) => (rc.time ? rc.time * 2 : 4);

// その機械に、いま仕事があるか
export function hasWork(part) {
  const S = STATIONS[part.type];
  if (!S) return false;
  if (S.bench) return !!benchReady(part);
  if (part.type === 'drill') return !!part.bed && roomFor(part, part.bed.item);
  return (S.lanes ?? []).some((ln) => laneReady(part, S, ln));
}

// 電気の出す量
const supply = (p) => {
  const d = PARTS[p.type];
  if (p.type === 'generator') return p.burn > 0 || p.slots[0] ? d.gen : 0;
  if (p.type === 'windmill') return p.pos.y >= HIGH ? d.gen * 2 : d.gen;
  return d.gen ?? 0;
};
const demand = (p) => (PARTS[p.type].use && hasWork(p) ? PARTS[p.type].use : 0);

export function createAutomation(wires, list) {
  const belts = createBelts();
  let time = 0;

  // 置いたときに呼ぶ: 動く部分（刃・羽根・腕・火の色）を足す。ドリルは下の鉱床を覚える
  function init(part, world) {
    const g = machineGeos[part.type]?.();
    part.anim = {};
    if (g) {
      for (const k of ['bit', 'glow']) if (g[k]) { part.anim[k] = makeMesh(g[k], { shadow: k !== 'glow' }); part.mesh.add(part.anim[k]); }
      for (const [k, at] of [['rotor', g.rotorAt], ['arm', g.armAt]]) if (g[k]) {
        const piv = pivot(makeMesh(g[k]), at);
        part.anim[k] = piv; part.mesh.add(piv);
      }
      if (part.anim.glow) part.anim.glow.visible = false;
    }
    if (part.type === 'drill') part.bed = bedUnder(world, makeShape(PARTS.drill.shape, part.pos, part.rot)) ?? bedsOf(world).find((b) => Math.hypot(b.x - part.pos.x, b.z - part.pos.z) <= b.r);
    if (PARTS[part.type].belt) beltLegs(part, world); // 地面がでこぼこなら足が伸びる
    belts.touch();
  }

  function tick(dt) {
    const ms = list.filter((p) => PARTS[p.type].machine && !PARTS[p.type].belt);
    solveNets(ms, wires.list, supply, demand);
    for (const p of ms) {
      const S = STATIONS[p.type] ?? {}; // 風車・電柱は設備の表にない
      p.powered = !!(p.net && p.net.ok);
      if (p.type === 'generator') { // 網が動いている間だけ燃料を減らす
        const run = !!p.net?.running;
        if (run && p.burn <= 0 && p.slots[0]) {
          if (!--p.slots[0].n) p.slots[0] = null;
          p.burn = COAL_SECS;
          stationChanged(p);
        }
        if (run) p.burn = Math.max(0, p.burn - dt);
        p.burning = run && p.burn > 0;
      } else if (p.type === 'drill') {
        p.burning = p.powered && hasWork(p);
        if (p.burning && (p.prog[0] += dt) >= DRILL_SECS) { p.prog[0] = 0; addOut(p, p.bed.item); stationChanged(p); }
      } else if (S.bench) {
        const rc = benchReady(p);
        p.burning = p.powered && !!rc;
        if (p.burning && (p.prog[0] += dt) >= benchSecs(rc)) {
          p.prog[0] = 0;
          for (const [id, n] of Object.entries(rc.need)) takeIn(p, id, n);
          addOut(p, rc.out, rc.n);
          stationChanged(p);
        }
      } else if (S.lanes) tickStation(p, dt);
    }
    belts.tick(list, dt);
  }

  // 見た目: 刃・羽根・腕・火の色。動いている間だけ
  function animate(dt) {
    time += dt;
    for (const p of list) {
      const a = p.anim;
      if (!a) continue;
      if (a.bit && p.burning) a.bit.rotation.y -= dt * 3;
      if (a.rotor) a.rotor.rotation.z -= dt * (p.pos.y >= HIGH ? 3 : 1.5);
      if (a.arm && p.burning) a.arm.rotation.y = Math.sin(time * 1.5) * 0.6;
      if (a.glow) a.glow.visible = !!p.burning;
    }
  }

  return { init, tick, animate, belts, touch: () => belts.touch() };
}
