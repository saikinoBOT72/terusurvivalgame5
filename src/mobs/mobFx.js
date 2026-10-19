// 敵のまわりの演出（enemies.md「戦闘の演出」）: いつもの白煙（排気の湯気）、傷みの黒煙と火花、土ぼこり、撃墜で外れた部品が転がる
// 煙は低分割の球。出はじめにふくらみ、最後に小さくなって消える。色は palette.js の fx.steam・fx.smoke・fx.dust
import * as THREE from 'three';
import { P } from '../style/palette.js';

const rand = (a, b) => a + Math.random() * (b - a);
const G = 9.8;
const STEAM = [5, 14]; // 白煙: 1 秒に出る数（待機、動く・ため）
const HURT_SMOKE = 9; // 傷みの黒煙: 1 秒に出る数（HP 50% 以下）
const FALL_SMOKE = 30; // 落ちていく間の黒煙

export function createMobFx({ fx = null } = {}) {
  let terrain = null;
  const ground = (x, z) => (terrain ? Math.max(terrain.groundNear(x, z), terrain.waterLevel) : 0);
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const kinds = {
    steam: { max: 220, pal: P.fx.steam, opacity: 0.4, flat: true },
    smoke: { max: 160, pal: P.fx.smoke, opacity: 0.55 },
    dust: { max: 140, pal: P.fx.dust, opacity: 0.32, flat: true }, // 影で暗く見えないように、光を受けない色で
  };
  for (const k of Object.values(kinds)) {
    const opt = { transparent: true, opacity: k.opacity, depthWrite: false };
    k.mesh = new THREE.InstancedMesh(geo, k.flat ? new THREE.MeshBasicMaterial(opt) : new THREE.MeshLambertMaterial({ flatShading: true, ...opt }), k.max);
    k.mesh.count = 0; k.mesh.frustumCulled = false;
    k.list = [];
    k.cols = k.pal.map((c) => new THREE.Color(c));
  }
  const debris = []; // 外れた部品 { obj, m, v, w, life }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();

  // 煙を 1 つ出す。v: 速さ、s: 大きさ、grow: 大きくなる倍率
  function puff(kind, p, v, s, life, grow = 2) {
    const k = kinds[kind];
    if (k.list.length >= k.max) k.list.shift();
    k.list.push({ p: p.clone(), v, s, grow, life, max: life, c: k.cols[Math.floor(Math.random() * k.cols.length)], r: rand(0, 6) });
  }
  const back = (m) => new THREE.Vector3(-Math.sin(m.yaw), 0, -Math.cos(m.yaw));

  return {
    counts: () => `湯気 ${kinds.steam.list.length} 黒煙 ${kinds.smoke.list.length} 土ぼこり ${kinds.dust.list.length} 部品 ${debris.length}`,
    setWorld(w) {
      terrain = w?.terrain ?? null;
      for (const k of Object.values(kinds)) { k.list.length = 0; k.mesh.removeFromParent(); if (w?.group) w.group.add(k.mesh); }
      for (const d of debris) d.obj.removeFromParent();
      debris.length = 0;
    },
    // 毎フレーム、敵ごと: 白煙・傷み・落ちる煙
    mob(m, dt) {
      const vents = m.model.vents;
      if (!vents?.length) return;
      const down = m.state === 'down';
      if (down && !m.falling) { m.emit = 0; return; } // 残骸の煙は hitFx
      const busy = m.state === 'windup' || Math.hypot(m.vx ?? 0, m.vz ?? 0) > 0.5;
      const hp = m.hp / m.maxHp;
      m.emit = (m.emit ?? Math.random()) + dt * (down ? FALL_SMOKE : busy ? STEAM[1] : STEAM[0]);
      for (; m.emit >= 1; m.emit--) {
        for (const v of vents) {
          v.getWorldPosition(_p);
          const b = back(m);
          if (down) puff('smoke', _p, b.multiplyScalar(0.3).add(new THREE.Vector3(rand(-0.2, 0.2), 0.6, rand(-0.2, 0.2))), rand(0.04, 0.07), rand(0.8, 1.2), 3);
          else puff('steam', _p, b.multiplyScalar(rand(0.3, 0.6)).add(new THREE.Vector3(rand(-0.1, 0.1), rand(0.15, 0.35), rand(-0.1, 0.1))), rand(0.018, 0.03), rand(0.6, 1), 3);
        }
      }
      if (down) return;
      // 傷み: 50% から黒煙、30% からときどき火花
      if (hp < 0.5) {
        m.smokeAcc = (m.smokeAcc ?? 0) + dt * HURT_SMOKE * (hp < 0.3 ? 1.6 : 1);
        for (; m.smokeAcc >= 1; m.smokeAcc--) { (m.model.smoke ?? vents[0]).getWorldPosition(_p); puff('smoke', _p, new THREE.Vector3(rand(-0.1, 0.1), rand(0.4, 0.7), rand(-0.1, 0.1)), rand(0.025, 0.045), rand(0.9, 1.4), 3); }
      }
      if (hp < 0.3 && (m.sparkT = (m.sparkT ?? 1) - dt) <= 0) {
        m.sparkT = rand(0.35, 1);
        _p.set(m.x + rand(-0.2, 0.2), m.y + rand(0, 0.15), m.z + rand(-0.2, 0.2));
        fx?.sparks(_p, 6 + Math.floor(Math.random() * 5), 3);
      }
    },
    // 土ぼこり: 下の地面から輪に舞う（u: ための進み）
    dust(m, u, dt) {
      const g = ground(m.x, m.z);
      if (m.y - g > 2.5) return; // 高すぎると地面に届かない
      const near = 1 - Math.max(0, m.y - g - 0.5) / 2; // 低いほど多い
      m.dustAcc = (m.dustAcc ?? 0) + dt * (14 + 26 * u) * near;
      for (; m.dustAcc >= 1; m.dustAcc--) {
        const a = rand(0, 6.28), r = rand(0.2, 0.5), sp = rand(1.2, 2.4);
        _p.set(m.x + Math.sin(a) * r, g + 0.05, m.z + Math.cos(a) * r);
        puff('dust', _p, new THREE.Vector3(Math.sin(a) * sp, rand(0.3, 0.7), Math.cos(a) * sp), rand(0.014, 0.026), rand(0.45, 0.7), 3.5);
      }
    },
    // 撃墜で外れた部品: m の速さを受け継いで飛び、跳ねて転がる。m が消えるとき（drop）に消す
    debris(objs, m) {
      for (const obj of objs) {
        debris.push({ obj, m, v: new THREE.Vector3((m.vx ?? 0) + rand(-1.5, 1.5), rand(2, 3.2), (m.vz ?? 0) + rand(-1.5, 1.5)), w: new THREE.Vector3(rand(-9, 9), rand(-4, 4), rand(-9, 9)), r: 0.12 });
      }
    },
    sink(m, k) { for (const d of debris) if (d.m === m) d.obj.position.y -= k; }, // 残骸と一緒に沈む
    drop(m) { for (let i = debris.length - 1; i >= 0; i--) if (debris[i].m === m) { debris[i].obj.removeFromParent(); debris.splice(i, 1); } },
    update(dt) {
      for (const k of Object.values(kinds)) {
        for (let i = k.list.length - 1; i >= 0; i--) if ((k.list[i].life -= dt) <= 0) k.list.splice(i, 1);
        k.list.forEach((f, i) => {
          f.v.multiplyScalar(Math.exp(-dt * 1.5)); // 空気で遅くなる
          f.p.addScaledVector(f.v, dt);
          const a = 1 - f.life / f.max;
          const sz = f.s * (1 + a * f.grow) * Math.min(1, f.life / 0.3) * Math.min(1, a / 0.1 + 0.3);
          k.mesh.setMatrixAt(i, _m.compose(f.p, _q.setFromEuler(_e.set(f.r, f.r * 1.3, 0)), _s.set(sz, sz, sz)));
          k.mesh.setColorAt(i, f.c);
        });
        k.mesh.count = k.list.length;
        k.mesh.instanceMatrix.needsUpdate = true;
        if (k.mesh.instanceColor) k.mesh.instanceColor.needsUpdate = true;
      }
      // 外れた部品: 重力、地面で跳ね、転がって止まる
      for (const d of debris) {
        if (d.rest) continue;
        const o = d.obj;
        d.v.y -= G * dt;
        o.position.addScaledVector(d.v, dt);
        o.rotation.x += d.w.x * dt; o.rotation.y += d.w.y * dt; o.rotation.z += d.w.z * dt;
        const g = ground(o.position.x, o.position.z) + d.r * 0.5;
        if (o.userData.stick && d.v.y < 0 && o.position.y < ground(o.position.x, o.position.z) + o.userData.stick) { // 刺さる部品（採掘ロボのツルハシ）: 刃を下にして止まる
          o.position.y = ground(o.position.x, o.position.z) + o.userData.stick;
          o.rotation.set(Math.PI + 0.35, Math.random() * 6.28, 0.15);
          d.rest = true;
          continue;
        }
        if (o.position.y < g) {
          o.position.y = g;
          if (Math.abs(d.v.y) > 0.8) { d.v.y *= -0.35; d.v.x *= 0.7; d.v.z *= 0.7; d.w.multiplyScalar(0.7); } // 跳ねる
          else { d.v.y = 0; d.v.x *= Math.exp(-dt * 2.5); d.v.z *= Math.exp(-dt * 2.5); d.w.x = d.v.z / d.r; d.w.z = -d.v.x / d.r; d.w.y *= 0.9; } // 転がる
          if (Math.hypot(d.v.x, d.v.z) < 0.05 && Math.abs(d.v.y) < 0.01) d.rest = true;
        }
      }
    },
  };
}
