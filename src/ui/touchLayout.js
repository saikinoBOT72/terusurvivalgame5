// タッチのボタンの並び（docs/rules/ui.md「タッチ操作」）: キーマウの動作と同じ数（1 動作 1 ボタン）。画面は touchHud.js、配置の編集は touchEdit.js
// 位置・大きさ・不透明度はブラウザに保存する（oasobi5.touch。セーブとは別）
const KEY = 'oasobi5.touch';
// d: 直径（px）。key: 押すキーの動作、click: 0 左・2 右クリック、esc: Esc（一時停止）、toggle: 押すたびに切り替え
// build: 置くときだけ出す、noBuild: 置くときは出さない（同じキーが建築の操作になるため）
// pos: [左右 'l'|'r', 上下 't'|'b', 横, 縦]。その角から中心までを、画面の幅・高さに対する割合で
export const TOUCH_BTNS = [
  { id: 'stick', name: '移動', d: 150, pos: ['l', 'b', 0.14, 0.3] },
  { id: 'attack', name: '攻撃', d: 80, click: 0, pos: ['r', 'b', 0.08, 0.26] },
  { id: 'use', name: '使う', d: 64, click: 2, pos: ['r', 'b', 0.19, 0.13] },
  { id: 'jump', name: 'ジャンプ', d: 64, key: 'jump', pos: ['r', 'b', 0.07, 0.53] },
  { id: 'crouch', name: 'しゃがむ', d: 54, key: 'crouch', toggle: true, pos: ['r', 'b', 0.18, 0.4] },
  { id: 'dodge', name: 'ステップ', d: 54, key: 'dodge', pos: ['r', 'b', 0.29, 0.34] },
  { id: 'throw', name: '投げる', d: 48, key: 'throw', noBuild: true, pos: ['r', 'b', 0.28, 0.56] },
  { id: 'reload', name: '込め直し', d: 48, key: 'reload', noBuild: true, pos: ['r', 'b', 0.17, 0.62] },
  { id: 'inventory', name: '持ち物', d: 54, key: 'inventory', pos: ['r', 't', 0.16, 0.2] },
  { id: 'pause', name: 'メニュー', d: 50, esc: true, pos: ['r', 't', 0.05, 0.22] },
  { id: 'fullscreen', name: '全画面', d: 50, key: 'fullscreen', pos: ['r', 't', 0.25, 0.2] },
  { id: 'buildTurn', name: '回す', d: 54, key: 'buildTurn', build: true, pos: ['l', 'b', 0.3, 0.36] },
  { id: 'buildUp', name: '高く', d: 54, key: 'buildUp', build: true, pos: ['l', 'b', 0.3, 0.74] },
  { id: 'buildDown', name: '低く', d: 54, key: 'buildDown', build: true, pos: ['l', 'b', 0.3, 0.55] },
];
export const SIZE = [0.5, 2], OPACITY = [0.1, 1];
// 全部の不透明度 all と、ボタンごとの { pos, s 大きさの倍率, o 不透明度 }
const defaults = () => ({ all: 0.75, btn: Object.fromEntries(TOUCH_BTNS.map((b) => [b.id, { pos: [...b.pos], s: 1, o: 1 }])) });

export function loadLayout() {
  const L = defaults();
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (typeof v?.all === 'number') L.all = v.all;
    for (const id in L.btn) if (v?.btn?.[id]) Object.assign(L.btn[id], v.btn[id]);
  } catch { /* 使えなければはじめの並び */ }
  return L;
}
export function saveLayout(L) {
  try { localStorage.setItem(KEY, JSON.stringify(L)); } catch { /* 保存できなくても遊べる */ }
}
export const defaultLayout = defaults;

// 画面の端の切り欠き・ホームバーをよけた四角（px）。割合はこの四角に対して
let probe;
function safeRect() {
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:var(--safe-t) var(--safe-r) var(--safe-b) var(--safe-l)';
    document.body.appendChild(probe);
  }
  const s = getComputedStyle(probe), l = parseFloat(s.paddingLeft) || 0, t = parseFloat(s.paddingTop) || 0;
  return { l, t, w: innerWidth - l - (parseFloat(s.paddingRight) || 0), h: innerHeight - t - (parseFloat(s.paddingBottom) || 0) };
}
// 画面の上の中心（px）
export function centerOf(p) {
  const [ax, ay, x, y] = p, r = safeRect();
  return [r.l + (ax === 'l' ? x : 1 - x) * r.w, r.t + (ay === 't' ? y : 1 - y) * r.h];
}
// 中心（px）→ 近い角からの位置
export function posFrom(cx, cy) {
  const r = safeRect(), u = (cx - r.l) / r.w, v = (cy - r.t) / r.h;
  const ax = u < 0.5 ? 'l' : 'r', ay = v < 0.5 ? 't' : 'b';
  const x = ax === 'l' ? u : 1 - u, y = ay === 't' ? v : 1 - v;
  return [ax, ay, Math.max(0, Math.min(0.5, x)), Math.max(0, Math.min(0.5, y))];
}
// ボタンの HTML（遊びの画面と編集の画面で同じ形）
export const btnHtml = (b) => (b.id === 'stick'
  ? `<div class="tbtn tstick" data-id="stick"><i></i></div>`
  : `<div class="tbtn${b.build ? ' build' : ''}${b.noBuild ? ' nobuild' : ''}" data-id="${b.id}"><span>${b.name}</span></div>`);
// 置く・大きさ・不透明度を当てる
export function applyBtn(node, b, L) {
  const c = L.btn[b.id], [x, y] = centerOf(c.pos), d = b.d * c.s;
  Object.assign(node.style, { left: `${x}px`, top: `${y}px`, width: `${d}px`, height: `${d}px`, opacity: c.o * L.all, fontSize: `${Math.max(9, Math.min(16, d * 0.22, d * 0.74 / [...b.name].length))}px` });
}
