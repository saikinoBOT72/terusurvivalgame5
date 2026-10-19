// 採掘ロボ。中型（基準: ガラクタ犬）。参考画像 docs/refs/enemies/mining.jpg。前は +z、原点は足もとの地面。高さ約 1.5m。
// 丸い胸の上に四角いヘルメットの頭（2026-10-18 ごつく）: 顔に覆いかぶさる厚いひさし、四角い黒い画面と赤い目、頭頂の鉱夫のヘッドライト、
// 耳当て、前へ突き出た黄のぎざぎざの縞のあごガード、後頭部の排気管 2 本。胸の下に笑った口のような黄色い曲線と、鉄の帯。
// 厚い四角い肩当て 2 枚重ね（上は黄）、暗い二の腕、青い前腕と手首の黄色い帯、暗い手。
// 暗い腰と青い骨盤、青い太もも・暗いひざ・青いすね・暗い足。左手（+x）に、背丈に近い大きなツルハシ。
// 岩のふり: 丸まって、十二面体の岩の殻に包まれる。ポーズは miningPoses.js（enemies.md「採掘ロボ」）
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { rng } from '../style/lowpoly.js';
import { robot as R, solid, limb, angryEyes, eyeHalo, glowing, createPoser } from './parts.js';
import { POSES, HOW, IDLE, IDLE_W } from './miningPoses.js';

const THIGH = 0.26, SHIN = 0.3, NECK = 0.45, PICK = 1.3;
const D = 0.42, DUTY = 0.5; // どしどし歩き: 足先の前後の振れ幅（m）、1 歩のうち足がついている割合
const WALK = ['move', 'stagger', ...IDLE]; // 動いていれば脚を運ぶポーズ

export function createMining(seed = 11) {
  const r = rng(seed);
  const root = new THREE.Group();
  const hips = new THREE.Group();
  root.add(hips);
  hips.add(solid([R.block(r, [0.3, 0.13, 0.22], P.robotShell, { at: [0, 0.02, 0] })]));
  const waist = new THREE.Group();
  waist.position.y = 0.09;
  hips.add(waist);

  // 上半身: 暗い腰、丸い胸、肩当て、背中の排気口。胸の下の黄色い曲線は怒ると点滅する（自分の材質）
  const smile = (pts) => R.strut(r, pts, pts.map(() => 0.017), P.robotHazard);
  waist.add(solid([
    R.block(r, [0.24, 0.1, 0.18], P.robotFrame, { at: [0, 0.04, 0] }),
    R.blob(r, [0.32, 0.24, 0.24], P.robotShell, { at: [0, 0.32, 0] }, [6, 4]),
    R.block(r, [0.46, 0.05, 0.05], P.robotFrame, { at: [0, 0.43, 0.19] }), // 鉄の帯
    ...[1, -1].flatMap((s) => [ // 肩当て: 厚い四角い鉄板 2 枚重ね（上は黄）
      R.block(r, [0.22, 0.12, 0.28], P.robotShell, { at: [s * 0.36, 0.5, 0], rot: [0, 0, -s * 0.3] }),
      R.block(r, [0.19, 0.04, 0.24], P.robotHazard, { at: [s * 0.385, 0.575, 0], rot: [0, 0, -s * 0.3] }),
    ]),
  ]));
  const chest = glowing([smile([[-0.23, 0.2, 0.11], [-0.12, 0.165, 0.185], [0, 0.155, 0.205], [0.12, 0.165, 0.185], [0.23, 0.2, 0.11]])], P.robotHazard);
  chest.mat.emissiveIntensity = 0;
  waist.add(chest.mesh);

  // 頭（首で傾く）: 四角いヘルメット、ひさし、画面、あごガード（黄黒の縞）、耳当てとボルト、後頭部の排気管、ヘッドライト（光る）
  const head = new THREE.Group();
  head.position.y = NECK;
  head.add(solid([
    R.bevel(r, [0.5, 0.36, 0.44], P.robotShell, { axis: 'z', at: [0, 0.15, 0] }),
    R.block(r, [0.56, 0.085, 0.17], P.robotFrame, { at: [0, 0.27, 0.215], rot: [0.28, 0, 0] }), // ひさし（画面に覆いかぶさる）
    R.block(r, [0.38, 0.14, 0.03], P.robotScreen, { at: [0, 0.15, 0.215] }),
    R.block(r, [0.44, 0.1, 0.16], P.robotFrame, { at: [0, 0.01, 0.2] }), // あごガード
    R.strut(r, [[-0.17, -0.03, 0.285], [-0.1, 0.05, 0.285], [-0.03, -0.03, 0.285], [0.04, 0.05, 0.285], [0.11, -0.03, 0.285], [0.18, 0.05, 0.285]], [0.017, 0.017, 0.017, 0.017, 0.017, 0.017], P.robotHazard), // あごガードの黄の縞（ぎざぎざ）
    R.block(r, [0.6, 0.24, 0.26], P.robotFrame, { at: [0, 0.13, -0.01] }), // 耳当て（両側。真ん中はヘルメットの中）
    R.strut(r, [[0.11, 0.38, -0.31], [0.11, 0.26, -0.17], [-0.11, 0.26, -0.17], [-0.11, 0.38, -0.31]], [0.026, 0.026, 0.026, 0.026], P.robotFrame), // 後頭部の排気管 2 本（つなぎはヘルメットの中）
    R.block(r, [0.15, 0.1, 0.11], P.robotFrame, { at: [0, 0.37, 0.07] }), // ヘッドライトの枠
  ]));
  const lamp = glowing([R.block(r, [0.11, 0.065, 0.02], P.robotLamp, { at: [0, 0.37, 0.13] })], P.robotLamp);
  lamp.mat.emissiveIntensity = 0.9;
  head.add(lamp.mesh);
  const eyes = angryEyes(r, { at: [0, 0.155, 0.235], gap: 0.13, len: 0.085 });
  head.add(eyes.group);
  const halo = eyeHalo({ at: [0, 0.155, 0.27], size: 0.45 });
  head.add(halo.sprite);
  waist.add(head);

  // 腕: 肩（暗い二の腕）→ ひじ（青い前腕、手首の黄色い帯、暗い手）
  const arms = [1, -1].map((side) => {
    const shoulder = limb([R.block(r, [0.08, 0.22, 0.09], P.robotFrame, { at: [0, -0.11, 0] })], [side * 0.37, 0.42, 0]);
    const elbow = limb([
      R.block(r, [0.15, 0.22, 0.16], P.robotShell, { at: [0, -0.12, 0] }),
      R.block(r, [0.165, 0.04, 0.175], P.robotHazard, { at: [0, -0.22, 0] }),
      R.block(r, [0.11, 0.12, 0.09], P.robotFrame, { at: [0, -0.3, 0.01] }),
    ], [0, -0.22, 0]);
    shoulder.add(elbow);
    waist.add(shoulder);
    return { side, shoulder, elbow };
  });

  // ツルハシ（左手）: 柄 1.1m と、幅 0.8m の両はしがとがって下へ曲がった太い頭。ため（振り下ろし）で頭が赤熱。撃墜で手から落ちて地面に刺さる
  const pick = new THREE.Group();
  pick.position.set(0, -0.3, 0.01);
  pick.rotation.x = PICK;
  pick.add(solid([
    R.tube(r, 0.03, 1.1, P.robotFrame, { at: [0, 0.35, 0], seg: 6 }),
    R.strut(r, [[0, 0.76, -0.4], [0, 0.85, -0.2], [0, 0.89, 0], [0, 0.85, 0.2], [0, 0.76, 0.4]], [0, 0.04, 0.06, 0.04, 0], P.robotMetal),
  ]));
  pick.userData.stick = 0.78; // 地面に刺さる（mobFx.js）: 刃を下にして、地面から握りまでの高さ
  const tip = eyeHalo({ at: [0, 0.87, 0], size: 0.7 });
  tip.sprite.userData.fx = true; // 演出（数えない）
  pick.add(tip.sprite);
  arms[0].elbow.add(pick);

  // 脚: 付け根（青い太もも）→ ひざ（暗いひざ当て、青いすね、暗い足）
  const legs = [1, -1].map((side) => {
    const hip = limb([R.block(r, [0.13, THIGH, 0.15], P.robotShell, { at: [0, -THIGH / 2, 0] })], [side * 0.1, -0.03, 0]);
    const knee = limb([
      R.bevel(r, [0.14, 0.25, 0.16], P.robotShell, { taper: 1.1, at: [0, -0.14, 0] }),
      R.block(r, [0.15, 0.06, 0.24], P.robotFrame, { at: [0, -SHIN, 0.04] }),
    ], [0, -THIGH, 0]);
    hip.add(knee);
    hips.add(hip);
    return { side, hip, knee, phase: side > 0 ? 0 : Math.PI };
  });

  // 岩の殻（岩のふりのときだけ大きくなる）
  const rock = solid([R.boulder(r, 0.5, P.robotShell, { scale: [1.05, 0.85, 1], rot: [0.3, 0.5, 0.2] })]);
  rock.position.y = 0.4;
  root.add(rock);

  // 演出の場所: 排気口（後頭部の排気管 2 本）、黒煙（左の肩の付け根）、こぶし（地割れ）、ツルハシの頭（振り下ろし・なぎ払い）
  const at = (parent, x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; };
  const vents = [at(head, 0.11, 0.39, -0.32), at(head, -0.11, 0.39, -0.32)]; // 後頭部の排気管の口
  const smoke = at(waist, 0.3, 0.5, 0);
  const fist = at(arms[1].elbow, 0, -0.34, 0.01);
  const blade = at(pick, 0, 0.87, 0);

  const poser = createPoser(POSES, HOW, { rate: 1.0, settle: 0.5 }), cur = poser.cur;
  const k = (dt, n) => 1 - Math.exp(-dt * n);
  const rnd = () => Math.random() - 0.5;
  const spr = () => ({ x: 0, v: 0 }); // のけぞり・ビクッ: 揺れ戻るばね（x: ずれ、v: 速さ）
  const knock = { pitch: spr(), roll: spr(), x: spr(), z: spr(), y: spr() };
  const KS = 120, KD = 12;
  let run = 0, want = 'idle', idleT = 3, health = 1, rage = false, curious = 0, wantCurious = 0, flash = 0, lastCurve = null;
  let lastX = null, lastZ = 0, spd = 0, walkW = 0, brace = 0, blinkT = 4, blinkOn = 0, look = 0, lookTo = 0, lookT = 2, pickGone = false, steps = 0;
  const stepN = [0, 0];

  const pickIdle = () => {
    let x = Math.random() * IDLE_W.reduce((a, b) => a + b, 0), i = 0;
    while (i < IDLE.length - 1 && (x -= IDLE_W[i]) > 0) i++;
    return IDLE[i];
  };

  return {
    root,
    poses: Object.keys(POSES),
    vents, smoke, fist, blade,
    get disguised() { return cur.rock > 0.5; },
    takeStep() { if (steps <= 0) return false; steps--; return true; }, // 足が地面についた（足音の土ぼこり・揺れ。combat.js）
    setPose(name, secs) {
      want = name;
      if (name === 'idle' && IDLE.includes(poser.name)) return; // 待機の動きはそのまま続ける
      poser.set(name, secs);
    },
    // 叩かれた: 体の中の向き（lx: 左 +、lz: 前 +）へ少しよろける（重いので小さく）
    hit(lx, lz, power) {
      knock.pitch.v += lz * power * 7; knock.roll.v -= lx * power * 9;
      knock.x.v += lx * power * 1.6; knock.z.v += lz * power * 1.6;
    },
    setHealth(h) { health = h; }, // 30% から右脚を引きずる
    setRage(on) { rage = on; }, // HP が減って怒る: 目が強く赤く、胸の黄色い曲線が点滅
    get rage() { return rage; },
    alert() { knock.y.v += 0.6; brace = 0.9; }, // 「！」: 身構える（岩の殻から出るときは brain.js が吠えるポーズ roar に）
    curious(on) { wantCurious = on ? 1 : 0; }, // 「？」: 首をかしげる
    // 撃墜でツルハシが手から落ちる。外れた部品（世界に置き直した物）を返す
    shed() {
      if (pickGone || !root.parent) return [];
      pickGone = true;
      tip.sprite.visible = false;
      root.updateMatrixWorld(true);
      root.parent.attach(pick);
      return [pick];
    },
    update(t, dt) {
      if (want === 'idle' && (idleT -= dt) <= 0) { poser.set(pickIdle()); idleT = 2.5 + Math.random() * 3.5; }
      const shake = poser.step(dt);
      if (poser.curve === 'release' && lastCurve !== 'release') flash = 0.14;
      lastCurve = poser.curve;
      flash = Math.max(0, flash - dt);
      for (const key in knock) { const s = knock[key]; s.v += (-KS * s.x - KD * s.v) * dt; s.x += s.v * dt; }
      brace = Math.max(0, brace - dt);
      curious += (wantCurious - curious) * k(dt, 8);
      if ((blinkT -= dt) <= 0) { blinkOn = 0.12; blinkT = 3 + Math.random() * 3; }
      blinkOn = Math.max(0, blinkOn - dt);
      const idle = IDLE.includes(poser.name);
      if ((lookT -= dt) <= 0) { lookTo = idle && Math.random() < 0.6 ? rnd() * 1.2 : 0; lookT = 1.2 + Math.random() * 2; }
      look += ((idle ? lookTo : 0) - look) * k(dt, 3);

      { // 実際に動いた速さ（脚が地面を滑らないように）
        const rp = root.position;
        if (lastX !== null && dt > 0) { const v = Math.hypot(rp.x - lastX, rp.z - lastZ) / dt; spd += ((v < 30 ? v : 0) - spd) * k(dt, 10); }
        lastX = rp.x; lastZ = rp.z;
        walkW += ((WALK.includes(poser.name) && cur.rock < 0.3 ? 1 : 0) - walkW) * k(dt, 10); // 攻撃のポーズ中は脚を振らない
      }
      // どしどし: 歩幅は大きく（足先で前後 ±D）、ついた足は滑らない。着地で腰が沈み、ついた脚の側へ揺れる
      const sp = spd * walkW, gait = Math.min(1, sp / 0.4);
      run += dt * Math.PI * sp * DUTY / D;
      const limp = health < 0.3 && cur.dead < 0.5 ? 1 : 0; // 右脚（-x）を引きずる
      const br = Math.min(1, brace / 0.3); // 身構え
      const u0 = ((run / (Math.PI * 2)) % 1 + 1) % 1, v = (u0 * 2) % 1; // v: 半歩ごと（どちらかの足がつく）
      const heavy = gait * Math.min(1, sp / 1.2);
      const dip = v < 0.45 ? Math.sin(Math.PI * v / 0.45) : 0; // 着地のあと沈む
      const bob = (-dip * 0.075 + (v > 0.6 ? Math.sin(Math.PI * (v - 0.6) / 0.4) * 0.03 : 0)) * heavy;
      const sway = Math.sin(u0 * Math.PI * 2) * 0.07 * heavy; // ついた脚の側へ傾く
      const j = shake * 0.02, jr = shake * 0.07; // ためきる前の震え（重いので大きく）
      const tug = poser.name === 'stuck' ? Math.sin(t * 16) : 0; // 刺さったツルハシを両手で引っぱる
      const breathe = idle ? Math.sin(t * 2.2) : 0; // 肩で息をする
      const tap = poser.name === 'idleTap' ? Math.max(0, Math.sin(t * 7)) : 0; // ツルハシの頭で地面をコツコツ
      hips.position.set(knock.x.x + rnd() * j, cur.y + bob - br * 0.06 + knock.y.x + rnd() * j - limp * dip * 0.04 * gait, knock.z.x);
      hips.rotation.set(cur.pitch + knock.pitch.x * 0.4, 0, sway + limp * 0.06 * gait);
      waist.rotation.set(cur.lean + knock.pitch.x + br * 0.15 + rnd() * jr + tug * 0.1 + breathe * 0.025 + dip * 0.08 * heavy, cur.tw + Math.sin(run) * 0.14 * heavy, cur.roll + knock.roll.x + rnd() * jr - sway * 0.6 + tug * 0.05);
      head.rotation.set(cur.hd + br * 0.15 - breathe * 0.03, look, cur.cock + curious * 0.35);
      for (const L of legs) {
        let a = cur.a, b = cur.b;
        if (gait > 0.01) { // 足先の前後の位置を決めて、付け根の角度を逆算する（ついた足が地面で滑らない）
          const u = (((run + L.phase) / (Math.PI * 2)) % 1 + 1) % 1, sw = u < DUTY ? 0 : (u - DUTY) / (1 - DUTY);
          const pos = u < DUTY ? -1 + 2 * u / DUTY : Math.cos(Math.PI * sw), up = u < DUTY ? 0 : Math.sin(Math.PI * sw);
          const n = Math.floor((run + L.phase) / (Math.PI * 2)), i = L.side > 0 ? 0 : 1;
          if (n !== stepN[i]) { stepN[i] = n; if (heavy > 0.3) steps = Math.min(2, steps + 1); } // 着地
          const drag = L.side < 0 ? limp : 0;
          const y0 = -THIGH - SHIN * Math.cos(b), z0 = -SHIN * Math.sin(b), R = Math.hypot(y0, z0), phi = Math.atan2(z0, y0);
          const zb = y0 * Math.sin(a) + z0 * Math.cos(a), d = pos * D * gait * (1 - drag * 0.5);
          const z = Math.max(-R * 0.95, Math.min(R * 0.95, zb - d));
          a = Math.PI - Math.asin(z / R) - phi;
          a -= up * 0.45 * gait * (1 - drag); b += up * 1.1 * gait * (1 - drag); // ひざを高く上げて前へ戻す
        }
        if (L.side < 0 && cur.liftR > 0.01) { a += (-1.7 - a) * cur.liftR; b += (1.5 - b) * cur.liftR; } // 四股: 右足を高く上げる
        L.hip.rotation.set(a - br * 0.1, 0, L.side * (cur.splay + br * 0.06) - sway);
        L.knee.rotation.x = b + br * 0.2;
      }
      for (const A of arms) {
        const left = A.side > 0;
        const [ax, el] = left ? [cur.axL, cur.elL] : [cur.axR, cur.elR];
        const swing = Math.sin(run) * 0.5 * heavy * A.side; // 腕を大きく振る（脚と逆）
        A.shoulder.rotation.set(ax + swing - (left ? br * 0.4 : 0) - (left ? tap * 0.25 : 0) + tug * 0.12, 0, A.side * (cur.az + (left ? cur.azL : 0) + breathe * 0.03));
        A.elbow.rotation.x = el;
      }
      pick.rotation.x = pickGone ? pick.rotation.x : PICK + cur.pk;
      const rg = rage ? 1 : 0, roar = poser.name === 'roar' ? 1 : 0;
      eyes.update(t, { glow: (cur.glow + rg * 0.5 + roar) * (blinkOn > 0 && idle ? 0.05 : 1) + flash * 4, blink: cur.blink, dead: cur.dead });
      halo.update(Math.max(cur.blink, rg * 0.35, roar) * (1 - cur.dead), flash / 0.14);
      const heat = poser.name === 'windupSmash' || poser.name === 'leapSmash' ? Math.max(cur.blink, 0.7) : 0;
      tip.update(heat, poser.name === 'smash' ? flash / 0.14 : 0); // 刃先が赤熱
      chest.mat.emissiveIntensity = rg * (Math.sin(t * 9) > 0 ? 1.2 : 0.1) + roar * 1.4;
      lamp.mat.emissiveIntensity = (0.9 + roar) * (cur.dead > 0.5 || cur.rock > 0.5 ? 0.05 : 1);
      rock.scale.setScalar(Math.max(0.001, cur.rock)); // 岩のふり: 岩の殻がふくらみ、半分を超えると中身は隠れる
      rock.visible = cur.rock > 0.02;
      hips.visible = cur.rock < 0.6;
    },
  };
}
