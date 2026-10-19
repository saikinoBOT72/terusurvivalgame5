// 設定（docs/rules/ui.md「設定と舵の表示」）: マウスの感度（Valorant の数値）、視野の広さ（Valorant の横の視野角）、UI の大きさ。ブラウザに保存する（セーブとは別）
// num: 数字を直接入力する欄にする
const KEY = 'oasobi5.settings';
export const SETTINGS = [
  { key: 'vsens', name: 'マウスの感度', min: 0.05, max: 5, step: 0.01, def: 1.8, num: true, fmt: () => 'Valorant' },
  { key: 'hfov', name: '視野角（横）', min: 60, max: 140, step: 1, def: 103, num: true, fmt: () => '度' },
  { key: 'ui', name: 'UI の大きさ', min: 0.8, max: 1.5, step: 0.05, def: 1, fmt: (v) => `${v.toFixed(2)} 倍` },
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
// 設定の画面の中身（メニューの中に出す）。onChange(値): 変えるたびに呼ぶ
export function settingsHtml(v) {
  return SETTINGS.map((s) => `<label class="setting"><span>${s.name}</span>
    <input type="${s.num ? 'number' : 'range'}" data-key="${s.key}" min="${s.min}" max="${s.max}" step="${s.step}" value="${v[s.key]}"><b>${s.fmt(v[s.key])}</b></label>`).join('');
}
export function bindSettings(box, v, onChange) {
  box.addEventListener('input', (e) => {
    const k = e.target.dataset?.key, s = SETTINGS.find((x) => x.key === k);
    if (!s) return;
    const n = Number(e.target.value);
    if (e.target.value === '' || !(n >= s.min && n <= s.max)) return; // 入力の途中・範囲の外は、そのままにして反映しない
    v[k] = n;
    e.target.nextElementSibling.textContent = s.fmt(v[k]);
    saveSettings(v);
    onChange(v);
  });
}
