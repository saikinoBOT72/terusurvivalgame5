// カニ型の掃除ロボ。小型（基準: ブンブン）。参考画像 docs/refs/enemies/crab.jpg。前は +z、原点は足もとの地面（胴の中心は y = 0.22。部品は胴の中心から作る）。
// 参考画像のとおり: 上から見て八角の、上がすぼまった甲羅。前に角を落とした黒い画面と赤い目、前の角に黄色い板、後ろに暗い排水口。
// 前に大きなはさみ ×2（暗い腕、青い手、手首の黄色い帯、暗い指 ×2。内側の指が開く）、横に山なりの脚 ×6（付け根の側と先が暗い）。
// 動き（enemies.md「カニ」）: 移動中は胴が進む向きに対して横を向き、脚を運ぶ（本物のカニ歩き）。ポーズは crabPoses.js
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { rng } from '../style/lowpoly.js';
import { robot as R, solid, limb, angryEyes, eyeHalo, createPoser } from './parts.js';
import { POSES, HOW, IDLE, IDLE_W, WALK } from './crabPoses.js';

// 脚の付け根（x, z）と、外への向き（y 軸の回転）。fb: 前 1・中 0・後ろ -1。phase: 歩きの組（3 本ずつ交互）
const LEGS = [
  { x: 0.17, z: 0.07, yaw: -0.42, fb: 1, phase: 0 },
  { x: 0.2, z: -0.03, yaw: 0, fb: 0, phase: Math.PI },
  { x: 0.17, z: -0.12, yaw: 0.45, fb: -1, phase: 0 },
  { x: -0.17, z: 0.07, yaw: Math.PI + 0.42, fb: 1, phase: Math.PI },
  { x: -0.2, z: -0.03, yaw: Math.PI, fb: 0, phase: 0 },
  { x: -0.17, z: -0.12, yaw: Math.PI - 0.45, fb: -1, phase: Math.PI, limp: true }, // 傷みで引きずる脚
];
const LEG_Y = -0.03, REACH = 0.2, BODY_Y = 0.22; // 脚の付け根の高さ、付け根から足先までの横の長さ（胴が沈んだ分だけ脚を上げる）、地面から胴の中心まで
const shade = (pal, f) => (f.ny > 0.6 ? pal[2] : f.ny < -0.6 ? pal[0] : pal[1]);
const legPaint = (f) => shade(f.y < -0.1 || f.x < 0.09 ? P.robotFrame : P.robotShell, f); // 付け根の側と先は暗く、ひざから下は青
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (u) => u * u * (3 - 2 * u);

export function createCrab(seed = 9) {
  const r = rng(seed);
  const root = new THREE.Group();
  const hull = new THREE.Group();
  hull.rotation.order = 'YXZ'; // 横を向く → 前後・左右に傾く
  root.add(hull);

  // 甲羅（八角、上がすぼまる）、腹、前の黒い画面（甲羅の前の斜面にそろえる）、前の角の黄色い板、後ろの排水口
  const slope = 0.22;
  hull.add(solid([
    R.bevel(r, [0.44, 0.16, 0.36], P.robotShell, { taper: 0.8, rot: [Math.PI, 0, 0] }),
    R.block(r, [0.28, 0.05, 0.24], P.robotFrame, { at: [0, -0.095, 0] }),
    R.bevel(r, [0.24, 0.085, 0.02], P.robotScreen, { axis: 'z', rot: [-slope, 0, 0], at: [0, -0.005, 0.168] }),
    ...[1, -1].map((s) => R.block(r, [0.07, 0.035, 0.012], P.robotHazard, { rot: [-slope, s * 0.69, 0], at: [s * 0.147, -0.02, 0.122] })),
    R.block(r, [0.08, 0.04, 0.012], P.robotScreen, { rot: [slope, 0, 0], at: [0, -0.03, -0.17] }),
  ]));
  const eyes = angryEyes(r, { at: [0, -0.003, 0.18], gap: 0.1, len: 0.06 });
  eyes.group.rotation.x = -slope;
  hull.add(eyes.group);
  const halo = eyeHalo({ at: [0, 0, 0.2], size: 0.3 });
  hull.add(halo.sprite);

  // はさみ ×2: 腕（肩で上下・外へ）→ 手（手首で上下）→ 内側の指（開く）。指先に演出の場所
  const at = (parent, x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; };
  const claws = [1, -1].map((side) => {
    const arm = limb([R.block(r, [0.045, 0.045, 0.15], P.robotFrame, { at: [0, 0, 0.075] })], [side * 0.13, -0.04, 0.12]);
    arm.rotation.order = 'YXZ';
    const hand = limb([
      R.bevel(r, [0.11, 0.085, 0.13], P.robotShell, { axis: 'z', taper: 0.85, at: [0, 0, 0.075] }),
      R.block(r, [0.118, 0.092, 0.03], P.robotHazard, { at: [0, 0, 0.02] }),
      R.tube(r, 0, 0.1, P.robotFrame, { rot: [Math.PI / 2, 0, 0], at: [side * 0.03, 0, 0.19], seg: 4 }, 0.022),
    ], [0, 0, 0.15]);
    const finger = limb([R.tube(r, 0, 0.1, P.robotFrame, { rot: [Math.PI / 2, 0, 0], at: [0, 0, 0.05], seg: 4 }, 0.022)], [-side * 0.03, 0, 0.14]);
    hand.add(finger);
    arm.add(hand);
    hull.add(arm);
    return { side, arm, hand, finger, tip: at(hand, 0, 0, 0.23) };
  });

  // 脚 ×6: 付け根から山なりに上がり、ひざから下へ下りて、先がとがって地面につく（+x 向きに作って回す）
  const legs = LEGS.map((L) => {
    const leg = limb([R.strut(r, [[-0.08, -0.03, 0], [0.09, 0.05, 0], [0.18, -0.09, 0], [REACH, -0.19, 0]], [0, 0.03, 0.036, 0], legPaint)], [L.x, LEG_Y, L.z]);
    leg.rotation.order = 'YXZ';
    hull.add(leg);
    return { ...L, side: Math.sign(L.x), leg };
  });

  // 演出の場所: 排水口（白煙・しずく）、黒煙（甲羅の上）
  const drain = at(hull, 0, -0.03, -0.185);
  const smoke = at(hull, 0, 0.09, -0.02);

  const poser = createPoser(POSES, HOW, { rate: 1.7, settle: 0.3 }), cur = poser.cur;
  const k = (dt, n) => 1 - Math.exp(-dt * n);
  const rnd = () => Math.random() - 0.5;
  // のけぞり・ビクッ: よく揺れ戻るばね（x: ずれ、v: 速さ）。小型なので大きく揺れる
  const spr = () => ({ x: 0, v: 0 });
  const knock = { pitch: spr(), roll: spr(), x: spr(), z: spr(), y: spr() };
  const KS = 170, KD = 9;
  let run = 0, want = 'idle', idleT = 3, health = 1, rage = false, curious = 0, wantCurious = 0, flash = 0, lastCurve = null;
  let lastX = null, lastZ = 0, lastYaw = 0, vf = 0, vs = 0, vr = 0, walkW = 0, tw = 0; // 実際の動き（体の中の前・横の速さ、回る速さ）、横を向く角度
  let brace = 0, patter = 0, deadT = 0, blinkT = 4, blinkOn = 0, look = 0, lookTo = 0, lookT = 2;

  const pickIdle = () => {
    let x = Math.random() * IDLE_W.reduce((a, b) => a + b, 0), i = 0;
    while (i < IDLE.length - 1 && (x -= IDLE_W[i]) > 0) i++;
    return IDLE[i];
  };

  return {
    root,
    poses: Object.keys(POSES),
    vents: [drain], smoke, drain, tips: claws.map((C) => C.tip),
    setPose(name, secs) {
      want = name;
      if (name === 'idle' && IDLE.includes(poser.name)) return; // 待機の動きはそのまま続ける
      poser.set(name, secs);
      if (name === 'down') deadT = 0;
    },
    // 叩かれた: 体の中の向き（lx: 左 +、lz: 前 +）へ大きくのけぞり、少し跳ねて足踏み
    hit(lx, lz, power) {
      knock.pitch.v += lz * power * 14; knock.roll.v -= lx * power * 18;
      knock.x.v += lx * power * 3.5; knock.z.v += lz * power * 3.5; knock.y.v += power * 0.5;
      patter = 0.4;
    },
    setHealth(h) { health = h; }, // 30% から脚を 1 本引きずる
    setRage(on) { rage = on; },
    alert() { knock.y.v += 1.3; brace = 0.7; }, // 「！」: 跳ねて、はさみを両方振り上げる
    curious(on) { wantCurious = on ? 1 : 0; }, // 「？」: 甲羅を傾けて、目を上下にゆらす
    // 撃墜で右のはさみが外れる。外れた部品（世界に置き直した物）を返す
    shed() {
      const C = claws[1];
      if (C.gone || !root.parent) return [];
      C.gone = true;
      root.updateMatrixWorld(true);
      root.parent.attach(C.arm);
      return [C.arm];
    },
    update(t, dt) {
      // 待機: ときどき別の待機の動きへ
      if (want === 'idle' && (idleT -= dt) <= 0) { poser.set(pickIdle()); idleT = 2.5 + Math.random() * 3.5; }
      const shake = poser.step(dt);
      if (poser.curve === 'release' && lastCurve !== 'release') flash = 0.14;
      lastCurve = poser.curve;
      flash = Math.max(0, flash - dt);
      for (const key in knock) { const s = knock[key]; s.v += (-KS * s.x - KD * s.v) * dt; s.x += s.v * dt; }
      brace = Math.max(0, brace - dt);
      patter = Math.max(0, patter - dt);
      curious += (wantCurious - curious) * k(dt, 8);
      if (cur.dead > 0.5) deadT += dt;
      if ((blinkT -= dt) <= 0) { blinkOn = 0.12; blinkT = 3 + Math.random() * 3; }
      blinkOn = Math.max(0, blinkOn - dt);
      const idle = IDLE.includes(poser.name);
      if ((lookT -= dt) <= 0) { lookTo = idle && Math.random() < 0.6 ? rnd() * (0.5 + cur.look * 0.9) : 0; lookT = (1.2 + Math.random() * 2) / (1 + cur.look); }
      look += ((idle ? lookTo : 0) - look) * k(dt, 4);

      { // 実際に動いた量を体の中の向きで測る
        const rp = root.position, yaw = root.rotation.y;
        if (lastX !== null && dt > 0) {
          const wx = (rp.x - lastX) / dt, wz = (rp.z - lastZ) / dt, c = Math.cos(yaw), s = Math.sin(yaw);
          const ok = Math.hypot(wx, wz) < 30; // 置き直し（ワープ）は数えない
          const f = k(dt, 12), dy = wrap(yaw - lastYaw) / dt;
          vs += ((ok ? wx * c - wz * s : 0) - vs) * f; vf += ((ok ? wx * s + wz * c : 0) - vf) * f;
          vr += ((Math.abs(dy) < 20 ? dy : 0) - vr) * f;
        }
        lastX = rp.x; lastZ = rp.z; lastYaw = yaw;
        walkW += ((WALK.includes(poser.name) ? 1 : 0) - walkW) * k(dt, 10); // 攻撃のポーズ中は正面へ向き直る
      }
      const spd = Math.hypot(vf, vs), moving = Math.max(spd, Math.abs(vr) * 0.2) * walkW;
      // カニ歩き: 進む向きに対して胴が横を向く（今の向きに近いほうの横）。止まると正面へ戻る。横ばい突進は side で 90 度
      let walkTw = 0;
      if (spd > 0.25) { const phi = Math.atan2(vs, vf), a = wrap(phi - Math.PI / 2), b = wrap(phi + Math.PI / 2); walkTw = Math.abs(Math.abs(a) - Math.abs(b)) < 0.4 ? (Math.abs(wrap(a - tw)) < Math.abs(wrap(b - tw)) ? a : b) : Math.abs(a) < Math.abs(b) ? a : b; } // 前が後ろを向かない側（ほぼ同じなら今に近い側）
      tw = wrap(tw + wrap(walkTw * walkW + cur.side * Math.PI / 2 - tw) * k(dt, 7));
      const gait = Math.max(Math.min(1, moving / 0.3), patter * 2, cur.scurry); // 0: 立つ 1: 歩く
      run += dt * (moving * 11 + patter * 25 + cur.scurry * 30);
      const limp = health < 0.3 && cur.dead < 0.5 ? 1 : 0;
      const br = Math.min(1, brace / 0.3); // 身構え（はさみを振り上げる）
      const bob = Math.abs(Math.sin(run)) * 0.012 * gait;
      const j = shake * 0.01, jr = shake * 0.05; // ためきる前の震え
      const hy = cur.y + bob + knock.y.x + rnd() * j; // 胴の高さ（脚はこの分だけ上げて、足先を地面に残す）
      hull.position.set(knock.x.x + Math.sin(run) * 0.012 * gait + rnd() * j, BODY_Y + hy + Math.sin(Math.min(1, cur.flip) * Math.PI) * 0.12, knock.z.x);
      hull.rotation.set(
        cur.pitch + knock.pitch.x + rnd() * jr,
        tw + cur.turn + look,
        cur.roll + knock.roll.x + curious * 0.18 - limp * 0.05 * gait + rnd() * jr + Math.PI * cur.flip,
      );
      eyes.group.position.y = -0.003 + Math.sin(t * 7) * 0.012 * curious; // 「？」: 目を上下にゆらす

      // はさみ: カチカチ（ため・待機）、ばたばた（逃げる）、掃除（右で砂をつまんで甲羅の下へ）、じたばた（裏返る）、身構えで振り上げる
      const su = (t * 0.45) % 1;
      const down = su < 0.4 ? smooth(su / 0.4) : su < 0.8 ? 1 : 1 - smooth((su - 0.8) / 0.2);
      const tuck = su < 0.45 ? 0 : su < 0.8 ? smooth((su - 0.45) / 0.35) : 1 - smooth((su - 0.8) / 0.2);
      for (const C of claws) {
        if (C.gone) continue;
        const L = C.side > 0;
        let a = L ? cur.aL : cur.aR, c = L ? cur.cL : cur.cR, o = L ? cur.oL : cur.oR, s = L ? cur.sL : cur.sR;
        const clack = L ? cur.clackL : cur.clackR;
        o += (Math.sin(t * 24 + C.side) > 0 ? 0.45 : -0.25) * clack;
        a += Math.sin(t * 16 + C.side * 1.3) * 0.35 * cur.flap + Math.sin(t * 13 + C.side) * 0.5 * cur.flail;
        o += Math.sin(t * 11 + C.side) * 0.3 * cur.flail;
        if (!L && cur.scoop > 0.01) { a += (0.6 * down + 0.3 * tuck) * cur.scoop; c += (0.3 * down + 1.1 * tuck) * cur.scoop; s -= 0.35 * tuck * cur.scoop; o += ((su < 0.35 ? 0.6 : 0) - o) * cur.scoop; }
        a += (-1.3 - a) * br;
        C.arm.rotation.set(a, C.side * (0.35 + s), 0);
        C.hand.rotation.x = c;
        C.finger.rotation.y = -C.side * Math.max(0, o);
      }

      // 脚: 3 本ずつ交互に上げて運ぶ。胴が沈んだ分だけ上げる（足先は地面に残る）。踏ん張る・砂をかく・じたばた・ピクピク・引きずる
      const comp = -hy / REACH * (1 - Math.min(1, cur.flip));
      legs.forEach((L, i) => {
        const ph = run + L.phase, up = Math.max(0, Math.sin(ph)) * gait;
        let yaw = L.yaw + Math.cos(ph) * 0.22 * gait - L.side * L.fb * 0.22 * cur.splay;
        let lift = comp + up * 0.45 + (cur.pitch + knock.pitch.x) * L.fb * 0.6 - L.side * (cur.roll + knock.roll.x) * 0.7; // 胴の前後・左右の傾きも打ち消す
        if (L.side > 0 && cur.dig > 0.01) { const d = Math.sin(t * 16 + i * 1.3); lift += Math.max(0, d) * 0.5 * cur.dig; yaw += d * 0.3 * cur.dig; } // 後ろ側（突っ込む向きの逆）の脚で砂をかく
        lift += (0.4 + Math.sin(t * 19 + i * 1.7) * 0.45 - lift) * cur.flail; yaw += Math.sin(t * 15 + i) * 0.3 * cur.flail;
        if (cur.dead > 0.5) lift += Math.sin(t * 23 + i * 2.1) * 0.25 * Math.max(0, 1 - deadT / 2.2); // 倒れて脚がピクピク
        if (L.limp && limp) { lift = comp - 0.08; yaw += L.side * 0.25; } // 引きずる: 上げずに後ろへ流れる
        L.leg.rotation.set(0, yaw, lift);
      });

      const rg = rage ? 1 : 0;
      eyes.update(t, { glow: (cur.glow + rg * 0.5) * (blinkOn > 0 && idle ? 0.05 : 1) + flash * 4, blink: cur.blink, dead: cur.dead });
      halo.update(cur.blink * (1 - cur.dead), flash / 0.14);
    },
  };
}
