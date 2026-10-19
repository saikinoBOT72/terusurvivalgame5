// 小舟の動き方（docs/rules/physics.md「小舟」）: 本物の物理。底の区画ごとに水が押し、波で揺れ、重さで傾く
// 物理の物（Rapier の動く物）を 1 つ使い、水の力・こぐ力は自分でかける
import * as THREE from 'three';
import { PARTS } from '../build/parts.js';

const G = 9.81;
const L = 3.5, W = 1.5, H = 0.55;   // 長さ・幅・底から甲板までの高さ（world/props.js の小さな船）
const DENSITY = 0.35;               // 舟の重さ（水を 1 として）
const ROW = 1.2, TURN = 0.9;        // こぐ加速（m/s²）、回す加速（rad/s²）
const KEEL = 3;                     // 横すべりを弱める（竜骨のかわり）
const RIDER = 0.08;                 // 座ったプレイヤーの重さ
const SEAT = new THREE.Vector3(-0.4, H + 0.17, 0); // 腰かけ板
const UP = new THREE.Vector3(0, 1, 0);
// 舟の幅の半分（x の位置で。前はとがる）。world/props.js の boat と同じ形
const half = (x) => { const u = 2 * x / L; return (W / 2) * (u > 0 ? Math.max(0.02, 1 - u * u) ** 0.6 : 1 - 0.3 * u ** 4); };
// 海の見た目の波（world/nature.js の water）と同じ形を 2 倍にした高さ
export const wave = (x, z, t) => 2 * (Math.sin(x * 1.3 + t * 0.9) * 0.025 + Math.cos(z * 1.7 + t * 0.7) * 0.025);

// 物理の形: 底は細く、甲板は広い凸の形 1 つ
const HULL = new Float32Array([-1.75, -1, 0, 0.9, 1.7].flatMap((x) => [x, 0, half(x) * 0.6, x, 0, -half(x) * 0.6, x, H, half(x), x, H, -half(x)]));
// 底の区画 [x, z, 面積]: 0.7m × 0.4m ごと、舟の形の内側だけ
const COLS = [];
for (let x = -1.4; x < 1.6; x += 0.7) for (const z of [-0.4, 0, 0.4]) if (Math.abs(z) < half(x) * 0.85) COLS.push([x, z, 0.7 * 0.4]);

// ctx: {world, t（地形）, ps（プレイヤーの state）}
export function boatMotion(ctx) {
  const { world, t, ps } = ctx;
  const q = new THREE.Quaternion(), a = new THREE.Vector3(), b = new THREE.Vector3(), up = new THREE.Vector3();
  const toW = (v, local, out) => out.copy(local).applyQuaternion(v.quat).add(v.pos);

  return {
    attach(v, x, z, yaw) {
      v.pos = new THREE.Vector3(x, t.waterLevel - 0.1, z);
      v.quat = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
      v.y = v.pos.y;
      v.input = { fwd: 0, turn: 0 };
      v.up = 1;
      v.h = world.physics.add({
        shape: { hulls: [HULL], r: L / 2 + 0.2 }, pos: v.pos, rot: v.quat, density: DENSITY, water: false,
        onMove: (p, r) => { v.pos.copy(p); v.quat.copy(r); },
      });
    },
    detach(v) { world.physics.remove(v.h); },
    refresh(v) {
      const p = v.st.list.find((x) => PARTS[x.type].boat);
      if (!p) return false;
      v.shapes = p.shapes; // 歩いているプレイヤーとの当たり判定（向きだけ合わせる）
      v.radius = L / 2 + 0.2;
      v.floors = 0;
      return true;
    },

    // 固定の歩みごと: 底の区画ごとに水の力、波、横すべり、座った人の重さ、こぐ力
    step(v, dt) {
      const body = v.h.body;
      if (!body) return;
      const riding = ps.ride?.v === v;
      if (body.isSleeping()) { // 近くにいる間は、波で揺らすため起こしておく
        if (!riding && Math.hypot(ps.x - v.pos.x, ps.z - v.pos.z) > 30) return;
        body.wakeUp();
      }
      const tr = body.translation(), r = body.rotation();
      q.set(r.x, r.y, r.z, r.w);
      const pos = new THREE.Vector3(tr.x, tr.y, tr.z), m = body.mass();
      body.resetForces(false);
      body.resetTorques(false);
      up.copy(UP).applyQuaternion(q);
      let wet = 0;
      for (const [x, z, area] of COLS) { // 区画の柱（底から甲板まで）が水につかった分だけ上へ押す
        a.set(x, 0, z).applyQuaternion(q).add(pos);
        b.copy(a).addScaledVector(up, H);
        const surf = t.waterLevel + wave(a.x, a.z, ctx.time), lo = Math.min(a.y, b.y), hi = Math.max(a.y, b.y);
        const frac = hi - lo < 1e-3 ? (surf > lo ? 1 : 0) : Math.min(1, Math.max(0, (surf - lo) / (hi - lo)));
        if (!frac) continue;
        wet += frac;
        body.addForceAtPoint({ x: 0, y: frac * H * area * G, z: 0 }, a.addScaledVector(up, (frac * H) / 2), false);
      }
      wet = Math.min(1, (wet / COLS.length) * 3); // 少しでもつかっていれば水の中として扱う
      body.setLinearDamping(0.05 + 0.6 * wet);
      body.setAngularDamping(0.3 + 1.5 * wet);
      const f = a.set(1, 0, 0).applyQuaternion(q).setY(0).normalize(), vel = body.linvel();
      const side = vel.x * -f.z + vel.z * f.x; // 横すべり
      const F = { x: 0, y: 0, z: 0 };
      F.x += f.z * side * KEEL * m * wet; F.z += -f.x * side * KEEL * m * wet;
      if (riding) {
        body.addForceAtPoint({ x: 0, y: -RIDER * G, z: 0 }, b.copy(SEAT).applyQuaternion(q).add(pos), false);
        F.x += f.x * v.input.fwd * ROW * (m + RIDER) * wet;
        F.z += f.z * v.input.fwd * ROW * (m + RIDER) * wet;
        body.addTorque({ x: 0, y: v.input.turn * TURN * m * (L * L + W * W) / 12 * wet, z: 0 }, false);
      }
      body.addForce(F, false);
    },
    // フレームごと: 表示の姿勢（物理の物の、前の歩みとの間）
    frame(v) {
      a.set(1, 0, 0).applyQuaternion(v.quat);
      v.shown = { x: v.pos.x, z: v.pos.z, yaw: Math.atan2(-a.z, a.x) };
      v.y = v.pos.y;
      v.up = up.copy(UP).applyQuaternion(v.quat).y;
      v.capsized = v.up < 0.5;
      v.group.position.copy(v.pos);
      v.group.quaternion.copy(v.quat);
    },

    seat: (v, out = new THREE.Vector3()) => toW(v, SEAT, out), // 腰かけ板の世界の位置
    // 降りられる所の候補（舟の中の座標）: 左右、前後
    exits: (v) => [[-0.4, 1.3], [-0.4, -1.3], [2.4, 0], [-2.4, 0]].map(([x, z]) => toW(v, a.set(x, 0, z), new THREE.Vector3())),
    // ひっくり返った舟を起こす: 向きだけ残して水平に、少し持ち上げる
    right(v) {
      const body = v.h.body;
      if (!body) return;
      const yaw = v.shown.yaw;
      body.setTranslation({ x: v.pos.x, y: t.waterLevel + 0.1, z: v.pos.z }, true);
      body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    },
  };
}
