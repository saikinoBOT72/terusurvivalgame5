// 設備の窓（docs/rules/ui.md「設備の窓」）: 持ち物の窓（真ん中）の右に出す。中身の並びは stations.js の表から作る
// 入れる → 進み具合の矢印 → できた、の列。その下に燃料のマスと炎のゲージ。チェストはマス、作業台はレシピの一覧
// 電気の機械は上に電気の帯（automation.md「窓」）。自動作業台は入れる 6 マスと、作る物の選び
// マスの絵・ドラッグ・Shift＋クリック・レシピの「作る」は inventoryHud.js が持ち物と同じ処理で扱う（data-kind="st"）
import { ITEMS, RECIPES } from '../survival/items.js';
import { STATIONS } from '../survival/stations.js';
import { netText } from '../automation/power.js';
import { benchReady, benchSecs, DRILL_SECS } from '../automation/machines.js';
import { iconUrl } from './icons.js';
import { partIcon } from './buildMenu.js';
import { UI_SHAPES } from './uiShapes.js';
import { winHead } from './uiKit.js';

const ROLE = { in: '入れる', out: 'できた', fuel: '燃料' }; // 空のマスにうすく出す字
const ARROW = '<div class="st-arrow" data-k="0"><div class="shape"><i></i></div></div>';

// slotHtml(i, kind): マス、recipeHtml(rc, i): レシピの行（どちらも inventoryHud.js と同じ形）
// known(rc): そのレシピの設計図を持っているか。onPick(part, 番号): 自動作業台で作る物を選んだ
export function createStationWindow(parent, { slotHtml, recipeHtml, known = () => true, onPick = () => {} }) {
  const win = document.createElement('div');
  win.className = 'panel station-win';
  win.hidden = true;
  parent.appendChild(win);
  let part = null;
  const slot = (S, i) => slotHtml(i, 'st').replace('<img alt="">', `<img alt=""><span class="role">${ROLE[S.slots[i]] ?? ''}</span>`);
  const pickRow = (rc, i) => `<button type="button" class="pick" data-r="${i}"><img src="${iconUrl(rc.out)}" alt=""><span>${ITEMS[rc.out].name}${rc.n > 1 ? ` ×${rc.n}` : ''}</span></button>`;

  function build(p) {
    const S = STATIONS[p.type];
    let html = `<div class="st-head"><img src="${partIcon(p.type)}" alt=""><div>${winHead(S.name)}<div class="st-state"></div></div></div>`;
    if (S.electric || p.type === 'generator') html += '<div class="st-power"></div>';
    if (S.bench) { // 自動作業台
      html += `<div class="st-lane st-ins">${[0, 1, 2, 3, 4, 5].map((i) => slot(S, i)).join('')}</div>
        <div class="st-lane">${ARROW}${slot(S, 6)}</div>
        <div class="st-note">作る物を選ぶ（入れるマスは、その素材だけ入る）</div>
        <div class="st-pick">${RECIPES.map((rc, i) => ((!rc.station || rc.station === 'workbench') && known(rc) ? pickRow(rc, i) : '')).join('')}</div>`;
    } else if (S.lanes) {
      html += S.lanes.map(([a, b], k) => `<div class="st-lane">${slot(S, a)}<div class="st-arrow" data-k="${k}"><div class="shape"><i></i></div></div>${slot(S, b)}</div>`).join('');
      const outs = S.slots.map((r, i) => (r === 'out' && !S.lanes.some((ln) => ln.includes(i)) ? slot(S, i) : '')).join(''); // 列に入っていない出るスロット（ドリル）
      if (outs) html += `<div class="st-lane">${ARROW}${outs}</div>`;
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

  const api = {
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
      const S = STATIONS[part.type], elec = S.electric || part.type === 'generator';
      win.querySelectorAll('.st-arrow').forEach((ar) => {
        const k = Number(ar.dataset.k);
        let f = 0;
        if (S.bench) { const rc = benchReady(part); f = rc ? part.prog[0] / benchSecs(rc) : 0; }
        else if (part.type === 'drill') f = part.prog[0] / DRILL_SECS;
        else { const s = part.slots[S.lanes[k][0]], rc = s && S.recipe(s.id); f = rc ? part.prog[k] / rc.time : 0; }
        ar.querySelector('i').style.width = `${Math.min(1, f) * 100}%`;
      });
      const g = win.querySelector('.gauge.fuel i');
      if (g) g.style.width = `${Math.min(1, part.burn / Math.max(...Object.values(S.fuels))) * 100}%`;
      win.classList.toggle('burning', !!part.burning);
      win.querySelectorAll('.pick').forEach((b) => b.classList.toggle('on', Number(b.dataset.r) === part.recipe));
      const pw = win.querySelector('.st-power');
      if (pw) { pw.textContent = netText(part); pw.dataset.state = !part.net ? 'none' : part.net.ok ? 'ok' : 'lack'; }
      const st = win.querySelector('.st-state');
      if (!S.lanes) return;
      if (elec) st.textContent = part.burning ? '動いている' : part.type === 'generator' && !part.burn && !part.slots[0] ? '燃料がない' : '止まっている'; // 電気の詳しい様子は帯に
      else st.textContent = part.burning ? (S.fuel !== undefined ? '燃えている' : '動いている') : S.fuel !== undefined && !part.burn && !part.slots[S.fuel] ? '燃料がない' : '止まっている';
    },
  };
  win.addEventListener('click', (e) => { // 自動作業台の作る物
    const b = e.target.closest('.pick');
    if (!b || !part) return;
    onPick(part, Number(b.dataset.r));
    api.refresh();
  });
  return api;
}
