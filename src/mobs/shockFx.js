// 採掘ロボの大きな演出（enemies.md「採掘ロボ」）: 地面に広がる衝撃波の輪、なぎ払いの三日月の斬撃の残像、排気管からの蒸気と黒煙の噴射
// rockFx.js の中から使う。輪と斬撃は光る半透明の板（加算）、噴射は低分割の球。色は palette.js の fx.shock・fx.steam・fx.smoke
import * as THREE from 'three';
import { P } from '../style/palette.js';

const RINGS = 8, SLASHES = 4, PUFFS = 220;
const rand = (a, b) => a + Math.random() * (b - a);

export function createShockFx({ scene }) {
  const glowMat = (color) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const add = (geo, color) => { const m = new THREE.Mesh(geo, glowMat(color)); m.visible = false; m.frustumCulled = false; m.renderOrder = 3; scene.add(m); return m; };
  // 輪: 地面に寝かせた細い輪（半径 1）を広げる。斬撃: 前の半円の帯（体の左から右へ）
  const ringGeo = new THREE.RingGeometry(0.82, 1, 40, 1).rotateX(-Math.PI / 2);
  const slashGeo = new THREE.RingGeometry(0.9, 2.6, 24, 1, Math.PI * 1.05, Math.PI * 0.9).rotateX(-Math.PI / 2);
  const slashCore = new THREE.RingGeometry(1.9, 2.5, 24, 1, Math.PI * 1.05, Math.PI * 0.9).rotateX(-Math.PI / 2);
  const rings = Array.from({ length: RINGS }, (_, i) => ({ mesh: add(ringGeo, P.fx.shock[i % 2 ? 2 : 0]), t: 0 }));
  const slashes = Array.from({ length: SLASHES }, () => ({ mesh: add(slashGeo, P.fx.shock[2]), core: add(slashCore, P.fx.shock[0]), t: 0 }));
  // 噴射の煙
  const puffMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ flatShading: true, transparent: true, opacity: 0.75, depthWrite: false }), PUFFS);
  puffMesh.count = 0; puffMesh.frustumCulled = false;
  scene.add(puffMesh);
  const puffs = [];
  const steam = P.fx.steam.map((c) => new THREE.Color(c)), smoke = P.fx.smoke.map((c) => new THREE.Color(c));
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();

  return {
    clear() { for (const r of rings) r.t = 0; for (const s of slashes) s.t = 0; puffs.length = 0; },
    // 衝撃波の輪: (x, y, z) から半径 R まで secs 秒で広がって消える
    ring(x, y, z, R, secs = 0.4) {
      const r = rings.find((o) => o.t <= 0) ?? rings[0];
      Object.assign(r, { t: secs, max: secs, R });
      r.mesh.position.set(x, y + 0.06, z);
    },
    // なぎ払いの斬撃の残像: m の前に、腰の高さで 0.32 秒
    slash(m, y) {
      const s = slashes.find((o) => o.t <= 0) ?? slashes[0];
      Object.assign(s, { t: 0.32, max: 0.32 });
      for (const o of [s.mesh, s.core]) { o.position.set(m.x, y, m.z); o.rotation.set(0.12, m.yaw, 0); }
    },
    // 噴射: p から dir の向きへ n 個（dark: 黒煙を混ぜる割合）
    jet(p, dir, n, dark = 0.3, sp = 3) {
      for (let i = 0; i < n; i++) {
        if (puffs.length >= PUFFS) puffs.shift();
        const v = dir.clone().multiplyScalar(sp * rand(0.6, 1.2)).add(new THREE.Vector3(rand(-0.5, 0.5), rand(-0.2, 0.6), rand(-0.5, 0.5)));
        const life = rand(0.5, 0.9);
        puffs.push({ p: p.clone(), v, s: rand(0.05, 0.1), life, max: life, c: (Math.random() < dark ? smoke : steam)[Math.floor(Math.random() * 3)], r: rand(0, 6) });
      }
    },
    update(dt) {
      for (const r of rings) {
        if (r.t <= 0) { r.mesh.visible = false; continue; }
        r.t -= dt;
        const u = 1 - Math.max(0, r.t) / r.max, k = 1 - (1 - u) ** 3; // はじめ速く広がる
        r.mesh.visible = true;
        r.mesh.scale.setScalar(0.3 + (r.R - 0.3) * k);
        r.mesh.material.opacity = 0.9 * (1 - u);
      }
      for (const s of slashes) {
        const on = s.t > 0;
        s.mesh.visible = s.core.visible = on;
        if (!on) continue;
        s.t -= dt;
        const u = 1 - Math.max(0, s.t) / s.max;
        s.mesh.scale.setScalar(0.92 + 0.15 * u); s.core.scale.setScalar(0.92 + 0.15 * u);
        s.mesh.material.opacity = 0.8 * (1 - u * u); s.core.material.opacity = 1 - u * u; // はじめは濃く、最後に速く消える
      }
      for (let i = puffs.length - 1; i >= 0; i--) if ((puffs[i].life -= dt) <= 0) puffs.splice(i, 1);
      puffs.forEach((f, i) => {
        f.v.multiplyScalar(Math.exp(-dt * 3)); f.v.y += dt * 0.8; // すぐ遅くなって、少し上る
        f.p.addScaledVector(f.v, dt);
        const a = 1 - f.life / f.max, sz = f.s * (1 + a * 2.5) * Math.min(1, f.life / 0.25);
        puffMesh.setMatrixAt(i, _m.compose(f.p, _q.setFromEuler(_e.set(f.r, f.r * 1.3, 0)), _s.set(sz, sz, sz)));
        puffMesh.setColorAt(i, f.c);
      });
      puffMesh.count = puffs.length;
      puffMesh.instanceMatrix.needsUpdate = true;
      if (puffMesh.instanceColor) puffMesh.instanceColor.needsUpdate = true;
    },
  };
}
