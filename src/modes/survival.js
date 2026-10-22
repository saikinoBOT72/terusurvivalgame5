// サバイバルのモード（docs/rules/modes.md）: 島を作る・はじめから・つづきから・セーブ、空腹と昼夜の進み、敵の出方、射撃訓練島
import { buildIsland } from '../world/island.js';
import { ISLANDS } from '../world/islandMap.js';
import { createLoading } from '../ui/loading.js';
import { devKit } from '../game/devKit.js';
import { hasSave, readSave, save, restore } from '../save/save.js';
import { VIEW } from './modes.js';

// play(w)・useWorld(w)・setMode(m): main.js の世界と画面の切り替え。world()・screen(): 今の世界と画面（menu / fps / dead）
// toThis(): このモードへ替える（main.js の modes.use）。message(t): メニューの下の一言
export function createSurvival({ scene, camera, sky, player, inventory, keyItems, equip, stats, time, spawner, combat, life, statusHud, structuresOf, play, useWorld, setMode, world, screen, toThis, message }) {
  // fresh: タイトルの後ろの、まだ遊んでいない島（「はじめから」でそのまま使う）
  let island = null, islandId = 'crash', fresh = false, range = null, saveT = 0;

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
  // 島づくりは少し時間がかかるので、ロード画面を出して作る（ui.md「ロード画面」）
  const loading = createLoading();
  let building = false;
  async function buildThen(id, done) {
    if (building) return; // 作っている間のボタンの連打
    if (island && fresh && islandId === id) return done(); // タイトルの後ろの、まだ遊んでいない島をそのまま使う
    building = true;
    loading.show(ISLANDS[id].name);
    await makeIsland(id, (p, label) => loading.set(p, label));
    loading.set(1, 'できた');
    message(`島: ${island.name}`);
    done();
    loading.hide();
    building = false;
  }
  // タイトルの景色: 始まりの浜の沖から、島のほうを見る
  function titleView() {
    const s = island.spawn, y = island.terrain.heightAt(s.x, s.z);
    camera.rotation.order = 'XYZ';
    camera.position.set(s.x + 10, y + 9, s.z + 22);
    camera.lookAt(s.x - 6, y + 3, s.z - 25);
  }

  // ---- セーブ（save/save.js）: 一時停止したとき・60 秒ごと・ページを閉じるときに自動で保存。「つづきから」で戻す ----
  const gameRef = () => ({ islandId, keyItems, equip, spawner, island, structures: structuresOf.get(island), inventory, time, stats, player });
  function saveNow() { if (island && world() === island && screen() === 'fps' && !life.sleeping) save(gameRef()); }
  function loadGame() {
    const d = readSave();
    if (d) buildThen(d.island, () => { play(island); restore(d, gameRef()); });
  }
  addEventListener('pagehide', saveNow);

  const mode = {
    ...VIEW,
    id: 'survival',
    owns: (w) => !!w && (w === island || w === range),
    onPlay(w) { if (w === island) fresh = false; },
    survival: (w) => w === island, // 空腹・時刻が進む（訓練島は進まない）
    fighting: (w) => mode.owns(w), // 敵の動き・スタミナは射撃訓練島でも
    statusHud: (w) => mode.owns(w),
    saveNow,
    loadGame,
    get island() { return island; },
    // 起動: 島を作ってタイトルの後ろに映す
    boot() { buildThen('crash', () => { fresh = true; useWorld(island); titleView(); setMode('menu'); }); },
    // はじめから: 新しい島、持ち物・HP・時刻も最初から
    // kit: 開発用メニューの「墜落島（素材つき）」。ふつうは何も持たずに残骸のそばで起きる（islands.md「始まり」）
    newGame(kit = false) {
      toThis(); // マップ作りから戻ってきたときは、島の持ち物を戻してから最初に戻す
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
    },
    // つづきから: 遊んだ島があればそこへ、なければセーブから
    resume() { if (island && !fresh) play(island); else loadGame(); },
    canContinue: () => (!!island && !fresh) || hasSave(),
    // 射撃訓練島（islands.md）: 開発中だけ。最初に選ばれたときに作る
    openRange: import.meta.env.DEV ? () => import('../world/range.js').then(({ buildRange }) => {
      if (!range) { range = buildRange({ summon: (k, x, z) => { const m = combat.spawn(k, x, z), s = player.state; m.yaw = Math.atan2(s.x - x, s.z - z); }, clear: () => [...combat.list].forEach((m) => m.fixed || combat.remove(m)), setHour: (h) => sky.setHour(h) }); scene.add(range.group); }
      play(range);
    }) : null,
    update(dt, w) {
      if (w !== island) return statusHud.update(stats.state, time); // 訓練島: HP とスタミナだけ（空腹・時刻は進まない）
      spawner.update(dt);
      stats.update(dt, { nearFire: life.nearFire(), underwater: player.state.underwater });
      w.planting?.update(time.total);
      time.update(dt);
      sky.setHour(time.hour);
      statusHud.update(stats.state, time);
      if ((saveT += dt) >= 60) { saveT = 0; saveNow(); }
    },
  };
  return mode;
}
