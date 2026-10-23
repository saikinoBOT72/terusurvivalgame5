// モデル確認島（開発用。docs/rules/style.md「大きさごとの目安」）
// 今ある物と見本を、大きさの段階ごとに並べる。札に三角形の数と部品の数を出し、目安から外れた物は赤くする。
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { rng, makeMesh, merge, shape } from '../style/lowpoly.js';
import { createTerrain } from './terrain.js';
import { conifer, broadleaf, stump, rock, grassTuft, mountain, oreRock } from './nature.js';
import { oreBed } from './oreBed.js';
import { sandMound, sandBed } from './sandShapes.js';
import { bigWaterfall } from './waterfall.js';
import { stick, pebble, berryBush, sack } from './pickups.js';
import { fallenLog, birdNest, bambooGrove, palmTree, sapling } from './flora.js';
import { purifierGeo, purifierWater, purifierWaterY } from '../build/furniture.js';
import { campfire, mushrooms, barrel, boat } from './props.js';
import { createChara } from '../avatar/chara.js';
import { createDrone } from '../mobs/drone.js';
import { createDog } from '../mobs/dog.js';
import { createGangi } from '../mobs/gangi.js';
import { createCrab } from '../mobs/crab.js';
import { createMining } from '../mobs/mining.js';
import { createDummy } from '../mobs/dummy.js';
import { createBoar } from '../creatures/boar.js';
import { createRabbit } from '../creatures/rabbit.js';
import { createBird } from '../creatures/bird.js';
import { itemMesh } from '../survival/itemShapes.js';
import { planeWreck, crate } from './wreck.js';
import { planterGeo, crop } from './crops.js';
import { ITEMS } from '../survival/items.js';
import { PARTS, partGeometry } from '../build/parts.js';
import { boothGeo, stakeGeo, gunTableGeo } from './range.js';
import { akRig } from '../survival/akShapes.js';
import { cyberAkRig } from '../survival/cyberShapes.js';
import { container, fishingBoat, junkPile, clayBank, shellGeo, steppingStone } from './spotBeach.js';
import { tentRuin, deadFire, flagPole, notebook, waterWheel, millHut } from './spotCamp.js';
import { deadTree, stoneWall, giantTree, mossBoulder, spring, glowShrooms, GLOW_MAT, poolMesh } from './spotNature.js';
import { loggerWreck, logPile, robotHeap } from './spotAI.js';
import { createCamera } from '../mobs/camera.js';
import { beltCurveGeo } from '../automation/beltShapes.js';
import { drillGeo, generatorGeo, windmillGeo, poleGeo, smelterGeo, benchGeo, beltGeo, portSampleGeo } from '../automation/machineShapes.js';

// style.md の表と同じ数（変えるときは両方）。[名前, 一番長い辺の上限, 三角形, 部品]
export const BUDGET = [
  ['極小', 0.3, [20, 80], [1, 4]],
  ['小', 1, [30, 250], [1, 8]],
  ['中', 3, [36, 400], [1, 25]],
  ['大', 10, [250, 700], [2, 12]],
  ['特大', Infinity, [250, 1000], [1, 6]],
];
const CHARA = ['キャラ', 0, [300, 2000], [1, 99]];
const GUN = ['銃', 0, [300, 700], [10, 36]]; // 銃は細かく作る（style.md「銃（例外）」）
const REALGUN = ['実銃', 0, [600, 2000], [15, 80]]; // 前の FPS の銃の作り直し（style.md「実銃（例外）」）
const CYBERGUN = ['サイバーガン', 0, [600, 1500], [15, 60]]; // サイバーガンシリーズ（style.md「サイバーガン（例外）」）
const AMMO = ['弾の束', 0, [80, 200], [1, 8]]; // 銃の弾の束（style.md「弾の束（例外）」）
const BIGTREE = ['特大の木', 0, [250, 1000], [2, 12]]; // 一本木（style.md「特大の木（例外）」）
const HEAP = ['ロボの山', 0, [600, 3000], [8, 160]]; // 壊れたロボの山: 敵 4 体分まで（objects.md）
const BED = ['鉱床', 0, [300, 900], [10, 40]]; // 鉱床（style.md「鉱床（例外）」）
const MACHINE = ['機械', 0, [400, 1200], [8, 80]];
const CONCRETE = ['コンクリート', 0, [8, 300], [1, 8]]; // マップ作りのコンクリートと光る物（style.md「のっぺりの例外」） // 自動化の機械（style.md「機械（例外）」）
// 敵: 大きさでなく、見本の段階（mob）で決める（enemies.md。仮の数字）
const MOBS = {
  小型: ['小型（敵）', 0, [150, 400], [8, 26]],
  中型: ['中型（敵）', 0, [300, 700], [16, 40]],
  大型: ['大型（敵）', 0, [600, 1500], [24, 60]],
  生き物小型: ['小型（生き物）', 0, [300, 800], [6, 18]], // creatures.md「大きさの段階」
  生き物中型: ['中型（生き物）', 0, [600, 1200], [10, 24]],
};
const classOf = (m) => (m.mob ? MOBS[m.mob] : m.chara ? CHARA : m.realGun ? REALGUN : m.cyberGun ? CYBERGUN : m.gun ? GUN : m.ammo ? AMMO : m.bigTree ? BIGTREE : m.heap ? HEAP : m.bed ? BED : m.machine ? MACHINE : m.concrete ? CONCRETE : BUDGET.find((b) => m.size < b[1]));
const fits = (m) => { const [, , t, p] = classOf(m); return m.tris >= t[0] && m.tris <= t[1] && m.parts >= p[0] && m.parts <= p[1]; };

// 1つの物の大きさ（一番長い辺 m）、三角形の数、部品の数（同じ位置の頂点でつながった面のかたまり）
export function measure(obj) {
  if (obj.isBufferGeometry) obj = new THREE.Mesh(obj);
  if (obj.root) obj = obj.root;
  if (!obj.isObject3D) { // { leaves: 形, berries: 形 } のようなまとまり
    const grp = new THREE.Group();
    for (const v of Object.values(obj)) if (v?.isBufferGeometry) grp.add(new THREE.Mesh(v)); else if (v?.isObject3D) grp.add(v);
    obj = grp;
  }
  obj.updateMatrixWorld(true);
  let tris = 0, parts = 0;
  obj.traverse((m) => {
    if (!m.isMesh || m.userData.fx) return; // 演出の部品（userData.fx。牙など）は数えない
    const g = m.geometry, pos = g.attributes.position, idx = g.index, n = idx ? idx.count : pos.count;
    tris += n / 3;
    const up = new Map(), key = (i) => { const v = idx ? idx.getX(i) : i; return `${pos.getX(v).toFixed(3)},${pos.getY(v).toFixed(3)},${pos.getZ(v).toFixed(3)}`; };
    const find = (k) => { let r = k; while (up.get(r) !== r) r = up.get(r); up.set(k, r); return r; };
    for (let t = 0; t < n; t += 3) {
      const ks = [key(t), key(t + 1), key(t + 2)];
      for (const k of ks) if (!up.has(k)) up.set(k, k);
      up.set(find(ks[1]), find(ks[0])); up.set(find(ks[2]), find(ks[0]));
    }
    parts += new Set([...up.keys()].map(find)).size;
  });
  const s = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
  return { size: +Math.max(s.x, s.y, s.z).toFixed(2), tris, parts };
}

// 並べる物の一覧: { name, obj（Object3D）, update?, chara? }
function catalog() {
  const r = () => rng(5);
  const mesh = (g) => (g.isObject3D ? g : makeMesh(g));
  const two = (o, a, b) => new THREE.Group().add(makeMesh(o[a]), makeMesh(o[b])); // 採ると消える部分が別の物
  const bush = berryBush(r());
  const fire = campfire(r());
  const list = [
    ['針葉樹', conifer(r())], ['広葉樹', broadleaf(r())], ['切り株', mesh(stump(r()))], ['岩（小）', rock(r(), 0.5)], ['岩（大）', rock(r(), 1.2)],
    ['石炭の岩', oreRock(r(), 'coal')], ['銅の岩', oreRock(r(), 'copper')], ['鉄の岩', oreRock(r(), 'iron')],
    ['石炭の岩（小）', oreRock(r(), 'coal', 0.45, true)], ['銅の岩（小）', oreRock(r(), 'copper', 0.45, true)], ['鉄の岩（小）', oreRock(r(), 'iron', 0.45, true)],
    ['飛行機の残骸', mesh(planeWreck(r()))], ['貨物の木箱', mesh(crate(r()))],
    ['召喚の台', mesh(boothGeo(r(), P.robotShell[2]))], ['召喚の台（全部消す）', mesh(boothGeo(r(), P.robotEye[1], 'x'))], ['距離の杭', mesh(stakeGeo(r()))], ['銃の見比べ台', mesh(gunTableGeo(r()))], // 射撃訓練島（開発用）
    ...['potato', 'hemp'].flatMap((k) => [0, 1, 2].map((st) => [`プランター（${k === 'potato' ? 'イモ' : '麻'}・${['芽', '育ち中', '実り'][st]}）`, mesh(merge([planterGeo(r()), crop(r(), k, st)]))])),
    ['野生のイモ', mesh(crop(r(), 'potato', 2, 1))], ['野生の麻', mesh(crop(r(), 'hemp', 2, 1))],
    ['草', grassTuft(r())], ['山', mountain(r(), 14, 18)], ['枝', mesh(stick(r()))], ['石', mesh(pebble(r()))],
    ['落とした袋', mesh(sack(r()))],
    ['倒木', two(fallenLog(r()), 'log', 'caps')], ['鳥の巣', two(birdNest(r()), 'nest', 'eggs')], ['竹やぶ', mesh(bambooGrove(r()))],
    ['ヤシの木', two(palmTree(r()), 'tree', 'nuts')], ['若木', mesh(sapling(r(), 1))],
    ['木の実の茂み', new THREE.Group().add(makeMesh(bush.leaves), makeMesh(bush.berries))],
    ['キノコ（見本）', mesh(mushrooms(r()))], ['樽（見本）', mesh(barrel(r()))], ['小さな船（見本）', mesh(boat(r()))],
  ].map(([name, obj]) => ({ name, obj }));
  list.push({ name: 'たき火（小物）', obj: fire.root, update: fire.update });
  // 墜落島のスポットの物（objects.md「墜落島のスポットの物」）
  const tent = tentRuin(r()), spr = spring(r()), sh = glowShrooms(r());
  list.push(...[
    ['コンテナ（赤さび）', mesh(container(r(), 'rust'))], ['コンテナ（青・扉が開く）', mesh(container(r(), 'blue', true))], ['コンテナ（緑）', mesh(container(r(), 'green'))],
    ['漁船の残骸', mesh(fishingBoat(r()))], ['ガラクタの山', mesh(junkPile(r()))], ['粘土の露頭', mesh(clayBank(r()))], ['貝（世界）', mesh(shellGeo(r()))], ['飛び石', mesh(steppingStone(r()))],
    ['テント跡', new THREE.Group().add(makeMesh(tent.cloth, { double: true }), makeMesh(tent.frame))], ['消えたたき火', mesh(deadFire(r()))], ['旗竿', mesh(flagPole(r()))],
    ['手帳', mesh(notebook(r()))], ['水車の残骸', mesh(waterWheel(r()))], ['崩れた小屋', mesh(millHut(r()))],
    ['立ち枯れの木', mesh(deadTree(r()))], ['石垣', mesh(stoneWall(r()))], ['苔の巨岩', mesh(mossBoulder(r()))],
    ['泉', new THREE.Group().add(makeMesh(spr.geo, { double: true }), poolMesh(spr.pool))],
    ['光るキノコ', new THREE.Group().add(makeMesh(sh.body), new THREE.Mesh(sh.glow, GLOW_MAT))],
  ].map(([name, obj]) => ({ name, obj })));
  list.push({ name: '一本木', obj: mesh(giantTree(r()).geo), bigTree: true });
  const fall = bigWaterfall(r());
  list.push({ name: '滝', obj: fall.root, update: fall.update });
  list.push({ name: '伐採ロボの残骸', obj: mesh(loggerWreck(r())) }, { name: '丸太の山', obj: mesh(logPile(r())) }, { name: '壊れたロボの山', obj: robotHeap(r()), heap: true });
  for (const [k, n] of [['coal', '石炭'], ['copper', '銅'], ['iron', '鉄'], ['stone', '石']]) list.push({ name: `${n}の鉱床`, obj: oreBed(r(), k), bed: true });
  // 自動化の機械（automation.md）: ドリルは刃が回る。ベルトと並べて口の高さを見比べる
  const drill = (withBelt) => {
    const d = drillGeo(r()), bit = makeMesh(d.bit), g = new THREE.Group().add(makeMesh(d.body), bit);
    const slab = makeMesh(shape(new THREE.BoxGeometry(1.4, 0.4, 1.4).translate(0, -0.2, 0), P.rockGray[1], r())); // 刃が入る鉱床の岩の代わり（数えない）
    slab.userData.fx = true; g.add(slab);
    if (withBelt) for (const [x, z] of [[-0.25, 0.75], [0.25, 0.75], [0.25, 1.25]]) { const b = makeMesh(beltGeo(r())); b.position.set(x, 0, z); g.add(b); }
    return { obj: g, update: (t, dt) => { bit.rotation.y -= dt * 3; } };
  };
  list.push({ name: '電動ドリル', ...drill(false), machine: true }, { name: '電動ドリルとベルト', ...drill(true) });
  // 動く部分を、決まった点（at）を中心に置いた Object3D にする
  const pivot = (geo, at) => { const m = makeMesh(geo), p = new THREE.Group(); p.position.set(...at); m.position.set(0, 0, 0); p.add(m); return p; };
  const gen = generatorGeo(r()), wind = windmillGeo(r()), sm = smelterGeo(r()), bench = benchGeo(r());
  const rotor = pivot(wind.rotor, wind.rotorAt), arm = pivot(bench.arm, bench.armAt);
  list.push(
    { name: '発電機（燃えている）', obj: new THREE.Group().add(makeMesh(gen.body), makeMesh(gen.glow)), machine: true },
    { name: '風車', obj: new THREE.Group().add(makeMesh(wind.body), rotor), update: (t, dt) => { rotor.rotation.z -= dt * 1.5; }, machine: true },
    { name: '電柱', obj: mesh(poleGeo(r())) },
    { name: '自動炉（動いている）', obj: new THREE.Group().add(makeMesh(sm.body), makeMesh(sm.glow)), machine: true },
    { name: '自動作業台', obj: new THREE.Group().add(makeMesh(bench.body), arm), update: (t) => { arm.rotation.y = Math.sin(t * 1.5) * 0.6; }, machine: true },
  );
  list.push({ name: 'ベルト', obj: mesh(beltGeo(r())) }, { name: 'ベルト（曲がり・右から）', obj: mesh(beltCurveGeo(r(), 1)) }, { name: 'ベルト（曲がり・左から）', obj: mesh(beltCurveGeo(r(), -1)) }, { name: '機械の口（見本）', obj: mesh(portSampleGeo(r())) });
  list.push({ name: '砂の鉱床', obj: mesh(sandBed(r())), bed: true }, { name: '砂の塊', obj: mesh(sandMound(r())) });
  // 浄水器: 止まっている（受け皿が空）と、火にかけている（受け皿に 6 割）
  const purifier = (level, lit) => {
    const g = new THREE.Group().add(makeMesh(purifierGeo(r())));
    const w = makeMesh(purifierWater(r()));
    w.position.y = purifierWaterY(level);
    w.visible = level > 0;
    g.add(w);
    if (!lit) return { obj: g };
    const f = campfire(r(), { base: false });
    f.root.scale.setScalar(0.45);
    g.add(f.root);
    return { obj: g, update: f.update };
  };
  list.push({ name: '浄水器', ...purifier(0, false) }, { name: '浄水器（火にかけた）', ...purifier(0.6, true) });
  const chara = createChara();
  let walkT = 0; // 6 秒ごとに、3 秒歩いて 3 秒立ち止まる
  list.push({ name: '本番キャラ', obj: chara.root, chara: true, update: (t, dt) => { walkT += dt; chara.update(dt, { moving: walkT % 6 < 3 }); } });
  // 敵の見本: ポーズごとに 1 体ずつ並べる
  const POSE_NAMES = { idle: '待機', move: '移動', windup: 'ため', attack: '攻撃', stagger: '隙', crouch: '突進のため', charge: '突進', windupSpin: 'つむじ風のため', spin: 'つむじ風', windupShot: '風の弾のため', shoot: '風の弾', disguise: '岩のふり', down: '撃墜',
    windupBite: 'かみつきのため', bite: 'かみつき', bite2: 'かみつき 2', windupPounce: '跳びかかりのため', pounce: '跳びかかり', windupMud: '泥飛ばしのため', mud: '泥飛ばし', stumble: 'つんのめる',
    sleep: '寝る', drink: '補給', idleSniff: 'においを嗅ぐ', idleSit: '座る', idleScratch: '頭をかく', idleShake: '脚を振る',
    windupSmash: '振り下ろしのため', smash: '振り下ろし', stuck: '刺さって抜けない', windupSweep: 'なぎ払いのため', sweep: 'なぎ払い', windupQuake: '地割れのため', quake: '地割れ', fake: '死んだふり', fakeWake: '死んだふり（目が点く）', idleCarry: 'かつぐ', leapSmash: '振り下ろしの跳び', roar: '吠える', idleTap: 'コツコツ', idleBlade: '刃を見る',
    windupPinch: 'はさみ打ちのため', pinch: 'はさみ打ち', windupDouble: '両ばさみのため', pinchL: '両ばさみ（左）', pinchR: '両ばさみ（右）', windupRush: '横ばい突進のため', rush: '横ばい突進', flip: '裏返る', idleLook: '見回す', idleClack: 'カチカチ', idleScoop: '掃除',
    dig: '掘る', threat: '威嚇', fall: '倒れる', graze: '草をはむ', flee: '逃げる', peck: 'ついばむ', fly: '飛ぶ' };
  const MOB_LIST = [[createDrone, 'ブンブン', '小型'], [createCrab, 'カニ', '小型'], [createDog, 'ガラクタ犬', '中型'], [createMining, '採掘ロボ', '中型'], [createCamera, '監視カメラ', '中型'], [createGangi, 'ガンギ', '大型'], [createRabbit, 'ウサギ', '生き物小型'], [createBird, '鳥', '生き物小型'], [createBoar, 'イノシシ', '生き物中型']];
  for (const [make, name, mob] of MOB_LIST) {
    for (const pose of make().poses) {
      const d = make();
      d.setPose(pose);
      for (let i = 0; i < 60; i++) d.update(0, 1 / 30); // ポーズに落ち着かせてから並べる
      list.push({ name: `${name}（${POSE_NAMES[pose]}）`, obj: d.root, update: d.update, mob });
    }
  }
  const dummy = createDummy(); // 練習用の的（叩いて試す。enemies.md）
  list.push({ name: '練習用の的', obj: dummy.root, update: dummy.update });
  const has = (n) => list.some((it) => it.name === n); // 落ちている枝・石と持ち物の枝・石は同じ形
  for (const id in ITEMS) if (!has(ITEMS[id].name)) list.push({ name: ITEMS[id].name, obj: itemMesh(id), gun: ITEMS[id].tool === 'gun', ammo: id === 'junkAmmo' });
  list.push({ name: 'AK47（作り直し）', obj: akRig(), realGun: true });
  list.push({ name: 'AK47（サイバー）', obj: cyberAkRig('rose'), cyberGun: true }); // サイバーガンシリーズ（weapons.md） // 前の FPS の銃の作り直し（射撃訓練島の見比べ台）
  for (const [id, name] of [['battery', 'バッテリー（削除済み）'], ['lantern', 'ランタン（削除済み）']]) list.push({ name, obj: itemMesh(id) }); // 形だけ残す
  for (const t in PARTS) if (!has(PARTS[t].name)) list.push({ name: PARTS[t].name, obj: makeMesh(partGeometry(t)), concrete: !!PARTS[t].map });
  return list;
}

// 札: 名前と数。目安から外れていれば赤
function label(lines, ok, k = 1) { // k: 札の大きさ（小さい物には小さい札）
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = P.ui.panel; x.fillRect(0, 0, 512, 128);
  x.fillStyle = ok ? P.ui.ok : P.ui.ng; x.fillRect(0, 0, 14, 128);
  x.fillStyle = P.ui.text; x.font = 'bold 44px sans-serif'; x.fillText(lines[0], 32, 54);
  x.fillStyle = ok ? P.ui.textSub : P.ui.ng; x.font = '34px sans-serif'; x.fillText(lines[1], 32, 106);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), fog: false }));
  s.scale.set(1.6 * k, 0.4 * k, 1);
  return s;
}

export function buildShowcase() {
  const group = new THREE.Group();
  const W = 64, D = 160, X0 = -32, Z0 = -154, GROUND = 0.5; // 並べる物が増えたら D と Z0 を広げる
  const terrain = createTerrain({ w: W, d: D, x0: X0, z0: Z0, corner: () => GROUND, waterLevel: 0 });
  const chunk = terrain.buildChunk(0, 0, W, D);
  group.add(chunk.mesh, chunk.grid, chunk.steep);

  // 大きさの段階ごとに、小さい順に左から並べる。幅 50m で折り返す
  const items = catalog().map((it, i) => ({ ...it, i, m: { ...measure(it.obj), chara: it.chara, mob: it.mob, gun: it.gun, realGun: it.realGun, cyberGun: it.cyberGun, ammo: it.ammo, bigTree: it.bigTree, heap: it.heap, bed: it.bed, machine: it.machine, concrete: it.concrete } }));
  const order = (it) => (it.mob ? 3 + Object.keys(MOBS).indexOf(it.mob) : it.chara ? 2.5 : it.gun || it.realGun || it.cyberGun || it.ammo ? 1.5 : BUDGET.indexOf(classOf(it.m)));
  items.sort((a, b) => order(a) - order(b) || (a.mob ? a.i - b.i : a.m.size - b.m.size)); // 敵は一覧の順（同じ敵のポーズが並ぶ）
  const colliders = [], updates = [], out = [];
  let x = -25, z = 0, rowDepth = 0, cls = null;
  const newRow = () => { x = -25; z -= rowDepth + 2.2; rowDepth = 0; };
  for (const it of items) {
    const c = classOf(it.m)[0];
    if (it.name === '山') { // 山は遠くに置く
      it.obj.position.set(0, GROUND - 7, Z0 - 30);
      group.add(it.obj);
      out.push({ name: it.name, cls: c, ...it.m, ok: fits(it.m) });
      continue;
    }
    const box = new THREE.Box3().setFromObject(it.obj), sz = box.getSize(new THREE.Vector3());
    const w = Math.max(sz.x, 0.5) + 1.2;
    if (cls !== null && (c !== cls || x + w > 25)) newRow();
    cls = c;
    rowDepth = Math.max(rowDepth, sz.z);
    const px = x + w / 2, pz = z - sz.z / 2;
    it.obj.position.set(px - (box.min.x + box.max.x) / 2, GROUND - box.min.y, pz - (box.min.z + box.max.z) / 2);
    group.add(it.obj);
    const ok = fits(it.m);
    const tag = label([it.name, `${c} ・ 三角形 ${it.m.tris} ・ 部品 ${it.m.parts}`], ok, Math.min(1.2, Math.max(0.55, 0.4 + it.m.size * 0.3)));
    tag.position.set(px, GROUND + sz.y + 0.3, pz);
    group.add(tag);
    colliders.push({ x: px, z: pz, r: Math.max(sz.x, sz.z) * 0.45, top: GROUND + sz.y });
    if (it.update) updates.push(it.update);
    out.push({ name: it.name, cls: c, ...it.m, ok, x: +px.toFixed(1), z: +pz.toFixed(1) });
    x += w;
  }

  return {
    group, terrain,
    report: out, // 並べた物の数（__game.world.report）
    colliders: (cx, cz, rad) => colliders.filter((c) => Math.hypot(cx - c.x, cz - c.z) < c.r + rad),
    spawn: { x: 0, z: 4 },
    catCenter: new THREE.Vector3(0, 0, 8),
    fog: [80, 300],
    setGrid(on) { chunk.grid.visible = on; },
    setDebug(on) { chunk.steep.visible = on; },
    update(t) { const dt = 1 / 60; for (const u of updates) u(t, dt); },
  };
}
