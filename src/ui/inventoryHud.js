// 持ち物まわりの画面表示（docs/rules/ui.md「持ち物とクラフト」「石の板の見た目」）
// 手に持つ列（いつも出す）、Tab の持ち物・クラフト・大事な物の画面（タブで切り替え。いつも画面の真ん中）、装備の列（左。equipHud.js）、設備の窓（右。stationHud.js）、照準の下のヒント、手に入れたときの表示
import { ITEMS, RECIPES } from '../survival/items.js';
import { BAR, ROWS_MAX, moveSlot } from '../survival/inventory.js';
import { iconUrl } from './icons.js';
import { partIcon } from './buildMenu.js';
import { corner } from './hud.js';
import { el, winHead } from './uiKit.js';
import { createStationWindow } from './stationHud.js';
import { createEquipColumn, keyListHtml, fillEquipSum, slotTitle } from './equipHud.js';
import { STATIONS, accepts, insertInto, stationChanged } from '../survival/stations.js';

const slotHtml = (i, kind = 'inv', key = '') => `<div class="slot" data-kind="${kind}" data-i="${i}"><img alt=""><span class="n"></span><i class="dur"></i>${key}</div>`;
const range = (a, b) => Array.from({ length: b - a }, (_, k) => a + k);

// vitals(): HP・おなか・水分（Tab の画面に数字で出す）
// known(rc): そのレシピの設計図を持っているか（持っていないレシピは出さない）。keyItems: 大事な物、equip: 装備の枠
export function createInventoryHud(inventory, { vitals = () => null, known = () => true, keyItems, equip }) {
  const aim = el('<div class="aim-name panel" hidden></div>', corner());
  const toasts = el('<div class="toasts"></div>', corner());
  const bar = el(`<div class="hotbar"><div class="held-name outlined"></div><div class="row">${range(0, BAR).map((i) => slotHtml(i, 'inv', `<span class="key">${i + 1}</span>`)).join('')}</div></div>`);
  const panel = el(`
    <div class="panel win inv" hidden>
      <div class="tabs">
        <button type="button" class="tab" data-tab="bag" title="持ち物"><img src="${partIcon('chest')}" alt="持ち物"></button>
        <button type="button" class="tab" data-tab="craft" title="クラフト"><img src="${iconUrl('stoneHammer')}" alt="クラフト"></button>
        <button type="button" class="tab" data-tab="keys" title="大事な物"><img src="${iconUrl('bpFurnace')}" alt="大事な物"></button>
      </div>
      <div class="vitals"></div>
      <div class="bag">
        ${winHead('持ち物')}
        <div class="grid back"></div>
        <div class="grid locked"></div>
        <div class="sub lock-note"></div>
        <div class="sub">手に持つ列（1〜6 キー）</div>
        <div class="grid bar">${range(0, BAR).map((i) => slotHtml(i)).join('')}</div>
      </div>
      <div class="craft" hidden>
        ${winHead('クラフト')}
        <div class="recipes"></div>
      </div>
      <div class="key-tab" hidden>
        ${winHead('大事な物')}
        <div class="key-list"></div>
      </div>
    </div>`);
  createEquipColumn(panel, { slotHtml });
  let rowsShown = 0;
  // 奥のマスを今の段の数に合わせる。次に広がる段は鍵つきで 1 段だけ見せる（ui.md「持ち物の広さと装備」）
  function syncRows() {
    if (rowsShown === inventory.rows) return;
    rowsShown = inventory.rows;
    panel.querySelector('.grid.back').innerHTML = range(BAR, inventory.slots.length).map((i) => slotHtml(i)).join('');
    const more = rowsShown < ROWS_MAX, next = Object.keys(ITEMS).find((k) => ITEMS[k].expand === rowsShown + 1);
    panel.querySelector('.grid.locked').innerHTML = more ? '<div class="slot lock"></div>'.repeat(6) : '';
    panel.querySelector('.lock-note').textContent = more ? `${ITEMS[next].name}で広がる` : '';
  }
  const recipes = panel.querySelector('.recipes');
  const recipeHtml = (rc, i) => `
    <div class="recipe" data-i="${i}">
      <img src="${iconUrl(rc.out)}" alt="">
      <div class="info"><div class="name">${ITEMS[rc.out].name}${rc.n > 1 ? ` ×${rc.n}` : ''}</div><div class="need"></div></div>
      <button type="button">${rc.station ? `作る<small>長押し ${rc.time ?? 2} 秒</small>` : '作る'}</button>
    </div>`;
  RECIPES.forEach((rc, i) => { if (!rc.station) el(recipeHtml(rc, i), recipes); }); // 設備で作る物は、その設備の窓に出す
  const station = createStationWindow(panel, { slotHtml, recipeHtml, known, onPick: pickBench });
  const cur = () => station.part; // 開いている設備
  const nearAt = (type) => cur()?.type === type; // 設備のレシピは、その設備の窓を開いているときだけ作れる

  let aimText = null, shown = true, heldTimer = 0, tab = 'bag', drag = null;

  function fillSlot(node) {
    const i = Number(node.dataset.i), k = node.dataset.kind, s = k === 'st' ? cur()?.slots[i] : k === 'eq' ? equip.slots[i] : inventory.slots[i];
    const img = node.querySelector('img'), dur = node.querySelector('.dur');
    node.querySelector('.role')?.toggleAttribute('hidden', !!s);
    if (s) { img.src = iconUrl(s.id); img.hidden = false; } else img.hidden = true;
    node.querySelector('.n').textContent = s && s.n > 1 ? s.n : '';
    node.title = s ? slotTitle(s.id) : '';
    dur.hidden = !s || s.dur === undefined;
    if (!dur.hidden) { // 耐久: 半分より多いと緑、2 割まで黄、それより少ないと赤
      const k = s.dur / ITEMS[s.id].dur;
      dur.style.width = `${k * 80}%`;
      dur.style.background = `var(--ui-${k > 0.5 ? 'ok' : k > 0.2 ? 'hunger' : 'ng'})`;
    }
    node.classList.toggle('on', k === 'inv' && i === inventory.sel);
  }
  function render() {
    bar.querySelectorAll('.slot').forEach(fillSlot);
    if (panel.hidden) return;
    syncRows();
    panel.querySelectorAll('.slot[data-kind]').forEach(fillSlot);
    fillEquipSum(panel, equip);
    if (cur()) tab = 'bag'; // 設備を開いている間は持ち物を出しておく（右の窓と物をやりとりする）
    panel.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tab));
    panel.querySelector('.bag').hidden = tab !== 'bag';
    panel.querySelector('.craft').hidden = tab !== 'craft';
    panel.querySelector('.key-tab').hidden = tab !== 'keys';
    if (tab === 'keys') panel.querySelector('.key-list').innerHTML = keyListHtml(keyItems.list());
    const v = vitals(); // Tab の画面でだけ、ゲージの数字を出す
    panel.querySelector('.vitals').innerHTML = v ? `<span>HP ${v.hp}</span><span>おなか ${v.food}</span><span>水分 ${v.water}</span>` : '';
    station.win.querySelectorAll('.recipe').forEach(fillRecipe); // 作業台の窓
    station.refresh();
    if (tab !== 'craft') return;
    const rows = [...recipes.querySelectorAll('.recipe')]; // 作れる物を上に
    rows.sort((a, b) => !inventory.canCraft(RECIPES[a.dataset.i], nearAt) - !inventory.canCraft(RECIPES[b.dataset.i], nearAt) || a.dataset.i - b.dataset.i);
    rows.forEach((row) => recipes.appendChild(row));
    rows.forEach(fillRecipe);
  }
  function fillRecipe(row) {
    const rc = RECIPES[Number(row.dataset.i)], ok = inventory.canCraft(rc, nearAt);
    row.hidden = !known(rc);
    row.querySelector('.need').innerHTML = (rc.bp ? '<span class="bp">設計図 ✓</span>' : '') + Object.entries(rc.need).map(([id, n]) => {
      const have = inventory.count(id);
      return `<span class="${have < n ? 'lack' : ''}"><img src="${iconUrl(id)}" alt="">${ITEMS[id].name} ${n}<small>（${have}）</small></span>`;
    }).join('');
    row.querySelector('button').disabled = !ok;
    row.classList.toggle('cant', !ok);
  }
  function showHeldName() {
    const s = inventory.held();
    bar.querySelector('.held-name').textContent = s ? ITEMS[s.id].name : '';
    bar.classList.add('naming');
    clearTimeout(heldTimer);
    heldTimer = setTimeout(() => bar.classList.remove('naming'), 1500);
  }

  // ---- マスの操作（ui.md「持ち物の操作」）: ドラッグで入れかえ・重ねる、Shift＋クリックでまとめて移す ----
  const arr = (kind) => (kind === 'st' ? cur().slots : kind === 'eq' ? equip.slots : inventory.slots);
  // 設備のスロットに置けるか（ui.md「設備の窓」: 燃料は燃料のスロット、入れる物は入れるスロット、出るスロットには置けない）。装備の枠は合う物だけ
  const fits = (kind, i, item) => !item || (kind === 'st' ? accepts(cur().type, i, item.id, cur()) : kind === 'eq' ? equip.fits(i, item.id) : true);
  const done = () => { if (cur()) stationChanged(cur()); inventory.changed(); };
  function dropOn(fk, i, tk, j) {
    const A = arr(fk), B = arr(tk), a = A[i], b = B[j];
    if (!a || (A === B && i === j)) return;
    if (!fits(tk, j, a) || (b && b.id !== a.id && !fits(fk, i, b))) return;
    if (b && b.id === a.id && a.dur === undefined && b.dur === undefined) { // 同じ物は重ねる
      const k = Math.min(a.n, ITEMS[a.id].stack - b.n);
      b.n += k; a.n -= k;
      if (!a.n) A[i] = null;
    } else { A[i] = b; B[j] = a; }
    done();
  }
  // 持ち物 → 設備: 置ける所へ（同じ物の上に重ねてから、空いた所へ）
  function intoStation(i) {
    const a = inventory.slots[i];
    if (a && insertInto(cur(), a) && !a.n) inventory.slots[i] = null;
  }
  // 自動作業台: 作る物を選ぶ。いらなくなった素材は持ち物へ戻す（入りきらない分は残る）
  function pickBench(p, idx) {
    p.recipe = idx;
    p.prog[0] = 0;
    p.slots.forEach((s, i) => {
      if (STATIONS[p.type].slots[i] !== 'in' || !s || RECIPES[idx].need[s.id] !== undefined) return;
      s.n -= inventory.add(s.id, s.n);
      if (!s.n) p.slots[i] = null;
    });
    done();
  }
  function quickMove(kind, i) {
    const it = arr(kind)[i], spot = kind === 'inv' && it ? equip.spotFor(it.id) : -1;
    if (kind === 'eq') moveSlot(equip.slots, i, inventory.slots); // 装備を外す
    else if (spot >= 0) [equip.slots[spot], inventory.slots[i]] = [it, equip.slots[spot]]; // 合う枠に付ける（付いていた物は入れかえ）
    else if (cur()) { if (kind === 'st') moveSlot(cur().slots, i, inventory.slots); else intoStation(i); }
    else { // 手に持つ列 ⇔ 持ち物の奥
      const [a, b] = i < BAR ? [BAR, inventory.slots.length] : [0, BAR], part = inventory.slots.slice(a, b);
      moveSlot(inventory.slots, i, part);
      inventory.slots.splice(a, b - a, ...part);
    }
    done();
  }
  panel.addEventListener('pointerdown', (e) => {
    const slot = e.target.closest('.slot');
    if (!slot || e.button !== 0) return;
    const kind = slot.dataset.kind, i = Number(slot.dataset.i), item = arr(kind)[i];
    if (!item) return;
    e.preventDefault();
    if (e.shiftKey) return quickMove(kind, i);
    drag = { kind, i, node: slot, ghost: el(`<img class="drag-ghost" src="${iconUrl(item.id)}" alt="">`) };
    drag.ghost.style.left = `${e.clientX}px`; drag.ghost.style.top = `${e.clientY}px`;
    slot.classList.add('drag-from');
    if (e.pointerType === 'touch') { // タッチの長押し = Shift+クリック（すぐ移す。ui.md「タッチ操作」）。動かしたらドラッグ
      drag.x = e.clientX; drag.y = e.clientY;
      drag.press = setTimeout(() => { const d = drag; if (!d) return; drag = null; d.ghost.remove(); d.node.classList.remove('drag-from'); quickMove(kind, i); }, 450);
    }
  });
  addEventListener('pointermove', (e) => {
    if (!drag) return;
    drag.ghost.style.left = `${e.clientX}px`; drag.ghost.style.top = `${e.clientY}px`;
    if (drag.press && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 10) { clearTimeout(drag.press); drag.press = 0; }
  });
  addEventListener('pointerup', (e) => {
    if (!drag) return;
    const d = drag, to = document.elementFromPoint(e.clientX, e.clientY)?.closest('.slot');
    drag = null;
    clearTimeout(d.press);
    d.ghost.remove();
    d.node.classList.remove('drag-from');
    if (to?.dataset.kind && panel.contains(to) && !panel.hidden) dropOn(d.kind, d.i, to.dataset.kind, Number(to.dataset.i));
  });

  panel.addEventListener('click', (e) => {
    const tb = e.target.closest('.tab');
    if (tb) { if (!cur()) { tab = tb.dataset.tab; render(); } return; }
    const all = e.target.closest('[data-all]');
    if (all && cur()) { // チェスト: 全部入れる（持ち物の奥から）・全部取る
      const box = cur().slots;
      if (all.dataset.all === 'put') for (let i = BAR; i < inventory.slots.length; i++) moveSlot(inventory.slots, i, box);
      else box.forEach((_, i) => moveSlot(box, i, inventory.slots));
      done();
      return;
    }
    const btn = e.target.closest('.recipe button');
    if (btn) {
      const rc = RECIPES[Number(btn.closest('.recipe').dataset.i)];
      if (!rc.station && inventory.craft(rc, nearAt)) gainToast(rc.out, rc.n); // 作業台は長押し（下）
    }
  });
  // 作業台のレシピは長押しで作る（ui.md「設備の窓」）: 押している間ボタンに進み具合がたまり、たまると 1 つできる。離す・窓を閉じる・足りなくなると最初から
  let hold = null;
  const stopHold = () => {
    if (!hold) return;
    cancelAnimationFrame(hold.raf);
    hold.btn.style.setProperty('--p', 0);
    hold.btn.classList.remove('holding');
    hold = null;
  };
  panel.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.station-win .recipe button');
    if (!btn || btn.disabled || e.button !== 0) return;
    const rc = RECIPES[Number(btn.closest('.recipe').dataset.i)];
    if (!rc.station || !inventory.canCraft(rc, nearAt)) return;
    stopHold();
    hold = { btn, t0: performance.now(), raf: 0 };
    btn.classList.add('holding');
    const tick = (now) => {
      if (!hold || hold.btn !== btn) return;
      if (!inventory.canCraft(rc, nearAt)) return stopHold();
      const p = (now - hold.t0) / 1000 / (rc.time ?? 2);
      btn.style.setProperty('--p', Math.min(1, p));
      if (p >= 1) {
        if (inventory.craft(rc, nearAt)) gainToast(rc.out, rc.n);
        hold.t0 = now; // 押し続けると続けて作る
      }
      hold.raf = requestAnimationFrame(tick);
    };
    hold.raf = requestAnimationFrame(tick);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) panel.addEventListener(ev, (e) => { if (hold && (ev !== 'pointerleave' || e.target === hold.btn)) stopHold(); }, true);

  let lastSel = inventory.sel;
  inventory.onChange(() => {
    render();
    if (inventory.sel !== lastSel) { lastSel = inventory.sel; showHeldName(); }
  });

  function toast(text, id) {
    const t = el(`<div class="panel toast">${id ? `<img src="${iconUrl(id)}" alt="">` : ''}${text}</div>`, toasts);
    t.timer = setTimeout(() => t.remove(), 2000);
    return t;
  }
  // 手に入れた知らせ: 同じ物が続いたら、出ている知らせの数を足す
  const gains = new Map(); // id → {t, n}
  function gainToast(id, n) {
    const g = gains.get(id);
    const total = g?.t.isConnected ? g.n + n : n;
    if (g?.t.isConnected) { clearTimeout(g.t.timer); g.t.remove(); }
    const t = toast(`＋${total} ${ITEMS[id].name}<span class="sub">（${inventory.count(id)}）</span>`, id);
    gains.set(id, { t, n: total });
  }
  render();

  return {
    set hidden(v) {
      shown = !v;
      if (v) { stopHold(); aim.hidden = true; aimText = null; panel.hidden = true; station.open(null); }
      toasts.hidden = bar.hidden = v;
    },
    get open() { return !panel.hidden; },
    // c: 設備のパーツ（右に設備の窓を開く。stations.js の表にある物）
    setOpen(v, c = null) {
      stopHold();
      panel.hidden = !v || !shown;
      bar.hidden = !shown || !panel.hidden;
      station.open(v && c && STATIONS[c.type] ? c : null);
      if (v) aim.hidden = true, aimText = null;
      render();
    },
    // 照準の先の物 { name, key }（なければ null）
    setAim(info) {
      const html = info && panel.hidden ? `${info.name} <b>${info.key}</b>` : null;
      if (html === aimText) return;
      aimText = html;
      aim.hidden = !html;
      if (html) aim.innerHTML = html;
    },
    gained(id, n) { gainToast(id, n); },
    get station() { return cur(); },
    // 開いている設備の窓を描き直す（設備の時間が進んだとき。main.js から）
    refreshStation() {
      if (panel.hidden || !cur()) return;
      station.win.querySelectorAll('.slot').forEach(fillSlot);
      station.refresh();
    },
    message(text) { toast(text); },
  };
}
