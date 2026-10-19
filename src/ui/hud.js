// 画面表示。色はパレットから CSS 変数に渡す。
import { P } from '../style/palette.js';
import { facetsUrl } from './facets.js';
import { settingsHtml, bindSettings } from './settings.js';

export function applyUiColors() {
  const s = document.documentElement.style;
  for (const [k, v] of Object.entries(P.ui)) s.setProperty(`--ui-${k}`, v);
  // 石の板の面の模様（パネルとマス）
  s.setProperty('--ui-facets', facetsUrl(P.ui.panel));
  s.setProperty('--ui-facets-slot', facetsUrl(P.ui.slot, { size: 120, n: 2, seed: 5 }));
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  const e = t.content.firstChild;
  document.body.appendChild(e);
  return e;
}

// 見本ビューア用のボタン
export function createViewerHud({ onToggleWalk, onFocusCat, onMenu }) {
  const box = el(`
    <div class="panel viewer-hud">
      <div class="title">見た目の見本</div>
      <div class="sub">ドラッグで回す ・ ホイールで寄る</div>
      <div class="row">
        <button id="btnWalk" type="button">止まる</button>
        <button id="btnFocus" type="button">猫に寄る</button>
        <button id="btnMenu" type="button">メニュー</button>
      </div>
    </div>`);
  const walk = box.querySelector('#btnWalk');
  walk.addEventListener('click', () => { walk.textContent = onToggleWalk() ? '止まる' : '歩く'; });
  box.querySelector('#btnFocus').addEventListener('click', onFocusCat);
  box.querySelector('#btnMenu').addEventListener('click', onMenu);
  return box;
}

// 最初の画面（1人称の一時停止中も使う）
// 操作一覧（docs/rules/ui.md「操作」）
const KEYS = [
  ['W A S D', '移動'], ['スペース', 'ジャンプ'], ['マウス', '見回す'],
  ['左クリック', '叩く・攻撃・パーツの撤去'], ['右クリック', '使う・拾う・食べる・開ける'],
  ['Tab', '持ち物とクラフト'], ['1〜6・ホイール', '持ち替え'], ['Q', '手に持つ物を投げる'],
  ['ハンマー', '持った直後は撤去（左クリック） ・ 右クリック 建築メニュー → 選ぶと置く（左クリック・ホイール/R 回す・Q/E 高さ）'],
  ['Esc', '一時停止'], ['F1', '操作一覧'], ['O', '全画面'],
];
const keysHtml = () => `<div class="keys">${KEYS.map(([k, v]) => `<b>${k}</b><span>${v}</span>`).join('')}
  <span class="dev">開発用: G マス目 ・ H 当たり判定 ・ F 飛ぶ</span></div>`;

// タイトルと一時停止（docs/rules/ui.md「画面の整理」）
// dev: 開発用のボタン { onIsland, onSample, onViewer, onShowcase, onRange }（onShowcase・onRange は開発中だけ）。settings: 設定の値、onSettings(値): 変えたとき
export function createMenu({ onStart, onContinue, onResume, onTitle, dev, settings, onSettings }) {
  const box = el(`
    <div class="menu-back">
      <div class="panel menu">
        <div class="title">猫の島</div>
        <div class="titleBtns">
          <div class="row"><button id="btnStart" type="button">はじめから</button><button id="btnContinue" type="button">つづきから</button></div>
          <button class="btnSettings" type="button">設定</button>
          <details><summary>開発用</summary>
            <div class="row"><button id="btnIsland" type="button">墜落島（素材つき）</button><button id="btnSample" type="button">見本の景色</button></div>
            <div class="row"><button id="btnViewer" type="button">見本を見る</button><button id="btnShowcase" type="button" hidden>モデル確認島</button><button id="btnRange" type="button" hidden>射撃訓練島</button></div>
          </details>
        </div>
        <div class="pauseBtns">
          <button id="btnResume" type="button">続ける</button>
          <div class="row"><button id="btnKeys" type="button">操作一覧</button><button class="btnSettings" type="button">設定</button><button id="btnTitle" type="button">タイトルへ</button></div>
        </div>
        <div class="settingsBox" hidden>${settingsHtml(settings)}</div>
        <div class="sub" id="menuMsg"></div>
        <div class="keysBox" hidden>${keysHtml()}</div>
      </div>
    </div>`);
  const $ = (id) => box.querySelector(id);
  const on = (id, fn) => $(id).addEventListener('click', fn);
  on('#btnStart', onStart);
  on('#btnContinue', onContinue);
  on('#btnResume', onResume);
  on('#btnTitle', onTitle);
  on('#btnKeys', () => { $('.keysBox').hidden = !$('.keysBox').hidden; });
  box.querySelectorAll('.btnSettings').forEach((b) => b.addEventListener('click', () => { $('.settingsBox').hidden = !$('.settingsBox').hidden; }));
  bindSettings($('.settingsBox'), settings, onSettings);
  on('#btnIsland', dev.onIsland);
  on('#btnSample', dev.onSample);
  on('#btnViewer', dev.onViewer);
  if (dev.onShowcase) { $('#btnShowcase').hidden = false; on('#btnShowcase', dev.onShowcase); }
  if (dev.onRange) { $('#btnRange').hidden = false; on('#btnRange', dev.onRange); }
  return {
    el: box,
    set hidden(v) { box.hidden = v; },
    setPaused(v) {
      $('.titleBtns').hidden = v;
      $('.pauseBtns').hidden = !v;
      $('.keysBox').hidden = true;
      $('.settingsBox').hidden = true;
    },
    setCanContinue(v) { $('#btnContinue').disabled = !v; },
    setMessage(t) { $('#menuMsg').textContent = t; },
  };
}

// F1 の操作一覧（遊びは止めない）
export function createKeysPanel() {
  const box = el(`<div class="panel keys-panel" hidden><div class="title">操作一覧</div>${keysHtml()}</div>`);
  return {
    get open() { return !box.hidden; },
    setOpen(v) { box.hidden = !v; },
  };
}

// 右下の 1 か所（説明・知らせ・建築の表示をまとめる。ui.md「画面の整理 2」）
export const corner = () => document.querySelector('.corner') ?? el('<div class="corner"></div>');

// 1人称中の照準
export function createPlayHud() {
  return el('<div class="play-hud"><div class="crosshair"></div></div>');
}

// O キーで全画面表示を切り替える
export function bindFullscreenKey() {
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyO' || e.repeat) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  });
}

// ハンマーを持っている間の表示（右下。ui.md「建築の操作」）: 選んでいる物と素材（持っている数）、土台の高さ、置けない理由
// 撤去を選んでいるときは、いっしょに消える数と戻る素材。s: buildMode の status()
export function createBuildHud({ partName, costHtml, refundHtml }) {
  const box = el('<div class="panel build-hud" hidden></div>');
  corner().appendChild(box);
  let last = '';
  return {
    update(s) {
      let html = '';
      if (s?.remove) {
        html = '<div class="title">撤去</div>' + (!s.parts.length ? '<div class="sub">ホイール 持ち替え</div>'
          : s.breaks ? '<div class="why">いかだがバラバラになる</div>'
            : `<div class="sub">消える ${s.parts.length} 個</div><div class="cost">戻る ${refundHtml(s.parts)}</div>`);
      } else if (s) {
        html = `<div class="title">${partName(s.type)}</div><div class="cost">${costHtml(s.type)}</div>`
          + (s.level !== null ? `<div class="sub">高さ ${s.level} 段</div>` : '') + (s.why ? `<div class="why">${s.why}</div>` : '');
      }
      if (html === last) return;
      last = html;
      box.hidden = !html;
      box.innerHTML = html;
    },
  };
}
