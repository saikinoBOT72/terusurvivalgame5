// 敵の歩き方（enemies.md「動き方」）: 木・岩・崖・水を回り込む、敵どうし重ならない、同じプレイヤーを追う敵はまわりに散らばる
// 飛ぶ敵（hover）は回り込まず、木や岩の上を越える。慣性: 速さと向きは INERTIA 秒くらいでなめらかに変わる（enemies.md「戦闘の演出」）
import { bodyBox } from './combat.js';

const PROBE = 1.2; // 前を調べる距離（m）
const LOOK = 3, LOOK_TURN = 1.05; // 早めに曲がるために先を調べる距離（m。速いほど遠く、ここまで）と、そのために曲がってよい角度（約 60 度。それより大きく曲がるなら近くだけ見る）
const STEP = 0.2, MAX_TURN = 2.6; // 前がふさがっていたら試す向きの刻みと最大（ラジアン、左右。約 11 度ずつ）
const SPACE = 2, AHEAD = 0.5; // 敵どうし: 自分の場所（体の半径の何倍）、ぶつかりそうか先を見る秒
const CLIMB = 1; // 1m 進むあいだに上がれる高さ
const SHALLOW = 0.25; // 歩く敵が入れる水の深さ
const INERTIA = 0.15; // 速さが変わる早さ（秒）

export const radiusOf = (kind) => { const b = bodyBox(kind); return Math.max(0.2, Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * 0.4); };
const heightOf = (kind) => { const b = bodyBox(kind); return b.max.y - b.min.y; };

export function createSteer({ terrain, blockers }) {
  const blocked = (m, x, z) => {
    const y = terrain.floorAt(x, m.y + 1, z), h = heightOf(m.kind);
    return blockers(x, z, radiusOf(m.kind)).some((c) => c.top > y + 0.35 && (c.bottom ?? -Infinity) < y + h);
  };
  // (x, z) に立てるか（今いる所から歩いて行けるか）。今いる所が水の中・物の中なら、抜け出す向きは許す
  function free(m, x, z) {
    if (m.def.hover) return true;
    const d = Math.hypot(x - m.x, z - m.z) || 1, up = CLIMB * Math.max(d, 0.5);
    const g0 = terrain.floorAt(m.x, m.y + 0.5, m.z), g = terrain.floorAt(x, g0 + up + 0.01, z);
    if (g - g0 > up) return false; // 崖
    if (terrain.ceilingAt(x, g + 0.05, z) < g + heightOf(m.kind)) return false; // 天井（洞窟・ひさし）
    const deep = terrain.waterLevel - g;
    if (!m.def.swim && deep > SHALLOW && deep > terrain.waterLevel - g0 - 0.01) return false; // 深い水
    return !blocked(m, x, z) || blocked(m, m.x, m.z);
  }

  // 飛ぶ敵の高さ: 地面か水の上 hover m。下に木・岩があれば、その上を越える
  function flyY(m) {
    const g = Math.max(terrain.heightAt(m.x, m.z), terrain.waterLevel) + m.def.hover;
    const top = blockers(m.x, m.z, radiusOf(m.kind)).reduce((a, c) => Math.max(a, c.top), -Infinity);
    return Math.max(g, top + 0.5);
  }

  // 敵どうし（enemies.md「重ならない」）: 自分の場所（半径の SPACE 倍）の中の相手から、近いほど強くなめらかに離れる向き。
  // 0.5 秒先にぶつかりそうな相手がいれば、早めに横へずれてすれ違う
  function apart(m, ax, az, speed, others) {
    const r = radiusOf(m.kind);
    let px = 0, pz = 0;
    for (const o of others) {
      if (o === m || o.state === 'down') continue;
      const ox = m.x - o.x, oz = m.z - o.z, d = Math.hypot(ox, oz), touch = r + radiusOf(o.kind), room = touch * SPACE;
      if (d > room + speed * AHEAD + 2 || d < 1e-3) continue;
      if (d < room) { // 近いほど強く（ふれる近さで 1、さらに重なると強く）
        const w = ((room - d) / (room - touch * 0.5)) ** 2 * 2.2;
        px += (ox / d) * w; pz += (oz / d) * w;
      }
      // 先を見る: 相手から見た自分の速さで、0.5 秒のうち一番近づく所
      const rvx = ax * speed - (o.vx ?? 0), rvz = az * speed - (o.vz ?? 0), rv2 = rvx * rvx + rvz * rvz;
      if (rv2 < 0.01) continue;
      const t = Math.max(0, Math.min(AHEAD, -(ox * rvx + oz * rvz) / rv2));
      const cx = ox + rvx * t, cz = oz + rvz * t, cd = Math.hypot(cx, cz);
      if (t <= 0 || cd > touch * 1.4) continue;
      const w = (1 - cd / (touch * 1.4)) * (1 - t / AHEAD) * 1.2; // 横へずれる（一番近い所で相手から離れる側）
      const s = cd > 1e-3 ? Math.sign(cx * az - cz * ax) || 1 : (m.side ?? 1);
      px += az * s * w; pz += -ax * s * w;
    }
    return [px, pz];
  }

  // (dx, dz) の向きへ speed で進む。ふさがっていれば左右に細かく向きを変えて回り込む（少し先まで見て早めに曲がる。同じ側を覚えて、行ったり来たりしない）
  // quick: 慣性の秒（突進は短く）。今の速さ m.vx・m.vz から、なめらかに目標の速さへ。体の向き m.heading は実際に動いている向き
  function move(m, dx, dz, speed, dt, others = [], quick = INERTIA) {
    const l = Math.hypot(dx, dz);
    if (l < 1e-4 || speed <= 0) return false;
    let ax = dx / l, az = dz / l;
    const [px, pz] = apart(m, ax, az, speed, others);
    ax += px; az += pz;
    const al = Math.hypot(ax, az) || 1;
    ax /= al; az /= al;
    m.side ??= Math.random() < 0.5 ? 1 : -1;
    const look = m.def.hover || quick < INERTIA ? 0 : Math.min(LOOK, PROBE + speed * 0.25); // 突進（quick が短い）は先を見ない
    let pick = null;
    for (const far of look ? [look, 0] : [0]) { // まず遠くまで空いている向き、なければ近くだけ空いている向き
      for (let a = 0; a <= (far ? LOOK_TURN : MAX_TURN) && !pick; a += STEP) {
        for (const sgn of a ? [m.side, -m.side] : [1]) {
          const c = Math.cos(a * sgn), s = Math.sin(a * sgn);
          const vx = ax * c - az * s, vz = ax * s + az * c;
          if (far && !free(m, m.x + vx * far, m.z + vz * far)) continue;
          if (!free(m, m.x + vx * PROBE, m.z + vz * PROBE)) continue;
          if (!free(m, m.x + vx * speed * dt, m.z + vz * speed * dt)) continue;
          if (a) m.side = sgn; // 回り込んだ側を覚える
          pick = [vx, vz];
          break;
        }
      }
      if (pick) break;
    }
    if (!pick) { m.vx = m.vz = 0; return false; } // どこへも行けない
    const [vx, vz] = pick;
    const f = 1 - Math.exp(-dt / quick);
    m.vx = (m.vx ?? 0) + (vx * speed - (m.vx ?? 0)) * f;
    m.vz = (m.vz ?? 0) + (vz * speed - (m.vz ?? 0)) * f;
    const ix = m.x + m.vx * dt, iz = m.z + m.vz * dt;
    if (free(m, ix, iz)) { m.x = ix; m.z = iz; } else { m.vx = vx * speed; m.vz = vz * speed; m.x += m.vx * dt; m.z += m.vz * dt; }
    if (Math.hypot(m.vx, m.vz) > 0.05) m.heading = Math.atan2(m.vx, m.vz);
    m.moved = true;
    return true;
  }

  // このフレームに動かなかった敵: 残った速さで少し流れて止まる
  function coast(m, dt) {
    const v = Math.hypot(m.vx ?? 0, m.vz ?? 0);
    if (v < 0.05) { m.vx = m.vz = 0; return; }
    const f = Math.exp(-dt / INERTIA);
    m.vx *= f; m.vz *= f;
    const nx = m.x + m.vx * dt, nz = m.z + m.vz * dt;
    if (free(m, nx, nz)) { m.x = nx; m.z = nz; } else m.vx = m.vz = 0;
  }

  // 同じ相手を追う敵どうし: 相手のまわりで角度が近ければ、横へずれる向きを返す（囲む）
  function surround(m, px, pz, list) {
    const a = Math.atan2(m.x - px, m.z - pz);
    let push = 0;
    for (const o of list) {
      if (o === m || o.aware !== 'fight' || o.state === 'down' || Math.hypot(o.x - px, o.z - pz) > 6) continue;
      let d = a - Math.atan2(o.x - px, o.z - pz);
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 0.9) push += Math.sign(d || 1) * (0.9 - Math.abs(d));
    }
    return push; // 正なら左回り（a が増える向き）へ
  }

  return { free, flyY, move, coast, surround };
}
