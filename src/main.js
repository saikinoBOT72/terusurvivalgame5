import * as THREE from 'three';
import { createSky } from './world/sky.js';
import { buildIsland } from './world/island.js';

import { ISLANDS } from './world/islandMap.js';
import { createLoading } from './ui/loading.js';
import { loadSettings, sensRad, vfovOf } from './ui/settings.js';
import { createSimple } from './avatar/simple.js'; // 仮のキャラ。猫に戻すときは cat.js（git の最初のコミット）の createCat
import { createFirstPerson } from './player/firstPerson.js';
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

import { ITEMS } from './survival/items.js';
import { createKeyItems } from './survival/keyItems.js';
import { createEquip } from './survival/equip.js';
import { createInventoryHud } from './ui/inventoryHud.js';

import './input/mouseKeys.js';
import './ui/kit.css';
import './ui/ui.css';
import { perf } from './perf.js';
import { createRenderer } from './game/renderer.js';
import { createHeld } from './game/held.js';
import { createBuilding } from './game/building.js';
import { createLife } from './game/life.js';
import { devKit } from './game/devKit.js';
import { attachWorld } from './game/worlds.js';
import { applyUiColors, createMenu, createPlayHud, createKeysPanel, bindFullscreenKey } from './ui/hud.js';
import { MAX_HP } from './survival/stats.js';
import { createDayNight } from './world/dayNight.js';
import { createStatusHud } from './ui/statusHud.js';
import { createAimHighlight } from './ui/aimHighlight.js';
import { createFpsMeter } from './ui/fpsMeter.js';
import { createControls } from './controls.js';
import { setTouchMode } from './input/touch.js';
import { createTouchHud } from './ui/touchHud.js';
import { openTouchEdit } from './ui/touchEdit.js';

import { createTools } from './survival/tools.js';
import { hasSave, readSave, save, restore } from './save/save.js';
import { createFarm } from './survival/farm.js';

applyUiColors();
bindFullscreenKey();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.05, 1200);
scene.add(camera);
const view = createRenderer(camera), { renderer, dom } = view, lockPointer = view.lockPointer; // game/renderer.js
const sky = createSky(scene);
// サバイバル（HP・空腹・時刻）は島を 1人称で遊んでいる間だけ進む。眠って暗転している間は止める
let saveT = 0;
const survival = () => mode === 'fps' && world === island && !life.sleeping;
const fighting = () => mode === 'fps' && (world === island || world?.range) && !life.sleeping; // 戦い（敵の動き・スタミナ）は射撃訓練島でも
const player = createFirstPerson({ camera, dom, onLand: (h) => { if (survival()) stats.fell(h); } });
const structuresOf = new Map(); // 世界ごとの建築パーツ
const keyItems = createKeyItems(); // 大事な物（設計図など。survival.md「持ち物の広さ・大事な物・装備」）
const equip = createEquip(); // 装備の枠
const inventory = createInventory(keyItems);
const invHud = createInventoryHud(inventory, { vitals: () => stats.state, known: (rc) => keyItems.hasBp(rc.bp), keyItems, equip }); // known は開いているときだけ呼ばれる（stats はこのあとで作る）
keyItems.onAdd = (id) => invHud.message(`${ITEMS[id].name}を手に入れた`);
const statusHud = createStatusHud();
const keysPanel = createKeysPanel();
const aimMark = createAimHighlight(scene);
const time = createDayNight();
const life = createLife({ player, inventory, invHud, statusHud, sky, time, structuresOf, world: () => world, setMode: (m) => setMode(m), lockPointer }); // game/life.js
const { stats, deathScreen } = life;
const { build, hud: buildHud, menu: buildMenu } = createBuilding({ scene, camera, dom, player, inventory, invHud, keyItems, world: () => world, closeMenu: () => input.setBuildMenuOpen(false) }); // 建築（game/building.js）
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
const held = createHeld({ inventory, player, build, onMessage: (t) => invHud.message(t) }); // 手に持つ物の見た目（game/held.js）
let stationT = 0;

// ---- 世界: 島は起動したときに作り、タイトルの後ろに映す（fresh: まだ遊んでいない島。「はじめから」でそのまま使う） ----
let island = null, islandFresh = false, showcase = null, range = null, islandId = 'crash', world = null, gridOn = false, debugOn = false;

function useWorld(w) {
  world = w;
  if (island) island.group.visible = w === island;
  if (showcase) showcase.group.visible = w === showcase;
  if (range) range.group.visible = w === range;
  sky.setFog(...w.fog);
  if (w !== island) sky.setHour(12); // 島以外は昼で止める
  attachWorld(w, { structuresOf, player, build, systems: [gather, combat, spawner, hitFx, ranged, tools], onMessage: (m) => invHud.message(m), gridOn, debugOn }); // game/worlds.js
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

// 見本の猫: 島の始まりのそばで円を描いて歩く（1人称では「ほかのプレイヤー」の見え方の確認になる）
const cat = createSimple();
scene.add(cat.root);
const RADIUS = 2;
let angle = 0;

// ---- 画面の切り替え: menu / fps / dead（倒れた画面） ----
let mode = 'menu', played = false; // played: 1人称のあとのメニューは、その場の景色のまま止める
const playHud = createPlayHud();
// 同じ世界に戻るときは、いた場所から続ける
const play = (w) => { if (w === island) islandFresh = false; if (w !== world) useWorld(w); setMode('fps'); lockPointer(); };
// タイトルの景色: 始まりの浜の沖から、島のほうを見る
function titleView() {
  const s = island.spawn, y = island.terrain.heightAt(s.x, s.z);
  camera.rotation.order = 'XYZ';
  camera.position.set(s.x + 10, y + 9, s.z + 22);
  camera.lookAt(s.x - 6, y + 3, s.z - 25);
}
let atTitle = true; // メニューがタイトルか一時停止か
// はじめから: 新しい島、持ち物・HP・時刻も最初から
// kit: 開発用メニューの「墜落島（素材つき）」。ふつうは何も持たずに残骸のそばで起きる（islands.md「始まり」）
function newGame(kit = false) {
  spawner.load(null); // 倒した敵の記録を消す
  inventory.reset();
  inventory.select(0);
  keyItems.reset();
  equip.reset();
  if (kit) devKit(inventory, keyItems);
  inventory.changed();
  stats.reset();
  time.reset();
  buildThen('crash', () => play(island));
}
// 設定（ui.md「設定と舵の表示」）: マウスの感度・視野の広さ・UI の大きさ
const settings = loadSettings();
const fpsMeter = createFpsMeter({ fps: perf.fps });
const fovOf = (m) => (m === 'fps' || m === 'dead' ? vfovOf(settings.hfov) : 45); // 1人称は設定の視野角、タイトルは 45 度
function applySettings(v) {
  player.setSensitivity(sensRad(v.vsens));
  camera.fov = fovOf(mode);
  camera.updateProjectionMatrix();
  document.documentElement.style.setProperty('--ui-zoom', v.ui);
  fpsMeter.setOn(v.fps);
  setTouchMode(v.touch, v.tsens);
}
applySettings(settings);
const menu = createMenu({
  settings, onSettings: applySettings, onTouchEdit: () => openTouchEdit(() => touchHud.layout()),
  onStart: () => newGame(),
  onContinue: () => { if (island && !islandFresh) play(island); else loadGame(); },
  onResume: () => { setMode('fps'); lockPointer(); },
  onTitle: () => { atTitle = true; setMode('menu'); },
  dev: {
    onIsland: () => newGame(true),
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
const gameRef = () => ({ islandId, keyItems, equip, spawner, island, structures: structuresOf.get(island), inventory, time, stats, player });
function saveNow() { if (island && world === island && mode === 'fps' && !life.sleeping) save(gameRef()); }
function loadGame() {
  const d = readSave();
  if (d) buildThen(d.island, () => { play(island); restore(d, gameRef()); });
}
addEventListener('pagehide', saveNow);
addEventListener('beforeunload', (e) => { if (mode === 'fps') e.preventDefault(); }); // 遊んでいる間は、Ctrl+W などで閉じる前に確かめる（player.md「動き方」）
// 島づくりは少し時間がかかるので、ロード画面を出して作る（ui.md「ロード画面」）
const loading = createLoading();
let building = false;
async function buildThen(id, done) {
  if (building) return; // 作っている間のボタンの連打
  if (island && islandFresh && islandId === id) return done(); // タイトルの後ろの、まだ遊んでいない島をそのまま使う
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
  playHud.hidden = m !== 'fps';
  invHud.hidden = m !== 'fps';
  statusHud.hidden = (m !== 'fps' && m !== 'dead') || (world !== island && !world?.range);
  deathScreen.hidden = m !== 'dead';
  if (m !== 'fps') keysPanel.setOpen(false);
  if (m !== 'fps') buildMenu.setOpen(false);
  player.setActive(m === 'fps');
  build.setEnabled(m === 'fps');
  camera.fov = fovOf(m);
  camera.updateProjectionMatrix();

  if (m === 'fps') { camera.rotation.order = 'YXZ'; played = true; atTitle = false; }
  menu.setPaused(played && !atTitle);
  menu.setCanContinue((!!island && !islandFresh) || hasSave());
}
setMode('menu');
buildThen('crash', () => { islandFresh = true; useWorld(island); titleView(); setMode('menu'); });

// 遊び中の操作（controls.js）
const input = createControls({
  dom, lockPointer, invHud, buildMenu, build, gather, combat, pc, ranged, tools, farm, inventory, stats, sleep: life.sleep, canSleep: () => time.isNight, player, keysPanel,
  mode: () => mode, setMode, held: () => held.id, vehicles: () => world.vehicles,
  toggleGrid: () => world.setGrid(gridOn = !gridOn),
  toggleDebug: () => { world.setDebug(debugOn = !debugOn); world.physics?.setDebug(debugOn); },
});
// タッチの画面（ui/touchHud.js）
const touchHud = createTouchHud({ dom, mode: () => mode, uiOpen: input.uiOpen, placing: () => build.placing, select: (i) => inventory.select(i) });


const clock = new THREE.Clock();
function frame(step) { // step: 確認用に決まった秒だけ進める（__game.run）
  const dt = step ?? Math.min(clock.getDelta(), 0.05), t = step ? (clock.elapsedTime += step) : clock.elapsedTime;
  perf.start();
  fpsMeter.update(dt);
  if (!world) return view.draw(scene, false); // 起動して島ができるまで（空だけ）
  angle += dt * 0.55;
  const c = world.catCenter;
  const x = c.x + Math.cos(angle) * RADIUS, z = c.z + Math.sin(angle) * RADIUS;
  cat.root.position.set(x, world.terrain.heightAt(x, z), z);
  cat.root.rotation.y = Math.atan2(-Math.sin(angle), Math.cos(angle));
  cat.update(dt, { moving: true, speed: 1 });
  world.update(t, camera.position);
  if (world.fogAt) { // 場所ごとの霧（立ち枯れの沼。spots.js）: ふだんのかすみと、濃い霧（25m で見えない）を混ぜる
    const k = world.fogAt(camera.position.x, camera.position.z);
    sky.setFog(world.fog[0], world.fog[1] + (25 - world.fog[1]) * k);
  }
  if (world.terrain?.ref) world.terrain.ref.y = player.state.y + 2; // 演出の地面の高さのめやす（洞窟の中では洞窟の床。terrain.js groundNear）
  sky.setDim(world.caveDim ? world.caveDim(camera.position) : 0); // 洞窟の奥は暗い（caveCarve.js）
  perf.lap('世界');
  if (mode === 'fps' || mode === 'dead') world.physics?.update(dt, player.state); // いかだが動いてから、乗っているプレイヤーを動かす
  perf.lap('物理');
  player.update(dt);
  perf.lap('プレイヤー');
  combat.update(t, dt, fighting());
  combatHud.hidden(mode !== 'fps');
  combatHud.update(dt);
  if (fighting()) pc.update(dt, held.id);
  if (survival()) spawner.update(dt);
  perf.lap('敵');
  if (mode === 'fps') ranged.update(dt, held.id);
  combatHud.setCooldown(mode === 'fps' ? ranged.cdFrac(held.id) ?? pc.cdFrac() : null); // 照準の下の攻撃間隔の線
  combatHud.setStance(mode === 'fps' && !player.state.ride ? ({ sneak: '忍び足', crouch: 'しゃがみ' })[player.state.gait] ?? null : null); // 動き方の札
  combatHud.setLowHp(stats.state.hp / MAX_HP, mode !== 'fps' || stats.state.dead); // HP が低いと画面のふちが赤く脈打つ
  build.update();
  buildHud.update(mode === 'fps' ? build.status() : null);
  statusHud.setUnderwater(mode === 'fps' && player.state.underwater);
  if (mode === 'fps') invHud.setAim(input.aimHint());
  aimMark.update(mode === 'fps' && !build.active && !input.uiOpen() ? gather.aimedEntity() : null);
  touchHud.update();
  perf.lap('照準・UI');
  if (survival()) {
    stats.update(dt, { nearFire: life.nearFire(), underwater: player.state.underwater });
    world.planting?.update(time.total);
    time.update(dt);
    sky.setHour(time.hour);
    statusHud.update(stats.state, time);
    if ((saveT += dt) >= 60) { saveT = 0; saveNow(); }
  } else if (fighting()) statusHud.update(stats.state, time); // 訓練島: HP とスタミナだけ（空腹・時刻は進まない）
  perf.lap('サバイバル');
  structuresOf.get(world)?.update(dt, mode === 'fps');
  if (invHud.open && (stationT += dt) > 0.15) { stationT = 0; invHud.refreshStation(); } // 開いている設備の窓（進み具合・燃料）
  world.vehicles?.update(dt, mode === 'fps');
  if (mode === 'fps') tools.update(dt, held.id);
  if (mode === 'fps') held.update(t, dt, life.sleeping);

  sky.update(dt, camera.position);
  perf.lap('建築・乗り物・空');
  view.draw(scene, mode === 'fps');
  perf.lap('描画');
}
renderer.setAnimationLoop(() => frame());

// 確認用（開発中だけ）: ブラウザのコンソールから状態を見たり動かしたりする
if (import.meta.env.DEV) {
  // run(ms): 画面が隠れていても ms だけ進める（確認用）
  window.__game = { renderer, perf, fx: hitFx, wind: windFx, pc, ranged, spawner, run: async (ms) => { for (let i = 0; i < ms / 33; i++) { frame(1 / 30); if (i % 10 === 9) await new Promise((ok) => setTimeout(ok, 0)); } }, player, inventory, combat, mob: (kind = 'drone', d = 6) => { const s = player.state; combat.spawn(kind, s.x - Math.sin(s.yaw) * d, s.z - Math.cos(s.yaw) * d); return kind; }, keyItems, equip, invHud, sleep: life.sleep, saveNow, loadGame, vitals: stats, time, gather, tools, build, camera, cat, get setBuildMenuOpen() { return input.setBuildMenuOpen; }, get world() { return world; }, get st() { return structuresOf.get(world); }, get mode() { return mode; } };
  import('./debug.js').then(({ createDebug, modelStats, createPhysicsTest }) => { window.__game.debug = createDebug(window.__game); window.__game.stats = modelStats; window.__game.physics = createPhysicsTest(window.__game); });
}
