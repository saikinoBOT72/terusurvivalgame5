// タッチ操作の入力（docs/rules/ui.md「タッチ操作」）: 使うかどうか、スティック、視点、ボタン → 動作。画面は ui/touchHud.js
// ボタンはキーマウと同じ入り口に流す: キーの動作は今のキーの keydown / keyup、攻撃・使うは左・右クリックの mousedown / mouseup
import { codeOf, setExtra } from './keymap.js';

// on: 今タッチで遊んでいる（マウスの固定なしで遊ぶ）。mode: 設定の 'auto' | 'on' | 'off'。sens: 視点の感度の倍率
export const touch = { on: false, mode: 'auto', sens: 1 };
// スティック: x 右・y 前（向きの単位ベクトル）、mag 倒した量（ふち = 1、ふちの外まで引くと最大 STICK_MAX）
export const stick = { x: 0, y: 0, mag: 0 };
export const STICK_MAX = 1.35;
export const SNEAK_AT = 0.45, RUN_AT = 1.05; // これより少し = 忍び足、ふちの外 = 走る
const LOOK = 0.006; // 1 ピクセルなぞって回る角度（ラジアン。× 感度）

// マウスの固定中か、タッチで遊んでいるか（クリック・視点を受けるか）
export const playing = (dom) => document.pointerLockElement === dom || touch.on;

const watchers = [];
export const onTouchChange = (fn) => watchers.push(fn);
function setOn(v) {
  if (touch.on === v) return;
  touch.on = v;
  document.documentElement.classList.toggle('touch', v);
  if (!v) setStick(0, 0, 0);
  watchers.forEach((fn) => fn(v));
}
export function setTouchMode(mode, sens) {
  touch.mode = mode;
  touch.sens = sens;
  setOn(mode === 'on' || (mode === 'auto' && (touch.on || matchMedia('(pointer: coarse)').matches)));
}
// 自動: 指で触ったらタッチ、マウスを押したらキーマウ
addEventListener('pointerdown', (e) => {
  if (touch.mode !== 'auto') return;
  if (e.pointerType === 'touch') setOn(true);
  else if (e.pointerType === 'mouse') setOn(false);
}, true);

// スティック。乗り物（vehicles.js）は前後左右のキーとして見るので、半分より倒したら押していることにする
export function setStick(x, y, mag) {
  Object.assign(stick, { x, y, mag });
  const on = mag > 0.5;
  setExtra('forward', on && y > 0.4);
  setExtra('back', on && y < -0.4);
  setExtra('right', on && x > 0.4);
  setExtra('left', on && x < -0.4);
}
// 視点: なぞった分をためて、firstPerson.js が毎フレーム受け取る
let lookX = 0, lookY = 0;
export function addLook(dx, dy) { lookX += dx; lookY += dy; }
export function takeLook() {
  const r = [lookX * LOOK * touch.sens, lookY * LOOK * touch.sens];
  lookX = lookY = 0;
  return r;
}

// キーの動作を押す・離す
export function pressKey(id, isDown) {
  dispatchEvent(new KeyboardEvent(isDown ? 'keydown' : 'keyup', { code: codeOf(id), bubbles: true, cancelable: true }));
}
// 左（0）・右（2）クリックを押す・離す。押すのはゲームの画面に、離すのは window に（controls.js・buildMode.js が受ける）
export function pressClick(dom, button, isDown) {
  (isDown ? dom : window).dispatchEvent(new MouseEvent(isDown ? 'mousedown' : 'mouseup', { button, bubbles: true, cancelable: true }));
}
