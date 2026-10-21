// 倒した生き物の体（docs/rules/creatures.md「倒したあと: 肉を取る・皮をはぐ」）
// 倒れて 60 秒残る・撃たれた鳥は落ちる・右クリックで肉（石のナイフで皮も）。体は 1 回で消える
import * as THREE from 'three';
import { ITEMS } from '../survival/items.js';

export const CARCASS_SECS = 60;
const SINK_SECS = 1; // 最後に地面へ沈む秒
const REACH = 2.5;
const _s = new THREE.Sphere(), _r = new THREE.Ray(), _c = new THREE.Vector3(), _h = new THREE.Vector3();

// 体が残る間: 空中なら落ちる、倒れた向きへ少し滑る、最後は沈む。消えるとき false
export function carcass(m, dt, terrain) {
  m.vx = (m.vx ?? 0) * Math.exp(-dt * 4); m.vz = (m.vz ?? 0) * Math.exp(-dt * 4);
  if (Math.hypot(m.vx, m.vz) > 0.05) { m.x += m.vx * dt; m.z += m.vz * dt; }
  m.cy ??= m.y;
  const g = terrain.floorAt(m.x, m.cy + 0.5, m.z);
  if (m.cy > g + 0.01) { m.fallV = (m.fallV ?? 0) - 9.8 * dt; m.cy = Math.max(g, m.cy + m.fallV * dt); } else { m.cy = g; m.fallV = 0; }
  m.t -= dt;
  m.y = m.cy - (m.t < SINK_SECS ? 0.5 * (1 - Math.max(0, m.t) / SINK_SECS) : 0);
  return m.t > 0;
}

// 照準の先の体（届く距離の中で一番近い）。倒れた体は横になっているので、広めの球で調べる
export function carcassAim(list, from, dir, bodyBox) {
  let best = null, bd = REACH;
  for (const m of list) {
    if (m.state !== 'down' || !m.def.carve) continue;
    const b = bodyBox(m.kind), r = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * 0.5 + 0.35; // 広めに（足もとの小さな体を狙いやすく）
    _s.set(_c.set(m.x, m.y + r * 0.3, m.z), r);
    if (!_r.set(from, dir).intersectSphere(_s, _h)) continue;
    const d = _h.distanceTo(from);
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}

const knifeOf = (held) => !!held && ITEMS[held]?.tool === 'knife';
// 照準の先の体の名前と操作の文字
export function carcassHint(m, held) {
  const c = m.def.carve;
  const key = !c.hide ? '右クリック 肉と羽根を取る' : knifeOf(held) ? '右クリック 肉と皮をはぐ' : '右クリック 肉を取る（石のナイフで皮も）';
  return { name: `${m.def.name}の体`, key };
}

// 取れる物 [[物, 数], ...]。ナイフがなければ皮は取れない
export function carveOf(m, held) {
  const c = m.def.carve;
  return knifeOf(held) && c.hide ? [...c.meat, ...c.hide] : c.meat;
}
