// 犬の演出（enemies.md「ガラクタ犬」）: 歯の火花、噛む瞬間の白透明の牙（dog.js）、前脚でかく土、泥の玉の跡としぶき、跳ぶ・着地の土、つんのめりと怒りの火花
// 攻撃の fx: 'mud' のとき brain.js から呼ばれる（windFx.js と同じ charge・release・during）。どの攻撃かは a.style（bite | pounce | mud）
// 泥と土のかけらは低分割の球。重力で落ち、地面で止まって小さくなって消える。色は palette.js の fx.mud・fx.dust
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { particles, thin } from '../style/lowpoly.js';

const MAX = 260;
const G = 9.8;
const rand = (a, b) => a + Math.random() * (b - a);

export function createMudFx({ scene, fx = null }) {
  let terrain = null;
  const ground = (x, z) => (terrain ? Math.max(terrain.groundNear(x, z), terrain.waterLevel) : 0);
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ flatShading: true }), MAX);
  mesh.count = 0; mesh.frustumCulled = false;
  scene.add(mesh);
  const list = [];
  const mud = P.fx.mud.map((c) => new THREE.Color(c)), dirt = P.fx.dust.map((c) => new THREE.Color(c));
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _p = new THREE.Vector3();

  // かけらを 1 つ。p: 位置、v: 速さ、s: 大きさ、life: 秒、cols: 色
  function bit(p, v, s, life, cols = mud) {
    if (thin()) return;
    if (list.length >= MAX * particles.k) list.shift();
    list.push({ p: p.clone(), v, s, life, max: life, c: cols[Math.floor(Math.random() * cols.length)], r: rand(0, 6), rest: false });
  }
  const fwd = (m) => new THREE.Vector3(Math.sin(m.yaw), 0, Math.cos(m.yaw));
  const many = (rate, dt) => Math.floor(rate * dt + Math.random());
  const sparksAt = (obj, n, sp) => { if (!obj?.parent) return; obj.getWorldPosition(_p); fx?.sparks(_p.clone(), n, sp); };
  // 前脚の先（地面の上）
  const paws = (m) => { const f = fwd(m); return new THREE.Vector3(m.x + f.x * 0.3, ground(m.x + f.x * 0.3, m.z + f.z * 0.3) + 0.03, m.z + f.z * 0.3); };
  // 地面から輪に飛ぶ土（跳ぶ・着地）
  function ring(m, n, sp) {
    const g = ground(m.x, m.z);
    for (let i = 0; i < n; i++) {
      const a = rand(0, 6.28), r = rand(0.15, 0.4);
      bit(new THREE.Vector3(m.x + Math.sin(a) * r, g + 0.04, m.z + Math.cos(a) * r), new THREE.Vector3(Math.sin(a) * sp * rand(0.5, 1), rand(1, 2.4), Math.cos(a) * sp * rand(0.5, 1)), rand(0.025, 0.045), rand(0.5, 0.8), Math.random() < 0.5 ? mud : dirt);
    }
  }

  return {
    count: () => list.length,
    clear() { list.length = 0; },
    setWorld(w) { terrain = w?.terrain ?? null; list.length = 0; },
    // ため（u: 0〜1 の進み）
    charge(m, a, u, dt) {
      if (a.style === 'bite') { // 口をガチガチ: 歯に火花（派手に）
        if (Math.random() < dt * 18) sparksAt(m.model.mouth, 3, 1.6);
      } else if (a.style === 'mud') { // 前脚で地面をかく: 土と泥が後ろ上へはねる
        const p = paws(m), b = fwd(m).multiplyScalar(-1);
        for (let i = many(26 + 30 * u, dt); i > 0; i--) bit(p, b.clone().multiplyScalar(rand(1, 2.2)).add(new THREE.Vector3(rand(-0.6, 0.6), rand(1.2, 2.4), rand(-0.6, 0.6))), rand(0.02, 0.04), rand(0.45, 0.7), Math.random() < 0.6 ? mud : dirt);
      } else if (a.style === 'pounce') { // 伏せて後ろ脚が地面をける: 後ろへ土
        const f = fwd(m), g = ground(m.x - f.x * 0.3, m.z - f.z * 0.3);
        for (let i = many(10 + 20 * u, dt); i > 0; i--) bit(new THREE.Vector3(m.x - f.x * 0.3, g + 0.03, m.z - f.z * 0.3), f.clone().multiplyScalar(-rand(0.8, 1.8)).add(new THREE.Vector3(rand(-0.5, 0.5), rand(0.6, 1.4), rand(-0.5, 0.5))), rand(0.018, 0.03), rand(0.35, 0.55), dirt);
      }
    },
    // 放出の瞬間（n: かみつきの何回目か）
    release(m, a, n = 0) {
      if (a.style === 'bite') { sparksAt(m.model.mouth, 20 + 10 * n, 3 + n); m.model.snapFangs?.(n); ring(m, 8 + 6 * n, 1.8 + 0.6 * n); } // 噛んだ: 歯の火花（3 倍）、白透明の牙がガチン、足もとの土（2 回目はさらに大きい）
      else if (a.style === 'pounce') ring(m, 14, 2.2); // 蹴って跳ぶ
      else if (a.style === 'mud') { // 前脚で泥をはね上げる（玉は mobShot.js）
        const p = paws(m), f = fwd(m);
        for (let i = 0; i < 16; i++) bit(p, f.clone().multiplyScalar(rand(2, 5)).add(new THREE.Vector3(rand(-1.2, 1.2), rand(1.5, 3.5), rand(-1.2, 1.2))), rand(0.025, 0.05), rand(0.5, 0.9));
      }
    },
    during() {},
    land(m) { ring(m, 18, 2.6); sparksAt(m.model.legAt, 8, 2.5); }, // 跳びかかりの着地（外した）: 土の輪と右前脚の火花
    stumble(m) { sparksAt(m.model.legAt, 9, 2.4); }, // 足の故障でつんのめる
    rage(m, dt) { if (Math.random() < dt * 3) sparksAt(m.model.mouth, 3, 0.8); }, // 怒り: 口から火花がこぼれる
    // 泥の玉: 通った跡にしずく、当たった所でしぶき
    trail(p, dt) { for (let i = many(30, dt); i > 0; i--) bit(p, new THREE.Vector3(rand(-0.3, 0.3), rand(-0.5, 0.3), rand(-0.3, 0.3)), rand(0.015, 0.03), rand(0.3, 0.5)); },
    splat(p) { for (let i = 0; i < 14; i++) { const a = rand(0, 6.28), sp = rand(1, 2.8); bit(p, new THREE.Vector3(Math.sin(a) * sp, rand(1, 2.6), Math.cos(a) * sp), rand(0.025, 0.05), rand(0.5, 0.9)); } },
    update(dt) {
      for (let i = list.length - 1; i >= 0; i--) if ((list[i].life -= dt) <= 0) list.splice(i, 1);
      list.forEach((b, i) => {
        if (!b.rest) {
          b.v.y -= G * dt;
          b.p.addScaledVector(b.v, dt);
          const g = ground(b.p.x, b.p.z) + b.s * 0.5;
          if (b.p.y < g) { b.p.y = g; b.rest = true; } // 地面に落ちて止まる
        }
        const sz = b.s * Math.min(1, b.life / 0.25) * (b.rest ? 1.3 : 1);
        mesh.setMatrixAt(i, _m.compose(b.p, _q.setFromEuler(_e.set(b.r, b.r * 1.7, 0)), _s.set(sz, b.rest ? sz * 0.45 : sz, sz)));
        mesh.setColorAt(i, b.c);
      });
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
  };
}
