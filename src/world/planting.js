// 苗木を植える・育つ（docs/rules/survival.md「採り方と道具の使い方」）
// 植えて 1 日で若木、もう 1 日で木（広葉樹か針葉樹）。木になると、ほかの木と同じく斧で切れる
// 時刻は dayNight の total（はじめからの秒）。島を遊んでいる間だけ進む
import * as THREE from 'three';
import { rng, makeMesh, MAT } from '../style/lowpoly.js';
import { sapling } from './flora.js';
import { trunkBase } from './placement.js';
import { SNOW } from './islandGen.js';
import { DAY_LEN } from './dayNight.js';

// protos・leaves・leafCollider・treeTop: island.js の木の形と当たり判定
export function createPlanting({ group, terrain, colliders, addCollider, resources, protos, leafCollider, leaves, treeTop }) {
  const stages = [sapling(rng(21), 0), sapling(rng(22), 1)];
  const list = []; // 育っている苗木 { x, y, z, rot, at, stage, mesh }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);

  // 植えられる所: 平らな草地・土（砂浜・雪・水はだめ）、まわりに物がない
  function canPlant(x, z) {
    const t = terrain.tileAt(x, z);
    return !!t && t.max - t.min <= 0.5 && t.min >= 1.5 && t.max < SNOW
      && !colliders(x, z, 0.6).length && !list.some((p) => Math.hypot(p.x - x, p.z - z) < 1.2);
  }
  function show(p) {
    if (p.mesh) group.remove(p.mesh);
    p.mesh = makeMesh(stages[p.stage]);
    p.mesh.position.set(p.x, p.y, p.z);
    p.mesh.rotation.y = p.rot;
    group.add(p.mesh);
  }
  // 木にする: 1 本だけのまとめ描画を作り、resources と当たり判定に入れる
  function growTree(p, kind, i) {
    const s = 0.9, y = trunkBase(terrain, p.x, p.z);
    const m = new THREE.InstancedMesh(protos[kind][i], MAT.solid, 1);
    m.setMatrixAt(0, _m.compose(new THREE.Vector3(p.x, y, p.z), _q.setFromAxisAngle(_up, p.rot), new THREE.Vector3(s, s, s)));
    m.castShadow = m.receiveShadow = true;
    m.frustumCulled = false;
    group.add(m);
    resources.add({ kind: 'tree', proto: kind, x: p.x, y, z: p.z, s, r: 0.35 * s, h: 2.2 * s, parts: [{ mesh: m, index: 0 }], planted: { kind, i, rot: p.rot },
      collider: addCollider(p.x, p.z, 0.25 * s, y + treeTop), leafCollider: leafCollider(p.x, p.z, y, s, leaves[kind][i]) });
  }

  function grow(p) {
    group.remove(p.mesh);
    const kind = Math.random() < 0.6 ? 'broadleaf' : 'conifer';
    growTree(p, kind, Math.floor(Math.random() * protos[kind].length));
  }

  return {
    canPlant, list,
    // セーブ用: 育っている苗木と、苗木から育った木（まだある物）
    save: () => ({
      saplings: list.map(({ x, z, rot, at }) => ({ x, z, rot, at })),
      trees: resources.entries().filter((e) => e.planted && e.ready).map((e) => ({ x: e.x, z: e.z, ...e.planted })),
    }),
    load({ saplings, trees }) {
      for (const s of saplings) { const p = { ...s, y: terrain.heightAt(s.x, s.z), stage: 0 }; list.push(p); show(p); }
      for (const t of trees) growTree({ x: t.x, z: t.z, rot: t.rot }, t.kind, t.i);
    },
    plant(x, z, now) {
      const p = { x, y: terrain.heightAt(x, z), z, rot: Math.random() * Math.PI * 2, at: now, stage: 0 };
      list.push(p);
      show(p);
    },
    update(now) {
      for (let k = list.length - 1; k >= 0; k--) {
        const p = list[k], stage = Math.floor((now - p.at) / DAY_LEN);
        if (stage >= 2) { grow(p); list.splice(k, 1); } else if (stage !== p.stage) { p.stage = stage; show(p); }
      }
    },
  };
}
