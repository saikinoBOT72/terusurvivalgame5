// 開発中だけ: 持ち物の奥（手に持つ列のほか）に素材を多めに入れて始める（survival.md「セーブ」）
// 素材はどれも 50 個（重ねられる数が少ない物はその数）。設計図は全部読んだことにする
import { ITEMS } from '../survival/items.js';
import { BAR, SLOTS } from '../survival/inventory.js';

const DEV_KIT = ['wood', 'stick', 'stone', 'bamboo', 'rope', 'fiber', 'flint', 'clay', 'brick', 'palmLeaf', 'feather',
  'coal', 'copperOre', 'ironOre', 'copperIngot', 'ironIngot', 'copperWire', 'screw', 'scrap', 'battery', 'soil', 'seedPotato', 'hempSeed'];
const DEV_SLOTS = [...Array(SLOTS - BAR).keys()].map((k) => BAR + k).concat([1, 2, 3, 4, 5]); // 奥から入れ、あふれたら手に持つ列（0 は素手のまま）

export function devKit(inventory, blueprints) {
  if (!import.meta.env.DEV) return;
  DEV_KIT.forEach((id, k) => { inventory.slots[DEV_SLOTS[k]] = { id, n: Math.min(50, ITEMS[id].stack) }; });
  for (const it of Object.values(ITEMS)) if (it.bp) blueprints.learn(it.bp);
  inventory.changed();
}
