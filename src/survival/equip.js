// 装備の枠（docs/rules/survival.md「持ち物の広さ・大事な物・装備」）: 頭・体・足・アクセサリー 2
// 入るのは equip が枠の種類と同じ物だけ。倒れても落とさない。効き目は survival.md「装備の中身」
import { ITEMS } from './items.js';

export const EQUIP_SLOTS = [
  { kind: 'head', label: '頭' }, { kind: 'body', label: '体' }, { kind: 'feet', label: '足' },
  { kind: 'acc', label: '飾り' }, { kind: 'acc', label: '飾り' },
];

// 効き目の書き方（窓と debug で使う）。0 の物は出さない
const STAT_TEXT = {
  def: (v) => `防御 ${v}`, stamMax: (v) => `スタミナ ＋${v}`, stamRegen: (v) => `スタミナの戻り ＋${v}%`,
  runCost: (v) => `走る消費 ${v > 0 ? '＋' : '−'}${Math.abs(v)}%`, fall: (v) => `落下 ＋${v}m`, breath: (v) => `息 ＋${v}秒`,
};
export const statsText = (sum) => Object.entries(sum ?? {}).filter(([k, v]) => v && STAT_TEXT[k]).map(([k, v]) => STAT_TEXT[k](v)).join('・');

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
    // 付けている物の効き目の合計（同じ物の 2 つ目は数えない）
    stats() {
      const sum = {}, seen = new Set();
      for (const s of slots) {
        if (!s || seen.has(s.id)) continue;
        seen.add(s.id);
        for (const [k, v] of Object.entries(ITEMS[s.id].equipStats ?? {})) sum[k] = (sum[k] ?? 0) + v;
      }
      return sum;
    },
    reset() { slots.fill(null); },
    save: () => slots,
    load(list) { slots.fill(null); (list ?? []).forEach((s, i) => { if (i < slots.length && s && ITEMS[s.id]) slots[i] = s; }); },
  };
}
