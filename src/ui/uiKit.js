// 画面の共通部品の HTML（docs/rules/ui.md「共通部品」）。見た目は kit.css
export function el(html, parent = document.body) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return parent.appendChild(t.content.firstChild);
}

// 窓の題の行。close: メニューから開く窓だけ右に × を付ける
export const winHead = (title, close = false) =>
  `<div class="win-head"><span class="win-title">${title}</span>${close ? '<button type="button" class="win-x btn-s" title="閉じる">×</button>' : ''}</div>`;

// タブの並び。tabs: [[キー, 名前]]、cls: ボタンに足すクラス
export const tabsHtml = (tabs, attr = 'data-tab') =>
  `<div class="tabs">${tabs.map(([k, name]) => `<button type="button" class="tab" ${attr}="${k}">${name}</button>`).join('')}</div>`;
export function markTab(box, key, attr = 'tab') {
  box.querySelectorAll(`.tab[data-${attr}]`).forEach((b) => b.classList.toggle('on', b.dataset[attr] === key));
}

// 切り替え（オン・オフ）。使う側は click で toggleSet(button, !toggleGet(button))
export const toggleHtml = (key, on) => `<button type="button" class="toggle" role="switch" data-key="${key}" aria-checked="${!!on}"><i></i></button>`;
export const toggleGet = (b) => b.getAttribute('aria-checked') === 'true';
export const toggleSet = (b, on) => b.setAttribute('aria-checked', String(!!on));

// キーの札
export const keyCap = (name, cls = '') => `<kbd class="keycap ${cls}">${name}</kbd>`;
