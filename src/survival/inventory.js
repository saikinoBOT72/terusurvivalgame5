// 持ち物（docs/rules/survival.md）。見た目と分けたデータだけを持つ（あとでセーブ・同期に使う）
// slots[0..5] が手に持つ列（画面では一番下の段）、slots[6..] がそれ以外（1 段 6 マス。初めは 2 段、拡張アイテムで最大 4 段）。マスは { id, n, dur? } か null
import { ITEMS } from './items.js';
import { isKey, takeKeys } from './keyItems.js';

export const BAR = 6, COLS = 6, ROWS_START = 2, ROWS_MAX = 4;

// マスの並び slots に id を n 個入れられるだけ入れて、入った数を返す（チェストでも使う）
export function addToSlots(slots, id, n) {
  const max = ITEMS[id].stack;
  let left = n;
  for (const s of slots) if (left && s && s.id === id && s.n < max) { const k = Math.min(left, max - s.n); s.n += k; left -= k; }
  for (let i = 0; i < slots.length && left; i++) {
    if (slots[i]) continue;
    const k = Math.min(left, max);
    slots[i] = { id, n: k };
    if (ITEMS[id].dur) slots[i].dur = ITEMS[id].dur;
    left -= k;
  }
  return n - left;
}
// from[i] のマスを、並び to へ移す（道具は耐久ごと）。移しきれなかった分は残る
export function moveSlot(from, i, to) {
  const s = from[i];
  if (!s) return;
  if (ITEMS[s.id].stack === 1) {
    const j = to.indexOf(null);
    if (j >= 0) { to[j] = s; from[i] = null; }
    return;
  }
  s.n -= addToSlots(to, s.id, s.n);
  if (!s.n) from[i] = null;
}

// keys: 大事な物の入れ物（keyItems.js）。大事な物は持ち物のマスに入れず、そちらへ入れる
export function createInventory(keys) {
  const slots = Array(BAR + COLS * ROWS_START).fill(null);
  let sel = 0;
  const listeners = [];
  const rows = () => (slots.length - BAR) / COLS;
  const changed = () => { if (keys) takeKeys(slots, keys); listeners.forEach((f) => f()); }; // マスに紛れ込んだ大事な物（チェストから取った設計図など）は大事な物へ

  function add(id, n) {
    if (isKey(id) && keys) { keys.add(id); changed(); return n; }
    const k = addToSlots(slots, id, n);
    if (k) changed();
    return k;
  }
  // 入れられる数（入れずに調べる）
  function room(id) {
    if (isKey(id) && keys) return 1;
    const max = ITEMS[id].stack;
    return slots.reduce((a, s) => a + (!s ? max : s.id === id ? max - s.n : 0), 0);
  }
  const count = (id) => slots.reduce((a, s) => a + (s && s.id === id ? s.n : 0), 0);
  // id を n 個減らす（足りなければ何もしない）。持っていないマスから先に減らす
  function remove(id, n) {
    if (count(id) < n) return false;
    for (let i = slots.length - 1; i >= 0 && n; i--) {
      const s = slots[i];
      if (!s || s.id !== id) continue;
      const k = Math.min(n, s.n);
      s.n -= k; n -= k;
      if (!s.n) slots[i] = null;
    }
    changed();
    return true;
  }

  // 作れるか: 材料がそろい、できた物を入れる場所があり、必要な家具のそばにいる（near(station)）
  const canCraft = (rc, near = () => true) =>
    (!keys || keys.hasBp(rc.bp)) && Object.entries(rc.need).every(([id, n]) => count(id) >= n) && room(rc.out) >= rc.n && (!rc.station || near(rc.station));
  function craft(rc, near) {
    if (!canCraft(rc, near)) return false;
    for (const [id, n] of Object.entries(rc.need)) remove(id, n);
    add(rc.out, rc.n);
    return true;
  }
  // 手に持っている道具の耐久を 1 減らす。壊れたらその名前を返す
  function wear() {
    const s = slots[sel];
    if (!s || s.dur === undefined) return null;
    s.dur--;
    if (s.dur <= 0) slots[sel] = null;
    changed();
    return s.dur <= 0 ? ITEMS[s.id].name : null;
  }

  // 奥を 1 段増やす（戻らない）。最大なら false
  function grow() {
    if (rows() >= ROWS_MAX) return false;
    slots.push(...Array(COLS).fill(null));
    changed();
    return true;
  }
  // 拡張アイテム id（expand: 広げたあとの段の数）を使う。順番どおりにしか使えない。知らせの文字を返す
  function useExpand(id) {
    const to = ITEMS[id].expand;
    if (rows() >= to) return 'もう広げてある';
    if (rows() < to - 1) return `先に${ITEMS[Object.keys(ITEMS).find((k) => ITEMS[k].expand === to - 1)].name}を使う`;
    remove(id, 1);
    grow();
    return `持ち物が広がった（${slots.length} マス）`;
  }
  // はじめの広さに戻して空にする（rows: 奥の段の数。開発中は最大から始める）
  function reset(r = ROWS_START) {
    slots.length = BAR + COLS * r;
    slots.fill(null);
    changed();
  }

  return {
    slots, takeKeys: (store) => keys && takeKeys(store, keys), add, room, count, remove, canCraft, craft, wear, changed, grow, useExpand, reset,
    get rows() { return rows(); },
    swap(i, j) { [slots[i], slots[j]] = [slots[j], slots[i]]; changed(); },
    get sel() { return sel; },
    select(i) { if (i !== sel && i >= 0 && i < BAR) { sel = i; changed(); } },
    held: () => slots[sel],
    onChange: (f) => listeners.push(f),
  };
}
