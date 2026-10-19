// 採掘ロボのバリア（enemies.md「採掘ロボ」）: 遠くから遠距離武器で当てると、体のまわりに半透明の六角の殻が 0.4 秒光る
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { bodyBox } from './combat.js';

const SECS = 0.4, MAX = 4;

export function createBarrierFx({ scene }) {
  const geo = new THREE.SphereGeometry(1, 6, 4); // 六角形の面の殻
  const shells = Array.from({ length: MAX }, () => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: P.fx.barrier, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    m.visible = false;
    scene.add(m);
    return { m, mob: null, t: SECS };
  });
  let next = 0;
  return {
    // 当たった敵 m のまわりに殻を出す（同じ敵に続けて当たったら、その殻を光らせ直す）
    show(m) {
      const s = shells.find((x) => x.mob === m && x.t < SECS) ?? shells[next++ % MAX];
      const b = bodyBox(m.kind);
      s.mob = m; s.t = 0; s.m.visible = true;
      s.size = new THREE.Vector3().subVectors(b.max, b.min).multiplyScalar(0.62);
      s.cy = (b.min.y + b.max.y) / 2;
    },
    update(dt) {
      for (const s of shells) {
        if (!s.m.visible) continue;
        if ((s.t += dt) >= SECS || !s.mob) { s.m.visible = false; continue; }
        const u = s.t / SECS, grow = 1 + 0.12 * u;
        s.m.position.set(s.mob.x, s.mob.y + s.cy, s.mob.z);
        s.m.scale.set(s.size.x * grow, s.size.y * grow, s.size.z * grow);
        s.m.material.opacity = 0.5 * (1 - u) * (u < 0.15 ? u / 0.15 : 1); // さっと光って薄れる
      }
    },
    clear() { for (const s of shells) { s.m.visible = false; s.mob = null; } },
  };
}
