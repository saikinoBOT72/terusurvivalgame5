import * as THREE from 'three';
import { P } from './style/palette.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createSky } from './world/sky.js';
import { buildSampleScene } from './world/sampleScene.js';
import { buildIsland } from './world/island.js';
import { glowShroomGill, GLOW_MAT } from './world/spotNature.js';
import { ISLANDS } from './world/islandMap.js';
import { createLoading } from './ui/loading.js';
import { createPhysics } from './physics/physics.js';
import { createVehicles } from './vehicle/vehicles.js';
import { loadSettings, sensRad, vfovOf } from './ui/settings.js';
import { createSimple } from './avatar/simple.js'; // 仮のキャラ。猫に戻すときは cat.js の createCat
import { createFirstPerson, VIEW_LAYER } from './player/firstPerson.js';
import { createStructures } from './build/structures.js';
import { createBuildMode } from './build/buildMode.js';
import { PARTS, PART_LIST, COSTS } from './build/parts.js';
import { createBuildMenu, costHtml, canPay, itemsHtml } from './ui/buildMenu.js';
import { createInventory } from './survival/inventory.js';
import { createGather } from './survival/gather.js';
import { createCombat } from './mobs/combat.js';
import { createSpawner } from './mobs/spawn.js';
import { createHitFx } from './mobs/hitFx.js';
import { createWindFx } from './mobs/windFx.js';
import { createMudFx } from './mobs/mudFx.js';
import { createRockFx } from './mobs/rockFx.js';
import { createCombatHud } from './ui/combatHud.js';
import { createPlayerCombat } from './combat/playerCombat.js';
import { createRanged } from './combat/ranged.js';
import { PISTOL_HOLD, gunRig } from './survival/gunShapes.js';
import { weaponMotion } from './avatar/fpMotion.js';
import { createBlueprints } from './survival/blueprints.js';
import { createInventoryHud } from './ui/inventoryHud.js';
import { ITEMS } from './survival/items.js';
import { itemMesh, gripOf } from './survival/itemShapes.js';
import { BAR, SLOTS } from './survival/inventory.js';
import './ui/ui.css';
import { applyUiColors, createViewerHud, createMenu, createPlayHud, createBuildHud, createKeysPanel, bindFullscreenKey } from './ui/hud.js';
import { createStats, MAX_HP } from './survival/stats.js';
import { createDayNight } from './world/dayNight.js';
import { createStatusHud, createDeathScreen } from './ui/statusHud.js';
import { dropBag } from './survival/death.js';
import { createAimHighlight } from './ui/aimHighlight.js';
import { createControls } from './controls.js';
import { rng } from './style/lowpoly.js';
import { campfire } from './world/props.js';
import { createTools } from './survival/tools.js';
import { hasSave, readSave, save, restore } from './save/save.js';
import { stationRefund } from './survival/stations.js';
import { createFarm, planterRefund } from './survival/farm.js';
import { placeDrop } from './survival/death.js';

applyUiColors();
bindFullscreenKey();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false; // 影は 1 フレームに 1 回だけ作る（下の描画で 2 回描くため）
renderer.autoClear = false;
document.body.appendChild(renderer.domElement);
const dom = renderer.domElement;
// マウスを固定する。加速なしの生の移動量を使うと視点が飛びにくい（使えないブラウザでは普通に固定）
function lockPointer() {
  const p = dom.requestPointerLock?.({ unadjustedMovement: true });
  p?.catch?.(() => dom.requestPointerLock?.()?.catch?.(() => {}));
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.05, 1200);
scene.add(camera);
const sky = createSky(scene);
// サバイバル（HP・空腹・時刻）は島を 1人称で遊んでいる間だけ進む
let saveT = 0, sleeping = false; // 眠って暗転している間は、時間も空腹も止める
const survival = () => mode === 'fps' && world === island && !sleeping;
const fighting = () => mode === 'fps' && (world === island || world?.range) && !sleeping; // 戦い（敵の動き・スタミナ）は射撃訓練島でも
const player = createFirstPerson({ camera, dom, onLand: (h) => { if (survival()) stats.fell(h); } });
const structuresOf = new Map(); // 世界ごとの建築パーツ
const inventory = createInventory();
// たき火から 3m 以内か（建てたたき火と、島のはじめからあるたき火）。そばだと HP の回復が速い
// 建てたたき火は燃えている間だけ（survival.md「設備の窓と燃料」）
const nearFire = () => {
  const st = structuresOf.get(world), s = player.state;
  return !!st?.list.some((p) => p.type === 'campfire' && p.burning && Math.hypot(p.pos.x - s.x, p.pos.z - s.z) < 3 && Math.abs(p.pos.y - s.y) < 3)
    || (world.fires ?? []).some((f) => Math.hypot(f.x - s.x, f.z - s.z) < 3);
};
const blueprints = createBlueprints(); // 読んだ設計図（survival.md「設計図」）
const invHud = createInventoryHud(inventory, { vitals: () => stats.state, known: (rc) => blueprints.has(rc.bp) }); // 開いているときだけ呼ばれる（stats はこのあとで作る）
const statusHud = createStatusHud();
const keysPanel = createKeysPanel();
const aimMark = createAimHighlight(scene);
const time = createDayNight();
const stats = createStats({
  onDamage: () => statusHud.hurt(),
  onDeath: () => (world?.range ? (stats.reset(), invHud.message('HP を戻した（訓練島）')) : fallDown()), // 訓練島では倒れない
});
// 倒れる: 手に持つ列のほかを袋で落とし、倒れた画面へ。起きる: 島の最初の場所で（寝床ができたら寝床で）
const deathScreen = createDeathScreen({ onWake: wake });
function fallDown() {
  const s = player.state;
  deathScreen.setDropped(dropBag(world, inventory, s.x, s.y, s.z));
  setMode('dead');
  document.exitPointerLock?.();
}
function wake() {
  stats.wake();
  player.setWorld(world, structuresOf.get(world));
  const bed = structuresOf.get(world)?.list.findLast((p) => p.type === 'bed'); // 寝床があれば、その横で起きる
  if (bed) {
    const a = bed.mesh.rotation.y, s = player.state;
    Object.assign(s, { x: bed.pos.x + Math.sin(a), z: bed.pos.z + Math.cos(a), y: bed.pos.y + 0.6 });
  }
  setMode('fps');
  lockPointer();
}
// 眠る（寝床に右クリック）: 夜だけ。暗転して朝 6:00 になる
function sleep() {
  if (sleeping) return;
  if (!time.isNight) return invHud.message('夜になってから眠れる');
  sleeping = true;
  statusHud.fade(true);
  setTimeout(() => {
    stats.sleep(time.skipToMorning());
    sky.setHour(time.hour);
    statusHud.update(stats.state, time);
    statusHud.fade(false);
    setTimeout(() => (sleeping = false), 1000);
  }, 1100);
}
// ---- 建築: ハンマーを持って右クリックでメニュー。置くと素材が減り、撤去すると半分戻る ----
const buildHud = createBuildHud({ partName: (t) => PARTS[t].name, costHtml: (t) => costHtml(t, inventory), refundHtml: (parts) => itemsHtml(build.refund(parts)) });
const build = createBuildMode({
  camera, dom,
  onSwing: (removing) => player.arms.swing('chop', removing ? ITEMS.stoneHammer.swing : 0.4), // 撤去はゆっくり、置くのはこれまでどおり
  swinging: () => player.arms.swinging,
  canPay: (t) => canPay(t, inventory),
  onPlaced: (t) => {
    for (const [id, n] of Object.entries(COSTS[t])) inventory.remove(id, n);
    const broke = inventory.wear(); // ハンマーの耐久
    if (broke) invHud.message(`${broke}が壊れた`);
  },
  onRemoved: (parts) => {
    const back = {};
    let lost = false;
    const left = []; // 設備の中身（チェストも）は持ち物へ。入りきらない分は、その場に袋で落とす
    for (const p of parts) for (const [id, n] of [...stationRefund(p), ...planterRefund(p)]) {
      const got = inventory.add(id, n);
      if (got) invHud.gained(id, got);
      if (got < n) left.push({ id, n: n - got, at: p.pos });
    }
    if (left.length) {
      const at = left[0].at;
      placeDrop(world, left.map(({ id, n }) => ({ id, n })), at.x, at.y + 0.3, at.z, { kind: 'bag' });
      invHud.message('入りきらない分は袋に入れて置いた');
    }
    inventory.changed();
    for (const t of parts.map((p) => p.type)) for (const [id, n] of Object.entries(COSTS[t])) back[id] = (back[id] || 0) + Math.floor(n / 2);
    for (const [id, n] of Object.entries(back)) if (n) invHud.gained(id, inventory.add(id, n));
  },
  // いかだのコアを撤去: バラバラになって、素材が水に浮かぶ（physics.md「いかだ」）
  onBreak: (v) => { world.vehicles.breakUp(v, (p) => [...stationRefund(p), ...planterRefund(p)]); invHud.message('いかだが壊れた'); },
});
scene.add(build.preview);
scene.add(build.marks); // 撤去で消えるパーツの赤い重ね
const buildMenu = createBuildMenu({ inventory, onPick: (i) => { input.setBuildMenuOpen(false); build.start(i); }, known: (bp) => blueprints.has(bp) });
const farm = createFarm({ inventory, onGain: (id, n) => invHud.gained(id, n), onMessage: (t) => invHud.message(t) });
const gather = createGather({ camera, inventory, onGain: (id, n) => invHud.gained(id, n), onMessage: (t) => invHud.message(t) });
const combatHud = createCombatHud({ camera });
const hitFx = createHitFx({ scene, hud: combatHud });
const windFx = createWindFx({ scene, camera }); // 風の演出（ブンブン）
const mudFx = createMudFx({ scene, fx: hitFx }); // 泥と歯の火花（犬）
const rockFx = createRockFx({ scene, fx: hitFx, player }); // 岩と土（採掘ロボ）
// 弾・敵がぶつかる木・岩・建築パーツ
const blockers = (x, z, r) => (world.colliders?.(x, z, r) ?? []).concat(structuresOf.get(world)?.query(x, z, r) ?? []);
const combat = createCombat({ camera, inventory, player, fx: hitFx, wind: windFx, mud: mudFx, rock: rockFx, hud: combatHud, blockers, onDead: (m) => spawner.onDead(m), playerDead: () => stats.state.dead, onPlayerHit: (n, m, atk) => pc.onHit(n, m, atk), onMessage: (t) => invHud.message(t), onAlarm: (cam) => spawner.call(cam) });
player.setBodies((x, z, r) => combat.bodies(x, z, r)); // 敵にめり込まない（player.md）
const spawner = createSpawner({ combat, time, player }); // 敵の出方（islands.md）
const pc = createPlayerCombat({ player, stats, hud: combatHud, statusHud, onStagger: (m, secs) => combat.stagger(m, secs) });
const tools = createTools({ camera, scene, inventory, now: () => time.total, onGain: (id, n) => invHud.gained(id, n), onMessage: (t) => invHud.message(t) });
const ranged = createRanged({
  scene, camera, inventory, combat, player, hud: combatHud, onTarget: (t) => tools.hitTarget(t), onMessage: (t) => invHud.message(t),
  blockers,
});
// 手に持つ物の見た目（道具は柄を握る。素材は手のひらにのせる）
let heldId = null, torchFire = null, torchT = 0, stationT = 0;
inventory.onChange(() => {
  const s = inventory.held(), id = s ? s.id : null;
  if (id === heldId) return;
  heldId = id;
  torchFire = null;
  build.setHammer(!!id && ITEMS[id].tool === 'hammer'); // 石のハンマーを持っている間だけ建築できる（右クリックでメニュー）
  player.arms.setWeapon(weaponMotion(id)); // 振り方と重さ（avatar/fpMotion.js）
  if (!id) return player.arms.hold(null);
  const tool = !!ITEMS[id].tool;
  const mesh = ITEMS[id].tool === 'gun' ? gunRig(id) : itemMesh(id); // 銃は撃鉄・弾倉が動く形
  player.arms.hold(mesh, tool ? gripOf(id) : -0.1, ITEMS[id].hold ?? (tool ? 0.7 : 0.55), ITEMS[id].tool === 'spear', tool, !!ITEMS[id].top, ITEMS[id].tool === 'gun' ? PISTOL_HOLD : null);
  if (id === 'torch') { // 持っている間だけ明るい。炎は光の影響を受けない材質で、まわりを照らす
    torchFire = campfire(rng(3), { base: false });
    torchFire.root.scale.setScalar(0.5);
    torchFire.root.position.y = 0.75;
    mesh.add(torchFire.root);
  }
  if (id === 'lantern') { // ランタン: 白い光（半径 14m）。松明と同じく持っている間だけ減る
    const light = new THREE.PointLight(P.lanternGlow, 3, 14, 1.6);
    light.position.y = 0.1;
    mesh.add(light);
    torchFire = { root: light, update() {} };
  }
  if (id === 'glowShroom') { // 光るキノコ: 青緑の弱い光（松明の半分）。ひだは光の影響を受けない材質
    mesh.add(new THREE.Mesh(glowShroomGill(rng(4)), GLOW_MAT));
    const light = new THREE.PointLight(P.magic[2], 1.5, 7, 1.6);
    light.position.y = 0.2;
    mesh.add(light);
    torchFire = { root: light, update() {} };
  }
});

// ---- 世界: 見本の景色と島。島は最初に選ばれたときに作る ----
const sample = buildSampleScene();
scene.add(sample.group);
let island = null, showcase = null, range = null, islandId = 'crash', world = null, gridOn = false, debugOn = false;

function useWorld(w) {
  world = w;
  sample.group.visible = w === sample;
  if (island) island.group.visible = w === island;
  if (showcase) showcase.group.visible = w === showcase;
  if (range) range.group.visible = w === range;
  sky.setFog(...w.fog);
  w.setGrid(gridOn);
  w.setDebug(debugOn);
  if (w !== island) sky.setHour(12); // 島以外は昼で止める
  if (!structuresOf.has(w)) {
    const s = createStructures(w);
    w.group.add(s.group);
    structuresOf.set(w, s);
    if (w.terrain?.triangles) { // 物理といかだ（docs/rules/physics.md）
      w.physics = createPhysics(w, s);
      w.vehicles = createVehicles(w, s, player, { onMessage: (m) => invHud.message(m) });
      w.refill?.(); // 射撃訓練島: 地面の武器（物理の落とし物）
    }
  }
  w.physics?.setDebug(debugOn);
  player.setWorld(w, structuresOf.get(w));
  build.setWorld(w, structuresOf.get(w));
  gather.setWorld(w);
  combat.setWorld(w);
  spawner.setWorld(w);
  hitFx.setWorld(w);
  ranged.setWorld(w);
  tools.setWorld(w);
}
async function makeIsland(id, onProgress) {
  if (island) {
    structuresOf.delete(island);
    island.physics?.dispose();
    scene.remove(island.group);
    island.group.traverse((o) => o.geometry?.dispose());
  }
  islandId = id;
  island = await buildIsland(id, onProgress);
  scene.add(island.group);
}

// 見本の猫: 円を描いて歩く（1人称では「ほかのプレイヤー」の見え方の確認になる）
const cat = createSimple();
scene.add(cat.root);
const RADIUS = 2;
let walking = true, angle = 0;

const controls = new OrbitControls(camera, dom);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;

// ---- 画面の切り替え: menu / viewer / fps / dead（倒れた画面） ----
let mode = 'menu', played = false; // played: 1人称のあとのメニューは、その場の景色のまま止める
const viewerHud = createViewerHud({
  onToggleWalk: () => (walking = !walking),
  onFocusCat: () => {
    const p = cat.root.position, a = cat.root.rotation.y + 0.5;
    controls.target.set(p.x, p.y + 0.9, p.z);
    camera.position.set(p.x + Math.sin(a) * 3.2, p.y + 1.5, p.z + Math.cos(a) * 3.2);
  },
  onMenu: () => setMode('menu'),
});
const playHud = createPlayHud();
// 同じ世界に戻るときは、いた場所から続ける
const play = (w) => { if (w !== world) useWorld(w); setMode('fps'); lockPointer(); };
let atTitle = true; // メニューがタイトルか一時停止か
// 開発中だけ: 持ち物の奥（手に持つ列のほか）に素材を多めに入れて始める（survival.md「セーブ」）
// 素材はどれも 50 個（重ねられる数が少ない物はその数）。設計図は全部読んだことにする
const DEV_KIT = ['wood', 'stick', 'stone', 'bamboo', 'rope', 'fiber', 'flint', 'clay', 'brick', 'palmLeaf', 'feather',
  'coal', 'copperOre', 'ironOre', 'copperIngot', 'ironIngot', 'copperWire', 'screw', 'scrap', 'battery', 'soil', 'seedPotato', 'hempSeed'];
const DEV_SLOTS = [...Array(SLOTS - BAR).keys()].map((k) => BAR + k).concat([1, 2, 3, 4, 5]); // 奥から入れ、あふれたら手に持つ列（0 は素手のまま）
function devKit() {
  if (!import.meta.env.DEV) return;
  DEV_KIT.forEach((id, k) => { inventory.slots[DEV_SLOTS[k]] = { id, n: Math.min(50, ITEMS[id].stack) }; });
  for (const it of Object.values(ITEMS)) if (it.bp) blueprints.learn(it.bp);
  inventory.changed();
}
// はじめから: 新しい島、持ち物・HP・時刻も最初から
// kit: 開発用メニューの「墜落島（素材つき）」。ふつうは何も持たずに残骸のそばで起きる（islands.md「始まり」）
function newGame(kit = false) {
  spawner.load(null); // 倒した敵の記録を消す
  inventory.slots.fill(null);
  inventory.select(0);
  blueprints.reset();
  if (kit) devKit();
  inventory.changed();
  stats.reset();
  time.reset();
  buildThen('crash', () => play(island));
}
// 設定（ui.md「設定と舵の表示」）: マウスの感度・視野の広さ・UI の大きさ
const settings = loadSettings();
const fovOf = (m) => (m === 'fps' || m === 'dead' ? vfovOf(settings.hfov) : 45); // 1人称は設定の視野角、見本の観察は 45 度
function applySettings(v) {
  player.setSensitivity(sensRad(v.vsens));
  camera.fov = fovOf(mode);
  camera.updateProjectionMatrix();
  document.documentElement.style.setProperty('--ui-zoom', v.ui);
}
applySettings(settings);
const menu = createMenu({
  settings, onSettings: applySettings,
  onStart: () => newGame(),
  onContinue: () => { if (island) play(island); else loadGame(); },
  onResume: () => { setMode('fps'); lockPointer(); },
  onTitle: () => { atTitle = true; setMode('menu'); },
  dev: {
    onIsland: () => newGame(true),
    onSample: () => play(sample),
    onViewer: () => { useWorld(sample); setMode('viewer'); },
    // モデル確認島: 開発中だけ。最初に選ばれたときに作る
    onShowcase: import.meta.env.DEV ? () => import('./world/showcase.js').then(({ buildShowcase }) => {
      if (!showcase) { showcase = buildShowcase(); scene.add(showcase.group); }
      play(showcase);
    }) : null,
    // 射撃訓練島（islands.md）: 開発中だけ。最初に選ばれたときに作る
    onRange: import.meta.env.DEV ? () => import('./world/range.js').then(({ buildRange }) => {
      if (!range) { range = buildRange({ summon: (k, x, z) => { const m = combat.spawn(k, x, z), s = player.state; m.yaw = Math.atan2(s.x - x, s.z - z); }, clear: () => [...combat.list].forEach((m) => m.fixed || combat.remove(m)) }); scene.add(range.group); }
      play(range);
    }) : null,
  },
});
// ---- セーブ（save/save.js）: 一時停止したとき・60 秒ごと・ページを閉じるときに自動で保存。「つづきから」で戻す ----
const gameRef = () => ({ islandId, blueprints, spawner, island, structures: structuresOf.get(island), inventory, time, stats, player });
function saveNow() { if (island && world === island && mode === 'fps' && !sleeping) save(gameRef()); }
function loadGame() {
  const d = readSave();
  if (d) buildThen(d.island, () => { play(island); restore(d, gameRef()); });
}
addEventListener('pagehide', saveNow);
// 島づくりは少し時間がかかるので、ロード画面を出して作る（ui.md「ロード画面」）
const loading = createLoading();
let building = false;
async function buildThen(id, done) {
  if (building) return; // 作っている間のボタンの連打
  building = true;
  loading.show(ISLANDS[id].name);
  await makeIsland(id, (p, label) => loading.set(p, label));
  loading.set(1, 'できた');
  menu.setMessage(`島: ${island.name}`);
  done();
  loading.hide();
  building = false;
}

function setMode(m) {
  if (m === 'menu' && mode === 'fps') saveNow(); // 一時停止で保存
  mode = m;
  menu.hidden = m !== 'menu';
  viewerHud.hidden = m !== 'viewer';
  playHud.hidden = m !== 'fps';
  invHud.hidden = m !== 'fps';
  statusHud.hidden = (m !== 'fps' && m !== 'dead') || (world !== island && !world?.range);
  deathScreen.hidden = m !== 'dead';
  if (m !== 'fps') keysPanel.setOpen(false);
  if (m !== 'fps') buildMenu.setOpen(false);
  controls.enabled = m === 'viewer';
  player.setActive(m === 'fps');
  build.setEnabled(m === 'fps');
  camera.fov = fovOf(m);
  camera.updateProjectionMatrix();
  if (m === 'viewer') {
    camera.rotation.order = 'XYZ';
    camera.position.set(15, 11, 17);
    controls.target.set(0, 0.8, 1);
    played = false;
  }
  if (m === 'fps') { camera.rotation.order = 'YXZ'; played = true; atTitle = false; }
  menu.setPaused(played && !atTitle);
  menu.setCanContinue(!!island || hasSave());
}
camera.position.set(15, 11, 17);
controls.target.set(0, 0.8, 1);
useWorld(sample);
setMode('menu');

// 遊び中の操作（controls.js）
const input = createControls({
  dom, lockPointer, invHud, buildMenu, build, gather, combat, pc, ranged, tools, farm, inventory, stats, blueprints, sleep, canSleep: () => time.isNight, player, keysPanel,
  mode: () => mode, setMode, held: () => heldId, vehicles: () => world.vehicles,
  toggleGrid: () => world.setGrid(gridOn = !gridOn),
  toggleDebug: () => { world.setDebug(debugOn = !debugOn); world.physics?.setDebug(debugOn); },
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
function frame(step) { // step: 確認用に決まった秒だけ進める（__game.run）
  const dt = step ?? Math.min(clock.getDelta(), 0.05), t = step ? (clock.elapsedTime += step) : clock.elapsedTime;
  if (walking) angle += dt * 0.55;
  const c = world.catCenter;
  const x = c.x + Math.cos(angle) * RADIUS, z = c.z + Math.sin(angle) * RADIUS;
  cat.root.position.set(x, world.terrain.heightAt(x, z), z);
  cat.root.rotation.y = Math.atan2(-Math.sin(angle), Math.cos(angle));
  cat.update(dt, { moving: walking, speed: 1 });
  world.update(t, camera.position);
  if (world.fogAt) { // 場所ごとの霧（立ち枯れの沼。spots.js）: ふだんのかすみと、濃い霧（25m で見えない）を混ぜる
    const k = world.fogAt(camera.position.x, camera.position.z);
    sky.setFog(world.fog[0], world.fog[1] + (25 - world.fog[1]) * k);
  }
  if (world.terrain?.ref) world.terrain.ref.y = player.state.y + 2; // 演出の地面の高さのめやす（洞窟の中では洞窟の床。terrain.js groundNear）
  sky.setDim(world.caveDim ? world.caveDim(camera.position) : 0); // 洞窟の奥は暗い（caveCarve.js）
  if (mode === 'fps' || mode === 'dead') world.physics?.update(dt, player.state); // いかだが動いてから、乗っているプレイヤーを動かす
  player.update(dt);
  combat.update(t, dt, fighting());
  combatHud.hidden(mode !== 'fps');
  combatHud.update(dt);
  if (fighting()) pc.update(dt, heldId);
  if (survival()) spawner.update(dt);
  if (mode === 'fps') ranged.update(dt, heldId);
  combatHud.setCooldown(mode === 'fps' ? ranged.cdFrac(heldId) ?? pc.cdFrac() : null); // 照準の下の攻撃間隔の線
  combatHud.setLowHp(stats.state.hp / MAX_HP, mode !== 'fps' || stats.state.dead); // HP が低いと画面のふちが赤く脈打つ
  build.update();
  buildHud.update(mode === 'fps' ? build.status() : null);
  statusHud.setUnderwater(mode === 'fps' && player.state.underwater);
  if (mode === 'fps') invHud.setAim(input.aimHint());
  aimMark.update(mode === 'fps' && !build.active && !input.uiOpen() ? gather.aimedEntity() : null);
  if (survival()) {
    stats.update(dt, { nearFire: nearFire(), underwater: player.state.underwater });
    world.planting?.update(time.total);
    time.update(dt);
    sky.setHour(time.hour);
    statusHud.update(stats.state, time);
    if ((saveT += dt) >= 60) { saveT = 0; saveNow(); }
  } else if (fighting()) statusHud.update(stats.state, time); // 訓練島: HP とスタミナだけ（空腹・時刻は進まない）
  structuresOf.get(world)?.update(dt, mode === 'fps');
  if (invHud.open && (stationT += dt) > 0.15) { stationT = 0; invHud.refreshStation(); } // 開いている設備の窓（進み具合・燃料）
  world.vehicles?.update(dt, mode === 'fps');
  if (mode === 'fps') tools.update(dt, heldId);
  if (torchFire && mode === 'fps') { // 松明は持っている間だけ燃える
    torchFire.update(t);
    if (!sleeping && (torchT += dt) >= 1) {
      torchT -= 1;
      const broke = inventory.wear();
      if (broke) invHud.message(broke === 'ランタン' ? 'ランタンの電池が切れた' : broke === '光るキノコ' ? '光るキノコが光らなくなった' : '松明が燃え尽きた');
    }
  }
  if (mode === 'viewer' || (mode === 'menu' && !played)) controls.update();
  sky.update(dt, camera.position);
  // 世界を描いてから、奥行きを消して 1人称の腕と持つ物を重ねる
  renderer.shadowMap.needsUpdate = true;
  renderer.clear();
  renderer.render(scene, camera);
  if (mode === 'fps') {
    renderer.clearDepth();
    const bg = scene.background;
    scene.background = null; // 背景の色があると、描く前に画面が塗りつぶされる
    camera.layers.set(VIEW_LAYER);
    renderer.render(scene, camera);
    camera.layers.set(0);
    scene.background = bg;
  }
}
renderer.setAnimationLoop(() => frame());

// 確認用（開発中だけ）: ブラウザのコンソールから状態を見たり動かしたりする
if (import.meta.env.DEV) {
  // run(ms): 画面が隠れていても ms だけ進める（確認用）
  window.__game = { fx: hitFx, wind: windFx, pc, ranged, spawner, run: async (ms) => { for (let i = 0; i < ms / 33; i++) { frame(1 / 30); if (i % 10 === 9) await new Promise((ok) => setTimeout(ok, 0)); } }, player, inventory, combat, mob: (kind = 'drone', d = 6) => { const s = player.state; combat.spawn(kind, s.x - Math.sin(s.yaw) * d, s.z - Math.cos(s.yaw) * d); return kind; }, blueprints, invHud, sleep, saveNow, loadGame, vitals: stats, time, gather, tools, build, sample, camera, cat, controls, get setBuildMenuOpen() { return input.setBuildMenuOpen; }, get world() { return world; }, get st() { return structuresOf.get(world); }, get mode() { return mode; } };
  import('./debug.js').then(({ createDebug, modelStats, createPhysicsTest }) => { window.__game.debug = createDebug(window.__game); window.__game.stats = modelStats; window.__game.physics = createPhysicsTest(window.__game); });
}
