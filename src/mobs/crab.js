// カニ型の掃除ロボ。小型（基準: ブンブン）。参考画像 docs/refs/enemies/crab.jpg。前は +z、原点は胴の中心（地面は y = -0.22）。
// 参考画像のとおり: 上から見て八角の、上がすぼまった甲羅。前に角を落とした黒い画面と赤い目、前の角に黄色い板。
// 前に大きなはさみ ×2（暗い腕、青い手、手首の黄色い帯、暗い指 ×2。内側の指が開く）、横に山なりの脚 ×4。
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { rng } from '../style/lowpoly.js';
import { robot as R, solid, limb, angryEyes } from './parts.js';

// はさみ: a = 腕（- で上へ）、c = 手（+ で下へ向く）、o = 指の開き。L は左（+x）、R は右（-x）
const POSES = {
  //       高さ, 横にゆれる, 脚を上げる, 歩き, 左の腕・手・指, 右の腕・手・指, 目の光, 点滅, ×目
  idle: { y: 0, sway: 0, lift: 0, gait: 0, aL: -0.2, cL: 0.9, oL: 0.25, aR: -0.2, cR: 0.9, oR: 0.25, glow: 0.5, blink: 0, dead: 0 },
  move: { y: 0, sway: 1, lift: 0, gait: 1, aL: -0.15, cL: 0.9, oL: 0.15, aR: -0.15, cR: 0.9, oR: 0.15, glow: 0.6, blink: 0, dead: 0 },
  windup: { y: -0.04, sway: 0, lift: 0.1, gait: 0, aL: -0.9, cL: 0.1, oL: 0.6, aR: -0.9, cR: 0.1, oR: 0.6, glow: 1, blink: 1, dead: 0 },
  attack: { y: 0, sway: 0, lift: 0, gait: 0, aL: -0.55, cL: -0.35, oL: 0.6, aR: -0.2, cR: 0.9, oR: 0.2, glow: 1, blink: 0, dead: 0 },
  down: { y: -0.12, sway: 0, lift: 0.45, gait: 0, aL: 0.25, cL: 0.5, oL: 0.4, aR: 0.25, cR: 0.5, oR: 0.4, glow: 0.3, blink: 0, dead: 1 },
};

// 脚の付け根（x, z）と、外への向き（y 軸の回転）。phase: 歩きの組
const LEGS = [
  { x: 0.19, z: 0.05, yaw: -0.35, phase: 0 },
  { x: 0.18, z: -0.1, yaw: 0.45, phase: Math.PI },
  { x: -0.19, z: 0.05, yaw: Math.PI + 0.35, phase: Math.PI },
  { x: -0.18, z: -0.1, yaw: Math.PI - 0.45, phase: 0 },
];

export function createCrab(seed = 9) {
  const r = rng(seed);
  const root = new THREE.Group();
  const hull = new THREE.Group();
  root.add(hull);

  // 甲羅（八角、上がすぼまる）、腹、前の黒い画面（甲羅の前の斜面にそろえる）、前の角の黄色い板
  const slope = 0.22;
  hull.add(solid([
    R.bevel(r, [0.44, 0.16, 0.36], P.robotShell, { taper: 0.8, rot: [Math.PI, 0, 0] }),
    R.block(r, [0.28, 0.05, 0.24], P.robotFrame, { at: [0, -0.095, 0] }),
    R.bevel(r, [0.24, 0.085, 0.02], P.robotScreen, { axis: 'z', rot: [-slope, 0, 0], at: [0, -0.005, 0.168] }),
    ...[1, -1].map((s) => R.block(r, [0.07, 0.035, 0.012], P.robotHazard, { rot: [-slope, s * 0.69, 0], at: [s * 0.147, -0.02, 0.122] })),
  ]));
  const eyes = angryEyes(r, { at: [0, -0.003, 0.18], gap: 0.1, len: 0.06 });
  eyes.group.rotation.x = -slope;
  hull.add(eyes.group);

  // はさみ ×2: 腕（肩で上下・外へ）→ 手（手首で上下）→ 内側の指（開く）
  const claws = [1, -1].map((side) => {
    const arm = limb([R.block(r, [0.045, 0.045, 0.15], P.robotFrame, { at: [0, 0, 0.075] })], [side * 0.13, -0.04, 0.12]);
    arm.rotation.y = side * 0.35;
    const hand = limb([
      R.bevel(r, [0.11, 0.085, 0.13], P.robotShell, { axis: 'z', taper: 0.85, at: [0, 0, 0.075] }),
      R.block(r, [0.118, 0.092, 0.03], P.robotHazard, { at: [0, 0, 0.02] }),
      R.tube(r, 0, 0.1, P.robotFrame, { rot: [Math.PI / 2, 0, 0], at: [side * 0.03, 0, 0.19], seg: 4 }, 0.022),
    ], [0, 0, 0.15]);
    const finger = limb([R.tube(r, 0, 0.1, P.robotFrame, { rot: [Math.PI / 2, 0, 0], at: [0, 0, 0.05], seg: 4 }, 0.022)], [-side * 0.03, 0, 0.14]);
    hand.add(finger);
    arm.add(hand);
    hull.add(arm);
    return { side, arm, hand, finger };
  });

  // 脚 ×4: 付け根から山なりに上がり、先がとがって地面に下りる（+x 向きに作って回す）
  const legs = LEGS.map((L) => {
    const leg = limb([R.strut(r, [[0, 0, 0], [0.14, 0.12, 0], [0.3, -0.2, 0]], [0.022, 0.03, 0], P.robotShell)], [L.x, -0.03, L.z]);
    leg.rotation.y = L.yaw;
    hull.add(leg);
    return { ...L, leg };
  });

  const cur = { ...POSES.idle };
  let target = POSES.idle;
  const k = (dt) => 1 - Math.exp(-dt * 8);
  let run = 0;

  return {
    root,
    poses: Object.keys(POSES),
    setPose(name) { target = POSES[name] ?? POSES.idle; },
    update(t, dt) {
      const f = k(dt);
      for (const key in cur) cur[key] += (target[key] - cur[key]) * f;
      run += dt * 10 * cur.gait;
      hull.position.set(Math.sin(run) * 0.015 * cur.sway, cur.y + Math.abs(Math.sin(run)) * 0.01 * cur.gait, 0);
      for (const L of legs) { // 歩き: 組ごとに上げて、前後に少し振る
        const ph = run + L.phase;
        L.leg.rotation.set(0, L.yaw + Math.cos(ph) * 0.15 * cur.gait, cur.lift + Math.max(0, Math.sin(ph)) * 0.35 * cur.gait, 'YXZ');
      }
      for (const C of claws) {
        const [a, c, o] = C.side > 0 ? [cur.aL, cur.cL, cur.oL] : [cur.aR, cur.cR, cur.oR];
        C.arm.rotation.x = a;
        C.hand.rotation.x = c;
        C.finger.rotation.y = -C.side * o;
      }
      eyes.update(t, cur);
    },
  };
}
