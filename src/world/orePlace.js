// 鉱石の岩を置き、resources に登録する（docs/rules/islands.md「資源の量」、survival.md「鉱石と炉」）
// 石炭は岩場、銅は峡谷の底の道ぞい、鉄は高台。大きい岩と小さい岩（small）。数は islandMap.js の counts。壊すと 3 日で戻る（island.js の REGROW）
import * as THREE from 'three';
import { rng } from '../style/lowpoly.js';
import { oreRock, instanced } from './nature.js';
import { groundNormal, tiltQuat } from './placement.js';
import { pickSpots } from './zonePlace.js';
import { SEA } from './islandGen.js';
import { oreBed, BED_R } from './oreBed.js';

const KINDS = ['coal', 'copper', 'iron'];
const N = 2; // 形の種類

export function placeOres({ group, terrain, gen, colliders, addCollider, resources, seed }) {
  const r = rng(seed + 315), nrm = new THREE.Vector3();
  // 洞窟の中の床（y のめやすの 1.5m 上から下）の、tileAt と同じ形の情報
  // 鉱床（survival.md「鉱床」）: スポットの bed。先に置き、鉱石の岩がその上に来ないよう低い当たり判定を付ける（歩いて乗れる高さ）
  for (const s of gen.def.spots) {
    if (!s.bed) continue;
    const x = s.bed.x ?? s.x, z = s.bed.z ?? s.z, y = terrain.heightAt(x, z), m = oreBed(r, s.bed.kind);
    m.position.set(x, y, z); m.rotation.y = r() * Math.PI * 2;
    group.add(m);
    addCollider(x, z, BED_R, y + 0.2);
    resources.add({ kind: s.bed.kind + 'Bed', x, y, z, r: BED_R * 0.9, h: 0.25, parts: [] });
  }
  const caveTile = (x, z, y) => { const fs = [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]].map(([a, b]) => terrain.floorAt(x + a, y + 1.5, z + b)); return { min: Math.min(...fs), max: Math.max(...fs) }; };
  for (const kind of KINDS) for (const small of [false, true]) {
    const protos = Array.from({ length: N }, () => oreRock(r, kind, small ? 0.45 : 0.9, small).geometry);
    const size = protos.map((g) => { // 形ごとの大きさ（当たり判定用）
      g.computeBoundingBox();
      const b = g.boundingBox;
      return { top: b.max.y, r: Math.max(b.max.x, -b.min.x, b.max.z, -b.min.z) * 0.8 };
    });
    const ok = (x, z, t) => t.min > SEA && t.max - t.min <= 1 && !colliders(x, z, small ? 0.8 : 1.5).length && (kind !== 'copper' || gen.inCanyon(x, z, 4.5));
    const want = small ? gen.def.counts.oreSmall[kind] : gen.def.counts[kind];
    // スポットの鉱石（islands.md「スポット」の ores: { 種類: [大きい岩, 小さい岩] }）: スポットの中（oreIn があればその円）に寄せる。
    // oreIn.y: 洞窟の中の床の高さのめやす（その 1.5m 上から下の床に置く）
    const spots = [];
    for (const s of gen.def.spots) {
      const n = s.ores?.[kind]?.[small ? 1 : 0] ?? 0, c = s.oreIn ?? { x: s.x, z: s.z, r: s.r * 0.85 };
      for (let k = 0, got = 0; got < n && k < n * 40; k++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * c.r, x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d, t = c.y == null ? terrain.tileAt(x, z) : caveTile(x, z, c.y);
        if (!t || t.max - t.min > 1 || t.min <= SEA || colliders(x, z, small ? 0.8 : 1.5).length || spots.some((o) => Math.hypot(o.x - x, o.z - z) < (small ? 2 : 3))) continue;
        spots.push({ x, z, y: c.y == null ? null : t.min }); got++;
      }
    }
    spots.push(...pickSpots({ r, terrain, gen, want, gap: small ? 3 : 5, ok }));
    const items = protos.map(() => []);
    for (const p of spots) {
      const i = Math.floor(r() * N), s = 0.9 + r() * 0.3, y = p.y ?? terrain.heightAt(p.x, p.z);
      const q = tiltQuat(p.y != null ? nrm.set(0, 1, 0) : groundNormal(terrain, p.x, p.z, 0.25, nrm), r() * Math.PI * 2);
      const it = { x: p.x, y, z: p.z, s, q, i };
      it.collider = addCollider(p.x, p.z, size[i].r * s, y + size[i].top * s);
      items[i].push(it);
    }
    items.forEach((list, i) => {
      const m = instanced(protos[i], list);
      group.add(m);
      list.forEach((it, k) => resources.add({ kind, small, x: it.x, y: it.y, z: it.z, r: size[i].r * it.s, h: size[i].top * it.s,
        parts: [{ mesh: m, index: k }], collider: it.collider }));
    });
  }
}
