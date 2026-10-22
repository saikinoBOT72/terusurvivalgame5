// 振りの軌跡と受け流しの閃光（docs/rules/weapons.md「武器の動きと演出」）。1人称の手と同じ場所（手の root の中）に描く
// 軌跡: 刃先とその少し手前の 2 点を毎回足して帯にする。古い所ほど薄く細い。ため攻撃は太く長く残る
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { glowMat } from '../style/lowpoly.js';

const MAX = 40, LIFE = 0.15, LIFE_HEAVY = 0.22;
const col = (hex) => new THREE.Color(hex);

export function createSwingFx(root) {
  // 帯: 点 MAX 組（刃先・手前）。色に透明度（4 つ目）を入れる
  const pos = new Float32Array(MAX * 2 * 3), rgba = new Float32Array(MAX * 2 * 4);
  const idx = [];
  for (let i = 0; i < MAX - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(rgba, 4));
  geo.setIndex(idx);
  const band = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  band.frustumCulled = false;
  band.renderOrder = 2;
  root.add(band);
  const white = col(P.fx.swing);
  const pts = []; // { tip, base, age }
  let life = LIFE;

  // 受け流し: 白い星形の閃光と、飛び散る火花
  const starGeo = new THREE.OctahedronGeometry(0.05, 0).scale(1, 1, 0.2);
  const starMat = new THREE.MeshBasicMaterial({ color: P.fx.swing, transparent: true, depthWrite: false });
  const star = new THREE.Mesh(starGeo, starMat);
  star.visible = false;
  root.add(star);
  const sparkGeo = new THREE.BoxGeometry(0.004, 0.004, 0.05).translate(0, 0, 0.025);
  const sparks = Array.from({ length: 8 }, (_, i) => {
    const m = new THREE.Mesh(sparkGeo, glowMat({ color: P.fx.spark[i % 3], transparent: true, depthWrite: false }));
    m.visible = false;
    root.add(m);
    return { m, v: new THREE.Vector3(), t: 0 };
  });
  let starT = 0;

  function draw() {
    const n = pts.length;
    for (let i = 0; i < MAX; i++) {
      const p = pts[Math.min(i, n - 1)];
      const k = n && i < n ? Math.max(0, 1 - p.age / life) * (i / Math.max(1, n - 1)) : 0; // 新しい点ほど濃い
      const tip = p?.tip, base = p?.base;
      for (let s = 0; s < 2; s++) {
        const q = s ? base : tip, j = i * 2 + s;
        if (q) { // 手前の点は刃先へ寄せて、古い所ほど細く
          const w = s ? 1 - 0.4 * (1 - k) : 0;
          pos[j * 3] = tip.x + (q.x - tip.x) * (s ? w : 0); pos[j * 3 + 1] = tip.y + (q.y - tip.y) * (s ? w : 0); pos[j * 3 + 2] = tip.z + (q.z - tip.z) * (s ? w : 0);
        }
        rgba[j * 4] = white.r; rgba[j * 4 + 1] = white.g; rgba[j * 4 + 2] = white.b;
        rgba[j * 4 + 3] = k * (s ? 0.15 : 0.75);
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    band.visible = n > 1;
  }

  return {
    // 振り始め: heavy は太く長く
    start(heavy) { pts.length = 0; life = heavy ? LIFE_HEAVY : LIFE; },
    // 刃先と手前の点（root の中の位置）
    add(tip, base) {
      if (pts.length >= MAX) pts.shift();
      pts.push({ tip: tip.clone(), base: base.clone(), age: 0 });
    },
    parry(at) {
      star.position.copy(at); star.visible = true; starT = 0.12;
      for (const s of sparks) {
        s.m.position.copy(at);
        s.v.set(Math.random() - 0.5, Math.random() - 0.3, (Math.random() - 0.7) * 0.6).normalize().multiplyScalar(1.2 + Math.random());
        s.m.lookAt(s.m.position.clone().add(s.v));
        s.m.visible = true; s.t = 0.25;
      }
    },
    update(dt) {
      for (const p of pts) p.age += dt;
      while (pts.length && pts[0].age >= life) pts.shift();
      draw();
      if (starT > 0) {
        starT -= dt;
        const k = Math.max(0, starT / 0.12);
        star.scale.setScalar(1 + (1 - k) * 2.5);
        star.rotation.z += dt * 6;
        starMat.opacity = k;
        star.visible = starT > 0;
      }
      for (const s of sparks) {
        if (s.t <= 0) continue;
        s.t -= dt;
        s.v.y -= 4 * dt;
        s.m.position.addScaledVector(s.v, dt);
        s.m.material.opacity = Math.max(0, s.t / 0.25);
        s.m.visible = s.t > 0;
      }
    },
  };
}
