// ガラクタ犬（四足の歩行ロボ）。中型の見本（docs/rules/enemies.md、参考画像 docs/refs/enemies/dog.jpg）。前は +z、原点は足もとの地面。
// 参考画像のとおり: 角を落とした胴（前の肩・後ろの腰・暗い腹）、胸と肩の横に黄色い板、首の関節の先に角を落とした頭。
// 頭の前は青いふちの中に黒い画面があり、そこに赤い目。その下が大きく開く口（中は黒、下あごは青）。
// 脚は付け根に青い丸い関節、ひざに暗い丸い関節、細く長い下の脚。ひざは 4 本とも後ろへ曲がる。
// 右前（-x）の脚だけさびた付け替え品で、隙のポーズではこの脚が固まって震える。撃墜で外れて転がる。
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { rng } from '../style/lowpoly.js';
import { robot as R, solid, limb, angryEyes, eyeHalo, createPoser } from './parts.js';

// ため（グッ）・放出（バッ）は createPoser でつなぐ（enemies.md「ため → 放出の緩急」「ガラクタ犬」）。ためは攻撃ごとに形を変える
// 脚の角度: a = 付け根（+ で足先が後ろ）、b = ひざ（- で下の脚が前）。f = 前脚、r = 後ろ脚
// y 胴の高さ, pitch 前に傾く（+ で鼻が下）, roll 横に傾く, twist 胴を横へひねる, splay 脚を開く, gait 走り, head 頭（+ で下）, cock 頭をかしげる, jaw 口
// glow 目の光, blink 点滅, dead ×目, stuck 右前脚が固まる, dig 前脚で地面をかく, sniff においを嗅ぐ, lift 右前脚を上げて振る, scr 後ろ脚で頭をかく
const BASE = { y: 0.57, pitch: 0, roll: 0, twist: 0, fa: 0.5, fb: -1.0, ra: 0.5, rb: -1.0, splay: 0, gait: 0, head: -0.35, cock: 0, jaw: 0.3, glow: 0.5, blink: 0, dead: 0, stuck: 0, dig: 0, sniff: 0, lift: 0, scr: 0 };
const pose = (o) => ({ ...BASE, ...o });
const SIT = { y: 0.46, pitch: -0.42, fa: 0.45, fb: -1.0, ra: 1.6, rb: -2.4, head: -0.2 };
const POSES = {
  idle: pose({}),
  move: pose({ pitch: 0.05, gait: 1, head: -0.25, glow: 0.6 }),
  // 連続かみつき: 頭を低く下げて口をガチガチ鳴らす → 前へ踏み込んで噛む（2 回）
  windupBite: pose({ y: 0.5, pitch: 0.28, fa: 0.75, fb: -1.5, ra: 0.6, rb: -1.2, head: -0.55, jaw: 1.15, glow: 1, blink: 1 }), // 首を大きく引いて口を全開
  bite: pose({ y: 0.55, pitch: 0.02, fa: 0.15, fb: -0.7, ra: 0.85, rb: -1.25, head: 0.2, jaw: 1.2, glow: 1 }),
  bite2: pose({ y: 0.58, pitch: -0.02, fa: 0.1, fb: -0.7, ra: 0.9, rb: -1.3, head: 0.3, cock: -0.2, jaw: 1.3, glow: 1 }),
  // 跳びかかり: 胸を地面すれすれまで伏せ、尻を振る → 前脚を伸ばし、後ろ脚で蹴って跳ぶ
  windupPounce: pose({ y: 0.32, pitch: 0.22, fa: 1.2, fb: -2.4, ra: 1.0, rb: -2.0, splay: 0.06, head: -0.15, jaw: 0.3, glow: 1, blink: 1 }),
  pounce: pose({ y: 0.66, pitch: -0.3, fa: -0.75, fb: -0.5, ra: 1.35, rb: -0.25, head: -0.2, jaw: 1.0, glow: 1 }),
  // 泥飛ばし: 体を半分ひねり、前脚で地面を 2 回かく → 前脚で泥をはね上げる
  windupMud: pose({ y: 0.52, pitch: 0.12, twist: 0.55, fa: 0.7, fb: -1.4, ra: 0.55, rb: -1.1, head: 0.15, jaw: 0.35, glow: 1, blink: 1, dig: 1 }),
  mud: pose({ y: 0.6, pitch: -0.2, twist: 0.1, fa: -0.75, fb: -0.35, ra: 0.55, rb: -1.1, head: -0.1, jaw: 0.6, glow: 1 }),
  stagger: pose({ y: 0.55, pitch: -0.08, roll: -0.18, head: -0.1, cock: 0.3, jaw: 0.5, blink: 0.3 }), // のけぞり（よろける）
  stumble: pose({ y: 0.42, pitch: 0.4, roll: 0.12, fa: 1.2, fb: -2.4, ra: 0.6, rb: -1.2, head: 0.5, cock: 0.2, jaw: 0.6, glow: 0.4, blink: 0.4, stuck: 1 }), // つんのめる（足の故障・着地の失敗）
  down: pose({ y: 0.2, pitch: 0.05, roll: 1.35, fa: 0.6, fb: -0.5, ra: 0.6, rb: -0.5, splay: 0.15, head: 0.2, cock: 0.2, jaw: 0.75, glow: 0.3, dead: 1 }), // 横倒し
  sleep: pose({ y: 0.2, pitch: 0.08, roll: 0.06, fa: 1.4, fb: -2.6, ra: 1.4, rb: -2.6, splay: 0.15, head: 0.55, cock: 0.25, jaw: 0.08, glow: 0.04 }), // 寝ている（番人。目の光が暗い）
  drink: pose({ y: 0.5, pitch: 0.28, fa: 0.75, fb: -1.4, ra: 0.4, rb: -0.85, splay: 0.05, head: 0.75, jaw: 0.3, glow: 0.45 }), // 頭を下げて冷却水を補給（泉に来る番人）
  // 待機の動き（setPose('idle') のあいだ、ときどき入れかわる）
  idleSniff: pose({ y: 0.53, pitch: 0.12, fa: 0.65, fb: -1.3, head: 0.6, jaw: 0.35, sniff: 1 }),
  idleSit: pose({ ...SIT }),
  idleScratch: pose({ ...SIT, head: -0.05, cock: -0.45, scr: 1 }),
  idleShake: pose({ roll: 0.06, head: -0.15, cock: 0.2, lift: 1 }),
};
const HOW = { windupBite: 'charge', windupPounce: 'charge', windupMud: 'charge', bite: 'release', bite2: 'release', pounce: 'release', mud: 'release', stagger: 'release', stumble: 'release' };
const IDLE = ['idle', 'idleSniff', 'idleSit', 'idleScratch', 'idleShake'], IDLE_W = [3, 3, 2, 1, 1];

const UPPER = 0.26, LOWER = 0.32;
const WALK =['move', 'stagger', ...IDLE]; // 動いていれば脚を運ぶポーズ
const FANG_T = 0.3; // 牙の演出の長さ（秒）
// 脚の付け根（x, z）。phase: 走りの組（対角が同じ）
const LEGS = [
  { x: 0.165, z: 0.25, front: true, phase: 0 },
  { x: -0.165, z: 0.25, front: true, phase: Math.PI, rust: true }, // 右前（付け替えた脚）
  { x: 0.165, z: -0.27, front: false, phase: Math.PI, scratch: true }, // 左後ろ（頭をかく脚）
  { x: -0.165, z: -0.27, front: false, phase: 0 },
];

export function createDog(seed = 5) {
  const r = rng(seed);
  const root = new THREE.Group();
  const hull = new THREE.Group();
  root.add(hull);

  // 胴: 前の肩（前が少し細い）、後ろの腰（後ろが細い）、暗い腹
  const fwd = { axis: 'z' };
  hull.add(solid([
    R.bevel(r, [0.3, 0.26, 0.38], P.robotShell, { ...fwd, taper: 0.86, rot: [0, Math.PI, 0], at: [0, 0.01, 0.16] }),
    R.bevel(r, [0.28, 0.22, 0.34], P.robotShell, { ...fwd, taper: 0.8, at: [0, 0.01, -0.2] }),
    R.bevel(r, [0.22, 0.16, 0.66], P.robotFrame, { ...fwd, at: [0, -0.07, 0] }),
  ]));

  // 頭: 首の関節で上下に向く。全部箱でかくかくに: 幅広の頭の箱、画面に覆いかぶさる太い眉の鉄板（にらむ）、
  // 両側のさびた頬の装甲（あごの頬板と縦にそろう）、四角い黒い画面と目、牙の上の厚い前へ出る鼻づら、口の中、下あご（開く）
  const head = new THREE.Group();
  head.position.set(0, 0.15, 0.25);
  head.add(solid([
    R.ball(r, 0.075, P.robotFrame),
    R.block(r, [0.3, 0.14, 0.27], P.robotShell, { at: [0, 0.105, 0.105] }),
    R.block(r, [0.32, 0.06, 0.1], P.robotFrame, { at: [0, 0.172, 0.212], rot: [0.3, 0, 0] }), // 眉の鉄板（前へ下がる）
    ...[1, -1].map((s) => R.block(r, [0.03, 0.1, 0.15], P.robotRust, { at: [s * 0.158, 0.065, 0.14], rot: [0, 0, s * 0.22] })), // 頬の装甲（下が開く: 正面から台形）
    R.block(r, [0.2, 0.08, 0.015], P.robotScreen, { at: [0, 0.098, 0.245] }), // 画面
    R.block(r, [0.2, 0.06, 0.1], P.robotShell, { at: [0, 0.03, 0.27] }), // 鼻づら（画面の下から前へ出る）
    R.block(r, [0.21, 0.05, 0.22], P.robotScreen, { at: [0, 0.015, 0.11] }),
  ]));
  const eyes = angryEyes(r, { at: [0, 0.098, 0.254], gap: 0.088, len: 0.06 });
  head.add(eyes.group);
  // 下あご（いかつく）: 頭より幅の広い分厚い本体、大きく前へしゃくれたあご先、両側のさびた頬板、上あごの外へ突き出る鉄の牙 2 本
  const jaw = limb([
    R.block(r, [0.28, 0.11, 0.26], P.robotShell, { at: [0, -0.05, 0.12] }),
    R.block(r, [0.26, 0.105, 0.1], P.robotShell, { at: [0, -0.055, 0.29] }),
    ...[1, -1].map((s) => R.block(r, [0.025, 0.13, 0.2], P.robotRust, { at: [s * 0.146, -0.03, 0.11] })),
    ...[1, -1].map((s) => R.tube(r, 0.003, 0.085, P.ironMetal, { at: [s * 0.09, 0.03, 0.315], seg: 4 }, 0.022)),
  ], [0, 0.02, -0.02]);
  head.add(jaw);
  // 白透明の牙（噛む瞬間にガチンと閉じる演出。上 4・下 4 の大きな三角すい、口の前へはみ出す）: ためで薄く見え、噛むと白く光って閉じ、消える。snapFangs で鳴らす
  const fangMat = new THREE.MeshBasicMaterial({ color: P.fx.fang, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const fangGeo = new THREE.ConeGeometry(0.034, 0.17, 3, 1, true);
  const upFangs = new THREE.Group(), loFangs = new THREE.Group();
  for (const x of [-0.1, -0.034, 0.034, 0.1]) { const f = new THREE.Mesh(fangGeo, fangMat); f.userData.fx = true; f.rotation.x = Math.PI; f.position.set(x, -0.03, 0.27); upFangs.add(f); }
  for (const x of [-0.085, -0.028, 0.028, 0.085]) { const f = new THREE.Mesh(fangGeo, fangMat); f.userData.fx = true; f.position.set(x, 0.07, 0.33); loFangs.add(f); }
  upFangs.visible = loFangs.visible = false;
  head.add(upFangs); jaw.add(loFangs);
  hull.add(head);
  const halo = eyeHalo({ at: [0, 0.1, 0.29], size: 0.36 });
  head.add(halo.sprite);

  // 脚: 付け根（hip、青い丸い関節）→ 上（下が細い）→ ひざ（knee、暗い丸い関節）→ 細い下の脚と足
  const disc = (rad, pal) => R.tube(r, rad, 0.05, pal, { rot: [0, 0, Math.PI / 2], seg: 5 });
  const legs = LEGS.map((L) => {
    const side = Math.sign(L.x);
    const pal = L.rust ? P.robotRust : P.robotFrame;
    const hip = limb([
      disc(0.07, P.robotShell),
      R.block(r, [0.06, UPPER, 0.075], pal, { at: [side * 0.012, -UPPER / 2, 0] }),
    ], [L.x, -0.03, L.z]);
    const knee = limb([
      disc(0.045, P.robotFrame),
      R.block(r, [0.04, LOWER, 0.045], pal, { at: [0, -LOWER / 2, 0] }),
      R.block(r, [0.065, 0.035, 0.09], P.robotFrame, { at: [0, -LOWER - 0.01, 0.02] }),
    ], [side * 0.012, -UPPER, 0]);
    hip.add(knee);
    hull.add(hip);
    return { ...L, side, hip, knee };
  });
  const rust = legs[1];

  // 演出の場所: 排気口（腰の後ろ 2 つ、口の湯気）、黒煙（首の付け根）、口（歯の火花・泥）、右前脚の付け根（つんのめりの火花）
  const at = (parent, x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; };
  const vents = [at(hull, 0.07, 0.03, -0.38), at(hull, -0.07, 0.03, -0.38), at(head, 0, -0.01, 0.27)];
  const smoke = at(hull, 0, 0.14, 0.24);
  const mouth = at(head, 0, 0.0, 0.25);
  const legAt = at(hull, rust.x, -0.03, rust.z);

  const poser = createPoser(POSES, HOW, { rate: 1.3, settle: 0.35 }), cur = poser.cur;
  const k = (dt, n) => 1 - Math.exp(-dt * n);
  const rnd = () => Math.random() - 0.5;
  // のけぞり・ビクッ: よく揺れ戻るばね（x: ずれ、v: 速さ）
  const spr = () => ({ x: 0, v: 0 });
  const knock = { pitch: spr(), roll: spr(), x: spr(), z: spr(), y: spr() };
  const KS = 150, KD = 10;
  let run = 0, want = 'idle', idleT = 3, health = 1, rage = false, curious = 0, wantCurious = 0, flash = 0, chomp = 0, lastCurve = null, fangT = 0, fangN = 0;
  let lastX = null, lastZ = 0, lastYaw = 0, vf = 0, vs = 0, vr = 0, walkW = 0, duty = 0.6; // 実際の動き（体の中の前・横の速さ、回る速さ）
  let brace = 0, patter = 0, deadT = 0, blinkT = 4, blinkOn = 0, look = 0, lookTo = 0, lookT = 2;

  const pickIdle = () => {
    let x = Math.random() * IDLE_W.reduce((a, b) => a + b, 0), i = 0;
    while (i < IDLE.length - 1 && (x -= IDLE_W[i]) > 0) i++;
    return IDLE[i];
  };

  return {
    root,
    poses: Object.keys(POSES),
    vents, smoke, mouth, legAt,
    snapFangs(n = 0) { fangT = FANG_T; fangN = n; }, // 白透明の牙がガチンと閉じる（mudFx.js から。n: かみつきの何回目か）
    setPose(name, secs) {
      want = name;
      if (name === 'idle' && IDLE.includes(poser.name)) return; // 待機の動きはそのまま続ける
      poser.set(name, secs);
      if (name === 'down') deadT = 0;
    },
    // 叩かれた: 体の中の向き（lx: 左 +、lz: 前 +）へよろけ、横へたたらを踏む
    hit(lx, lz, power) {
      knock.pitch.v += lz * power * 12; knock.roll.v -= lx * power * 16;
      knock.x.v += lx * power * 3; knock.z.v += lz * power * 3;
      patter = 0.45;
    },
    setHealth(h) { health = h; }, // 30% から右前脚を上げて 3 本脚で走る
    setRage(on) { rage = on; }, // HP が減って怒る: 目が強く赤い（口の火花は mudFx.js）
    get rage() { return rage; },
    alert() { knock.y.v += 0.9; brace = 0.8; }, // 「！」: 少し跳ねて、踏ん張って身構え、頭を下げてうなる
    curious(on) { wantCurious = on ? 1 : 0; }, // 「？」: 首をかしげ、においを嗅ぐ
    // 撃墜で右前脚が外れる。外れた部品（世界に置き直した物）を返す
    shed() {
      if (rust.gone || !root.parent) return [];
      rust.gone = true;
      root.updateMatrixWorld(true);
      root.parent.attach(rust.hip);
      return [rust.hip];
    },
    update(t, dt) {
      // 待機: ときどき別の待機の動きへ
      if (want === 'idle' && (idleT -= dt) <= 0) { poser.set(wantCurious ? 'idleSniff' : pickIdle()); idleT = 2.5 + Math.random() * 3.5; }
      if (want === 'idle' && wantCurious && poser.name !== 'idleSniff') poser.set('idleSniff');
      const shake = poser.step(dt);
      if (poser.curve === 'release' && lastCurve !== 'release') { flash = 0.14; if (poser.name === 'bite' || poser.name === 'bite2') chomp = 0.16; }
      lastCurve = poser.curve;
      flash = Math.max(0, flash - dt);
      chomp = Math.max(0, chomp - dt);
      fangT = Math.max(0, fangT - dt);
      { // 牙: ためは薄く、噛むと 0.08 秒でガチンと白く光り（少し大きく）、0.22 秒で消える
        const u = FANG_T - fangT, hitA = fangT <= 0 ? 0 : u < 0.08 ? 0.35 + 0.45 * u / 0.08 : 0.8 * (1 - (u - 0.08) / (FANG_T - 0.08));
        fangMat.opacity = Math.max(poser.name === 'windupBite' ? 0.32 : 0, hitA);
        upFangs.visible = loFangs.visible = fangMat.opacity > 0.01;
        const k = fangT > 0 ? 1.15 + 0.3 * fangN + Math.max(0, 1 - Math.abs(u - 0.08) / 0.06) * 0.5 : 1;
        upFangs.scale.setScalar(k); loFangs.scale.setScalar(k);
      }
      for (const key in knock) { const s = knock[key]; s.v += (-KS * s.x - KD * s.v) * dt; s.x += s.v * dt; }
      brace = Math.max(0, brace - dt);
      patter = Math.max(0, patter - dt);
      curious += (wantCurious - curious) * k(dt, 8);
      if (cur.dead > 0.5) deadT += dt;
      if ((blinkT -= dt) <= 0) { blinkOn = 0.12; blinkT = 3 + Math.random() * 3; }
      blinkOn = Math.max(0, blinkOn - dt);
      const idle = IDLE.includes(poser.name);
      if ((lookT -= dt) <= 0) { lookTo = idle && Math.random() < 0.6 ? rnd() * 1.1 : 0; lookT = 1.2 + Math.random() * 2; }
      look += ((idle ? lookTo : 0) - look) * k(dt, 4);

      const br = Math.min(1, brace / 0.3); // 身構え
      const limp = health < 0.3 && cur.dead < 0.5 ? 1 : 0; // 3 本脚
      { // 実際に動いた量を体の中の向きで測る（脚が地面を滑らないように）
        const rp = root.position, yaw = root.rotation.y;
        if (lastX !== null && dt > 0) {
          const wx = (rp.x - lastX) / dt, wz = (rp.z - lastZ) / dt, c = Math.cos(yaw), s = Math.sin(yaw);
          const ok = Math.hypot(wx, wz) < 30; // 置き直し（ワープ）は数えない
          const f = k(dt, 12), dy = Math.atan2(Math.sin(yaw - lastYaw), Math.cos(yaw - lastYaw)) / dt;
          vs += ((ok ? wx * c - wz * s : 0) - vs) * f; vf += ((ok ? wx * s + wz * c : 0) - vf) * f;
          vr += ((Math.abs(dy) < 20 ? dy : 0) - vr) * f;
        }
        lastX = rp.x; lastZ = rp.z; lastYaw = yaw;
        walkW += ((WALK.includes(poser.name) ? 1 : cur.gait) - walkW) * k(dt, 10); // 攻撃のポーズ中は脚を振らない
      }
      const spd = Math.max(Math.hypot(vf, vs), Math.abs(vr) * 0.3) * walkW; // 脚の速さ（その場で回るのも数える）
      // どしどし: 歩幅は大きく（足先で前後 ±0.18〜0.36m）、足音はゆっくり。走るほどついている時間が短く、浮いてから重く着地する
      const D = Math.min(0.36, 0.18 + spd * 0.04);
      duty = Math.max(0.38, 0.65 - spd * 0.06); // 1 歩のうち足がついている割合
      const gait = Math.max(Math.min(1, spd / 0.5), patter * 2); // 0: 立つ 1: 歩く・走る
      run += dt * Math.max(Math.PI * spd * duty / D, patter * 25); // ついた足は 2D を duty の間に送る ＝ 体の速さ
      // 胴: 着地で沈み（ドスン）、蹴って浮く。対角の組が交互につくので左右にも揺れる
      const u0 = ((run / (Math.PI * 2)) % 1 + 1) % 1, v = (u0 * 2) % 1;
      const dip = v < duty ? Math.sin(Math.PI * v / duty) : 0, lift = v < duty ? 0 : Math.sin(Math.PI * (v - duty) / (1 - duty));
      const heavy = Math.min(1, spd / 1.5) * gait;
      const sway = Math.sin(u0 * Math.PI * 2) * 0.05 * heavy; // 左右の揺れ（脚の付け根で打ち消して、ついた足は動かさない）
      const bob = (-dip * (0.035 + D * 0.08) + lift * 0.03) * heavy + Math.abs(Math.sin(run)) * limp * 0.03 * gait;
      const j = shake * 0.012, jr = shake * 0.05; // ためきる前の震え
      const wag = cur.fa > 1.1 && cur.blink > 0.5 ? Math.sin(t * 9) * 0.12 * shake * 2 : 0; // 伏せて尻を振る（跳びかかりのため）
      hull.position.set(knock.x.x + rnd() * j, cur.y + bob - br * 0.06 + knock.y.x + rnd() * j, knock.z.x);
      hull.rotation.set(
        cur.pitch + knock.pitch.x + br * 0.12 + rnd() * jr,
        cur.twist + wag,
        cur.roll + knock.roll.x + curious * 0.12 + limp * 0.05 * gait + rnd() * jr + sway,
      );
      const sniff = Math.max(cur.sniff, curious) * Math.sin(t * 5);
      head.rotation.set(cur.head + br * 0.25 + dip * 0.12 * heavy + Math.sin(t * 13) * 0.04 * Math.max(cur.sniff, curious), look + sniff * 0.35, cur.cock + curious * 0.35 + cur.scr * Math.sin(t * 16) * 0.05);
      // 口: ためのガチガチ（かみつき）、噛んだ瞬間に閉じる、身構えでうなる
      const clack = cur.blink > 0.5 && poser.name === 'windupBite' ? (Math.sin(t * 26) > 0 ? -0.55 : 0) : 0;
      jaw.rotation.x = Math.max(0.02, cur.jaw + clack + br * 0.4 - (chomp > 0 ? Math.sin((chomp / 0.16) * Math.PI) * 1.2 : 0));
      for (const L of legs) {
        if (L.gone) continue;
        let a = L.front ? cur.fa : cur.ra, b = L.front ? cur.fb : cur.rb, side = 0;
        // 付け根の動き（体の速さ＋回る分）の逆へ、ついた足をまっすぐ一定の速さで送り（-1 → 1）、上げて前へ戻す（1 → -1）
        const u = (((run + L.phase) / (Math.PI * 2)) % 1 + 1) % 1, sw = u < duty ? 0 : (u - duty) / (1 - duty);
        const pos = u < duty ? -1 + 2 * u / duty : Math.cos(Math.PI * sw), up = u < duty ? 0 : Math.sin(Math.PI * sw);
        const lf = vf - vr * L.x, ls = vs + vr * L.z, ln = Math.hypot(lf, ls) || 1, lw = spd > 0.01 ? Math.min(1, ln / Math.max(spd, 0.3)) : 0;
        if (spd < 0.3) a += pos * 0.3 * gait; // よろけはその場で足踏み
        else { // 足先の前後・横の位置を決めて、付け根の角度を逆算する（ついた足が地面で滑らない）
          const y0 = -UPPER - LOWER * Math.cos(b), z0 = -LOWER * Math.sin(b), R = Math.hypot(y0, z0), phi = Math.atan2(z0, y0);
          const zb = y0 * Math.sin(a) + z0 * Math.cos(a), d = pos * D * gait * lw;
          const z = Math.max(-R * 0.95, Math.min(R * 0.95, zb - d * lf / ln));
          a = Math.PI - Math.asin(z / R) - phi;
          side = Math.asin(Math.max(-0.9, Math.min(0.9, d * ls / ln / y0))); // 横は先に回る（XYZ 順）ので腕は y0
        }
        b -= up * (0.6 + D * 1.2) * gait; // 前へ戻す間、ひざを高く上げる
        if (L.front && cur.dig > 0.01) { const d = Math.sin(t * 14 + L.phase); a += d * 0.45 * cur.dig; b -= Math.max(0, -d) * 0.8 * cur.dig; } // 地面をかく
        if (L.scratch && cur.scr > 0.01) { a += (-1.3 - a) * cur.scr; b += (-0.9 + Math.sin(t * 16) * 0.35 - b) * cur.scr; } // 後ろ脚で頭をかく
        if (L.rust) {
          a += (0.05 - a) * cur.stuck + Math.sin(t * 40) * 0.03 * cur.stuck; // 固まる: まっすぐ伸びて小刻みに震える
          b += (-0.1 - b) * cur.stuck;
          const up = Math.max(cur.lift, limp * Math.min(1, gait)); // 上げる（振って直す・3 本脚）
          a += (-0.35 + Math.sin(t * 18) * 0.25 * cur.lift - a) * up;
          b += (-1.7 - b) * up;
        }
        if (cur.dead > 0.5) a += Math.sin(t * 23 + L.phase * 3) * 0.18 * Math.max(0, 1 - deadT / 2.2); // 倒れて脚がピクピク
        L.hip.rotation.set(a, 0, L.side * (cur.splay + br * 0.12) + side - sway);
        L.knee.rotation.x = b;
      }
      const rg = rage ? 1 : 0;
      eyes.update(t, { glow: (cur.glow + rg * 0.5) * (blinkOn > 0 && idle ? 0.05 : 1) + flash * 4, blink: cur.blink, dead: cur.dead });
      halo.update(Math.max(cur.blink, rg * 0.35) * (1 - cur.dead), flash / 0.14);
    },
  };
}
