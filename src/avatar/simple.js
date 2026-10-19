// 仮のキャラ（docs/rules/avatar.md「仮のキャラ」）。猫のモデルが決まるまで使う
// 使い方は前の猫（cat.js。git の最初のコミットにある）と同じ: createSimple → { root, update }、createFpHands（fpHands.js）→ { root, update, hold, swing, swinging, ... }
// 正面は +z。足の裏が y=0。
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { rng, shape, merge, makeMesh } from '../style/lowpoly.js';
import { handGeo } from './fpHands.js';

// 角の丸い箱: 箱の頂点を、内側の箱から半径 r だけ外に押し出す
function roundBox(w, h, d, r, seg = 3) {
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  const p = g.attributes.position, v = new THREE.Vector3(), c = new THREE.Vector3();
  const inner = new THREE.Vector3(w / 2 - r, h / 2 - r, d / 2 - r);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.copy(v).clamp(inner.clone().negate(), inner);
    v.sub(c).setLength(r).add(c);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  return g.toNonIndexed();
}

function bodyGeometry(r) {
  const body = shape(roundBox(0.45, 0.85, 0.35, 0.14).translate(0, 0.425, 0), P.catOrange[1], r);
  const head = shape(roundBox(0.6, 0.45, 0.42, 0.13).translate(0, 1.1, 0), P.catOrange[1], r);
  const eyes = [-1, 1].map((s) => shape(new THREE.BoxGeometry(0.03, 0.11, 0.02).translate(0.09 * s, 1.14, 0.21), P.eye, r, { vary: 0 }));
  return merge([body, head, ...eyes]);
}

export function createSimple({ seed = 7 } = {}) {
  const r = rng(seed);
  const root = new THREE.Group();
  const body = makeMesh(bodyGeometry(r));
  root.add(body);
  const hands = [-1, 1].map((s) => {
    const m = makeMesh(handGeo(r));
    m.userData.base = new THREE.Vector3(0.36 * s, 0.5, 0.02);
    m.position.copy(m.userData.base);
    root.add(m);
    return m;
  });

  let phase = 0, amp = 0, time = 0;
  function update(dt, { moving = false, speed = 1 } = {}) {
    time += dt;
    amp += ((moving ? 1 : 0) - amp) * Math.min(1, dt * 6);
    phase += dt * 9 * speed * amp;
    body.position.y = Math.abs(Math.sin(phase)) * 0.04 * amp;
    hands.forEach((h, i) => {
      const s = i ? 1 : -1, b = h.userData.base;
      h.position.set(b.x, b.y + body.position.y + Math.sin(time * 1.8 + i) * 0.015 * (1 - amp),
        b.z + Math.sin(phase) * 0.12 * amp * s);
    });
  }
  root.scale.setScalar(0.8); // 体の大きさ（firstPerson.js の BODY）
  return { root, update, eyeHeight: 1.1 * 0.8 };
}

// 1人称の両手は fpHands.js（動きの表 fpMotion.js・銃 fpGun.js）
export { createFpHands } from './fpHands.js';
