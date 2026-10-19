// 世界を切り替えたときのつなぎ込み: 建築パーツ・物理・乗り物を初めてのときに作り、各仕組みに今の世界を渡す
import { createStructures } from '../build/structures.js';
import { createPhysics } from '../physics/physics.js';
import { createVehicles } from '../vehicle/vehicles.js';

// structuresOf: 世界 → 建築パーツ。systems: setWorld(w) を持つ仕組み（敵・採る・弾など）
export function attachWorld(w, { structuresOf, player, build, systems, onMessage, gridOn, debugOn }) {
  w.setGrid(gridOn);
  w.setDebug(debugOn);
  if (!structuresOf.has(w)) {
    const s = createStructures(w);
    w.group.add(s.group);
    structuresOf.set(w, s);
    if (w.terrain?.triangles) { // 物理といかだ（docs/rules/physics.md）
      w.physics = createPhysics(w, s);
      w.vehicles = createVehicles(w, s, player, { onMessage });
      w.refill?.(); // 射撃訓練島: 地面の武器（物理の落とし物）
    }
  }
  w.physics?.setDebug(debugOn);
  player.setWorld(w, structuresOf.get(w));
  build.setWorld(w, structuresOf.get(w));
  for (const sys of systems) sys.setWorld(w);
}
