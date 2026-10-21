// 原生生物の動き（docs/rules/creatures.md「種類」）。数値は mobTypes.js の表（notice・fly・flee・charge）から読む
// 気づく: 近づかれた（動き方ごとの距離。前後の向きは関係ない）・近くの音（combat.noise）・近くで戦っているロボット・叩かれた（aware が fight になる）
// 鳥は飛んで逃げて降りて警戒、ウサギはジグザグに逃げる、イノシシは近づくと威嚇し、叩かれたら突進。自分から襲うことはない
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const rnd = (a, b) => a + Math.random() * (b - a);
const NEAR_FIGHT = 8; // 近くで戦っているロボットに気づく距離（m）
const PERCH = 0.12, PERCH_H = 4; // 鳥が降り先に木の上を選ぶ確率と、木とみなす高さ（m）
const WANDER = 10; // 歩きまわる範囲（生まれた所から m）
const REST = { bird: ['peck', 'idle'], rabbit: ['graze', 'idle'], boar: ['dig', 'idle'] }; // 止まっているときのポーズ（1 つめが多い）

function face(m, x, z, rate, dt) {
  const d = wrap(Math.atan2(x, z) - m.yaw);
  m.yaw = wrap(m.yaw + Math.max(-rate * dt, Math.min(rate * dt, d)));
  return Math.abs(d);
}
function walk(m, x, z, speed, dt, c, rate = 8, quick) {
  const ok = c.steer.move(m, x, z, speed, dt, c.list, quick);
  face(m, Math.sin(m.heading ?? m.yaw), Math.cos(m.heading ?? m.yaw), rate, dt);
  return ok;
}

// 間の地面で見えなくなるか
function sees(m, p, terrain, dist) {
  const y0 = m.y + 0.3 + (m.hopY ?? 0), y1 = p.y + (p.eyeH ?? 0.9);
  for (let k = 1.5; k < dist; k += 1.5) {
    const u = k / dist;
    if (terrain.solidAt(m.x + (p.x - m.x) * u, y0 + (y1 - y0) * u, m.z + (p.z - m.z) * u)) return false;
  }
  return true;
}
// 気づいたか（止まっているプレイヤーは忍び足と同じ距離）
function noticed(m, dt, c, dist) {
  if (m.noise) { m.noise = false; return true; }
  const p = c.player.state, nt = m.def.notice, base = nt[p.gait] ?? nt.walk, reach = p.moving ? base : Math.min(base, nt.sneak);
  if (!c.dead && dist < reach && sees(m, p, c.terrain, dist)) return true;
  if ((m.fightT = (m.fightT ?? 0) - dt) <= 0) {
    m.fightT = 0.5;
    if (c.list.some((o) => !o.def.creature && o.aware === 'fight' && o.state !== 'down' && Math.hypot(o.x - m.x, o.z - m.z) < NEAR_FIGHT)) return true;
  }
  return false;
}

function rest(m, secs, pose) { m.state = 'idle'; m.t = secs; m.model.setPose(pose); }
function calm(m, secs = rnd(2, 4)) {
  m.engaged = m.angry = m.noise = false; m.aware = 'none'; m.home = { x: m.x, z: m.z };
  m.vx = m.vz = 0;
  rest(m, secs, 'idle');
}
// 生まれた所のまわりの、立てる場所
function wanderTo(m, c) {
  const T = c.terrain;
  for (let i = 0; i < 6; i++) {
    const a = rnd(0, 6.28), d = rnd(2, WANDER), x = m.home.x + Math.sin(a) * d, z = m.home.z + Math.cos(a) * d;
    if (T.heightAt(x, z) > T.waterLevel + 0.15 && !c.blockers(x, z, 0.4).length) { m.wp = { x, z }; return true; }
  }
  return false;
}
// 気づいていないとき: 止まる（ついばむ・草をはむ・掘る）と歩くをくり返す
function idle(m, dt, c) {
  const def = m.def;
  if (m.state === 'move') {
    const wx = m.wp.x - m.x, wz = m.wp.z - m.z;
    if (m.t > 0 && Math.hypot(wx, wz) > 0.5 && walk(m, wx, wz, def.speed, dt, c)) return m.model.setPose('move');
    return rest(m, rnd(1, 3), 'idle');
  }
  if (m.state !== 'idle') return rest(m, rnd(2, 4), REST[def.creature][0]);
  if (m.t > 0) return;
  if (!m.perch && Math.random() < 0.45 && wanderTo(m, c)) { m.state = 'move'; m.t = rnd(3, 8); return m.model.setPose('move'); }
  rest(m, rnd(2, 6), REST[def.creature][Math.random() < 0.65 ? 0 : 1]);
}

// ---- 鳥 ----
// 降りる先: 逃げる向きの 20〜35m の地面（35% は木の上）
function landing(m, c, fx, fz) {
  const T = c.terrain, F = m.def.fly, base = Math.atan2(m.x - fx, m.z - fz);
  for (let i = 0; i < 16; i++) {
    const a = base + rnd(-1, 1), d = rnd(F.far[0], F.far[1]), x = m.x + Math.sin(a) * d, z = m.z + Math.cos(a) * d;
    if (T.heightAt(x, z) < T.waterLevel + 0.2) continue;
    if (Math.random() < PERCH) {
      const tree = c.blockers(x, z, 8).find((t) => t.top - T.heightAt(t.x, t.z) > PERCH_H);
      if (tree) return { x: tree.x, z: tree.z, perch: tree.top - T.heightAt(tree.x, tree.z) - 0.3 };
    }
    if (!c.blockers(x, z, 0.5).length) return { x, z, perch: 0 };
  }
  const a = base, d = F.far[0];
  return { x: m.x + Math.sin(a) * d, z: m.z + Math.cos(a) * d, perch: 0 };
}
function takeoff(m, c) {
  const p = c.player.state;
  m.engaged = true; m.aware = 'fight'; m.state = 'fly'; m.tgt = landing(m, c, p.x, p.z); m.fy ??= 0;
  m.model.setPose('fly');
}
function bird(m, dt, c, dx, dz, dist) {
  const F = m.def.fly, T = c.terrain;
  if (m.state === 'fly') {
    const tx = m.tgt.x - m.x, tz = m.tgt.z - m.z, td = Math.hypot(tx, tz);
    if (td < (m.tgt.perch ? 0.25 : 0.7)) { m.state = 'alert'; m.t = F.alert; m.perch = m.tgt.perch; m.home = { x: m.x, z: m.z }; m.vx = m.vz = 0; m.model.setPose('idle'); return; }
    face(m, tx, tz, 7, dt);
    const sp = td < 3 ? F.speed * Math.max(0.3, td / 3) : F.speed; // 降りる直前は減速
    const vx = Math.sin(m.yaw) * sp, vz = Math.cos(m.yaw) * sp;
    m.x += vx * dt; m.z += vz * dt; m.vx = vx; m.vz = vz; m.moved = true;
    // 高さ: 進む先 6m までの障害物の上を越える高さまで上がり、下がるのはゆっくり（木をかすめるたびに上下しない）
    const floor = T.floorAt(m.x, m.y + 1, m.z), land = td < 8;
    let clear = -Infinity;
    for (let k = 0; k <= 6; k += 3) clear = Math.max(clear, c.blockers(m.x + Math.sin(m.yaw) * k, m.z + Math.cos(m.yaw) * k, 0.8).reduce((a, t) => Math.max(a, t.top), -Infinity));
    const want = land ? m.tgt.perch : Math.max(F.alt, clear + 0.8 - floor);
    const rate = want > m.fy ? 3 : land ? 1.6 : 0.7;
    m.fy += (want - m.fy) * Math.min(1, dt * rate);
    m.hopY = m.fy;
    return;
  }
  m.fy ??= 0;
  m.fy += ((m.perch ?? 0) - m.fy) * Math.min(1, dt * 4);
  m.hopY = m.fy;
  if (m.state === 'alert') { // 降りて警戒: 首を振る。また近づかれたら飛ぶ
    if (noticed(m, dt, c, dist)) return takeoff(m, c);
    if ((m.lookT = (m.lookT ?? 0) - dt) <= 0) { m.lookT = rnd(0.8, 2); m.look = m.yaw + rnd(-1.5, 1.5); }
    face(m, Math.sin(m.look ?? m.yaw), Math.cos(m.look ?? m.yaw), 3, dt);
    if (m.t <= 0) {
      if (m.perch > 0) { // 木の上にいた: 警戒が解けたら近くの地面へ降りる
        for (let i = 0; i < 8; i++) {
          const a = rnd(0, 6.28), d = rnd(3, 6), x = m.x + Math.sin(a) * d, z = m.z + Math.cos(a) * d;
          if (T.heightAt(x, z) > T.waterLevel + 0.2 && !c.blockers(x, z, 0.5).length) { m.tgt = { x, z, perch: 0 }; m.state = 'fly'; m.perch = 0; m.model.setPose('fly'); return; }
        }
        m.perch = 0;
      }
      calm(m, 0);
    }
    return;
  }
  if (m.aware === 'fight' || noticed(m, dt, c, dist)) return takeoff(m, c); // 叩かれた・気づいた
  idle(m, dt, c);
}

// ---- ウサギ ----
function rabbit(m, dt, c, dx, dz, dist) {
  const Fl = m.def.flee;
  if (!m.engaged && (m.aware === 'fight' || noticed(m, dt, c, dist))) { m.engaged = true; m.aware = 'fight'; m.state = 'flee'; m.t = 25; m.zigT = 0; m.model.setPose('flee'); }
  if (m.state !== 'flee') return idle(m, dt, c);
  if ((m.zigT -= dt) <= 0) { m.zig = (m.zig > 0 ? -1 : 1) * rnd(0.4, 0.9); m.zigT = rnd(0.4, 0.9); } // ジグザグに曲がる
  const a = Math.atan2(-dx, -dz) + (m.zig ?? 0);
  if (!walk(m, Math.sin(a), Math.cos(a), Fl.speed, dt, c, 14)) m.zig = -(m.zig ?? 1);
  if (dist > Fl.stop || m.t <= 0) calm(m);
}

// ---- イノシシ ----
function windup(m, Ch) { m.state = 'windup'; m.t = Ch.windup; m.model.setPose('windup', Ch.windup); }
function boar(m, dt, c, dx, dz, dist) {
  const Ch = m.def.charge, p = c.player.state, low = m.hp / m.maxHp <= Ch.fleeAt;
  if (m.aware === 'fight' && !m.angry) { // 叩かれた: 怒る（HP が少なければ逃げる）
    m.angry = true; m.angryT = Ch.angry; m.hpSeen = m.hp;
    if (low) { m.state = 'flee'; m.model.setPose('charge'); } else windup(m, Ch);
  }
  if (m.angry) {
    if (m.hp < m.hpSeen) { m.angryT = Ch.angry; m.hpSeen = m.hp; if (m.hp / m.maxHp <= Ch.fleeAt && m.state !== 'flee') { m.state = 'flee'; m.model.setPose('charge'); } }
    if ((m.angryT -= dt) <= 0 || dist > Ch.calm || c.dead) return calm(m);
    if (m.state === 'flee') { // 逃げる
      walk(m, -dx, -dz, Ch.flee, dt, c, 10);
      return;
    }
    if (m.state === 'windup') { // ため: 向きをプレイヤーへ。最後の 0.2 秒は向きを決める
      if (m.t > 0.2) face(m, dx, dz, 4, dt);
      if (m.t <= 0) { m.dir = { x: dx / (dist || 1), z: dz / (dist || 1) }; m.travel = 0; m.hitDone = false; m.state = 'charge'; m.model.setPose('charge'); }
      return;
    }
    if (m.state === 'charge') { // 突進: まっすぐ 10m。当たる・ぶつかる・走りきると止まって隙
      const x0 = m.x, z0 = m.z;
      const ok = c.steer.move(m, m.dir.x, m.dir.z, Ch.speed, dt, c.list, 0.04);
      face(m, m.dir.x, m.dir.z, 14, dt);
      m.travel += Math.hypot(m.x - x0, m.z - z0);
      if (!m.hitDone && !c.dead && Math.hypot(dx, dz) < c.touch + 0.5 && p.y < m.y + 0.7) { // 跳べばよけられる
        m.hitDone = true;
        c.hurt(Math.round(Ch.dmg * m.tier.dmg), { name: '突進', dmg: Ch.dmg, push: Ch.push });
      }
      if (!ok || m.hitDone || m.travel >= Ch.dist) { m.state = 'rest'; m.t = Ch.rest; m.vx = m.vz = 0; m.model.setPose('threat'); }
      return;
    }
    if (m.state === 'rest') { // 外したあとの隙
      face(m, dx, dz, 2, dt);
      if (m.t <= 0) windup(m, Ch);
      return;
    }
    return windup(m, Ch);
  }
  // 怒っていない: 近づくと威嚇（頭を下げて鼻を鳴らす。突進はしない）、離れると元に戻る
  if (m.state === 'threat') {
    face(m, dx, dz, 2.5, dt);
    m.calmT = dist > m.def.notice.walk * 1.5 || c.dead ? (m.calmT ?? 0) + dt : 0;
    if (m.calmT > 3) { m.calmT = 0; rest(m, rnd(1, 3), 'idle'); }
    return;
  }
  if (noticed(m, dt, c, dist)) { m.state = 'threat'; m.calmT = 0; m.model.setPose('threat'); return; }
  idle(m, dt, c);
}

const KINDS = { bird, rabbit, boar };
export function thinkAnimal(m, dt, c) {
  const p = c.player.state, dx = p.x - m.x, dz = p.z - m.z;
  m.t -= dt;
  m.hopY = m.def.creature === 'bird' ? m.fy ?? 0 : 0;
  if (m.state === 'flinch') { // 受け流された（イノシシ）
    if (m.t <= 0) { m.state = 'rest'; m.t = 0.5; m.model.setPose('threat'); }
    return;
  }
  KINDS[m.def.creature](m, dt, c, dx, dz, Math.hypot(dx, dz));
}
