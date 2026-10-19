// 1人称で画面の下に見える両手（仮のキャラ。docs/rules/avatar.md、動きは weapons.md「武器の動きと演出」）。カメラの子にして使う
// 動きの表は fpMotion.js、銃は fpGun.js、振りの軌跡は combat/swingFx.js。ここでは全部を足して手の位置と向きを決める
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { rng, shape, makeMesh } from '../style/lowpoly.js';
import { MOTIONS, swingPose, chargePose, strikeDir, pose0 } from './fpMotion.js';
import { createGunMotion } from './fpGun.js';
import { createSwingFx } from '../combat/swingFx.js';

export const handGeo = (r) => shape(new THREE.IcosahedronGeometry(0.075, 0).scale(1, 0.9, 1.1), P.catWhite[1], r, { jit: 0.008 });

// ばね（揺れて戻る）。k 硬さ、c 止まりやすさ
const spring = (k, c) => ({ x: 0, v: 0, step(dt) { this.v += (-k * this.x - c * this.v) * dt; this.x += this.v * dt; } });
const ease = (t) => t * t * (3 - 2 * t);
const MOTION_OF = { sling: 'fling', gun: null };

export function createFpHands({ seed = 9 } = {}) {
  const r = rng(seed);
  const root = new THREE.Group();
  const geo = handGeo(r);
  const hands = [-1, 1].map((s) => {
    const m = makeMesh(geo, { shadow: false });
    m.receiveShadow = false;
    m.userData.base = new THREE.Vector3(0.31 * s, -0.27, -0.36); // 画面の両はしに寄せる（真ん中を見やすく）
    m.position.copy(m.userData.base);
    m.rotation.order = 'YXZ';
    root.add(m);
    return m;
  });
  const [L, R] = hands;
  // 右手に持つ物（道具は柄が y の向きで、握る所が grip）。柄を上に向け、少し前に倒す
  const hold0 = new THREE.Group();
  hold0.rotation.x = -0.62;
  R.add(hold0);
  const fx = createSwingFx(root);
  const gun = createGunMotion();
  const tip = new THREE.Object3D(), tipIn = new THREE.Object3D(), tipInHeavy = new THREE.Object3D(); // 刃先と、軌跡の帯の手前のはし
  let held = null, hasTip = false;

  // forward: やりのように、先を前に向けて持つ。tool: 道具は刃・頭を振る向き（前）に向ける
  // top: 上の面に特徴がある物（救急セット・機内食など）。上の面がこちらに見えるように手前へ傾ける
  // gun: 銃の { grip 握る所, sight 照準の高さ }。銃は傾けず、銃口をまっすぐ前へ向けて握る（gunShapes.js の gunRig）
  function hold(obj, grip = 0, scale = 0.5, forward = false, tool = false, top = false, gunInfo = null) {
    hold0.clear();
    gunHeld = !!gunInfo;
    held = obj; hasTip = false; equip = 0; sw = null;
    gun.attach(gunInfo ? obj : null);
    if (!obj) return;
    obj.scale.setScalar(scale);
    if (gunInfo) {
      obj.rotation.set(-hold0.rotation.x, -Math.PI, 0); // 手の前への傾きを打ち消す
      obj.position.set(...gunInfo.grip).applyEuler(obj.rotation).multiplyScalar(-scale);
      aimLift = AIM_EYE - (gunInfo.sight - gunInfo.grip[1]) * scale - R.userData.base.y; // 覗き込むと照準が画面の真ん中へ
      hold0.add(obj);
      return;
    }
    const tilt = forward ? -0.6 : 0;
    obj.rotation.set(tilt + (top ? 1.7 : 0), tool || top ? -Math.PI : -Math.PI * 0.75, 0); // 上の面を 60 度ほど手前へ
    obj.position.set(0, -Math.cos(tilt) * grip * scale, -Math.sin(tilt) * grip * scale); // 握る所を手に合わせる
    if (top) obj.position.add(new THREE.Vector3(-0.1, 0.05, 0)); // 画面の真ん中寄りに見せる
    hold0.add(obj);
    if (tool && obj.geometry) { // 刃先: 柄の向き（y）の一番先
      obj.geometry.computeBoundingBox();
      const len = obj.geometry.boundingBox.max.y;
      tip.position.set(0, len * 0.96, 0); tipIn.position.set(0, len * 0.68, 0); tipInHeavy.position.set(0, len * 0.5, 0);
      obj.add(tip, tipIn, tipInHeavy);
      hasTip = true;
    }
    obj.updateMatrix(); hold0.updateMatrix();
  }

  let weapon = { kind: 'punch', weight: 0.33 };
  const pose = { charge: 0, guard: 0, aim: 0 }, poseTo = { charge: 0, guard: 0, aim: 0 };
  const AIM_EYE = -0.022; // 覗き込んだときの照準の高さ（目の少し下。的が銃の上に見える）
  let aimLift = 0.17;
  // 銃を持っている間（覗いていない）: 手を少し外へ寄せ、銃口が照準の先（GUN_AT m 先の画面の真ん中）を向くようにする
  const GUN_OUT = 0.06, GUN_AT = 8;
  let gunHeld = false;
  let phase = 0, amp = 0, time = 0, equip = 1;
  // 振り: { kind, secs, u 0〜1, heavy, alt, blend つなぎ, from つなぐ前のポーズ, pause 当てた止まり, dir 振りの向き }
  let sw = null, lastKind = null, lastAt = -9, alt = false;
  const cur = pose0(), tmp = pose0();
  const bounce = spring(160, 15), recoil = spring(260, 14), knock = spring(140, 13), swayX = spring(90, 14), swayY = spring(90, 14);
  let prevYaw = null, prevPitch = 0;

  // 振り始め。当たるまでの秒を返す（controls.js がその時に当たりを調べる）
  function swing(kind = 'chop', secs = 0.4, { heavy = false } = {}) {
    const M = MOTIONS[kind] ?? MOTIONS.chop;
    if (!MOTIONS[kind]) kind = 'chop';
    alt = kind === lastKind && time - lastAt < 1 ? !alt : false;
    lastKind = kind; lastAt = time + secs;
    const u = heavy ? M.w : 0;
    sw = { kind, secs, u, heavy, alt, blend: 0, from: cur.slice(), pause: 0, dir: strikeDir(kind, heavy, alt, pose0()), trail: M.trail && hasTip };
    pose.charge = poseTo.charge = 0;
    if (sw.trail) fx.start(heavy);
    return secs * (M.s - u);
  }
  // 振りのポーズ（構え・振り・戻り ＋ ため ＋ 当てた・外した）を out に
  function swingNow(u, out) {
    out.fill(0);
    if (sw) {
      swingPose(sw.kind, Math.min(1, u), sw.heavy, sw.alt, out);
      if (sw.blend < 1) { const k = ease(sw.blend); for (let i = 0; i < 12; i++) out[i] = sw.from[i] + (out[i] - sw.from[i]) * k; }
      for (let i = 0; i < 12; i++) out[i] += sw.dir[i] * bounce.x;
    } else {
      const m = MOTION_OF[weapon.kind] === undefined ? weapon.kind : MOTION_OF[weapon.kind];
      if (m && pose.charge > 0.001) chargePose(m, pose.charge, out);
    }
    return out;
  }

  // 右手の位置と向き（c: 振りのポーズ。そのほかの分は fixed に入れてある）
  const fixed = { p: new THREE.Vector3(), r: new THREE.Vector3() };
  function placeRight(c) {
    R.position.set(fixed.p.x + c[0], fixed.p.y + c[1], fixed.p.z + c[2]);
    R.rotation.set(fixed.r.x + c[3], fixed.r.y + c[4], fixed.r.z + c[5]);
  }
  const v = new THREE.Vector3(), w = new THREE.Vector3();
  const inRoot = (o, out) => out.copy(o.position).applyMatrix4(held.matrix).applyMatrix4(hold0.matrix).applyMatrix4(R.matrix);

  function update(dt, moving, slow = 1) {
    time += dt;
    for (const k in pose) pose[k] += (poseTo[k] - pose[k]) * Math.min(1, dt * (k === 'charge' ? 30 : 14));
    for (const s of [bounce, recoil, knock, swayX, swayY]) s.step(Math.min(dt, 1 / 30));
    equip = Math.min(1, equip + dt / 0.2);
    const u0 = sw ? sw.trailFrom ?? sw.u : 0;
    const frozen = sw?.pause === Infinity; // preview で止めている
    if (sw) {
      if (sw.pause > 0) sw.pause -= dt; else sw.u += dt / sw.secs;
      if (frozen) sw.u = sw.at;
      sw.blend = Math.min(1, sw.blend + dt / 0.08);
      if (sw.u >= 1) sw = null;
    }
    // 見回すと手が少し遅れてついてくる
    const cam = root.parent;
    if (cam) {
      if (prevYaw !== null) {
        const dy = Math.atan2(Math.sin(cam.rotation.y - prevYaw), Math.cos(cam.rotation.y - prevYaw)), dp = cam.rotation.x - prevPitch;
        const k = 0.25 * (1 - 0.7 * pose.aim);
        swayX.x = THREE.MathUtils.clamp(swayX.x + dy * k, -0.04, 0.04);
        swayY.x = THREE.MathUtils.clamp(swayY.x - dp * k, -0.03, 0.03);
      }
      prevYaw = cam.rotation.y; prevPitch = cam.rotation.x;
    }
    root.position.set(swayX.x, swayY.x, 0);
    root.rotation.z = swayX.x * 0.6;
    // 歩くと 8 の字に揺れる（重い物ほど大きく、遅く歩く間は小さく）
    amp += ((moving ? 1 : 0) - amp) * Math.min(1, dt * 8);
    phase += dt * 8 * amp * (slow < 1 ? 0.8 : 1);
    const bobK = amp * (0.75 + 0.4 * weapon.weight) * (slow < 1 ? 0.5 : 1) * (1 - 0.8 * pose.aim);
    const bx = Math.sin(phase) * 0.012 * bobK, by = Math.abs(Math.sin(phase)) * 0.022 * bobK;
    const idle = Math.sin(time * 2) * 0.004;
    // 震え: ため満タン（近接）・スリングは引くほど
    const sling = weapon.kind === 'sling';
    const shakeA = sling ? (0.0015 + 0.006 * pose.charge ** 2) * (pose.charge > 0.05 ? 1 : 0) : poseTo.charge >= 1 ? 0.004 : 0;
    const shake = shakeA * Math.sin(time * 60), shake2 = shakeA * Math.sin(time * 47 + 1);
    const g = gun.update(dt, R, root);
    const eq = 1 - ease(equip);
    const hb = R.userData.base;
    const gx = gunHeld ? GUN_OUT * (1 - pose.aim) : 0; // 銃は外へ寄せる
    const yaw = gunHeld ? Math.atan2(hb.x + gx, GUN_AT) : 0.3, pitch = gunHeld ? Math.atan2(-hb.y - 0.1, GUN_AT) : 0;
    const gd = pose.guard;
    fixed.p.set(
      hb.x + bx + gx - gd * 0.14 - pose.aim * hb.x + shake + g.r[0],
      hb.y + by + idle - eq * 0.3 + gd * 0.12 + pose.aim * aimLift + shake2 + g.r[1] + recoil.x * 0.02 - knock.x * 0.03,
      hb.z + Math.sin(phase) * 0.03 * bobK + gd * -0.02 + pose.aim * 0.06 + g.r[2] + recoil.x * 0.1 + knock.x * 0.12,
    );
    fixed.r.set(
      gd * 0.2 + pitch * (1 - pose.aim) + g.r[3] + recoil.x * 0.55 + knock.x * 0.45 - eq * 0.6,
      yaw * (1 - pose.aim) + g.r[4],
      (gunHeld ? 0 : 0.2) + gd * 1.15 - (gunHeld ? 0 : pose.aim * 0.2) + g.r[5] + Math.sin(phase) * 0.03 * bobK,
    );
    // 振りの軌跡: 振りの間は、前のフレームとの間も 3 回に分けて刃先を足す（速い振りでも帯がなめらか）
    if (sw?.trail && held && sw.u > u0) {
      const M = MOTIONS[sw.kind];
      const n = Math.max(3, Math.ceil((sw.u - u0) / 0.01));
      for (let j = 1; j <= n; j++) {
        const u = u0 + (sw.u - u0) * j / n;
        if (u < M.w - 0.04 || u > M.s + 0.15) continue;
        placeRight(swingNow(u, tmp));
        R.updateMatrix();
        fx.add(inRoot(tip, v), inRoot(sw.heavy ? tipInHeavy : tipIn, w));
      }
    }
    if (sw) sw.trailFrom = undefined;
    placeRight(swingNow(sw ? sw.u : 0, cur));
    // 左手: 振りの分（パンチ・ため攻撃）、ガードで支える、銃のリロードで弾倉・撃鉄へ
    const lb = L.userData.base, eqL = weapon.kind === 'punch' ? eq : 0;
    L.position.set(
      lb.x - bx + cur[6] + gd * 0.13,
      lb.y + Math.abs(Math.sin(phase)) * 0.02 * bobK + idle + cur[7] + gd * 0.1 - eqL * 0.3 - knock.x * 0.03,
      lb.z - Math.sin(phase) * 0.03 * bobK + cur[8] - gd * 0.05 + knock.x * 0.1,
    );
    L.rotation.set(cur[9], cur[10], cur[11]);
    if (g.leftW > 0) L.position.lerp(g.left, g.leftW);
    fx.update(frozen ? 0 : dt);
  }

  return {
    root, update, hold, swing, motions: MOTIONS, // motions: 開発用（ポーズの表をその場で直して見る）
    get swinging() { return !!sw; },
    setPose(k, val) { poseTo[k] = val; }, // 'charge' | 'guard' | 'aim'
    setWeapon(wp) { weapon = wp; },
    // 振りが当たった（true）・外れた（false）: 当てたら一瞬止まって跳ね返る、外したら振り抜ける。重い武器ほど大きい
    impact(hit) {
      if (!sw) return;
      const k = Math.min(1, weapon.weight);
      if (hit) { sw.pause = 0.05 + 0.04 * k; bounce.v -= (0.12 + 0.12 * k) * 16.8; } else bounce.v += (0.1 + 0.08 * k) * 16.8;
    },
    // ガードで受けた（攻撃力 power）: 腕が後ろへはじかれる
    guardHit(power) { knock.v += 2 + Math.min(1.5, power / 20) * 2.5; },
    hurt(power) { knock.v += 1 + Math.min(1.5, power / 30); },
    // 受け流し: 武器の前に白い閃光と火花
    parry() { fx.parry(v.set(-0.08, -0.08, -0.5)); knock.v += 2; },
    gunFire(empty) { recoil.v += pose.aim > 0.5 ? 3.5 : 5.5; gun.fire(empty); },
    gunReload(secs) { gun.startReload(secs); },
    previewReload(p) { gun.reloadAt(p); }, // 開発用
    // 銃口の世界の位置（銃を持っていなければ null）
    muzzleWorld(out) { return gun.rig ? gun.rig.userData.muzzle.getWorldPosition(out) : null; },
    // 開発用: 振りを u（0〜1）の所で止めて見る（軌跡も描く）。stop で戻す
    preview(kind, u, { heavy = false, alt: a = false } = {}) {
      if (kind === 'stop') { sw = null; return; }
      swing(kind, 0.5, { heavy });
      Object.assign(sw, { alt: a, dir: strikeDir(sw.kind, heavy, a, pose0()), blend: 1, pause: Infinity, at: u, u, trailFrom: MOTIONS[sw.kind].w - 0.04 });
    },
    debug: () => `手 ${weapon.kind}${sw ? ` 振り${sw.heavy ? '(ため)' : ''}${sw.alt ? '(返し)' : ''} ${sw.u.toFixed(2)}` : ''}${gun.reloading ? ' リロード中' : ''} ため ${pose.charge.toFixed(2)} ガード ${pose.guard.toFixed(2)}`,
  };
}
