// 空、雲、光、遠くのかすみ（docs/rules/style.md）。時刻で色と光が変わる（docs/rules/survival.md「HP・空腹・昼夜」）
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { rng, shape, merge } from '../style/lowpoly.js';

const C = (v) => new THREE.Color(v);
// 空の色（上・中・地平線）
const DAY = [C(P.skyDay.zenith), C(P.skyDay.mid), C(P.skyDay.horizon)];
const NIGHT = [C(P.night[0]), C(P.night[1]), C(P.night[2])];
const DUSK = [C(P.dusk[0]), C(P.dusk[1]), C(P.dusk[2])];
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createSky(scene, { fogNear = 45, fogFar = 280 } = {}) {
  // かすみ: 遠いほど急に濃くなる（指数の 2 乗）。far でほぼ見えなくなる濃さにする（near は使わない）
  const density = (far) => 2 / far;
  scene.fog = new THREE.FogExp2(P.skyDay.horizon, density(fogFar));
  scene.background = new THREE.Color(P.skyDay.horizon);

  // 空のドーム（上ほど濃い）。色は時刻ごとに塗り直す
  const domeGeo = new THREE.SphereGeometry(500, 16, 12);
  const pos = domeGeo.attributes.position;
  const heights = Array.from({ length: pos.count }, (_, i) => Math.max(0, pos.getY(i) / 500));
  const cols = new Float32Array(pos.count * 3);
  domeGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const dome = new THREE.Mesh(domeGeo, new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false,
  }));
  dome.renderOrder = -1;
  scene.add(dome);

  // 星: 夜だけ見える
  const starPos = [], rs = rng(7);
  for (let i = 0; i < 260; i++) {
    const a = rs() * Math.PI * 2, y = 0.15 + rs() * 0.85, r = Math.sqrt(1 - y * y);
    starPos.push(Math.cos(a) * r * 470, y * 470, Math.sin(a) * r * 470);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: P.star, size: 2, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  stars.renderOrder = -1;
  scene.add(stars);

  // 光: 空からの光（上は空色、下は草の照り返し）と太陽（夜は月）
  const hemi = new THREE.HemisphereLight(P.skyLight, P.groundLight, 1.7);
  hemi.layers.enable(1); // 1人称の腕の層も照らす
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(P.sunLight, 2.3);
  const dir = { x: 14, y: 22, z: 9 }; // 影はカメラのまわりだけ作る（太陽ごとカメラについていく）
  sun.castShadow = true;
  sun.layers.enable(1);
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -32; sc.right = 32; sc.top = 32; sc.bottom = -32; sc.near = 1; sc.far = 100;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // 雲: ゆがんだ多面体を平たく組み合わせる。上の面は明るく、下の面は影の色。
  const cloudMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const clouds = [];
  const r = rng(42);
  for (let i = 0; i < 9; i++) {
    const parts = [];
    const n = 3 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const s = 2.5 + r() * 3;
      const g = new THREE.IcosahedronGeometry(s, 1);
      g.scale(1.3, 0.55, 1);
      g.translate((k - n / 2) * s * 1.1, r() * 1.2, (r() - 0.5) * s);
      parts.push(shape(g, (f) => (f.ny > 0.35 ? P.cloud[2] : f.ny < -0.35 ? P.cloud[0] : P.cloud[1]), r, { jit: s * 0.25, vary: 0.02 }));
    }
    const m = new THREE.Mesh(merge(parts), cloudMat);
    const a = r() * Math.PI * 2, d = 90 + r() * 150;
    m.position.set(Math.cos(a) * d, 45 + r() * 35, Math.sin(a) * d);
    m.rotation.y = r() * Math.PI;
    scene.add(m);
    clouds.push(m);
  }

  // 時刻（0〜24 時）で空・光・かすみ・雲の色と、太陽（月）の向きを変える
  const sky = [new THREE.Color(), new THREE.Color(), new THREE.Color()], c = new THREE.Color(), tmp = new THREE.Color();
  const W = new THREE.Color(1, 1, 1); // 雲の色をそのまま出す（掛け算の 1）
  function setHour(h) {
    const day = smooth(5, 7, h) * (1 - smooth(19, 21, h)); // 1 = 昼、0 = 夜
    const dusk = Math.max(0, 1 - Math.min(Math.abs(h - 6), Math.abs(h - 20)) / 1.2); // 朝方・夕方に 1
    for (let k = 0; k < 3; k++) sky[k].lerpColors(NIGHT[k], DAY[k], day).lerp(DUSK[k], dusk * (k ? 0.75 : 0.45));
    for (let i = 0; i < pos.count; i++) {
      const t = heights[i];
      if (t < 0.35) c.lerpColors(sky[2], sky[1], t / 0.35);
      else c.lerpColors(sky[1], sky[0], (t - 0.35) / 0.65);
      c.toArray(cols, i * 3);
    }
    domeGeo.attributes.color.needsUpdate = true;
    scene.fog.color.copy(sky[2]);
    scene.background.copy(sky[2]);
    starMat.opacity = 1 - smooth(0, 0.6, day);
    cloudMat.color.lerpColors(NIGHT[2], W, day).lerp(tmp.set(P.dusk[3]), dusk * 0.6);

    hemi.intensity = 0.55 + 1.15 * day;
    hemi.color.lerpColors(NIGHT[2], tmp.set(P.skyLight), day);
    hemi.groundColor.lerpColors(NIGHT[0], tmp.set(P.groundLight), day);
    // 昼は太陽（6 時に東 → 20 時に西）、夜は月。地平線の近くでは弱くなり、入れ替わりで影が飛ばない
    const isDay = h >= 6 && h < 20;
    const a = isDay ? Math.PI * (h - 6) / 14 : Math.PI * (((h - 20 + 24) % 24) / 10);
    const up = Math.sin(a);
    dir.x = Math.cos(a) * 20; dir.y = Math.max(up, 0.35) * 24; dir.z = 9;
    sun.intensity = (isDay ? 2.3 : 0.45) * smooth(0, 0.3, up);
    sun.color.set(isDay ? P.sunLight : P.star);
    if (isDay) sun.color.lerp(tmp.set(P.dusk[3]), dusk);
    baseHemi = hemi.intensity; baseSun = sun.intensity;
    applyDim();
  }
  // 洞窟の奥（terrain.md「洞窟」）: 空の光と日の光を弱める。dim 0〜1
  let dim = 0, baseHemi = 1, baseSun = 1;
  function applyDim() { hemi.intensity = baseHemi * (1 - dim * 0.8); sun.intensity = baseSun * (1 - dim * 0.9); }
  setHour(12);

  return {
    sun, hemi,
    setHour,
    setFog(near, far) { scene.fog.density = density(far); },
    setDim(k) { if (Math.abs(k - dim) > 0.005) { dim = k; applyDim(); } },
    update(dt, camPos) {
      dome.position.copy(camPos);
      stars.position.copy(camPos);
      sun.target.position.set(Math.round(camPos.x), 0, Math.round(camPos.z));
      sun.position.set(sun.target.position.x + dir.x, dir.y, sun.target.position.z + dir.z);
      for (const m of clouds) {
        m.position.x += dt * 1.2;
        if (m.position.x > 260) m.position.x = -260;
      }
    },
  };
}
