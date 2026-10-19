// 当てたときの手ごたえ（weapons.md「当てたときの手ごたえ」、enemies.md「戦闘の演出」）: 敵が白く光る、星形の閃光、地面で跳ねる火花（弱点は青白いのも）、
// 赤く光って冷める破片、金属片、撃墜で部品がはじけて、残骸から煙が出続ける
// 数字と照準の × は画面表示（ui/combatHud.js）へ渡す
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { bodyBox } from './combat.js';
import { createBarrierFx } from './barrierFx.js';

const MAX_SPARK = 220, MAX_BIT = 80, MAX_PUFF = 90, MAX_EMBER = 60, MAX_STAR = 8;
const STAR_SECS = 0.09, EMBER_SECS = 1.4;
const G = 9.8;
const rand = (a, b) => a + Math.random() * (b - a);
const col = (arr) => new THREE.Color(arr[Math.floor(Math.random() * arr.length)]);

export function createHitFx({ scene, hud = null }) {
  let terrain = null;
  const barrierFx = createBarrierFx({ scene });
  const ground = (x, z) => (terrain ? Math.max(terrain.groundNear(x, z), terrain.waterLevel) : -Infinity);

  // 火花: 短い線。速さの向きにのびる
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_SPARK * 6), 3));
  sparkGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_SPARK * 6), 3));
  const sparkLines = new THREE.LineSegments(sparkGeo, new THREE.LineBasicMaterial({ vertexColors: true }));
  sparkLines.frustumCulled = false;
  scene.add(sparkLines);
  const sparks = [];

  // 金属片・はじけた部品（箱）と煙（低分割の球）。1 つずつの大きさで出し、最後に小さくなって消える
  const inst = (geo, n, opt = {}) => {
    const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ flatShading: true, ...opt }), n);
    m.count = 0; m.frustumCulled = false; m.castShadow = !opt.transparent;
    scene.add(m);
    return m;
  };
  const bitMesh = inst(new THREE.BoxGeometry(1, 0.6, 1), MAX_BIT);
  const puffMesh = inst(new THREE.IcosahedronGeometry(1, 0), MAX_PUFF, { transparent: true, opacity: 0.55, depthWrite: false });
  const bits = [], puffs = [], smokers = [];
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

  const FLASH = new THREE.MeshBasicMaterial({ color: P.fx.flash });

  // 赤く光る小さな破片: 光る色から暗い色へ冷める
  const emberMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), MAX_EMBER);
  emberMesh.count = 0; emberMesh.frustumCulled = false;
  scene.add(emberMesh);
  const embers = [], HOT = P.fx.ember.map((c) => new THREE.Color(c)), COLD = new THREE.Color(P.robotFrame[0]);

  // 星形の閃光（光の板。いつもこちらを向く）: 当たった瞬間だけ
  const starTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    g.translate(32, 32); g.fillStyle = '#fff';
    g.beginPath();
    for (let i = 0; i < 16; i++) { const r = i % 2 ? 6 : i % 4 ? 18 : 31, a = i / 16 * Math.PI * 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.fill();
    return new THREE.CanvasTexture(c);
  })();
  const stars = Array.from({ length: MAX_STAR }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: P.fx.spark[2], transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    s.visible = false; s.renderOrder = 4; scene.add(s);
    return { s, life: 0, size: 0 };
  });
  let starI = 0;
  function addStar(p, size, cool) {
    const st = stars[starI++ % MAX_STAR];
    st.s.position.copy(p); st.s.material.rotation = rand(0, 6.28);
    st.s.material.color.set(cool ? P.fx.sparkCool[0] : P.fx.spark[2]);
    st.life = STAR_SECS; st.size = size; st.s.visible = true;
  }

  function addSparks(p, n, speed, pal = P.fx.spark) {
    for (let i = 0; i < n && sparks.length < MAX_SPARK; i++) {
      const v = new THREE.Vector3(rand(-1, 1), rand(-0.2, 1), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.5, 1));
      sparks.push({ p: p.clone(), v, life: rand(0.2, 0.5), c: col(pal), bounce: 1 });
    }
  }
  function addEmbers(p, n) {
    for (let i = 0; i < n; i++) {
      if (embers.length >= MAX_EMBER) embers.shift();
      embers.push({ p: p.clone(), v: new THREE.Vector3(rand(-1.5, 1.5), rand(0.5, 2.5), rand(-1.5, 1.5)), s: rand(0.012, 0.022), life: EMBER_SECS * rand(0.7, 1.1), max: EMBER_SECS, c: HOT[i % HOT.length].clone() });
    }
  }
  function addBits(p, n, size, speed, pals, life) {
    for (let i = 0; i < n && bits.length < MAX_BIT; i++) {
      bits.push({
        p: p.clone(), v: new THREE.Vector3(rand(-1, 1), rand(0.4, 1.2), rand(-1, 1)).multiplyScalar(speed),
        r: new THREE.Vector3(rand(0, 6), rand(0, 6), rand(0, 6)), rv: new THREE.Vector3(rand(-12, 12), rand(-12, 12), rand(-12, 12)),
        s: size * rand(0.6, 1.2), life: life * rand(0.8, 1.2), c: col(pals[i % pals.length]),
      });
    }
  }
  function addPuff(p) {
    if (puffs.length >= MAX_PUFF) puffs.shift();
    puffs.push({ p: p.clone().add(_p.set(rand(-0.1, 0.1), 0, rand(-0.1, 0.1))), s: rand(0.04, 0.07), life: 1.2, max: 1.2, c: col(P.fx.smoke) });
  }

  return {
    counts: () => `火花 ${sparks.length} 破片 ${bits.length} 赤い破片 ${embers.length} 煙 ${puffs.length}`,
    setWorld(w) { barrierFx.clear(); terrain = w?.terrain ?? null; sparks.length = bits.length = puffs.length = smokers.length = embers.length = 0; },
    sparks: (p, n, speed) => addSparks(p, n, speed), // 傷みの火花（mobFx.js）
    // 当たった: 星形の閃光・火花（弱点は青白いのも）・赤い破片・金属片・数字・照準の ×
    hit(m, point, dmg, weak) {
      const big = Math.min(1, dmg / 40);
      addStar(point, (weak ? 0.55 : 0.35) + big * 0.25, weak);
      addSparks(point, (weak ? 18 : 10) + Math.round(big * 8), weak ? 7 : 5.5);
      if (weak) addSparks(point, 10, 6, P.fx.sparkCool);
      addEmbers(point, (weak ? 4 : 2) + Math.round(big * 3));
      addBits(point, weak ? 5 : 2, 0.04, 2.2, [P.robotMetal, P.robotShell], 0.9);
      hud?.number(point, dmg, weak);
      hud?.mark(weak);
    },
    // 撃墜: 部品が 3〜5 個はじけ、残骸の間（secs 秒）は煙が出続ける（だんだん少なく）
    burst(m, secs = 2) {
      const b = bodyBox(m.kind), c = new THREE.Vector3(m.x, m.y + (b.min.y + b.max.y) / 2, m.z);
      const size = Math.max(0.08, Math.min(0.2, (b.max.y - b.min.y) * 0.18));
      addBits(c, 3 + Math.floor(Math.random() * 3), size, 3, [P.robotShell, P.robotFrame, P.robotHazard, P.robotRust], 2.5);
      addSparks(c, 24, 6.5);
      addEmbers(c, 8);
      addStar(c, 0.8, false);
      smokers.push({ m, t: secs, max: secs, acc: 0 });
    },
    // 当たった敵を白く光らせる（on の間だけ材質を入れ替える）
    flash(m, on) {
      if (!!m.flashOn === on) return;
      m.flashOn = on;
      if (!m.meshes) { m.meshes = []; m.model.root.traverse((o) => { if (o.isMesh) m.meshes.push([o, o.material]); }); }
      for (const [o, mat] of m.meshes) o.material = on ? FLASH : mat;
    },
    // 遠すぎる所から撃たれた（barrier）: 青白い閃光と火花、体のまわりに殻、「バリア」の文字
    barrier(m, point) {
      addStar(point, 0.4, true);
      addSparks(point, 8, 5, P.fx.sparkCool);
      barrierFx.show(m);
      hud?.number(point, 'バリア', false, ' barrier');
    },
    update(dt) {
      barrierFx.update(dt);
      // 火花
      let n = 0;
      const pos = sparkGeo.attributes.position.array, cl = sparkGeo.attributes.color.array;
      for (let i = sparks.length - 1; i >= 0; i--) if ((sparks[i].life -= dt) <= 0) sparks.splice(i, 1);
      for (const s of sparks) {
        s.v.y -= G * dt; s.p.addScaledVector(s.v, dt);
        if (s.bounce && s.p.y < ground(s.p.x, s.p.z)) { s.p.y = ground(s.p.x, s.p.z); s.v.y *= -0.45; s.v.x *= 0.6; s.v.z *= 0.6; s.bounce--; } // 地面で跳ねる
        const j = n * 6;
        pos[j] = s.p.x; pos[j + 1] = s.p.y; pos[j + 2] = s.p.z;
        pos[j + 3] = s.p.x - s.v.x * 0.025; pos[j + 4] = s.p.y - s.v.y * 0.025; pos[j + 5] = s.p.z - s.v.z * 0.025;
        for (let k = 0; k < 2; k++) { cl[j + k * 3] = s.c.r; cl[j + k * 3 + 1] = s.c.g; cl[j + k * 3 + 2] = s.c.b; }
        n++;
      }
      sparkGeo.setDrawRange(0, n * 2);
      sparkGeo.attributes.position.needsUpdate = sparkGeo.attributes.color.needsUpdate = true;

      // 金属片・部品: 跳ねて止まり、最後に小さくなる
      for (let i = bits.length - 1; i >= 0; i--) if ((bits[i].life -= dt) <= 0) bits.splice(i, 1);
      bits.forEach((b, i) => {
        b.v.y -= G * dt; b.p.addScaledVector(b.v, dt);
        const g = ground(b.p.x, b.p.z) + b.s * 0.3;
        if (b.p.y < g) { b.p.y = g; b.v.y *= -0.3; b.v.x *= 0.6; b.v.z *= 0.6; b.rv.multiplyScalar(0.6); }
        b.r.addScaledVector(b.rv, dt);
        const k = b.s * Math.min(1, b.life / 0.3);
        bitMesh.setMatrixAt(i, _m.compose(b.p, _q.setFromEuler(_e.set(b.r.x, b.r.y, b.r.z)), _s.set(k, k, k)));
        bitMesh.setColorAt(i, b.c);
      });
      bitMesh.count = bits.length;
      bitMesh.instanceMatrix.needsUpdate = true;
      if (bitMesh.instanceColor) bitMesh.instanceColor.needsUpdate = true;

      // 赤い破片: 跳ねて止まり、冷めて暗くなり、最後に小さくなる
      for (let i = embers.length - 1; i >= 0; i--) if ((embers[i].life -= dt) <= 0) embers.splice(i, 1);
      embers.forEach((e, i) => {
        e.v.y -= G * dt; e.p.addScaledVector(e.v, dt);
        const g = ground(e.p.x, e.p.z) + e.s * 0.5;
        if (e.p.y < g) { e.p.y = g; e.v.y *= -0.3; e.v.x *= 0.5; e.v.z *= 0.5; }
        const a = 1 - e.life / e.max;
        e.c.copy(HOT[i % HOT.length]).lerp(COLD, Math.min(1, a * 1.3));
        const k = e.s * Math.min(1, e.life / 0.25);
        emberMesh.setMatrixAt(i, _m.compose(e.p, _q.identity(), _s.set(k, k, k)));
        emberMesh.setColorAt(i, e.c);
      });
      emberMesh.count = embers.length;
      emberMesh.instanceMatrix.needsUpdate = true;
      if (emberMesh.instanceColor) emberMesh.instanceColor.needsUpdate = true;
      // 星形の閃光: 一瞬広がって消える
      for (const st of stars) {
        if (!st.s.visible) continue;
        st.life -= dt;
        if (st.life <= 0) { st.s.visible = false; continue; }
        const a = 1 - st.life / STAR_SECS;
        st.s.scale.setScalar(st.size * (0.6 + a * 0.8));
        st.s.material.opacity = 1 - a * a;
      }

      // 煙: 倒れている敵から出て、上へふくらみながら消える
      for (let i = smokers.length - 1; i >= 0; i--) {
        const s = smokers[i];
        if ((s.t -= dt) <= 0) { smokers.splice(i, 1); continue; }
        const b = bodyBox(s.m.kind);
        const gap = 0.1 + (1 - s.t / s.max) * 0.3; // だんだん少なく
        for (s.acc += dt; s.acc > gap; s.acc -= gap) addPuff(_p.set(s.m.x, s.m.y + b.max.y * 0.7, s.m.z));
      }
      for (let i = puffs.length - 1; i >= 0; i--) if ((puffs[i].life -= dt) <= 0) puffs.splice(i, 1);
      puffs.forEach((f, i) => {
        f.p.y += 0.6 * dt;
        const a = 1 - f.life / f.max, k = f.s * (1 + a * 2) * Math.min(1, f.life / 0.4);
        puffMesh.setMatrixAt(i, _m.compose(f.p, _q.identity(), _s.set(k, k, k)));
        puffMesh.setColorAt(i, f.c);
      });
      puffMesh.count = puffs.length;
      puffMesh.instanceMatrix.needsUpdate = true;
      if (puffMesh.instanceColor) puffMesh.instanceColor.needsUpdate = true;
    },
  };
}
