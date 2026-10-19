// スマホのブラウザの邪魔な動きを止める（docs/rules/ui.md「タッチ操作」）: 拡大（2 本指・ダブルタップ）、ページのスクロール・引っぱって更新、
// 長押しの選択・メニュー・虫めがね。中身がスクロールする窓（持ち物のレシピなど）だけは指でスクロールできる
const editable = (t) => t instanceof Element && t.closest('input, textarea, select, [contenteditable]');

// t から上へたどって、指でスクロールできる箱があるか（縦か横にはみ出していて overflow が auto・scroll）
function scrollable(t) {
  for (let e = t instanceof Element ? t : null; e && e !== document.body; e = e.parentElement) {
    const s = getComputedStyle(e);
    if (/(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight) return true;
    if (/(auto|scroll)/.test(s.overflowX) && e.scrollWidth > e.clientWidth) return true;
  }
  return false;
}

const stop = (e) => e.preventDefault();
const opt = { passive: false };
// iPhone の 2 本指の拡大（user-scalable=no は効かない）
for (const t of ['gesturestart', 'gesturechange', 'gestureend']) addEventListener(t, stop, opt);
// 2 本指は拡大、1 本指はスクロール箱の外ならページを動かさない
addEventListener('touchmove', (e) => { if (e.touches.length > 1 || !scrollable(e.target)) e.preventDefault(); }, opt);
addEventListener('dblclick', stop, opt);
// iPhone: ゲームの画面とボタンを触ったら、ブラウザの動き（虫めがね・ダブルタップの拡大・長押しのメニュー）を始めさせない。指の pointer の入力はそのまま届く
addEventListener('touchstart', (e) => { if (e.target instanceof Element && e.target.closest('canvas, .touch-hud, .touch-edit .tbtn')) e.preventDefault(); }, opt);
// ほかの所（メニューなど）でも、続けて 2 回タップしたときの拡大を止める
let lastEnd = 0;
addEventListener('touchend', (e) => {
  if (e.timeStamp - lastEnd < 350 && !editable(e.target)) e.preventDefault();
  lastEnd = e.timeStamp;
}, opt);
addEventListener('selectstart', (e) => { if (!editable(e.target)) e.preventDefault(); });
// 長押しのメニュー（Android）。マウスの右クリックは controls.js が決める
addEventListener('contextmenu', (e) => { if (e.pointerType !== 'mouse' && matchMedia('(pointer: coarse)').matches) e.preventDefault(); });
// どこかがずれてスクロールしても戻す
addEventListener('scroll', () => { if (scrollX || scrollY) scrollTo(0, 0); });

// 向きを変えた直後は大きさが古いことがあるので、少し待ってから大きさを合わせ直す（renderer.js・touchHud.js は resize で合わせる）
addEventListener('orientationchange', () => setTimeout(() => dispatchEvent(new Event('resize')), 300));
visualViewport?.addEventListener('resize', () => dispatchEvent(new Event('resize')));

// 全画面にできないブラウザ（iPhone の Safari）では全画面のボタンを出さない
if (!document.fullscreenEnabled) document.documentElement.classList.add('no-fs');
