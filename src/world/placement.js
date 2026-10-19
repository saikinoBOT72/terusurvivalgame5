// 物の置き方（docs/rules/objects.md）
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion(), _qy = new THREE.Quaternion();
export const SNAP = 0.5; // 人工物を置く格子

// 地面の向き（上向きの法線）
export function groundNormal(terrain, x, z, e = 0.25, out = new THREE.Vector3()) {
  const hx = terrain.heightAt(x + e, z) - terrain.heightAt(x - e, z);
  const hz = terrain.heightAt(x, z + e) - terrain.heightAt(x, z - e);
  return out.set(-hx / (2 * e), 1, -hz / (2 * e)).normalize();
}

// 地面の傾きに合わせた向き（yaw はその場での回転）
export function tiltQuat(normal, yaw, out = new THREE.Quaternion()) {
  _q.setFromUnitVectors(UP, normal);
  _qy.setFromAxisAngle(UP, yaw);
  return out.copy(_q).multiply(_qy);
}

// 木: まっすぐ立て、足元の一番低い所に合わせて少し埋める
export function trunkBase(terrain, x, z, r = 0.35) {
  const h = terrain.heightAt;
  return Math.min(h(x, z), h(x + r, z), h(x - r, z), h(x, z + r), h(x, z - r)) - 0.05;
}

// 人工物: 0.5m の格子に合わせ、平らかゆるい坂のタイルだけに置く。坂では傾ける。
// 置けたら {x, z, y}、置けなければ null
export function placeProp(obj, terrain, x, z, { yaw = 0, size = 0.5 } = {}) {
  x = Math.round(x / SNAP) * SNAP;
  z = Math.round(z / SNAP) * SNAP;
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { // 足元にかかるタイルをすべて調べる
    const t = terrain.tileAt(x + dx * size * 0.9, z + dz * size * 0.9);
    if (!t || t.max - t.min > 0.5 || t.min < terrain.waterLevel) return null;
  }
  const y = terrain.heightAt(x, z);
  obj.position.set(x, y, z);
  tiltQuat(groundNormal(terrain, x, z), yaw, obj.quaternion);
  return { x, z, y };
}
