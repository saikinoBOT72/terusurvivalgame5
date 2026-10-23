// 物理の世界（docs/rules/physics.md）: 物と乗り物だけ。プレイヤーは自前の仕組みのまま
// 固定の歩みで進め、表示は前の歩みとの間をなめらかにつなぐ。世界ごとに 1 つ作る。
import * as THREE from 'three';
const _q = new THREE.Quaternion();
import RAPIER from '@dimforge/rapier3d-compat';
import { createStaticSync, hullDesc } from './colliders.js';
import { applyWater, LOST } from './buoyancy.js';

const STEP = 1 / 60;    // 1 歩の時間（秒）
const MAX_STEPS = 4;    // 1 フレームで進める最大の歩数
const SYNC = 0.25;      // 相手の入れ替えと上限の確認の間隔（秒）
const MAX_AWAKE = 50;   // 動いている物の上限
const FAR = 40;         // これより遠い物は止める（m）

let R = null;
const ready = RAPIER.init().then(() => { R = RAPIER; });

// world: その世界（terrain、colliders、group）、structures: 建築パーツ
export function createPhysics(world, structures) {
  let pw = null, statics = null, acc = 0, syncT = 0, alpha = 0, debugLines = null;
  const bodies = new Set(); // {body, mesh, r, prev: {p, q}, frozen}
  const pending = [];       // 準備ができる前に足された物
  const kinematics = new Set(); // 乗り物の物理 {body, colliders, shapes}
  const stepHooks = [], frameHooks = [];
  ready.then(() => {
    pw = new R.World({ x: 0, y: -9.81, z: 0 });
    statics = createStaticSync(R, pw, world, structures);
    for (const f of pending.splice(0)) f();
  });

  // 物理の物を足す。shape: {ball: 半径} か {box: [半幅x, 半幅y, 半幅z]} か {hulls: [凸の形の点 Float32Array…], r: 大きさ}
  // density: 水を 1 とした重さ。water: false なら水の力をかけない（小舟は自分でかける）
  // mesh（体の中心が原点の形）があれば、その位置と向きを毎フレーム書き換える。なければ onMove(位置, 向き) を呼ぶ
  // onLost: 遠くへ流れて消えたとき。返す物（h）で消す
  function add({ mesh = null, onMove = null, onLost = null, shape, pos, vel = null, rot = null, density = 1, water = true }) {
    const volume = shape.ball ? (4 / 3) * Math.PI * shape.ball ** 3 : shape.box ? 8 * shape.box[0] * shape.box[1] * shape.box[2] : 0;
    const h = { mesh, onMove, onLost, shape, volume, water, r: shape.ball ?? shape.r ?? Math.hypot(...shape.box), body: null, frozen: false, awake: true,
      prev: { p: new THREE.Vector3(), q: new THREE.Quaternion() }, p: new THREE.Vector3(), q: new THREE.Quaternion() };
    if (mesh) {
      mesh.position.set(pos.x, pos.y, pos.z);
      if (rot) mesh.quaternion.copy(rot);
      world.group.add(mesh);
    }
    bodies.add(h);
    const make = () => {
      if (!bodies.has(h)) return;
      // 転がり続けないよう、回る勢いを少しずつ弱める。箱（やり・棒など長い物）は強く: ぶつかった相手まで回し続けないように
      const bd = R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setCcdEnabled(true).setAngularDamping(shape.ball ? 1 : 4).setLinearDamping(0.1);
      if (rot) bd.setRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w });
      if (vel) bd.setLinvel(vel.x, vel.y, vel.z);
      h.body = pw.createRigidBody(bd);
      const cds = shape.hulls ? shape.hulls.map((v) => R.ColliderDesc.convexHull(v)).filter(Boolean)
        : [shape.ball ? R.ColliderDesc.ball(shape.ball) : R.ColliderDesc.cuboid(...shape.box)];
      for (const cd of cds) pw.createCollider(cd.setDensity(density).setFriction(0.8), h.body);
      keep(h);
      syncT = SYNC; // 次のフレームの初めに、まわりの相手を入れる
    };
    if (pw) make(); else pending.push(make);
    return h;
  }
  // 乗り物の物理（Rapier の「動かす物」）: 上に乗った物を摩擦で運ぶ。動きは乗り物の側で決めて moveTo で渡す
  // setShapes: 乗り物の中の座標の凸の角柱 [{pts, y0, y1}]
  const yawQ = (a) => ({ x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) });
  function kinematic(pos, yaw) {
    const k = { body: null, colliders: [], shapes: [] };
    const build = () => {
      if (!k.body) return;
      for (const c of k.colliders) pw.removeCollider(c, false);
      k.colliders = k.shapes.map((sh) => hullDesc(R, sh)).filter(Boolean).map((d) => pw.createCollider(d.setFriction(1), k.body));
      for (const h of bodies) if (h.body && !h.frozen) h.body.wakeUp(); // 形が変わったら、乗っていた物を起こす
    };
    const make = () => {
      if (!kinematics.has(k)) return;
      k.body = pw.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y, pos.z).setRotation(yawQ(yaw)));
      build();
    };
    kinematics.add(k);
    if (pw) make(); else pending.push(make);
    return {
      setShapes(list) { k.shapes = list; build(); },
      moveTo(x, y, z, a) {
        if (!k.body) return;
        k.body.setNextKinematicTranslation({ x, y, z });
        k.body.setNextKinematicRotation(yawQ(a));
      },
      dispose() { if (kinematics.delete(k) && k.body) pw.removeRigidBody(k.body); },
    };
  }

  function remove(h) {
    if (!bodies.delete(h)) return;
    if (h.mesh) world.group.remove(h.mesh);
    if (h.body) pw.removeRigidBody(h.body);
  }
  // 相手を入れる範囲: 物の大きさ + 次の入れ替えまでに進む距離
  const at = (h) => { const t = h.body.translation(), v = h.body.linvel(); return { x: t.x, z: t.z, r: h.r + Math.hypot(v.x, v.y, v.z) * SYNC * 1.5 }; };
  function keep(h) { // 今の位置を「前の歩み」として覚える
    const t = h.body.translation(), q = h.body.rotation();
    h.prev.p.set(t.x, t.y, t.z);
    h.prev.q.set(q.x, q.y, q.z, q.w);
  }

  // 遠い物と、上限を超えた物を止める。近づいた止めた物は動かす
  function limit(focus) {
    const awake = [];
    for (const h of bodies) {
      if (!h.body) continue;
      const t = h.body.translation(), d = Math.hypot(t.x - focus.x, t.z - focus.z);
      if (d > FAR) { if (!h.body.isSleeping()) h.body.sleep(); h.frozen = true; continue; }
      if (h.frozen) { h.frozen = false; h.body.wakeUp(); }
      if (!h.body.isSleeping()) awake.push([d, h]);
    }
    awake.sort((a, b) => a[0] - b[0]);
    for (const [, h] of awake.slice(MAX_AWAKE)) { h.body.sleep(); h.frozen = true; }
  }

  // dt: フレームの時間、focus: プレイヤーの位置（遠い物を止めるため）
  function update(dt, focus) {
    if (!pw) return;
    if ((syncT += dt) >= SYNC) {
      syncT = 0;
      const list = [...bodies].filter((h) => h.body);
      for (const p of statics.sync(list.map(at))) { // 消えた相手の上の物を起こす
        for (const h of list) if (!h.frozen && Math.hypot(at(h).x - p.x, at(h).z - p.z) < 3) h.body.wakeUp();
      }
      limit(focus);
    }
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < MAX_STEPS) {
      for (const f of stepHooks) f(STEP);
      for (const h of bodies) {
        if (!h.body) continue;
        keep(h);
        if (h.water && !h.body.isSleeping()) applyWater(h, world.terrain);
      }
      pw.step();
      acc -= STEP;
      n++;
    }
    if (n === MAX_STEPS) acc = 0;
    alpha = acc / STEP;
    for (const h of [...bodies]) {
      if (!h.body) continue;
      const awake = !h.body.isSleeping();
      if (!awake && !h.awake) continue; // 眠っている物は、眠った直後に 1 回だけ書く
      h.awake = awake;
      const t = h.body.translation(), q = h.body.rotation();
      if (Math.hypot(t.x, t.z) > LOST) { remove(h); h.onLost?.(); continue; }
      h.p.set(t.x, t.y, t.z).lerp(h.prev.p, 1 - alpha);
      h.q.set(q.x, q.y, q.z, q.w);
      h.q.slerpQuaternions(h.prev.q, _q.copy(h.q), alpha); // 使い回し（毎フレーム作らない）
      if (h.mesh) { h.mesh.position.copy(h.p); h.mesh.quaternion.copy(h.q); }
      h.onMove?.(h.p, h.q);
    }
    for (const f of frameHooks) f(alpha, dt);
    if (debugLines?.visible) drawDebug();
  }

  // H キー: 物理の形を線で出す
  function setDebug(on) {
    if (on && !debugLines) {
      debugLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ vertexColors: true }));
      debugLines.frustumCulled = false;
      world.group.add(debugLines);
    }
    if (debugLines) debugLines.visible = on;
  }
  function drawDebug() {
    const { vertices, colors } = pw.debugRender();
    const g = debugLines.geometry;
    g.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  }

  function dispose() {
    for (const h of [...bodies]) remove(h);
    kinematics.clear();
    stepHooks.length = frameHooks.length = 0;
    if (debugLines) { world.group.remove(debugLines); debugLines.geometry.dispose(); }
    ready.then(() => { pw?.free(); pw = null; });
  }

  function stats() {
    let awake = 0, sleeping = 0, frozen = 0;
    for (const h of bodies) {
      if (!h.body) continue;
      if (h.frozen) frozen++;
      else if (h.body.isSleeping()) sleeping++;
      else awake++;
    }
    return { awake, sleeping, frozen, statics: statics?.count ?? 0, ready: !!pw };
  }

  return {
    add, remove, kinematic, update, setDebug, dispose, stats, resetTerrain: () => statics?.resetTerrain(), get bodies() { return bodies; },
    onStep: (f) => stepHooks.push(f),   // 固定の歩みごと（物を動かす前）: f(歩みの秒)
    onFrame: (f) => frameHooks.push(f), // フレームごと（表示をつないだあと）: f(前の歩みとの間 0〜1, フレームの秒)
  };
}
