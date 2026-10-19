// タッチの画面（docs/rules/ui.md「タッチ操作」）: スティック、視点（ボタンのない所をなぞる）、動作のボタン、ホットバーのタップ
// 入力は input/touch.js に流す。並びは touchLayout.js
import { el } from './uiKit.js';
import { touch, setStick, addLook, pressKey, pressClick, STICK_MAX } from '../input/touch.js';
import { down } from '../input/keymap.js';
import { TOUCH_BTNS, loadLayout, btnHtml, applyBtn, scale, portrait, posKey, centerOf } from './touchLayout.js';
import './touch.css';

// mode(): 今の場面、uiOpen(): 持ち物・建築メニューを開いている、placing(): 建築で置く状態、select(i): ホットバーの持ち替え
export function createTouchHud({ dom, mode, uiOpen, placing, select }) {
  const box = el(`<div class="touch-hud" hidden>${TOUCH_BTNS.map(btnHtml).join('')}</div>`);
  const nodes = Object.fromEntries(TOUCH_BTNS.map((b) => [b.id, box.querySelector(`[data-id="${b.id}"]`)]));
  const def = (id) => TOUCH_BTNS.find((b) => b.id === id);
  let L = loadLayout();
  function layout() { L = loadLayout(); for (const b of TOUCH_BTNS) applyBtn(nodes[b.id], b, L); fitHotbar(); }
  // 手に持つ列（幅 HOTBAR_W px）: 横向きはスティックと「使う」の間に、縦向きは画面の幅に収まる大きさ（--tkb）
  const HOTBAR_W = 372;
  function fitHotbar() {
    let room = innerWidth - 16;
    if (!portrait()) {
      const edge = (id) => { const b = def(id), c = L.btn[id]; return [centerOf(c[posKey()])[0], b.d * c.s * scale() / 2]; };
      const [sx, sr] = edge('stick'), [ux, ur] = edge('use');
      room = 2 * Math.min(innerWidth / 2 - (sx + sr), ux - ur - innerWidth / 2) - 12;
    }
    document.documentElement.style.setProperty('--tkb', Math.max(0.5, Math.min(scale(), room / HOTBAR_W)).toFixed(3));
  }
  layout();
  addEventListener('resize', layout);

  // ボタン: 押している間（toggle は押すたびに切り替え）。攻撃・使うは押したまま指を動かすと視点も動く
  const pressing = new Map(); // pointerId → { b, x, y }
  function act(b, isDown) {
    if (b.click != null) pressClick(dom, b.click, isDown);
    else if (b.esc) { if (isDown) dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true })); }
    else if (b.toggle) { if (isDown) pressKey(b.key, !down(b.key)); }
    else pressKey(b.key, isDown);
  }
  box.addEventListener('pointerdown', (e) => {
    const n = e.target.closest('.tbtn');
    if (!n || n.dataset.id === 'stick') return;
    e.preventDefault();
    try { n.setPointerCapture(e.pointerId); } catch { /* 指がもう離れている */ }
    const b = def(n.dataset.id);
    pressing.set(e.pointerId, { b, x: e.clientX, y: e.clientY });
    n.classList.add('down');
    act(b, true);
  });
  function unpress(e) {
    const p = pressing.get(e.pointerId);
    if (!p) return;
    pressing.delete(e.pointerId);
    nodes[p.b.id].classList.remove('down');
    act(p.b, false);
  }
  box.addEventListener('pointerup', unpress);
  box.addEventListener('pointercancel', unpress);

  // スティックと視点: ゲームの画面（ボタンの下）を触った指。画面の左半分ならスティック（指を置いた所に出る）、右半分なら視点
  let stickId = null, lookId = null, lx = 0, ly = 0, sx = 0, sy = 0;
  const stickCenter = () => [sx, sy, nodes.stick.getBoundingClientRect().width / 2];
  dom.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || !touch.on || mode() !== 'fps') return;
    e.preventDefault(); // 指のあとのマウスのまねを出さない（クリックにしない）
    if (stickId == null && e.clientX < innerWidth / 2) {
      stickId = e.pointerId; sx = e.clientX; sy = e.clientY;
      Object.assign(nodes.stick.style, { left: `${sx}px`, top: `${sy}px` });
      nodes.stick.classList.add('held');
      moveStick(e);
    } else if (lookId == null) { lookId = e.pointerId; lx = e.clientX; ly = e.clientY; }
  });
  function moveStick(e) {
    const [cx, cy, r] = stickCenter(), dx = e.clientX - cx, dy = e.clientY - cy, d = Math.hypot(dx, dy);
    const mag = Math.min(STICK_MAX, d / r), k = d > 0 ? Math.min(d, r * STICK_MAX) / d : 0;
    nodes.stick.firstChild.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
    nodes.stick.classList.toggle('run', mag > 1.05);
    if (d < r * 0.12) setStick(0, 0, 0); else setStick(dx / d, -dy / d, mag);
  }
  addEventListener('pointermove', (e) => {
    if (e.pointerId === stickId) return moveStick(e);
    const p = pressing.get(e.pointerId);
    if (e.pointerId === lookId || (p && p.b.click != null)) {
      const o = p ?? { x: lx, y: ly };
      addLook(e.clientX - o.x, e.clientY - o.y);
      if (p) { p.x = e.clientX; p.y = e.clientY; } else { lx = e.clientX; ly = e.clientY; }
    }
  });
  function release(e) {
    if (e.pointerId === stickId) { // 離したら、いつもの場所に戻る
      stickId = null; setStick(0, 0, 0); nodes.stick.firstChild.style.transform = ''; nodes.stick.classList.remove('run', 'held');
      applyBtn(nodes.stick, def('stick'), L);
    }
    if (e.pointerId === lookId) lookId = null;
  }
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);

  // ホットバーをタップして持ち替え
  document.addEventListener('pointerdown', (e) => {
    const s = touch.on && mode() === 'fps' && !uiOpen() && e.target.closest('.hotbar .slot');
    if (s) { e.preventDefault(); select(Number(s.dataset.i)); }
  }, true);

  // 毎フレーム: 出すか、どのボタンを出すか
  let was = '';
  return {
    layout,
    update() {
      const show = touch.on && mode() === 'fps', ui = show && uiOpen(), pl = show && placing();
      const now = `${show}${ui}${pl}`;
      if (now !== was) {
        was = now;
        box.hidden = !show;
        box.classList.toggle('ui', ui);
        box.classList.toggle('placing', pl);
        nodes.inventory.firstChild.textContent = ui ? '閉じる' : def('inventory').name;
        if (!show || ui) { // 隠すときは押しているものを離す
          for (const [id] of pressing) unpress({ pointerId: id });
          release({ pointerId: stickId }); lookId = null;
        }
      }
      if (show) nodes.crouch.classList.toggle('on', down('crouch'));
    },
  };
}
