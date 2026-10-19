// 採掘ロボの演出（enemies.md「採掘ロボ」）: 岩の破片・火の粉・突き出る岩の柱・光るひび。衝撃波の輪・斬撃の残像・噴射は shockFx.js
// 攻撃の fx: 'rock' のとき brain.js から呼ばれる（charge・release・during と、踏み込みの着地 impact）。どの攻撃かは a.style（smash | sweep | quake）
// ほかに: 岩の殻が割れる（shell）、足音（step。combat.js から）、怒り（rage）。近くで大きな衝撃があると画面が揺れる（player.shake）
// 破片は低分割の球、火の粉は光る球、柱は四角すい、ひびは地面に沿った細い板（中が赤く光る）。色は palette.js の fx.rock・fx.crack・fx.heat・fx.dust
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { createShockFx } from './shockFx.js';

const MAX = 320, EMBERS = 120, SPIKES = 70, CRACKS = 160;
const G = 9.8, SEG = 0.45, FADE = 0.7;
const rand = (a, b) => a + Math.random() * (b - a);

export function createRockFx({ scene, fx = null, player = null }) {
  let terrain = null;
  const shock = createShockFx({ scene });
  const ground = (x, z) => (terrain ? Math.max(terrain.groundNear(x, z), terrain.waterLevel) : 0);
  const inst = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.count = 0; m.frustumCulled = false; scene.add(m); return m; };
  const ball = new THREE.IcosahedronGeometry(1, 0);
  const bitMesh = inst(ball, new THREE.MeshLambertMaterial({ flatShading: true }), MAX);
  const emberMesh = inst(ball, new THREE.MeshBasicMaterial(), EMBERS);
  const spikeMesh = inst(new THREE.ConeGeometry(1, 1, 4).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ flatShading: true }), SPIKES);
  const crackMesh = inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: P.fx.crack }), CRACKS);
  const glowMesh = inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: P.fx.heat[1] }), CRACKS);
  const bits = [], embers = [], spikes = [], cracks = [];
  const rockC = P.fx.rock.map((c) => new THREE.Color(c)), dirt = P.fx.dust.map((c) => new THREE.Color(c)), heat = P.fx.heat.map((c) => new THREE.Color(c));
  const pick = (cols) => cols[Math.floor(Math.random() * cols.length)];
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _p = new THREE.Vector3();

  function bit(p, v, s, life, cols = rockC) {
    const glow = cols === heat, list = glow ? embers : bits;
    if (list.length >= (glow ? EMBERS : MAX)) list.shift();
    list.push({ p: p.clone(), v, s, life, max: life, c: pick(cols), r: rand(0, 6), rest: false });
  }
  const worldOf = (obj) => (obj?.parent ? obj.getWorldPosition(_p).clone() : null);
  const fwd = (m) => new THREE.Vector3(Math.sin(m.yaw), 0, Math.cos(m.yaw));
  const many = (rate, dt) => Math.floor(rate * dt + Math.random());
  // 地面から輪に飛ぶ土と岩（(x, z) のまわり r の中から、横の速さ sp、上へ up）
  function burst(x, z, n, sp, r = 0.3, cols, up = [1.5, 3.5], size = [0.03, 0.07]) {
    const g = ground(x, z);
    for (let i = 0; i < n; i++) {
      const a = rand(0, 6.28), rr = rand(0, r);
      bit(new THREE.Vector3(x + Math.sin(a) * rr, g + 0.05, z + Math.cos(a) * rr), new THREE.Vector3(Math.sin(a) * sp * rand(0.4, 1), rand(...up), Math.cos(a) * sp * rand(0.4, 1)), rand(...size), rand(0.6, 1.1), cols ?? (Math.random() < 0.5 ? rockC : dirt));
    }
  }
  // 岩の柱: (x, z) に高さ h・太さ w
  const spike = (x, z, h, w, life = 1.1) => { if (spikes.length < SPIKES) spikes.push({ x, z, h, w, yaw: rand(0, 6), tilt: rand(-0.35, 0.35), life, max: life }); };
  // 画面の揺れ: (x, z) から r m の中にいると、近いほど強く
  function quake(x, z, amp, r, secs = 0.35) {
    const p = player?.state;
    if (!p) return;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < r) player.shake(amp * (1 - d / r), secs, 0, { freq: 14 });
  }
  // ひび: (x, z) から外へ area m、ぎざぎざの線を n 本。u: 伸びた割合
  function makeCrack(m, x, z, area, n = 7) {
    const segs = [];
    for (let i = 0; i < n; i++) {
      let a = (i / n) * Math.PI * 2 + rand(-0.3, 0.3), cx = x + Math.sin(a) * 0.35, cz = z + Math.cos(a) * 0.35, d = 0.35;
      while (d < area) {
        a += rand(-0.35, 0.35);
        const nx = cx + Math.sin(a) * SEG, nz = cz + Math.cos(a) * SEG;
        segs.push({ x: (cx + nx) / 2, z: (cz + nz) / 2, yaw: a, d: d + SEG });
        cx = nx; cz = nz; d += SEG;
      }
    }
    return { m, segs, area, u: 0, seen: 0, fade: null };
  }
  const jets = (m, n, dark, sp = 3) => { for (const v of m.model.vents ?? []) { const p = worldOf(v); if (p) shock.jet(p, new THREE.Vector3(-Math.sin(m.yaw), -0.6, -Math.cos(m.yaw)), n, dark, sp); } };

  return {
    count: () => bits.length + embers.length + spikes.length,
    clear() { bits.length = embers.length = spikes.length = cracks.length = 0; shock.clear(); },
    setWorld(w) { terrain = w?.terrain ?? null; bits.length = embers.length = spikes.length = cracks.length = 0; shock.clear(); },
    // ため（u: 0〜1 の進み）
    charge(m, a, u, dt) {
      if (a.style === 'quake') { // ひびの線が自分から外へ走り、中が赤く光る
        let c = cracks.find((x) => x.m === m && x.fade === null);
        if (!c) cracks.push((c = makeCrack(m, m.x, m.z, a.area)));
        c.u = Math.min(1, u * 1.25); c.seen = 0;
        for (let i = many(25, dt); i > 0; i--) { const s = c.segs[Math.floor(Math.random() * c.segs.length)]; if (s.d <= c.u * c.area) burst(s.x, s.z, 1, 0.4, 0.05, Math.random() < 0.3 ? heat : dirt, [0.8, 2]); }
      } else if (a.style === 'sweep') { // 低く構えて足もとを擦る
        for (let i = many(20, dt); i > 0; i--) burst(m.x, m.z, 1, 1.5, 0.4, dirt, [0.5, 1.5]);
      } else if (a.style === 'smash') { // ツルハシの頭が赤熱して火の粉がこぼれる。足もとに土ぼこり
        const p = worldOf(m.model.blade);
        if (p) for (let i = many(10 + 40 * u, dt); i > 0; i--) bit(p, new THREE.Vector3(rand(-0.6, 0.6), rand(-0.2, 1), rand(-0.6, 0.6)), rand(0.012, 0.025), rand(0.4, 0.8), heat);
        for (let i = many(12 * u, dt); i > 0; i--) burst(m.x, m.z, 1, 1, 0.4, dirt, [0.4, 1]);
      }
    },
    // 放出の瞬間（振り下ろしは跳ぶとき、なぎ払いは突っ込むとき）
    release(m, a) {
      const f = fwd(m);
      if (a.style === 'smash') { // 跳ぶ: 排気管から蒸気と黒煙を噴射、足もとの土がはじける
        jets(m, 18, 0.45, 4);
        burst(m.x, m.z, 18, 2.5, 0.4, dirt, [1.5, 3]);
      } else if (a.style === 'sweep') { // 斬撃の残像、地面をこする火花の線
        shock.slash(m, m.y + 0.7);
        for (let k = -1.2; k <= 1.2; k += 0.6) { const x = m.x + Math.sin(m.yaw + k) * 2.2, z = m.z + Math.cos(m.yaw + k) * 2.2; fx?.sparks(new THREE.Vector3(x, ground(x, z) + 0.1, z), 6, 2.5); }
        for (let i = 0; i < 26; i++) {
          const k = rand(-1.4, 1.4), rr = rand(1.2, 2.4), yaw = m.yaw + k, x = m.x + Math.sin(yaw) * rr, z = m.z + Math.cos(yaw) * rr;
          const tx = -Math.cos(m.yaw), tz = Math.sin(m.yaw); // 振る向き（体の右 -x へ）
          bit(new THREE.Vector3(x, ground(x, z) + rand(0.2, 0.8), z), new THREE.Vector3(tx * rand(1.5, 3) + Math.sin(yaw) * 0.8, rand(0.5, 1.8), tz * rand(1.5, 3) + Math.cos(yaw) * 0.8), rand(0.025, 0.05), rand(0.5, 0.8), dirt);
        }
        jets(m, 8, 0.2, 3);
      } else if (a.style === 'quake') { // 足とこぶしで地面を打つ: 光るひびから大きな岩の柱、衝撃波の輪、土の柱、打ち上がる大きな石
        const p = worldOf(m.model.fist);
        if (p) fx?.sparks(p, 16, 3);
        const c = cracks.find((x) => x.m === m && x.fade === null);
        if (c) {
          c.u = 1; c.fade = FADE;
          for (const s of c.segs) if (Math.random() < 0.7) spike(s.x + rand(-0.15, 0.15), s.z + rand(-0.15, 0.15), rand(0.4, 0.8) * (1 - s.d / c.area * 0.4), rand(0.12, 0.22), 1.3);
        }
        shock.ring(m.x, ground(m.x, m.z), m.z, a.area, 0.45);
        burst(m.x, m.z, 40, 3.5, 1.4);
        burst(m.x, m.z, 24, 0.6, 0.5, dirt, [4, 6.5], [0.04, 0.08]); // 土の柱
        burst(m.x, m.z, 7, 2.2, 1.2, rockC, [5, 7], [0.12, 0.2]); // 大きな石
        quake(m.x, m.z, 0.16, 9);
      }
    },
    // 踏み込みの最中: なぎ払いは足もとから土の線、振り下ろしは空中で煙を引く
    during(m, a, dt) {
      if (!a.lunge || m.landed) return;
      if (a.style === 'sweep') for (let i = many(60, dt); i > 0; i--) burst(m.x, m.z, 1, 0.8, 0.3, dirt, [0.6, 1.6]);
      else if (a.style === 'smash') jets(m, many(30, dt), 0.5, 2);
    },
    // 振り下ろしの着地: 衝撃波の輪・岩の柱・大量の破片と火花と火の粉・大きな土ぼこりの輪・短い光るひび。画面が強く揺れる
    impact(m, a) {
      if (a.style !== 'smash') return;
      const f = fwd(m), x = m.x + f.x * 1.4, z = m.z + f.z * 1.4, g = ground(x, z); // 刃の落ちる所（ポーズはまだ振り下ろす途中）
      shock.ring(x, g, z, 3, 0.4);
      shock.ring(x, g, z, 1.6, 0.25);
      for (let i = 0; i < 6; i++) { const k = rand(0, 6.28), r = rand(0.3, 1.1); spike(x + Math.sin(k) * r, z + Math.cos(k) * r, rand(0.35, 0.65), rand(0.1, 0.17), 1.2); }
      burst(x, z, 45, 3.5, 0.4);
      burst(m.x, m.z, 26, 3, 0.9, dirt, [0.8, 2]);
      for (let i = 0; i < 18; i++) bit(new THREE.Vector3(x, g + 0.1, z), new THREE.Vector3(rand(-3, 3), rand(2, 4.5), rand(-3, 3)), rand(0.015, 0.03), rand(0.5, 0.9), heat);
      fx?.sparks(new THREE.Vector3(x, g + 0.1, z), 30, 4.5);
      const c = makeCrack(m, x, z, 1.3, 6); c.u = 1; c.fade = FADE;
      cracks.push(c);
      quake(x, z, 0.14, 8);
    },
    // 岩の殻を割って立ち上がる（岩のふりから「！」）: 大きな破片、土ぼこり、排気管から蒸気
    shell(m) {
      const g = ground(m.x, m.z);
      for (let i = 0; i < 34; i++) { const a = rand(0, 6.28); bit(new THREE.Vector3(m.x + Math.sin(a) * 0.35, g + rand(0.2, 0.8), m.z + Math.cos(a) * 0.35), new THREE.Vector3(Math.sin(a) * rand(1.5, 3.5), rand(2, 4.5), Math.cos(a) * rand(1.5, 3.5)), rand(0.06, 0.14), rand(0.9, 1.4)); }
      burst(m.x, m.z, 24, 2.5, 0.6, dirt, [0.8, 2]);
      shock.ring(m.x, g, m.z, 1.8, 0.35);
      jets(m, 20, 0.15, 2.5);
      quake(m.x, m.z, 0.08, 7);
    },
    // 足音: 着いた足のまわりに土ぼこり、近いと画面がわずかに揺れる
    step(m) {
      for (let i = 0; i < 5; i++) burst(m.x + rand(-0.15, 0.15), m.z + rand(-0.15, 0.15), 1, 0.8, 0.2, dirt, [0.4, 1], [0.02, 0.04]);
      quake(m.x, m.z, 0.035, 6, 0.15);
    },
    // 怒り（HP 50% 以下）: 排気管から赤い火の粉と黒煙
    rage(m, dt) {
      if (!m.model.blade) return;
      for (const v of m.model.vents ?? []) {
        const p = worldOf(v);
        if (!p) continue;
        for (let i = many(6, dt); i > 0; i--) bit(p, new THREE.Vector3(rand(-0.4, 0.4), rand(0.5, 1.5), rand(-0.4, 0.4)), rand(0.012, 0.022), rand(0.4, 0.8), heat);
        if (Math.random() < dt * 4) shock.jet(p, new THREE.Vector3(0, 1, 0), 1, 1, 0.8);
      }
    },
    update(dt) {
      // 破片と火の粉: 重力で落ち、地面で止まって小さくなって消える
      const fall = (list, mesh, glow) => {
        for (let i = list.length - 1; i >= 0; i--) if ((list[i].life -= dt) <= 0) list.splice(i, 1);
        list.forEach((b, i) => {
          if (!b.rest) {
            b.v.y -= G * dt * (glow ? 0.6 : 1);
            b.p.addScaledVector(b.v, dt);
            const g = ground(b.p.x, b.p.z) + b.s * 0.5;
            if (b.p.y < g) { b.p.y = g; b.rest = true; }
          }
          const sz = b.s * Math.min(1, b.life / 0.25);
          mesh.setMatrixAt(i, _m.compose(b.p, _q.setFromEuler(_e.set(b.r, b.r * 1.7, 0)), _s.set(sz, b.rest ? sz * 0.6 : sz, sz)));
          mesh.setColorAt(i, b.c);
        });
        mesh.count = list.length;
      };
      fall(bits, bitMesh, false);
      fall(embers, emberMesh, true);
      // 岩の柱: 0.1 秒で突き出て、最後の 0.3 秒で地面へ沈む
      for (let i = spikes.length - 1; i >= 0; i--) if ((spikes[i].life -= dt) <= 0) spikes.splice(i, 1);
      spikes.forEach((s, i) => {
        const t = s.max - s.life, k = Math.min(1, t / 0.1) * Math.min(1, s.life / 0.3);
        _p.set(s.x, ground(s.x, s.z) - 0.05, s.z);
        spikeMesh.setMatrixAt(i, _m.compose(_p, _q.setFromEuler(_e.set(s.tilt, s.yaw, s.tilt * 0.5)), _s.set(s.w, Math.max(0.001, s.h * k), s.w)));
        spikeMesh.setColorAt(i, rockC[i % rockC.length]);
      });
      spikeMesh.count = spikes.length;
      // ひび: ためで伸び、放出のあと消える。ためが止まった（のけぞり）ら消える。黒い線の中に赤く光る細い線
      for (let i = cracks.length - 1; i >= 0; i--) {
        const c = cracks[i];
        if (c.fade === null && (c.seen += dt) > 0.15) c.fade = FADE * 0.5;
        if (c.fade !== null && (c.fade -= dt) <= 0) cracks.splice(i, 1);
      }
      let n = 0;
      for (const c of cracks) {
        const w = 0.06 + 0.04 * c.u, a = c.fade === null ? 1 : Math.max(0, c.fade / FADE);
        for (const s of c.segs) {
          if (n >= CRACKS || s.d > c.u * c.area + SEG * 0.5) continue;
          const g = ground(s.x, s.z);
          _q.setFromEuler(_e.set(0, s.yaw, 0));
          crackMesh.setMatrixAt(n, _m.compose(_p.set(s.x, g + 0.02, s.z), _q, _s.set(w * a, 0.02, SEG * 1.05)));
          glowMesh.setMatrixAt(n++, _m.compose(_p.set(s.x, g + 0.03, s.z), _q, _s.set(w * 0.4 * a * (0.6 + 0.4 * c.u), 0.02, SEG * 1.02)));
        }
      }
      crackMesh.count = glowMesh.count = n;
      for (const m of [bitMesh, emberMesh, spikeMesh, crackMesh, glowMesh]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
      shock.update(dt);
    },
  };
}
