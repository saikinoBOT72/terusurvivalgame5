// 墜落島のスポットに物を置く（docs/rules/islands.md「スポット」、形は objects.md「墜落島のスポットの物」、中身は survival.md）
// 共通の置き方（ctx）と、浜・水辺・草原・林のスポット（1〜11）。12〜15・21 は spotsWest.js、北のスポット（岩場・峡谷・高台・深い森）は spotsNorth.js
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { rng, makeMesh, shape, pick } from '../style/lowpoly.js';
import { instanced, rock } from './nature.js';
import { mushrooms, barrel } from './props.js';
import { birdNest, bambooGrove } from './flora.js';
import { crop } from './crops.js';
import { crate } from './wreck.js';
import { bedGeo } from '../build/furniture.js';
import { itemGeometry } from '../survival/itemShapes.js';
import { DAY_LEN } from './dayNight.js';
import { container, fishingBoat, junkPile, clayBank, scrapBits } from './spotBeach.js';
import { tentRuin, deadFire, flagPole, notebook } from './spotCamp.js';
import { deadTree, stoneWall, giantTree } from './spotNature.js';
import { robotHeap } from './spotAI.js';
import { placeNorth } from './spotsNorth.js';
import { placeWest } from './spotsWest.js';

const _q = new THREE.Quaternion(), _e = new THREE.Euler();
const between = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// base: { group, terrain, gen, addCollider, removeCollider, resources, slingTargets, seed }
// 返す { update(t, cam), pools: 泉の水面 [{ x, z, r, y }]（竹筒で汲める）, fogAt(x, z): 霧の濃さ 0〜1 }
export function placeSpots(base) {
  const { group, terrain, gen, addCollider, resources } = base;
  const r = rng(base.seed + 500), H = (x, z) => terrain.heightAt(x, z), updates = [], pools = [];
  const S = Object.fromEntries(gen.def.spots.map((s) => [s.n, s]));
  const ctx = {
    ...base, r, H, S, updates, pools,
    at: (s, d, a) => ({ x: s.x + Math.cos(a) * d, z: s.z + Math.sin(a) * d }), // スポットの中心から距離 d・向き a
    cave: (n) => gen.def.caves.find((c) => c.spot === n), // スポット n の洞窟の設計（islandMap.js）
    // 洞窟の中の床の高さ: 設計のいちばん近い床の 1.5m 上から下を探す
    floor(x, z, n) {
      let best = null;
      for (const p of ctx.cave(n).parts) for (const [px, pz, py] of p.path ?? [p.room]) {
        const d = Math.hypot(px - x, pz - z);
        if (!best || d < best.d) best = { d, y: py };
      }
      return terrain.floorAt(x, best.y + 1.5, z);
    },
    // 動かない物を置く。o: { yaw, rx, rz（傾き）, dy（地面からの高さ）, y（高さをそのまま）, double, shadow }
    mesh(geo, x, z, o = {}) {
      const m = geo.isObject3D ? geo : makeMesh(geo, { double: o.double, shadow: o.shadow ?? true });
      m.position.set(x, o.y ?? H(x, z) + (o.dy ?? 0), z);
      m.rotation.set(o.rx ?? 0, o.yaw ?? 0, o.rz ?? 0, 'YXZ');
      group.add(m);
      return m;
    },
    // 同じ形をまとめて置く。list: [{ x, z, y?, dy?, rot?, s?, rx?, rz? }]
    many(geo, list, o = {}) {
      for (const it of list) {
        it.y ??= H(it.x, it.z) + (it.dy ?? 0); it.s ??= 1;
        it.q = _q.setFromEuler(_e.set(it.rx ?? 0, it.rot ?? r() * Math.PI * 2, it.rz ?? 0, 'YXZ')).clone();
      }
      const m = instanced(geo, list, o);
      group.add(m);
      return m;
    },
    // 拾う・採る・叩く物（kind は gather.js の TAKES か HITS）。rad, h: 照準で当てる円柱。extra: 物ごとに足す項目
    take(kind, geo, list, { rad = 0.3, h = 0.3, collide = 0, top = 0.5, ...o } = {}) {
      const m = ctx.many(geo, list, o);
      return list.map((it, k) => resources.add({ kind, x: it.x, y: it.y, z: it.z, r: rad * it.s, h: h * it.s, parts: [{ mesh: m, index: k }],
        ...(collide ? { collider: addCollider(it.x, it.z, collide * it.s, it.y + top * it.s) } : {}), ...(it.extra ?? {}) }));
    },
    // 開ける箱（1 回だけ。中身 store を持ち物へ）。geo が null なら見た目なし（コンテナ・樽など、開けても消えない物）
    box(geo, x, z, store, { kind = 'crate', y, rad = 0.4, h = 0.6, yaw = r() * 6.28 } = {}) {
      y ??= H(x, z);
      const parts = [];
      if (geo) {
        const m = new THREE.InstancedMesh(geo, makeMesh(geo).material, 1);
        m.setMatrixAt(0, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1)));
        m.castShadow = m.receiveShadow = true;
        group.add(m);
        parts.push({ mesh: m, index: 0 });
      }
      return resources.add({ kind, x, y, z, r: rad, h, parts, store: store.map(([id, n]) => ({ id, n })) });
    },
    col: (x, z, rad, top) => addCollider(x, z, rad, top),
    // 竹の迷路: 中心から rIn〜rOut の輪に竹やぶを詰めて植える。path(d, a) が true の所は道として空ける。竹は斧で切れて 2 日で戻る
    bamboo(s, rIn, rOut, path) {
      const protos = [0, 1, 2].map(() => bambooGrove(r)), lists = [[], [], []];
      for (let d = rIn; d <= rOut; d += 1.7) for (let a = 0; a < Math.PI * 2; a += 1.7 / d) {
        const aa = a + (r() - 0.5) * 0.2, dd = d + (r() - 0.5) * 0.5;
        if (path(dd, aa)) continue;
        lists[Math.floor(r() * 3)].push({ ...ctx.at(s, dd, aa), dy: -0.05, s: 0.9 + r() * 0.3 });
      }
      lists.forEach((list, i) => {
        if (!list.length) return;
        const m = ctx.many(protos[i], list);
        list.forEach((it, k) => resources.add({ kind: 'bamboo', x: it.x, y: it.y, z: it.z, r: 0.6, h: 3 * it.s, parts: [{ mesh: m, index: k }],
          colliders: [addCollider(it.x, it.z, 0.55, it.y + 4)] }));
      });
    },
    // 長い物の当たり判定: (x, z) から向き yaw（+x が 0）へ長さ len を、半径 rad の円で埋める
    colLine(x, z, yaw, len, rad, top) {
      for (let d = -len / 2 + rad; d <= len / 2 - rad + 0.01; d += rad * 1.4) addCollider(x + Math.cos(yaw) * d, z - Math.sin(yaw) * d, rad, top);
    },
  };

  // ---- 1 墜落地点: 残骸の機首から上がる煙（帰り道の目印） ----
  {
    const w = gen.def.wreck, cs = Math.cos(w.rot), sn = Math.sin(w.rot), x = w.x - 4.2 * sn, z = w.z - 4.2 * cs;
    const geo = new THREE.IcosahedronGeometry(1, 0), puffs = [];
    for (let k = 0; k < 9; k++) {
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: P.fx.smoke[2], transparent: true, depthWrite: false, flatShading: true }));
      m.userData.moves = true; // 毎フレーム動く（island.js が行列を止めない）
      group.add(m);
      puffs.push(m);
    }
    const y0 = H(x, z) + 1.2;
    updates.push((t) => puffs.forEach((m, k) => {
      const p = (t * 0.045 + k / puffs.length) % 1; // 0 = 出たところ、1 = 消える
      m.position.set(x + p * 6 + Math.sin(t * 0.3 + k) * 0.6, y0 + p * 30, z - p * 2);
      m.scale.setScalar(0.6 + p * 3.2);
      m.rotation.set(k + t * 0.1, k * 2, 0);
      m.material.opacity = Math.min(1, p * 8) * (1 - p) * 0.55;
      m.material.color.set(p < 0.25 ? P.fx.smoke[1] : P.fx.smoke[2]);
    }));
  }

  // ---- 2 流れ着いた貨物: 波打ち際のコンテナ 3（半分砂に埋まる。1 つは扉が半開き） ----
  {
    const s = S[2];
    [[-6, 2, 0.4, 'rust', false, [['rope', 4], ['wood', 3]]], [3, -2, -0.8, 'blue', true, [['scrap', 3], ['screw', 2]]], [8, 5, 2.2, 'green', false, [['meal', 2], ['waterBottle', 2]]]]
      .forEach(([dx, dz, yaw, kind, open, store], k) => {
        const x = s.x + dx, z = s.z + dz, y = H(x, z) - 0.3 - k * 0.1;
        ctx.mesh(container(r, kind, open), x, z, { y, yaw, rz: [0.1, -0.05, 0.14][k], rx: 0.05 });
        ctx.colLine(x, z, yaw, 2.4, 0.62, y + 1.15);
        const dx2 = Math.cos(yaw) * 1.45, dz2 = -Math.sin(yaw) * 1.45; // 扉の前（+x の向き）
        ctx.box(null, x + dx2, z + dz2, store, { kind: 'container', y: y + 0.2, rad: 0.7, h: 1 });
      });
  }

  // ---- 3 カニの集積所: 浜の西の岩陰。岩 3 つで囲んだくぼみにガラクタの山、奥に箱、まわりに叩けるガラクタ 4 ----
  {
    const s = S[3];
    [[-4.5, -3, 2.4], [0, -5.5, 2.8], [4.5, -3.2, 2.2]].forEach(([dx, dz, size]) => {
      const m = rock(r, size), x = s.x + dx, z = s.z + dz;
      ctx.mesh(m, x, z, { dy: -0.3, yaw: m.rotation.y });
      ctx.col(x, z, size * 1.0, H(x, z) + size * 0.6);
    });
    ctx.mesh(junkPile(r), s.x, s.z - 1.5, { dy: -0.1, yaw: 0.4 });
    ctx.col(s.x, s.z - 1.5, 1.2, H(s.x, s.z - 1.5) + 0.8);
    ctx.box(crate(r), s.x + 1.6, s.z - 3.2, [['junkAmmo', 6], ['screw', 3]]);
    ctx.take('junk', scrapBits(r), [[-2.5, 1], [2.6, 0.8], [-1, 2.6], [1.2, 2.2]].map(([dx, dz]) => ({ x: s.x + dx, z: s.z + dz })), { rad: 0.5, h: 0.4 });
  }

  // ---- 4 河口の干潟: 粘土の露頭（川のほうを向く）と、転がった粘土の塊 4 ----
  {
    const s = S[4];
    ctx.mesh(clayBank(r), s.x, s.z - 2, { dy: -0.4, yaw: -0.6 });
    ctx.col(s.x, s.z - 2, 1.8, H(s.x, s.z - 2) + 1.2);
    ctx.take('clayLump', itemGeometry('clay'), [[-2, 1.5], [1.5, 1.8], [3, 0], [-0.5, 2.8]].map(([dx, dz]) => ({ x: s.x + dx, z: s.z + dz, s: 1.4 })), { rad: 0.25, h: 0.2 });
  }

  // ---- 5 沈んだ漁船: 入り江の浅瀬に 25 度横倒し。船の中の箱は水の中 ----
  {
    const s = S[5], yaw = 0.6;
    ctx.mesh(fishingBoat(r), s.x, s.z, { y: -1.1, yaw });
    ctx.colLine(s.x, s.z, yaw, 6, 1.0, 0.6);
    ctx.box(crate(r), s.x + Math.sin(yaw) * 0.8, s.z + Math.cos(yaw) * 0.8, [['fishingRod', 1], ['rope', 3], ['fish', 2]], { y: Math.max(-1.6, H(s.x, s.z)) });
  }

  // ---- 6 竹林の奥のテント跡: 竹の迷路（輪の中に、うずまきの細い道だけ空ける）の真ん中の空き地 ----
  {
    const s = S[6];
    const tent = tentRuin(r);
    ctx.mesh(tent.cloth, s.x, s.z, { yaw: 0.3, double: true });
    ctx.mesh(tent.frame, s.x, s.z, { yaw: 0.3 });
    ctx.col(s.x, s.z, 1.3, H(s.x, s.z) + 1.6);
    ctx.mesh(deadFire(r), s.x + 1.2, s.z + 2.8);
    const tx = s.x - 2.6, tz = s.z + 1.6;
    ctx.mesh(crate(r), tx, tz, { yaw: 0.2 });
    ctx.col(tx, tz, 0.4, H(tx, tz) + 0.6);
    ctx.mesh(notebook(r), tx, tz, { dy: 0.6, yaw: 0.5 }); // 日記（読むのはステップ 10）
    const b = barrel(r);
    ctx.mesh(b, s.x - 2.8, s.z - 1.4, { yaw: 1 });
    ctx.box(null, s.x - 2.8, s.z - 1.4, [['seedPotato', 2], ['hempSeed', 2], ['fiber', 6]], { kind: 'barrel', rad: 0.45, h: 0.85 });
    ctx.col(s.x - 2.8, s.z - 1.4, 0.4, H(s.x - 2.8, s.z - 1.4) + 0.85);
    ctx.mesh(bedGeo(r), s.x + 2.6, s.z - 1.8, { yaw: 1.3 });
    ctx.mesh(flagPole(r), s.x + 3.2, s.z + 0.6, { yaw: 2 });
    ctx.bamboo(s, 8, 16, (d, a) => { // うずまきの道（幅 2.4m）: 外の入口から中へ回り込む
      const want = 0.4 + (16 - d) * 0.32;
      return Math.abs(Math.atan2(Math.sin(a - want), Math.cos(a - want))) * d < 1.2;
    });
  }

  // ---- 7 立ち枯れの沼: 灰白の立ち枯れの木 9、キノコ 8（霧は fogAt） ----
  {
    const s = S[7];
    for (let k = 0; k < 9; k++) {
      const a = k * 2.4 + r(), d = 3 + r() * 11, x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d;
      ctx.mesh(deadTree(r), x, z, { dy: -0.3, yaw: r() * 6.28, rz: (r() - 0.5) * 0.12 });
      ctx.col(x, z, 0.32, H(x, z) + 4);
    }
    ctx.take('mushroom', mushrooms(r), Array.from({ length: 8 }, () => ({ ...ctx.at(s, 2 + r() * 12, r() * 6.28), extra: { regrow: DAY_LEN } })), { rad: 0.25, h: 0.25, shadow: false });
  }

  // ---- 8 ロボの墓場: 窪地の真ん中に壊れたロボの山、まわりに叩けるガラクタ 6（死んだふりの採掘ロボは番人） ----
  {
    const s = S[8];
    ctx.mesh(robotHeap(r), s.x, s.z, { dy: -0.1, yaw: 0.7 });
    ctx.col(s.x, s.z, 2.0, H(s.x, s.z) + 1.0);
    ctx.take('junk', scrapBits(r), Array.from({ length: 6 }, (_, k) => ctx.at(s, 4 + r() * 4, k * 1.05 + r() * 0.4)), { rad: 0.5, h: 0.4 });
  }

  // ---- 9 石垣の畑跡: 半径 11m の石垣の輪（入口 2 つ）、中に野生のイモと麻 6 ずつ ----
  {
    const s = S[9], R = 11, n = Math.round((Math.PI * 2 * R) / 2.4);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      if (Math.abs(Math.sin((a - 0.3) / 2)) < 0.09 || Math.abs(Math.sin((a - 3.5) / 2)) < 0.09) continue; // 入口
      const x = s.x + Math.cos(a) * R, z = s.z + Math.sin(a) * R;
      ctx.mesh(stoneWall(r), x, z, { dy: -0.12, yaw: -a + Math.PI / 2 });
      ctx.col(x, z, 1.0, H(x, z) + 0.8);
    }
    for (const [kind, crp] of [['wildPotato', 'potato'], ['wildHemp', 'hemp']]) {
      const list = Array.from({ length: 6 }, () => ({ ...ctx.at(s, 1.5 + r() * 7.5, r() * 6.28), dy: -0.02, s: 1.1 }));
      ctx.take(kind, crop(r, crp, 2, 1), list, { rad: 0.3, h: crp === 'hemp' ? 0.7 : 0.3, double: true });
    }
  }

  // ---- 10 風の丘の一本木: 丘の上の巨木。枝の上に鳥の巣 4（卵はスリングの的） ----
  {
    const s = S[10], tree = giantTree(r), yaw = 0.8, y = H(s.x, s.z) - 0.3;
    ctx.mesh(tree.geo, s.x, s.z, { y, yaw });
    ctx.col(s.x, s.z, 1.4, y + 9);
    const nest = birdNest(r), rot = new THREE.Matrix4().makeRotationY(yaw);
    const list = tree.crotches.map((c) => { const p = c.clone().applyMatrix4(rot); return { x: s.x + p.x, z: s.z + p.z, y: y + p.y - 0.1, rot: r() * 6.28 }; });
    ctx.many(nest.nest, list);
    const eggs = ctx.many(nest.eggs, list.map((it) => ({ ...it })), { shadow: false });
    list.forEach((it, k) => base.slingTargets.push(resources.track({ x: it.x, y: it.y - 0.05, z: it.z, r: 0.3, h: 0.3, parts: [{ mesh: eggs, index: k }],
      drops: () => [['egg', between(1, 2)], ['feather', 1]], regrow: DAY_LEN * 2 })));
  }

  // ---- 11 犬のねぐら: 窪地に踏み固めた寝床（枯れ草の平たい輪）4 と、叩けるガラクタ 3 ----
  {
    const s = S[11];
    ctx.many(dogBed(r), Array.from({ length: 4 }, (_, k) => ({ ...ctx.at(s, 2.5 + r() * 2, k * 1.6 + r()), dy: -0.04 })), { shadow: false });
    ctx.take('junk', scrapBits(r), Array.from({ length: 3 }, (_, k) => ctx.at(s, 6 + r() * 2, k * 2.1 + 0.5)), { rad: 0.5, h: 0.4 });
  }

  placeWest(ctx); // 12〜15・21（spotsWest.js）
  placeNorth(ctx);
  return {
    pools,
    update(t, cam) { for (const u of updates) u(t, cam); },
    // 霧の濃さ（0〜1）: 立ち枯れの沼（7）の中で濃い
    fogAt(x, z) { const s = S[7], d = Math.hypot(x - s.x, z - s.z); return Math.max(0, Math.min(1, (24 - d) / 10)); },
  };
}

// 犬の寝床: 踏み固めた枯れ草の平たい輪（中が少しくぼむ）
function dogBed(r) {
  const prof = [[0, 0.02], [0.5, 0.05], [0.75, 0.12], [0.9, 0.04], [0.92, 0]].map(([x, y]) => new THREE.Vector2(x, y));
  return paintGeo(new THREE.LatheGeometry(prof, 8), r);
}
const paintGeo = (g, r) => shape(g, () => pick(r, [P.dryGrass[0], P.dryGrass[1], P.dryGrass[2]]), r, { jit: 0.04 });
