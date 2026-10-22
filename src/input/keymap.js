// キーの割り当て（docs/rules/ui.md「キー設定」）: 動作 → キー。ブラウザに保存する（セーブとは別）
// 新しい動作は ACTIONS に 1 行足せば、キー設定の画面と操作一覧に出る
// scene: 'always' いつも / 'build' 建築で置くとき。同じ場面の動作どうしは同じキーにできない（入れ替わる）。move: 動き（どの場面とも重ならない）
const KEY = 'oasobi5.keys';
export const ACTIONS = [
  { id: 'forward', name: '前', def: 'KeyW', scene: 'always', move: true },
  { id: 'back', name: '後ろ', def: 'KeyS', scene: 'always', move: true },
  { id: 'left', name: '左', def: 'KeyA', scene: 'always', move: true },
  { id: 'right', name: '右', def: 'KeyD', scene: 'always', move: true },
  { id: 'jump', name: 'ジャンプ・上へ泳ぐ', def: 'Space', scene: 'always', move: true },
  { id: 'run', name: '走る・速く泳ぐ', def: 'ShiftLeft', scene: 'always', move: true },
  { id: 'crouch', name: 'しゃがむ・下へ泳ぐ', def: 'KeyC', scene: 'always', move: true },
  { id: 'sneak', name: '忍び足（切り替え）', def: 'ControlLeft', scene: 'always' },
  { id: 'inventory', name: '持ち物', def: 'Tab', scene: 'always' },
  { id: 'throw', name: '投げる', def: 'KeyQ', scene: 'always' },
  { id: 'reload', name: '込め直し', def: 'KeyR', scene: 'always' },
  { id: 'inspect', name: '銃を眺める', def: 'KeyT', scene: 'always' },
  { id: 'dodge', name: 'ステップ', def: 'KeyX', scene: 'always' },
  { id: 'keys', name: '操作一覧', def: 'F1', scene: 'always' },
  { id: 'fullscreen', name: '全画面', def: 'KeyO', scene: 'always' },
  { id: 'buildTurn', name: '建築: 回す', def: 'KeyR', scene: 'build' },
  { id: 'buildUp', name: '建築: 高く', def: 'KeyE', scene: 'build' },
  { id: 'buildDown', name: '建築: 低く', def: 'KeyQ', scene: 'build' },
];
// 変えられない物（薄く並べるだけ）と、割り当てられないキー
export const FIXED = [
  ['左クリック', '叩く・攻撃・置く・撤去'], ['右クリック', '使う・拾う・開ける'],
  ['1〜6・ホイール', '持ち替え'], ['Esc', '一時停止'],
];
export const DEV_KEYS = '開発用: G マス目 ・ H 当たり判定 ・ F 飛ぶ';
const RESERVED = new Set(['Escape', 'KeyG', 'KeyH', 'KeyF', ...Array.from({ length: 6 }, (_, k) => `Digit${k + 1}`)]);

const find = (id) => ACTIONS.find((a) => a.id === id);
let over = {}; // 変えた物 { 動作: コード }
try { over = JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { /* 使えなければはじめのキー */ }
if (over.swimDown && !over.crouch) over.crouch = over.swimDown; // 前の「下へ泳ぐ」は「しゃがむ・下へ泳ぐ」に移す
over = Object.fromEntries(Object.entries(over).filter(([id, c]) => find(id) && typeof c === 'string')); // 消えた動作は捨てる
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(over)); } catch { /* 保存できなくても遊べる */ } };

export const codeOf = (id) => over[id] ?? find(id).def;
export const pressed = (e, id) => e.code === codeOf(id);
const conflicts = (a, b) => a.id !== b.id && (a.scene === b.scene || a.move || b.move);
for (const id of Object.keys(over)) { // 移したキーが別の動作と重なっていたら、はじめのキーに戻す
  if (ACTIONS.some((b) => conflicts(find(id), b) && codeOf(b.id) === over[id])) delete over[id];
}

// キーの名前（画面に出す）
const NAMES = { Space: 'スペース', ShiftLeft: '左 Shift', ShiftRight: '右 Shift', ControlLeft: '左 Ctrl', ControlRight: '右 Ctrl', AltLeft: '左 Alt', AltRight: '右 Alt',
  Tab: 'Tab', Enter: 'Enter', Backspace: 'Backspace', CapsLock: 'Caps', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Mouse1: '中ボタン', Mouse3: 'サイド 1', Mouse4: 'サイド 2', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/' };
export function codeName(code) {
  if (NAMES[code]) return NAMES[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad/.test(code)) return `テンキー${code.slice(6)}`;
  return code;
}
export const keyName = (id) => codeName(codeOf(id));

// キーを変える。同じ場面で同じキーの動作があれば入れ替える。返り値 { ok, swapped?: 動作, why? }
export function rebind(id, code) {
  const a = find(id);
  if (RESERVED.has(code)) return { ok: false, why: 'このキーは変えられません' };
  const old = codeOf(id);
  const other = ACTIONS.find((b) => conflicts(a, b) && codeOf(b.id) === code);
  if (other) set(other.id, old);
  set(id, code);
  save();
  return { ok: true, swapped: other?.id };
}
function set(id, code) { if (code === find(id).def) delete over[id]; else over[id] = code; }
export function resetKeys() { over = {}; save(); }

// 押しているキー（動き・乗り物の操作に使う）
const held = {};
addEventListener('keydown', (e) => { held[e.code] = true; });
addEventListener('keyup', (e) => { held[e.code] = false; });
addEventListener('blur', () => releaseAll());
const extra = {}; // キー以外で押している動作（タッチのスティック。input/touch.js）
export const setExtra = (id, v) => { extra[id] = v; };
export const down = (id) => !!held[codeOf(id)] || !!extra[id];
export const release = (id) => { held[codeOf(id)] = false; }; // 降りた Space で跳ばない、など
export function releaseAll() { for (const k in held) held[k] = false; }
