// イノシシ。中型の生き物の見本（creatures.md「イノシシの部品」）。参考画像 docs/refs/creatures/boar.jpg。
// 前は +z、原点は足もとの地面。胴と頭・脚はロフト（輪切りをつなぐ）でひと続きの面にする。
// 胴: お尻は丸く、肩のこぶが一番高く、腹は平ら。頭: 額から鼻先へまっすぐ下がるくさび、ほおが張る、暗い鼻の円盤、上へ曲がる象牙の牙。
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { rng } from '../style/lowpoly.js';
import { flesh as F, solid, limb, roundEyes, byFace } from './flesh.js';
import { createPoser } from '../mobs/parts.js';

const PIVOT = 0.27; // 倒れるときの軸の高さ（胴の横幅の半分くらい）

//        頭うなずき, 首振り, 歩き, 足の速さ, 前足かく, 後ろ足かく, 前後に引く, 胴の前傾, 耳, しっぽ, 倒れる, 目を閉じる, 鼻を上下
const POSES = {
  idle: { head: 0.05, turn: 0, gait: 0, rate: 1, pawF: 0, pawR: 0, lean: 0, pitch: 0, ear: 0, tail: 0.25, fall: 0, close: 0, dig: 0 },
  move: { head: 0.02, turn: 0, gait: 1, rate: 1, pawF: 0, pawR: 0, lean: 0, pitch: 0, ear: 0.1, tail: 0.15, fall: 0, close: 0, dig: 0 },
  dig: { head: 0.5, turn: 0, gait: 0, rate: 1, pawF: 0, pawR: 0, lean: 0.02, pitch: 0.05, ear: 0.2, tail: 0.3, fall: 0, close: 0, dig: 1 },
  threat: { head: 0.3, turn: 0, gait: 0, rate: 1, pawF: 1, pawR: 0, lean: -0.03, pitch: 0.04, ear: -0.45, tail: -0.3, fall: 0, close: 0, dig: 0 },
  windup: { head: 0.4, turn: 0, gait: 0, rate: 1, pawF: 0, pawR: 1, lean: -0.1, pitch: 0.08, ear: -0.6, tail: -0.5, fall: 0, close: 0, dig: 0 },
  charge: { head: 0.35, turn: 0, gait: 1, rate: 2.6, pawF: 0, pawR: 0, lean: 0.05, pitch: 0.06, ear: -0.7, tail: -0.6, fall: 0, close: 0, dig: 0 },
  fall: { head: 0.05, turn: 0, gait: 0, rate: 1, pawF: 0, pawR: 0, lean: 0, pitch: 0, ear: 0.3, tail: 0.4, fall: 1, close: 1, dig: 0 },
};

// 胴の輪切り（お尻 → 肩のこぶ → 首）。y は輪の中心、t / b は上 / 下。背の高さ = y + t、腹 = y - b
const BODY = [
  { z: -0.57, y: 0.5, w: 0.16, t: 0.08 },
  { z: -0.52, y: 0.5, w: 0.38, t: 0.15, b: 0.15, sq: 2.3 },
  { z: -0.41, y: 0.51, w: 0.52, t: 0.18, b: 0.18, sq: 2.3 }, // もも（腹は後ろ足へ上がる）
  { z: -0.22, y: 0.52, w: 0.55, t: 0.19, b: 0.21, sq: 2.3 },
  { z: 0.0, y: 0.52, w: 0.6, t: 0.24, b: 0.24, sq: 2.3 },
  { z: 0.17, y: 0.52, w: 0.62, t: 0.28, b: 0.24, sq: 2.3 }, // 肩のこぶ（一番高い。背はお尻へ下がる）
  { z: 0.31, y: 0.53, w: 0.54, t: 0.23, b: 0.22, sq: 2.3 }, // 首
  { z: 0.4, y: 0.53, w: 0.44, t: 0.19, b: 0.2 },
];
// 頭の輪切り（首の付け根が原点。後ろの輪は胴の中にかくれる）。額から鼻先へまっすぐ下がる
const HEAD = [
  { z: -0.1, y: 0.0, w: 0.4, t: 0.2, b: 0.2 },
  { z: 0.06, y: -0.01, w: 0.43, t: 0.19, b: 0.22, sq: 2.3 }, // ほおが張る
  { z: 0.19, y: -0.05, w: 0.35, t: 0.15, b: 0.18, sq: 2.3 },
  { z: 0.31, y: -0.1, w: 0.25, t: 0.11, b: 0.12 },
  { z: 0.42, y: -0.12, w: 0.19, t: 0.088, b: 0.088 }, // 鼻づら
  { z: 0.46, y: -0.12, w: 0.2, t: 0.094, b: 0.094 }, // 鼻の円盤のふち
];
const NECK = [0, 0.57, 0.36];
// 耳の輪切り（付け根 → 先。z が長さ、w が幅、t が厚みの半分）
const EAR = [
  { z: 0, w: 0.12, t: 0.035 },
  { z: 0.05, w: 0.145, t: 0.03 },
  { z: 0.11, w: 0.095, t: 0.022 },
  { z: 0.16, w: 0.038, t: 0.011 }, // 先は少しとがる
  { z: 0.19, w: 0.008, t: 0.004 },
];

// 脚の輪切り（付け根から下へ。ロフトの z が下向きの長さ、y が前後のずれ、t が前後の厚みの半分）。sock から黒、hoof から灰
const LEG_RINGS = (front) => {
  const th = front ? [0.18, 0.2] : [0.22, 0.3]; // 付け根の幅・厚み（後ろ足のももは厚い）
  return [
    { z: front ? -0.04 : -0.1, y: 0, w: th[0], t: th[1] / 2 },
    { z: 0.14, y: front ? 0.0 : -0.01, w: th[0] * 0.92, t: th[1] * 0.44 },
    { z: 0.27, y: front ? 0.01 : -0.035, w: 0.14, t: 0.08, c: 'sock' }, // ひざ・かかと（ここから下が黒い）
    { z: 0.39, y: 0, w: 0.115, t: 0.068 },
    { z: 0.46, y: 0.005, w: 0.12, t: 0.072, c: 'hoof' },
    { z: 0.52, y: 0.012, w: 0.13, t: 0.08 },
  ];
};
const LEGS = [
  { x: 0.15, z: 0.2, front: true, phase: 0 },
  { x: -0.15, z: 0.2, front: true, phase: Math.PI },
  { x: 0.16, z: -0.37, front: false, phase: Math.PI }, // ももが胴の横に少し出る
  { x: -0.16, z: -0.37, front: false, phase: 0 },
];
const HIP = 0.52;

export function createBoar(seed = 21) {
  const r = rng(seed);
  const B = P.boar;
  const root = new THREE.Group();
  const roll = new THREE.Group(); // 倒れるときの軸
  roll.position.y = PIVOT;
  root.add(roll);
  const hull = new THREE.Group();
  hull.position.y = -PIVOT;
  roll.add(hull);

  hull.add(solid([F.loft(r, BODY, B.fur, { seg: 14, jit: 0.025 })]));

  // 頭: ロフト ＋ 鼻の円盤（鼻の穴 2 つは一番暗い段）、牙 ×2、耳 ×2、目
  const nose = (f) => (Math.abs(f.x) > 0.018 && Math.abs(f.x) < 0.07 && f.y < -0.085 ? B.nose[0] : B.nose[1]);
  const head = limb([
    F.loft(r, HEAD, B.fur, { seg: 14, jit: 0.015, start: null, end: nose }),
    ...[1, -1].map((s) => F.cone(r, 0.026, 0.17, B.tusk, { seg: 5, rot: [0.5, 0, -s * 0.6], at: [s * 0.1, -0.15, 0.34],
      warp: (v) => { v.z += (v.y + 0.07) ** 2 * 1.4; } })),
  ], NECK);
  hull.add(head);
  // 耳: 葉の形のロフト（付け根から先へ）。前の面をくぼませて内側を暗く、先は少し後ろへ反る
  const ears = [1, -1].map((s) => {
    const ear = limb([F.leaf(r, EAR, B.fur, B.earIn, { bend: 0.035 })], [s * 0.13, 0.16, -0.02]);
    ear.rotation.set(-0.25, s * 0.45, -s * 0.85); // 後ろと外へ傾け、くぼみを斜め前へ向ける
    head.add(ear);
    return ear;
  });
  const eyes = roundEyes(r, { at: [0, 0.05, 0.16], gap: 0.165, r: 0.038, out: 0.75 });
  head.add(eyes.group);

  // 脚 ×4: 付け根は胴に溶けこむ太さ、ひざで細く、下半分は黒い「靴下」、先に灰色のひづめ
  const legCol = { sock: B.leg, hoof: B.hoof };
  const legs = LEGS.map((L) => {
    const rings = LEG_RINGS(L.front).map((q) => ({ ...q, c: legCol[q.c] }));
    for (let i = 1; i < rings.length; i++) rings[i].c ??= rings[i - 1].c; // 色は次の印まで続く
    const leg = limb([F.loft(r, rings, B.fur, { seg: 8, jit: 0.008, start: null, end: B.hoof[0], rot: [Math.PI / 2, 0, 0] })], [L.x, HIP, L.z]);
    hull.add(leg);
    return { ...L, leg };
  });

  // しっぽ: 細く垂れて、先に小さな房
  const tail = limb([
    F.tube(r, 0.02, 0.012, 0.2, B.fur, { seg: 4, at: [0, -0.1, 0] }),
    F.cone(r, 0.03, 0.07, B.fur, { seg: 4, rot: [Math.PI, 0, 0], at: [0, -0.22, 0] }),
  ], [0, 0.63, -0.57]);
  hull.add(tail);

  const poser = createPoser(POSES, { windup: 'charge', charge: 'release' }, { settle: 0.5 });
  const cur = poser.cur;
  let run = 0;

  return {
    root,
    poses: Object.keys(POSES),
    setPose(name, secs) { poser.set(name, secs); },
    update(t, dt) {
      const shake = poser.step(dt);
      run += dt * 7 * cur.rate * cur.gait;
      const bob = Math.abs(Math.sin(run)) * 0.025 * cur.gait;
      hull.position.set(Math.sin(t * 60) * 0.006 * shake, -PIVOT + bob, cur.lean);
      hull.rotation.x = cur.pitch;
      roll.rotation.z = cur.fall * 1.5;
      head.rotation.set(cur.head + Math.sin(t * 9) * 0.12 * cur.dig, cur.turn, 0);
      for (const L of legs) {
        const ph = run + L.phase;
        let a = Math.sin(ph) * 0.5 * cur.gait;
        if (L.front && L.x > 0) a += (Math.sin(t * 8) * 0.5 - 0.2) * cur.pawF; // 前足で地面をかく
        if (!L.front) a += (Math.sin(t * 10 + L.phase) * 0.4 + 0.3) * cur.pawR; // 後ろ足でかく
        L.leg.rotation.x = a + cur.fall * (L.front ? -0.3 : 0.3);
      }
      for (const e of ears) e.rotation.x = -0.3 + cur.ear + Math.max(0, Math.sin(t * 1.7) - 0.97) * 8 * (1 - cur.fall); // ときどき、ぴくっと
      tail.rotation.set(cur.tail, Math.sin(t * 5) * 0.4 * (1 - cur.fall), 0);
      for (const e of eyes.eyes) e.scale.y = 1 - cur.close * 0.85;
    },
  };
}
