// 島（ステップ2）: 区画ごとの地形、自然物の配置、当たり判定
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { rng } from '../style/lowpoly.js';
import { createTerrain } from './terrain.js';
import { generateIsland, ISLAND, SEA, SNOW } from './islandGen.js';
import { spotGround } from './spotTerrain.js';
import { pickSpots } from './zonePlace.js';
import { placeOres } from './orePlace.js';
import { placeStone } from './stonePlace.js';
import { placeWreck, placeLoot } from './wreck.js';
import { conifer, broadleaf, rock, grassTuft, water, instanced, colliderRings } from './nature.js';
import { bigWaterfall } from './waterfall.js';
import { placeFlora } from './floraPlace.js';
import { createPlanting } from './planting.js';
import { DAY_LEN } from './dayNight.js';
import { campfire } from './props.js';
import { createGrassCover } from './grassCover.js';
import { groundNormal, tiltQuat, trunkBase, placeProp } from './placement.js';
import { createResources } from './resources.js';
import { placePickups } from './pickups.js';
import { placeSpots } from './spots.js';

// 地面の色: スポットの地面、岩の段の上（上を向いた面に岩と砂利をまぜる）
const groundColor = (spot, rockAt) => (f, r) => spot(f, r) ?? (f.ny > 0.5 && rockAt(f.x, f.z) && r() < 0.75 ? [P.rockGray[2], P.rockGray[3], P.rockBrown[2], P.grass[1]][Math.floor(r() * 4)] : null);

const CHUNK = 32;        // 区画の一辺（m）
const VIEW = 130;        // これより遠い区画は描かない（かすみの奥。islands.md「見通し」）
const NEAR_VIEW = 40;    // マス目・当たり判定の表示を出す範囲
const CELL = 8;          // 当たり判定の分け方
const TREE_TOP = 3;      // 木の幹の当たり判定の高さ（上に乗れない）
// 壊したあと戻る物と秒（islands.md「資源の量」）。ほかの木・岩は戻らない
const REGROW = { bamboo: DAY_LEN * 2, coal: DAY_LEN * 3, copper: DAY_LEN * 3, iron: DAY_LEN * 3, junk: DAY_LEN * 3, sand: DAY_LEN * 2 };

// id: 島の名前（islandMap.js の ISLANDS）。島は固定なので、同じ名前なら同じ形になる
// 滝（スポット 20。waterfall.js）: 崖の面（fall）に、崖の上の高さで立てる。動き（模様・しぶき）は update
function placeWaterfall(group, terrain, pond, r, fall) {
  const top = Math.max(...[-7, -6, 6, 7].map((dx) => terrain.heightAt(pond.x + dx, fall.z - 3))); // 洞窟の溝の両横の崖の上
  const w = bigWaterfall(r, top + 0.3);
  w.root.position.set(pond.x, 0, fall.z);
  group.add(w.root);
  return w;
}

// onProgress(割合 0〜1, いまの作業): ロード画面（ui/loading.js）。区切りごとに少し待って、画面を描き直させる
export async function buildIsland(id = 'crash', onProgress = () => {}) {
  const step = (p, label) => { onProgress(p, label); return new Promise((r) => setTimeout(r, 0)); };
  await step(0.02, '島の形を決めています');
  const group = new THREE.Group();
  const half = ISLAND / 2;
  const gen = generateIsland(id), seed = gen.def.seed;
  const terrain = createTerrain({
    w: ISLAND, d: ISLAND, x0: -half, z0: -half, tile: gen.tile,
    waterLevel: SEA, sandLevel: 1.25, snowLevel: SNOW, base: -4, seed, ground: groundColor(spotGround(gen.def.spots), gen.rockAt),
  });
  const deco = gen.decorate(terrain); // ひさしと洞窟（地形を削る）

  await step(0.25, '地面を作っています');
  // ---- 区画 ----
  const chunks = [];
  for (let cz = 0; cz < ISLAND; cz += CHUNK) {
    for (let cx = 0; cx < ISLAND; cx += CHUNK) {
      const c = terrain.buildChunk(cx, cz, CHUNK, CHUNK);
      c.x = -half + cx + CHUNK / 2;
      c.z = -half + cz + CHUNK / 2;
      group.add(c.mesh, c.grid, c.steep);
      chunks.push(c);
    }
  }

  // ---- 海: 近くは波打つ水面、その外は動かない水面で地平線まで ----
  const sea = water(-half - 20, -half - 20, ISLAND + 40, ISLAND + 40, SEA, 0.35);
  const far = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: P.water[1] }));
  far.rotation.x = -Math.PI / 2;
  far.position.y = SEA - 0.15; // 波の一番低い所（-0.05）より十分下に。近いと遠くで重なって濃い点が出る
  far.material.polygonOffset = true; far.material.polygonOffsetFactor = 2; far.material.polygonOffsetUnits = 2;
  group.add(sea, far);

  // ---- 当たり判定 {x, z, r, top}（近くのマスだけ調べる） ----
  const cells = new Map(), all = [];
  const key = (x, z) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
  const addCollider = (x, z, r, top) => {
    const k = key(x, z), c = { x, z, r, top };
    // 洞窟の上・中の物は、下の端から上だけぶつかる（上と下で別の物）。大きい物は半径の中も調べる
    if ([[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => deco.caves.inCave(x + a * r * 0.8, z + b * r * 0.8))) c.bottom = terrain.floorAt(x, top, z) - 0.3;
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(c);
    all.push(c);
    return c;
  };
  // 木の葉: 葉の下の高さ（bottom）から上だけぶつかる。低い葉は通り抜けられず、高い葉の下はくぐれる
  const leafCollider = (x, z, y, s, l) => { const c = addCollider(x, z, l.r * s, y + 6 * s); c.bottom = y + l.bottom * s; return c; };
  const removeCollider = (c) => { const list = cells.get(key(c.x, c.z)); if (list) list.splice(list.indexOf(c) >>> 0, 1); };
  function colliders(x, z, r) { // (x, z) の半径 r と重なる物
    const out = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      for (const c of cells.get(key(x + dx * CELL, z + dz * CELL)) || []) {
        if (Math.hypot(x - c.x, z - c.z) < c.r + r) out.push(c);
      }
    }
    return out;
  }

  await step(0.45, '木と岩を置いています');
  // ---- 自然物: 形の種類を少し作り、同じ形はまとめて描く ----
  const r = rng(seed + 99);
  const protos = {
    conifer: Array.from({ length: 6 }, () => conifer(r).geometry),
    broadleaf: Array.from({ length: 4 }, () => broadleaf(r).geometry),
    rock: Array.from({ length: 6 }, () => rock(r).geometry),
    grass: Array.from({ length: 4 }, () => grassTuft(r).geometry),
  };
  const rockSize = protos.rock.map((g) => { // 岩の形ごとの大きさ（当たり判定用）
    g.computeBoundingBox();
    const b = g.boundingBox;
    return { top: b.max.y, r: Math.max(b.max.x, -b.min.x, b.max.z, -b.min.z) * 0.8 };
  });
  // 木の形ごとの葉の広がり（当たり判定用）: 幹より外の点のうち一番低い所と、いちばん外の半径
  const leafSize = (g) => {
    const p = g.attributes.position;
    let bottom = Infinity, r = 0;
    for (let k = 0; k < p.count; k++) {
      const d = Math.hypot(p.getX(k), p.getZ(k));
      if (d > 0.3) { bottom = Math.min(bottom, p.getY(k)); r = Math.max(r, d); }
    }
    return { bottom, r: r * 0.6 }; // ギザギザのすそと円すいの細さのぶん、少し内側
  };
  const leaves = { conifer: protos.conifer.map(leafSize), broadleaf: protos.broadleaf.map(leafSize) };
  const items = Object.fromEntries(Object.entries(protos).map(([k, v]) => [k, v.map(() => [])]));
  const spawn = gen.spawn;
  const nrm = new THREE.Vector3();
  const choppable = []; // 叩いて壊せる木と岩。形ごとのまとめた描画ができてから resources に登録する
  const add = (kind, x, z, s) => {
    if (Math.hypot(x - spawn.x, z - spawn.z) < 5) return; // スタート地点のまわりはあける
    const i = Math.floor(r() * items[kind].length), rot = r() * Math.PI * 2;
    if (kind === 'conifer' || kind === 'broadleaf') { // 木: まっすぐ、根元を埋める
      const y = trunkBase(terrain, x, z);
      choppable.push({ kind: 'tree', proto: kind, i, index: items[kind][i].length, x, y, z, s, rot, r: 0.35 * s, h: 2.2 * s,
        collider: addCollider(x, z, 0.25 * s, y + TREE_TOP), leafCollider: leafCollider(x, z, y, s, leaves[kind][i]) });
      items[kind][i].push({ x, y, z, rot, s });
      return;
    }
    // 岩と草: 斜面に合わせて傾ける
    const y = terrain.heightAt(x, z), q = tiltQuat(groundNormal(terrain, x, z, 0.25, nrm), rot);
    if (kind === 'rock') {
      choppable.push({ kind: 'rock', proto: kind, i, index: items[kind][i].length, x, y, z, r: rockSize[i].r * s, h: rockSize[i].top * s,
        size: rockSize[i].r * s, collider: addCollider(x, z, rockSize[i].r * s, y + rockSize[i].top * s) });
    }
    items[kind][i].push({ x, y, z, s, q });
  };
  // 木と岩: 区域ごとに決まった数（islands.md「資源の量」）。木は森の濃い所にかたまる。残骸のまわり（12m）はあける
  const C = gen.def.counts, W = gen.def.wreck, away = (x, z, d) => Math.hypot(x - spawn.x, z - spawn.z) > d && Math.hypot(x - W.x, z - W.z) > 9;
  const trees = pickSpots({ r, terrain, gen, want: C.tree, gap: 2.5, weight: (x, z) => 0.1 + Math.max(0, gen.forest(x, z)) ** 2,
    ok: (x, z, t) => t.min >= 1.5 && t.max - t.min <= 0.5 && away(x, z, 12) && !colliders(x, z, 1).length });
  for (const p of trees) add(p.zone === 'G' ? 'broadleaf' : p.zone === 'F' && r() < 0.5 ? 'broadleaf' : 'conifer', p.x, p.z, 0.8 + r() * 0.5);
  // 木の密集地帯: 円の中に間を詰めて植える。真ん中ほど大きい木。広葉樹と針葉樹は密集地帯ごとにかたよらせる
  for (const g of gen.def.groves) {
    const mix = r(), placed = [];
    for (let k = 0; k < g.n * 8 && placed.length < g.n; k++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * g.r, x = g.x + Math.cos(a) * d, z = g.z + Math.sin(a) * d, t = terrain.tileAt(x, z);
      if (!t || t.min < 1.5 || t.max - t.min > 0.5 || gen.inSpot(x, z) || placed.some((q) => Math.hypot(q.x - x, q.z - z) < 1.9) || colliders(x, z, 0.8).length) continue;
      placed.push({ x, z });
      add(r() < mix ? 'broadleaf' : 'conifer', x, z, 0.9 + (1 - d / g.r) * 0.5 + r() * 0.25);
    }
  }
  const rocks = pickSpots({ r, terrain, gen, want: C.rock, gap: 4,
    ok: (x, z, t) => t.min > SEA && t.max - t.min <= 1 && away(x, z, 12) && !colliders(x, z, 1.2).length });
  for (const p of rocks) add('rock', p.x, p.z, p.zone === 'Q' || p.zone === 'H' ? 0.8 + r() * 0.8 : 0.6 + r() * 0.7);
  // 草: 砂浜・水・坂のほかの平らな所（数は決めない。植物繊維になる）
  for (let tz = 0; tz < ISLAND; tz++) for (let tx = 0; tx < ISLAND; tx++) {
    const x = -half + tx + 0.2 + r() * 0.6, z = -half + tz + 0.2 + r() * 0.6, t = terrain.tileAt(x, z);
    if (t.min >= 1.5 && t.max - t.min <= 0.5 && r() < 0.45) add('grass', x, z, 0.8 + r() * 0.5);
  }
  const grass = createGrassCover(), meshes = {};
  for (const [kind, list] of Object.entries(items)) {
    meshes[kind] = list.map((it, i) => {
      const m = instanced(protos[kind][i], it, { double: kind === 'grass', shadow: kind !== 'grass' });
      group.add(m);
      if (kind === 'grass') grass.addInstanced(m, it);
      return m;
    });
  }
  const resources = createResources();
  // 広葉樹の幹の分かれ目の高さ（形ごと）: 幹の真ん中の線の上で一番高い点。鳥の巣を置く
  const crotch = protos.broadleaf.map((g) => {
    const p = g.attributes.position;
    let y = 0;
    for (let k = 0; k < p.count; k++) if (Math.hypot(p.getX(k), p.getZ(k)) < 0.05) y = Math.max(y, p.getY(k));
    return y;
  });
  const nestTrees = [];
  for (const c of choppable) {
    const e = resources.add({ ...c, parts: [{ mesh: meshes[c.proto][c.i], index: c.index }] });
    if (c.proto === 'broadleaf') nestTrees.push({ e, crotch: crotch[c.i] });
  }
  // 草: 素手で刈ると植物繊維（照準で当てる）
  items.grass.forEach((list, i) => list.forEach((it, k) =>
    resources.add({ kind: 'grass', x: it.x, y: it.y, z: it.z, r: 0.2, h: 0.3, parts: [{ mesh: meshes.grass[i], index: k }] })));

  // 叩いて壊した物を片付ける（survival.md「採り方」）。木とヤシは倒れる動きのあとに消える（切り株は残さない）。
  // 竹やぶ・鉱石の岩は戻る（REGROW）。onHarvest: いっしょに消す物（木の上の巣など）。dx, dz: 倒れる向き
  // instant: セーブから戻すとき。倒れる動きなしで消す
  function harvest(e, dx, dz, instant = false) {
    for (const c of [e.collider, e.leafCollider, ...(e.colliders ?? [])]) if (c) removeCollider(c);
    e.onHarvest?.();
    if (REGROW[e.kind]) return resources.regrow(e, REGROW[e.kind], () => { // 戻ったら当たり判定も戻す
      if (e.collider) e.collider = addCollider(e.collider.x, e.collider.z, e.collider.r, e.collider.top);
      if (e.colliders) e.colliders = e.colliders.map((c) => addCollider(c.x, c.z, c.r, c.top));
    });
    if (e.kind === 'tree' || e.kind === 'palm') return instant ? resources.remove(e) : resources.fall(e, dx, dz);
    resources.remove(e);
  }

  await step(0.7, '浜と森を整えています');
  // ---- スタート地点のたき火（人工物のルールで置く） ----
  const fire = campfire(r);
  const fp = placeProp(fire.root, terrain, spawn.x + 2, spawn.z - 2);
  if (fp) {
    group.add(fire.root);
    addCollider(fp.x, fp.z, fire.radius, fp.y + fire.height);
  }

  // ---- 墜落の浜: 飛行機の残骸と、木箱・救急箱・水のボトル・設計図 ----
  placeWreck({ group, terrain, at: gen.def.wreck, addCollider, removeCollider, resources });
  for (const t of gen.def.traces) placeLoot({ group, terrain, resources }, t.item, t.x, t.z); // AI の跡の設計図
  // ---- 落ちている枝・石と、木の実の茂み（拾える物・採れる物） ----
  placePickups({ group, terrain, gen, colliders, addCollider, resources, seed });
  // ---- 倒木・竹やぶ・ヤシの木・キノコ・浜の火打ち石・鳥の巣（島とは別の乱数） ----
  const { slingTargets } = placeFlora({ group, terrain, gen, colliders, addCollider, resources, seed, nestTrees });
  await step(0.88, '鉱石と滝を置いています');
  // ---- 鉱石の岩（岩場・峡谷・高台）と、高台の崖の滝 ----
  placeOres({ group, terrain, gen, colliders, addCollider, resources, seed });
  const fall = placeWaterfall(group, terrain, gen.def.pond, rng(seed + 7), gen.def.fall);
  await step(0.92, 'スポットを整えています');
  // ---- スポット（islands.md「スポット」）: 区域の中の、行く理由のある場所 ----
  const spots = placeSpots({ group, terrain, gen, colliders, addCollider, removeCollider, resources, slingTargets, seed });
  // ---- 石の密集地・石の鉱床・砂の塊・砂の鉱床（登録は島の物の最後。islands.md「鉱石の密集地」） ----
  const stone = placeStone({ group, terrain, gen, colliders, addCollider, resources, seed });
  // 自動化の設計図（islands.md「設計図の置き場所」）: セーブの番号をずらさないよう、島の物の最後に登録する
  for (const t of gen.def.autoTraces ?? []) placeLoot({ group, terrain, resources }, t.item, t.x, t.z, true, t.dy);
  const planting = createPlanting({ group, terrain, colliders, addCollider, resources, protos, leafCollider, leaves, treeTop: TREE_TOP });

  resources.freeze(); // ここまでが島の最初の姿。あとの変化はセーブで記録する
  const rings = colliderRings(all);
  group.add(rings);

  // セーブから戻す: 消えている物 [[番号, 秒]] を消す・あとで戻す設定にする
  function restoreHidden(hidden) {
    const base = resources.base;
    for (const [k, t] of hidden) {
      const e = base[k];
      if (!e) continue;
      if (t < 0) harvest(e, 0, 0, true);
      else if (REGROW[e.kind]) { harvest(e, 0, 0); resources.retime(e, t); }
      else resources.regrow(e, t);
    }
  }

  let gridOn = false, debugOn = false, lastT = null, things = null;
  return {
    id, name: gen.def.name, zoneAt: gen.zoneAt, // 区域（下絵の字）
    spots: gen.def.spots, // スポット（islands.md「スポット」）
    pools: spots.pools, fogAt: spots.fogAt, // 泉の水面（竹筒で汲める）、霧の濃さ（立ち枯れの沼）
    caveDim: deco.caves.caveDim, inCave: deco.caves.inCave, // 洞窟の奥にいる度合い（sky.setDim）・洞窟の上か
    group, terrain, colliders, spawn, resources, harvest, restoreHidden, dummyAt: gen.def.dummy, spawns: gen.def.spawns, wild: gen.def.wild,
    fires: fp ? [fp] : [], // 回復が速くなるたき火（建てたたき火は別に数える）
    slingTargets, // スリングの的（巣の卵、ヤシの実）
    planting, // 苗木を植える・育つ
    stone, // 石の密集地・砂の鉱床の場所（確認用）
    cover: (boxes, d) => grass.cover(boxes, d),
    catCenter: new THREE.Vector3(spawn.x - 2.5, 0, spawn.z - 3),
    fog: [12, VIEW - 15], // かすみ: 12m から薄くかかり、115m で見えなくなる
    setGrid(on) { gridOn = on; },
    setDebug(on) { debugOn = on; rings.visible = on; },
    update(t, cam) {
      sea.userData.update(t);
      spots.update(t, cam);
      if (Math.hypot(cam.x - gen.def.pond.x, cam.z - gen.def.pond.z) < VIEW) fall.update(t);
      fire.update(t);
      resources.update(t - (lastT ?? t));
      lastT = t;
      for (const c of chunks) {
        const dist = Math.hypot(cam.x - c.x, cam.z - c.z);
        c.mesh.visible = dist < VIEW + CHUNK;
        c.grid.visible = gridOn && dist < NEAR_VIEW + CHUNK;
        c.steep.visible = debugOn && dist < NEAR_VIEW + CHUNK;
      }
      // 木・岩・草などの区画（nature.js instanced）も、かすみの奥は描かない
      if (!things) { things = []; group.traverse((o) => { if (o.parent?.isChunked) things.push(o); }); }
      for (const m of things) {
        const b = m.boundingSphere.center;
        m.visible = Math.hypot(cam.x - b.x, cam.z - b.z) - m.boundingSphere.radius < VIEW;
      }
    },
  };
}
