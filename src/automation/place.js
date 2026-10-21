// 機械・ベルトを置ける場所（automation.md）: 機械は家具と同じ地面（snap.js furnitureTarget の続き）、ベルトは 0.5m のマスの真ん中、
// 電動ドリルは鉱床の上にだけ。鉱床の低い当たり判定は機械を邪魔しない
import { PARTS } from '../build/parts.js';
import { makeShape, snap } from '../build/grid.js';
import { cellOf, cellCenter, bodyCells, dirOfRot } from './ports.js';

const BED_ITEM = { coalBed: 'coal', copperBed: 'copperOre', ironBed: 'ironOre', stoneBed: 'stone', sandBed: 'sand' };

// 島の鉱床 [{ x, z, r, y, kind, item }]（最初に 1 回だけ集める）
export function bedsOf(world) {
  if (!world.resources?.entries) return [];
  return (world._beds ??= world.resources.entries().filter((e) => BED_ITEM[e.kind]).map((e) => ({ x: e.x, z: e.z, r: e.r / 0.9, y: e.y, kind: e.kind, item: BED_ITEM[e.kind] })));
}
// 鉱床の低い当たり判定か（機械を置くときは無視する）
export const isBedCollider = (world, c) => bedsOf(world).some((b) => Math.hypot(c.x - b.x, c.z - b.z) < 0.05 && Math.abs(c.r - b.r) < 0.05);
// 形（置く位置・向き）が全部入っている鉱床
export function bedUnder(world, S) {
  return bedsOf(world).find((b) => S.pts.every(([x, z]) => Math.hypot(x - b.x, z - b.z) <= b.r)) ?? null;
}

// ベルトを置くマスが、機械の体の下か
const blocked = (type, pos, st) => PARTS[type].belt && st.list.some((q) => PARTS[q.type].machine && !PARTS[q.type].belt && bodyCells(q.type, q.pos, q.rot).some(([ix, iz]) => ix === cellOf(pos.x, pos.z)[0] && iz === cellOf(pos.x, pos.z)[1]));

// 照準 h: { part?, point }。ctx: { world, st, rot }
export function machineTarget(type, h, { world, st, rot }) {
  const def = PARTS[type];
  rot -= rot % 2; // 機械は 90 度ずつ（向きを回している途中の 45 度を丸める）
  if (h.part && PARTS[h.part.type].floor) { // 床の上（ドリルは鉱床の上にだけなので置けない）
    const pos = def.belt ? { ...cellCenter(cellOf(h.point.x, h.point.z)), y: h.part.pos.y } : { x: snap(h.point.x), y: h.part.pos.y, z: snap(h.point.z) };
    const p = { x: pos.x, y: pos.y, z: pos.z }, why = def.onBed ? '鉱床の上に置く' : blocked(type, p, st) ? '機械の下には置けない' : null;
    return { type, pos: p, rot, ok: !why && st.canPlace(type, p, rot), why };
  }
  const c = def.belt ? cellCenter(cellOf(h.point.x, h.point.z)) : { x: snap(h.point.x), z: snap(h.point.z) };
  const S = makeShape(PARTS[type].shape, { x: c.x, y: 0, z: c.z }, rot);
  const hs = [...S.pts, [c.x, c.z]].map(([px, pz]) => world.terrain.heightAt(px, pz));
  const lo = Math.min(...hs), hi = Math.max(...hs);
  const pos = def.belt ? { x: c.x, y: hi, z: c.z } : { x: c.x, y: lo + (hi - lo) * 0.25, z: c.z }; // ベルトは水平に（足が伸びる）
  let why = hi - lo > 0.3 ? '地面がでこぼこ' : lo <= world.terrain.waterLevel ? '水の中には置けない' : null;
  if (!why && def.onBed && !bedUnder(world, S)) why = '鉱床の上に置く';
  if (!why && blocked(type, pos, st)) why = '機械の下には置けない';
  return { type, pos, rot, exactY: true, ok: !why && st.canPlace(type, pos, rot), why };
}
export { dirOfRot };
