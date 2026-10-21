// 設定（docs/rules/ui.md「設定と舵の表示」「設定の窓」）: 値と保存だけ。窓は settingsWin.js
// マウスの感度（Valorant の数値）、視野の広さ（Valorant の横の視野角）、UI の大きさ、フレームレート表示。ブラウザに保存する（セーブとは別）
// tab: 設定の窓のどのタブか（km キーマウ / touch タッチ / screen 画面）。num: 数字を直接入力する欄にする。toggle: 切り替え。choice: [[値, 名前]] から 1 つ選ぶ
import { toggleHtml, toggleGet, toggleSet } from './uiKit.js';

const KEY = 'oasobi5.settings';
export const SETTINGS = [
  { key: 'vsens', tab: 'km', name: 'マウスの感度', min: 0.05, max: 5, step: 0.01, def: 1.8, num: true, fmt: () => 'Valorant' },
  { key: 'touch', tab: 'touch', name: 'タッチ操作', choice: [['auto', '自動'], ['on', '使う'], ['off', '使わない']], def: 'auto' },
  { key: 'tsens', tab: 'touch', name: '視点の感度', min: 0.2, max: 3, step: 0.05, def: 1, fmt: (v) => `${v.toFixed(2)} 倍` },
  { key: 'hfov', tab: 'screen', name: '視野角（横）', min: 60, max: 140, step: 1, def: 103, num: true, fmt: () => '度' },
  { key: 'ui', tab: 'screen', name: 'UI の大きさ', min: 0.8, max: 1.5, step: 0.05, def: 1, fmt: (v) => `${v.toFixed(2)} 倍` },
  { key: 'fps', tab: 'screen', name: 'フレームレート表示', toggle: true, def: false },
  ...(import.meta.env.DEV ? [{ key: 'creative', tab: 'screen', name: 'クリエイティブインベントリ（開発用）', toggle: true, def: true }] : []),
];
// Valorant の感度: 1 カウントで 0.07 度 × 数値（ラジアンで返す）
export const sensRad = (vsens) => vsens * 0.07 * Math.PI / 180;
// 横の視野角（16:9 の画面での角度）→ 縦の視野角。画面の形が変わっても縦の角度は同じ
export const vfovOf = (hfov) => 2 * Math.atan(Math.tan(hfov * Math.PI / 360) * 9 / 16) * 180 / Math.PI;

export function loadSettings() {
  const v = Object.fromEntries(SETTINGS.map((s) => [s.key, s.def]));
  try { Object.assign(v, JSON.parse(localStorage.getItem(KEY)) ?? {}); } catch { /* 使えなければはじめの値 */ }
  return v;
}
export function saveSettings(v) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* 保存できなくても遊べる */ }
}
// そのタブの設定をはじめの値に戻す
export function resetTab(v, tab) {
  for (const s of SETTINGS) if (s.tab === tab) v[s.key] = s.def;
  saveSettings(v);
}
// タブの中身
export function settingsRows(v, tab) {
  return SETTINGS.filter((s) => s.tab === tab).map((s) => s.choice
    ? `<div class="field row2"><span>${s.name}</span><div class="tabs choice">${s.choice.map(([c, n]) => `<button type="button" class="tab${v[s.key] === c ? ' on' : ''}" data-key="${s.key}" data-val="${c}">${n}</button>`).join('')}</div></div>`
    : s.toggle
    ? `<div class="field row2"><span>${s.name}</span>${toggleHtml(s.key, v[s.key])}</div>`
    : `<label class="field"><span>${s.name}</span><input type="${s.num ? 'number' : 'range'}" data-key="${s.key}" min="${s.min}" max="${s.max}" step="${s.step}" value="${v[s.key]}"><b>${s.fmt(v[s.key])}</b></label>`).join('');
}
// onChange(値): 変えるたびに呼ぶ
export function bindSettings(box, v, onChange) {
  box.addEventListener('input', (e) => {
    const k = e.target.dataset?.key, s = SETTINGS.find((x) => x.key === k);
    if (!s || s.toggle || s.choice) return;
    const n = Number(e.target.value);
    if (e.target.value === '' || !(n >= s.min && n <= s.max)) return; // 入力の途中・範囲の外は、そのままにして反映しない
    v[k] = n;
    e.target.nextElementSibling.textContent = s.fmt(v[k]);
    saveSettings(v);
    onChange(v);
  });
  box.addEventListener('click', (e) => {
    const c = e.target.closest('button[data-val]');
    if (c) {
      v[c.dataset.key] = c.dataset.val;
      c.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === c));
      saveSettings(v);
      return onChange(v);
    }
    const b = e.target.closest('button.toggle');
    if (!b) return;
    const on = !toggleGet(b);
    toggleSet(b, on);
    v[b.dataset.key] = on;
    saveSettings(v);
    onChange(v);
  });
}
