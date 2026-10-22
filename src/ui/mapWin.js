// マップの設定の窓（docs/rules/ui.md「マップの設定の窓」）: マップ作りの建築窓のボタンから開く。タブ「広さ」「空と色」
// 値は game/mapMaker.js（広さ）と game/mapEnv.js（空と色）が持つ。ここは見た目と入力だけ
import { el, winHead, tabsHtml, markTab } from './uiKit.js';
import { P } from '../style/palette.js';
import { RANGE } from '../game/mapEnv.js';

const M = P.mapEnv;
const hourText = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
// スライダーの行: [キー, 名前, 刻み, 表示の文]
const slider = (key, name, step, fmt) => ({ key, name, step, fmt });
const S = {
  hour: slider('hour', '時刻', 0.25, hourText),
  sunK: slider('sunK', '日の光の強さ', 0.05, (v) => v.toFixed(2)),
  az: slider('az', '日の向き（方角）', 5, (v) => `${Math.round(v)}°`),
  el: slider('el', '日の高さ', 1, (v) => `${Math.round(v)}°`),
  hemiK: slider('hemiK', '空の光の強さ', 0.05, (v) => v.toFixed(2)),
  fogK: slider('fogK', '霧の濃さ', 0.05, (v) => v.toFixed(2)),
  sat: slider('sat', '彩度', 0.02, (v) => v.toFixed(2)),
  con: slider('con', 'コントラスト', 0.02, (v) => v.toFixed(2)),
  lift: slider('lift', '暗い所の持ち上げ', 0.05, (v) => v.toFixed(2)),
  vig: slider('vig', '周辺減光', 0.01, (v) => v.toFixed(2)),
  exp: slider('exp', '露出', 0.02, (v) => v.toFixed(2)),
  bloom: slider('bloom', 'ブルーム', 0.05, (v) => v.toFixed(2)),
};
const sliderHtml = (s) => `<label class="field" data-row="${s.key}"><span>${s.name}</span><input type="range" data-s="${s.key}" min="${RANGE[s.key][0]}" max="${RANGE[s.key][1]}" step="${s.step}"><b></b></label>`;
// 色の見本の行: key は mapEnv の項目、list は [名前, 色]。「自動」で時刻まかせに戻す
const swatchRow = (key, name, list) => `<div class="field sws" data-row="${key}"><span>${name}</span><div class="swatches">
  <button type="button" class="btn-s sw-auto" data-c="${key}" data-v="">自動</button>
  ${list.map(([n, c]) => `<button type="button" class="sw" data-c="${key}" data-v="${c}" title="${n}" style="--sw: ${c}"></button>`).join('')}
  <input type="color" data-pick="${key}" title="好きな色"></div></div>`;
const skyRow = () => `<div class="field sws" data-row="sky"><span>空の色</span><div class="swatches chips">
  <button type="button" class="btn-s sw-auto" data-k="sky" data-v="">自動</button>
  ${M.sky.map(([n, a, b, c], i) => `<button type="button" class="btn-s skychip" data-k="sky" data-v="${i}" style="--a: ${a}; --b: ${b}; --c: ${c}">${n}</button>`).join('')}</div></div>`;
const head = (t) => `<div class="mapwin-sec">${t}</div>`;

const SKY_HTML = [
  head('時刻と日の光'), sliderHtml(S.hour),
  swatchRow('sunC', '日の光の色', M.sun), sliderHtml(S.sunK),
  '<div class="field sws" data-row="dirOn"><span>日の向き</span><div class="swatches"><button type="button" class="btn-s" data-dir="auto">時刻まかせ</button><button type="button" class="btn-s" data-dir="set">自分で決める</button></div></div>',
  sliderHtml(S.az), sliderHtml(S.el),
  head('空と霧'), skyRow(),
  '<div class="field sws" data-row="clouds"><span>雲</span><div class="swatches"><button type="button" class="btn-s" data-b="clouds" data-v="1">出す</button><button type="button" class="btn-s" data-b="clouds" data-v="0">出さない</button></div></div>',
  '<div class="field sws" data-row="stars"><span>星</span><div class="swatches"><button type="button" class="btn-s" data-b="stars" data-v="night">夜だけ</button><button type="button" class="btn-s" data-b="stars" data-v="on">いつも</button><button type="button" class="btn-s" data-b="stars" data-v="off">出さない</button></div></div>',
  swatchRow('hemiC', '空の光（上）の色', M.hemi), swatchRow('groundC', '照り返し（下）の色', M.ground),
  sliderHtml(S.hemiK), sliderHtml(S.fogK),
  head('画面の色（グレーディング）'), swatchRow('tint', '色味', M.tint),
  ...['sat', 'con', 'lift', 'vig', 'exp', 'bloom'].map((k) => sliderHtml(S[k])),
  '<button type="button" class="btn-s danger reset">空と色をはじめの値に戻す</button>',
].join('');

// api(): 今のマップ作りの窓口（world.mapApi。広さ・空と色）。onClose(): × を押した
export function createMapWin({ api, onClose }) {
  const box = el(`<div class="panel win map-win" hidden>${winHead('マップの設定', true)}${tabsHtml([['size', '広さ'], ['sky', '空と色']])}<div class="mapwin-body"></div></div>`);
  const body = box.querySelector('.mapwin-body');
  let tab = 'size';

  // 見た目を今の値に合わせる（スライダーを動かしている最中は触らない）
  function sync() {
    const a = api();
    if (!a) return;
    if (tab === 'size') {
      body.querySelectorAll('[data-size]').forEach((b) => b.classList.toggle('on', Number(b.dataset.size) === a.size));
      body.querySelector('.now').textContent = `今は ${a.size}m 四方（平らな地面。まわりは海）`;
      return;
    }
    const e = a.env.env;
    for (const [k, s] of Object.entries(S)) {
      const row = body.querySelector(`[data-row="${k}"]`), inp = row.querySelector('input');
      const v = k === 'az' ? e.az ?? 0 : e[k];
      if (document.activeElement !== inp) inp.value = v;
      row.querySelector('b').textContent = s.fmt(Number(v));
    }
    body.querySelectorAll('[data-c]').forEach((b) => b.classList.toggle('on', (e[b.dataset.c] ?? '') === b.dataset.v));
    body.querySelectorAll('[data-k="sky"]').forEach((b) => b.classList.toggle('on', String(e.sky ?? '') === b.dataset.v));
    body.querySelectorAll('[data-b]').forEach((b) => b.classList.toggle('on', String(b.dataset.b === 'clouds' ? (e.clouds ? 1 : 0) : e.stars) === b.dataset.v));
    body.querySelectorAll('[data-dir]').forEach((b) => b.classList.toggle('on', (e.az !== null) === (b.dataset.dir === 'set')));
    for (const k of ['az', 'el']) body.querySelector(`[data-row="${k}"]`).classList.toggle('off', e.az === null);
    body.querySelectorAll('[data-pick]').forEach((i) => { if (e[i.dataset.pick]) i.value = e[i.dataset.pick]; });
  }
  function render() {
    markTab(box, tab);
    if (tab === 'size') {
      body.innerHTML = `<div class="now"></div><div class="swatches chips">${api().sizes.map((n) => `<button type="button" class="btn-l" data-size="${n}">${n}m</button>`).join('')}</div>
        <span class="sub">広さを小さくすると、外に出るパーツは消える（消す前に確かめる）</span>`;
    } else body.innerHTML = SKY_HTML;
    sync();
  }
  box.addEventListener('click', (e) => {
    const t = e.target.closest('.tab[data-tab]');
    if (t) { tab = t.dataset.tab; render(); return; }
    if (e.target.closest('.win-x')) return onClose();
    const a = api();
    const sz = e.target.closest('[data-size]');
    if (sz && a) {
      const n = Number(sz.dataset.size), out = a.outside(n);
      if (out && !confirm(`${n}m にすると、外に出る ${out} 個のパーツが消えます。いいですか？`)) return;
      a.setSize(n);
      sync();
      return;
    }
    if (e.target.closest('.reset') && a) { a.env.reset(); sync(); return; }
    const c = e.target.closest('[data-c]');
    if (c && a) { a.env.set({ [c.dataset.c]: c.dataset.v || null }); sync(); return; }
    const k = e.target.closest('[data-k]');
    if (k && a) { a.env.set({ sky: k.dataset.v === '' ? null : Number(k.dataset.v) }); sync(); return; }
    const bt = e.target.closest('[data-b]');
    if (bt && a) { a.env.set({ [bt.dataset.b]: bt.dataset.b === 'clouds' ? bt.dataset.v === '1' : bt.dataset.v }); sync(); return; }
    const d = e.target.closest('[data-dir]');
    if (d && a) { a.env.set({ az: d.dataset.dir === 'set' ? 200 : null }); sync(); }
  });
  box.addEventListener('input', (e) => {
    const a = api();
    if (!a) return;
    const s = e.target.dataset.s, p = e.target.dataset.pick;
    if (s) a.env.set({ [s]: Number(e.target.value) });
    else if (p) a.env.set({ [p]: e.target.value });
    sync();
  });
  box.addEventListener('contextmenu', (e) => { e.preventDefault(); });
  return {
    box,
    get open() { return !box.hidden; },
    setOpen(v) { box.hidden = !v; if (v) render(); },
  };
}
