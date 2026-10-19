// 遊び中の操作（docs/rules/ui.md「操作」）: マウスの固定、クリック、ホイール、キー、右下のヒント
// 左クリック = 壊す・攻撃、右クリック = 使う。置く状態のクリックは buildMode.js が先に扱う
import { ITEMS, HAND } from './survival/items.js';
import { BAR } from './survival/inventory.js';
import { PARTS } from './build/parts.js';
import { stationOf } from './survival/stations.js';
import { isMelee } from './combat/playerCombat.js';
import { weaponMotion } from './avatar/fpMotion.js';

// g: main.js の部品。mode() / setMode / held()（手に持つ物の id）/ vehicles()（今の世界の乗り物）/ toggleGrid / toggleDebug など
// 何も見ていないときに出す、持っている道具の働き
const TOOL_HINTS = { sling: '左を押して引く・離して撃つ', tubeEmpty: '右クリック 水をくむ', sapling: '右クリック 植える', paddle: '右クリック こぐ' };

export function createControls(g) {
  const { dom, lockPointer, invHud, buildMenu, build, gather, combat, pc, ranged, tools, farm, inventory, stats, blueprints, player, keysPanel } = g;
  const fps = () => g.mode() === 'fps';
  const uiOpen = () => invHud.open || buildMenu.open; // マウスの固定を外して使う画面

  // Esc でマウスの固定が外れたら一時停止してメニューへ。1人称中のクリックで固定し直す。
  document.addEventListener('pointerlockchange', () => {
    if (fps() && document.pointerLockElement !== dom && !uiOpen()) g.setMode('menu');
  });
  dom.addEventListener('click', () => {
    if (!fps() || document.pointerLockElement === dom) return;
    invHud.setOpen(false);
    buildMenu.setOpen(false);
    lockPointer();
  });
  // 持ち物・建築メニュー: 開いている間はマウスの固定を外す（遊びは止めない）
  function setBuildMenuOpen(v) {
    buildMenu.setOpen(v);
    if (v) { invHud.setOpen(false); document.exitPointerLock?.(); } else lockPointer();
  }
  function setInventoryOpen(v, chest = null) {
    buildMenu.setOpen(false);
    invHud.setOpen(v, chest);
    if (v) document.exitPointerLock?.(); else lockPointer();
  }
  // メニューの上で右クリックすると閉じる。ただし、メニューを開いた右クリックを離したとき（その contextmenu）は除く
  let openingPress = false;
  addEventListener('mouseup', (e) => { if (e.button === 2) setTimeout(() => (openingPress = false)); });
  buildMenu.box.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!openingPress) setBuildMenuOpen(false); });
  addEventListener('contextmenu', (e) => { if (fps()) e.preventDefault(); }); // 遊び中はブラウザのメニューを出さない

  // 右クリック: 持っている物に右クリックの働きがあればそれ（ハンマー → 建築メニュー、食べ物 → 食べる）。なければ（素手も）拾う・採る → チェスト → ドア
  function useAimed() {
    const held = g.held(), vs = g.vehicles();
    if (player.state.ride) { if (player.state.ride.kind === 'helm') vs.leave(); return; } // 舵は右クリックでも離す
    if (build.hammer) { openingPress = true; return setBuildMenuOpen(true); }
    const aimed = build.aimedPart();
    if (aimed && vs?.use(aimed)) return; // 舵を持つ・小舟に座る・起こす
    if (aimed?.type === 'bed') return g.sleep(); // 寝床で眠る
    if (aimed?.type === 'planter' && farm.use(aimed, held)) return; // 畑: 植える・水をやる・収穫（持って右クリック）
    if (stationOf(aimed)) return setInventoryOpen(true, aimed); // 設備の窓（ui.md「設備の窓」。食べるより先）
    const bp = held && ITEMS[held].bp;
    if (bp) { // 設計図を読む: レシピを覚えて、設計図はなくなる
      inventory.remove(held, 1);
      invHud.message(blueprints.learn(bp) ? `${ITEMS[held].name}を読んだ。作り方を覚えた` : 'もう知っている設計図');
      return;
    }
    if (held && stats.canEat(held)) { // 満腹なら、ふつうの右クリック
      stats.eat(held);
      inventory.remove(held, 1);
      const after = ITEMS[held].after; // 飲んだあとの入れ物（竹筒など）
      if (after) invHud.gained(after, inventory.add(after, 1));
      return;
    }
    if (tools.rightClick(held)) return; // 釣り竿・竹筒・苗木
    if (gather.interact()) return;
    const part = aimed;
    if (part && part.store) return setInventoryOpen(true, part);
    if (part) build.toggleAimed();
  }
  dom.addEventListener('mousedown', (e) => {
    if (!fps() || document.pointerLockElement !== dom) return;
    if (e.button === 2) { // 近接武器で何も狙っていなければガード、銃は覗き込む（weapons.md）
      if (ITEMS[g.held()]?.ranged?.aim) return ranged.aim(g.held(), true);
      if (isMelee(g.held()) && !gather.aimedEntity() && !build.aimedPart()) return pc.guardStart(g.held());
      return useAimed();
    }
    if (e.button !== 0 || player.state.ride || pc.guarding) return; // 乗っている間・ガード中の左クリックは何もしない（weapons.md）
    const held = g.held(), tool = ITEMS[held]?.tool;
    if (ITEMS[held]?.ranged) return ranged.press(held); // 遠距離武器（combat/ranged.js）
    if (pc.cooling) return; // 攻撃間隔が満ちるまで振れない（weapons.md「攻撃間隔」）
    if (isMelee(held) && tool !== 'hammer') return pc.chargeStart(); // 近接武器は離したときに振る（ため攻撃。weapons.md）
    swingNow(held, 1);
  });
  // 振り（構え → 振り → 戻り。動きは avatar/fpMotion.js）の当たる所で叩く。敵が先（mobs/combat.js）。叩く物がなければ道具の働き（ピッケルで粘土）
  // 当てたら手が跳ね返り、外したら振り抜ける。ハンマーの左クリック（置く・撤去）は buildMode.js
  function swingNow(held, mult) {
    const it = held ? ITEMS[held] : HAND;
    const secs = it?.swing ?? 0.4; // 道具ごとの振る速さ（survival.md「叩く強さ」）
    pc.startCd(it?.cd ?? secs);
    const at = player.arms.swing(weaponMotion(held).kind, secs, { heavy: mult > 1 });
    setTimeout(() => {
      const hit = combat.hit(held, mult) || gather.use();
      player.arms.impact(hit);
      if (hit) combat.noise(); else tools.leftClick(held); // 叩いた音で、まわり 15m の寝ている番人が起きる
    }, at * 1000);
  }
  addEventListener('mouseup', (e) => {
    if (e.button === 2) { pc.guardEnd(); ranged.aim(g.held(), false); }
    if (e.button === 0) ranged.release(g.held());
    if (e.button === 0 && pc.charging) { const held = g.held(), mult = pc.chargeEnd(held); if (fps()) swingNow(held, mult); }
  });
  addEventListener('wheel', (e) => {
    if (!fps() || build.placing || uiOpen()) return; // 置く状態のホイールは向き（buildMode.js）
    inventory.select((inventory.sel + (e.deltaY > 0 ? 1 : BAR - 1)) % BAR);
  });
  addEventListener('keydown', (e) => {
    if (e.code === 'Tab' || e.code === 'F1') e.preventDefault();
    if (e.repeat) return;
    if (fps()) {
      if (e.code === 'F1') keysPanel.setOpen(!keysPanel.open);
      if (e.code === 'Tab') { if (buildMenu.open) setBuildMenuOpen(false); else setInventoryOpen(!invHud.open); }
      if (e.code === 'Escape' && uiOpen()) g.setMode('menu');
      const n = e.code.startsWith('Digit') ? Number(e.code.slice(5)) - 1 : -1;
      if (n >= 0 && n < BAR) inventory.select(n);
      if (e.code === 'KeyQ' && !build.placing && !uiOpen()) tools.throwHeld(); // 置く状態の Q は土台の高さ（buildMode.js）。撤去の状態のハンマーは投げられる
    }
    if (e.code === 'KeyG') g.toggleGrid();
    if (e.code === 'KeyC' && fps()) pc.dodge(); // ステップ（weapons.md）
    if (e.code === 'KeyR' && fps() && !build.active) ranged.reload(g.held()); // 込め直し（建築中の R は回す）
    if (e.code === 'KeyH') g.toggleDebug();
  });

  // 右下のヒント: 拾える物・木・岩は輪郭で目立たせるだけ（aimHighlight.js）。チェスト・ドア、持っている物の右クリックの働きは文字で出す
  function aimHint() {
    const held = g.held();
    if (player.state.ride) return g.vehicles()?.hint(null); // 乗っている間の操作
    if (build.active) return null;
    const mob = combat.aimedInfo(held); // 敵の名前と残り HP
    if (mob) return mob;
    if (gather.aimedEntity()) return null;
    const part = build.hammer ? null : build.aimedPart();
    const vh = g.vehicles()?.hint(part); // 舵・帆・小舟
    if (vh) return vh;
    if (part?.type === 'bed') return { name: PARTS.bed.name, key: g.canSleep() ? '右クリック 眠る' : '夜に眠れる' };
    if (part?.type === 'planter') return farm.hint(part, held);
    const S = stationOf(part);
    if (S) return { name: S.name + (part.burning ? '（燃えている）' : ''), key: '右クリック 開ける' };
    if (part?.type === 'door') return { name: PARTS[part.type].name, key: '右クリック 開け閉め' };
    if (held && stats.canEat(held)) return { name: ITEMS[held].name, key: ITEMS[held].food ? '右クリック 食べる' : '右クリック 飲む' };
    if (held === 'fishingRod') return { name: ITEMS[held].name, key: tools.fishing === 'bite' ? '右クリック 引く！' : tools.fishing ? '右クリック 戻す' : '右クリック 投げる' };
    const use = TOOL_HINTS[held];
    if (use) return { name: ITEMS[held].name, key: use };
    return null;
  }

  return { uiOpen, setBuildMenuOpen, setInventoryOpen, aimHint };
}
