// 石の密集地・石の鉱床・砂の塊・砂の鉱床を置く（docs/rules/islands.md「資源の量」、survival.md「道具の段階」）
// 石の密集地はスポットの cluster: 'stone'（islands.md「鉱石の密集地」）、砂の鉱床は島の sandBed。砂の塊はスポーンのまわりの浜
// 島とは別の乱数で、resources への登録は late（島の物の最後）
import * as THREE from 'three';
import { rng, makeMesh } from '../style/lowpoly.js';
import { rock, instanced } from './nature.js';
import { pebble } from './pickups.js';
import { oreBed, BED_R } from './oreBed.js';
import { sandMound, sandBed, SAND_BED_R } from './sandShapes.js';
import { groundNormal, tiltQuat } from './placement.js';
import { SEA } from './islandGen.js';

const CLUSTER = { rocks: 12, stones: 10, r: 12 }; // 石の密集地: 岩 12・落ちている石 10 を半径 12m に
const SAND_MOUNDS = 20;
const SAND_LEVEL = 1.25; // 砂浜の上の高さ（島の terrain の sandLevel）

export function placeStone({ group, terrain, gen, colliders, addCollider, resources, seed }) {
  const r = rng(seed + 316), nrm = new THREE.Vector3(), sp = gen.spawn;

  // ---- 石の密集地: 真ん中に石の鉱床、まわりに岩と落ちている石 ----
  const c = gen.def.spots.find((o) => o.cluster === 'stone');
  const rockProtos = Array.from({ length: 4 }, () => rock(r, 0.6 + r() * 0.5).geometry);
  const rockSize = rockProtos.map((g) => { g.computeBoundingBox(); const b = g.boundingBox; return { top: b.max.y, r: Math.max(b.max.x, -b.min.x, b.max.z, -b.min.z) * 0.8 }; });
  const stoneProtos = Array.from({ length: 3 }, () => pebble(r));
  const rocks = rockProtos.map(() => []), stones = stoneProtos.map(() => []);
  const entries = []; // 登録する物（形ごとにまとめて描いてから resources に入れる）
  if (c) {
    const bed = oreBed(r, 'stone'), y = terrain.heightAt(c.x, c.z);
    bed.position.set(c.x, y, c.z); bed.rotation.y = r() * Math.PI * 2;
    group.add(bed);
    addCollider(c.x, c.z, BED_R, y + 0.2);
    resources.add({ kind: 'stoneBed', x: c.x, y, z: c.z, r: BED_R * 0.9, h: 0.25, parts: [] }, true);
    const placed = [];
    for (let k = 0; k < 400 && placed.length < CLUSTER.rocks + CLUSTER.stones; k++) {
      const isRock = placed.length < CLUSTER.rocks, a = r() * Math.PI * 2, d = BED_R + 1.5 + Math.sqrt(r()) * (CLUSTER.r - BED_R - 1.5);
      const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d, t = terrain.tileAt(x, z);
      if (!t || t.min < 1.5 || t.max - t.min > 1 || colliders(x, z, isRock ? 1.2 : 0.3).length || placed.some((o) => Math.hypot(o.x - x, o.z - z) < (isRock ? 3 : 1.2))) continue;
      placed.push({ x, z });
      const y = terrain.heightAt(x, z), q = tiltQuat(groundNormal(terrain, x, z, 0.25, nrm), r() * Math.PI * 2);
      if (isRock) {
        const i = Math.floor(r() * rockProtos.length), s = 0.7 + r() * 0.6, rr = rockSize[i].r * s;
        const e = { x, y, z, s, q, i, r: rr, h: rockSize[i].top * s, size: rr, collider: addCollider(x, z, rr, y + rockSize[i].top * s) };
        rocks[i].push(e);
      } else stones[Math.floor(r() * stoneProtos.length)].push({ x, y, z, s: 1, q });
    }
  }
  rocks.forEach((list, i) => { if (!list.length) return; const m = instanced(rockProtos[i], list); group.add(m); list.forEach((e, k) => entries.push({ kind: 'rock', x: e.x, y: e.y, z: e.z, r: e.r, h: e.h, size: e.size, collider: e.collider, parts: [{ mesh: m, index: k }] })); });
  stones.forEach((list, i) => { if (!list.length) return; const m = instanced(stoneProtos[i], list); group.add(m); list.forEach((e, k) => entries.push({ kind: 'stone', x: e.x, y: e.y, z: e.z, r: 0.25, h: 0.25, parts: [{ mesh: m, index: k }] })); });

  // ---- 砂: 砂の鉱床 1 と砂の塊（浜の低い所。スポーンから 90m 以内） ----
  const bedAt = gen.def.sandBed;
  if (bedAt) {
    const y = terrain.heightAt(bedAt.x, bedAt.z), m = makeMesh(sandBed(r));
    m.position.set(bedAt.x, y, bedAt.z); m.rotation.y = r() * Math.PI * 2;
    group.add(m);
    resources.add({ kind: 'sandBed', x: bedAt.x, y, z: bedAt.z, r: SAND_BED_R * 0.9, h: 0.2, parts: [] }, true);
  }
  const moundProtos = Array.from({ length: 3 }, () => sandMound(r)), mounds = moundProtos.map(() => []), placedM = [];
  for (let k = 0; k < 4000 && placedM.length < SAND_MOUNDS; k++) {
    const a = r() * Math.PI * 2, d = 8 + Math.sqrt(r()) * 82, x = sp.x + Math.cos(a) * d, z = sp.z + Math.sin(a) * d, t = terrain.tileAt(x, z);
    if (!t || t.min < SEA + 0.05 || t.max > SAND_LEVEL + 0.2 || t.max - t.min > 0.5 || gen.inSpot(x, z) || colliders(x, z, 0.8).length
      || (bedAt && Math.hypot(x - bedAt.x, z - bedAt.z) < SAND_BED_R + 1) || placedM.some((o) => Math.hypot(o.x - x, o.z - z) < 3)) continue;
    placedM.push({ x, z });
    mounds[Math.floor(r() * moundProtos.length)].push({ x, y: terrain.heightAt(x, z), z, s: 0.9 + r() * 0.3, q: tiltQuat(groundNormal(terrain, x, z, 0.25, nrm), r() * Math.PI * 2) });
  }
  mounds.forEach((list, i) => { if (!list.length) return; const m = instanced(moundProtos[i], list); group.add(m); list.forEach((e, k) => entries.push({ kind: 'sand', x: e.x, y: e.y, z: e.z, r: 0.6 * e.s, h: 0.45 * e.s, parts: [{ mesh: m, index: k }] })); });

  for (const e of entries) resources.add(e, true);
  return { cluster: c, sandBed: bedAt, mounds: placedM.length }; // 確認用
}
