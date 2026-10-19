// タッチのボタンの並び（docs/rules/ui.md「タッチ操作」）: キーマウの動作と同じ数（1 動作 1 ボタン）。画面は touchHud.js、配置の編集は touchEdit.js
// 位置・大きさ・不透明度はブラウザに保存する（oasobi5.touch2。セーブとは別）。横向きと縦向きで別々の並び
const KEY = 'oasobi5.touch2';
// d: 直径（px。倍率 1 のとき）。key: 押すキーの動作、click: 0 左・2 右クリック、esc: Esc（一時停止）、toggle: 押すたびに切り替え
// build: 置くときだけ出す、noBuild: 置くときは出さない（同じキーが建築の操作になるため）
// pos（横向き）・posP（縦向き）: [左右 'l'|'r', 上下 't'|'b', 横, 縦]。画面の端の切り欠きをよけた四角の角から中心まで（px。倍率 1 のとき）
// スティックの位置は、指を置いていないときに出る場所（指を置いた所に動く）
export const TOUCH_BTNS = [
  { id: 'stick', name: '移動', d: 150, pos: ['l', 'b', 104, 102], posP: ['l', 'b', 100, 190] },
  { id: 'attack', name: '攻撃', d: 80, click: 0, pos: ['r', 'b', 59, 88], posP: ['r', 'b', 60, 170] },
  { id: 'use', name: '使う', d: 64, click: 2, pos: ['r', 'b', 141, 44], posP: ['r', 'b', 150, 140] },
  { id: 'jump', name: 'ジャンプ', d: 64, key: 'jump', pos: ['r', 'b', 52, 180], posP: ['r', 'b', 55, 265] },
  { id: 'crouch', name: 'しゃがむ', d: 54, key: 'crouch', toggle: true, pos: ['r', 'b', 133, 136], posP: ['r', 'b', 145, 235] },
  { id: 'dodge', name: 'ステップ', d: 54, key: 'dodge', pos: ['r', 'b', 215, 116], posP: ['r', 'b', 55, 350] },
  { id: 'throw', name: '投げる', d: 48, key: 'throw', noBuild: true, pos: ['r', 'b', 207, 190], posP: ['r', 'b', 140, 320] },
  { id: 'reload', name: '込め直し', d: 48, key: 'reload', noBuild: true, pos: ['r', 'b', 126, 195], posP: ['r', 'b', 125, 395] },
  { id: 'inventory', name: '持ち物', d: 54, key: 'inventory', pos: ['r', 't', 110, 88], posP: ['r', 't', 100, 92] },
  { id: 'pause', name: 'メニュー', d: 50, esc: true, pos: ['r', 't', 37, 88], posP: ['r', 't', 35, 92] },
  { id: 'fullscreen', name: '全画面', d: 50, key: 'fullscreen', pos: ['r', 't', 180, 88], posP: ['r', 't', 35, 152] },
  { id: 'buildTurn', name: '回す', d: 54, key: 'buildTurn', build: true, pos: ['l', 'b', 222, 122], posP: ['l', 'b', 50, 300] },
  { id: 'buildUp', name: '高く', d: 54, key: 'buildUp', build: true, pos: ['l', 'b', 222, 252], posP: ['l', 'b', 50, 430] },
  { id: 'buildDown', name: '低く', d: 54, key: 'buildDown', build: true, pos: ['l', 'b', 222, 187], posP: ['l', 'b', 50, 365] },
];
export const SIZE = [0.5, 2], OPACITY = [0.1, 1];
// 全部の不透明度 all と、ボタンごとの { pos, posP, s 大きさの倍率, o 不透明度 }
const defaults = () => ({ all: 0.75, btn: Object.fromEntries(TOUCH_BTNS.map((b) => [b.id, { pos: [...b.pos], posP: [...b.posP], s: 1, o: 1 }])) });

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

// 画面の端の切り欠き・ホームバーをよけた四角（px）
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
// 縦向きか。今の向きの位置の名前（pos / posP）
export const portrait = () => innerHeight > innerWidth;
export const posKey = () => (portrait() ? 'posP' : 'pos');
// 倍率: 画面の短い辺に合わせる（横向き 340px・縦向き 380px で 1）。小さい画面でも大きい画面でも同じ割合に見える
export function scale() {
  const r = safeRect(), s = Math.min(r.w, r.h) / (portrait() ? 380 : 340);
  return Math.max(0.7, Math.min(1.6, s));
}

// 画面の上の中心（px）
export function centerOf(p) {
  const [ax, ay, x, y] = p, r = safeRect(), k = scale();
  return [ax === 'l' ? r.l + x * k : r.l + r.w - x * k, ay === 't' ? r.t + y * k : r.t + r.h - y * k];
}
// 中心（px）→ 近い角からの位置
export function posFrom(cx, cy) {
  const r = safeRect(), k = scale(), u = cx - r.l, v = cy - r.t;
  const ax = u < r.w / 2 ? 'l' : 'r', ay = v < r.h / 2 ? 't' : 'b';
  return [ax, ay, Math.round((ax === 'l' ? u : r.w - u) / k), Math.round((ay === 't' ? v : r.h - v) / k)];
}
// ボタンの HTML（遊びの画面と編集の画面で同じ形）
export const btnHtml = (b) => (b.id === 'stick'
  ? `<div class="tbtn tstick" data-id="stick"><i></i></div>`
  : `<div class="tbtn${b.build ? ' build' : ''}${b.noBuild ? ' nobuild' : ''}" data-id="${b.id}"><span>${b.name}</span></div>`);
// 置く・大きさ・不透明度を当てる。手に持つ列・ゲージ・時計も同じ倍率にする（--tk。縦向きのゲージと時計は少し小さく --tkh）
export function applyBtn(node, b, L) {
  const c = L.btn[b.id], [x, y] = centerOf(c[posKey()]), d = b.d * c.s * scale();
  const st = document.documentElement.style;
  st.setProperty('--tk', scale().toFixed(3));
  st.setProperty('--tkh', (scale() * (portrait() ? 0.85 : 1)).toFixed(3));
  Object.assign(node.style, { left: `${x}px`, top: `${y}px`, width: `${d}px`, height: `${d}px`, opacity: c.o * L.all, fontSize: `${Math.max(9, Math.min(18, d * 0.22, d * 0.74 / [...b.name].length))}px` });
}
