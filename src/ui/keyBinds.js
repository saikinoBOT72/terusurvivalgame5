// 操作一覧とキー設定のタブ（docs/rules/ui.md「キー設定」）。動作とキーは input/keymap.js の表から作る
import { ACTIONS, FIXED, DEV_KEYS, codeOf, codeName, rebind, resetKeys } from '../input/keymap.js';
import { keyCap } from './uiKit.js';

const nameOf = (id) => ACTIONS.find((a) => a.id === id).name;

// 操作一覧（F1・一時停止）: 今のキー → 動作
export function keysHtml() {
  const rows = ACTIONS.map((a) => `${keyCap(codeName(codeOf(a.id)))}<span>${a.name}</span>`)
    .concat(FIXED.map(([k, v]) => `${keyCap(k, 'dim')}<span>${v}</span>`)).join('');
  return `<div class="keys">${rows}<span class="dev">${DEV_KEYS}</span></div>`;
}

// キー設定のタブ。札を押す → 「キーを押す」→ 押したキーに変える（Esc でやめる）
export function createKeyBinds() {
  const box = document.createElement('div');
  box.className = 'keyBinds';
  let waiting = null, msg = '';
  function render() {
    const rows = ACTIONS.map((a) => `<span>${a.name}</span>${waiting === a.id
      ? '<button type="button" class="keycap wait" data-act="' + a.id + '">キーかマウスのボタン（Esc でやめる）</button>'
      : `<button type="button" class="keycap" data-act="${a.id}">${codeName(codeOf(a.id))}</button>`}`).join('');
    const fixed = FIXED.map(([k, v]) => `<span>${v}</span>${keyCap(k, 'dim')}`).join('');
    box.innerHTML = `<div class="keys edit">${rows}<span class="sub fixed-title">変えられない物</span>${fixed}</div>`
      + `<div class="sub keyMsg">${msg}</div>`;
  }
  function onKey(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat) return;
    if (e.code !== 'Escape') {
      const r = rebind(waiting, e.code);
      msg = r.ok ? (r.swapped ? `「${nameOf(r.swapped)}」と入れ替えました` : '') : r.why;
    } else msg = '';
    stop();
  }
  function stop() {
    waiting = null;
    removeEventListener('keydown', onKey, true);
    render();
  }
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    if (waiting) removeEventListener('keydown', onKey, true);
    waiting = b.dataset.act;
    msg = '';
    addEventListener('keydown', onKey, true);
    render();
  });
  render();
  return {
    el: box,
    get waiting() { return !!waiting; },
    cancel() { if (waiting) { msg = ''; stop(); } },
    refresh: render,
    reset() { if (waiting) stop(); resetKeys(); msg = ''; render(); },
  };
}
