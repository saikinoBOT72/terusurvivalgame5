// 銃の演出（weapons.md「銃の仕組み」）: 薬きょう（排莢口から右前・上へ飛び、1〜2 回はねて 3 秒で消える。最大 40 個）と、連射の銃口の煙
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { rng, MAT } from '../style/lowpoly.js';
import { robot as R } from '../mobs/parts.js';

const MAX = 40, LIFE = 3, G = 9.8;

// onLand(位置): 最初に地面に当たったとき（音）
export function createShellFx(scene, onLand = () => {}) {
  const geo = R.tube(rng(7), 0.0055, 0.039, P.copperMetal, { seg: 6 }); // 銅の小さな柱（7.62mm の薬きょう）
  const mesh = new THREE.InstancedMesh(geo, MAT.solid, MAX);
  mesh.count = 0; mesh.frustumCulled = false;
  scene.add(mesh);
  const list = [], m = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
  return {
    get count() { return list.length; },
    clear() { list.length = 0; mesh.count = 0; },
    // at: 排莢口の世界の位置、cam: カメラ（右・上・前の向き）
    spawn(at, cam) {
      if (list.length >= MAX) list.shift();
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion), up = new THREE.Vector3(0, 1, 0), fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      const v = right.multiplyScalar(1.8 + Math.random() * 0.8).addScaledVector(up, 1.4 + Math.random() * 0.6).addScaledVector(fwd, 0.4 + Math.random() * 0.3);
      list.push({ p: at.clone(), v, r: new THREE.Vector3(Math.random() * 6, Math.random() * 6, 0), w: new THREE.Vector3(15 + Math.random() * 10, 8, 20), t: 0, hits: 0, rest: false });
    },
    update(dt, terrain) {
      for (let i = list.length - 1; i >= 0; i--) {
        const s = list[i];
        if ((s.t += dt) > LIFE) { list.splice(i, 1); continue; }
        if (s.rest || !terrain) continue;
        s.v.y -= G * dt;
        s.p.addScaledVector(s.v, dt);
        s.r.addScaledVector(s.w, dt);
        const floor = terrain.floorAt(s.p.x, s.p.y + 0.3, s.p.z);
        if (s.p.y < terrain.waterLevel && floor < terrain.waterLevel) { list.splice(i, 1); continue; } // 水に落ちたら消える
        if (s.p.y <= floor + 0.005 && s.v.y < 0) {
          s.p.y = floor + 0.005;
          if (s.hits++ === 0) onLand(s.p);
          if (s.hits >= 2 || Math.abs(s.v.y) < 0.8) { s.rest = true; s.r.set(0, s.r.y, Math.PI / 2); continue; } // 寝かせて止まる
          s.v.y *= -0.35; s.v.x *= 0.5; s.v.z *= 0.5; s.w.multiplyScalar(0.5);
        }
      }
      list.forEach((s, k) => mesh.setMatrixAt(k, m.compose(s.p, qq.setFromEuler(e.set(s.r.x, s.r.y, s.r.z)), one)));
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// 連射の煙: 銃口から薄い煙が少し上って広がり、1.2 秒で消える
export function createSmokeFx(scene) {
  const geo = new THREE.IcosahedronGeometry(0.04, 0), pool = [];
  for (let i = 0; i < 16; i++) {
    const p = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: P.fx.tracerSmoke, transparent: true, opacity: 0, depthWrite: false }));
    p.visible = false;
    scene.add(p);
    pool.push({ m: p, t: 9 });
  }
  let next = 0;
  return {
    puff(at) {
      const s = pool[next++ % pool.length];
      s.t = 0; s.m.position.copy(at); s.m.visible = true;
      s.v = new THREE.Vector3((Math.random() - 0.5) * 0.1, 0.25 + Math.random() * 0.15, (Math.random() - 0.5) * 0.1);
    },
    update(dt) {
      for (const s of pool) {
        if (!s.m.visible) continue;
        const k = (s.t += dt) / 1.2;
        if (k >= 1) { s.m.visible = false; continue; }
        s.m.position.addScaledVector(s.v, dt);
        s.m.scale.setScalar(1 + k * 3);
        s.m.material.opacity = 0.22 * (1 - k);
      }
    },
  };
}
