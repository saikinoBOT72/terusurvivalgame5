// 建築のつなぎ込み: ハンマーを持って右クリックでメニュー。置くと素材が減り、撤去すると半分戻る（building.md）
import { createBuildMode } from '../build/buildMode.js';
import { PARTS, COSTS } from '../build/parts.js';
import { createBuildMenu, costHtml, canPay, itemsHtml } from '../ui/buildMenu.js';
import { createBuildHud } from '../ui/hud.js';
import { ITEMS } from '../survival/items.js';
import { stationRefund } from '../survival/stations.js';
import { planterRefund } from '../survival/farm.js';
import { placeDrop } from '../survival/death.js';

// world(): 今の世界。closeMenu(): 建築メニューを閉じる（操作は controls.js が持つ）
export function createBuilding({ scene, camera, dom, player, inventory, invHud, blueprints, world, closeMenu }) {
  const hud = createBuildHud({ partName: (t) => PARTS[t].name, costHtml: (t) => costHtml(t, inventory), refundHtml: (parts) => itemsHtml(build.refund(parts)) });
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
      const left = []; // 設備の中身（チェストも）は持ち物へ。入りきらない分は、その場に袋で落とす
      for (const p of parts) for (const [id, n] of [...stationRefund(p), ...planterRefund(p)]) {
        const got = inventory.add(id, n);
        if (got) invHud.gained(id, got);
        if (got < n) left.push({ id, n: n - got, at: p.pos });
      }
      if (left.length) {
        const at = left[0].at;
        placeDrop(world(), left.map(({ id, n }) => ({ id, n })), at.x, at.y + 0.3, at.z, { kind: 'bag' });
        invHud.message('入りきらない分は袋に入れて置いた');
      }
      inventory.changed();
      for (const t of parts.map((p) => p.type)) for (const [id, n] of Object.entries(COSTS[t])) back[id] = (back[id] || 0) + Math.floor(n / 2);
      for (const [id, n] of Object.entries(back)) if (n) invHud.gained(id, inventory.add(id, n));
    },
    // いかだのコアを撤去: バラバラになって、素材が水に浮かぶ（physics.md「いかだ」）
    onBreak: (v) => { world().vehicles.breakUp(v, (p) => [...stationRefund(p), ...planterRefund(p)]); invHud.message('いかだが壊れた'); },
  });
  scene.add(build.preview);
  scene.add(build.marks); // 撤去で消えるパーツの赤い重ね
  const menu = createBuildMenu({ inventory, onPick: (i) => { closeMenu(); build.start(i); }, known: (bp) => blueprints.has(bp) });
  return { build, hud, menu };
}
