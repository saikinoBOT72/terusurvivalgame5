// 持ち物まわりの画面表示（docs/rules/ui.md「持ち物とクラフト」「石の板の見た目」）
// 手に持つ列（いつも出す）、Tab の持ち物・クラフト画面（タブで切り替え。いつも画面の真ん中）、設備の窓（右。stationHud.js）、照準の下のヒント、手に入れたときの表示
import { ITEMS, RECIPES } from '../survival/items.js';
import { SLOTS, BAR, moveSlot } from '../survival/inventory.js';
import { iconUrl } from './icons.js';
import { partIcon } from './buildMenu.js';
import { corner } from './hud.js';
import { createStationWindow } from './stationHud.js';
import { STATIONS, accepts, stationChanged } from '../survival/stations.js';

function el(html, parent = document.body) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return parent.appendChild(t.content.firstChild);
}
const slotHtml = (i, kind = 'inv', key = '') => `<div class="slot" data-kind="${kind}" data-i="${i}"><img alt=""><span class="n"></span><i class="dur"></i>${key}</div>`;
const range = (a, b) => Array.from({ length: b - a }, (_, k) => a + k);

// vitals(): HP・おなか・水分（Tab の画面に数字で出す）
// known(rc): そのレシピの設計図を読んだか（読んでいないレシピは出さない）
export function createInventoryHud(inventory, { vitals = () => null, known = () => true } = {}) {
  const aim = el('<div class="aim-name panel" hidden></div>', corner());
  const toasts = el('<div class="toasts"></div>', corner());
  const bar = el(`<div class="hotbar"><div class="held-name outlined"></div><div class="row">${range(0, BAR).map((i) => slotHtml(i, 'inv', `<span class="key">${i + 1}</span>`)).join('')}</div></div>`);
  const panel = el(`
    <div class="panel inv" hidden>
      <div class="tabs">
        <button type="button" class="tab" data-tab="bag" title="持ち物"><img src="${partIcon('chest')}" alt="持ち物"></button>
        <button type="button" class="tab" data-tab="craft" title="クラフト"><img src="${iconUrl('stoneHammer')}" alt="クラフト"></button>
      </div>
      <div class="vitals"></div>
      <div class="bag">
        <div class="title">持ち物</div>
        <div class="grid">${range(BAR, SLOTS).map((i) => slotHtml(i)).join('')}</div>
        <div class="sub">手に持つ列（1〜6 キー）</div>
        <div class="grid bar">${range(0, BAR).map((i) => slotHtml(i)).join('')}</div>
      </div>
      <div class="craft" hidden>
        <div class="title">クラフト</div>
        <div class="recipes"></div>
      </div>
    </div>`);
  const recipes = panel.querySelector('.recipes');
  const recipeHtml = (rc, i) => `
    <div class="recipe" data-i="${i}">
      <img src="${iconUrl(rc.out)}" alt="">
      <div class="info"><div class="name">${ITEMS[rc.out].name}${rc.n > 1 ? ` ×${rc.n}` : ''}</div><div class="need"></div></div>
      <button type="button">作る</button>
    </div>`;
  RECIPES.forEach((rc, i) => { if (!rc.station) el(recipeHtml(rc, i), recipes); }); // 設備で作る物は、その設備の窓に出す
  const station = createStationWindow(panel, { slotHtml, recipeHtml });
  const cur = () => station.part; // 開いている設備
  const nearAt = (type) => cur()?.type === type; // 設備のレシピは、その設備の窓を開いているときだけ作れる

  let aimText = null, shown = true, heldTimer = 0, tab = 'bag', drag = null;

  function fillSlot(node) {
    const i = Number(node.dataset.i), s = node.dataset.kind === 'st' ? cur()?.slots[i] : inventory.slots[i];
    const img = node.querySelector('img'), dur = node.querySelector('.dur');
    node.querySelector('.role')?.toggleAttribute('hidden', !!s);
    if (s) { img.src = iconUrl(s.id); img.hidden = false; } else img.hidden = true;
    node.querySelector('.n').textContent = s && s.n > 1 ? s.n : '';
    node.title = s ? ITEMS[s.id].name : '';
    dur.hidden = !s || s.dur === undefined;
    if (!dur.hidden) { // 耐久: 半分より多いと緑、2 割まで黄、それより少ないと赤
      const k = s.dur / ITEMS[s.id].dur;
      dur.style.width = `${k * 80}%`;
      dur.style.background = `var(--ui-${k > 0.5 ? 'ok' : k > 0.2 ? 'hunger' : 'ng'})`;
    }
    node.classList.toggle('on', node.dataset.kind === 'inv' && i === inventory.sel);
  }
  function render() {
    bar.querySelectorAll('.slot').forEach(fillSlot);
    if (panel.hidden) return;
    panel.querySelectorAll('.slot').forEach(fillSlot);
    if (cur()) tab = 'bag'; // 設備を開いている間は持ち物を出しておく（右の窓と物をやりとりする）
    panel.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tab));
    panel.querySelector('.bag').hidden = tab !== 'bag';
    panel.querySelector('.craft').hidden = tab !== 'craft';
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
    row.querySelector('.need').innerHTML = Object.entries(rc.need).map(([id, n]) => {
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
  const arr = (kind) => (kind === 'st' ? cur().slots : inventory.slots);
  // 設備のスロットに置けるか（ui.md「設備の窓」: 燃料は燃料のスロット、入れる物は入れるスロット、出るスロットには置けない）
  const fits = (kind, i, item) => !item || kind !== 'st' || accepts(cur().type, i, item.id);
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
    const a = inventory.slots[i], S = cur().slots;
    if (!a) return;
    const spots = S.map((_, j) => j).filter((j) => accepts(cur().type, j, a.id));
    for (const j of [...spots.filter((j) => S[j]?.id === a.id), ...spots.filter((j) => !S[j])]) {
      if (!a.n) break;
      if (a.dur !== undefined) { if (!S[j]) { S[j] = a; inventory.slots[i] = null; } return; } // 道具は重ねない
      if (!S[j]) S[j] = { id: a.id, n: 0 };
      if (S[j].id !== a.id) continue;
      const k = Math.min(a.n, ITEMS[a.id].stack - S[j].n);
      S[j].n += k; a.n -= k;
    }
    if (!a.n) inventory.slots[i] = null;
  }
  function quickMove(kind, i) {
    if (cur()) { if (kind === 'st') moveSlot(cur().slots, i, inventory.slots); else intoStation(i); }
    else { // 手に持つ列 ⇔ 持ち物の奥
      const [a, b] = i < BAR ? [BAR, SLOTS] : [0, BAR], part = inventory.slots.slice(a, b);
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
  });
  addEventListener('pointermove', (e) => { if (drag) { drag.ghost.style.left = `${e.clientX}px`; drag.ghost.style.top = `${e.clientY}px`; } });
  addEventListener('pointerup', (e) => {
    if (!drag) return;
    const d = drag, to = document.elementFromPoint(e.clientX, e.clientY)?.closest('.slot');
    drag = null;
    d.ghost.remove();
    d.node.classList.remove('drag-from');
    if (to && panel.contains(to) && !panel.hidden) dropOn(d.kind, d.i, to.dataset.kind, Number(to.dataset.i));
  });

  panel.addEventListener('click', (e) => {
    const tb = e.target.closest('.tab');
    if (tb) { if (!cur()) { tab = tb.dataset.tab; render(); } return; }
    const all = e.target.closest('[data-all]');
    if (all && cur()) { // チェスト: 全部入れる（持ち物の奥から）・全部取る
      const box = cur().slots;
      if (all.dataset.all === 'put') for (let i = BAR; i < SLOTS; i++) moveSlot(inventory.slots, i, box);
      else box.forEach((_, i) => moveSlot(box, i, inventory.slots));
      done();
      return;
    }
    const btn = e.target.closest('.recipe button');
    if (btn) {
      const rc = RECIPES[Number(btn.closest('.recipe').dataset.i)];
      if (inventory.craft(rc, nearAt)) gainToast(rc.out, rc.n);
    }
  });
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
      if (v) { aim.hidden = true; aimText = null; panel.hidden = true; station.open(null); }
      toasts.hidden = bar.hidden = v;
    },
    get open() { return !panel.hidden; },
    // c: 設備のパーツ（右に設備の窓を開く。stations.js の表にある物）
    setOpen(v, c = null) {
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
