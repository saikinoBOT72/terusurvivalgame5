// 敵の管理と戦闘（docs/rules/enemies.md「戦闘」、weapons.md）。出す・消す、近接で当てる（突く・振る）、弾が当たる、HP・のけぞり・倒れる・落とす物、戦闘の記録
// 数値は items.js（武器）と mobTypes.js（敵）の表だけから読む
import * as THREE from 'three';
import { ITEMS, HAND } from '../survival/items.js';
import { dropItem } from '../survival/death.js';
import { MOBS, TIERS } from './mobTypes.js';
import { think } from './brain.js';
import { thinkCamera } from './cameraBrain.js';
import { createSteer } from './steer.js';
import { createMobShots } from './mobShot.js';
import { createMobFx } from './mobFx.js';

const DOWN_SECS = 2; // 倒れてから部品を落とすまで
const WRECK_SECS = 10, SINK_SECS = 1; // 残骸が残る秒（倒れてから）、最後に沈む秒（enemies.md「戦闘の演出」）
const DUMMY_BACK = 3; // 練習用の的が HP 0 から戻るまで
const LOG_N = 10;
const SLEEP = 80; // これより遠くて気づいていない敵は休む（islands.md「敵の出方」）
const Z_SEE = 15; // 寝ている番人の「z」が見える距離（enemies.md「番人」）
const between = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// 体の当たり: 待機のポーズの見た目の箱（種類ごとに 1 回だけ作る）
const boxes = new Map();
export function bodyBox(kind) {
  if (!boxes.has(kind)) {
    const d = MOBS[kind].make();
    d.setPose('idle');
    for (let i = 0; i < 60; i++) d.update(0, 1 / 30);
    d.root.updateMatrixWorld(true);
    boxes.set(kind, new THREE.Box3().setFromObject(d.root));
  }
  return boxes.get(kind);
}

// 持っている物の近接の攻撃（攻撃力のない物・素手は HAND）。項目は weapons.md「近接武器の項目」
export function weaponOf(id, kind = 'mob') {
  const it = ITEMS[id];
  const w = (it?.dmg?.[kind] ?? it?.dmg?.mob) ? it : HAND;
  return {
    name: w.name, dmg: w.dmg[kind] ?? w.dmg.mob, reach: w.reach ?? 2.5, knock: w.knock ?? 0.3,
    hit: w.hit ?? 'thrust', stam: w.stam ?? 6, heavy: w.heavy ?? { hold: 0.8, mult: 2 }, hand: w === HAND,
  };
}

// blockers(x, z, r): 木・岩・建築パーツ（敵が回り込む・飛び越える）。hud: 頭の上の ？／！（combatHud.setMarks）
// 敵の体の当たり判定（player.md「敵の体にもぶつかる」）: 見た目の幅の半分の円柱。top は高くして上に乗れないように
const bodyR = (kind) => { const b = bodyBox(kind); return Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * 0.5; };
const PLAYER_R = 0.3, PLAYER_H = 1.1; // プレイヤーの太さ・高さ（firstPerson.js の RADIUS・HEAD くらい）
export function createCombat({ camera, inventory, player, playerDead = () => false, fx = null, wind = null, mud = null, rock = null, hud = null, blockers = () => [], onPlayerHit = () => {}, onDead = () => {}, onMessage = () => {}, onAlarm = () => {} }) {
  let world = null, steer = null;
  const list = [], log = [];
  const shots = createMobShots({ wind, mud }); // 敵の弾（風の弾・泥）
  const mfx = createMobFx({ fx }); // 白煙・傷み・土ぼこり・外れた部品
  let playerSpeed = 0, lastP = null; // プレイヤーの水平の速さ（寝ている番人が起きる。brain.js）
  const o = new THREE.Vector3(), d = new THREE.Vector3(), inv = new THREE.Matrix4(), ray = new THREE.Ray(), hit = new THREE.Vector3(), sph = new THREE.Sphere(), wp = new THREE.Vector3();

  const groundY = (m) => (m.def.hover ? steer.flyY(m) : world.terrain.floorAt(m.x, m.y + 1, m.z)) + (m.hopY ?? 0); // 足元の床（洞窟の中でも）
  const record = (t) => { log.push(t); if (log.length > LOG_N) log.shift(); };

  // y: 床のめやす（洞窟の中の番人など。なければいちばん上の地面）
  function spawn(kind, x, z, y = Infinity) {
    const def = MOBS[kind], model = def.make(), tier = TIERS[world.tier ?? 'v0'];
    const maxHp = Math.round(def.hp * tier.hp);
    const m = { kind, def, tier, model, x, z, y: 0, yaw: Math.random() * 6.28, hp: maxHp, maxHp, home: { x, z }, state: 'idle', aware: 'none', t: 0, flash: 0 };
    m.y = y; m.y = groundY(m);
    model.setPose(def.disguise ? 'disguise' : 'idle');
    model.root.position.set(x, m.y, z);
    model.root.rotation.y = m.yaw;
    world.group.add(model.root);
    list.push(m);
    return m;
  }
  function remove(m) {
    mfx.drop(m);
    m.model.root.removeFromParent();
    list.splice(list.indexOf(m), 1);
  }
  function clear() { while (list.length) remove(list[0]); shots.clear(); wind?.clear(); mud?.clear(); rock?.clear(); }
  // 敵がプレイヤーと重ならない所で止まる（上下に離れていれば重なってよい）
  function apart(m) {
    const p = player.state, b = bodyBox(m.kind);
    if (m.y + b.min.y > p.y + PLAYER_H || m.y + b.max.y < p.y) return;
    const dx = m.x - p.x, dz = m.z - p.z, d = Math.hypot(dx, dz), min = bodyR(m.kind) + PLAYER_R;
    if (d >= min) return;
    const l = d || 1;
    m.x = p.x + (d ? dx / l : Math.sin(m.yaw)) * min;
    m.z = p.z + (d ? dz / l : Math.cos(m.yaw)) * min;
  }
  // 頭の上の印が見えるか: 目から印までの間に地面がない（山や崖の向こうの印は出さない）
  function markSeen(m) {
    const p = player.state, y0 = p.y + 1, y1 = m.y + bodyBox(m.kind).max.y + 0.15, dx = m.x - p.x, dz = m.z - p.z, d = Math.hypot(dx, dz);
    for (let k = 1; k < d; k += 1) { const u = k / d; if (world.terrain.solidAt(p.x + dx * u, y0 + (y1 - y0) * u, p.z + dz * u)) return false; }
    return true;
  }
  // 動きに渡す物
  const ctx = (m) => ({
    player, dead: playerDead(), steer, list, terrain: world.terrain, touch: bodyR(m.kind) + PLAYER_R, playerSpeed,
    alarm: (cam) => { record(`${cam.def.name}の警報`); onAlarm(cam); }, // 監視カメラ（cameraBrain.js）
    hurt: (n, atk) => hurtBy(m, n, atk),
    wind, mud, rock, // 風の演出（windFx.js）、泥と歯の火花（mudFx.js）、岩と土（rockFx.js）
    dust: (mm, u, dt) => mfx.dust(mm, u, dt),
    shoot: (atk, from, dir) => shots.fire(m, atk, new THREE.Vector3(from.x, from.y, from.z), new THREE.Vector3(dir.x, dir.y, dir.z), world.group),
    escape: (e) => { record(`${e.def.name}が逃げた`); remove(e); },
  });

  // 敵の攻撃が当たった。from: 来た所（弾ならその位置。なければ敵）
  function hurtBy(m, n, atk, from = m) { const got = onPlayerHit(n, from, atk) ?? n; record(`${m.def.name}の${atk.name}→自分 ${got}`); }

  // 線（o から d へ max m まで）に当たる一番近い敵。{ m, dist, weak, point }（point は世界の位置）
  function rayMob(from, dir, max) {
    let best = null;
    for (const m of list) {
      if (m.state === 'down') continue;
      inv.copy(m.model.root.matrixWorld).invert();
      ray.set(from, dir).applyMatrix4(inv); // 敵の中の向きで調べる（回るのは縦の軸だけ）
      if (!ray.intersectBox(bodyBox(m.kind), hit)) continue;
      const dist = hit.distanceTo(ray.origin);
      if (dist > max || (best && dist > best.dist)) continue;
      const w = m.def.weak;
      const weak = !!w && !!ray.intersectSphere(sph.set(new THREE.Vector3(...w.at), w.r), wp) && wp.distanceTo(ray.origin) <= max;
      best = { m, dist, weak, point: (weak ? wp : hit).clone().applyMatrix4(m.model.root.matrixWorld) };
    }
    return best;
  }
  function eye() { camera.getWorldPosition(o); camera.getWorldDirection(d); }

  // 倒れる: 飛ぶ敵はきりもみで落ちて 2 回跳ねる（部品が外れる）。残骸は WRECK_SECS 残る
  function down(m) {
    m.state = 'down'; m.t = m.def.dummy ? DUMMY_BACK : WRECK_SECS;
    m.model.setPose('down');
    if (m.def.dummy) return;
    fx?.burst(m, WRECK_SECS);
    onDead(m);
    if (m.def.hover) {
      m.falling = true; m.fallV = 1.2; m.fallSpin = 11 * (Math.random() < 0.5 ? 1 : -1); m.bounces = 0;
      m.model.setFalling?.(true);
    }
    mfx.debris(m.model.shed?.() ?? [], m); // 外れる部品（ブンブンのファン、犬の右前脚）
  }
  // 倒れている間（残骸）
  function wreck(m, dt) {
    const g = world.terrain.floorAt(m.x, m.y + 0.5, m.z) - bodyBox(m.kind).min.y;
    if (m.falling) { // きりもみ: 前へ流れながら回って落ち、地面で跳ねる
      m.fallV -= 9.8 * dt;
      m.x += (m.vx ?? 0) * dt; m.z += (m.vz ?? 0) * dt;
      m.y += m.fallV * dt;
      m.yaw += m.fallSpin * dt; m.fallSpin *= Math.exp(-dt * 1.2);
      if (m.y <= g) {
        m.y = g;
        if (m.bounces < 2 && m.fallV < -1) { m.fallV *= -0.4; m.vx = (m.vx ?? 0) * 0.5; m.vz = (m.vz ?? 0) * 0.5; m.fallSpin *= 0.5; m.bounces++; fx?.sparks(new THREE.Vector3(m.x, m.y, m.z), 10, 4); }
        else { m.falling = false; m.vx = m.vz = 0; m.model.setFalling?.(false); }
      }
    } else if (m.t > SINK_SECS) m.y = Math.max(g, m.y - 4 * dt);
    const was = m.t;
    m.t -= dt;
    if (was > WRECK_SECS - DOWN_SECS && m.t <= WRECK_SECS - DOWN_SECS) drop(m); // 2 秒で部品を落とす
    if (m.t <= SINK_SECS) { const k = 0.6 * dt / SINK_SECS; m.y -= k; mfx.sink(m, k); } // 最後は地面へ沈む
    if (m.t <= 0) { remove(m); return false; }
    return true;
  }
  function drop(m) {
    for (const [id, a, b, p] of [...m.def.drops, ...(m.extraDrops ?? [])]) {
      if (Math.random() >= p) continue;
      const g = world.terrain.floorAt(m.x, m.y + 0.5, m.z);
      dropItem(world, id, between(a, b), m.x + (Math.random() - 0.5) * 0.6, m.z + (Math.random() - 0.5) * 0.6, Math.max(g, world.terrain.waterLevel));
    }
  }

  // 敵にダメージ（近接・弾の共通）。n: 弱点の前の攻撃力。knock: のけぞる秒。dir: 当たった向き（押す）。src: 記録に出す武器の名前
  function damageMob(m, n, { weak = false, point = null, dir = null, knock = 0.3, src = '' } = {}) {
    weak = weak && !!m.def.weak;
    const dmg = Math.max(1, Math.round(n * (weak ? m.def.weak.mult : 1)));
    m.hp = Math.max(0, m.hp - dmg);
    m.lastHit = dmg; m.flash = 0.1;
    if (m.aware !== 'fight') m.alertT = 1;
    m.aware = 'fight'; m.asleep = false; // 叩かれたらすぐ気づく（寝ていても起きる）
    record(`${src}→${m.def.name} ${dmg}${weak ? ' 弱点' : ''}${m.hp ? '' : ' 撃墜'}`);
    fx?.hit(m, point ?? new THREE.Vector3(m.x, m.y + 0.5, m.z), dmg, weak);
    if (dir && !m.def.dummy) { // のけぞる向き: 叩かれた向きを体の中の向きへ（左 +x、前 +z）
      const c = Math.cos(m.yaw), s = Math.sin(m.yaw);
      m.model.hit?.(dir.x * c - dir.z * s, dir.x * s + dir.z * c, knock * Math.max(0.3, m.def.flinch));
    }
    if (!m.hp) { if (dir) { m.vx = (m.vx ?? 0) + dir.x * 2; m.vz = (m.vz ?? 0) + dir.z * 2; } down(m); return dmg; }
    const fl = knock * m.def.flinch;
    if (fl > 0) { // のけぞる: ためが止まり、少し後ろへ
      m.state = 'flinch'; m.t = fl;
      m.model.setPose(m.model.poses.includes('stagger') ? 'stagger' : 'windup');
      if (dir && !m.def.dummy) { m.x += dir.x * 0.3 * m.def.flinch; m.z += dir.z * 0.3 * m.def.flinch; }
    }
    return dmg;
  }

  // 近接: 振り下ろしたところで当てる。mult: ため攻撃の倍率。当たった数を返す
  function melee(held, mult = 1) {
    if (!world || !list.length) return 0;
    eye();
    const base = weaponOf(held);
    if (base.hit === 'arc') { // 振る: 前 90 度・届く距離の中の全部
      let n = 0;
      for (const m of [...list]) {
        if (m.state === 'down') continue;
        const w = weaponOf(held, m.kind), b = bodyBox(m.kind);
        const r = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2;
        const cy = m.y + (b.min.y + b.max.y) / 2;
        const dx = m.x - o.x, dy = cy - o.y, dz = m.z - o.z, dist = Math.hypot(dx, dz);
        if (dist - r > w.reach || Math.abs(dy) > 1.6) continue;
        const flat = Math.hypot(d.x, d.z) || 1;
        if (dist > r && (dx * d.x + dz * d.z) / (dist * flat) < Math.cos(Math.PI / 4)) continue;
        const aim = rayMob(o, d, w.reach + 0.5); // 照準が当たっていれば、その場所（弱点も）
        const on = aim?.m === m ? aim : null;
        damageMob(m, w.dmg * mult, { weak: on?.weak, point: on?.point ?? new THREE.Vector3(m.x - dx / dist * r, cy, m.z - dz / dist * r), dir: d, knock: w.knock * mult, src: w.name });
        n++;
      }
      return n;
    }
    const h = rayMob(o, d, Math.max(...list.map((m) => weaponOf(held, m.kind).reach)));
    if (!h) return 0;
    const w = weaponOf(held, h.m.kind);
    if (h.dist > w.reach) return 0;
    damageMob(h.m, w.dmg * mult, { weak: h.weak, point: h.point, dir: d, knock: w.knock * mult, src: w.name });
    return 1;
  }

  return {
    list, log, shots, mfx,
    setWorld(w) { clear(); world = w; mfx.setWorld(w); mud?.setWorld(w); rock?.setWorld(w); steer = w?.terrain ? createSteer({ terrain: w.terrain, blockers }) : null; for (const at of w?.dummies ?? (w?.dummyAt ? [w.dummyAt] : [])) { const m = spawn('dummy', at.x, at.z); m.yaw = Math.atan2(w.spawn.x - m.x, w.spawn.z - m.z); m.fixed = true; } }, // 練習用の的は島の決まった場所に（訓練島は射撃の道に並べる。fixed: 全部消すで消さない）
    spawn, remove, clear, rayMob, damageMob,
    // 敵の体（プレイヤーの当たり判定に足す。firstPerson.js）。倒れた敵は通り抜ける
    bodies(x, z, r) {
      const out = [];
      for (const m of list) {
        if (m.state === 'down') continue;
        const b = bodyBox(m.kind), rad = bodyR(m.kind);
        if (Math.hypot(x - m.x, z - m.z) < rad + r) out.push({ x: m.x, z: m.z, r: rad, top: m.y + b.max.y + 2, bottom: m.y + b.min.y });
      }
      return out;
    },
    // 受け流された敵が崩れる（隙のポーズ。なければためのポーズ）
    stagger(m, secs) { if (m.state === 'down') return; m.state = 'flinch'; m.t = secs; m.model.setPose(m.model.poses.includes('stagger') ? 'stagger' : 'windup'); record(`受け流し→${m.def.name}`); },
    // 照準の先の敵の名前と残り HP（なければ null）
    aimedInfo(held) {
      if (!world || !list.length) return null;
      eye();
      const h = rayMob(o, d, Math.max(weaponOf(held).reach, ITEMS[held]?.ranged ? 60 : 0));
      return h && { name: `${h.m.def.name} ${h.m.hp}/${h.m.maxHp}${h.weak ? '（弱点）' : ''}`, key: '左クリック 攻撃' };
    },
    // 左クリックの振り下ろし: 照準の先の敵を叩く。当たれば true（道具の耐久が減る）
    hit(held, mult = 1) {
      const n = melee(held, mult);
      if (n && !weaponOf(held).hand) { const broke = inventory.wear(); if (broke) onMessage(`${broke}が壊れた`); }
      return n > 0;
    },
    // 音: プレイヤーのまわり r m の、寝ている番人を起こす（叩いた・戦った。enemies.md「番人」）
    noise(r = 15) { for (const m of list) if (m.asleep && Math.hypot(m.x - player.state.x, m.z - player.state.z) < r) m.noise = true; },
    update(t, dt, active) {
      if (!world) return;
      const ps = player.state;
      if (lastP && dt > 0) playerSpeed = Math.hypot(ps.x - lastP.x, ps.z - lastP.z) / dt;
      lastP = { x: ps.x, z: ps.z };
      for (const m of [...list]) {
        if (m.state === 'down') {
          if (m.def.dummy) { // 的: 倒れず、3 秒で戻る
            if ((m.t -= dt) <= 0) { m.hp = m.maxHp; m.state = 'idle'; m.model.setPose('idle'); }
          } else if (!wreck(m, dt)) continue; // 倒れる・残骸
        } else if (m.def.dummy) {
          if (m.state === 'flinch' && (m.t -= dt) <= 0) { m.state = 'idle'; m.model.setPose('idle'); }
        } else if (active) {
          if (m.aware === 'none' && Math.hypot(m.x - player.state.x, m.z - player.state.z) > SLEEP) continue; // 遠くて気づいていない敵は休む
          m.moved = false;
          m.model.setHealth?.(m.hp / m.maxHp);
          if (m.def.camera) thinkCamera(m, dt, ctx(m)); else think(m, dt, ctx(m));
          if (!list.includes(m)) continue; // 逃げ切った
          if (!m.moved && !m.def.camera) steer.coast(m, dt); // 慣性で少し流れて止まる
          m.y += (groundY(m) - m.y) * Math.min(1, dt * (m.hopY ? 20 : 6));
          apart(m);
        }
        m.flash = Math.max(0, m.flash - dt);
        m.model.root.position.set(m.x, m.y, m.z);
        m.model.root.rotation.y = m.yaw;
        m.model.update(t, dt);
        if (m.model.takeStep?.()) rock?.step(m); // 足音（採掘ロボ）
        if (active) mfx.mob(m, dt);
        fx?.flash(m, m.flash > 0);
        m.model.root.updateMatrixWorld();
      }
      if (active) shots.update(dt, { terrain: world.terrain, blockers, player, dead: playerDead(), hit: hurtBy });
      fx?.update(dt);
      wind?.update(dt);
      mud?.update(dt);
      rock?.update(dt);
      mfx.update(dt);
      hud?.setMarks(list.filter((m) => m.state !== 'down' && (m.aware === 'sus' || m.alertT > 0 || (m.asleep && Math.hypot(m.x - ps.x, m.z - ps.z) < Z_SEE)) && markSeen(m)).map((m) => ({ p: new THREE.Vector3(m.x, m.y + bodyBox(m.kind).max.y + 0.15, m.z), kind: m.aware === 'sus' ? '?' : m.alertT > 0 ? '!' : 'z' })));
    },
  };
}
