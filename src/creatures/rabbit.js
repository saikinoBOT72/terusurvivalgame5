// ウサギ。小型の生き物の見本（creatures.md「ウサギ」）。参考画像 docs/refs/creatures/rabbit.jpg。
// 前は +z、原点は足もとの地面。座った姿: お尻（ももの大きなふくらみ）が低く大きく、胸へ細く高く。
// 丸い頭と短い鼻づら、長く立った耳（内側がくぼむ）、大きな黒い目、白いふわふわのしっぽ。腹・胸・鼻づら・前足は明るい。
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { rng } from '../style/lowpoly.js';
import { flesh as F, solid, limb, roundEyes, byFace } from './flesh.js';
import { createPoser } from '../mobs/parts.js';

const PIVOT = 0.14; // 倒れるときの軸の高さ
const HAUNCH = [0, 0.02, -0.1]; // 胴を傾ける軸（もも）

//        頭うなずき, 胴の前傾, 跳ねる高さ, 跳ねる速さ, 耳を後ろへ, 耳を開く, 鼻をひくひく, 倒れる, 目を閉じる
const POSES = {
  idle: { head: 0, pitch: 0, hop: 0, rate: 1, ear: 0, splay: 0, sniff: 1, fall: 0, close: 0 },
  graze: { head: 0.55, pitch: 0.22, hop: 0, rate: 1, ear: 0.35, splay: 0.15, sniff: 0.3, fall: 0, close: 0 },
  move: { head: 0.1, pitch: 0.12, hop: 0.05, rate: 1, ear: 0.3, splay: 0.05, sniff: 0, fall: 0, close: 0 },
  flee: { head: 0.2, pitch: 0.25, hop: 0.12, rate: 2.2, ear: 1.0, splay: -0.05, sniff: 0, fall: 0, close: 0 },
  fall: { head: 0.1, pitch: 0, hop: 0, rate: 1, ear: 1.2, splay: 0.5, sniff: 0, fall: 1, close: 1 },
};

// 胴の輪切り（お尻 → 胸 → 首）。座っているので、後ろが低く大きく、前が高く細い
const BODY = [
  { z: -0.21, y: 0.13, w: 0.1, t: 0.05 },
  { z: -0.18, y: 0.135, w: 0.22, t: 0.11, b: 0.11 },
  { z: -0.11, y: 0.145, w: 0.29, t: 0.14, b: 0.135, sq: 2.2 }, // もも（一番太い）
  { z: -0.02, y: 0.16, w: 0.26, t: 0.145, b: 0.14, sq: 2.2 },
  { z: 0.06, y: 0.195, w: 0.2, t: 0.12, b: 0.13 }, // 胸
  { z: 0.11, y: 0.235, w: 0.15, t: 0.09, b: 0.1 }, // 首
];
// 頭の輪切り（首の付け根が原点）。丸い頭、ほおが張り、短い鼻づらが少し下がる
const HEAD = [
  { z: -0.05, y: 0.0, w: 0.12, t: 0.07, b: 0.06 },
  { z: 0.0, y: 0.01, w: 0.15, t: 0.085, b: 0.075 },
  { z: 0.05, y: 0.01, w: 0.16, t: 0.085, b: 0.08 }, // ほお（一番広い）
  { z: 0.1, y: -0.005, w: 0.13, t: 0.07, b: 0.07 },
  { z: 0.14, y: -0.02, w: 0.09, t: 0.05, b: 0.05 }, // 鼻づら
  { z: 0.162, y: -0.025, w: 0.055, t: 0.03, b: 0.032 },
];
const NECK = [0, 0.27, 0.11];
// 耳の輪切り（付け根 → 先）。長く、中ほどが広く、先は丸い
const EAR = [
  { z: 0, w: 0.045, t: 0.015 },
  { z: 0.05, w: 0.078, t: 0.014 },
  { z: 0.12, w: 0.086, t: 0.012 },
  { z: 0.17, w: 0.064, t: 0.01 },
  { z: 0.198, w: 0.016, t: 0.005 },
];
// 前足（胸の下から地面へ。z が下向き、y が前後、t が厚みの半分）
const FRONT = [
  { z: -0.03, w: 0.05, t: 0.03 },
  { z: 0.06, y: 0.005, w: 0.038, t: 0.024 },
  { z: 0.11, y: 0.01, w: 0.03, t: 0.02 },
  { z: 0.125, y: 0.02, w: 0.036, t: 0.03 }, // 手
];
// 後ろ足の足先（かかと → つま先、地面に平らに置く）
const FOOT = [
  { z: -0.09, y: 0.02, w: 0.045, t: 0.022 },
  { z: -0.02, y: 0.02, w: 0.058, t: 0.022 },
  { z: 0.06, y: 0.018, w: 0.05, t: 0.018 },
  { z: 0.1, y: 0.016, w: 0.035, t: 0.013 },
];

export function createRabbit(seed = 33) {
  const r = rng(seed);
  const C = P.rabbit;
  const root = new THREE.Group();
  const roll = new THREE.Group();
  roll.position.y = PIVOT;
  root.add(roll);
  const hull = new THREE.Group();
  hull.position.y = -PIVOT;
  roll.add(hull);

  // 胴: 腹と胸の下は明るい
  const belly = (f) => (f.ny < -0.3 || (f.nz > 0.5 && f.y < 0.22) ? C.light[f.ny < -0.6 ? 0 : 1] : byFace(C.fur)(f));
  const body = new THREE.Group(); // 前傾（草をはむ・跳ねる）は胴ごと、ももの所を軸に
  body.position.set(...HAUNCH);
  hull.add(body);
  const inBody = (g) => { g.position.x -= HAUNCH[0]; g.position.y -= HAUNCH[1]; g.position.z -= HAUNCH[2]; return g; };
  body.add(inBody(solid([F.loft(r, BODY, belly, { seg: 10, jit: 0.008 })])));

  // 頭: 鼻づらは明るく、鼻の先は鼻の色
  const face = (f) => (f.z > 0.16 && f.nz > 0.7 && f.y > -0.035 ? C.nose[f.ny > 0 ? 1 : 0] : f.z > 0.09 && f.ny < 0.35 ? C.light[f.ny < -0.4 ? 0 : 1] : byFace(C.fur)(f));
  const head = limb([F.loft(r, HEAD, face, { seg: 10, jit: 0.005, start: null })], NECK);
  body.add(inBody(head));
  const eyes = roundEyes(r, { at: [0, 0.03, 0.06], gap: 0.07, r: 0.022, out: 1.15 });
  head.add(eyes.group);
  const ears = [1, -1].map((s) => {
    const ear = limb([F.leaf(r, EAR, C.fur, C.earIn, { bend: 0.02, seg: 6, cup: 0.6 })], [s * 0.035, 0.07, -0.01]);
    head.add(ear);
    return { s, ear };
  });

  // 前足 ×2（明るい）、後ろ足の足先 ×2、しっぽ
  const fronts = [1, -1].map((s) => {
    const leg = limb([F.loft(r, FRONT, C.light, { seg: 6, start: null, rot: [Math.PI / 2, 0, 0] })], [s * 0.05, 0.125, 0.07]);
    body.add(inBody(leg));
    return leg;
  });
  const feet = [1, -1].map((s) => {
    const foot = limb([F.loft(r, FOOT, (f) => (f.ny < -0.5 ? C.light[0] : byFace(C.fur)(f)), { seg: 6, tip: 0.01, at: [0, -0.1, 0] })], [s * 0.095, 0.1, -0.08]);
    body.add(inBody(foot));
    return foot;
  });
  const tail = solid([F.blob(r, [0.11, 0.1, 0.085], C.tail, { seg: [6, 4], jit: 0.012, at: [0, 0.15, -0.22], pairs: false })]);
  body.add(inBody(tail));
  // もものふくらみ（胴の横の大きな楕円。少し明るい）
  body.add(inBody(solid([1, -1].map((s) => F.blob(r, [0.07, 0.17, 0.19], (f) => (f.ny < -0.5 ? C.light[0] : byFace([C.fur[0], C.fur[2], C.light[0]])(f)), { seg: [8, 5], jit: 0.006, at: [s * 0.112, 0.115, -0.1], rot: [0.35, 0, 0] })))));

  const poser = createPoser(POSES, {}, { settle: 0.3 });
  const cur = poser.cur;
  let run = 0;

  return {
    root,
    poses: Object.keys(POSES),
    setPose(name, secs) { poser.set(name, secs); },
    update(t, dt) {
      poser.step(dt);
      run += dt * 9 * cur.rate * (cur.hop > 0.001 ? 1 : 0);
      const ph = Math.sin(run), up = Math.max(0, ph);
      hull.position.y = -PIVOT + up * cur.hop;
      body.rotation.x = cur.pitch - ph * cur.hop * 2.5; // 跳ぶときは前が上がり、着くときは前へ倒れる
      roll.rotation.z = cur.fall * 1.45;
      head.rotation.x = cur.head - ph * cur.hop * 1.5 + Math.sin(t * 23) * 0.015 * cur.sniff;
      for (const E of ears) E.ear.rotation.set(-0.12 - cur.ear + Math.sin(t * 2.3 + E.s) * 0.04 * (1 - cur.fall), E.s * 0.7, -E.s * (0.12 + cur.splay));
      for (const L of fronts) L.rotation.x = -ph * cur.hop * 6 + cur.fall * -0.6; // 前足は前へ伸ばして着く
      for (const L of feet) L.rotation.x = Math.min(0, ph) * cur.hop * 7 + up * cur.hop * 4; // 後ろ足でけり出す
      for (const e of eyes.eyes) e.scale.y = 1 - cur.close * 0.85;
    },
  };
}
