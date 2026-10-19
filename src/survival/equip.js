// 装備の枠（docs/rules/survival.md「持ち物の広さ・大事な物・装備」）: 頭・体・足・アクセサリー 2
// 入るのは equip が枠の種類と同じ物だけ（物は段階 7 で作る）。倒れても落とさない
import { ITEMS } from './items.js';

export const EQUIP_SLOTS = [
  { kind: 'head', label: '頭' }, { kind: 'body', label: '体' }, { kind: 'feet', label: '足' },
  { kind: 'acc', label: '飾り' }, { kind: 'acc', label: '飾り' },
];

export function createEquip() {
  const slots = Array(EQUIP_SLOTS.length).fill(null);
  return {
    slots,
    // 枠 i に id を置けるか
    fits: (i, id) => !!id && ITEMS[id]?.equip === EQUIP_SLOTS[i].kind,
    // id が入る枠のうち、空いている枠（なければ最初の合う枠）。合う枠がなければ -1
    spotFor(id) {
      const ok = EQUIP_SLOTS.map((_, i) => i).filter((i) => ITEMS[id]?.equip === EQUIP_SLOTS[i].kind);
      return ok.find((i) => !slots[i]) ?? ok[0] ?? -1;
    },
    // 数値を足す入り口（段階 7 でスタミナ・防御などを返す）
    stats() {
      const sum = {};
      for (const s of slots) for (const [k, v] of Object.entries(s ? ITEMS[s.id].equipStats ?? {} : {})) sum[k] = (sum[k] ?? 0) + v;
      return sum;
    },
    reset() { slots.fill(null); },
    save: () => slots,
    load(list) { slots.fill(null); (list ?? []).forEach((s, i) => { if (i < slots.length && s && ITEMS[s.id]) slots[i] = s; }); },
  };
}
