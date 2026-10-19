// 水に浮く・沈む・流される（docs/rules/physics.md「水に浮く・沈む」）
// 物理の 1 歩ごとに、水につかった分だけ上へ押し、水の中では動きを弱める
import { ISLAND } from '../world/islandGen.js';
const G = 9.81;
const DRIFT = 0.3;      // 流れの速さ（m/s、風下 = 東 +x）
const DRIFT_DEPTH = 1;  // これより深い水だけ流れる（m）
export const LOST = ISLAND / 2 + 30; // 島の中心からこれより遠く（地図の端の 30m 外）へ流れた物は消える（m）

// h: 物理の物 {body, volume, shape}、terrain: 地形（水面の高さと地面の高さ）
export function applyWater(h, terrain) {
  const b = h.body, t = b.translation();
  // 体の縦の半分の高さ（回っている箱は、向きに合わせて計る）
  let hy = h.shape.ball;
  if (hy === undefined) {
    const q = b.rotation(), [x, y, z] = h.shape.box;
    hy = Math.abs(2 * (q.x * q.y + q.w * q.z)) * x + Math.abs(1 - 2 * (q.x * q.x + q.z * q.z)) * y + Math.abs(2 * (q.y * q.z - q.w * q.x)) * z;
  }
  const frac = Math.min(1, Math.max(0, (terrain.waterLevel - (t.y - hy)) / (2 * hy)));
  b.resetForces(false);
  if (frac <= 0) {
    if (h.wet) { h.wet = false; b.setLinearDamping(0.1); b.setAngularDamping(1); }
    return;
  }
  h.wet = true;
  b.setLinearDamping(0.1 + 3 * frac);
  b.setAngularDamping(1 + 3 * frac);
  const f = { x: 0, y: h.volume * frac * G, z: 0 };
  if (terrain.waterLevel - terrain.heightAt(t.x, t.z) > DRIFT_DEPTH) {
    const v = b.linvel();
    f.x = (DRIFT - v.x) * b.mass() * frac;
  }
  b.addForce(f, true);
}
