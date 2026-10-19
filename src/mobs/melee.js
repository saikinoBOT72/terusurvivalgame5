// 近距離の技の選び方（表の pick: 'weight' の敵。採掘ロボ。enemies.md「採掘ロボ」）
// 届く技のうち、前の技と違うものを重み w でランダムに選ぶ。around の技（自分のまわりに当たる）は向いていなくても出せる。
// プレイヤーが背中側（前 90 度の外）にいて around の技が使えれば、それを先に選ぶ（振り向くより早い）
const BACK = Math.cos(Math.PI / 4);

// usable: 距離と待ちが合うか、facing: プレイヤーへの向きの cos、face: 攻撃に入れる向きの cos
export function pickMelee(m, attacks, usable, facing, face) {
  const ok = attacks.filter((a) => usable(a) && a.name !== m.lastAtk && (a.around || facing > face));
  if (!ok.length) return null;
  if (facing < BACK) { const b = ok.find((a) => a.around); if (b) return b; }
  let r = Math.random() * ok.reduce((s, a) => s + (a.w ?? 1), 0);
  for (const a of ok) if ((r -= a.w ?? 1) <= 0) return a;
  return ok[ok.length - 1];
}

// 振る・噛む: 決めた向き dir から左右 cone 度（なければ 45 度）の中か
export const inCone = (a, m, px, pz, pd) => ((px - m.x) * m.dir.x + (pz - m.z) * m.dir.z) / (pd || 1) > Math.cos(((a.cone ?? 45) * Math.PI) / 180);

// 踏み込み（表の lunge。採掘ロボ）: time 秒で、決めた向き m.dir へ m.dashLeft m 進む（hop があれば弧を描いて跳ぶ）。
// 岩や壁にぶつかったら、そこで着地。着地した瞬間に true を返す（空中のポーズから放出のポーズへ、着地の演出、当たりの判定）
export function lungeStep(m, a, dt, steer, list) {
  const L = a.lunge;
  if (m.landed) return false;
  const step = Math.min(dt, L.time - m.prog); // 最後の 1 歩で行き過ぎない
  m.prog += dt;
  const u = Math.min(1, m.prog / L.time);
  const ok = step <= 0 || steer.move(m, m.dir.x, m.dir.z, m.dashLeft / L.time * step / dt, dt, list, 0.04);
  if (L.hop) m.hopY = Math.sin(u * Math.PI) * L.hop;
  if (u < 1 && ok) return false;
  m.landed = true; m.hopY = 0; m.vx = m.vz = 0; // 着地でぴたりと止まる（慣性で滑らない）
  return true;
}
