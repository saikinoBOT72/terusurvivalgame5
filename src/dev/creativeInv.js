// 開発用クリエイティブインベントリ（あとで src/dev/ ごと消す。main.js の import 1 行も消す）
// 全アイテムの別窓（持ち物の窓の左に出る）。マスをドラッグして持ち物・装備・設備のマスへ落とす。クリックで持ち物に 1 スタック入る
import { ITEMS } from '../survival/items.js';
import { accepts, stationChanged } from '../survival/stations.js';
import { iconUrl } from '../ui/icons.js';
import { el, winHead } from '../ui/uiKit.js';

const CSS = `
.creative-inv { position: fixed; left: 16px; top: 50%; transform: translateY(-50%); z-index: 5; width: max-content; max-height: 80vh; display: flex; flex-direction: column; gap: 8px; }
.creative-inv[hidden] { display: none; }
.creative-inv input { width: 100%; box-sizing: border-box; }
.creative-inv .grid { display: grid; grid-template-columns: repeat(6, 56px); gap: 6px; overflow: auto; touch-action: pan-y; }
.creative-inv .slot { cursor: grab; }
`;

export function createCreativeInv({ inventory, equip, invHud }) {
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: CSS }));
  const ids = Object.keys(ITEMS);
  const win = el(`<div class="panel win creative-inv" hidden>${winHead('クリエイティブ（開発用）')}<input type="search" placeholder="名前で絞る"><div class="grid"></div></div>`);
  const grid = win.querySelector('.grid'), search = win.querySelector('input');
  let built = false; // アイコンは重いので、はじめて開いたときに作る
  const build = () => { built = true; grid.innerHTML = ids.map((id) => `<div class="slot" data-id="${id}" title="${ITEMS[id].name}"><img src="${iconUrl(id)}" alt=""></div>`).join(''); };
  search.addEventListener('keydown', (e) => e.stopPropagation()); // 入力中のキーをゲームに渡さない
  search.addEventListener('input', () => {
    const q = search.value.trim();
    grid.querySelectorAll('.slot').forEach((s) => { s.hidden = !!q && !ITEMS[s.dataset.id].name.includes(q) && !s.dataset.id.toLowerCase().includes(q.toLowerCase()); });
  });

  const make = (id, n = ITEMS[id].stack) => ({ id, n, ...(ITEMS[id].dur ? { dur: ITEMS[id].dur } : {}) });
  // 落とした先のマス（.inv の中の data-kind つき）へ入れる。大事な物は持ち物の窓のどこでもよい
  function drop(id, to) {
    const st = invHud.station;
    if (ITEMS[id].key) return void inventory.add(id, 1);
    const kind = to?.dataset.kind, j = Number(to?.dataset.i);
    if (kind === 'inv') {
      const cur = inventory.slots[j];
      if (cur && cur.id === id && cur.dur === undefined) cur.n = ITEMS[id].stack;
      else inventory.slots[j] = make(id);
    } else if (kind === 'eq') {
      if (!equip.fits(j, id)) return;
      equip.slots[j] = make(id, 1);
    } else if (kind === 'st' && st) {
      if (!accepts(st.type, j, id, st)) return;
      st.slots[j] = make(id);
      stationChanged(st);
    } else return;
    inventory.changed();
  }

  let drag = null;
  win.addEventListener('pointerdown', (e) => {
    const slot = e.target.closest('.slot');
    if (!slot || e.button !== 0) return;
    e.preventDefault();
    const ghost = el(`<img class="drag-ghost" src="${iconUrl(slot.dataset.id)}" alt="">`);
    ghost.style.left = `${e.clientX}px`; ghost.style.top = `${e.clientY}px`;
    drag = { id: slot.dataset.id, ghost, x: e.clientX, y: e.clientY };
  });
  addEventListener('pointermove', (e) => {
    if (!drag) return;
    drag.ghost.style.left = `${e.clientX}px`; drag.ghost.style.top = `${e.clientY}px`;
  });
  addEventListener('pointerup', (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    d.ghost.remove();
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) { inventory.add(d.id, ITEMS[d.id].stack); return; } // クリック
    const to = document.elementFromPoint(e.clientX, e.clientY), inv = to?.closest('.inv');
    if (inv) drop(d.id, to.closest('.slot[data-kind]'));
  });

  // 持ち物の窓が開いている間だけ出す
  const inv = document.querySelector('.inv');
  let on = true; // 設定でオン・オフ
  const sync = () => { if (on && !inv.hidden && !built) build(); win.hidden = inv.hidden || !on; };
  new MutationObserver(sync).observe(inv, { attributes: true, attributeFilter: ['hidden'] });
  sync();
  return { setOn(v) { on = v; sync(); } };
}
