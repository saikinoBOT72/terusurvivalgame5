// 設定（docs/rules/ui.md「設定と舵の表示」「設定の窓」）: 値と保存だけ。窓は settingsWin.js
// マウスの感度（Valorant の数値）、視野の広さ（Valorant の横の視野角）、UI の大きさ、画質と個別の設定、フレームレート表示。ブラウザに保存する（セーブとは別）
// tab: 設定の窓のどのタブか（km キーマウ / touch タッチ / screen 画面 / sound 音）。num: 数字を直接入力する欄にする。toggle: 切り替え。choice: [[値, 名前]] から 1 つ選ぶ
import { toggleHtml, toggleGet, toggleSet } from './uiKit.js';

const KEY = 'oasobi5.settings';
export const SETTINGS = [
  { key: 'vsens', tab: 'km', name: 'マウスの感度', min: 0.05, max: 5, step: 0.01, def: 1.8, num: true, fmt: () => 'Valorant' },
  { key: 'touch', tab: 'touch', name: 'タッチ操作', choice: [['auto', '自動'], ['on', '使う'], ['off', '使わない']], def: 'auto' },
  { key: 'tsens', tab: 'touch', name: '視点の感度', min: 0.2, max: 3, step: 0.05, def: 1, fmt: (v) => `${v.toFixed(2)} 倍` },
  { key: 'hfov', tab: 'screen', name: '視野角（横）', min: 60, max: 140, step: 1, def: 103, num: true, fmt: () => '度' },
  { key: 'ui', tab: 'screen', name: 'UI の大きさ', min: 0.8, max: 1.5, step: 0.05, def: 1, fmt: (v) => `${v.toFixed(2)} 倍` },
  // 画質（ui.md「画質」）: 選ぶと下の個別の設定がまとめて変わる。個別を変えるとカスタム
  // info: 名前の横の ⓘ を押すと出る説明
  { key: 'fxq', tab: 'screen', name: 'グラフィック品質', choice: [['low', '低'], ['mid', '中'], ['high', '高'], ['custom', 'カスタム']], def: 'mid',
    info: '下の項目をまとめて切り替える。1 つでも個別に変えると「カスタム」になる。重いと感じたら「低」から試す。' },
  { key: 'post', tab: 'screen', name: 'ポストプロセス', choice: [['normal', 'ふつう'], ['light', '軽い']], def: 'normal',
    info: '描いたあとの画面の仕上げ方。軽い = 色の仕上げ・ふちのギザギザ消し（FXAA）・拡大を 1 回でまとめて描く。軽いときは、アンチエイリアスとシャープネスの欄は効かず、ブルームは小さく粗くなる。' },
  { key: 'aa', tab: 'screen', name: 'アンチエイリアス', choice: [['none', 'オフ'], ['smaa', 'SMAA'], ['msaa2', 'MSAA 2x'], ['msaa4', 'MSAA 4x']], def: 'smaa',
    info: '物のふちのギザギザをなめらかにする。SMAA は描いたあとに輪郭をぼかす方式で軽い（少しぼやける）。MSAA は描く段階で滑らかにする方式でくっきりするが、数字が大きいほど重い。' },
  { key: 'rscale', tab: 'screen', name: '解像度スケール', min: 0.25, max: 4, step: 0.05, def: 1.5, fmt: (v) => `${v.toFixed(2)} 倍`,
    info: '画面の画素数の何倍まで細かく描くか（上限）。下げると軽くなるが、絵がぼやける。端末の画素の倍率（高精細ディスプレイなら 2 など）より大きくしても効かない。' },
  { key: 'autoRes', tab: 'screen', name: '動的解像度', toggle: true, def: true,
    info: 'オンだと、画面のフレームレートの上限（60fps など）に間に合わないときだけ、自動で解像度を段階的に下げる（上限の 0.6 倍まで）。余裕ができれば戻る。オフなら、いつも上の解像度スケールで描く。' },
  { key: 'hdr', tab: 'screen', name: 'HDR 描画', toggle: true, def: true,
    info: '描く途中の画面を、明るさ 1 を超えられる 16bit にする。オフにすると 8bit で描いて、メモリと処理が軽くなる（目安: 1 フレームの 1 割ほど）。オフのとき、ブルームは働かず、光る物の色は少し白っぽくなる。' },
  { key: 'bloom', tab: 'screen', name: 'ブルーム', toggle: true, def: true,
    info: '火・ネオン・光る目など、光る物のまわりを光でにじませる。光る物が映っていないときは自動で休む。HDR 描画がオフのときは働かない。' },
  { key: 'bloomq', tab: 'screen', name: 'ブルームの品質', choice: [['low', '低'], ['high', '高']], def: 'high',
    info: 'にじみを作るときの縮小・拡大の段数（低 = 3 段、高 = 5 段）。低いと軽いが、にじみが小さく、ふちが少し粗くなる。' },
  { key: 'grade', tab: 'screen', name: 'カラーグレーディング', toggle: true, def: true,
    info: '時間帯・場所に合わせた画面の色合いと、周辺減光（四すみを暗く）、ディザ（色の縞を消す）。オフにすると、色が単調になり夜や洞窟の雰囲気が薄れるが、少し軽くなる。' },
  { key: 'sharpen', tab: 'screen', name: 'シャープネス', toggle: true, def: true,
    info: '解像度スケールを画面より小さくして描いたとき、拡大でぼやけた輪郭をはっきりさせる。画面と同じ細かさで描いているときは何もしない。' },
  { key: 'shadowq', tab: 'screen', name: '影の品質', choice: [['high', '高'], ['mid', '中'], ['low', '低'], ['off', 'オフ']], def: 'mid',
    info: '影の細かさと作り直す回数。高 = 細かい影を毎フレーム作る。中 = 同じ細かさで、0.2 秒ごとか動いたときだけ作り直す（動く物の影が少し遅れる）。低 = 粗い影で、地形（地面の段差）は影を落とさない。オフ = 影なし（いちばん軽い）。' },
  { key: 'particles', tab: 'screen', name: 'パーティクル', choice: [['many', '多い'], ['few', '少ない']], def: 'many',
    info: '火花・破片・土ぼこり・砂・煙など、演出の粒の数。少ない = 半分（出せる上限も半分）。戦いの多い場面が軽くなる。' },
  { key: 'fogq', tab: 'screen', name: '霧の品質', choice: [['high', '高'], ['mid', '中'], ['low', '低']], def: 'mid',
    info: '霧の計算の細かさ。高 = 画素ごとに計算（低い所の霧・太陽の方向の色・ゆらぎ）、中 = ゆらぎと太陽の方向の色は頂点ごと・濃さは画素ごと、低 = 頂点ごとの計算（大きな面で濃さの境目が少し見えることがある）。霧の濃さはどれも同じ。' },
  { key: 'volume', tab: 'sound', name: '音量', min: 0, max: 1, step: 0.05, def: 0.7, fmt: (v) => `${Math.round(v * 100)}%` }, // 全体（sound.md）
  { key: 'fps', tab: 'screen', name: 'フレームレート表示', toggle: true, def: false },
  ...(import.meta.env.DEV ? [{ key: 'creative', tab: 'screen', name: 'クリエイティブインベントリ（開発用）', toggle: true, def: true }] : []),
];
// 画質ごとの個別の設定（ui.md「画質」の表）
export const PRESETS = {
  low: { post: 'light', aa: 'none', rscale: 1, autoRes: true, hdr: false, bloom: false, bloomq: 'low', grade: true, sharpen: true, fogq: 'low', shadowq: 'low', particles: 'few' },
  mid: { post: 'normal', aa: 'smaa', rscale: 1.5, autoRes: true, hdr: true, bloom: true, bloomq: 'high', grade: true, sharpen: true, fogq: 'mid', shadowq: 'mid', particles: 'many' },
  high: { post: 'normal', aa: 'msaa4', rscale: 2, autoRes: false, hdr: true, bloom: true, bloomq: 'high', grade: true, sharpen: true, fogq: 'high', shadowq: 'high', particles: 'many' },
};
// 画質を選んだら個別の値を入れる。個別を変えたら、合う画質（なければカスタム）にする。ほかの欄が変わったら true
function syncPreset(v, key) {
  if (key === 'fxq') { if (!PRESETS[v.fxq]) return false; Object.assign(v, PRESETS[v.fxq]); return true; }
  if (!(key in PRESETS.mid)) return false;
  v.fxq = Object.keys(PRESETS).find((n) => Object.entries(PRESETS[n]).every(([k, x]) => v[k] === x)) ?? 'custom';
  return true;
}
// Valorant の感度: 1 カウントで 0.07 度 × 数値（ラジアンで返す）
export const sensRad = (vsens) => vsens * 0.07 * Math.PI / 180;
// 横の視野角（16:9 の画面での角度）→ 縦の視野角。画面の形が変わっても縦の角度は同じ
export const vfovOf = (hfov) => 2 * Math.atan(Math.tan(hfov * Math.PI / 360) * 9 / 16) * 180 / Math.PI;

export function loadSettings() {
  const v = Object.fromEntries(SETTINGS.map((s) => [s.key, s.def]));
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY)); } catch { /* 使えなければはじめの値 */ }
  if (saved) Object.assign(v, saved);
  else if (matchMedia('(pointer: coarse)').matches) v.fxq = 'low'; // はじめての起動で、タッチの端末なら画質「低」（ui.md「画質」。タッチ操作の「自動」と同じ見分け方）
  v.rscale = Number(v.rscale) || 1.5; // 前の版では文字で保存していた
  if (PRESETS[v.fxq]) Object.assign(v, PRESETS[v.fxq]); // 画質と個別の値をそろえる
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
  return SETTINGS.filter((s) => s.tab === tab).map((s) => {
    const name = `<span>${s.name}${s.info ? `<button type="button" class="info" data-info="${s.key}" aria-label="${s.name}の説明">ⓘ</button>` : ''}</span>`;
    const row = s.choice
      ? `<div class="field row2">${name}<div class="tabs choice">${s.choice.map(([c, n]) => `<button type="button" class="tab${v[s.key] === c ? ' on' : ''}" data-key="${s.key}" data-val="${c}">${n}</button>`).join('')}</div></div>`
      : s.toggle
      ? `<div class="field row2">${name}${toggleHtml(s.key, v[s.key])}</div>`
      : `<label class="field">${name}<input type="${s.num ? 'number' : 'range'}" data-key="${s.key}" min="${s.min}" max="${s.max}" step="${s.step}" value="${v[s.key]}"><b>${s.fmt(v[s.key])}</b></label>`;
    return s.info ? `${row}<div class="infoText" data-for="${s.key}" hidden>${s.info}</div>` : row;
  }).join('');
}
// onChange(値): 変えるたびに呼ぶ。refresh(): 画質でほかの欄が変わったとき、窓を描き直す
export function bindSettings(box, v, onChange, refresh) {
  box.addEventListener('input', (e) => {
    const k = e.target.dataset?.key, s = SETTINGS.find((x) => x.key === k);
    if (!s || s.toggle || s.choice) return;
    const n = Number(e.target.value);
    if (e.target.value === '' || !(n >= s.min && n <= s.max)) return; // 入力の途中・範囲の外は、そのままにして反映しない
    v[k] = n;
    e.target.nextElementSibling.textContent = s.fmt(v[k]);
    const fxq = v.fxq;
    syncPreset(v, k);
    saveSettings(v);
    onChange(v);
    if (v.fxq !== fxq) { // 画質の表示だけ直す（入力中の欄は描き直さない）
      box.querySelectorAll('button[data-key="fxq"]').forEach((x) => x.classList.toggle('on', x.dataset.val === v.fxq));
    }
  });
  box.addEventListener('click', (e) => {
    const i = e.target.closest('button.info');
    if (i) { e.preventDefault(); const t = box.querySelector(`.infoText[data-for="${i.dataset.info}"]`); if (t) t.hidden = !t.hidden; return; } // ⓘ: 説明を開け閉めする
    const c = e.target.closest('button[data-val]');
    if (c) {
      v[c.dataset.key] = c.dataset.val;
      c.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === c));
      const more = syncPreset(v, c.dataset.key);
      saveSettings(v);
      onChange(v);
      return more && refresh?.();
    }
    const b = e.target.closest('button.toggle');
    if (!b) return;
    const on = !toggleGet(b);
    toggleSet(b, on);
    v[b.dataset.key] = on;
    const more = syncPreset(v, b.dataset.key);
    saveSettings(v);
    onChange(v);
    if (more) refresh?.();
  });
}
