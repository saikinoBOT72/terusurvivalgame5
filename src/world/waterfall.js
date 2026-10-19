// 滝（スポット 20。docs/rules/objects.md「最初の島の物」の滝を作り直し、2026-10-17）
// 幅 8m の本流と左右の細い筋 2 本。途中の岩棚で 1 度当たる 2 段。水の帯の模様は下へ流れる（面の色を時間で送る。画像は使わない）。
// 滝つぼに泡の輪としぶき、立ちのぼる水煙。下の段は少し透けて、裏の洞窟の口が水越しに見える。前は +z、原点は崖の面（洞窟の口）の真ん中・滝つぼの水面の高さ
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { pick, shape, merge, makeMesh } from '../style/lowpoly.js';

const FLOW = [P.water[2], P.water[3], P.water[4], P.water[3], P.water[3]]; // 流れの帯の色（上から下へ送る）
const _c = new THREE.Color();

// 水の帯: path [[y, z], ...]（上から下）にそって、幅 w（下ほど spread だけ広がる）の面
function curtain(path, w, spread, nx, rand) {
  const ny = (path.length - 1) * 3, pos = [];
  const at = (v) => { // 道のりの割合 v の点（線形）
    const f = v * (path.length - 1), i = Math.min(path.length - 2, Math.floor(f)), t = f - i;
    return [path[i][0] + (path[i + 1][0] - path[i][0]) * t, path[i][1] + (path[i + 1][1] - path[i][1]) * t];
  };
  const wob = Array.from({ length: (nx + 1) * (ny + 1) }, () => (rand() - 0.5) * 0.25);
  const P3 = (i, j) => { const v = j / ny, [y, z] = at(v), x = (i / nx - 0.5) * w * (1 + v * spread); return [x + wob[j * (nx + 1) + i] * 0.6, y, z + wob[j * (nx + 1) + i]]; };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = P3(i, j), b = P3(i + 1, j), c = P3(i + 1, j + 1), d = P3(i, j + 1);
    pos.push(...a, ...d, ...c, ...a, ...c, ...b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
  g.computeVertexNormals();
  return g;
}

// top: 崖の上の高さ（滝つぼの水面から）。返す { root, update(t) }
export function bigWaterfall(rand, top = 18.5) {
  const root = new THREE.Group(), ledge = top * 0.45;
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
  // 上の段: 崖の口から岩棚へ。下の段: 岩棚の先から滝つぼへ（洞窟の口の前）。左右の細い筋は上から下まで
  const sheets = [
    curtain([[top, 0.7], [top - 1.2, 1.1], [ledge + 3, 1.7], [ledge + 0.3, 2.0]], 7, 0.15, 8, rand),
    curtain([[ledge + 0.4, 2.5], [ledge - 1.5, 2.8], [2, 3.1], [0.1, 3.3]], 7.6, 0.2, 8, rand),
    curtain([[top - 0.5, 0.6], [ledge, 1.2], [0.1, 1.8]], 0.9, 0.5, 1, rand).translate(-4.6, 0, 0),
    curtain([[top - 1.5, 0.6], [top * 0.6, 1.0], [0.1, 1.7]], 0.7, 0.6, 1, rand).translate(4.9, 0, 0),
  ];
  const speed = [4.2, 5, 3.6, 3.2];
  const meshes = sheets.map((g) => { const m = new THREE.Mesh(g, mat); m.renderOrder = 2; root.add(m); return m; });
  const faces = sheets.map((g) => { // 面ごとの高さと、模様のずれ
    const p = g.attributes.position, out = [];
    for (let i = 0; i < p.count; i += 3) out.push({ y: (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, k: rand() * 0.8 });
    return out;
  });
  // 岩: 崖の口の岩、真ん中の岩棚（水が当たる）、滝つぼのふちの岩
  const rocks = [];
  const rk = (s, sx, sy, sz, x, y, z, det = 1) => rocks.push(shape(new THREE.IcosahedronGeometry(s, det).scale(sx, sy, sz).translate(x, y, z),
    (f) => (f.ny > 0.6 ? pick(rand, [P.moss[1], P.moss[2]]) : pick(rand, [P.rockBrown[1], P.rockBrown[2], P.rockGray[2]])), rand, { jit: s * 0.18 }));
  rk(2.2, 2.2, 0.5, 0.9, 0, top + 0.1, 0.2);
  rk(2.0, 2.3, 0.55, 1.0, 0.2, ledge - 0.2, 1.3);
  for (const [x, z, s] of [[-5.2, 3.4, 1.3], [5.4, 3.2, 1.1], [-3.8, 4.6, 0.8], [4.2, 4.8, 0.9]]) rk(s, 1.2, 0.7, 1, x, 0.2, z, 1);
  root.add(makeMesh(merge(rocks)));
  // 泡の輪と、しぶきのかたまり（揺れる）、立ちのぼる水煙
  const foamMat = new THREE.MeshLambertMaterial({ color: P.water[4], flatShading: true, transparent: true, opacity: 0.85 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.5, 4, 10).rotateX(Math.PI / 2).scale(1.1, 0.35, 0.7), foamMat);
  ring.position.set(0, 0.08, 4.2);
  root.add(ring);
  const blobs = Array.from({ length: 7 }, (_, k) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 + rand() * 0.35, 0), foamMat);
    m.position.set(-3.2 + k * 1.05, 0.2, 3.6 + rand() * 0.8);
    root.add(m);
    return { m, ph: rand() * 6.28 };
  });
  const ledgeSpray = Array.from({ length: 4 }, (_, k) => { // 岩棚に当たって散る白いかたまり
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), foamMat);
    m.position.set(-2.4 + k * 1.6, ledge + 0.2, 2.1);
    root.add(m);
    return { m, ph: rand() * 6.28 };
  });
  const mistMat = new THREE.MeshLambertMaterial({ color: P.water[4], flatShading: true, transparent: true, depthWrite: false });
  const mist = Array.from({ length: 6 }, (_, k) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), mistMat.clone()); root.add(m); return { m, k }; });

  let last = -1;
  return {
    root,
    update(t) {
      if (t - last < 1 / 30) return; // 30 回/秒で十分
      last = t;
      sheets.forEach((g, s) => {
        const col = g.attributes.color, f = faces[s];
        for (let i = 0; i < f.length; i++) {
          _c.set(FLOW[((Math.floor(f[i].y * 1.3 + t * speed[s] + f[i].k) % FLOW.length) + FLOW.length) % FLOW.length]);
          for (let j = 0; j < 3; j++) col.setXYZ(i * 3 + j, _c.r, _c.g, _c.b);
        }
        col.needsUpdate = true;
      });
      ring.scale.setScalar(1 + Math.sin(t * 2.3) * 0.04);
      for (const b of blobs) { b.m.position.y = 0.15 + Math.abs(Math.sin(t * 3 + b.ph)) * 0.35; b.m.rotation.y = t + b.ph; }
      for (const b of ledgeSpray) { b.m.position.y = ledge + 0.1 + Math.abs(Math.sin(t * 4 + b.ph)) * 0.45; b.m.scale.setScalar(0.7 + Math.abs(Math.sin(t * 2 + b.ph)) * 0.5); }
      for (const { m, k } of mist) {
        const p = (t * 0.12 + k / mist.length) % 1;
        m.position.set(-2.5 + k, 0.5 + p * 7, 4 + p * 2);
        m.scale.setScalar(1 + p * 2.5);
        m.material.opacity = Math.min(1, p * 6) * (1 - p) * 0.35;
      }
    },
  };
}
