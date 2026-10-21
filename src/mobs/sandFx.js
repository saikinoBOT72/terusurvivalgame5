// カニの演出（enemies.md「カニ」）: 指先の火花（はさみ打ちのため）、挟んだ所の砂しぶき、踏ん張る・かく足もとの砂、横ばい突進の砂、
// つんのめりの砂、排水口の水のしずく（逃げる間はしぶき）。攻撃の fx: 'sand' のとき brain.js から呼ばれる（mudFx.js と同じ charge・release・during・land）。
// どの攻撃かは a.style（pinch | double | rush）。敵の行の fx: 'sand' で tick が毎フレーム呼ばれる。色は palette.js の fx.sand・fx.splash
import * as THREE from 'three';
import { P } from '../style/palette.js';

const MAX = 260;
const G = 9.8;
const rand = (a, b) => a + Math.random() * (b - a);

export function createSandFx({ scene, fx = null }) {
  let terrain = null;
  const ground = (x, z) => (terrain ? Math.max(terrain.groundNear(x, z), terrain.waterLevel) : 0);
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ flatShading: true }), MAX);
  mesh.count = 0; mesh.frustumCulled = false;
  scene.add(mesh);
  const list = [];
  const sand = P.fx.sand.map((c) => new THREE.Color(c)), water = P.fx.splash.map((c) => new THREE.Color(c));
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _p = new THREE.Vector3();

  // 粒を 1 つ。p: 位置、v: 速さ、s: 大きさ、life: 秒、cols: 色（水は地面で弾けてすぐ消える）
  function bit(p, v, s, life, cols = sand) {
    if (list.length >= MAX) list.shift();
    list.push({ p: p.clone(), v, s, life, max: life, c: cols[Math.floor(Math.random() * cols.length)], r: rand(0, 6), rest: false, wet: cols === water });
  }
  const fwd = (m) => new THREE.Vector3(Math.sin(m.yaw), 0, Math.cos(m.yaw));
  const many = (rate, dt) => Math.floor(rate * dt + Math.random());
  const at = (obj) => { if (!obj?.parent) return null; obj.getWorldPosition(_p); return _p.clone(); };
  const onGround = (x, z) => new THREE.Vector3(x, ground(x, z) + 0.03, z);
  // 地面の一点から、向き d（なければまわり）へ砂を n 粒
  function spray(p, n, d, sp, up = [1, 2.2]) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, 6.28), v = d ? d.clone().multiplyScalar(sp * rand(0.5, 1)).add(new THREE.Vector3(rand(-0.6, 0.6), 0, rand(-0.6, 0.6))) : new THREE.Vector3(Math.sin(a) * sp * rand(0.4, 1), 0, Math.cos(a) * sp * rand(0.4, 1));
      v.y = rand(...up);
      bit(p, v, rand(0.014, 0.03), rand(0.45, 0.75));
    }
  }
  // 足もと（体のまわり 0.3m）から砂
  const feet = (m, n, sp) => { for (let i = 0; i < n; i++) { const a = rand(0, 6.28); spray(onGround(m.x + Math.sin(a) * 0.3, m.z + Math.cos(a) * 0.3), 1, null, sp, [0.5, 1.3]); } };

  return {
    count: () => list.length,
    clear() { list.length = 0; },
    setWorld(w) { terrain = w?.terrain ?? null; list.length = 0; },
    // ため（u: 0〜1 の進み）
    charge(m, a, u, dt) {
      if (a.style === 'pinch') { if (Math.random() < dt * 14) { const p = at(m.model.tips?.[0]); if (p) fx?.sparks(p, 2, 1.1); } } // 指をカチカチ: 指先に小さな火花
      else if (a.style === 'double') { if (u < 0.5) feet(m, many(30, dt), 0.8); } // 脚を踏ん張る: 足もとに砂
      else if (a.style === 'rush') { // 脚で砂を 2 回かく: 後ろ（突っ込む向きの逆）へ砂ぼこり
        const was = u < (m.digU ?? 1) ? -1 : m.digU; // 新しいため
        m.digU = u;
        if ([0.15, 0.6].some((x) => was < x && u >= x)) {
          const b = fwd(m).multiplyScalar(-1), side = new THREE.Vector3(b.z, 0, -b.x);
          spray(onGround(m.x - b.x * 0.2, m.z - b.z * 0.2), 22, b.clone().addScaledVector(side, rand(-0.4, 0.4)).normalize(), 2.4, [0.8, 2]);
        }
      }
    },
    // 放出の瞬間（n: 両ばさみの何回目か）
    release(m, a, n = 0) {
      const f = fwd(m);
      if (a.style === 'pinch') { // 振り下ろして挟む: はさみの先の地面から前へ砂が跳ねる
        const p = at(m.model.tips?.[0]);
        spray(onGround(p?.x ?? m.x + f.x * 0.5, p?.z ?? m.z + f.z * 0.5), 18, f, 2.2, [1.2, 2.6]);
        if (p) fx?.sparks(p, 4, 1.6);
      } else if (a.style === 'double') { // 左・右の順に挟む: そのはさみの先に火花と砂
        const p = at(m.model.tips?.[n]);
        if (p) { fx?.sparks(p, 5, 1.8); spray(onGround(p.x, p.z), 8, f, 1.4); }
      } else if (a.style === 'rush') feet(m, 14, 1.6); // 蹴り出す
    },
    during(m, a, dt) { // 横ばい突進: 脚が後ろへ砂を蹴る
      if (a.style !== 'rush') return;
      const b = (m.dir ? new THREE.Vector3(m.dir.x, 0, m.dir.z) : fwd(m)).multiplyScalar(-1);
      for (let i = many(60, dt); i > 0; i--) spray(onGround(m.x + rand(-0.2, 0.2), m.z + rand(-0.2, 0.2)), 1, b, 1.6, [0.6, 1.6]);
    },
    land(m) { const f = fwd(m); feet(m, 16, 2); spray(onGround(m.x + f.x * 0.3, m.z + f.z * 0.3), 12, f, 1.8, [0.8, 1.8]); }, // 外してつんのめる: 前へ砂
    // いつもの演出: 排水口から水のしずく。flee（海へ逃げる間）はしぶきが後ろ上へ
    tick(m, dt, flee) {
      if (m.state === 'down') return;
      const p = at(m.model.drain);
      if (!p) return;
      const b = fwd(m).multiplyScalar(-1);
      for (let i = many(flee ? 45 : 2.5, dt); i > 0; i--) {
        const v = flee ? b.clone().multiplyScalar(rand(0.6, 1.6)).add(new THREE.Vector3(rand(-0.5, 0.5), rand(1.2, 2.4), rand(-0.5, 0.5))) : new THREE.Vector3(rand(-0.05, 0.05), rand(-0.2, 0), rand(-0.05, 0.05)).addScaledVector(b, 0.15);
        bit(p, v, flee ? rand(0.014, 0.026) : rand(0.01, 0.016), rand(0.4, 0.7), water);
      }
    },
    update(dt) {
      for (let i = list.length - 1; i >= 0; i--) if ((list[i].life -= dt) <= 0) list.splice(i, 1);
      list.forEach((b, i) => {
        if (!b.rest) {
          b.v.y -= G * dt;
          b.p.addScaledVector(b.v, dt);
          const g = ground(b.p.x, b.p.z) + b.s * 0.5;
          if (b.p.y < g) { b.p.y = g; b.rest = true; if (b.wet) b.life = Math.min(b.life, 0.12); } // 地面に落ちて止まる（水はすぐしみこむ）
        }
        const sz = b.s * Math.min(1, b.life / 0.25) * (b.rest ? 1.3 : 1);
        mesh.setMatrixAt(i, _m.compose(b.p, _q.setFromEuler(_e.set(b.r, b.r * 1.7, 0)), _s.set(sz, b.rest ? sz * 0.4 : sz, sz)));
        mesh.setColorAt(i, b.c);
      });
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
  };
}
