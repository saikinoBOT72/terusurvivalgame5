// 鳥。小型の生き物（基準はウサギ。creatures.md「鳥」）。参考画像 docs/refs/creatures/bird.jpg。
// 前は +z、原点は足もとの地面。ずんぐりした卵形の胴、丸い頭と短いくちばし、だいだいの胸、
// たたんだ翼（飛ぶと広がり、後ろのふちがぎざぎざの羽先）、扇の尾羽、細い足。
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { rng } from '../style/lowpoly.js';
import { flesh as F, solid, limb, roundEyes, byFace } from './flesh.js';
import { createPoser } from '../mobs/parts.js';

const PIVOT = 0.06; // 倒れるときの軸の高さ

//        頭うなずき, つつく, 胴の前傾, 翼を広げる, 羽ばたき, 浮く, 足をたたむ, 歩き, 倒れる, 目を閉じる
const POSES = {
  idle: { head: 0, peck: 0, pitch: 0, wings: 0, flap: 0, lift: 0, tuck: 0, walk: 0, fall: 0, close: 0 },
  peck: { head: 0.3, peck: 1, pitch: 0.35, wings: 0, flap: 0, lift: 0, tuck: 0, walk: 0, fall: 0, close: 0 },
  move: { head: 0, peck: 0, pitch: 0.08, wings: 0, flap: 0, lift: 0, tuck: 0, walk: 1, fall: 0, close: 0 },
  fly: { head: -0.15, peck: 0, pitch: -0.1, wings: 1, flap: 1, lift: 0.25, tuck: 1, walk: 0, fall: 0, close: 0 },
  fall: { head: 0.2, peck: 0, pitch: 0, wings: 0.25, flap: 0, lift: 0, tuck: 0.6, walk: 0, fall: 1, close: 1 },
};

// 胴の輪切り（尾の付け根 → 胸 → 首）。胸が前へ張り出す
const BODY = [
  { z: -0.1, y: 0.115, w: 0.05, t: 0.025 },
  { z: -0.07, y: 0.11, w: 0.11, t: 0.055, b: 0.05 },
  { z: -0.02, y: 0.11, w: 0.15, t: 0.07, b: 0.068 },
  { z: 0.03, y: 0.12, w: 0.155, t: 0.074, b: 0.074 }, // 一番太い
  { z: 0.07, y: 0.135, w: 0.14, t: 0.07, b: 0.072 }, // 胸
  { z: 0.1, y: 0.155, w: 0.11, t: 0.056, b: 0.06 },
  { z: 0.12, y: 0.175, w: 0.08, t: 0.04, b: 0.04 }, // 首
];
// 頭の輪切り（首の付け根が原点）。丸い
const HEAD = [
  { z: -0.04, y: 0, w: 0.06, t: 0.035 },
  { z: -0.01, y: 0.01, w: 0.085, t: 0.046, b: 0.04 },
  { z: 0.025, y: 0.012, w: 0.09, t: 0.046, b: 0.04 },
  { z: 0.055, y: 0.008, w: 0.07, t: 0.036, b: 0.03 },
  { z: 0.072, y: 0.004, w: 0.04, t: 0.022, b: 0.02 },
];
const NECK = [0, 0.185, 0.1];
// 翼の輪切り（付け根 → 羽先。w が前後の幅、x が後ろへのずれ）。後ろのふちは長い・短いを交互にしてぎざぎざの羽先に
const WING = [
  { z: 0, x: 0, w: 0.115, t: 0.019 },
  { z: 0.057, x: 0.016, w: 0.149, t: 0.019 },
  { z: 0.103, x: 0.038, w: 0.169, t: 0.016 },
  { z: 0.138, x: 0.014, w: 0.115, t: 0.014 },
  { z: 0.172, x: 0.035, w: 0.135, t: 0.013 },
  { z: 0.207, x: 0.016, w: 0.084, t: 0.01 },
  { z: 0.236, x: 0.022, w: 0.041, t: 0.006 },
];
// 尾羽（付け根 → 先）。平たい扇
const TAIL = [
  { z: 0, w: 0.045, t: 0.012 },
  { z: 0.05, w: 0.07, t: 0.009 },
  { z: 0.1, w: 0.09, t: 0.006 },
  { z: 0.115, w: 0.07, t: 0.005 },
];

export function createBird(seed = 45) {
  const r = rng(seed);
  const C = P.bird;
  const root = new THREE.Group();
  const roll = new THREE.Group();
  roll.position.y = PIVOT;
  root.add(roll);
  const hull = new THREE.Group(); // 浮く・前傾は胴ごと（足もとが軸）
  roll.add(hull);
  const body = new THREE.Group();
  body.position.y = -PIVOT;
  hull.add(body);

  // 胴: のどから腹までだいだい、背は灰茶
  const chest = (f) => ((f.nz > 0.15 && f.ny < 0.45 && f.z > -0.03) || f.ny < -0.5 ? C.chest[f.ny < -0.4 ? 0 : f.ny > 0.1 ? 2 : 1] : byFace(C.feather)(f));
  body.add(solid([F.loft(r, BODY, chest, { seg: 10, jit: 0.005 })]));

  // 頭: くちばし、目
  const head = limb([
    F.loft(r, HEAD, C.feather, { seg: 10, jit: 0.003, start: null }),
    F.cone(r, 0.013, 0.036, C.beak, { seg: 5, rot: [Math.PI / 2 + 0.25, 0, 0], at: [0, -0.002, 0.088] }),
  ], NECK);
  body.add(head);
  const eyes = roundEyes(r, { at: [0, 0.02, 0.03], gap: 0.037, r: 0.013, out: 1.1 });
  head.add(eyes.group);

  // 翼 ×2: 左は鏡に映して作る。たたむと胴の横に沿って後ろへ、広げると横へ
  const wingGeo = F.loft(r, WING, (f) => byFace(C.wing)(f), { seg: 6, rot: [0, Math.PI / 2, 0], tip: 0.004 });
  const wings = [1, -1].map((s) => {
    const side = new THREE.Group();
    side.position.set(s * 0.055, 0.15, 0.045);
    side.scale.x = s; // 左は鏡
    const wing = limb([wingGeo.clone()]);
    side.add(wing);
    body.add(side);
    return wing;
  });

  // 尾羽、足 ×2（細い脚 ＋ 前へ 3 本・後ろへ 1 本の指）
  const tail = limb([F.loft(r, TAIL, C.wing, { seg: 6, rot: [0, Math.PI, 0] })], [0, 0.125, -0.085]);
  body.add(tail);
  const legs = [1, -1].map((s) => {
    const leg = limb([
      F.tube(r, 0.007, 0.006, 0.05, C.feet, { seg: 4, at: [0, -0.025, 0] }),
      ...[-0.45, 0, 0.45, Math.PI].map((a) => F.cone(r, 0.005, 0.03, C.feet, { seg: 3, rot: [Math.PI / 2 - 0.15, 0, 0], at: [0, 0, 0.015] }).rotateY(a).translate(0, -0.048, 0)), // 指は前へ寝かせてから向きを回す
    ], [s * 0.03, 0.052, 0.01]);
    body.add(leg);
    return leg;
  });

  const poser = createPoser(POSES, {}, { settle: 0.25 });
  const cur = poser.cur;
  let run = 0;

  return {
    root,
    poses: Object.keys(POSES),
    setPose(name, secs) { poser.set(name, secs); },
    update(t, dt) {
      poser.step(dt);
      run += dt * 10 * cur.walk;
      hull.position.y = cur.lift + Math.abs(Math.sin(run)) * 0.006 * cur.walk;
      hull.rotation.x = cur.pitch;
      roll.rotation.z = cur.fall * 1.4;
      const bob = Math.sin(run) * 0.25 * cur.walk; // 歩くと首を前後に振る
      head.rotation.x = cur.head + bob + Math.max(0, Math.sin(t * 7)) * 0.9 * cur.peck;
      head.position.z = NECK[2] + Math.sin(run) * 0.012 * cur.walk;
      const flap = Math.sin(t * 18) * 0.9 * cur.flap;
      for (const w of wings) { // たたむ: 羽を立てて後ろへ。広げる: 平らに横へ、羽ばたく
        w.rotation.set((-Math.PI / 2 + 0.4) * (1 - cur.wings), (Math.PI / 2 - 0.12) * (1 - cur.wings) + 0.2 * cur.wings, -0.1 * (1 - cur.wings) + flap + 0.15 * cur.wings, 'YZX');
        w.scale.z = 0.62 + 0.38 * cur.wings; // たたむと羽が重なって幅がせまい
      }
      tail.rotation.x = -0.25 - 0.15 * cur.wings + Math.sin(t * 3) * 0.03;
      legs.forEach((L, i) => { L.rotation.x = Math.sin(run + i * Math.PI) * 0.5 * cur.walk + cur.tuck * 1.2; });
      for (const e of eyes.eyes) e.scale.y = 1 - cur.close * 0.85;
    },
  };
}
