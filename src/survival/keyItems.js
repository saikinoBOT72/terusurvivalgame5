// 大事な物（docs/rules/survival.md「持ち物の広さ・大事な物・装備」）: 持ち物のマスとは別の入れ物
// 入るのは key: true の物（設計図など）。数の上限はなく、捨てる・動かす・落とすはできない。拾うと inventory.js から入る
import { ITEMS } from './items.js';

export const isKey = (id) => !!ITEMS[id]?.key;

export function createKeyItems() {
  const have = new Set();
  const bps = new Set(); // 持っている設計図の名前（レシピ・建築パーツの bp）
  const self = {
    onAdd: () => {}, // 新しく手に入れたときの知らせ（main.js が付ける）
    has: (id) => have.has(id),
    // 設計図を持っているか。bp がないレシピ・パーツは最初から作れる
    hasBp: (bp) => !bp || bps.has(bp),
    // 入れる: 新しく入ったら true。quiet は知らせなし（セーブを読むとき）
    add(id, quiet = false) {
      if (have.has(id)) return false;
      have.add(id);
      if (ITEMS[id].bp) bps.add(ITEMS[id].bp);
      if (!quiet) self.onAdd(id);
      return true;
    },
    list: () => [...have],
    reset() { have.clear(); bps.clear(); },
    save: () => [...have],
    load(ids) { self.reset(); for (const id of ids ?? []) if (isKey(id)) self.add(id, true); },
  };
  return self;
}

// 配列 slots（マスの並び）にある大事な物を取り出して keys へ入れる。入れた数を返す
export function takeKeys(slots, keys, quiet = false) {
  let n = 0;
  slots.forEach((s, i) => {
    if (!s || !isKey(s.id)) return;
    keys.add(s.id, quiet);
    slots[i] = null;
    n++;
  });
  return n;
}
