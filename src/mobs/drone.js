// ブンブン（小型ドローン）。小型の見本（docs/rules/enemies.md、参考画像 docs/refs/enemies/drone.jpg）。前は +z。
// 前後に長い八角の胴（後ろが細い）、前に黄色いふちの画面と怒った目、左右に大きい囲いつきファン（羽 8 枚）、下に脚 ×2。
// ファンが一番の特徴なので大きく作る。ファンは横の軸を中心に前後へ傾き、脚は飛ぶと後ろへたたむ。
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { rng } from '../style/lowpoly.js';
import { robot as R, solid, limb, angryEyes, eyeHalo, createPoser } from './parts.js';

// ため（グッ）・放出（バッ）は createPoser でつなぐ（enemies.md「ため → 放出の緩急」）。ためは攻撃ごとに形を変えて、どの攻撃が来るか見せる
// pitch 前に傾く, roll 横に傾く, tilt ファンの前後の傾き, fold 脚をたたむ, back 後ろへ, glow 目の光, blink 点滅, dead ×目, spin 羽の速さ, drop 高さ
// flare: ファンを外へ開く。twist: 胴を逆へひねる。whirl: 胴が回る速さ（ラジアン/秒、つむじ風）
const BASE = { pitch: 0, roll: 0, tilt: 0.3, fold: 0.1, back: 0, glow: 0.5, blink: 0, dead: 0, spin: 14, drop: 0, flare: 0, twist: 0, whirl: 0 };
const pose = (o) => ({ ...BASE, ...o });
const POSES = {
  idle: pose({}),
  move: pose({ pitch: 0.35, fold: 0.7, glow: 0.6, spin: 20 }),
  // 体当たり: 後ろへ大きく引き、ファンを後ろへ倒して速く回す → 前へ突っ込む
  windup: pose({ pitch: -0.5, tilt: -0.55, fold: 0.5, back: -0.14, glow: 1, blink: 1, spin: 36, drop: 0.03 }),
  attack: pose({ pitch: 0.7, tilt: 0.6, fold: 1, back: 0.06, glow: 1, spin: 38 }),
  // つむじ風: 少し沈み、体を逆へひねり、ファンを外へ開いて脚を広げる → 2 回転
  windupSpin: pose({ pitch: 0.06, tilt: 0.1, fold: -0.25, glow: 1, blink: 1, spin: 32, drop: -0.1, flare: 0.75, twist: -0.9 }),
  spin: pose({ tilt: 0.1, fold: 0.3, glow: 1, spin: 42, drop: 0.06, flare: 1.05, whirl: 34 }),
  // 風の弾: 少しのけぞり、ファンを内へ寄せる → 反動で後ろへはねる
  windupShot: pose({ pitch: -0.25, tilt: -0.15, fold: 0.4, back: -0.04, glow: 1, blink: 1, spin: 28, flare: -0.3 }),
  shoot: pose({ pitch: -0.55, tilt: 0.45, fold: 0.5, back: -0.12, glow: 1, spin: 26, flare: 0.15 }),
  stagger: pose({ pitch: -0.25, roll: 0.5, tilt: 0.7, fold: 0.3, glow: 0.25, spin: 8, drop: -0.1 }), // のけぞり・崩れ
  down: pose({ pitch: 0.08, roll: 0.12, tilt: 0, fold: -0.1, glow: 0.3, dead: 1, spin: 0, drop: -0.04, flare: 0.2 }),
};
const HOW = { windup: 'charge', windupSpin: 'charge', windupShot: 'charge', attack: 'release', spin: 'release', shoot: 'release', stagger: 'release' };
const TAU = Math.PI * 2;

const W = 0.24, H = 0.28, L = 0.3; // 胴の幅・高さ・長さ
const FAN_X = 0.31, FAN_R = 0.16;

export function createDrone(seed = 3) {
  const r = rng(seed);
  const root = new THREE.Group();
  const hull = new THREE.Group();
  root.add(hull);

  // 胴（前後に寝かせた八角柱。前が太く後ろが細い）、黄色いふち、画面、顔の下の吸気口、ファンへの軸
  const along = { rot: [Math.PI / 2, 0, 0], flat: true };
  const front = L / 2;
  hull.add(solid([
    R.tube(r, 1, L, P.robotShell, { ...along, scale: [W / 2 / 0.92, 1, H / 2 / 0.92] }, 0.82),
    R.tube(r, 1, 0.025, P.robotHazard, { ...along, scale: [0.115, 1, 0.13], at: [0, 0.01, front + 0.012] }),
    R.tube(r, 1, 0.012, P.robotScreen, { ...along, scale: [0.09, 1, 0.1], at: [0, 0.01, front + 0.03] }),
    R.block(r, [0.1, 0.035, 0.03], P.robotScreen, { at: [0, -0.115, front - 0.005] }),
    R.block(r, [0.38, 0.03, 0.04], P.robotFrame, { at: [0, 0.04, -0.01] }),
  ]));

  const eyes = angryEyes(r, { at: [0, 0.02, front + 0.04], gap: 0.085, len: 0.055 });
  hull.add(eyes.group);

  // ファン ×2: 囲い・中心・羽が傾き、羽はその中で回る
  const fans = [1, -1].map((side) => {
    const fan = new THREE.Group();
    fan.position.set(side * FAN_X, 0.04, -0.01);
    fan.add(solid([R.duct(r, FAN_R, 0.03, 0.05, P.robotFrame), R.tube(r, 0, 0.045, P.robotFrame, { at: [0, 0.015, 0] }, 0.03)]));
    const blade = limb([R.blades(r, FAN_R - 0.025, 8, 0.045, P.robotMetal)], [0, 0, 0], { double: true });
    blade.rotation.y = side;
    fan.add(blade);
    hull.add(fan);
    return { fan, blade, side };
  });

  // 脚 ×2（胴の下）。付け根で前後に回る
  const legs = [1, -1].map((side) => {
    const leg = limb([
      R.block(r, [0.025, 0.12, 0.025], P.robotFrame, { at: [0, -0.06, 0] }),
      R.block(r, [0.035, 0.02, 0.07], P.robotFrame, { at: [0, -0.12, 0.015] }),
    ], [side * 0.07, -H / 2 + 0.02, 0.02]);
    hull.add(leg);
    return leg;
  });

  // 排気口（いつもの白煙が出る所。mobFx.js）と目のまわりの光
  const vent = new THREE.Object3D();
  vent.position.set(0, 0.02, -L / 2 - 0.03);
  hull.add(vent);
  const halo = eyeHalo({ at: [0, 0.02, front + 0.07], size: 0.34 });
  hull.add(halo.sprite);

  const poser = createPoser(POSES, HOW, { rate: 1.7, settle: 0.3 }), cur = poser.cur;
  let ang = 0, bank = 0, lean = 0; // ang: つむじ風で回った角度。bank: 横へ動くほうへ傾く
  const k = (dt, n) => 1 - Math.exp(-dt * n);
  const rnd = () => Math.random() - 0.5;
  // のけぞり・ビクッ: よく揺れ戻るばね（x: ずれ、v: 速さ）
  const spr = () => ({ x: 0, v: 0 });
  const knock = { pitch: spr(), roll: spr(), x: spr(), z: spr(), y: spr() };
  const KS = 180, KD = 9;
  let jit = 0, health = 1, curious = 0, wantCurious = 0, flash = 0, lastCurve = null, falling = false, goneSide = 0;
  let look = 0, lookTo = 0, lookT = 2, hy = 0, hyTo = 0, hyT = 3, blinkT = 4, blinkOn = 0; // 待機の動き

  return {
    root,
    poses: Object.keys(POSES),
    vents: [vent],
    setPose(name, secs) { poser.set(name, secs); },
    lean(v) { lean = Math.max(-1, Math.min(1, v)); }, // 横へ動く速さ（-1〜1、体の左が +）
    // 叩かれた: 体の中の向き（lx: 左 +、lz: 前 +）へ押され、power（のけぞりの強さ）だけ傾く
    hit(lx, lz, power) {
      knock.pitch.v += lz * power * 20; knock.roll.v -= lx * power * 20;
      knock.x.v += lx * power * 3.6; knock.z.v += lz * power * 3.6;
      jit = 0.6;
    },
    setHealth(h) { health = h; }, // 残りの HP の割合（傷みのふらつき）
    alert() { knock.y.v += 1.7; jit = 0.3; }, // 「！」でビクッと跳ねる
    curious(on) { wantCurious = on ? 1 : 0; }, // 「？」で首をかしげる
    setFalling(on) { falling = on; },
    // 撃墜でファンを 1 つ外す。外れた部品（世界に置き直した物）を返す
    shed() {
      const f = fans[Math.random() < 0.5 ? 0 : 1];
      if (f.gone || !root.parent) return [];
      f.gone = true; goneSide = f.side;
      root.updateMatrixWorld(true);
      root.parent.attach(f.fan);
      return [f.fan];
    },
    update(t, dt) {
      const shake = poser.step(dt);
      if (poser.curve === 'release' && lastCurve !== 'release') flash = 0.14; // 放出の瞬間に目が白く光る
      lastCurve = poser.curve;
      flash = Math.max(0, flash - dt);
      // つむじ風: 回る速さが落ちたら、次の正面までそのまま回って止まる（逆へ戻らない）
      if (cur.whirl > 3) ang += cur.whirl * dt;
      else if (ang) {
        const to = Math.ceil(ang / TAU - 1e-3) * TAU;
        ang = Math.min(to, ang + Math.max(cur.whirl * dt, (to - ang) * k(dt, 6), 0.4 * dt));
        if (to - ang < 1e-3) ang = 0;
      }
      bank += (-lean * 0.35 - bank) * k(dt, 6);
      lean *= Math.exp(-dt * 4);
      for (const key in knock) { const s = knock[key]; s.v += (-KS * s.x - KD * s.v) * dt; s.x += s.v * dt; }
      jit = Math.max(0, jit - dt);
      curious += (wantCurious - curious) * k(dt, 8);
      // 待機: きょろきょろ見回す、ときどき高さを変える、まれにまばたき
      const idle = poser.name === 'idle' && !curious;
      if ((lookT -= dt) <= 0) { lookTo = idle && Math.random() < 0.7 ? rnd() * 1.2 : 0; lookT = 1.2 + Math.random() * 2; }
      if ((hyT -= dt) <= 0) { hyTo = idle ? rnd() * 0.14 : 0; hyT = 2 + Math.random() * 2; }
      if ((blinkT -= dt) <= 0) { blinkOn = 0.12; blinkT = 3 + Math.random() * 3; }
      blinkOn = Math.max(0, blinkOn - dt);
      look += ((idle ? lookTo : 0) - look) * k(dt, 5);
      hy += ((idle ? hyTo : 0) - hy) * k(dt, 2);
      // 傷み: HP 50% から少し、30% から大きくふらつく
      const wob = health < 0.3 ? 1 : health < 0.5 ? 0.4 : 0;
      const fly = Math.min(1, cur.spin / 14); // 羽が回っている分だけ浮いて、少しふらつく
      const j = shake * 0.014, jr = shake * 0.06; // ためきる前の震え
      hull.position.set(rnd() * j + knock.x.x, cur.drop + hy + knock.y.x + Math.sin(t * 2.2) * 0.03 * fly + (Math.sin(t * 5.3) * 0.04 + Math.sin(t * 1.7) * 0.06) * wob + rnd() * j, cur.back + knock.z.x);
      hull.rotation.set(
        cur.pitch + knock.pitch.x + (falling ? 0.6 : 0) + Math.sin(t * 3.1) * 0.02 * fly + rnd() * jr,
        cur.twist + ang + look,
        cur.roll + bank + knock.roll.x + curious * 0.3 - goneSide * 0.45 * cur.dead + Math.sin(t * 4.3) * 0.03 * fly + Math.sin(t * 3.7) * 0.12 * wob + rnd() * jr,
      );
      for (const f of fans) {
        if (f.gone) continue;
        f.fan.rotation.set(cur.tilt, 0, -f.side * cur.flare);
        const uneven = 1 + Math.sin(t * 7.1 + f.side) * 0.12 * (idle ? 1 : 0.3) + rnd() * jit * 1.5 + wob * Math.sin(t * 11 + f.side) * 0.3; // 回転のむら
        f.blade.rotation.y += cur.spin * uneven * dt;
      }
      for (const leg of legs) leg.rotation.x = cur.fold;
      eyes.update(t, { glow: cur.glow * (blinkOn > 0 ? 0.05 : 1) + flash * 4, blink: cur.blink, dead: cur.dead });
      halo.update(cur.blink * (1 - cur.dead), flash / 0.14);
    },
  };
}
