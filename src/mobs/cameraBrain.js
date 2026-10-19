// 監視カメラの動き（docs/rules/enemies.md「監視カメラ」）。動かない。首を振って見張り、見つけると警報でブンブンを呼ぶ
// 気づいていない（首を振る）→ 正面 30 度・水平 25m に見えたら「？」（首を止めてプレイヤーへ向け、ランプが点滅）
// → 2 秒見え続けたら「！」警報（ランプが赤く光り続ける。ブンブン 3 体を呼ぶ。60 秒は次を呼ばない）→ 5 秒見えなければ戻る
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
import { awareness } from '../player/gait.js';
const CONE = Math.PI / 12, LOSE_SUS = 2, LOSE_FIGHT = 5, COOL = 60; // 「！」までの秒と見える距離はプレイヤーの動き方で変わる（gait.js）

// 間に地面がなく、水平の距離が sight（動き方の倍率つき）の中か（高さは数えない）
function visible(m, p, terrain) {
  const dx = p.x - m.x, dz = p.z - m.z, dist = Math.hypot(dx, dz);
  if (dist > m.def.sight * awareness(p).sight) return false;
  const y0 = m.y + 1.9, y1 = p.y + (p.eyeH ?? 0.9);
  for (let k = 1.5; k < dist; k += 1.5) {
    const u = k / dist;
    if (terrain.solidAt(m.x + dx * u, y0 + (y1 - y0) * u, m.z + dz * u)) return false;
  }
  return true;
}

export function thinkCamera(m, dt, { player, terrain, dead, alarm }) {
  const p = player.state, look = wrap(Math.atan2(p.x - m.x, p.z - m.z) - m.yaw); // 体の向きから見たプレイヤーの向き
  const see = !dead && visible(m, p, terrain);
  m.cool = Math.max(0, (m.cool ?? 0) - dt);
  m.alertT = Math.max(0, (m.alertT ?? 0) - dt);
  if (m.state === 'flinch') m.state = 'idle';
  if (m.aware === 'fight') { // 警報: 首はプレイヤーへ
    m.model.look(look);
    m.model.setPose('attack');
    m.lost = see ? 0 : (m.lost ?? 0) + dt;
    if (m.lost > LOSE_FIGHT) { m.aware = 'none'; m.model.setPose('idle'); }
    return;
  }
  if (m.aware === 'sus') { // 見つけかけ: 首を止めてプレイヤーへ向け、点滅
    m.model.look(look);
    m.model.setPose('windup');
    if (see) {
      m.lost = 0;
      if ((m.seen += dt) >= awareness(p).secs) {
        m.aware = 'fight'; m.alertT = 1; m.lost = 0;
        if (m.cool <= 0) { m.cool = COOL; alarm(m); }
      }
    } else if ((m.lost += dt) > LOSE_SUS) { m.aware = 'none'; m.model.setPose('idle'); }
    return;
  }
  m.model.setPose('idle'); // 首を振って見張る
  if (see && Math.abs(wrap(look - m.model.yaw)) < CONE) { m.aware = 'sus'; m.seen = 0; m.lost = 0; }
}
