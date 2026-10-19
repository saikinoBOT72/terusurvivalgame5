// 練習用の的（enemies.md「練習用の的」）。地面に立てた木の杭と横木に、壊れたロボの胴をくくりつけた物。攻撃しない。前は +z。
// 叩かれると杭ごと後ろへ揺れる（hit のポーズ）。HP 0 でも倒れず、目が × になって 3 秒で戻る（down）
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { rng } from '../style/lowpoly.js';
import { robot as R, solid, angryEyes } from './parts.js';

const POSES = {
  idle: { tilt: 0, glow: 0.25, blink: 0, dead: 0 },
  windup: { tilt: -0.22, glow: 0.6, blink: 1, dead: 0 }, // 叩かれた揺れ（のけぞりはためのポーズを使う）
  down: { tilt: -0.1, glow: 0.1, blink: 0, dead: 1 },
};

export function createDummy(seed = 13) {
  const r = rng(seed);
  const root = new THREE.Group();
  const post = new THREE.Group(); // 根元で揺れる
  root.add(post);
  post.add(solid([
    R.tube(r, 0.06, 1.5, P.wood, { at: [0, 0.75, 0], seg: 6 }, 0.07), // 杭
    R.block(r, [0.9, 0.08, 0.08], P.wood, { at: [0, 1.05, -0.02] }), // 横木
    R.block(r, [0.06, 0.12, 0.1], P.wood, { at: [-0.3, 1.05, 0.03] }), // ひもの巻き
    R.block(r, [0.06, 0.12, 0.1], P.wood, { at: [0.3, 1.05, 0.03] }),
  ]));
  post.add(solid([
    R.bevel(r, [0.5, 0.48, 0.34], P.robotShell, { at: [0, 1.05, 0.06], taper: 0.85 }), // 胴
    R.block(r, [0.22, 0.16, 0.02], P.robotRust, { at: [0.11, 0.92, 0.235] }), // さびた当て板
    R.block(r, [0.3, 0.2, 0.03], P.robotScreen, { at: [0, 1.4, 0.06] }), // 顔の画面
    R.block(r, [0.34, 0.03, 0.05], P.robotHazard, { at: [0, 1.51, 0.06] }), // 画面の上の黄色いふち
    R.tube(r, 0.09, 0.03, P.robotHazard, { rot: [Math.PI / 2, 0, 0], at: [-0.08, 1.08, 0.24] }), // 的の輪
    R.tube(r, 0.04, 0.035, P.robotEye, { rot: [Math.PI / 2, 0, 0], at: [-0.08, 1.08, 0.245] }),
  ]));
  const eyes = angryEyes(r, { at: [0, 1.4, 0.085], gap: 0.12, len: 0.07 });
  post.add(eyes.group);

  const cur = { ...POSES.idle };
  let target = POSES.idle;
  return {
    root,
    poses: Object.keys(POSES),
    setPose(name) { target = POSES[name] ?? POSES.idle; },
    update(t, dt) {
      const f = 1 - Math.exp(-dt * 10);
      for (const k in cur) cur[k] += (target[k] - cur[k]) * f;
      post.rotation.x = cur.tilt;
      eyes.update(t, cur);
    },
  };
}
