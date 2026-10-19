// 猫のアバター（docs/rules/avatar.md）
// 見た目だけを持つ。位置や移動の状態は外から渡す（マルチプレイで他の人にも使うため）。
// 正面は +z。足の裏が y=0。キャラクターなので、面は世界の物より細かくしてよい。
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { rng, pick, shape, merge, makeMesh } from '../style/lowpoly.js';
import { sculpt, sdf } from '../style/sculpt.js';

const O = P.catOrange, W = P.catWhite, K = P.catPink;
const fur = () => O[1];
const white = (r) => pick(r, [W[1], W[2], W[2]]);
const VARY = 0.05;
const SCALE = 0.8; // 全体の大きさ（形は全高 1.7m で作り、0.8 倍して約 1.4m）
const HEAD_TRIS = 110, TORSO_TRIS = 70; // 間引いたあとの三角形の数

function group(x, y, z, ...children) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  for (const c of children) g.add(c);
  return g;
}

// だ円体。deform(x, y, z) で半径1の球の頂点を変形してから引き伸ばす
function ellipsoid(rx, ry, rz, ws, hs, deform) {
  const g = new THREE.SphereGeometry(1, ws, hs), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let [x, y, z] = [p.getX(i), p.getY(i), p.getZ(i)];
    if (deform) [x, y, z] = deform(x, y, z);
    p.setXYZ(i, x * rx, y * ry, z * rz);
  }
  return g;
}

// 表面に小さな部品（目・鼻）を貼る: 正面から光線を当てて、当たった所に面の向きで置く
const _ray = new THREE.Raycaster(), _from = new THREE.Vector3(), _back = new THREE.Vector3(0, 0, -1), _z = new THREE.Vector3(0, 0, 1);
function stick(target, part, x, y) {
  target.updateMatrixWorld(true);
  _ray.set(_from.set(x, y, 2), _back);
  const hit = _ray.intersectObject(target)[0];
  if (!hit) return part;
  part.position.copy(hit.point).addScaledVector(hit.face.normal, 0.004);
  part.quaternion.setFromUnitVectors(_z, hit.face.normal);
  return part;
}

// 腕: 肩から下に伸び、先に白い手と、手のひら側のピンクの肉球
function armGeometry(r) {
  const a = new THREE.CapsuleGeometry(0.075, 0.14, 3, 8);
  a.translate(0, -0.12, 0);
  const paw = new THREE.SphereGeometry(0.09, 8, 6);
  paw.scale(1, 0.85, 1);
  paw.translate(0, -0.26, 0);
  const pad = new THREE.SphereGeometry(0.045, 6, 4);
  pad.scale(1, 0.4, 1);
  pad.translate(0, -0.333, 0.01);
  return merge([shape(a, fur, r, { jit: 0.006, vary: VARY }), shape(paw, () => white(r), r, { jit: 0.006 }), shape(pad, K[1], r)]);
}

export function createCat({ seed = 7 } = {}) {
  const r = rng(seed);

  // ---- 胴: 下が太い卵形。胸とお腹は白（なめらかな形から面を間引く） ----
  const torsoGeo = sculpt((x, y, z) => {
    const k = 1.12 - 0.3 * Math.min(1, Math.max(0, (y - 0.32) / 0.74)); // 下ほど太い
    return sdf.ellipsoid(x / k, y - 0.69, z / (k * 0.95), 0.36, 0.37, 0.33) * Math.min(1, k);
  }, [[-0.45, 0.28, -0.42], [0.45, 1.1, 0.42]], { tris: TORSO_TRIS });
  const torso = makeMesh(shape(torsoGeo, (f) =>
    (f.nz > 0.45 && (f.x / 0.21) ** 2 + ((f.y - 0.72) / 0.3) ** 2 < 1 ? white(r) : fur()), r, { vary: VARY }));

  // ---- 頭: 丸く、頬が少しふくらみ、口元が前に出る。口元・あごは白 ----
  const HY = 0.3; // 頭の付け根から頭の中心まで
  const headGeo = sculpt((x, y, z) => {
    x = Math.abs(x);
    let d = sdf.ellipsoid(x, y - HY, z, 0.32, 0.31, 0.33);
    d = sdf.smin(d, sdf.ellipsoid(x - 0.11, y - HY + 0.09, z - 0.08, 0.17, 0.16, 0.19), 0.06);  // 頬
    d = sdf.smin(d, sdf.ellipsoid(x, y - HY + 0.1, z - 0.22, 0.15, 0.1, 0.12), 0.05);       // 口元
    return sdf.smax(d, y - HY - 0.27, 0.08);                                                 // 頭の上を少し平らに
  }, [[-0.42, HY - 0.42, -0.42], [0.42, HY + 0.38, 0.45]], { tris: HEAD_TRIS });
  const head = makeMesh(shape(headGeo, (f) => {
    const muzzle = f.nz > 0.45 && f.y < HY - 0.05 && Math.abs(f.x) < 0.17;
    const chin = f.ny < -0.4 && f.z > 0.02 && Math.abs(f.x) < 0.18;
    return muzzle || chin ? white(r) : fur();
  }, r, { vary: VARY }));

  const eyes = [-1, 1].map((s) => stick(head, makeMesh(shape(new THREE.BoxGeometry(0.05, 0.065, 0.02), P.eye, r, { vary: 0 }), { shadow: false }), 0.12 * s, HY + 0.04));
  const noseGeo = new THREE.ConeGeometry(0.03, 0.035, 3);
  noseGeo.rotateX(Math.PI);
  noseGeo.scale(1, 1, 0.4);
  const nose = stick(head, makeMesh(shape(noseGeo, K[1], r, { vary: 0 }), { shadow: false }), 0, HY - 0.035);

  const ears = [-1, 1].map((s) => {
    const outer = new THREE.ConeGeometry(0.14, 0.26, 4);
    outer.rotateY(Math.PI / 4);
    outer.translate(0, 0.13, 0);
    const inner = new THREE.ConeGeometry(0.08, 0.17, 3);
    inner.scale(1, 1, 0.5);
    inner.translate(0, 0.09, 0.05);
    const pivot = group(0.18 * s, HY + 0.21, -0.03, makeMesh(merge([shape(outer, fur, r, { jit: 0.008, vary: VARY }), shape(inner, K[1], r)])));
    pivot.rotation.z = -0.3 * s;
    pivot.userData.baseZ = pivot.rotation.z;
    return pivot;
  });
  const headPivot = group(0, 0.98, 0, head, ...eyes, nose, ...ears);

  // ---- 腕: 短く太く、少し前に出して構える ----
  const armGeo = armGeometry(r);
  const arms = [-1, 1].map((s) => {
    const pivot = group(0.3 * s, 0.9, 0.08, makeMesh(armGeo));
    pivot.rotation.z = 0.2 * s;
    pivot.userData.baseX = -0.55;
    return pivot;
  });

  // ---- 脚と、四角いブーツ ----
  const legs = [-1, 1].map((s) => {
    const l = new THREE.CapsuleGeometry(0.085, 0.1, 3, 8);
    l.translate(0, -0.1, 0);
    const boot = new THREE.BoxGeometry(0.19, 0.15, 0.27, 2, 1, 2);
    boot.translate(0, -0.285, 0.03);
    const geo = merge([
      shape(l, fur, r, { jit: 0.006, vary: VARY }),
      shape(boot, (f) => (f.ny < -0.5 ? P.boots[0] : pick(r, [P.boots[1], P.boots[2]])), r, { jit: 0.01 }),
    ]);
    return group(0.14 * s, 0.36, 0, makeMesh(geo));
  });

  // ---- しっぽ: 太め。後ろへ伸びてから斜め上に曲がり、先が白い ----
  const segs = [];
  let parent = null;
  const tailRoot = group(0, 0.45, -0.27);
  [[0.17, 0.08, -1.55], [0.16, 0.075, 0.2], [0.15, 0.07, 0.3], [0.14, 0.065, 0.4]].forEach(([len, rad, ang], i, all) => {
    const g = new THREE.CylinderGeometry(rad * 0.9, rad, len + 0.04, 8);
    g.translate(0, len / 2, 0);
    const col = i === all.length - 1 ? () => white(r) : fur;
    const seg = group(0, parent ? parent.userData.len : 0, 0, makeMesh(shape(g, col, r, { jit: 0.006, vary: VARY })));
    seg.rotation.x = ang;
    seg.userData.len = len;
    seg.userData.baseX = ang;
    (parent || tailRoot).add(seg);
    segs.push(seg);
    parent = seg;
  });

  const body = group(0, 0, 0, torso, headPivot, ...arms, tailRoot);
  const root = group(0, 0, 0, body, ...legs);
  root.scale.setScalar(SCALE);

  // ---- 動き ----
  let phase = 0, amp = 0, time = r() * 10, twitch = 2 + r() * 3, twitchT = 0, twitchEar = 0;
  function update(dt, { moving = false, speed = 1 } = {}) {
    time += dt;
    amp += ((moving ? 1 : 0) - amp) * Math.min(1, dt * 8);
    phase += dt * 8 * speed * amp;
    const sw = Math.sin(phase) * 0.6 * amp;
    legs[0].rotation.x = sw;
    legs[1].rotation.x = -sw;
    arms[0].rotation.x = arms[0].userData.baseX - sw * 0.7;
    arms[1].rotation.x = arms[1].userData.baseX + sw * 0.7;
    body.position.y = Math.abs(Math.sin(phase)) * 0.045 * amp;
    torso.scale.y = 1 + Math.sin(time * 2.2) * 0.012 * (1 - amp);
    headPivot.rotation.z = Math.sin(phase) * 0.05 * amp;
    headPivot.rotation.x = Math.sin(time * 1.1) * 0.03;
    tailRoot.rotation.y = Math.sin(time * (1.4 + amp * 2.6)) * (0.3 + amp * 0.15);
    segs[2].rotation.x = segs[2].userData.baseX + Math.sin(time * 1.9) * 0.08;
    // ときどき耳がぴくっと動く
    twitch -= dt;
    if (twitch < 0) { twitch = 2 + r() * 4; twitchT = 0.18; twitchEar = r() < 0.5 ? 0 : 1; }
    twitchT = Math.max(0, twitchT - dt);
    ears.forEach((e, i) => {
      e.rotation.z = e.userData.baseZ + (i === twitchEar ? Math.sin((twitchT / 0.18) * Math.PI) * 0.35 * (i ? -1 : 1) : 0);
    });
  }

  return { root, update, eyeHeight: 1.35 * SCALE };
}

// 1人称で画面の下に見える猫の腕。カメラの子にして使う。
export function createFpArms({ seed = 9 } = {}) {
  const r = rng(seed);
  const root = new THREE.Group();
  const geo = armGeometry(r);
  const arms = [-1, 1].map((s) => {
    const m = makeMesh(geo, { shadow: false });
    m.receiveShadow = false;
    // 腕を前に向ける（手のひらが下）
    const g = group(0.24 * s, -0.2, -0.1, m);
    g.rotation.set(1.35, 0.2 * s, 0);
    g.userData.base = g.position.clone();
    root.add(g);
    return g;
  });

  // 右手に持つ物（道具は柄が y の向きで、握る所が grip）。腕の先の手の位置に、柄を上に向けて付ける
  const hand = group(0, -0.27, 0);
  hand.rotation.x = -Math.PI / 2 - 0.4; // 柄を上に向け、少し前に倒す
  arms[1].add(hand);
  // forward: やりのように、先を前に向けて持つ
  function hold(obj, grip = 0, scale = 0.5, forward = false) {
    hand.clear();
    if (!obj) return;
    obj.scale.setScalar(scale);
    const tilt = forward ? -0.6 : 0;
    obj.rotation.set(tilt, -Math.PI * 0.75, 0); // 刃を前の少し内側に向ける
    obj.position.set(0, -Math.cos(tilt) * grip * scale, -Math.sin(tilt) * grip * scale); // 握る所を手に合わせる
    hand.add(obj);
  }
  // 振る: 腕を上げてから振り下ろす（0.4 秒）
  let swingT = -1, thrust = false;
  const SWING = 0.4;
  function swing(kind = 'chop') { if (swingT < 0) { swingT = 0; thrust = kind === 'thrust'; } } // thrust: 前に突く
  function swingAngle(t) {
    const u = t / SWING;
    if (u < 0.35) return 0.6 * Math.sin((u / 0.35) * Math.PI / 2);   // 上げる
    if (u < 0.6) return 0.6 - 1.1 * ((u - 0.35) / 0.25);              // 振り下ろす
    return -0.5 * (1 - (u - 0.6) / 0.4);                             // もとに戻る
  }

  let phase = 0, amp = 0, time = 0;
  function update(dt, moving) {
    time += dt;
    if (swingT >= 0) { swingT += dt; if (swingT >= SWING) swingT = -1; }
    arms[1].rotation.x = 1.35 + (swingT >= 0 && !thrust ? swingAngle(swingT) : 0);
    const push = swingT >= 0 && thrust ? Math.sin((swingT / SWING) * Math.PI) * 0.22 : 0;
    amp += ((moving ? 1 : 0) - amp) * Math.min(1, dt * 8);
    phase += dt * 8 * amp;
    arms.forEach((g, i) => {
      const s = i ? 1 : -1, b = g.userData.base;
      g.position.set(
        b.x,
        b.y + Math.abs(Math.sin(phase)) * 0.02 * amp + Math.sin(time * 2) * 0.004,
        b.z + Math.sin(phase) * 0.045 * amp * s - (i ? push : 0),
      );
    });
  }
  return { root, update, hold, swing, get swinging() { return swingT >= 0; } };
}
