// 地面に落とす物（docs/rules/survival.md、physics.md「落ちた物・投げた物」）: 倒れたときの袋、スリングで落ちた物、投げた物
// どちらも照準で当てられる物として resources に入れる。拾うのは gather.js（右クリックで中身を持ち物へ）
// 物理がある世界では物理の物になり、転がる・浮く・沈む
import * as THREE from 'three';
import { BAR } from './inventory.js';
import { itemGeometry } from './itemShapes.js';
import { sack } from '../world/pickups.js';
import { rng, MAT } from '../style/lowpoly.js';

// 水を 1 とした重さ（physics.md の表）。書いていない物は 0.8
const DENSITY = {
  feather: 0.2, bamboo: 0.4, tubeEmpty: 0.4, palmLeaf: 0.5, fiber: 0.5, rope: 0.5, fishingRod: 0.5,
  stick: 0.6, wood: 0.6, sapling: 0.6, torch: 0.6, sling: 0.6, paddle: 0.6,
  coconut: 0.75, berry: 0.8, cookedBerry: 0.8, mushroom: 0.7, cookedMushroom: 0.7, fish: 0.95, cookedFish: 0.9,
  tubeSea: 0.9, tubeFresh: 0.9, bag: 0.8,
  egg: 1.05, cookedEgg: 1.05, clay: 1.8, brick: 1.9, stone: 2.5, flint: 2.5,
  stoneAxe: 1.5, stonePick: 1.5, stoneHammer: 1.5, stoneSpear: 1.2, stoneKnife: 1.5,
};
const ROUND = new Set(['stone', 'coconut', 'egg', 'cookedEgg', 'berry', 'cookedBerry']); // 球で転がる物

const _m = new THREE.Matrix4();
let sackGeo = null;
// store: 中身のマス [{ id, n }...]。geo: 見た目（底が原点）。vel: 投げたときの速さ
export function placeDrop(world, store, x, y, z, { geo = null, kind = 'drop', rot = 0, vel = null } = {}) {
  geo ??= (sackGeo ??= sack(rng(5)));
  const m = new THREE.InstancedMesh(geo, MAT.solid, 1);
  m.setMatrixAt(0, new THREE.Matrix4().makeRotationY(rot).setPosition(x, y, z));
  m.castShadow = m.receiveShadow = true;
  m.frustumCulled = false;
  world.group.add(m);
  const e = world.resources.add({ kind, x, y, z, r: 0.3, h: 0.45, parts: [{ mesh: m, index: 0 }], store });
  if (world.physics) addBody(world, e, geo, kind === 'bag' ? 'bag' : store[0].id, rot, vel);
  return e;
}

// 見た目の大きさの箱（丸い物は球）の物理の物にする。見た目は体の中心からずらして描く
function addBody(world, e, geo, id, rot, vel) {
  if (!geo.boundingBox) geo.computeBoundingBox();
  const bb = geo.boundingBox, c = bb.getCenter(new THREE.Vector3()), half = bb.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const shape = ROUND.has(id) ? { ball: Math.max(0.04, Math.min(half.x, half.y, half.z)) } : { box: [half.x, half.y, half.z].map((v) => Math.max(0.03, v)) };
  const off = new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z); // 物ごとのずれ（共有すると、最後に足した物のずれで全部が描かれる）
  const h = world.physics.add({
    shape, density: DENSITY[id] ?? 0.8, vel,
    pos: { x: e.x, y: e.y + c.y + 0.02, z: e.z },
    rot: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot),
    onMove: (p, q) => world.resources.move(e, p.x, p.y - half.y - 0.05, p.z, _m.compose(p, q, ONE).multiply(off)),
    onLost: () => world.resources.remove(e),
  });
  e.onGone = () => world.physics.remove(h);
}
const ONE = new THREE.Vector3(1, 1, 1);

// 長い物（やり・松明など、高さが幅の 2 倍以上）は寝かせた形で落とす。立ったまま転がらないように
const lyingGeo = new Map();
export function dropGeometry(id) {
  if (lyingGeo.has(id)) return lyingGeo.get(id);
  let g = itemGeometry(id);
  if (!g.boundingBox) g.computeBoundingBox();
  const s = g.boundingBox.getSize(new THREE.Vector3());
  if (s.y >= Math.max(s.x, s.z) * 2) {
    g = g.clone().rotateZ(Math.PI / 2);
    g.computeBoundingBox();
    g.translate(0, -g.boundingBox.min.y, 0);
    g.computeBoundingBox();
  }
  lyingGeo.set(id, g);
  return g;
}

// 地面に 1 種類の物を落とす（その物の形で）。y がなければ地面の高さから
export const dropItem = (world, id, n, x, z, y = world.terrain.groundNear?.(x, z) ?? world.terrain.heightAt(x, z)) =>
  placeDrop(world, [{ id, n }], x, y, z, { geo: dropGeometry(id), rot: Math.random() * 6.28 });

// 投げる（physics.md）: slot の物 1 個を、from から dir の向きに投げる
export function throwItem(world, slot, from, dir) {
  const one = { ...slot, n: 1 };
  const vel = { x: dir.x * 8, y: dir.y * 8 + 2, z: dir.z * 8 };
  return placeDrop(world, [one], from.x + dir.x * 0.5, from.y + dir.y * 0.5 - 0.2, from.z + dir.z * 0.5,
    { geo: dropGeometry(slot.id), rot: Math.random() * 6.28, vel });
}

// 倒れたとき: 手に持つ列のほかの持ち物を、その場に袋で落とす。落とす物がなければ false
export function dropBag(world, inventory, x, y, z) {
  const store = inventory.slots.slice(BAR);
  if (!store.some(Boolean)) return false;
  inventory.slots.fill(null, BAR);
  inventory.changed();
  placeDrop(world, store, x, y, z, { kind: 'bag' });
  return true;
}
