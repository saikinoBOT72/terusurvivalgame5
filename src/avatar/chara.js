// 本番キャラ（docs/rules/avatar.md「本番キャラ」）。ロフトで作る。createChara → { root, update(dt, { moving, speed }) }
// 正面は +z。足の裏が y=0。胴・頭・手の輪切りは、まず z 向き（高さ）に並べてから立てる。
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { rng, shape, merge, makeMesh } from '../style/lowpoly.js';
import { flesh as F } from '../creatures/flesh.js';

const UP = [-Math.PI / 2, 0, 0]; // ロフトの z（並べる向き）を高さに、輪の「下」（b）を前にする

// 上下を丸めた輪の表。H 高さ、W 幅、D 奥行き、cb・ct 下と上の丸みの高さ（m）、p 丸みの角ばり（2 で楕円）、
// cap 丸みの中の輪の位置（0 が極、1 が丸みの終わり）、mid まっすぐな所の輪の高さ
function rounded({ H, W, D, cb, ct, cap, mid = [], sq = 2.4, p = 2.2 }) {
  const ring = (z, s) => ({ z, w: W * s, t: (D * s) / 2, b: (D * s) / 2, sq });
  const sc = (f) => (1 - (1 - f) ** p) ** (1 / p);
  return [
    ...cap.map((f) => ring(cb * f, sc(f))),
    ...mid.map((z) => ring(z, 1)),
    ...[...cap].reverse().map((f) => ring(H - ct * f, sc(f))),
  ];
}

// 胴: 縦長のカプセル。底は少しすぼむ
export const BODY_RINGS = rounded({ H: 0.92, W: 0.36, D: 0.32, cb: 0.16, ct: 0.14, cap: [0.3, 0.7, 1], mid: [0.4, 0.6], sq: 3, p: 2.6 });
// 頭: 横から見ても正面と同じ大きさのふっくらした丸い頭。あごは少し平ら
export const HEAD_RINGS = rounded({ H: 0.36, W: 0.44, D: 0.44, cb: 0.12, ct: 0.13, cap: [0.25, 0.6, 1], mid: [0.18], sq: 3.4, p: 3 });

// 手: 丸いかたまり（低い面の球。体の横の手と 1 人称の手で同じ形。原点が真ん中）
export const handGeo = (r) => shape(new THREE.IcosahedronGeometry(0.08, 0), P.catWhite[1], r, { jit: 0.008 });

// ゲームの体の大きさ（当たり判定）の元（player.md）。実際の大きさは × BODY（firstPerson.js）。目はモデルの目の高さ、頭は頭のてっぺん、半径は体の幅の半分に少し足した値
export const CHARA_SIZE = { eye: 1.0, head: 1.2, radius: 0.25 };

const HEAD_Y = 0.83; // 頭の下の面の高さ（胴の肩に少し重なる）
const HANDS = [{ x: -0.29, y: 0.48 }, { x: 0.29, y: 0.54 }]; // 絵（chara.jpg）の寸法から: 手は体の幅の約 0.8 倍外、高さは胴の 52%・59%

// 足（2026-10-23 決定「E5」）: 脚なし。体の底に平べったい足がくっつく。[長さ, 幅, 高さ]、左右の間隔の半分、体の持ち上げ
const FOOT = [0.36, 0.2, 0.08], FOOT_X = 0.1, LIFT = 0.03;

export function createChara({ seed = 7 } = {}) {
  const r = rng(seed);
  const root = new THREE.Group();
  const upper = new THREE.Group(); // 胴・頭・手（足の分だけ持ち上げる）
  root.add(upper);
  const O = P.catWhite;
  const loft = (rings, pal, seg, o = {}) => F.loft(r, rings, pal, { seg, jit: 0.006, rot: UP, ...o });

  const body = makeMesh(loft(BODY_RINGS, O, 12, { start: O[0], end: O[1] }));
  upper.add(body);

  const headGeo = loft(HEAD_RINGS, O, 12, { start: O[0], end: O[2] }).translate(0, HEAD_Y, 0);
  const head = makeMesh(headGeo);
  upper.add(head);

  // 目: 縦の細い線。頭の表面を調べて、ぴったり付ける
  const ray = new THREE.Raycaster();
  head.updateMatrixWorld(true);
  const eyes = [-1, 1].map((s) => {
    ray.set(new THREE.Vector3(0.049 * s, HEAD_Y + 0.17, 2), new THREE.Vector3(0, 0, -1));
    const hit = ray.intersectObject(head)[0];
    const n = hit.face.normal.clone().transformDirection(head.matrixWorld);
    const g = new THREE.BoxGeometry(0.02, 0.083, 0.02);
    g.lookAt(n);
    g.translate(hit.point.x + n.x * 0.004, hit.point.y + n.y * 0.004, hit.point.z + n.z * 0.004);
    return shape(g, P.eye, r, { vary: 0 });
  });
  upper.add(makeMesh(merge(eyes)));

  // 手: 体の横に浮く
  const hands = HANDS.map((h) => {
    const m = makeMesh(handGeo(r));
    m.userData.base = new THREE.Vector3(h.x, h.y, 0.02);
    m.position.copy(m.userData.base);
    upper.add(m);
    return m;
  });

  // 足: 前へのびるロフト。左右で対。歩くと交互に前後する
  const [fl, fw, fh] = FOOT;
  const footRings = rounded({ H: fl, W: fw, D: fh, cb: fl * 0.45, ct: fl * 0.45, cap: [0.3, 0.7, 1], sq: 2.6, p: 2 });
  const feet = [-1, 1].map((sx) => {
    const m = makeMesh(F.loft(r, footRings, O, { seg: 8, jit: 0.004, start: O[0], end: O[1] }));
    m.userData.base = new THREE.Vector3(sx * FOOT_X, fh / 2, -fl * 0.35);
    m.position.copy(m.userData.base);
    root.add(m);
    return m;
  });
  upper.position.y = LIFT;

  // 動き: 歩くと足が交互に出て、体が弾み、手が足と逆に振れる。立ち止まると息でゆっくり上下し、手がふわふわ浮く
  let phase = 0, amp = 0, time = 0;
  function update(dt, { moving = false, speed = 1 } = {}) {
    time += dt;
    amp += ((moving ? 1 : 0) - amp) * Math.min(1, dt * 8);
    phase += dt * 9 * speed * amp;
    const idle = 1 - amp;
    upper.position.y = LIFT + Math.abs(Math.sin(phase)) * 0.035 * amp + Math.sin(time * 1.6) * 0.006 * idle;
    feet.forEach((f, i) => {
      const w = phase + Math.PI * i, b = f.userData.base;
      f.position.set(b.x, b.y + Math.max(0, Math.cos(w)) * 0.05 * amp, b.z + Math.sin(w) * 0.13 * amp);
    });
    hands.forEach((h, i) => {
      const w = phase + Math.PI * (1 - i), b = h.userData.base;
      h.position.set(b.x, b.y + Math.sin(time * 1.8 + i * 2) * 0.012 * idle, b.z + Math.sin(w) * 0.1 * amp);
    });
  }

  return { root, update, body, head, hands, feet, eyeHeight: CHARA_SIZE.eye * 0.8 };
}
