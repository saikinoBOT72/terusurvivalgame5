// 設備の窓（docs/rules/ui.md「設備の窓」）: 持ち物の窓（真ん中）の右に出す。中身の並びは stations.js の表から作る
// 入れる → 進み具合の矢印 → できた、の列。その下に燃料のマスと炎のゲージ。チェストはマス、作業台はレシピの一覧
// マスの絵・ドラッグ・Shift＋クリック・レシピの「作る」は inventoryHud.js が持ち物と同じ処理で扱う（data-kind="st"）
import { ITEMS, RECIPES } from '../survival/items.js';
import { STATIONS } from '../survival/stations.js';
import { iconUrl } from './icons.js';
import { partIcon } from './buildMenu.js';
import { UI_SHAPES } from './uiShapes.js';
import { winHead } from './uiKit.js';

const ROLE = { in: '入れる', out: 'できた', fuel: '燃料' }; // 空のマスにうすく出す字

// slotHtml(i, kind): マス、recipeHtml(rc, i): レシピの行（どちらも inventoryHud.js と同じ形）
export function createStationWindow(parent, { slotHtml, recipeHtml }) {
  const win = document.createElement('div');
  win.className = 'panel station-win';
  win.hidden = true;
  parent.appendChild(win);
  let part = null;
  const slot = (S, i) => slotHtml(i, 'st').replace('<img alt="">', `<img alt=""><span class="role">${ROLE[S.slots[i]] ?? ''}</span>`);

  function build(p) {
    const S = STATIONS[p.type];
    let html = `<div class="st-head"><img src="${partIcon(p.type)}" alt=""><div>${winHead(S.name)}<div class="st-state"></div></div></div>`;
    if (S.lanes) {
      html += S.lanes.map(([a, b], k) => `<div class="st-lane">${slot(S, a)}<div class="st-arrow" data-k="${k}"><div class="shape"><i></i></div></div>${slot(S, b)}</div>`).join('');
      if (S.fuel !== undefined) {
        html += `<div class="st-fuel">${slot(S, S.fuel)}<div class="gauge fuel"><img src="${iconUrl('ui:flame', UI_SHAPES.flame)}" alt=""><div class="track"><i></i></div></div></div>
          <div class="st-note">${Object.entries(S.fuels).map(([id, t]) => `<span><img src="${iconUrl(id)}" alt="">${ITEMS[id].name} 1 つで ${t} 秒</span>`).join('')}</div>`;
      }
    } else if (S.recipes) {
      html += `<div class="recipes">${RECIPES.map((rc, i) => (rc.station === S.recipes ? recipeHtml(rc, i) : '')).join('')}</div>`;
    } else {
      html += `<div class="grid">${S.slots.map((_, i) => slot(S, i)).join('')}</div>
        <div class="chest-btns"><button type="button" data-all="put">全部入れる</button><button type="button" data-all="take">全部取る</button></div>`;
    }
    win.innerHTML = html;
  }

  return {
    win,
    get part() { return part; },
    open(p) {
      part = p;
      win.hidden = !p;
      if (p) { build(p); this.refresh(); }
    },
    // 進み具合の矢印・燃料のゲージ・燃えているか（中身のマスは inventoryHud.js の fillSlot）
    refresh() {
      if (!part) return;
      const S = STATIONS[part.type];
      win.querySelectorAll('.st-arrow').forEach((ar) => {
        const k = Number(ar.dataset.k), s = part.slots[S.lanes[k][0]], rc = s && S.recipe(s.id);
        ar.querySelector('i').style.width = `${rc ? Math.min(1, part.prog[k] / rc.time) * 100 : 0}%`;
      });
      const g = win.querySelector('.gauge.fuel i');
      if (g) g.style.width = `${Math.min(1, part.burn / Math.max(...Object.values(S.fuels))) * 100}%`;
      win.classList.toggle('burning', !!part.burning);
      const st = win.querySelector('.st-state');
      if (S.lanes) st.textContent = part.burning ? (S.fuel !== undefined ? '燃えている' : '動いている') : S.fuel !== undefined && !part.burn && !part.slots[S.fuel] ? '燃料がない' : '止まっている';
    },
  };
}
