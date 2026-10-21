// 装備の列と大事な物の一覧（docs/rules/ui.md「持ち物の広さと装備」）: 持ち物の窓（真ん中）の左に装備の列、タブ「大事な物」に一覧
// マスの絵・ドラッグ・Shift＋クリックは inventoryHud.js が持ち物と同じ処理で扱う（data-kind="eq"）
import { ITEMS } from '../survival/items.js';
import { EQUIP_SLOTS, statsText } from '../survival/equip.js';
import { iconUrl } from './icons.js';
import { el, winHead } from './uiKit.js';

// slotHtml(i, kind): マス（inventoryHud.js と同じ形）。空のマスには役目の字をうすく出す
export function createEquipColumn(parent, { slotHtml }) {
  const slot = (s, i) => slotHtml(i, 'eq').replace('<img alt="">', `<img alt=""><span class="role">${s.label}</span>`);
  return el(`<div class="panel win equip-col">${winHead('装備')}<div class="eq-slots">${EQUIP_SLOTS.map(slot).join('')}</div><div class="sub eq-sum"></div></div>`, parent);
}

// 大事な物の一覧（アイコン・名前・説明）
export function keyListHtml(ids) {
  if (!ids.length) return '<div class="key-empty">まだ何もない</div>';
  return ids.map((id) => `
    <div class="key-row"><img src="${iconUrl(id)}" alt=""><div><div class="name">${ITEMS[id].name}</div><div class="desc">${ITEMS[id].desc ?? ''}</div></div></div>`).join('');
}

// 装備の列の下の、効き目の合計（ui.md「持ち物の広さと装備」。何も付けていなければ空）
export const fillEquipSum = (panel, equip) => { panel.querySelector('.eq-sum').textContent = statsText(equip.stats()).replaceAll('・', '\n'); };
// マスに乗せたときの文字: 名前と、装備ならその効き目
export const slotTitle = (id) => [ITEMS[id].name, statsText(ITEMS[id].equipStats)].filter(Boolean).join('\n');
