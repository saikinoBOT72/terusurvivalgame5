// 監視カメラ（動かない敵。中型の質。docs/rules/enemies.md「監視カメラ」、形は objects.md）。前は +z
// 岩にボルト留めした八角の台と細い柱、黄色い帯。柱の横に斜めの太陽電池の板。てっぺんで首を振る台に、
// 日よけのフードつきの長い箱のカメラ。前は大きなレンズ（赤い光の輪、黒い画面に怒った目）。上に回る赤いランプとアンテナ
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { rng } from '../style/lowpoly.js';
import { robot as R, solid, limb, angryEyes, glowing } from './parts.js';

const POSES = {
  //          首の振り（自分で）, 首の上下, ランプの光, ランプの点滅, ランプの回る速さ, 目の光, 目の点滅, ×目
  idle: { scan: 1, nod: -0.15, lamp: 0.35, flash: 0, spin: 1.5, glow: 0.5, blink: 0, dead: 0 },
  windup: { scan: 0, nod: -0.2, lamp: 1, flash: 1, spin: 4, glow: 1, blink: 1, dead: 0 },   // 見つけかけ（？）: 首を止めて点滅
  attack: { scan: 0, nod: -0.2, lamp: 1.4, flash: 0, spin: 9, glow: 1, blink: 0, dead: 0 },  // 警報（！）: 赤く光り続ける
  down: { scan: 0, nod: -0.75, lamp: 0, flash: 0, spin: 0, glow: 0.2, blink: 0, dead: 1 },
};
const TOP = 1.62; // 首の高さ

export function createCamera(seed = 9) {
  const r = rng(seed);
  const root = new THREE.Group();
  root.add(solid([
    R.tube(r, 0.26, 0.16, P.robotFrame, { at: [0, 0.08, 0] }, 0.3), // 台
    ...[0, 1, 2, 3].map((k) => R.bolt(r, 0.04, P.robotMetal, { at: [Math.cos(k * 1.571 + 0.785) * 0.22, 0.17, Math.sin(k * 1.571 + 0.785) * 0.22] })),
    R.tube(r, 0.065, TOP - 0.1, P.robotFrame, { at: [0, 0.16 + (TOP - 0.1) / 2, 0] }, 0.075), // 柱
    R.tube(r, 0.085, 0.12, P.robotHazard, { at: [0, TOP - 0.35, 0] }),
    R.block(r, [0.05, 0.05, 0.3], P.robotFrame, { at: [0, 1.0, -0.17] }), // 太陽電池の腕と板
    R.block(r, [0.62, 0.05, 0.42], P.robotScreen, { rot: [0.7, 0, 0], at: [0, 1.08, -0.38] }),
    R.block(r, [0.66, 0.03, 0.05], P.robotFrame, { rot: [0.7, 0, 0], at: [0, 1.25, -0.53] }),
    R.block(r, [0.66, 0.03, 0.05], P.robotFrame, { rot: [0.7, 0, 0], at: [0, 0.92, -0.24] }),
  ]));

  const pan = new THREE.Group(); // 首を左右に振る
  pan.position.y = TOP;
  root.add(pan);
  pan.add(solid([R.bevel(r, [0.24, 0.12, 0.24], P.robotFrame, { at: [0, 0.06, 0] })]));
  const head = limb([
    R.bevel(r, [0.28, 0.26, 0.5], P.robotShell, { axis: 'z', taper: 0.85, at: [0, 0, 0.02] }), // 長い箱（後ろが細い）
    R.block(r, [0.34, 0.04, 0.34], P.robotShell, { rot: [-0.12, 0, 0], at: [0, 0.16, 0.18] }), // 日よけのフード
    R.duct(r, 0.13, 0.035, 0.06, P.robotFrame, { rot: [Math.PI / 2, 0, 0], at: [0, -0.01, 0.29] }), // レンズのふち
    R.tube(r, 0.1, 0.02, P.robotScreen, { rot: [Math.PI / 2, 0, 0], at: [0, -0.01, 0.3] }), // 黒い画面
    R.tube(r, 0.012, 0.42, P.robotFrame, { at: [-0.1, 0.36, -0.12] }), // アンテナ
    R.ball(r, 0.025, P.robotMetal, { at: [-0.1, 0.58, -0.12] }),
    R.block(r, [0.06, 0.08, 0.06], P.robotFrame, { at: [0.07, 0.17, -0.1] }), // ランプの台
  ], [0, 0.22, 0]);
  pan.add(head);
  const ring = glowing([R.duct(r, 0.118, 0.016, 0.03, P.robotEye, { rot: [Math.PI / 2, 0, 0], at: [0, -0.01, 0.32] })], P.robotEye); // 赤い光の輪
  head.add(ring.mesh);
  const lamp = glowing([R.tube(r, 0.06, 0.11, P.robotEye, { at: [0, 0, 0] }), R.block(r, [0.13, 0.03, 0.03], P.robotEye, { at: [0, 0, 0] })], P.robotEye);
  lamp.mesh.position.set(0.07, 0.27, -0.1);
  head.add(lamp.mesh);
  const eyes = angryEyes(r, { at: [0, 0, 0.315], gap: 0.075, len: 0.055 });
  head.add(eyes.group);

  const cur = { ...POSES.idle };
  let target = POSES.idle, aim = 0; // aim: 振りを止めたときの首の向き（brain が決める）
  const k = (dt) => 1 - Math.exp(-dt * 6);
  return {
    root,
    poses: Object.keys(POSES),
    setPose(name) { target = POSES[name] ?? POSES.idle; },
    look(yaw) { aim = yaw; }, // 首を向ける（体の向きからの角度）
    get yaw() { return pan.rotation.y; },
    update(t, dt) {
      const f = k(dt);
      for (const key in cur) cur[key] += (target[key] - cur[key]) * f;
      const sweep = Math.sin((t * Math.PI * 2) / 4) * (Math.PI / 2); // 4 秒で左右 90 度ずつ
      pan.rotation.y += (sweep * cur.scan + aim * (1 - cur.scan) - pan.rotation.y) * f;
      head.rotation.x = -cur.nod;
      lamp.mesh.rotation.y += cur.spin * dt;
      lamp.mat.emissiveIntensity = cur.lamp * (cur.flash > 0.5 && Math.sin(t * 25) < 0 ? 0.1 : 1);
      ring.mat.emissiveIntensity = 0.3 + cur.glow * 0.7 * (1 - cur.dead);
      eyes.update(t, cur);
    },
  };
}
