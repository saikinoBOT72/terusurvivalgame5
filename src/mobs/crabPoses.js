// カニのポーズ（enemies.md「カニ」）。ため（グッ）・放出（バッ）は createPoser でつなぐ。ためは攻撃ごとに形を変える
// 甲羅: y 高さ, pitch 前に傾く（- で後ろへ反る）, roll 横に傾く, turn 横を向く（ひねる）, side 体を横向きにする（1 で 90 度。横ばい突進）, flip 裏返る
// 脚: scurry 速く運ぶ（突進）, splay 踏ん張る（前後へ開く）, dig 後ろの脚で砂をかく, flail じたばた
// はさみ（L 左 +x・R 右 -x）: a 腕（- で上へ）, c 手（+ で下へ向く）, o 指の開き, s 外へ開く（- で内へ寄せる）, clack 指をカチカチ
// flap はさみをばたばた, scoop 砂をつまんで甲羅の下へ（掃除）, look 見回す, glow 目の光, blink 点滅, dead ×目
const BASE = { y: 0, pitch: 0, roll: 0, turn: 0, side: 0, flip: 0, scurry: 0, splay: 0, dig: 0, flail: 0,
  aL: -0.2, cL: 0.9, oL: 0.25, sL: 0, clackL: 0, aR: -0.2, cR: 0.9, oR: 0.25, sR: 0, clackR: 0,
  flap: 0, scoop: 0, look: 0, glow: 0.5, blink: 0, dead: 0 };
const pose = (o) => ({ ...BASE, ...o });
const both = (a, c, o, s) => ({ aL: a, cL: c, oL: o, sL: s, aR: a, cR: c, oR: o, sR: s });
const CHARGE = { glow: 1, blink: 1 };

export const POSES = {
  idle: pose({}),
  move: pose({ ...both(-0.15, 0.9, 0.15, 0), glow: 0.6 }),
  // はさみ打ち: 左のはさみを高く振り上げて指をカチカチ、甲羅を後ろへ反らす → 振り下ろして挟む
  windupPinch: pose({ y: -0.02, pitch: -0.28, aL: -1.55, cL: -0.5, oL: 0.75, sL: 0.05, clackL: 1, aR: -0.05, cR: 0.8, oR: 0.2, sR: 0.1, ...CHARGE }),
  pinch: pose({ y: -0.05, pitch: 0.2, aL: 0.3, cL: 0.45, oL: 0, sL: -0.15, aR: -0.1, cR: 0.8, oR: 0.2, glow: 1 }),
  // 両ばさみ: 両はさみを左右に大きく開いて低く構え、脚を踏ん張る → 左、右の順に挟む
  windupDouble: pose({ y: -0.07, pitch: 0.06, splay: 1, ...both(-0.05, 0.25, 0.85, 0.75), ...CHARGE }),
  pinchL: pose({ y: -0.05, pitch: 0.12, turn: -0.18, splay: 0.6, aL: 0.15, cL: 0.55, oL: 0, sL: -0.4, aR: -0.05, cR: 0.3, oR: 0.8, sR: 0.65, glow: 1 }),
  pinchR: pose({ y: -0.05, pitch: 0.12, turn: 0.18, splay: 0.6, aL: 0.05, cL: 0.6, oL: 0.1, sL: -0.1, aR: 0.15, cR: 0.55, oR: 0, sR: -0.4, glow: 1 }),
  // 横ばい突進: 体を横向きにして後ろの脚で砂を 2 回かく、はさみを前へそろえる → 横向きのまま突っ込む
  windupRush: pose({ side: 1, y: -0.05, dig: 1, ...both(-0.3, 0.4, 0.1, -0.3), ...CHARGE }),
  rush: pose({ side: 1, y: 0.01, pitch: 0.06, scurry: 1, ...both(-0.3, 0.4, 0.1, -0.3), glow: 1 }),
  stumble: pose({ side: 0.7, y: -0.06, pitch: 0.45, roll: 0.25, ...both(0.3, 0.2, 0.6, 0.55), glow: 0.4, blink: 0.4 }), // 外してつんのめる
  stagger: pose({ y: 0.02, pitch: -0.25, roll: -0.2, aL: -0.7, oL: 0.5, sL: 0.3, aR: -0.5, oR: 0.4, sR: 0.2, blink: 0.3 }), // のけぞり
  flip: pose({ flip: 1, y: -0.13, flail: 1, ...both(-0.4, 0.6, 0.6, 0.5), glow: 0.7, blink: 0.6 }), // 受け流しで裏返ってじたばた
  flee: pose({ ...both(-1.35, -0.3, 0.7, 0.3), flap: 1, glow: 0.8 }), // 海へ逃げる: はさみを上げてばたばた
  down: pose({ flip: 1, y: -0.13, ...both(0.3, 0.5, 0.4, 0.5), glow: 0.3, dead: 1 }), // ひっくり返る
  // 待機の動き（setPose('idle') のあいだ、ときどき入れかわる）
  idleLook: pose({ look: 1 }),
  idleClack: pose({ ...both(-0.55, 0.4, 0.3, 0.05), clackL: 1, clackR: 1 }),
  idleScoop: pose({ pitch: 0.08, scoop: 1, aL: -0.3 }),
};
export const HOW = { windupPinch: 'charge', windupDouble: 'charge', windupRush: 'charge', pinch: 'release', pinchL: 'release', pinchR: 'release', rush: 'release', stumble: 'release', stagger: 'release', flip: 'release' };
export const IDLE = ['idle', 'idleLook', 'idleClack', 'idleScoop'], IDLE_W = [3, 3, 2, 2];
export const WALK = ['move', 'flee', 'stagger', ...IDLE]; // 動いていれば脚を運び、進む向きに対して横を向くポーズ
