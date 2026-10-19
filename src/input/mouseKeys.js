// マウスの中・サイドボタン（docs/rules/ui.md「マウスのボタン」）: キーと同じ keydown / keyup にして流す。
// コードは Mouse1（中）・Mouse3（サイド 1）・Mouse4（サイド 2）。キー設定・押している状態・pressed() はキーと同じに使える
// サイドボタンのブラウザの戻る・進むは、ゲームの間ずっと止める
const CODES = { 1: 'Mouse1', 3: 'Mouse3', 4: 'Mouse4' };
const send = (type, code) => dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true }));
const isDown = {};

addEventListener('mousedown', (e) => {
  const code = CODES[e.button];
  if (!code) return;
  e.preventDefault(); // 中ボタンの自動スクロール、サイドボタンの戻る・進む
  send('keydown', code);
  isDown[code] = true;
}, true);
addEventListener('mouseup', (e) => {
  const code = CODES[e.button];
  if (!code) return;
  e.preventDefault();
  if (isDown[code]) send('keyup', code);
  isDown[code] = false;
}, true);
addEventListener('auxclick', (e) => { if (CODES[e.button]) e.preventDefault(); }, true);
// 止めきれないブラウザのために、戻っても同じページに留まる
history.pushState(null, '', location.href);
addEventListener('popstate', () => history.pushState(null, '', location.href));
