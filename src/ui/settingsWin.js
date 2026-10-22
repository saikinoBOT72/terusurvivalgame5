// 設定の窓（docs/rules/ui.md「設定の窓」）: メニューの板の中に開く。タブ「キーマウ」「タッチ」「画面」「音」、はじめの値に戻す、× か Esc でメニューに戻る
// キーマウ = マウスの感度＋キーとマウスボタンの割り当て。タッチ = タッチ操作の設定＋ボタンの配置を変える（混ぜない）
import { winHead, tabsHtml, markTab } from './uiKit.js';
import { settingsRows, bindSettings, resetTab } from './settings.js';
import { createKeyBinds } from './keyBinds.js';

const TABS = [['km', 'キーマウ'], ['touch', 'タッチ'], ['screen', '画面'], ['sound', '音']];

// settings: 設定の値、onChange(値): 変えたとき、onClose(): × を押したとき、onTouchEdit(): 配置を変える
export function createSettingsWin({ settings, onChange, onClose, onTouchEdit }) {
  const box = document.createElement('div');
  box.className = 'winBody settingsWin';
  box.hidden = true;
  box.innerHTML = `${winHead('設定', true)}${tabsHtml(TABS)}<div class="tabBody"></div>
    <div class="winFoot"><button type="button" class="btn-s danger reset">はじめの値に戻す</button></div>`;
  const body = box.querySelector('.tabBody');
  const keyBinds = createKeyBinds();
  let tab = 'km';
  function render() {
    keyBinds.cancel();
    markTab(box, tab);
    body.innerHTML = settingsRows(settings, tab);
    if (tab === 'km') { body.appendChild(keyBinds.el); keyBinds.refresh(); }
    if (tab === 'touch') body.insertAdjacentHTML('beforeend', '<button type="button" class="btn-s touchEdit">ボタンの配置を変える</button><span class="sub">配置・大きさ・不透明度は、配置の画面の「はじめに戻す」で戻す</span>');
  }
  bindSettings(body, settings, onChange, () => render());
  box.addEventListener('click', (e) => {
    const t = e.target.closest('.tab[data-tab]');
    if (t) { tab = t.dataset.tab; render(); return; }
    if (e.target.closest('.win-x')) return onClose();
    if (e.target.closest('.touchEdit')) return onTouchEdit?.();
    if (e.target.closest('.reset')) {
      if (tab === 'km') keyBinds.reset();
      resetTab(settings, tab);
      onChange(settings);
      render();
    }
  });
  return {
    el: box,
    get capturing() { return keyBinds.waiting; }, // キーを押して変えている最中（Esc はやめるだけ）
    open() { box.hidden = false; render(); },
    close() { keyBinds.cancel(); box.hidden = true; },
  };
}
