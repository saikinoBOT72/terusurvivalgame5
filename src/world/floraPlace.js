// 島に倒木・竹やぶ・ヤシの木・キノコ・浜の火打ち石・鳥の巣を置き、resources に登録する（survival.md「採り方」）
// 数は区域ごとに決まっている（islandMap.js の counts）。島の木・岩とは別の乱数を使う
import * as THREE from 'three';
import { rng } from '../style/lowpoly.js';
import { instanced } from './nature.js';
import { fallenLog, birdNest, bambooGrove, palmTree } from './flora.js';
import { mushrooms } from './props.js';
import { itemGeometry } from '../survival/itemShapes.js';
import { groundNormal, tiltQuat, trunkBase } from './placement.js';
import { SEA, SNOW } from './islandGen.js';
import { pickSpots } from './zonePlace.js';
import { crop } from './crops.js';
import { DAY_LEN } from './dayNight.js';

const between = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const N = 3; // 形の種類

// nestTrees: [{ e: 広葉樹の resources の物, crotch: 幹の分かれ目の高さ（形の大きさ 1 のとき） }]
// 返す slingTargets: スリングの的 { x, y, z, r, h, parts, ready, drops(), regrow }
export function placeFlora({ group, terrain, gen, colliders, addCollider, resources, seed, nestTrees }) {
  const r = rng(seed + 313);
  const protos = {
    log: Array.from({ length: N }, () => fallenLog(r)),
    bamboo: Array.from({ length: N }, () => bambooGrove(r)),
    palm: Array.from({ length: N }, () => palmTree(r)),
    nest: birdNest(r),
    mushroom: mushrooms(r),
    flint: itemGeometry('flint'),
  };
  // ヤシの実のまとまりの真ん中（形ごと）。スリングの的の位置
  const nutCenter = protos.palm.map((p) => { p.nuts.computeBoundingBox(); return p.nuts.boundingBox.getCenter(new THREE.Vector3()); });
  const items = { log: [[], [], []], bamboo: [[], [], []], palm: [[], [], []], mushroom: [], flint: [] };
  const flat = (t) => t && t.max - t.min <= 0.5 && t.min > SEA + 0.05 && t.max < SNOW;
  const sp = gen.spawn, nrm = new THREE.Vector3();
  // まわりがあいているか。低い物（倒木・キノコ）は、木の葉（下の端がある当たり判定）の下でもよい
  const free = (x, z, rad, low = false) => Math.hypot(x - sp.x, z - sp.z) > 5 && !colliders(x, z, rad).some((c) => !(low && c.bottom != null));

  // 区域ごとに決まった数（islands.md「資源の量」）
  const C = gen.def.counts, spots = (kind, gap, ok, weight) => pickSpots({ r, terrain, gen, want: C[kind], gap, ok, weight });
  const pos = (it) => ({ ...it, i: Math.floor(r() * N), rot: r() * Math.PI * 2 });
  for (const { x, z, i, rot } of spots('palm', 4, (x, z, t) => flat(t) && free(x, z, 0.6)).map(pos))
    items.palm[i].push({ x, y: trunkBase(terrain, x, z, 0.2), z, rot, s: 0.9 + r() * 0.25 });
  for (const { x, z, rot } of spots('flint', 3, (x, z, t) => flat(t) && t.min < 1.5 && free(x, z, 0.3)).map(pos))
    items.flint.push({ x, y: terrain.heightAt(x, z), z, s: 1, q: tiltQuat(groundNormal(terrain, x, z, 0.25, nrm), rot) });
  const forest = (x, z) => 0.1 + Math.max(0, gen.forest(x, z)) ** 2;
  for (const { x, z, i, rot } of spots('log', 8, (x, z, t) => flat(t) && free(x, z, 1.2, true), forest).map(pos))
    items.log[i].push({ x, y: terrain.heightAt(x, z) - 0.05, z, rot, s: 1 });
  for (const { x, z, rot } of spots('mushroom', 3, (x, z, t) => flat(t) && free(x, z, 0.3, true), forest).map(pos))
    items.mushroom.push({ x, y: terrain.heightAt(x, z), z, s: 1, q: tiltQuat(groundNormal(terrain, x, z, 0.25, nrm), rot) });
  for (const { x, z, i, rot } of spots('bamboo', 5, (x, z, t) => flat(t) && t.min < 3 && free(x, z, 1)).map(pos)) // 水ぎわ
    items.bamboo[i].push({ x, y: trunkBase(terrain, x, z, 0.5), z, rot, s: 0.9 + r() * 0.2 });

  const draw = (geo, list, opts) => { const m = instanced(geo, list, opts); group.add(m); return m; };
  // 倒木: 長い向きに沿って 3 つの低い当たり判定（上に乗れる）。上のキノコは別に消える
  items.log.forEach((list, i) => {
    const logM = draw(protos.log[i].log, list), capM = draw(protos.log[i].caps, list, { shadow: false });
    list.forEach((it, k) => {
      const ax = Math.cos(it.rot), az = -Math.sin(it.rot);
      const colliders = [-0.8, 0, 0.8].map((d) => addCollider(it.x + ax * d, it.z + az * d, 0.22, it.y + 0.4));
      const caps = resources.track({ parts: [{ mesh: capM, index: k }] });
      resources.add({ kind: 'log', x: it.x, y: it.y, z: it.z, r: 0.7, h: 0.45, parts: [{ mesh: logM, index: k }], colliders, caps });
    });
  });
  items.bamboo.forEach((list, i) => {
    const m = draw(protos.bamboo[i], list);
    list.forEach((it, k) => resources.add({ kind: 'bamboo', x: it.x, y: it.y, z: it.z, r: 0.6, h: 3 * it.s, parts: [{ mesh: m, index: k }],
      colliders: [addCollider(it.x, it.z, 0.45, it.y + 4)] }));
  });
  // ヤシの木と実。実はスリングの的。木を切ると実も消える
  const slingTargets = [];
  const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
  items.palm.forEach((list, i) => {
    const trunk = draw(protos.palm[i].tree, list, { double: true }), nutM = draw(protos.palm[i].nuts, list);
    list.forEach((it, k) => {
      const c = nutCenter[i].clone().multiplyScalar(it.s).applyQuaternion(_q.setFromAxisAngle(_up, it.rot)).add(new THREE.Vector3(it.x, it.y, it.z));
      const nuts = resources.track({ x: c.x, y: c.y - 0.3, z: c.z, r: 0.45, h: 0.6, parts: [{ mesh: nutM, index: k }],
        drops: () => [['coconut', 1]], regrow: DAY_LEN });
      slingTargets.push(nuts);
      resources.add({ kind: 'palm', x: it.x, y: it.y, z: it.z, r: 0.35, h: 5 * it.s, parts: [{ mesh: trunk, index: k }],
        colliders: [addCollider(it.x, it.z, 0.25, it.y + 5)], onHarvest: () => { resources.remove(nuts); slingTargets.splice(slingTargets.indexOf(nuts), 1); } });
    });
  });
  // 野生の作物: 西の草原に、実りの 1 株を地面に直接。右クリックで種 1（戻らない）
  for (const [kind, crp] of [['wildPotato', 'potato'], ['wildHemp', 'hemp']]) {
    const geo = crop(r, crp, 2, 1), list = spots(kind, 6, (x, z, t) => flat(t) && t.min >= 1.5 && free(x, z, 0.4)).map((p) => ({ x: p.x, y: terrain.heightAt(p.x, p.z) - 0.02, z: p.z, rot: r() * 6.28, s: 1.1 }));
    const m = draw(geo, list, { double: true });
    list.forEach((it, k) => resources.add({ kind, x: it.x, y: it.y, z: it.z, r: 0.3, h: crp === 'hemp' ? 0.7 : 0.3, parts: [{ mesh: m, index: k }] }));
  }
  // 拾える物: 森のキノコ（1 日で戻る）、浜の火打ち石
  for (const kind of ['mushroom', 'flint']) {
    const m = draw(protos[kind], items[kind], { shadow: false });
    items[kind].forEach((it, k) => resources.add({ kind, x: it.x, y: it.y, z: it.z, r: 0.25, h: 0.25, parts: [{ mesh: m, index: k }] }));
  }
  // 鳥の巣: 決まった数の広葉樹の、幹の分かれ目に。卵はスリングの的（2 日で戻る）。木を切ると巣も消える
  const nests = nestTrees.map((t) => [r(), t]).sort((x, y) => x[0] - y[0]).slice(0, C.nest).map(([, t]) => t).map(({ e, crotch }) => ({ e, x: e.x, y: e.y + crotch * e.s - 0.04, z: e.z, rot: r() * 6.28, s: 1 }));
  const nestM = draw(protos.nest.nest, nests), eggM = draw(protos.nest.eggs, nests, { shadow: false });
  nests.forEach((n, k) => {
    const nest = resources.track({ parts: [{ mesh: nestM, index: k }] });
    const eggs = resources.track({ x: n.x, y: n.y - 0.05, z: n.z, r: 0.3, h: 0.3, parts: [{ mesh: eggM, index: k }],
      drops: () => [['egg', between(1, 2)], ['feather', 1]], regrow: DAY_LEN * 2 });
    slingTargets.push(eggs);
    n.e.onHarvest = () => { resources.remove(nest); resources.remove(eggs); slingTargets.splice(slingTargets.indexOf(eggs), 1); };
  });
  return { slingTargets };
}
