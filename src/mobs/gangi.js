// ボス: 現場監督機ガンギ。大型の見本（docs/rules/enemies.md、参考画像 docs/refs/enemies/gangi.jpg）。前は +z、原点は足もとの地面。高さ約 2.6m。
// 参考画像のとおり: 上が広く下がすぼまる大きな胸、胸の上の黄色い線、肩に埋まった小さな頭（黒い画面に赤い目）、
// 暗いじゃばらの腹と青い帯、大きな肩当て、暗い二の腕と太い青い前腕（手首に黄色い帯）と暗いこぶし、
// 青い太もも・すね、暗いひざ当て、背中に黄色と黒のしまの箱。箱の後ろの面に光る冷却口（弱点。後ろから見えるように、参考画像の上向きから変えた）。
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { rng } from '../style/lowpoly.js';
import { robot as R, solid, limb, angryEyes, glowing } from './parts.js';

// 脚: a = 付け根（- で太ももが前）、b = ひざ（+ ですねが後ろ）。stride: 左右の脚を前後に開く（+ で左脚が後ろ）
// 腕: ax = 肩（- で前・上へ上げる）、az = 外へ開く、el = ひじ（- で前に曲がる）。swing: 左右の腕を前後に開く（+ で左腕が前）
const POSES = {
  //        腰の高さ, 前かがみ, 脚, ひざ, 脚を開く, 腕, 腕を開く, ひじ, 腕を振る, 歩き, 頭, 頭をかしげる, 目の光, 点滅, ×目, 冷却口
  idle: { y: 1.0, lean: 0.05, a: -0.05, b: 0.1, stride: 0, ax: -0.1, az: 0.12, el: -0.25, swing: 0, gait: 0, head: 0, cock: 0, glow: 0.5, blink: 0, dead: 0, vent: 0.4 },
  move: { y: 1.0, lean: 0.12, a: -0.05, b: 0.1, stride: 0, ax: -0.1, az: 0.12, el: -0.35, swing: 0, gait: 1, head: 0, cock: 0, glow: 0.6, blink: 0, dead: 0, vent: 0.5 },
  windup: { y: 1.0, lean: -0.15, a: -0.05, b: 0.15, stride: 0, ax: -2.9, az: 0.18, el: -0.6, swing: 0, gait: 0, head: -0.15, cock: 0, glow: 1, blink: 1, dead: 0, vent: 0.9 },
  attack: { y: 0.97, lean: 0.45, a: -0.3, b: 0.5, stride: 0, ax: -1.1, az: 0.08, el: -0.2, swing: 0, gait: 0, head: -0.2, cock: 0, glow: 1, blink: 0, dead: 0, vent: 0.6 },
  crouch: { y: 0.8, lean: 0.55, a: -0.8, b: 1.3, stride: 0, ax: 0.35, az: 0.25, el: -0.7, swing: 0, gait: 0, head: -0.4, cock: 0, glow: 1, blink: 1, dead: 0, vent: 1 },
  charge: { y: 0.82, lean: 0.45, a: -0.3, b: 0.5, stride: 0.6, ax: -0.3, az: 0.12, el: -1.1, swing: 0.8, gait: 0, head: -0.35, cock: 0, glow: 1, blink: 0, dead: 0, vent: 1 },
  down: { y: 0.62, lean: 0.5, a: 0.0, b: 1.57, stride: 0, ax: 0.15, az: 0.05, el: -0.1, swing: 0, gait: 0, head: 0.45, cock: 0.25, glow: 0.3, blink: 0, dead: 1, vent: 0 },
};

const THIGH = 0.45, SHIN = 0.48;

export function createGangi(seed = 7) {
  const r = rng(seed);
  const root = new THREE.Group();
  // 腰（hips）: 骨盤と脚。その上の上半身（waist）が前かがみになる
  const hips = new THREE.Group();
  root.add(hips);
  hips.add(solid([
    R.bevel(r, [0.6, 0.3, 0.42], P.robotShell, { taper: 0.75, at: [0, 0.05, 0] }),
    R.block(r, [0.62, 0.08, 0.44], P.robotShell, { at: [0, 0.23, 0] }),
  ]));
  const waist = new THREE.Group();
  waist.position.y = 0.27;
  hips.add(waist);

  // 上半身: じゃばらの腹、胸、胸の上の黄色い線、肩当て、背中の箱（横に黄色と黒のしま）
  const body = [
    R.block(r, [0.5, 0.36, 0.34], P.robotScreen, { at: [0, 0.17, 0] }),
    ...[0.06, 0.17, 0.28].map((y) => R.block(r, [0.54, 0.05, 0.38], P.robotFrame, { at: [0, y, 0] })),
    R.bevel(r, [1.05, 0.72, 0.62], P.robotShell, { taper: 0.7, at: [0, 0.7, 0] }),
    R.bevel(r, [0.72, 0.42, 0.12], P.robotShell, { taper: 0.75, at: [0, 0.84, 0.31] }), // 胸の前のふくらみ
    ...[1, -1].map((s) => R.block(r, [0.28, 0.05, 0.05], P.robotHazard, { at: [s * 0.2, 1.0, 0.37], rot: [0, 0, s * 0.35] })), // 頭の下の V の線
    ...[1, -1].map((s) => R.bevel(r, [0.48, 0.44, 0.52], P.robotShell, { axis: 'z', at: [s * 0.7, 1.0, 0] })),
    R.block(r, [0.6, 0.55, 0.28], P.robotShell, { at: [0, 0.78, -0.42] }),
    R.block(r, [0.42, 0.3, 0.03], P.robotFrame, { at: [0, 0.9, -0.57] }), // 冷却口のふち（背中の箱の後ろの面）
  ];
  for (const s of [1, -1]) {
    body.push(R.block(r, [0.02, 0.42, 0.22], P.robotHazard, { at: [s * 0.305, 0.78, -0.42] }));
    for (const y of [0.66, 0.84]) body.push(R.block(r, [0.025, 0.06, 0.28], P.robotScreen, { at: [s * 0.31, y, -0.42], rot: [0.75, 0, 0] }));
  }
  // 冷却口の格子（光る面の上の暗い板 ×4）
  for (const x of [-0.12, -0.04, 0.04, 0.12]) body.push(R.block(r, [0.025, 0.24, 0.03], P.robotFrame, { at: [x, 0.9, -0.6] }));
  waist.add(solid(body));
  const vent = glowing([R.block(r, [0.34, 0.22, 0.02], P.robotVent, { at: [0, 0.9, -0.59] })], P.robotVent);
  waist.add(vent.mesh);

  // 頭: 肩のあいだに埋まる小さな角を落とした箱。前に黒い画面と赤い目
  const head = new THREE.Group();
  head.position.set(0, 1.02, 0.08);
  head.add(solid([
    R.bevel(r, [0.34, 0.32, 0.34], P.robotShell, { taper: 0.9, at: [0, 0.14, 0] }),
    // 参考画像のとおり画面はなく、目ごとに細い黒いくぼみ（目と同じ怒った角度）
    ...[1, -1].map((s) => R.block(r, [0.135, 0.075, 0.02], P.robotScreen, { rot: [0, 0, s * 0.4], at: [s * 0.068, 0.185, 0.172] })),
  ]));
  const eyes = angryEyes(r, { at: [0, 0.185, 0.184], gap: 0.136, len: 0.07 });
  head.add(eyes.group);
  waist.add(head);

  // 腕: 肩（暗い二の腕）→ ひじ（暗い球、太い青い前腕、手首の黄色い帯、暗いこぶし）
  const arms = [1, -1].map((side) => {
    const shoulder = limb([R.tube(r, 0.1, 0.42, P.robotFrame, { at: [0, -0.21, 0], seg: 6 })], [side * 0.68, 0.9, 0]);
    const elbow = limb([
      R.ball(r, 0.12, P.robotFrame),
      R.bevel(r, [0.3, 0.5, 0.32], P.robotShell, { taper: 1.15, at: [0, -0.3, 0] }),
      R.block(r, [0.35, 0.07, 0.37], P.robotHazard, { at: [0, -0.5, 0] }),
      R.bevel(r, [0.24, 0.22, 0.26], P.robotFrame, { at: [0, -0.65, 0.01] }),
    ], [0, -0.42, 0]);
    shoulder.add(elbow);
    waist.add(shoulder);
    return { side, shoulder, elbow };
  });

  // 脚: 付け根（暗い球、青い太もも）→ ひざ（暗いひざ当て、青いすね、足）
  const legs = [1, -1].map((side) => {
    const hip = limb([
      R.ball(r, 0.12, P.robotFrame),
      R.bevel(r, [0.26, 0.42, 0.3], P.robotShell, { taper: 0.85, at: [0, -0.24, 0] }),
    ], [side * 0.2, -0.02, 0]);
    const knee = limb([
      R.block(r, [0.2, 0.16, 0.1], P.robotFrame, { at: [0, 0, 0.12] }),
      R.bevel(r, [0.28, 0.42, 0.3], P.robotShell, { taper: 1.1, at: [0, -0.22, 0] }),
      R.block(r, [0.3, 0.12, 0.44], P.robotFrame, { at: [0, -SHIN + 0.0, 0.06] }),
    ], [0, -THIGH, 0]);
    hip.add(knee);
    hips.add(hip);
    return { side, hip, knee };
  });

  const cur = { ...POSES.idle };
  let target = POSES.idle;
  const k = (dt) => 1 - Math.exp(-dt * 6);
  let run = 0; // 歩きの進み

  let rage = false;
  return {
    root,
    poses: Object.keys(POSES),
    setPose(name) { target = POSES[name] ?? POSES.idle; },
    setRage(on) { rage = on; },
    update(t, dt) {
      const f = k(dt);
      for (const key in cur) cur[key] += (target[key] - cur[key]) * f;
      run += dt * 4 * cur.gait; // 重いのでゆっくり
      const walk = Math.sin(run) * 0.35 * cur.gait;
      hips.position.y = cur.y - Math.abs(Math.sin(run)) * 0.03 * cur.gait;
      waist.rotation.x = cur.lean;
      head.rotation.set(cur.head, 0, cur.cock);
      for (const L of legs) {
        L.hip.rotation.x = cur.a + L.side * (cur.stride + walk);
        L.knee.rotation.x = cur.b + Math.max(0, -Math.cos(run) * L.side) * 0.5 * cur.gait;
      }
      for (const A of arms) {
        A.shoulder.rotation.set(cur.ax - A.side * (cur.swing + walk * 0.6), 0, A.side * cur.az);
        A.elbow.rotation.x = cur.el;
      }
      eyes.update(t, cur);
      vent.mat.emissiveIntensity = cur.vent * (0.85 + 0.15 * Math.sin(t * 3)) * (rage ? 2.2 : 1); // 怒ると強く光る（enemies.md「HP が減ったとき」）
    },
  };
}
