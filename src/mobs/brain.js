// 敵の動き（docs/rules/enemies.md「戦闘」「気づき」「動き方」）。数値は mobTypes.js の表から読む
// 気づき: 気づいていない → 「？」見に行く（2 秒見えたら）→ 「！」戦う。叩かれたらすぐ「！」
// 戦う: 追う（回り込む・囲む）→ ため（向きをここで決める）→ 攻撃 → 休む。ためを見て横へよける・離れると当たらない
// 群れ（pack があれば。犬）: 加勢・正面と回り込み・挟み撃ち（pack.js）。続けて噛む（hits）、跳ぶ直前までねらう（track）、フェイント、外すとつんのめる（miss）
// 近距離の技（pick: 'weight'。採掘ロボ）: 重みで選ぶ・まわりの技は背中にも、踏み込み（lunge。跳ぶ・滑る）（melee.js）。遠いとすぐあきらめる（farGive）、刺さって抜けない隙（stuck）、岩の殻から出て吠える（roar）
// 個性: 向きを変える速さ（カニ）、足が止まる隙（犬）、岩のふり（採掘ロボ）、遠くからの突進（ガンギ）。HP が減ったら逃げる・怒る
// 間合い取り（bands があれば。ブンブン）: 間合いをランダムに選び、合う攻撃を出す。攻撃の kind: spin まわりを回る（area の中に当たる）| shot 弾を撃つ
import { space, pickWander, wanderMove } from './spacing.js';
import { callPack, packRole, packMayAttack, flankSpot } from './pack.js';
import { pickMelee, inCone, lungeStep } from './melee.js';
import { awareness } from '../player/gait.js';

const HIT_R = 0.7; // 体当たりが当たる近さ（m、体の中心どうし）
const FRONT = Math.cos(Math.PI / 3), FACE = Math.cos(35 * Math.PI / 180); // 見える範囲（前 120 度）、攻撃に入れる向き
const LOSE = 5, ALERT = 1; // あきらめるまでの秒、「！」を出す秒。後ろでも気づく距離・見える距離・「！」になるまでの秒はプレイヤーの動き方で変わる（player/gait.js）
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// 見えるか: 距離・向き・間の地面（プレイヤーの動き方で変わる。player.md「動き方」）
function canSee(m, p, terrain, aw) {
  const dx = p.x - m.x, dz = p.z - m.z, dist = Math.hypot(dx, dz);
  if (dist > m.def.sight * aw.sight) return false;
  if (!m.def.disguise && dist > aw.back && (Math.sin(m.yaw) * dx + Math.cos(m.yaw) * dz) / dist < FRONT) return false;
  const y0 = m.y + 0.5, y1 = p.y + (p.eyeH ?? 0.9); // 的の高さは体の高さ（しゃがめば低い）
  for (let k = 1.5; k < dist; k += 1.5) {
    const u = k / dist;
    if (terrain.solidAt(m.x + dx * u, y0 + (y1 - y0) * u, m.z + dz * u)) return false;
  }
  return true;
}

// 一番近い深い水の場所（カニが逃げる先）
function seaNear(m, terrain) {
  for (let r = 6; r <= 40; r += 6) {
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8, x = m.x + Math.sin(a) * r, z = m.z + Math.cos(a) * r;
      if (terrain.waterLevel - terrain.heightAt(x, z) > 0.6) return { x, z };
    }
  }
  return null;
}

const ARC = 0.3; // 弧を描いて追う曲げ方（ラジアン。表の arc がなければ）
const FEINT = 0.35; // フェイントで横へ跳ねる秒
const DASH = [0.6, 1.2]; // 突進の緩急: 速さ = dash × (DASH[0] + DASH[1] × (1 - 進み)²)。出だし 1.8 倍 → 終わり 0.6 倍（平均 1 倍）

export function think(m, dt, { player, dead, hurt, steer, list, terrain, escape, wind, mud, rock, sand, shoot, dust, touch = 0, playerSpeed = 0 }) { // touch: 体がプレイヤーにふれる近さ（combat.js。これより近づけない）
  const p = player.state, def = m.def;
  const dx = p.x - m.x, dz = p.z - m.z, dist = Math.hypot(dx, dz);
  const low = def.low && m.hp / m.maxHp <= def.low.at ? def.low : null;
  const rage = low?.act === 'rage';
  const speed = (m.aware === 'fight' ? def.fight ?? def.speed : def.speed) * m.tier.speed * (rage ? low.speed ?? 1 : 1);
  m.model.setRage?.(rage);
  const efx = (a) => ({ wind, mud, rock, sand })[a?.fx] ?? null; // 攻撃の演出（windFx.js・mudFx.js・rockFx.js・sandFx.js）。敵の行の fx はいつもの演出（tick）
  if (rage && m.aware === 'fight') { mud?.rage(m, dt); rock?.rage(m, dt); } efx(def)?.tick?.(m, dt, !!low && !rage && m.aware === 'fight'); // 怒り: 口から火花（口のある敵だけ）、排気管から火の粉（採掘ロボ）。カニの排水口のしずく（逃げる間はしぶき）
  m.alertT = Math.max(0, (m.alertT ?? 0) - dt);
  m.snapT = Math.max(0, (m.snapT ?? 0) - dt);
  if (m.aware === 'fight' && m.lastAware !== 'fight' && m.lastAware !== undefined) { m.model.alert?.(); m.snapT = 0.4; if (m.model.disguised) { rock?.shell(m); if (def.roar) { m.state = 'stagger'; m.t = def.roar; m.model.setPose('roar', def.roar); } } } // 叩かれて気づいた・2 秒見えて気づいた。岩の殻から出て吠える（go はこの下で作るので直接）
  if (def.pack && m.aware === 'fight' && m.lastAware !== 'fight') callPack(m, list); // 群れ: まわりの仲間が加勢に来る
  m.lastAware = m.aware;
  m.model.curious?.(m.aware === 'sus'); // 「？」で首をかしげる
  m.hopY = 0;
  if (m.cd) for (const k in m.cd) m.cd[k] -= dt; // 攻撃ごとの待ち（表の cd）
  const vary = () => 1 + (Math.random() * 2 - 1) * (def.vary ?? 0); // ため・休みの長さのばらつき
  const go = (state, t = 0, pose = state) => { m.state = state; m.t = t; m.model.setPose(pose, t); }; // t: ためる秒（ポーズの緩急）
  const turnTo = (x, z, k = 1) => { // 向きを (x, z) へ、表の turn の速さまで。回る速さもなめらかに変わる（急に回り出さない・止まらない）
    const want = Math.atan2(x, z), d = wrap(want - m.yaw), s = (def.turn ?? 8) * k * (m.snapT > 0 ? 2 : 1);
    const rate = Math.max(-s, Math.min(s, d / 0.12));
    m.yawV = (m.yawV ?? 0) + (rate - (m.yawV ?? 0)) * Math.min(1, dt * 16);
    m.yaw = wrap(m.yaw + (Math.abs(m.yawV * dt) > Math.abs(d) ? d : m.yawV * dt));
    return Math.abs(d);
  };
  // 弧を描いて追う（enemies.md「なめらかな歩き」）: プレイヤーへの向きを、回る向き（ときどき変える）の側へ arc ラジアンまで曲げる。近いほどまっすぐ。
  // 囲む横ずれ（steer.surround。正なら左回り）も角度にして、なめらかに増やしたり減らしたりする
  const arcTo = (x, z, d, side = 0) => {
    if ((m.arcT = (m.arcT ?? 0) - dt) <= 0) { m.arcDir = Math.random() < 0.5 ? 1 : -1; m.arcT = 2 + Math.random() * 3; }
    const want = (def.arc ?? ARC) * m.arcDir * Math.min(1, Math.max(0, (d - 2) / 6)) - Math.max(-1.1, Math.min(1.1, side * 1.4));
    m.arcA = (m.arcA ?? 0) + (want - (m.arcA ?? 0)) * Math.min(1, dt * 2.5);
    const c = Math.cos(m.arcA), s = Math.sin(m.arcA);
    return [x * c - z * s, x * s + z * c];
  };
  const walk = (x, z, sp) => { const ok = steer.move(m, x, z, sp, dt, list); turnTo(Math.sin(m.heading ?? 0), Math.cos(m.heading ?? 0)); return ok; };
  const idlePose = m.mode === 'fake' ? 'fake' : def.disguise ? 'disguise' : 'idle';
  const fight = () => { // 戦いはじめ（ビクッと跳ねるのは上の「気づいた」で）。同じスポットの寝ている仲間も起きる
    m.aware = 'fight'; m.alertT = ALERT; go('chase', 0, 'move');
    if (m.spot) for (const o of list) if (o !== m && o.spot === m.spot && o.asleep) o.noise = true;
  };
  const calm = () => { m.aware = 'none'; m.seen = m.lost = 0; go('return', 0, 'move'); };
  m.t -= dt;

  // ---- 番人（enemies.md「番人」）: 寝ている・死んだふり ----
  if (m.asleep) { // 近づく（4m）・近くを走る（6m）・音（noise）・叩かれる で起きる。歩いていれば 4m まで近づける
    if (m.state !== 'sleep') go('sleep');
    if (!dead && (dist < 4 || (dist < 6 && playerSpeed > 5.5) || m.noise)) { m.asleep = m.noise = false; fight(); }
    return;
  }
  if (m.mode === 'fake' && !m.awake) {
    if (m.aware === 'fight') m.awake = true; // 叩かれた
    else if (m.fakeT === undefined) { // 3m で目がかすかに点き、1 秒後に起きる
      if (m.state !== 'fake') go('fake');
      if (!dead && dist < 3) { m.fakeT = 1; m.model.setPose('fakeWake'); }
      return;
    } else {
      if ((m.fakeT -= dt) > 0) return;
      m.fakeT = undefined; m.awake = true; fight();
    }
  }

  if (m.state === 'flinch' || m.state === 'stagger') { if (m.t <= 0) go(m.aware === 'fight' ? 'chase' : 'idle', 0, m.aware === 'fight' ? 'move' : idlePose); return; }
  const gc = m.spotC ?? m.home; // 番人はスポットの中心から 35m（表の leash があればそれ）であきらめる
  if (m.aware !== 'none' && (dead || Math.hypot(m.x - gc.x, m.z - gc.z) > (def.leash ?? m.giveUpR ?? def.giveUp))) return calm();
  if (def.farGive && m.aware === 'fight') { // 遠い（farGive[0] m より）まま farGive[1] 秒たつとあきらめる
    m.farT = dist > def.farGive[0] ? (m.farT ?? 0) + dt : 0;
    if (m.farT >= def.farGive[1]) { m.farT = 0; return calm(); }
  }

  // ---- 気づき ----
  if (m.aware !== 'fight' && !dead && !(def.leash && m.state === 'return')) { // leash の敵は戻りきるまで気づかない（戻る・戦うをくり返さない）
    const aw = awareness(p), see = canSee(m, p, terrain, aw);
    if (m.aware === 'none' && see) {
      if (def.disguise) m.aware = 'fight'; // 岩のふり: 見つけたらすぐ
      else { m.aware = 'sus'; m.seen = m.lost = 0; }
    }
    if (m.aware === 'sus') {
      if (see) { m.seen += dt; m.lost = 0; m.last = { x: p.x, z: p.z }; if (m.seen >= aw.secs) m.aware = 'fight'; }
      else if ((m.lost += dt) >= LOSE) return calm();
    }
    if (m.aware === 'fight') fight();
  }

  if (m.aware === 'none') {
    if (m.called !== undefined && (m.called -= dt) <= 0) return escape(m); // 呼ばれて来たブンブン: 30 秒見つけられなければ消える
    if (m.state === 'return') {
      const hx = m.home.x - m.x, hz = m.home.z - m.z;
      if (Math.hypot(hx, hz) < 0.6 || !walk(hx, hz, speed)) {
        if (m.called !== undefined && dist < 40) return fight(); // カメラに着いた: そこから追う
        m.awake = false; // 死んだふりに戻る
        go('idle', 0, idlePose);
      }
    } else if (m.state !== 'idle') go('idle', 0, idlePose);
    else if (m.mode === 'visit') m.model.setPose('drink'); // 泉で冷却水を補給
    else if (m.mode === 'guard' && !def.disguise) { // 縄張りの中をゆっくり歩く
      const c = m.spotC ?? m.home;
      if (!m.wander && (m.wanderT = (m.wanderT ?? Math.random() * 6) - dt) <= 0) {
        const a = Math.random() * 6.28, d = Math.random() * 12;
        m.wander = { x: c.x + Math.sin(a) * d, z: c.z + Math.cos(a) * d };
        m.wanderT = 5 + Math.random() * 7;
      }
      if (m.wander) {
        const wx = m.wander.x - m.x, wz = m.wander.z - m.z;
        if (Math.hypot(wx, wz) < 1 || !walk(wx, wz, speed * 0.35)) { m.wander = null; m.model.setPose('idle'); } else m.model.setPose('move');
      }
    }
    return;
  }
  if (m.aware === 'sus') { // 見えた所へ見に行く（ゆっくり）
    const lx = m.last.x - m.x, lz = m.last.z - m.z;
    if (Math.hypot(lx, lz) > 1.2) { m.model.setPose('move'); walk(lx, lz, speed * 0.6); }
    else { m.model.setPose('idle'); turnTo(Math.sin(m.yaw + 1), Math.cos(m.yaw + 1), 0.3); } // 見回す
    return;
  }

  // ---- 戦う ----
  if (low && low.act !== 'rage') { // 逃げる（海へ・遠くへ）
    m.model.setPose(low.pose ?? 'move'); // カニははさみを上げてばたばた
    if (low.act === 'sea') {
      m.sea ??= seaNear(m, terrain);
      if (m.sea) walk(m.sea.x - m.x, m.sea.z - m.z, speed * 1.3);
      if (terrain.waterLevel - terrain.heightAt(m.x, m.z) > 0.5) escape(m); // 海に入って逃げ切った
    } else {
      walk(-dx, -dz, speed * 1.2);
      if (dist > def.sight + 5) calm();
    }
    return;
  }
  let front = null; // 群れ（pack.js）: 正面の犬
  if (def.pack?.flank) { front = packRole(m, list, p); m.sinceRel = (m.sinceRel ?? 9) + dt; }
  const aim = (a) => { // 向きと跳ぶ距離をプレイヤーへ合わせる
    m.dir = { x: dx / (dist || 1), z: dz / (dist || 1) };
    m.dashLeft = a.lunge ? Math.max(0, dist - a.lunge.stop) : a.dash ? (a.min ? dist + (a.over ?? 2) : a.reach + 1.5) : 0;
  };
  switch (m.state) {
    case 'chase': {
      const facing = Math.cos(wrap(Math.atan2(dx, dz) - m.yaw));
      const may = packMayAttack(m, list, front);
      if (def.wander && (!m.band || (m.wanT -= dt) <= 0)) pickWander(m, def.noRepeat ? m.lastBand : undefined); // ほしい距離をランダムに選び直す
      if (!may) m.flankWait = (m.flankWait ?? 0) + dt;
      const usable = (x) => dist <= x.reach && dist >= (x.min ?? 0) && !(m.cd?.[x.name] > 0) && (!(def.bands || def.wander) || !x.band || (x.band === m.band && (!def.wander || Math.abs(dist - m.wanD) < 1.6)) || (def.wander && dist < 2.2)); // 間合いに合う攻撃（犬はほしい距離の ±1.6m のとき。2.2m 以内なら噛める）
      let a = def.pick ? pickMelee(m, def.attacks, usable, facing, FACE) : may && def.attacks.find(usable);
      if (a && !def.pick && def.noRepeat && a.name === m.lastAtk) { // 同じ攻撃は続けて選ばない: 別の間合いへ変える
        a = def.attacks.find((x) => usable(x) && x.name !== m.lastAtk);
        if (!a) { m.lastBand = def.attacks.find((x) => x.name === m.lastAtk).band; pickWander(m, m.lastBand); }
      }
      if (a && (facing > FACE || a.around)) {
        m.atk = a; aim(a); m.flankWait = 0; m.lastAtk = a.name; m.lastBand = a.band;
        m.windT = a.windup * (rage ? low.windup ?? 1 : 1) * vary();
        m.feint = !!a.feint && Math.random() < a.feint; // フェイント: ためのあと跳ばずに横へ
        if (a.cd) (m.cd ??= {})[a.name] = a.cd;
        return go('windup', m.windT, a.wind ?? 'windup');
      }
      if (def.bands) { space(m, dt, { dx, dz, dist, speed, steer, list, px: p.x, pz: p.z }); turnTo(dx, dz); m.model.setPose('move'); return; } // 間合い取り（向きはいつもプレイヤーへ）
      if (a || dist < 1) { turnTo(dx, dz); m.model.setPose('idle'); return; } // 届くが向いていない: 向きを変える
      if (def.stagger) { // 走っている最中に足が止まる隙（every が [最小, 最大] ならランダム）
        const ev = def.stagger.every, next = () => (Array.isArray(ev) ? ev[0] + Math.random() * (ev[1] - ev[0]) : ev);
        if ((m.stagT = (m.stagT ?? next()) - dt) <= 0) { m.stagT = next(); mud?.stumble(m); return go('stagger', def.stagger.secs, m.model.poses.includes('stumble') ? 'stumble' : 'stagger'); }
      }
      m.model.setPose('move');
      if (m.role === 'flank' && front) { // 回り込み: 背中側・横へ回って待つ
        const s = flankSpot(m, front, p, dt), fx = s.x - m.x, fz = s.z - m.z;
        if (Math.hypot(fx, fz) > 1) walk(...arcTo(fx, fz, Math.hypot(fx, fz)), speed);
        else { m.model.setPose('idle'); turnTo(dx, dz); }
        return;
      }
      if (def.wander && wanderMove(m, dt, { dx, dz, dist, speed, steer, list, px: p.x, pz: p.z }) === 'done') { turnTo(dx, dz, 0.9); return; } // ほしい距離に合わせて下がる・横へ回る
      walk(...arcTo(dx, dz, dist, steer.surround(m, p.x, p.z, list)), speed);
      return;
    }
    case 'windup': { // 向きはためを始めたときのまま（弾は撃つときにねらう）。track があれば、跳ぶ track 秒前までねらい直す
      const a = m.atk, u = 1 - Math.max(0, m.t) / m.windT, e = efx(a);
      if (a.track && m.t > a.track) { aim(a); turnTo(dx, dz, 1.5); }
      e?.charge(m, a, u, dt);
      if (a.dust ?? a.fx === 'wind') dust?.(m, u, dt);
      if (m.t <= 0) {
        if (m.feint) { m.feint = false; m.sideDir = Math.random() < 0.5 ? 1 : -1; return go('feint', FEINT, 'move'); }
        m.hitDone = false; m.prog = 0; m.biteN = 0; m.sinceRel = 0; m.landed = false;
        go('attack', a.lunge ? a.lunge.time + (a.secs ?? 0.25) : a.dash ? m.dashLeft / a.dash : a.hits ? a.hits * a.gap + 0.1 : a.secs ?? 0.25, a.lunge?.air ?? a.hit ?? 'attack');
        e?.release(m, a);
      }
      return;
    }
    case 'feint': { // 跳ばずに横へ跳ねて、回り込みに戻る
      const u = 1 - Math.max(0, m.t) / FEINT, l = dist || 1;
      steer.move(m, dz / l * m.sideDir, -dx / l * m.sideDir, speed * 1.6, dt, list, 0.05);
      m.hopY = Math.sin(Math.min(1, u) * Math.PI) * 0.25;
      turnTo(dx, dz);
      if (m.t <= 0) go('chase', 0, 'move');
      return;
    }
    case 'attack': {
      const a = m.atk, e = efx(a);
      if (a.dash) { // 出だしが一番速く、終わりで減速（同じ時間で同じ距離）
        m.prog += dt;
        const T = m.dashLeft / a.dash, u = Math.min(1, m.prog / T);
        if (!steer.move(m, m.dir.x, m.dir.z, a.dash * (DASH[0] + DASH[1] * (1 - u) ** 2), dt, list, 0.04)) m.t = 0; // 壁や岩にぶつかったら止まる
        if (a.hop) m.hopY = Math.sin(u * Math.PI) * a.hop; // 跳びかかる
      }
      if (a.hits) { // 続けて噛む: gap 秒ごとに。2 回目は向きを直して噛み直す（無敵を無視）
        m.prog += dt;
        const n = Math.min(a.hits - 1, Math.floor(m.prog / a.gap));
        if (n > m.biteN) { m.biteN = n; m.hitDone = false; aim(a); m.model.setPose(a.hit2 ?? a.hit); e?.release(m, a, n); m.sinceRel = 0; }
        if (m.biteN) turnTo(m.dir.x, m.dir.z, 2);
        steer.move(m, m.dir.x, m.dir.z, a.step / (a.hits * a.gap), dt, list, 0.05);
      }
      if (a.lunge && lungeStep(m, a, dt, steer, list)) { m.landAt = m.t; if (a.lunge.air) m.model.setPose(a.hit); e?.impact?.(m, a); } // 踏み込み: 着地で振り下ろす
      e?.during(m, a, dt);
      if (a.dust ?? a.fx === 'wind') dust?.(m, 1, dt);
      if (a.kind === 'shot' && !m.hitDone) { // 撃つ: 画面の前（犬は前脚）から、今のプレイヤーの胸へ。n があれば扇に
        m.hitDone = true;
        const fx = Math.sin(m.yaw), fz = Math.cos(m.yaw), n = a.n ?? 1;
        const from = { x: m.x + fx * 0.4, y: m.y + (a.fx === 'mud' ? 0.3 : 0), z: m.z + fz * 0.4 };
        const tx = p.x - from.x, tz = p.z - from.z;
        for (let i = 0; i < n; i++) {
          const k = (i - (n - 1) / 2) * (a.fan ?? 0), c = Math.cos(k), s = Math.sin(k);
          shoot?.(a, from, { x: tx * c - tz * s, y: p.y + 0.8 - from.y, z: tx * s + tz * c });
        }
      }
      if (!m.hitDone && !dead && !(a.lunge?.air && !(m.landed && m.landAt - m.t < 0.1))) { // 跳ぶ技は着地の瞬間（0.1 秒）だけ当たる
        const toY = p.y + 0.5 - (m.y + m.hopY);
        const pd = Math.hypot(p.x - m.x, p.z - m.z);
        const near = a.kind === 'spin' ? pd < a.area && Math.abs(toY) < 1.5 && !(a.ground && !p.onGround) // まわり: 範囲の中に入ったら（ground は地面の上だけ。跳べばよけられる）
          : a.dash ? Math.hypot(pd, Math.max(0, Math.abs(toY) - 0.4)) < Math.max(HIT_R, touch) + 0.3 // 体当たり: ぶつかったら（大きい敵は体の幅で）
            : pd < (a.hitR ?? a.reach) && inCone(a, m, p.x, p.z, pd); // 振る・噛む: 決めた向きの左右 cone 度の中にいれば（hitR: 当たる距離。なければ使う距離）
        if (near) { // 続けて噛むときは、最後の 1 回の前は少しだけ押す（pushEach。押しすぎると 2 回目が届かない）
          m.hitDone = true;
          const last = !a.hits || m.biteN === a.hits - 1;
          hurt(Math.round(a.dmg * m.tier.dmg), a.hits ? { ...a, again: m.biteN > 0, push: last ? a.push : a.pushEach ?? a.push } : a);
        }
      }
      if (m.t <= 0) {
        if (a.miss && !m.hitDone) { e?.land?.(m); return go('stagger', a.miss, m.model.poses.includes('stumble') ? 'stumble' : 'stagger'); } // 外した: 着地でつんのめる
        go('rest', a.rest * (rage ? low.rest ?? 1 : 1) * vary(), a.stuck ? 'stuck' : 'idle');
        m.stuckT = a.stuck ?? 0; // 刺さって抜けない: この間は向きも変えない
      }
      return;
    }
    case 'rest': // 休む。間合い取りの敵は動き続ける（風の弾は寄りながら撃つ）。ほかの飛ぶ敵は少し下がる
      if (def.bands) { // 放出のあとの戻り（0.45 秒）はほとんど動かない（隙）
        const settled = m.t < m.atk.rest - 0.45;
        space(m, dt, { dx, dz, dist, speed, steer, list, px: p.x, pz: p.z, k: settled ? 0.8 : 0.15 });
        turnTo(dx, dz, settled ? 1 : 0.3);
        if (settled) m.model.setPose('move');
      }
      else if ((m.stuckT -= dt) > 0) return;
      else { if (m.stuckT > -dt) m.model.setPose('idle'); turnTo(dx, dz); }
      if (!def.bands && def.hover && dist < 3) steer.move(m, -dx, -dz, speed * 0.5, dt, list);
      if (m.t <= 0) go('chase', 0, 'move');
      return;
    default:
      go('chase', 0, 'move');
  }
}
