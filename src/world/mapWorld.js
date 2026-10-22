// マップ作りの世界（docs/rules/building.md「コンクリートとマップ作り」）: 120m 四方の平らな地面と海。木・敵・空腹なし
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { createTerrain, STEP } from './terrain.js';
import { water } from './nature.js';
import { createResources } from './resources.js';

const HALF = 80;               // 地図の一辺の半分（m）
const FLAT = 60, SHORE = 72;   // ここまで平ら（高さ GROUND）、ここで海の底
export const GROUND = 1.5;

export function buildMapWorld() {
  const group = new THREE.Group();
  const corner = (x, z) => {
    const t = Math.min(1, Math.max(0, (Math.max(Math.abs(x), Math.abs(z)) - FLAT) / (SHORE - FLAT)));
    return Math.round((GROUND - t * (GROUND + 2.5)) / STEP) * STEP;
  };
  const terrain = createTerrain({ w: HALF * 2, d: HALF * 2, x0: -HALF, z0: -HALF, corner, waterLevel: 0, sandLevel: 1, base: -4, seed: 47 });
  const chunks = [];
  for (let cz = 0; cz < HALF * 2; cz += 32) for (let cx = 0; cx < HALF * 2; cx += 32) {
    const c = terrain.buildChunk(cx, cz, 32, 32);
    group.add(c.mesh, c.grid, c.steep);
    chunks.push(c);
  }
  const sea = water(-HALF - 20, -HALF - 20, HALF * 2 + 40, HALF * 2 + 40, 0, 0.35);
  const far = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: P.water[1] }));
  far.rotation.x = -Math.PI / 2;
  far.position.y = -0.15;
  // 平らな所の床: 暗い灰の板（見た目だけ。歩くのは地形）。G でマス目を出すときは隠す
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(FLAT * 2, FLAT * 2), new THREE.MeshLambertMaterial({ color: P.concrete[3] }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = GROUND + 0.005;
  floor.receiveShadow = true;
  group.add(sea, far, floor);

  const world = {
    id: 'map', name: 'マップ作り', mapMaker: true, reach: 12, // 届く距離を長く（大きいブロックを置く）
    hour: 12, group, terrain, resources: createResources(), spawns: [], zoneAt: () => 'G',
    colliders: () => [],
    spawn: { x: 0, z: 8, yaw: 0 },
    catCenter: new THREE.Vector3(-40, 0, 40),
    fog: [90, 420],
    pvp: true, // PvP の世界（style.md「画面の効果」: 色ずれ、霧の見える距離の下限）
    harvest: () => {},
    onUpdate: null, // game/mapMaker.js（ジャンプ台）
    setGrid(on) { for (const c of chunks) c.grid.visible = on; floor.visible = !on; },
    setDebug(on) { for (const c of chunks) c.steep.visible = on; },
    update(t) { sea.userData.update?.(t); world.onUpdate?.(t); },
  };
  return world;
}
