import * as THREE from 'three';
import { createSky } from './world/sky.js';
import { loadSettings, sensRad, vfovOf, PRESETS } from './ui/settings.js';
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
import { createSandFx } from './mobs/sandFx.js';
import { createCombatHud } from './ui/combatHud.js';
import { createPlayerCombat } from './combat/playerCombat.js';
import { createRanged } from './combat/ranged.js';

import { ITEMS } from './survival/items.js';
import { createKeyItems } from './survival/keyItems.js';
import { createEquip } from './survival/equip.js';
import { createInventoryHud } from './ui/inventoryHud.js';

import './input/mouseKeys.js';
import './input/mobileGuard.js';
import './ui/kit.css';
import './ui/ui.css';
import { perf } from './perf.js';
import { createRenderer } from './game/renderer.js';
import { createGrade } from './world/grade.js';
import { setFogQuality } from './world/fog.js';
import { sound } from './audio/sound.js';
import { createHeld } from './game/held.js';
import { createBuilding } from './game/building.js';
import { createLife } from './game/life.js';
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
import { createModes } from './modes/modes.js';
import { createSurvival } from './modes/survival.js';
import { createPvp } from './modes/pvp.js';
import { createFarm } from './survival/farm.js';
addEventListener('pointerdown', () => sound.start()); // ブラウザは最初のクリックまで音を出せない（sound.md）

applyUiColors();
bindFullscreenKey();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.05, 1200);
scene.add(camera);
const view = createRenderer(camera), { renderer, dom } = view, lockPointer = view.lockPointer; // game/renderer.js
const grade = createGrade(view.fx); // 画面の色（world/grade.js）
const sky = createSky(scene);
// 戦い（敵の動き・スタミナ）は、そのモードが戦う世界を 1人称で遊んでいる間だけ。眠って暗転している間は止める（modes/）
const fighting = () => mode === 'fps' && modes.cur.fighting(world) && !life.sleeping;
const player = createFirstPerson({ camera, dom, onLand: (h) => { if (mode === 'fps' && modes.cur.survival(world) && !life.sleeping) stats.fell(h); } });
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
const life = createLife({ player, inventory, invHud, statusHud, sky, time, structuresOf, world: () => world, pvp: () => modes.cur.pvp, setMode: (m) => setMode(m), lockPointer, gear: () => equip.stats(), grade }); // game/life.js
const { stats, deathScreen } = life;
const { build, hud: buildHud, menu: buildMenu, mapWin } = createBuilding({ scene, camera, dom, player, inventory, invHud, keyItems, world: () => world, closeMenu: () => input.setBuildMenuOpen(false), openMenu: () => input.setBuildMenuOpen(true) }); // 建築（game/building.js）
const farm = createFarm({ inventory, onGain: (id, n) => invHud.gained(id, n), onMessage: (t) => invHud.message(t) });
const gather = createGather({ camera, inventory, onGain: (id, n) => invHud.gained(id, n), onMessage: (t) => invHud.message(t) });
const combatHud = createCombatHud({ camera });
const hitFx = createHitFx({ scene, hud: combatHud });
const windFx = createWindFx({ scene, camera }); // 風の演出（ブンブン）
const mudFx = createMudFx({ scene, fx: hitFx }); // 泥と歯の火花（犬）
const rockFx = createRockFx({ scene, fx: hitFx, player }); // 岩と土（採掘ロボ）
const sandFx = createSandFx({ scene, fx: hitFx }); // 砂と水（カニ）
// 弾・敵がぶつかる木・岩・建築パーツ
const blockers = (x, z, r) => (world.colliders?.(x, z, r) ?? []).concat(structuresOf.get(world)?.query(x, z, r) ?? []);
const combat = createCombat({ camera, inventory, player, fx: hitFx, wind: windFx, mud: mudFx, rock: rockFx, sand: sandFx, hud: combatHud, blockers, onDead: (m) => spawner.onDead(m), playerDead: () => stats.state.dead, onPlayerHit: (n, m, atk) => pc.onHit(n, m, atk), onMessage: (t) => invHud.message(t), onAlarm: (cam) => spawner.call(cam), onGain: (id, n) => invHud.gained(id, n), hasBp: (bp) => keyItems.hasBp(bp) });
player.setBodies((x, z, r) => combat.bodies(x, z, r)); // 敵にめり込まない（player.md）
const spawner = createSpawner({ combat, time, player }); // 敵の出方（islands.md）
const pc = createPlayerCombat({ player, stats, hud: combatHud, statusHud, gear: () => equip.stats(), onStagger: (m, secs) => combat.stagger(m, secs) });
const tools = createTools({ camera, scene, inventory, now: () => time.total, onGain: (id, n) => invHud.gained(id, n), onMessage: (t) => invHud.message(t) });
const ranged = createRanged({
  scene, camera, inventory, combat, player, hud: combatHud, onTarget: (t) => tools.hitTarget(t), onMessage: (t) => invHud.message(t),
  blockers,
});
const held = createHeld({ inventory, player, build, onMessage: (t) => invHud.message(t) }); // 手に持つ物の見た目（game/held.js）
let stationT = 0;

// ---- 世界とモード（docs/rules/modes.md）: サバイバル（島・射撃訓練島）、PvP（マップ作り）、見るだけ（モデル確認島） ----
let showcase = null, world = null, gridOn = false, debugOn = false;
const shown = new Set(); // 作った世界（見えるのは今の世界だけ）
function useWorld(w) {
  world = w;
  modes.use(modes.of(w)); // モードが替わるとき: 持ち物の入れ替えなど
  shown.add(w);
  for (const o of shown) { if (!o.group.parent) shown.delete(o); else o.group.visible = o === w; } // 作り直して外した島は忘れる
  sky.setOverride(null); // マップ作りの空と色の上書きは、ほかの世界へ持ち出さない（game/mapEnv.js）
  sky.setFog(w.fog[0], modes.cur.pvp ? Math.max(40, w.fog[1]) : w.fog[1]); // PvP の世界は 40m より先まで見える（style.md「画面の効果」）
  sky.setHeightFog(w.heightFog); // 低い所の霧（world/fog.js）
  if (!modes.cur.survival(w)) sky.setHour(w.hour ?? 12); // 島以外は止める（ふつうは昼。射撃訓練島は昼夜切り替えの台で変わる）
  w.applyEnv?.(); // マップ作り: 決めた空と光
  attachWorld(w, { structuresOf, player, build, systems: [gather, combat, spawner, hitFx, ranged, tools], onMessage: (m) => invHud.message(m), gridOn, debugOn }); // game/worlds.js
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
const play = (w) => { modes.of(w).onPlay(w); if (w !== world) useWorld(w); setMode('fps'); lockPointer(); };
let atTitle = true; // メニューがタイトルか一時停止か
// 設定（ui.md「設定と舵の表示」）: マウスの感度・視野の広さ・UI の大きさ
const settings = loadSettings();
const fpsMeter = createFpsMeter({ fps: perf.fps });
let creativeInv = null; // 開発用（dev/creativeInv.js）。読み込めたら入る
const fovOf = (m) => (m === 'fps' || m === 'dead' ? vfovOf(settings.hfov) : 45); // 1人称は設定の視野角、タイトルは 45 度
function applySettings(v) {
  player.setSensitivity(sensRad(v.vsens));
  camera.fov = fovOf(mode);
  camera.updateProjectionMatrix();
  document.documentElement.style.setProperty('--ui-zoom', v.ui);
  fpsMeter.setOn(v.fps);
  sound.setVolume(v.volume); // 音量（audio/sound.js）
  view.fx.setOptions({ aa: v.aa, rscale: v.rscale, autoRes: v.autoRes, bloom: v.bloom }); // 画質の個別の設定（game/postfx.js。ui.md「画質」）
  setFogQuality(v.fogq, [scene]); // 霧の計算の細かさ（world/fog.js）
  creativeInv?.setOn(v.creative);
  setTouchMode(v.touch, v.tsens);
}
applySettings(settings);
const menu = createMenu({
  settings, onSettings: applySettings, onTouchEdit: () => openTouchEdit(() => touchHud.layout()),
  onStart: () => survival.newGame(),
  onContinue: () => survival.resume(),
  onResume: () => { setMode('fps'); lockPointer(); },
  onTitle: () => { atTitle = true; setMode('menu'); },
  dev: {
    onIsland: () => survival.newGame(true),
    // モデル確認島: 開発中だけ。最初に選ばれたときに作る
    onShowcase: import.meta.env.DEV ? () => import('./world/showcase.js').then(({ buildShowcase }) => {
      if (!showcase) { showcase = buildShowcase(); scene.add(showcase.group); }
      play(showcase);
    }) : null,
    onRange: import.meta.env.DEV ? () => survival.openRange() : null, // 射撃訓練島（modes/survival.js）
    onMap: () => pvp.openMap(), // マップ作り（modes/pvp.js）
  },
});
// ---- モード（modes/） ----
const survival = createSurvival({ scene, camera, sky, player, inventory, keyItems, equip, stats, time, spawner, combat, life, statusHud, structuresOf, play, useWorld, setMode, world: () => world, screen: () => mode, toThis: () => modes.use(survival), message: (t) => menu.setMessage(t) });
const pvp = createPvp({ scene, sky, player, inventory, equip, invHud, structuresOf, play, world: () => world, screen: () => mode });
const modes = createModes([survival, pvp]);
addEventListener('beforeunload', (e) => { if (mode === 'fps') e.preventDefault(); }); // 遊んでいる間は、Ctrl+W などで閉じる前に確かめる（player.md「動き方」）

function setMode(m) {
  if (m === 'menu' && mode === 'fps') modes.cur.saveNow(); // 一時停止で保存
  mode = m;
  menu.hidden = m !== 'menu';
  playHud.hidden = m !== 'fps';
  invHud.hidden = m !== 'fps';
  statusHud.hidden = (m !== 'fps' && m !== 'dead') || !modes.cur.statusHud(world);
  deathScreen.hidden = m !== 'dead';
  if (m !== 'fps') keysPanel.setOpen(false);
  if (m !== 'fps') { buildMenu.setOpen(false); mapWin.setOpen(false); }
  player.setActive(m === 'fps');
  build.setEnabled(m === 'fps');
  camera.fov = fovOf(m);
  camera.updateProjectionMatrix();

  if (m === 'fps') { camera.rotation.order = 'YXZ'; played = true; atTitle = false; }
  menu.setPaused(played && !atTitle);
  menu.setCanContinue(survival.canContinue());
}
setMode('menu');
survival.boot();

// 遊び中の操作（controls.js）
const input = createControls({
  dom, lockPointer, invHud, buildMenu, mapWin, build, gather, combat, pc, ranged, tools, farm, inventory, stats, sleep: life.sleep, canSleep: () => time.isNight, player, keysPanel,
  mode: () => mode, setMode, held: () => held.id, vehicles: () => world.vehicles, st: () => structuresOf.get(world), hasBp: (bp) => keyItems.hasBp(bp),
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
  const swamp = world.fogAt ? world.fogAt(camera.position.x, camera.position.z) : 0; // 場所ごとの霧（立ち枯れの沼。spots.js）: ふだんのかすみと、濃い霧（25m で見えない）を混ぜる
  if (world.fogAt) sky.setFog(world.fog[0], world.fog[1] + (25 - world.fog[1]) * swamp);
  sky.setSwamp(swamp); // 沼の外・島の外では 0 に戻す
  if (world.terrain?.ref) world.terrain.ref.y = player.state.y + 2; // 演出の地面の高さのめやす（洞窟の中では洞窟の床。terrain.js groundNear）
  const cave = world.caveDim ? world.caveDim(camera.position) : 0;
  sky.setDim(cave); // 洞窟の奥は暗い（caveCarve.js）
  grade.update(dt, { hour: sky.hour, swamp, cave, ads: ranged.aimK, look: world.grade }); // 画面の色（world/grade.js）
  perf.lap('世界');
  if (mode === 'fps' || mode === 'dead') world.physics?.update(dt, player.state); // いかだが動いてから、乗っているプレイヤーを動かす
  perf.lap('物理');
  player.update(dt);
  perf.lap('プレイヤー');
  combat.update(t, dt, fighting());
  combatHud.hidden(mode !== 'fps');
  combatHud.update(dt);
  if (fighting()) pc.update(dt, held.id);
  perf.lap('敵');
  if (mode === 'fps') ranged.update(dt, held.id);
  combatHud.setCooldown(mode === 'fps' ? ranged.cdFrac(held.id) ?? pc.cdFrac() : null); // 照準の下の攻撃間隔の線
  combatHud.setStance(mode === 'fps' && !player.state.ride ? ({ sneak: '忍び足', crouch: 'しゃがみ' })[player.state.gait] ?? null : null); // 動き方の札
  combatHud.setLowHp(stats.state.hp / MAX_HP, mode !== 'fps' || stats.state.dead); // HP が低いと画面のふちが赤く脈打つ
  if (!life.sleeping) input.update(); // 左長押しで斧・ピッケルを振りつづける
  build.update();
  buildHud.update(mode === 'fps' ? build.status() : null);
  statusHud.setUnderwater(mode === 'fps' && player.state.underwater);
  if (mode === 'fps') invHud.setAim(input.aimHint());
  aimMark.update(mode === 'fps' && !build.active && !input.uiOpen() ? gather.aimedEntity() : null);
  touchHud.update();
  perf.lap('照準・UI');
  if (mode === 'fps' && !life.sleeping) modes.cur.update(dt, world); // モードだけの 1 フレーム（サバイバル: 空腹・時刻・敵の出方・セーブ）
  perf.lap('サバイバル');
  const wires = structuresOf.get(world)?.wires;
  if (wires?.first) { if (mode === 'fps' && held.id === 'copperWire') wires.showAim(build.aimPoint()); else wires.cancel(); } // 持ち替えたら線を張るのをやめる
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
  window.__game = { renderer, post: view.fx, grade, sky, quality: (q) => { Object.assign(settings, PRESETS[q] ?? {}, { fxq: q }); applySettings(settings); return view.fx.options; }, perf, fx: hitFx, wind: windFx, pc, ranged, spawner, run: async (ms) => { for (let i = 0; i < ms / 33; i++) { frame(1 / 30); if (i % 10 === 9) await new Promise((ok) => setTimeout(ok, 0)); } }, player, inventory, combat, mob: (kind = 'drone', d = 6) => { const s = player.state; combat.spawn(kind, s.x - Math.sin(s.yaw) * d, s.z - Math.cos(s.yaw) * d); return kind; }, keyItems, equip, invHud, sleep: life.sleep, saveNow: () => survival.saveNow(), loadGame: () => survival.loadGame(), vitals: stats, time, gather, tools, build, camera, cat, get setBuildMenuOpen() { return input.setBuildMenuOpen; }, get world() { return world; }, get st() { return structuresOf.get(world); }, get mode() { return mode; }, get gameMode() { return modes.cur.id; }, get map() { return pvp.mapMaker; } };
  import('./dev/creativeInv.js').then(({ createCreativeInv }) => { creativeInv = createCreativeInv({ inventory, equip, invHud }); creativeInv.setOn(settings.creative); }).catch(console.error); // 開発用クリエイティブ（消すときは src/dev/ とこの行）
  import('./debug.js').then(({ createDebug, modelStats, createPhysicsTest }) => { window.__game.debug = createDebug(window.__game); window.__game.stats = modelStats; window.__game.physics = createPhysicsTest(window.__game); });
}
