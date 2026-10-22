// マップ作りの世界（docs/rules/building.md「コンクリートとマップ作り」）: 宙に浮く床（広さは 60〜180m 四方で変えられる。初めは 120m。海・地形は描かない）。木・敵・空腹なし
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { createTerrain, STEP } from './terrain.js';
import { createResources } from './resources.js';

const MAXFLAT = 90, EDGE = 1;      // 平らな範囲の一辺の半分の最大（180m 四方）と、そこから下の崖までの幅。地形のデータはいつも最大で作り、広さは高さの付け方だけで変える（地形は描かない。見えるのは宙に浮く床だけ）
const HALF = 96;                  // 地図の一辺の半分（m）
const CHUNK = 32;                 // 区画の大きさ（HALF * 2 を割り切れる）
const SLAB = 1;                   // 床の厚み
export const SIZES = [60, 90, 120, 150, 180]; // 広さ（平らな範囲の一辺。m）
export const DEFAULT_SIZE = 120;
export const GROUND = 1.5;

export function buildMapWorld() {
  const group = new THREE.Group();
  let flat = DEFAULT_SIZE / 2;
  const cornerOf = (x, z) => {
    const t = Math.min(1, Math.max(0, (Math.max(Math.abs(x), Math.abs(z)) - flat) / EDGE));
    return Math.round((GROUND - t * (GROUND + 2.5)) / STEP) * STEP;
  };
  const terrain = createTerrain({ w: HALF * 2, d: HALF * 2, x0: -HALF, z0: -HALF, corner: (x, z) => cornerOf(x, z), waterLevel: -20, sandLevel: -19, base: -4, seed: 47 }); // 水面はない（泳ぎ・水の演出が出ないよう、床よりずっと下）
  const chunks = [];
  // マス目の線のうち、床の上（範囲の中で床の高さ）の線だけ残す
  const keepOnFloor = (geo) => {
    const p = geo.attributes.position.array, out = [], lim = flat + 0.01;
    for (let i = 0; i + 5 < p.length; i += 6) {
      let ok = true;
      for (let k = 0; k < 6; k += 3) if (Math.abs(p[i + k]) > lim || Math.abs(p[i + k + 2]) > lim || p[i + k + 1] < GROUND - 0.01) ok = false;
      if (ok) out.push(...p.slice(i, i + 6));
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  };
  let gridOn = false, debugOn = false;
  const build = () => {
    for (let cz = 0; cz < HALF * 2; cz += CHUNK) for (let cx = 0; cx < HALF * 2; cx += CHUNK) {
      const c = terrain.buildChunk(cx, cz, CHUNK, CHUNK);
      c.mesh.geometry.dispose(); // 地形の面は描かない（床の箱だけ）。マス目の線と登れない面の重ねだけ使う
      keepOnFloor(c.grid.geometry);
      c.grid.visible = gridOn; c.steep.visible = debugOn;
      group.add(c.grid, c.steep);
      chunks.push(c);
    }
  };
  build();
  // 宙に浮く床: 暗い灰の厚い板（見た目だけ。歩くのは地形のデータ）。広さに合わせて大きさを変える
  const floor = new THREE.Mesh(new THREE.BoxGeometry(2, SLAB, 2), new THREE.MeshLambertMaterial({ color: P.concrete[3] }));
  floor.position.y = GROUND - 0.01 - SLAB / 2;
  floor.receiveShadow = true;
  floor.scale.set(flat, 1, flat);
  group.add(floor);

  const world = {
    id: 'map', name: 'マップ作り', mapMaker: true, reach: 12, // 届く距離を長く（大きいブロックを置く）
    hour: 12, group, terrain, resources: createResources(), spawns: [], zoneAt: () => 'G',
    colliders: () => [],
    spawn: { x: 0, z: 8, yaw: 0 },
    catCenter: new THREE.Vector3(-40, 0, 40),
    fog: [90, 420],
    harvest: () => {},
    onUpdate: null, // game/mapMaker.js（ジャンプ台）
    size: DEFAULT_SIZE,
    // 広さを変える（地形をその場で作り直す。同じ地形の物を持っている物理・プレイヤーはそのまま使える）
    setSize(n) {
      if (!SIZES.includes(n) || n === world.size) return;
      world.size = n; flat = n / 2;
      terrain.reshape(cornerOf);
      for (const c of chunks) { group.remove(c.grid, c.steep); c.grid.geometry.dispose(); c.steep.geometry.dispose(); }
      chunks.length = 0;
      build();
      floor.scale.set(flat, 1, flat);
      world.physics?.resetTerrain();
    },
    setGrid(on) { gridOn = on; for (const c of chunks) c.grid.visible = on; },
    setDebug(on) { debugOn = on; for (const c of chunks) c.steep.visible = on; },
    update(t) { world.onUpdate?.(t); },
  };
  return world;
}
