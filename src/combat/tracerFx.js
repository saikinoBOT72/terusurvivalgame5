// 銃の軌道（docs/rules/weapons.md「武器の動きと演出」の銃の軌道）: 銃口から当たる所まで光る線を引き、0.1 秒で細くなって消える
// あとに薄い煙の筋が 0.5 秒残り、少し広がって上へ流れる
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { glowMat } from '../style/lowpoly.js';

const LINE = 0.1, SMOKE = 0.5;
const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5); // 長さ 1（z）。始めの点から終わりの点へ向けて伸ばす

export function createTracerFx(scene) {
  const list = [];
  const mat = (color, opacity) => glowMat({ color, transparent: true, opacity, depthWrite: false });
  function beam(color, opacity, from, to) {
    const m = new THREE.Mesh(box, mat(color, opacity));
    m.position.copy(from);
    m.lookAt(to);
    m.userData.len = from.distanceTo(to);
    m.frustumCulled = false;
    scene.add(m);
    return m;
  }
  return {
    fire(from, to) {
      list.push({
        t: 0,
        core: beam(P.fx.tracer[0], 1, from, to),
        edge: beam(P.fx.tracer[1], 0.45, from, to),
        smoke: beam(P.fx.tracerSmoke, 0.22, from, to),
      });
    },
    clear() { for (const l of list) for (const m of [l.core, l.edge, l.smoke]) { m.removeFromParent(); m.material.dispose(); } list.length = 0; },
    update(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const l = list[i];
        l.t += dt;
        const a = Math.max(0, 1 - l.t / LINE), b = Math.max(0, 1 - l.t / SMOKE);
        l.core.scale.set(0.018 * a, 0.018 * a, l.core.userData.len);
        l.edge.scale.set(0.045 * a, 0.045 * a, l.edge.userData.len);
        l.core.visible = l.edge.visible = a > 0;
        l.edge.material.opacity = 0.45 * a;
        const w = 0.02 + 0.06 * (1 - b);
        l.smoke.scale.set(w, w, l.smoke.userData.len);
        l.smoke.position.y += dt * 0.15;
        l.smoke.material.opacity = 0.22 * b * b;
        if (l.t >= SMOKE) { for (const m of [l.core, l.edge, l.smoke]) { m.removeFromParent(); m.material.dispose(); } list.splice(i, 1); }
      }
    },
    get count() { return list.length; },
  };
}
