// 風の演出（enemies.md「ブンブン」）: 白い風の線。ためで吸い込む・集まる、放出で輪が広がる・後ろへ流れる、風の弾の渦と跡
// 線は細い帯（いつもカメラのほうへ面を向ける）。両端は細く、出はじめと消えぎわは薄い。色は palette.js の fx.wind
import * as THREE from 'three';
import { P } from '../style/palette.js';

const MAX = 320, N = 7; // 線の数、1 本の点の数
const ALPHA = 0.95;
const rand = (a, b) => a + Math.random() * (b - a);
const UP = new THREE.Vector3(0, 1, 0);

export function createWindFx({ scene, camera }) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(MAX * N * 2 * 3), col = new Float32Array(MAX * N * 2 * 4);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4)); // 4 つ目が濃さ
  const idx = [];
  for (let s = 0; s < MAX; s++) for (let i = 0; i < N - 1; i++) {
    const a = (s * N + i) * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  scene.add(mesh);
  const list = [];
  const pals = P.fx.wind.map((c) => new THREE.Color(c));
  const cam = new THREE.Vector3(), pts = Array.from({ length: N }, () => new THREE.Vector3()), _t = new THREE.Vector3(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

  // 弧: c のまわり（軸 ax）を回る。r 半径（vr で変わる）、a 角度（va で回る）、len 弧の長さ（ラジアン）、h 軸の向きの高さ、w 太さ
  function arc(c, ax, o) {
    if (list.length >= MAX) list.shift();
    const u = new THREE.Vector3().crossVectors(ax, Math.abs(ax.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP).normalize();
    const v = new THREE.Vector3().crossVectors(ax, u);
    list.push({ type: 'arc', c: c.clone(), ax: ax.clone(), u, v, vr: 0, va: 0, h: 0, vh: 0, w: 0.04, len: 0.8, ...o, max: o.life, col: pals[Math.floor(Math.random() * pals.length)] });
  }
  // 直線: p から d の向きへ len の長さ。v の速さで d の向きへ動く
  function line(p, d, o) {
    if (list.length >= MAX) list.shift();
    list.push({ type: 'line', p: p.clone(), d: d.clone().normalize(), v: 0, w: 0.035, len: 0.6, ...o, max: o.life, col: pals[Math.floor(Math.random() * pals.length)] });
  }
  const at = (m, up = 0) => new THREE.Vector3(m.x, m.y + up, m.z);
  const fwd = (m) => new THREE.Vector3(Math.sin(m.yaw), 0, Math.cos(m.yaw));
  const left = (m) => new THREE.Vector3(Math.cos(m.yaw), 0, -Math.sin(m.yaw));
  const many = (rate, dt) => Math.floor(rate * dt + Math.random()); // 1 秒に rate 本

  return {
    count: () => list.length,
    clear() { list.length = 0; },
    // ため（u: 0〜1 の進み）。a.kind で形を変える
    charge(m, a, u, dt) {
      if (a.kind === 'spin') { // 届く範囲（半径 area）のふちから、渦を巻いて吸い込まれる
        for (let i = many(22 + 40 * u, dt); i > 0; i--) {
          const r = a.area * rand(0.9, 1.05), life = rand(0.5, 0.65);
          arc(at(m), UP, { r, vr: -r / life * 0.75, a: rand(0, 6.28), va: rand(2, 3), len: rand(0.7, 1.1), h: rand(-0.5, 0.4), vh: rand(0.1, 0.5), w: rand(0.02, 0.035), life });
        }
      } else if (a.kind === 'shot') { // 画面の前に風が集まって渦になる
        const f = fwd(m), c = at(m).addScaledVector(f, 0.42);
        for (let i = many(40 + 60 * u, dt); i > 0; i--) {
          const r = rand(0.35, 0.6) * (1 - u * 0.5), life = rand(0.2, 0.3);
          arc(c, f, { r, vr: -r / life * 0.8, a: rand(0, 6.28), va: rand(9, 13), len: rand(0.8, 1.3), w: rand(0.015, 0.03), life });
        }
      } else if (a.dash) { // ファンから後ろへ風が流れる
        const b = fwd(m).negate(), l = left(m);
        for (let i = many(30 + 40 * u, dt); i > 0; i--) {
          const side = Math.random() < 0.5 ? 1 : -1;
          const p = at(m, 0.04 + rand(-0.08, 0.08)).addScaledVector(l, side * 0.31 + rand(-0.12, 0.12)).addScaledVector(b, 0.1);
          line(p, b, { v: rand(5, 8), len: rand(0.3, 0.55), w: rand(0.015, 0.03), life: rand(0.18, 0.28) });
        }
      }
    },
    // 放出の瞬間
    release(m, a) {
      if (a.kind === 'spin') { // 白い風の輪が外へ広がる（届く範囲まで）
        for (let i = 0; i < 34; i++) {
          const life = rand(0.35, 0.5), r0 = rand(0.3, 0.7);
          arc(at(m), UP, { r: r0, vr: (a.area + 0.4 - r0) / life, a: i / 34 * 6.28, va: rand(5, 7), len: rand(0.6, 1), h: rand(-0.35, 0.4), vh: rand(-0.2, 0.3), w: rand(0.05, 0.08), life });
        }
      } else if (a.kind === 'shot') { // 撃った口から短い輪
        const f = fwd(m), c = at(m).addScaledVector(f, 0.4);
        for (let i = 0; i < 10; i++) arc(c, f, { r: 0.1, vr: 1.6, a: i / 10 * 6.28, va: 4, len: 0.7, w: 0.025, life: 0.25 });
      }
    },
    // 攻撃の間（毎フレーム）
    during(m, a, dt) {
      if (a.kind === 'spin') { // 体のまわりを風が回る
        for (let i = many(60, dt); i > 0; i--) arc(at(m), UP, { r: rand(0.45, 0.9), vr: rand(1, 3), a: rand(0, 6.28), va: rand(12, 16), len: rand(0.9, 1.5), h: rand(-0.2, 0.3), w: rand(0.03, 0.06), life: rand(0.2, 0.3) });
      } else if (a.dash) { // 後ろに風の線が残る
        const b = fwd(m).negate(), l = left(m);
        for (let i = many(45, dt); i > 0; i--) line(at(m, rand(-0.15, 0.2)).addScaledVector(l, rand(-0.4, 0.4)), b, { v: rand(0.5, 1.5), len: rand(0.6, 1.1), w: rand(0.02, 0.04), life: rand(0.2, 0.32) });
      }
    },
    // 風の弾の渦と跡（mobShot.js）。p: 弾の位置、d: 飛ぶ向き
    swirl(p, d, dt) {
      for (let i = many(55, dt); i > 0; i--) arc(p, d, { r: rand(0.2, 0.3), vr: 0.3, a: rand(0, 6.28), va: rand(12, 16), len: rand(1.2, 1.8), w: rand(0.02, 0.035), life: rand(0.18, 0.28) });
    },
    // 弾が消える: 小さく散る
    puff(p) {
      for (let i = 0; i < 14; i++) {
        const ax = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
        arc(p, ax, { r: 0.1, vr: rand(1.5, 2.5), a: rand(0, 6.28), va: rand(3, 6), len: 0.9, w: 0.03, life: rand(0.2, 0.3) });
      }
    },
    update(dt) {
      camera.getWorldPosition(cam);
      for (let i = list.length - 1; i >= 0; i--) if ((list[i].life -= dt) <= 0) list.splice(i, 1);
      list.forEach((s, n) => {
        if (s.type === 'arc') {
          s.r = Math.max(0.02, s.r + s.vr * dt); s.a += s.va * dt; s.h += s.vh * dt;
          for (let i = 0; i < N; i++) {
            const t = s.a - s.len * i / (N - 1);
            pts[i].copy(s.c).addScaledVector(s.u, Math.cos(t) * s.r).addScaledVector(s.v, Math.sin(t) * s.r).addScaledVector(s.ax, s.h);
          }
        } else {
          s.p.addScaledVector(s.d, s.v * dt);
          for (let i = 0; i < N; i++) pts[i].copy(s.p).addScaledVector(s.d, -s.len * i / (N - 1));
        }
        const fade = Math.sin(Math.PI * (1 - s.life / s.max)) * ALPHA; // 出はじめと消えぎわは薄い
        for (let i = 0; i < N; i++) {
          _t.subVectors(pts[Math.min(N - 1, i + 1)], pts[Math.max(0, i - 1)]);
          _v.subVectors(cam, pts[i]);
          _s.crossVectors(_t, _v).normalize();
          const end = Math.sin(Math.PI * (i + 0.5) / N); // 両端は細く薄い
          _s.multiplyScalar(s.w * end);
          const j = ((n * N + i) * 2) * 3, q = ((n * N + i) * 2) * 4;
          pos[j] = pts[i].x + _s.x; pos[j + 1] = pts[i].y + _s.y; pos[j + 2] = pts[i].z + _s.z;
          pos[j + 3] = pts[i].x - _s.x; pos[j + 4] = pts[i].y - _s.y; pos[j + 5] = pts[i].z - _s.z;
          for (let k = 0; k < 2; k++) { col[q + k * 4] = s.col.r; col[q + k * 4 + 1] = s.col.g; col[q + k * 4 + 2] = s.col.b; col[q + k * 4 + 3] = fade * end; }
        }
      });
      geo.setDrawRange(0, list.length * (N - 1) * 6);
      geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = true;
    },
  };
}
