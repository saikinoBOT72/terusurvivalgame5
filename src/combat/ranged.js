// 遠距離武器（docs/rules/weapons.md「遠距離武器」）: スリングも銃も同じ仕組み。違いは items.js の ranged の値だけ
// 弾は物として飛び、重力で落ちる。スリングの石は目に見え、銃の弾は見せずに軌道の線を引く（tracerFx.js）。遠いほどばらつきで当たりにくく、距離で弱くなる（falloff）
// 銃の撃ち方（押している間・n 発ずつ・1 発ずつ）、弾切れのカチッ、薬きょう・煙・音は weapons.md「銃の仕組み」
// 当たる物: 敵（combat.rayMob）、スリングの的（巣の卵・ヤシの実）、地形・水、木・岩・建築パーツ（blockers）
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { makeMesh, glowMat } from '../style/lowpoly.js';
import { ITEMS } from '../survival/items.js';
import { itemGeometry } from '../survival/itemShapes.js';
import { hitCylinder } from '../world/resources.js';
import { createTracerFx } from './tracerFx.js';
import { createShellFx, createSmokeFx } from './shellFx.js';
import { gunSounds } from '../audio/gunSounds.js';
import { sound } from '../audio/sound.js';

const G = 9.8, LIFE = 3, STEP = 0.25; // 重力、弾が消えるまでの秒、地形・木を調べる間かく（m）
const AIM_ZOOM = 1 / 0.75; // 覗き込むと視野が 0.75 倍
const AIM_TIME = 0.15; // 寄る・戻るのにかかる秒（腕の構えと同じ速さ）
const MIN_POWER = 0.4; // スリングを少しだけ引いたときの強さ
const TRACE_MAX = 120, TRACE_DT = 1 / 60; // 軌道の線の最長（m）と、先に当たる所を調べる刻み（秒）

export const rangedOf = (id) => ITEMS[id]?.ranged ?? null;

// 距離の減り方: [ここまで 100%, ここで最小, 最小の倍率]
export function falloff([near, far, min], d) {
  if (d <= near) return 1;
  if (d >= far) return min;
  return 1 - (1 - min) * (d - near) / (far - near);
}

export function createRanged({ scene, camera, inventory, combat, player, hud, blockers = () => [], onTarget = () => {}, onMessage = () => {} }) {
  let world = null, draw = -1, cool = 0, reload = null, aiming = false, aimK = 0; // aimK: 覗き込みの進み 0〜1
  const shots = [];
  const o = new THREE.Vector3(), d = new THREE.Vector3(), up = new THREE.Vector3(), right = new THREE.Vector3(), q = new THREE.Vector3();
  const tracer = createTracerFx(scene);
  const mz = new THREE.Vector3();
  const muzzle = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), glowMat({ color: P.fx.muzzle[1] }));
  muzzle.visible = false;
  scene.add(muzzle);
  let muzzleT = 0;
  let trigger = null, runT = 0, lastShot = -9, now = 0; // trigger: 押している間・n 発ずつの残り { id, left }。runT: 続けて撃っている秒（煙）
  const stat = { shots: 0, gaps: [] }; // 開発用: 撃った数と間隔
  const shells = createShellFx(scene, (p) => gunSounds.shell(p)), smoke = createSmokeFx(scene);
  player.arms.onGunEvent = (ev) => {
    if (ev === 'eject') { if (player.arms.ejectWorld(mz)) shells.spawn(mz, camera); }
    else gunSounds.event(ev);
  };

  // ばらつき: 照準から deg 度の円の中のどこか
  function spreadDir(dir, deg) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * THREE.MathUtils.degToRad(deg);
    up.set(0, 1, 0);
    right.crossVectors(dir, up).normalize();
    up.crossVectors(right, dir).normalize();
    return dir.clone().addScaledVector(right, Math.cos(a) * Math.tan(r)).addScaledVector(up, Math.sin(a) * Math.tan(r)).normalize();
  }

  function fire(id, power) {
    const R = rangedOf(id);
    camera.getWorldPosition(o);
    camera.getWorldDirection(d);
    const deg = R.spread[aiming ? 2 : player.state.moving ? 1 : 0];
    const dir = spreadDir(d, deg);
    const mesh = R.mag ? null : makeMesh(itemGeometry(R.ammo), { shadow: false }); // 銃の弾は見せない
    if (mesh) { mesh.scale.setScalar(0.6); scene.add(mesh); }
    const start = o.clone().addScaledVector(d, 0.4);
    const v = dir.multiplyScalar(R.speed * power);
    shots.push({ id, R, power, p: start, from: start.clone(), v, t: 0, mesh, travel: 0 });
    if (R.mag) combat.noise(); // 銃声: まわり 15m の生き物が気づいて逃げる（creatures.md）
    if (R.recoil) player.kick(THREE.MathUtils.degToRad(R.recoil));
    if (R.mag) gunSounds.shot(R.snd);
    if (R.mag) { // 銃口の火と、銃口から先に当たる所までの軌道の線
      if (!player.arms.muzzleWorld(mz)) {
        right.crossVectors(d, up.set(0, 1, 0)).normalize();
        mz.copy(o).addScaledVector(d, 0.7).addScaledVector(right, aiming ? 0 : 0.18).addScaledVector(up, aiming ? -0.08 : -0.15);
      }
      muzzle.position.copy(mz).addScaledVector(d, 0.03);
      muzzle.visible = true; muzzleT = 0.05;
      muzzle.scale.setScalar((R.flash ?? 1) * (0.8 + Math.random() * 0.4));
      runT = now - lastShot < R.rate * 1.6 ? runT + (now - lastShot) : 0; // 続けて撃っている秒
      if (runT >= 1) smoke.puff(mz);
      if (lastShot > 0 && now - lastShot < 1) stat.gaps.push(now - lastShot);
      if (stat.gaps.length > 30) stat.gaps.shift();
      lastShot = now; stat.shots++;
      tracer.fire(mz, traceEnd(start, v, R));
      player.arms.gunFire(!held()?.mag);
    }
    cool = R.rate + Math.max(-0.05, Math.min(0, cool)); // 押している間の連射は、余った分を次へ持ち越す（間隔がフレームでずれない）
    const broke = inventory.wear();
    if (broke) onMessage(`${broke}が壊れた`);
  }

  // 撃った瞬間に、同じ飛び方で先に当たる所を調べる（軌道の線の終わり。当たりは飛ぶ弾で今どおり調べる）
  function traceEnd(start, v0, R) {
    const s = { p: start.clone() }, vel = v0.clone(), dir = new THREE.Vector3();
    for (let t = 0, dist = 0; t < LIFE && dist < TRACE_MAX && world; t += TRACE_DT) {
      vel.y -= G * R.drop * TRACE_DT;
      const len = vel.length() * TRACE_DT;
      dir.copy(vel).normalize();
      const h = firstHit(s, dir, len);
      if (h) return s.p.addScaledVector(dir, h.dist);
      s.p.addScaledVector(dir, len);
      dist += len;
    }
    return s.p;
  }

  // 弾が 1 フレームで進む線の上で、一番先に当たる物（なければ null）
  function firstHit(s, dir, len) {
    let best = null;
    const mob = combat.rayMob(s.p, dir, len);
    if (mob) best = { dist: mob.dist, mob };
    for (const t of world.slingTargets ?? []) {
      if (!t.ready) continue;
      const h = hitCylinder(s.p, dir, t);
      if (h !== null && h <= len && (!best || h < best.dist)) best = { dist: h, target: t };
    }
    const T = world.terrain;
    for (let k = STEP; k < (best?.dist ?? len) + STEP; k += STEP) { // 地形・水・木・岩・パーツ
      const kk = Math.min(k, len);
      q.copy(s.p).addScaledVector(dir, kk);
      if (T.solidAt(q.x, q.y, q.z) || (q.y <= T.waterLevel && T.floorAt(q.x, q.y, q.z) < T.waterLevel)) return { dist: kk, wall: true };
      if (blockers(q.x, q.z, 0.04).some((c) => q.y < c.top && q.y > (c.bottom ?? -Infinity))) return { dist: kk, wall: true };
      if (kk >= len) break;
    }
    return best;
  }

  function hit(s, h, dir) {
    if (h.mob) {
      const m = h.mob.m, p = player.state;
      if (m.def.barrier && Math.hypot(m.x - p.x, m.z - p.z) > m.def.barrier) { combat.barrierMob(m, h.mob.point); return; } // 遠すぎる所からはバリアで 0
      const k = falloff(s.R.falloff, s.travel + h.dist);
      combat.damageMob(h.mob.m, s.R.dmg * s.power * k, { weak: h.mob.weak, point: h.mob.point, dir, knock: s.R.knock ?? 0.2, src: ITEMS[s.id].name });
      combat.noise(); // 当たった音で、近くの生き物が気づく
    } else if (h.target) onTarget(h.target);
  }

  const held = () => inventory.held();
  // 銃を 1 発: 弾倉が空なら、クリップで動く銃はカチッだけ、ガラクタ拳銃は込め直しを始める。撃てたら true
  function gunShot(id, self) {
    const R = rangedOf(id), slot = held();
    if (!slot.mag) {
      if (ITEMS[id].clip) { gunSounds.dry(); cool = 0.25; }
      else if (!self.reload(id)) onMessage(`${ITEMS[R.ammo].name}が必要`);
      return false;
    }
    slot.mag--;
    inventory.changed();
    fire(id, 1);
    return true;
  }
  const ammoCount = (R) => inventory.count?.(R.ammo) ?? inventory.slots.reduce((n, x) => n + (x?.id === R.ammo ? x.n : 0), 0);

  return {
    setWorld(w) { world = w; for (const s of shots) s.mesh?.removeFromParent(); shots.length = 0; tracer.clear(); shells.clear(); },
    // 左を押した: スリングは引き始める、銃は撃つ
    press(id) {
      const R = rangedOf(id);
      if (!R || !world || cool > 0 || reload) return;
      if (R.mag) {
        if (!gunShot(id, this)) return;
        if (R.auto || R.burst > 1) trigger = { id, left: R.burst > 1 ? R.burst - 1 : Infinity }; // 押している間・残りの n 発
        if (R.burst > 1) cool = R.burstGap;
        return;
      }
      if (!ammoCount(R)) { onMessage(`${ITEMS[R.ammo].name}が必要`); return; }
      draw = 0;
    },
    // 左を離した: 引いた分の強さで撃つ
    release(id) {
      if (trigger?.left === Infinity) trigger = null; // 押している間の連射をやめる（n 発ずつは最後まで撃つ）
      const R = rangedOf(id);
      if (!R || draw < 0) return;
      const k = R.draw ? Math.min(1, draw / R.draw) : 1;
      draw = -1;
      player.arms.setPose('charge', 0);
      if (!inventory.remove(R.ammo, 1)) { onMessage(`${ITEMS[R.ammo].name}が必要`); return; }
      player.arms.swing('fling', 0.3, { heavy: true }); // 引いた所から前へ振り出す
      player.arms.slingFire();
      fire(id, MIN_POWER + (1 - MIN_POWER) * k);
    },
    // R: 込め直し（銃）
    reload(id) {
      const R = rangedOf(id), slot = held();
      if (!R?.mag || reload || (slot.mag ?? 0) >= R.mag || !ammoCount(R)) return false;
      reload = { t: 0, slot, R };
      trigger = null;
      player.arms.gunReload(R.reload); // リロードの動き（avatar/fpGun.js）
      return true;
    },
    // T: 銃を眺める（込め直し中は受け付けない。weapons.md「銃の仕組み」）
    inspect(id) { if (rangedOf(id)?.mag && !reload) player.arms.gunInspect(); },
    // 右を押している間、覗き込む（aim のある武器）
    aim(id, on) {
      on = on && !!rangedOf(id)?.aim;
      if (on === aiming) return;
      aiming = on;
      player.arms.setPose('aim', on ? 1 : 0);
    },
    get aiming() { return aiming; },
    get aimK() { return aimK; }, // のぞき込みの進み 0〜1（周辺減光。world/grade.js）
    // 照準の下の線（攻撃間隔）: 込め直しの進み、なければ連射の間の満ち具合。満ちていれば null
    cdFrac(id) {
      const R = rangedOf(id);
      if (!R) return null;
      if (reload) return reload.t / reload.R.reload;
      return cool > 0 ? 1 - cool / R.rate : null;
    },
    get tracers() { return tracer.count; },
    // 開発用（__game.debug）: 撃った数・連射の間隔の平均・弾倉・込め直しの秒・薬きょうの数
    debug(id) {
      const R = rangedOf(id);
      if (!R?.mag) return null;
      const g = stat.gaps, avg = g.length ? g.reduce((a, b) => a + b, 0) / g.length : 0;
      return `銃 撃った ${stat.shots} 間隔 ${avg.toFixed(3)}s 弾 ${held()?.mag ?? 0}/${R.mag}${reload ? ` 込め直し ${reload.t.toFixed(2)}/${R.reload}s` : ''}${trigger ? ' 連射中' : ''} 薬きょう ${shells.count}`;
    },
    get drawing() { return draw >= 0; },
    update(dt, id) {
      const R = rangedOf(id);
      now += dt;
      cool -= dt;
      if (trigger) { // 押している間・n 発ずつ
        if (trigger.id !== id || reload) trigger = null;
        else if (cool <= 0) {
          if (!gunShot(id, this)) trigger = null;
          else if (--trigger.left <= 0) trigger = null;
          if (R.burst > 1) cool = trigger ? R.burstGap : R.rate;
        }
      }
      if (!trigger) cool = Math.max(0, cool);
      player.holdRecoil(!!trigger); // 押している間は画面のはねが戻らずに積み上がる
      sound.setListener(camera);
      shells.update(dt, world?.terrain);
      smoke.update(dt);
      if (!R) { draw = -1; if (aiming) this.aim(id, false); }
      const k = Math.max(0, Math.min(1, aimK + (aiming ? dt : -dt) / AIM_TIME)); // 視野の拡大は毎フレーム近づける
      if (k !== aimK) {
        aimK = k;
        camera.zoom = 1 + (AIM_ZOOM - 1) * k * k * (3 - 2 * k);
        camera.updateProjectionMatrix();
      }
      if (draw >= 0 && R) { draw += dt; player.arms.setPose('charge', Math.min(1, draw / (R.draw || 1))); }
      if (reload) { // 込め直し: 持ち替えたら取りやめ
        if (held() !== reload.slot) reload = null;
        else if ((reload.t += dt) >= reload.R.reload) {
          const n = Math.min(reload.R.mag - (reload.slot.mag ?? 0), ammoCount(reload.R));
          inventory.remove(reload.R.ammo, n);
          reload.slot.mag = (reload.slot.mag ?? 0) + n;
          inventory.changed();
          reload = null;
        }
      }
      if (R && !R.mag) player.arms.slingLoaded(ammoCount(R) > 0);
      if (aiming || draw >= 0) player.state.slow = Math.min(player.state.slow, 0.5);
      hud.setAmmo(R?.mag ? `${held()?.mag ?? 0}/${R.mag}` : null, reload ? reload.t / reload.R.reload : null);
      if ((muzzleT -= dt) <= 0) muzzle.visible = false;
      tracer.update(dt);

      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i];
        s.t += dt;
        s.v.y -= G * s.R.drop * dt;
        const len = s.v.length() * dt, dir = s.v.clone().normalize();
        const h = world && firstHit(s, dir, len);
        if (h) hit(s, h, dir);
        if (h || s.t > LIFE) { s.mesh?.removeFromParent(); shots.splice(i, 1); continue; }
        s.p.addScaledVector(dir, len);
        s.travel += len;
        if (s.mesh) { s.mesh.position.copy(s.p); s.mesh.lookAt(q.copy(s.p).sub(dir)); }
      }
    },
  };
}
