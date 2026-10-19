// 見本の景色（ステップ0）: 24m 四方。地形タイルの形を全種類入れる。
import * as THREE from 'three';
import { rng } from '../style/lowpoly.js';
import { createTerrain, STEP } from './terrain.js';
import { conifer, broadleaf, rock, grassTuft, water, mountain, colliderRings } from './nature.js';
import { campfire } from './props.js';
import { groundNormal, tiltQuat, trunkBase, placeProp } from './placement.js';
import { createGrassCover } from './grassCover.js';

const SIZE = 24, X0 = -12, Z0 = -12, WATER = 0.2, GROUND = 0.5;

// 長方形からのマス単位の距離（チェビシェフ距離）
const distRect = (x, z, [ax, az, bx, bz]) => Math.max(ax - x, 0, x - bx, az - z, 0, z - bz);

function corner(x, z) {
  // ゆるい坂の丘（L字形・約27度）: 外角と内角ができる
  const dh = Math.min(distRect(x, z, [3, -9, 9, -6]), distRect(x, z, [3, -9, 5, -1]));
  const hill = Math.max(0, 2 - STEP * dh);
  // 45度の岩山
  const steep = Math.max(0, 3 - 1.0 * distRect(x, z, [-9, -9, -8, -8]));
  // 湖
  const e = Math.hypot((x + 5) / 1.3, z - 5);
  const lake = e < 2.2 ? -1 : e < 3.6 ? -0.5 : 0;
  if (lake < 0) return GROUND + lake;
  return GROUND + Math.max(hill, steep);
}

// 崖のある台地（1.5m 持ち上げる）
const tileOffset = (tx, tz) => {
  const x = X0 + tx, z = Z0 + tz;
  return x >= 4 && x <= 9 && z >= 3 && z <= 8 ? 1.5 : 0;
};

export function buildSampleScene() {
  const group = new THREE.Group();
  const terrain = createTerrain({ w: SIZE, d: SIZE, x0: X0, z0: Z0, corner, tileOffset, waterLevel: WATER });
  const chunk = terrain.buildChunk(0, 0, SIZE, SIZE);
  group.add(chunk.mesh, chunk.grid, chunk.steep);

  const lake = water(-11, 0, 12, 10, WATER);
  group.add(lake);

  const r = rng(11);
  const freeOf = (x, z) => Math.hypot(x, z - 1) > 3.8 && Math.hypot(x + 2.5, z + 2.5) > 1.8; // 猫の道とたき火をあける
  const place = (m, x, z) => { m.position.set(x, terrain.heightAt(x, z), z); group.add(m); };

  // 木と岩: 平らなタイルの上だけ
  const spots = (n, test) => {
    const out = [];
    for (let i = 0; i < 400 && out.length < n; i++) {
      const x = X0 + 0.5 + Math.floor(r() * SIZE) + (r() - 0.5) * 0.4;
      const z = Z0 + 0.5 + Math.floor(r() * SIZE) + (r() - 0.5) * 0.4;
      const t = terrain.tileAt(x, z);
      if (!t || !t.flat || t.min <= WATER + 0.3 || !freeOf(x, z) || !test(x, z)) continue;
      if (out.some((p) => Math.hypot(p[0] - x, p[1] - z) < 1.8)) continue;
      out.push([x, z]);
    }
    return out;
  };
  const edge = (x, z) => Math.max(Math.abs(x), Math.abs(z)) > 8;
  const colliders = []; // 歩くときの当たり判定 {x, z, r, top}
  const tree = (m, x, z) => { // 木: まっすぐ、根元を埋める
    m.position.set(x, trunkBase(terrain, x, z), z);
    group.add(m);
    colliders.push({ x, z, r: 0.25, top: m.position.y + 3 });
  };
  for (const [x, z] of spots(13, edge)) tree(conifer(r), x, z);
  for (const [x, z] of spots(5, () => true)) tree(broadleaf(r), x, z);
  for (const [x, z] of spots(9, () => true)) {
    const m = rock(r);
    place(m, x, z);
    m.geometry.computeBoundingBox();
    const b = m.geometry.boundingBox;
    colliders.push({ x, z, r: Math.max(b.max.x, -b.min.x, b.max.z, -b.min.z) * 0.8, top: m.position.y + b.max.y });
  }

  // 草
  const grass = createGrassCover();
  for (let i = 0; i < 260; i++) {
    const x = X0 + r() * SIZE, z = Z0 + r() * SIZE;
    const t = terrain.tileAt(x, z);
    if (!t || t.min <= WATER + 0.3 || t.max - t.min > 0.6 || !freeOf(x, z)) continue;
    const g = grassTuft(r); // 草: 斜面に合わせて傾ける
    place(g, x, z);
    tiltQuat(groundNormal(terrain, x, z), r() * Math.PI * 2, g.quaternion);
    grass.add(x, z, (v) => { g.visible = v; });
  }

  // 小物の見本: たき火
  const fire = campfire(r);
  const fp = placeProp(fire.root, terrain, -2.5, -2.5);
  group.add(fire.root);
  colliders.push({ x: fp.x, z: fp.z, r: fire.radius, top: fp.y + fire.height });
  const rings = colliderRings(colliders);
  group.add(rings);

  // 遠くの山（かすみの確認用）
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + r() * 0.3, d = 110 + r() * 70;
    const m = mountain(r, 14 + r() * 16, 18 + r() * 26);
    m.position.set(Math.cos(a) * d, -14, Math.sin(a) * d);
    group.add(m);
  }

  return {
    group, terrain,
    cover: (boxes, d) => grass.cover(boxes, d),
    colliders: (x, z, rad) => colliders.filter((c) => Math.hypot(x - c.x, z - c.z) < c.r + rad),
    spawn: { x: 0, z: 6 },
    catCenter: new THREE.Vector3(0, 0, 1),
    fog: [45, 280],
    setGrid(on) { chunk.grid.visible = on; },
    setDebug(on) { chunk.steep.visible = on; rings.visible = on; },
    update(t) { lake.userData.update(t); fire.update(t); },
  };
}
