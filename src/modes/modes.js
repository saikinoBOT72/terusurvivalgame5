// モード（docs/rules/modes.md）: サバイバル・PvP・見るだけ。世界ごとにどれか 1 つ。main.js はモードに聞く
const no = () => false;
// 見るだけ（モデル確認島など、どのモードの物でもない世界）。ほかのモードは { ...VIEW, ... } で初めの値にする
export const VIEW = { id: 'view', pvp: false, owns: no, enter() {}, exit() {}, onPlay() {}, survival: no, fighting: no, statusHud: no, update() {}, saveNow() {} };

export function createModes(all) {
  let cur = VIEW;
  return {
    get cur() { return cur; },
    of: (w) => all.find((m) => m.owns(w)) ?? VIEW, // その世界のモード
    find: (id) => all.find((m) => m.id === id),
    // モードを替える: 前のモードの exit → 次の enter。同じなら何もしない
    use(m) {
      if (m === cur) return;
      cur.exit();
      cur = m;
      m.enter();
    },
  };
}
