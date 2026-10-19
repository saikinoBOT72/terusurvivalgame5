// 採掘ロボのポーズ（enemies.md「採掘ロボ」）。ため（グッ）・放出（バッ）は createPoser でつなぐ。ためは技ごとに形を変える
// y 腰の高さ, pitch 体ごと前に倒れる, lean 上半身の前かがみ（- でのけぞる）, roll 横に傾く, tw 上半身を横へひねる（+ でツルハシの左へ）
// a 脚の付け根（- で太ももが前）, b ひざ（+ ですねが後ろ）, splay 脚を横へ開く, liftR 右足を高く上げる（四股）, gait 歩き
// axL・elL 左腕（ツルハシ）の肩・ひじ（- で前・上へ）, azL 左腕を横へ開く, axR・elR 右腕, az 両腕を開く, pk ツルハシの手首（+ で刃が前へ倒れる）
// ツルハシの柄の向き（下から前へ測った角）≒ 腕の角（-ax - el - lean）+ π - (1.3 + pk)
// hd 頭（+ で下）, cock 首をかしげる, glow 目の光, blink 点滅, dead ×目, rock 岩の殻
const BASE = { y: 0.62, pitch: 0, lean: 0.12, roll: 0, tw: 0, a: -0.1, b: 0.2, splay: 0.04, liftR: 0, gait: 0, axL: -0.45, elL: -0.7, azL: 0, axR: 0, elR: -0.25, az: 0.15, pk: 0, hd: 0, cock: 0, glow: 0.5, blink: 0, dead: 0, rock: 0 };
const pose = (o) => ({ ...BASE, ...o });
const FALL = { y: 0.22, pitch: 1.25, lean: 0.2, a: -0.5, b: 0.5, axL: -2.6, elL: -0.2, axR: -2.4, elR: -0.3, az: 0.4, hd: -0.3 }; // 前のめりに倒れる
const LOW = { a: -0.55, b: 0.95, splay: 0.14 }; // 腰を落とした構え

export const POSES = {
  idle: pose({}),
  move: pose({ lean: 0.24, a: -0.15, b: 0.3, elR: -0.45, hd: -0.08, glow: 0.6 }),
  // 振り下ろし: しゃがんでツルハシを背中まで振りかぶる → 跳ぶ（空中で頭の上へ）→ 着地で振り下ろし、ひざを深く沈める → 刺さって抜けない
  windupSmash: pose({ y: 0.48, lean: -0.55, ...LOW, a: -0.75, b: 1.2, axL: -2.9, elL: -1.2, axR: -2.7, elR: -1.1, az: 0.05, pk: 1.29, hd: -0.25, glow: 1, blink: 1 }),
  leapSmash: pose({ y: 0.68, lean: -0.25, a: -0.95, b: 1.7, splay: 0.1, axL: -3.0, elL: -0.6, axR: -2.85, elR: -0.6, az: 0.05, pk: 1.34, hd: -0.2, glow: 1 }),
  smash: pose({ y: 0.36, lean: 0.8, a: -1.0, b: 1.6, splay: 0.2, axL: -1.7, elL: -0.1, axR: -1.65, elR: -0.3, az: 0.05, pk: 2.34, hd: 0.2, glow: 1 }),
  stuck: pose({ y: 0.38, lean: 0.85, a: -1.0, b: 1.55, splay: 0.2, axL: -1.75, elL: -0.1, axR: -1.7, elR: -0.3, az: 0.05, pk: 2.4, hd: 0.3, cock: 0.15, glow: 0.4, blink: 0.3 }),
  // なぎ払い: 上半身をツルハシの左へ 80 度ひねって低く構える → 滑って突っ込み、反対へ振り抜いて回りすぎる
  windupSweep: pose({ y: 0.48, lean: 0.3, tw: 1.4, ...LOW, splay: 0.22, axL: -0.6, elL: -0.3, azL: 1.1, axR: -1.2, elR: -1.4, pk: 1.44, hd: 0.1, glow: 1, blink: 1 }),
  sweep: pose({ y: 0.5, lean: 0.35, tw: -1.6, ...LOW, splay: 0.22, axL: -1.5, elL: -0.05, azL: 0.5, axR: -0.1, elR: -0.4, az: 0.3, pk: 1.44, hd: 0.1, glow: 1 }),
  // 地割れ: 四股のように右足を高く上げ、右のこぶしを振り上げる → 足とこぶしで同時に地面を打つ
  windupQuake: pose({ y: 0.5, lean: 0.1, roll: 0.18, a: -0.6, b: 0.9, splay: 0.3, liftR: 1, axL: -0.5, elL: -0.9, axR: -3.0, elR: -0.3, az: 0.25, hd: -0.2, glow: 1, blink: 1 }),
  quake: pose({ y: 0.34, lean: 0.9, a: -1.05, b: 1.65, splay: 0.36, axL: -0.5, elL: -0.9, axR: -1.25, elR: 0, az: 0.15, hd: 0.15, glow: 1 }),
  stagger: pose({ y: 0.6, lean: -0.15, roll: 0.14, a: -0.05, b: 0.25, axL: -0.3, elL: -0.5, axR: 0.25, elR: -0.2, az: 0.35, cock: 0.25, blink: 0.3 }), // のけぞり（重いので小さく）
  roar: pose({ y: 0.6, lean: -0.4, ...LOW, a: -0.3, b: 0.5, axL: -1.5, elL: -0.7, azL: 0.6, axR: -1.5, elR: -0.7, az: 0.95, pk: 0.4, hd: -0.35, glow: 1 }), // 岩の殻から出て吠える: 両腕を広げて胸を張る
  disguise: pose({ y: 0.32, lean: 0.9, a: -1.4, b: 2.4, axL: -0.3, elL: -1.6, axR: -0.3, elR: -1.6, az: 0, glow: 0, rock: 1 }),
  down: pose({ ...FALL, glow: 0.3, dead: 1 }),
  fake: pose({ ...FALL, glow: 0 }), // 死んだふり（目は消えている）
  fakeWake: pose({ ...FALL, glow: 0.25 }), // 目がかすかに点く
  // 待機の動き（setPose('idle') のあいだ、ときどき入れかわる。肩で息をするのはいつも）
  idleTap: pose({ lean: 0.2, axL: -0.75, elL: -0.2, pk: 2.0, hd: 0.15 }), // ツルハシの頭で地面をコツコツ
  idleCarry: pose({ lean: 0.08, axL: -2.5, elL: -2.3, azL: 0.15, pk: -0.6, hd: -0.05 }), // ツルハシを肩にかつぐ
  idleBlade: pose({ lean: 0.2, axL: -1.3, elL: -1.7, azL: -0.25, pk: 2.64, hd: 0.25, cock: 0.3 }), // 刃を見る
};
export const HOW = { windupSmash: 'charge', windupSweep: 'charge', windupQuake: 'charge', leapSmash: 'release', smash: 'release', sweep: 'release', quake: 'release', stagger: 'release', roar: 'release' };
export const IDLE = ['idle', 'idleTap', 'idleCarry', 'idleBlade'], IDLE_W = [3, 2, 2, 1];
