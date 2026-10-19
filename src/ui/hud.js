// 画面表示。色はパレットから CSS 変数に渡す。
import { P } from '../style/palette.js';
import { facetsUrl } from './facets.js';
import { createSettingsWin } from './settingsWin.js';
import { keysHtml } from './keyBinds.js';
import { winHead, el } from './uiKit.js';
import { pressed } from '../input/keymap.js';

export function applyUiColors() {
  const s = document.documentElement.style;
  for (const [k, v] of Object.entries(P.ui)) s.setProperty(`--ui-${k}`, v);
  // 石の板の面の模様（パネルとマス）
  s.setProperty('--ui-facets', facetsUrl(P.ui.panel));
  s.setProperty('--ui-facets-slot', facetsUrl(P.ui.slot, { size: 120, n: 2, seed: 5 }));
}

// タイトルと一時停止（docs/rules/ui.md「画面の整理」「設定の窓」）
// dev: 開発用のボタン { onIsland, onShowcase, onRange }（onShowcase・onRange は開発中だけ）。settings: 設定の値、onSettings(値): 変えたとき
export function createMenu({ onStart, onContinue, onResume, onTitle, dev, settings, onSettings, onTouchEdit }) {
  const box = el(`
    <div class="menu-back">
      <div class="panel win menu">
        <div class="win-h1 main">猫の島</div>
        <div class="titleBtns main">
          <div class="row"><button class="btn-l" id="btnStart" type="button">はじめから</button><button class="btn-l" id="btnContinue" type="button">つづきから</button></div>
          <button class="btn-l btnSettings" type="button">設定</button>
          <details><summary>開発用</summary>
            <div class="row"><button id="btnIsland" type="button">墜落島（素材つき）</button></div>
            <div class="row"><button id="btnShowcase" type="button" hidden>モデル確認島</button><button id="btnRange" type="button" hidden>射撃訓練島</button></div>
          </details>
        </div>
        <div class="pauseBtns main">
          <button class="btn-l" id="btnResume" type="button">続ける</button>
          <div class="row"><button class="btn-l" id="btnKeys" type="button">操作一覧</button><button class="btn-l btnSettings" type="button">設定</button><button class="btn-l" id="btnTitle" type="button">タイトルへ</button></div>
        </div>
        <div class="sub main" id="menuMsg"></div>
        <div class="winBody keysBox" hidden></div>
      </div>
    </div>`);
  const $ = (id) => box.querySelector(id);
  const on = (id, fn) => $(id).addEventListener('click', fn);
  const settingsWin = createSettingsWin({ settings, onChange: onSettings, onClose: () => view('main'), onTouchEdit });
  $('.menu').appendChild(settingsWin.el);
  // 表示: main（ボタン）/ settings / keys。設定と操作一覧を開くと、メニューのボタンは隠れる
  let cur = 'main';
  function view(v) {
    cur = v;
    box.querySelectorAll('.main').forEach((n) => { n.hidden = v !== 'main'; });
    if (v === 'settings') settingsWin.open(); else settingsWin.close();
    $('.keysBox').hidden = v !== 'keys';
    if (v === 'keys') $('.keysBox').innerHTML = winHead('操作一覧', true) + keysHtml();
    if (v === 'main') box.querySelectorAll('.titleBtns, .pauseBtns').forEach((n) => { n.hidden = n.classList.contains('pauseBtns') ? !paused : paused; });
  }
  let paused = false;
  on('#btnStart', onStart);
  on('#btnContinue', onContinue);
  on('#btnResume', onResume);
  on('#btnTitle', onTitle);
  on('#btnKeys', () => view('keys'));
  $('.keysBox').addEventListener('click', (e) => { if (e.target.closest('.win-x')) view('main'); });
  box.querySelectorAll('.btnSettings').forEach((b) => b.addEventListener('click', () => view('settings')));
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && !box.hidden && cur !== 'main') view('main'); }); // Esc でメニューに戻る
  on('#btnIsland', dev.onIsland);

  if (dev.onShowcase) { $('#btnShowcase').hidden = false; on('#btnShowcase', dev.onShowcase); }
  if (dev.onRange) { $('#btnRange').hidden = false; on('#btnRange', dev.onRange); }
  return {
    el: box,
    set hidden(v) { box.hidden = v; },
    setPaused(v) { paused = v; view('main'); },
    setCanContinue(v) { $('#btnContinue').disabled = !v; },
    setMessage(t) { $('#menuMsg').textContent = t; },
  };
}

// F1 の操作一覧（遊びは止めない）。開くたびに今のキーで作り直す
export function createKeysPanel() {
  const box = el(`<div class="panel win keys-panel" hidden>${winHead('操作一覧')}<div class="keysBody"></div></div>`);
  return {
    get open() { return !box.hidden; },
    setOpen(v) { box.hidden = !v; if (v) box.querySelector('.keysBody').innerHTML = keysHtml(); },
  };
}

// 右下の 1 か所（説明・知らせ・建築の表示をまとめる。ui.md「画面の整理 2」）
export const corner = () => document.querySelector('.corner') ?? el('<div class="corner"></div>');

// 1人称中の照準
export function createPlayHud() {
  return el('<div class="play-hud"><div class="crosshair"></div></div>');
}

// 全画面の切り替え（キー設定の「全画面」）。全画面の間はキーボードをロックして、Ctrl+W なども効かなくする（Esc は一時停止。長押しで抜ける。controls.js）
export function bindFullscreenKey() {
  addEventListener('keydown', (e) => {
    if (!pressed(e, 'fullscreen') || e.repeat) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  });
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) navigator.keyboard?.lock?.().catch(() => {});
    else navigator.keyboard?.unlock?.();
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
