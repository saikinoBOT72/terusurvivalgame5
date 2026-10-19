// プレイヤーの戦い方（docs/rules/weapons.md）: スタミナ（走る・泳ぐも）、ステップ（X）、ため攻撃、ガードと受け流し、受けたとき（無敵・押し戻し・揺れ・来た向き）
// 数値は下の表（STAM など）と items.js（武器の stam・heavy）
import * as THREE from 'three';
import { ITEMS } from '../survival/items.js';
import { weaponOf } from '../mobs/combat.js';
import { COST } from '../player/gait.js';

export const STAM = {
  max: 100, regen: 30, wait: 0.8, // 使わずに wait 秒たつと 1 秒に regen 戻る
  dodge: 25, dodgeDist: 1.8, dodgeSecs: 0.2,
  iframe: 0.5, // 受けたあと次を受けない秒
  push: 2, pushSecs: 0.3, // 押し戻し: 攻撃の push（m）の倍率と秒
  // 受けたときの揺れの重さ（攻撃力 at ごと。間は線でつなぐ）: 大きさ、秒、速さ（1 秒の回数）、視点の横の傾き（ラジアン）。kick: 視点が上へはねる
  shake: [{ at: 10, amp: 0.06, secs: 0.25, freq: 22, roll: 0 }, { at: 30, amp: 0.14, secs: 0.4, freq: 14, roll: 0.04 }, { at: 50, amp: 0.24, secs: 0.6, freq: 8, roll: 0.09 }], kick: 0.05,
  guardCut: 0.5, guardCone: Math.cos(Math.PI / 3), parry: 0.2, parryStun: 1.5,
  slow: 0.5, // ため・ガード中の歩く速さ
  tap: 0.2, // これより短く押したらふつうの攻撃
};

// 攻撃力 n の揺れ方（STAM.shake の表の間を線でつなぐ）
export function shakeOf(n) {
  const T = STAM.shake;
  if (n <= T[0].at) return T[0];
  for (let i = 1; i < T.length; i++) {
    if (n <= T[i].at) {
      const a = T[i - 1], b = T[i], k = (n - a.at) / (b.at - a.at), o = {};
      for (const key of ['amp', 'secs', 'freq', 'roll']) o[key] = a[key] + (b[key] - a[key]) * k;
      return o;
    }
  }
  return T[T.length - 1];
}

// 近接で戦える物か（敵への攻撃力がある、遠距離武器でない）
export const isMelee = (id) => !!ITEMS[id]?.dmg?.mob && !ITEMS[id]?.ranged;

export function createPlayerCombat({ player, stats, hud, statusHud, onStagger = () => {} }) {
  const s = { stam: STAM.max, rest: 0, iframe: 0, charge: -1, guard: -1, now: 0, slowT: 0, slowK: 1 }; // slowT・slowK: 泥などの鈍足（秒・倍率）
  let cdEnd = 0, cdLen = 0; // 攻撃間隔（weapons.md「攻撃間隔」）。遊びの外でも進むように時計の秒で持つ
  const clock = () => performance.now() / 1000;
  const p = () => player.state;
  const spend = (n) => { s.rest = 0; s.stam = Math.max(0, s.stam - n); };
  const canMove = () => !p().ride && !p().swimming && !stats.state.dead;

  return {
    state: s,
    // ステップ: 移動キーの向き（なければ後ろ）へ
    dodge() {
      if (!canMove() || !p().onGround || s.stam < STAM.dodge || player.shoving) return false;
      let { x, z } = p().wish;
      if (!x && !z) { x = Math.sin(p().yaw); z = Math.cos(p().yaw); } // 後ろ
      player.shove(x, z, STAM.dodgeDist, STAM.dodgeSecs);
      s.iframe = Math.max(s.iframe, STAM.dodgeSecs); s.hitIframe = false;
      spend(STAM.dodge);
      return true;
    },
    // 攻撃間隔: 振ったら secs 秒は次を振れない。cooling: まだ満ちていない、cdFrac: 満ち具合 0〜1（満ちていれば null）
    startCd(secs) { cdLen = secs; cdEnd = clock() + secs; },
    get cooling() { return clock() < cdEnd; },
    cdFrac() { const left = cdEnd - clock(); return left > 0 && cdLen > 0 ? 1 - left / cdLen : null; },
    // ため攻撃: 押した → 離した。離したときの攻撃力の倍率を返す（短く押した・スタミナが足りない → 1）
    chargeStart() { s.charge = 0; },
    get charging() { return s.charge >= 0; },
    chargeEnd(held) {
      const t = s.charge;
      s.charge = -1;
      player.arms.setPose('charge', 0);
      const w = weaponOf(held);
      if (t < STAM.tap) { spend(w.stam); return 1; }
      const k = Math.min(1, t / w.heavy.hold);
      if (k < 1 || s.stam <= 0) { spend(w.stam); return 1; }
      spend(w.stam * 2);
      return w.heavy.mult;
    },
    cancelCharge() { s.charge = -1; player.arms.setPose('charge', 0); },
    // ガード: 右クリックを押している間（近接武器）
    // ガード中は攻撃できない（ためも取りやめ。weapons.md「武器の動きと演出」）
    guardStart(held) { if (isMelee(held) && s.stam > 0 && canMove()) { if (s.charge >= 0) this.cancelCharge(); s.guard = 0; player.arms.setPose('guard', 1); } },
    guardEnd() { s.guard = -1; player.arms.setPose('guard', 0); },
    get guarding() { return s.guard >= 0; },
    // 敵の攻撃が当たった。受けたダメージを返す（記録に出す）
    onHit(n, m, atk) {
      if ((s.iframe > 0 && !(atk.again && s.hitIframe)) || stats.state.dead) return 0; // 同じ攻撃の 2 回目（again）は、受けた無敵を無視（ステップの無敵は効く）
      const st = p(), dx = m.x - st.x, dz = m.z - st.z, l = Math.hypot(dx, dz) || 1;
      const front = (-Math.sin(st.yaw) * dx - Math.cos(st.yaw) * dz) / l > STAM.guardCone;
      let got = n;
      if (s.guard >= 0 && front) {
        if (s.guard <= STAM.parry) { if (!m.shot) onStagger(m, STAM.parryStun); s.iframe = STAM.iframe; player.arms.parry(); return 0; } // 受け流し（弾は消えるだけ）。閃光と火花
        const cut = Math.round(n * STAM.guardCut), paid = Math.min(cut, s.stam);
        spend(paid);
        got = n - paid;
        if (s.stam <= 0) this.guardEnd();
      }
      if (got > 0) stats.damage(got);
      s.iframe = STAM.iframe; s.hitIframe = true;
      if (atk.push) player.shove(-dx, -dz, atk.push * STAM.push, atk.pushSecs ?? STAM.pushSecs);
      if (atk.lift) player.lift(atk.lift); // 吹き飛ばし: 上へも浮く
      const guarded = got < n, sh = shakeOf((atk.shake ?? n) * (atk.again ? 1.3 : 1)); // 揺れ方は受けた攻撃力で（ガードで受けたら大きさ半分）
      const side = Math.sign(Math.cos(st.yaw) * dx - Math.sin(st.yaw) * dz) || 1; // 右から来たら左へ傾く
      player.shake(sh.amp * (guarded ? 0.5 : 1), sh.secs, STAM.kick, { freq: sh.freq, roll: sh.roll * side * (guarded ? 0.5 : 1) });
      if (guarded) player.arms.guardHit(n); else player.arms.hurt(n);
      hud.hurtFrom(new THREE.Vector3(m.x, m.y, m.z));
      if (atk.smear && !guarded) hud.mud(atk.slow?.[1] ?? 0); // 画面のふちに泥（ui.md「泥」）
      if (atk.slow && !guarded) { s.slowK = atk.slow[0]; s.slowT = atk.slow[1]; } // 鈍足（weapons.md）
      return got;
    },
    update(dt, held) {
      s.now += dt;
      s.iframe = Math.max(0, s.iframe - dt);
      if (s.charge >= 0) {
        if (!isMelee(held) || stats.state.dead) this.cancelCharge();
        else {
          s.charge += dt;
          player.arms.setPose('charge', s.charge < STAM.tap ? 0 : Math.min(1, s.charge / weaponOf(held).heavy.hold));
        }
      }
      if (s.guard >= 0) { s.guard += dt; s.rest = 0; if (!isMelee(held) || !canMove()) this.guardEnd(); } // 構えている間は戻らない
      s.slowT = Math.max(0, s.slowT - dt);
      p().slow = Math.min(s.charge >= STAM.tap || s.guard >= 0 ? STAM.slow : 1, s.slowT > 0 ? s.slowK : 1);
      // 走る・泳ぐのスタミナ（weapons.md）: 使っている間は戻らない。0 で走れなくなり、20 たまるまで走れない。泳いで 0 だと浮けない
      const st = p(), cost = st.swimming ? (st.gait === 'run' ? COST.swimFast : st.moving ? COST.swim : COST.float) : st.gait === 'run' && st.moving ? COST.run : 0;
      if (cost) { s.rest = 0; s.stam = Math.max(0, s.stam - cost * dt); }
      if (s.stam <= 0) s.tired = true; else if (s.stam >= COST.resume) s.tired = false;
      st.canRun = !s.tired;
      st.canFloat = s.stam > 0;
      if ((s.rest += dt) >= STAM.wait) s.stam = Math.min(STAM.max, s.stam + STAM.regen * dt);
      statusHud.stamina(Math.round(s.stam), STAM.max);
    },
  };
}
