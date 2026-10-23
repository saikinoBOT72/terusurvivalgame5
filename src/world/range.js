// 開発用の射撃訓練島（docs/rules/islands.md「開発用の射撃訓練島」）。開発中だけメニューから入る。セーブしない
// 平らな草地と浜・海、召喚の台（右クリックで敵を出す・全部消す・武器を補充）、地面の武器、距離の杭と的
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { rng, shape, merge, makeMesh, MAT } from '../style/lowpoly.js';
import { createTerrain, STEP } from './terrain.js';
import { water } from './nature.js';
import { createResources } from './resources.js';
import { MOBS } from '../mobs/mobTypes.js';
import { dropItem } from '../survival/death.js';
import { akRig } from '../survival/akShapes.js';
import { cyberAkRig } from '../survival/cyberShapes.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const HALF = 80;               // 地図の一辺の半分（m）
const FLAT = 52, SHORE = 70;   // ここまで平ら（高さ GROUND）、ここで海の底（-2.5）
const GROUND = 1.5;
const BOOTH_Z = 24;            // 召喚の台の列
const LANE_X = 16;             // 射撃の道（北へ 10〜50m）
const TABLE = { x: -13.6, z: BOOTH_Z, len: 3.9, h: 0.45, slots: [-1.3, 0, 1.3] }; // 銃の見比べ台（召喚の台の西）。西から export のまま・作り直し・サイバー版
const SUMMON = ['drone', 'crab', 'dog', 'mining', 'gangi', 'dummy'];
// 地面の武器（islands.md）
const WEAPONS = [['stoneSpear', 1], ['ironSpear', 1], ['stoneKnife', 1], ['ironAxe', 1], ['sling', 1], ['junkPistol', 1], ['junkAmmo', 30], ['ak47', 1], ['cyberAk47', 1], ['rifleAmmo', 120], ['stone', 20]];

const oct = (r0, r1, h, y) => new THREE.CylinderGeometry(r0, r1, h, 8).rotateY(Math.PI / 8).translate(0, y + h / 2, 0);

// 召喚の台（中・約 1.1m）: 八角形の石の台座 2 段、上に暗い金属の皿と光る輪。前（+z）に傾いた操作盤とボタン
// accent: 輪とボタンの色。mark: 皿の上の印（'x' 全部消す、'plus' 補充、'orb' 昼夜、なければ敵の模型をのせる）
export function boothGeo(r, accent, mark = null) {
  const parts = [
    shape(oct(0.55, 0.6, 0.45, 0), () => (r() < 0.5 ? P.stone[2] : P.stone[1]), r, { jit: 0.02 }),
    shape(oct(0.47, 0.52, 0.12, 0.45), P.stone[3], r, { jit: 0.01 }),
    shape(oct(0.42, 0.42, 0.05, 0.57), P.robotFrame[1], r),
    shape(oct(0.34, 0.34, 0.02, 0.62), accent, r, { vary: 0.02 }),
    shape(oct(0.27, 0.27, 0.03, 0.62), P.robotFrame[0], r),
  ];
  // 操作盤: 台座の前の面に立てかけた板、画面、ボタン
  const tilt = (g) => g.rotateX(-0.45).translate(0, 0.34, 0.6);
  parts.push(shape(tilt(new THREE.BoxGeometry(0.42, 0.28, 0.06)), P.robotFrame[2], r));
  parts.push(shape(tilt(new THREE.BoxGeometry(0.22, 0.14, 0.02).translate(-0.06, 0.03, 0.035)), P.robotScreen[2], r));
  parts.push(shape(tilt(new THREE.CylinderGeometry(0.04, 0.045, 0.04, 8).rotateX(Math.PI / 2).translate(0.12, 0.02, 0.045)), accent, r));
  if (mark === 'orb') parts.push(shape(new THREE.OctahedronGeometry(0.12, 0).translate(0, 0.8, 0), accent, r)); // 昼夜: 光る玉
  if (mark === 'x' || mark === 'plus') { // 皿の上の印: 太い棒 2 本
    const bar = (rot) => shape(new THREE.BoxGeometry(0.42, 0.06, 0.1).rotateY(rot).translate(0, 0.68, 0), accent, r);
    parts.push(...(mark === 'x' ? [bar(Math.PI / 4), bar(-Math.PI / 4)] : [bar(0), bar(Math.PI / 2)]));
  }
  return merge(parts);
}

// 距離の杭（中・約 1.4m）: 八角形の木の柱と、頭の板
export function stakeGeo(r) {
  return merge([
    shape(oct(0.07, 0.08, 1.2, 0), P.wood[2], r, { jit: 0.01 }),
    shape(new THREE.BoxGeometry(0.5, 0.3, 0.05).translate(0, 1.25, 0.08), P.wood[3], r, { jit: 0.01 }),
  ]);
}

// 銃の見比べ台（中・約 3.9m）: 木の天板と 4 本の脚、銃を立てて載せる低い鉄の台座。長い辺が x、前（プレイヤー側）が +z
export function gunTableGeo(r, { len, h, slots } = TABLE) {
  const parts = [
    shape(new THREE.BoxGeometry(len, 0.06, 0.7).translate(0, h - 0.03, 0), () => (r() < 0.5 ? P.wood[2] : P.wood[3]), r, { jit: 0.01 }),
    shape(new THREE.BoxGeometry(len - 0.1, 0.1, 0.6).translate(0, h - 0.11, 0), P.wood[1], r),
  ];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(shape(new THREE.BoxGeometry(0.08, h - 0.06, 0.08).translate(sx * (len / 2 - 0.12), (h - 0.06) / 2, sz * 0.26), P.wood[1], r, { jit: 0.01 }));
  for (const x of slots) for (const dx of [-0.3, 0.3]) { // 台座: 1 丁に 2 本ずつ
    parts.push(shape(new THREE.BoxGeometry(0.04, 0.2, 0.04).translate(x + dx, h + 0.1, 0), P.robotFrame[1], r));
    parts.push(shape(new THREE.BoxGeometry(0.1, 0.02, 0.1).translate(x + dx, h + 0.01, 0), P.robotFrame[0], r));
  }
  return merge(parts);
}

// 名前の札（開発用の文字。モデル確認島と同じ見た目）
function tag(text, k = 1) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = P.ui.panel; x.fillRect(0, 0, 256, 64);
  x.fillStyle = P.ui.text; x.font = 'bold 34px sans-serif'; x.textAlign = 'center';
  const tw = x.measureText(text).width;
  if (tw > 240) x.font = `bold ${Math.floor(34 * 240 / tw)}px sans-serif`; // 長い名前は札に収まるまで小さく
  x.fillText(text, 128, 44);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), fog: false }));
  s.scale.set(1 * k, 0.25 * k, 1);
  return s;
}

// 敵の小さな模型（高さ 0.6m くらいに縮める）
function miniMob(kind) {
  const m = MOBS[kind].make();
  m.setPose('idle');
  m.root.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(m.root).getSize(new THREE.Vector3());
  m.root.scale.setScalar(0.6 / Math.max(size.x, size.y, size.z));
  return m;
}

// act: 台の働き { summon(kind, x, z), clear(), setHour(h) }（main.js がつなぐ）
export function buildRange(act) {
  const group = new THREE.Group(), r = rng(31);
  // 角の高さ: 四角い島。FLAT まで平ら、SHORE で海の底へ
  const corner = (x, z) => {
    const d = Math.max(Math.abs(x), Math.abs(z));
    const t = Math.min(1, Math.max(0, (d - FLAT) / (SHORE - FLAT)));
    return Math.round((GROUND - t * (GROUND + 2.5)) / STEP) * STEP;
  };
  const terrain = createTerrain({ w: HALF * 2, d: HALF * 2, x0: -HALF, z0: -HALF, corner, waterLevel: 0, sandLevel: 1, base: -4, seed: 31 });
  const chunks = [];
  for (let cz = 0; cz < HALF * 2; cz += 32) for (let cx = 0; cx < HALF * 2; cx += 32) {
    const c = terrain.buildChunk(cx, cz, 32, 32);
    group.add(c.mesh, c.grid, c.steep);
    chunks.push(c);
  }
  const sea = water(0);
  const far = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: P.water[1] }));
  far.rotation.x = -Math.PI / 2;
  far.position.y = -0.15;
  group.add(sea, far);

  const cols = [];
  const addCollider = (x, z, rad, top) => { const c = { x, z, r: rad, top }; cols.push(c); return c; };
  const resources = createResources();
  const updates = [];
  // 照準で当てる物（resources は InstancedMesh の 1 つを指す）
  const placeThing = (geo, x, z, rotY = 0) => {
    const m = new THREE.InstancedMesh(geo, MAT.solid, 1);
    m.setMatrixAt(0, new THREE.Matrix4().makeRotationY(rotY).setPosition(x, GROUND, z));
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    return m;
  };

  // ---- 召喚の台: 西から敵 6 つ、全部消す、補充 ----
  const booths = [
    ...SUMMON.map((kind) => ({ kind, label: MOBS[kind].name, verb: '召喚', accent: P.robotShell[2] })),
    { act: 'clear', label: '全部消す', verb: '敵を全部消す', accent: P.robotEye[1], mark: 'x' },
    { act: 'refill', label: '武器を補充', verb: '武器を出し直す', accent: P.robotHazard[1], mark: 'plus' },
    { act: 'night', label: '昼夜切り替え', verb: '昼と夜を切り替える', accent: P.robotLamp[1], mark: 'orb' },
  ];
  booths.forEach((b, i) => {
    const x = (i - (booths.length - 1) / 2) * 2.2, z = BOOTH_Z;
    const mesh = placeThing(boothGeo(r, b.accent, b.mark), x, z);
    addCollider(x, z, 0.6, GROUND + 0.62);
    const name = tag(b.label, 0.9);
    name.position.set(x, GROUND + 1.75, z);
    group.add(name);
    if (b.kind) {
      const mini = miniMob(b.kind);
      mini.root.position.set(x, GROUND + 0.65, z);
      group.add(mini.root);
      updates.push((t, dt) => { mini.root.rotation.y = t * 0.6; mini.update(t, dt); });
    }
    const ahead = b.kind === 'gangi' ? 15 : 10; // 台の北にこの距離で出す
    resources.add({
      kind: 'booth', x, y: GROUND, z, r: 0.6, h: 1.3, parts: [{ mesh, index: 0 }], label: b.label, verb: b.verb,
      use: () => {
        if (b.kind) { act.summon(b.kind, x, z - ahead); return `${b.label}を出した`; }
        if (b.act === 'clear') { act.clear(); return '敵を全部消した'; }
        if (b.act === 'night') { world.hour = world.hour === 12 ? 0 : 12; act.setHour(world.hour); return world.hour ? '昼にした' : '夜にした'; }
        refill(); return '武器を出し直した';
      },
    });
  });

  // ---- 地面の武器: 台と起きる場所の間に 1 列 ----
  let dropped = [];
  function refill() {
    for (const e of dropped) if (!e.gone) resources.remove(e);
    dropped = WEAPONS.map(([id, n], i) => dropItem(world, id, n, (i - (WEAPONS.length - 1) / 2) * 1.2, BOOTH_Z + 3.5, GROUND + 0.3));
  }

  // ---- 射撃の道: 撃つ所（LANE_X, BOOTH_Z）から北へ 10〜50m に杭と的 ----
  const stake = stakeGeo(r), dummies = [];
  for (let d = 0; d <= 50; d += 10) {
    const z = BOOTH_Z - d;
    const m = makeMesh(stake);
    m.position.set(LANE_X + 2.5, GROUND, z);
    group.add(m);
    addCollider(LANE_X + 2.5, z, 0.1, GROUND + 1.4);
    const t = tag(`${d}m`, 0.8);
    t.position.set(LANE_X + 2.5, GROUND + 1.8, z);
    group.add(t);
    if (d) dummies.push({ x: LANE_X, z });
  }

  // ---- 銃の見比べ台（islands.md）: 西から export のまま・作り直し・サイバー版。右の面（ボルトのある側）を南（+z）に向け、銃口は東 ----
  placeThing(gunTableGeo(r), TABLE.x, TABLE.z);
  for (const dx of [-1.6, -0.8, 0, 0.8, 1.6]) addCollider(TABLE.x + dx, TABLE.z, 0.36, GROUND + TABLE.h); // 細長い台を丸 4 つで
  const gunY = GROUND + TABLE.h + 0.205; // 機関部の下（どちらも原点）を台座の上に
  const showGun = (obj, dx, label, yaw) => {
    const box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new THREE.Vector3());
    const holder = new THREE.Group();
    obj.position.set(-c.x, 0, -c.z);
    holder.add(obj);
    holder.rotation.y = yaw;
    holder.position.set(TABLE.x + dx, gunY, TABLE.z);
    group.add(holder);
    const t = tag(label, 0.9);
    t.position.set(TABLE.x + dx, GROUND + TABLE.h + 0.6, TABLE.z);
    group.add(t);
    return holder;
  };
  const [westX, midX, eastX] = TABLE.slots;
  new GLTFLoader().load(new URL('../../gun-export/ak47.glb', import.meta.url).href, (gltf) => {
    const gun = gltf.scene;
    gun.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    for (const n of ['hand_L', 'hand_R']) gun.getObjectByName(n)?.removeFromParent(); // 手は消す（lhand ノードは残す）
    showGun(gun, westX, 'AK47（そのまま）', -Math.PI / 2); // export は前が -z・右が +x
  }, undefined, () => { const t = tag('AK47（ファイルなし）', 0.9); t.position.set(TABLE.x + westX, GROUND + TABLE.h + 0.6, TABLE.z); group.add(t); });

  showGun(akRig(), midX, 'AK47（作り直し）', Math.PI / 2); // 作り直しは前が +z・左が +x
  showGun(cyberAkRig('rose'), eastX, 'AK47（サイバー）', Math.PI / 2);
  const world = {
    id: 'range', name: '射撃訓練島', range: true,
    hour: 12, // 昼夜切り替えの台で 12 時 ↔ 0 時（時計は進めない）
    group, terrain, resources, spawns: [], zoneAt: () => 'G',
    colliders: (x, z, rad) => cols.filter((c) => Math.hypot(x - c.x, z - c.z) < c.r + rad),
    spawn: { x: 0, z: BOOTH_Z + 7, yaw: 0 }, // 台のほう（北）を向く
    dummies, // 練習用の的（combat.js が置く）
    catCenter: new THREE.Vector3(-6, 0, BOOTH_Z + 8),
    fog: [60, 300],
    harvest: (e) => resources.remove(e),
    refill, // 物理ができてから main.js が 1 回呼ぶ
    setGrid(on) { for (const c of chunks) c.grid.visible = on; },
    setDebug(on) { for (const c of chunks) c.steep.visible = on; },
    update(t, cam) {
      const dt = 1 / 60;
      sea.userData.update?.(t, cam);
      resources.update(dt);
      for (const u of updates) u(t, dt);
    },
  };
  return world;
}
