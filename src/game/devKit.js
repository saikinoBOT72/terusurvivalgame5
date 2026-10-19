// 開発中だけ: 持ち物の奥（手に持つ列のほか）に素材を多めに入れて始める（survival.md「セーブ」）
// 素材はどれも 50 個（重ねられる数が少ない物はその数）。設計図は全部持っていることにする。持ち物は最大の広さ
import { ITEMS } from '../survival/items.js';
import { BAR } from '../survival/inventory.js';

const DEV_KIT = ['wood', 'stick', 'stone', 'bamboo', 'rope', 'fiber', 'flint', 'clay', 'brick', 'palmLeaf', 'feather',
  'coal', 'copperOre', 'ironOre', 'copperIngot', 'ironIngot', 'copperWire', 'screw', 'scrap', 'soil', 'seedPotato', 'hempSeed', 'sand', 'glass', 'woodAxe', 'woodPick'];

export function devKit(inventory, keyItems) {
  if (!import.meta.env.DEV) return;
  while (inventory.grow());
  const spots = [...Array(inventory.slots.length - BAR).keys()].map((k) => BAR + k).concat([1, 2, 3, 4, 5]); // 奥から入れ、あふれたら手に持つ列（0 は素手のまま）
  DEV_KIT.forEach((id, k) => { inventory.slots[spots[k]] = { id, n: Math.min(50, ITEMS[id].stack) }; });
  for (const [id, it] of Object.entries(ITEMS)) if (it.key) keyItems.add(id, true);
  inventory.changed();
}
