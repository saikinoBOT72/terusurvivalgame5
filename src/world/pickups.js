// 落ちている枝・石と、木の実の茂み（docs/rules/objects.md「拾える物と採れる物」）
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { rng, pick, shape, merge } from '../style/lowpoly.js';
import { instanced } from './nature.js';
import { groundNormal, tiltQuat, trunkBase } from './placement.js';
import { SEA, SNOW } from './islandGen.js';
import { pickSpots } from './zonePlace.js';

// 枝: 八角形の棒に、短い枝分かれを1本。寝かせた形（長い向きが x）
export function stick(rand) {
  const main = new THREE.CylinderGeometry(0.045, 0.055, 0.5, 8);
  main.rotateZ(Math.PI / 2);
  const twig = new THREE.CylinderGeometry(0.03, 0.04, 0.2, 8);
  twig.translate(0, 0.1, 0);
  twig.rotateY(rand() * 0.6 - 0.3);
  twig.rotateZ(-1.0);
  twig.rotateX(Math.PI / 2 - 0.1);
  twig.translate(0.06, 0, 0);
  const col = () => pick(rand, [P.wood[3], P.wood[4]]);
  const g = merge([shape(main, col, rand, { jit: 0.01 }), shape(twig, col, rand, { jit: 0.008 })]);
  g.translate(0, 0.045, 0);
  return g;
}

// 石: 小さなゆがんだ多面体
export function pebble(rand, size = 0.1 + rand() * 0.025) {
  const g = new THREE.IcosahedronGeometry(size, 0);
  g.scale(1.15, 0.7, 1);
  g.translate(0, size * 0.45, 0);
  return shape(g, () => pick(rand, [P.stone[3], P.stone[4], P.stone[3]]), rand, { jit: size * 0.3 });
}

// 落とした袋（倒れたときに持ち物を入れて落とす。survival.md「HP・空腹・昼夜」）: ずんぐりした麻袋と、しばった口
export function sack(rand) {
  const body = new THREE.IcosahedronGeometry(0.22, 0);
  body.scale(1, 0.85, 1);
  body.translate(0, 0.17, 0);
  const neck = new THREE.CylinderGeometry(0.06, 0.09, 0.08, 6);
  neck.translate(0, 0.36, 0);
  const top = new THREE.ConeGeometry(0.1, 0.1, 6);
  top.rotateX(Math.PI);
  top.translate(0, 0.43, 0);
  const cloth = () => pick(rand, [P.straw[1], P.straw[2]]);
  return merge([shape(body, cloth, rand, { jit: 0.03 }), shape(neck, P.straw[0], rand), shape(top, cloth, rand, { jit: 0.015 })]);
}

// 木の実の茂み: 葉のかたまりを2〜3個寄せ、実を葉に半分埋める。葉と実は別の形（実だけ消すため）
export function berryBush(rand) {
  const leaves = [], berries = [];
  const n = 2 + Math.floor(rand() * 2);
  const blobs = [];
  for (let i = 0; i < n; i++) {
    const s = 0.3 + rand() * 0.08, a = (i / n) * Math.PI * 2 + rand();
    const x = Math.cos(a) * 0.17, z = Math.sin(a) * 0.17, y = 0.36 + rand() * 0.08;
    const g = new THREE.IcosahedronGeometry(s, 1);
    g.scale(1, 0.85, 1);
    g.translate(x, y, z);
    leaves.push(shape(g, () => pick(rand, [P.broadleaf[1], P.broadleaf[2], P.broadleaf[3]]), rand, { jit: s * 0.2 }));
    blobs.push({ x, y, z, s });
  }
  for (let i = 0; i < 6; i++) { // 実: 葉のかたまりの表面（上半分）に半分埋める
    const b = blobs[i % n], th = rand() * Math.PI * 2, ph = 0.3 + rand() * 1.0;
    const g = new THREE.IcosahedronGeometry(0.05, 0);
    g.translate(b.x + Math.cos(th) * Math.sin(ph) * b.s * 0.92, b.y + Math.cos(ph) * b.s * 0.8, b.z + Math.sin(th) * Math.sin(ph) * b.s * 0.92);
    berries.push(shape(g, () => pick(rand, [P.catOrange[1], P.catOrange[2]]), rand));
  }
  return { leaves: merge(leaves), berries: merge(berries) };
}

// 島に置いて、resources に登録する。addCollider(x, z, r, top) は島の当たり判定に足す
export function placePickups({ group, terrain, gen, colliders, addCollider, resources, seed }) {
  const r = rng(seed + 314);
  const protos = {
    stick: Array.from({ length: 4 }, () => stick(r)),
    stone: Array.from({ length: 4 }, () => pebble(r)),
    bush: Array.from({ length: 3 }, () => berryBush(r)),
  };
  const items = { stick: protos.stick.map(() => []), stone: protos.stone.map(() => []), bush: protos.bush.map(() => []) };
  const nrm = new THREE.Vector3();
  const flat = (t) => t && t.max - t.min <= 0.5 && t.min > SEA + 0.05 && t.max < SNOW;
  const add = (kind, x, z) => {
    if (colliders(x, z, kind === 'bush' ? 0.6 : 0.3).length) return;
    const i = Math.floor(r() * items[kind].length), rot = r() * Math.PI * 2;
    if (kind === 'bush') {
      const y = trunkBase(terrain, x, z, 0.3);
      items.bush[i].push({ x, y, z, rot, s: 0.9 + r() * 0.2 });
      addCollider(x, z, 0.4, y + 0.75);
    } else {
      const y = terrain.heightAt(x, z);
      items[kind][i].push({ x, y, z, s: 1, q: tiltQuat(groundNormal(terrain, x, z, 0.25, nrm), rot) });
    }
  };

  // 区域ごとに決まった数（islands.md「資源の量」）。木の実の茂みは森のはしと草原
  const C = gen.def.counts;
  for (const kind of ['stone', 'stick', 'bush']) {
    for (const p of pickSpots({ r, terrain, gen, want: C[kind], gap: kind === 'bush' ? 8 : 3, ok: (x, z, t) => flat(t) && (kind === 'stone' || t.min >= 1.5) })) add(kind, p.x, p.z);
  }
  // スタート地点のまわりには必ず少し置く
  const sp = gen.spawn;
  for (let i = 0; i < 8; i++) {
    const a = r() * Math.PI * 2, d = 2.5 + r() * 3.5, x = sp.x + Math.cos(a) * d, z = sp.z + Math.sin(a) * d;
    if (flat(terrain.tileAt(x, z))) add(i % 2 ? 'stone' : 'stick', x, z);
  }

  // 描いて登録する
  for (const kind of ['stick', 'stone']) {
    items[kind].forEach((list, i) => {
      const m = instanced(protos[kind][i], list);
      group.add(m);
      list.forEach((it, k) => resources.add({ kind, x: it.x, y: it.y, z: it.z, r: 0.25, h: 0.25, parts: [{ mesh: m, index: k }] }));
    });
  }
  items.bush.forEach((list, i) => {
    const leaves = instanced(protos.bush[i].leaves, list), berries = instanced(protos.bush[i].berries, list);
    group.add(leaves, berries);
    list.forEach((it, k) => resources.add({ kind: 'bush', x: it.x, y: it.y, z: it.z, r: 0.45, h: 0.8, parts: [{ mesh: berries, index: k }] }));
  });
}
