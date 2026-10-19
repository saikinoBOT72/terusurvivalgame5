// 持ち物（docs/rules/survival.md）。見た目と分けたデータだけを持つ（あとでセーブ・同期に使う）
// slots[0..5] が手に持つ列（画面では一番下の段）、slots[6..23] がそれ以外。マスは { id, n, dur? } か null
import { ITEMS } from './items.js';

export const SLOTS = 24, BAR = 6;

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

export function createInventory() {
  const slots = Array(SLOTS).fill(null);
  let sel = 0;
  const listeners = [];
  const changed = () => listeners.forEach((f) => f());

  function add(id, n) {
    const k = addToSlots(slots, id, n);
    if (k) changed();
    return k;
  }
  // 入れられる数（入れずに調べる）
  function room(id) {
    const max = ITEMS[id].stack;
    return slots.reduce((a, s) => a + (!s ? max : s.id === id ? max - s.n : 0), 0);
  }
  const count = (id) => slots.reduce((a, s) => a + (s && s.id === id ? s.n : 0), 0);
  // id を n 個減らす（足りなければ何もしない）。持っていないマスから先に減らす
  function remove(id, n) {
    if (count(id) < n) return false;
    for (let i = SLOTS - 1; i >= 0 && n; i--) {
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
    Object.entries(rc.need).every(([id, n]) => count(id) >= n) && room(rc.out) >= rc.n && (!rc.station || near(rc.station));
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

  return {
    slots, add, room, count, remove, canCraft, craft, wear, changed,
    swap(i, j) { [slots[i], slots[j]] = [slots[j], slots[i]]; changed(); },
    get sel() { return sel; },
    select(i) { if (i !== sel && i >= 0 && i < BAR) { sel = i; changed(); } },
    held: () => slots[sel],
    onChange: (f) => listeners.push(f),
  };
}
