// 墜落の浜: 飛行機の残骸と、まわりの木箱・救急箱・水のボトル・設計図（docs/rules/islands.md「始まり」、objects.md「最初の島の物」）
// 残骸の形は 1 つ。前（機首）は -z。木箱・救急箱は右クリックで開けると中身が持ち物に入る（gather.js の store）
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { rng, pick, shape, merge, makeMesh } from '../style/lowpoly.js';
import { itemGeometry } from '../survival/itemShapes.js';

// 飛行機の残骸（特大）: 小さな双発機。胴体は半分砂に埋まり、左の翼とエンジンは付いたまま、右の翼は折れて横に落ち、尾翼は傾く
export function planeWreck(r) {
  const body = new THREE.CylinderGeometry(0.85, 0.85, 8.6, 8, 8);
  body.rotateX(Math.PI / 2);
  const p = body.attributes.position;
  for (let i = 0; i < p.count; i++) { // 機首は丸く細く、しっぽは細く上がる
    const z = p.getZ(i), k = z < -2.6 ? 1 - ((-2.6 - z) / 1.7) ** 2 * 0.5 : z > 1.2 ? 1 - (z - 1.2) / 3.1 * 0.62 : 1;
    p.setX(i, p.getX(i) * k); p.setY(i, p.getY(i) * k + (z > 1.2 ? (z - 1.2) * 0.17 : 0));
  }
  const glassOrWhite = (f) => (f.z < -2.4 && f.z > -3.8 && f.y > 0.25 ? pick(r, P.glass)
    : Math.abs(f.y) < 0.18 && Math.abs(f.nx) > 0.5 ? pick(r, P.planeStripe) : pick(r, [P.plane[1], P.plane[2], P.plane[2]]));
  const parts = [shape(body, glassOrWhite, r, { jit: 0.03 })];
  const white = () => pick(r, [P.plane[0], P.plane[1]]);
  // 左の翼（付いたまま、少し砂にささる）とエンジン
  const wingL = new THREE.BoxGeometry(5.2, 0.16, 1.5, 6, 1, 2);
  wingL.translate(-3.4, -0.15, -0.4).rotateZ(-0.08);
  parts.push(shape(wingL, white, r, { jit: 0.03 }));
  const eng = new THREE.CylinderGeometry(0.32, 0.38, 1.7, 8, 2);
  eng.rotateX(Math.PI / 2).translate(-2.4, 0.1, -0.9);
  parts.push(shape(eng, (f) => (f.nz < -0.9 ? P.robotFrame[0] : pick(r, [P.plane[0], P.plane[1]])), r, { jit: 0.02 }));
  // 右の翼: 折れて胴体の右うしろの砂に落ちている（先が欠けて短い）
  const wingR = new THREE.BoxGeometry(3.8, 0.16, 1.5, 5, 1, 2);
  const q = wingR.attributes.position;
  for (let i = 0; i < q.count; i++) if (q.getX(i) < -1.8) q.setZ(i, q.getZ(i) * 0.7 + Math.sin(q.getZ(i) * 9 + q.getY(i) * 31) * 0.2); // 折れ口のギザギザ（同じ位置の頂点は同じだけずらす）
  wingR.rotateY(0.7).rotateZ(0.12).translate(4.6, -0.25, 2.6);
  parts.push(shape(wingR, white, r, { jit: 0.04 }));
  // 尾翼: 縦の翼（先が細い）と、片方が折れた横の翼
  const fin = new THREE.BoxGeometry(0.12, 1.6, 1.2, 1, 2, 2), fp = fin.attributes.position;
  for (let i = 0; i < fp.count; i++) if (fp.getY(i) > 0.5) fp.setZ(i, fp.getZ(i) * 0.45 + 0.35);
  fin.translate(0, 1.55, 3.9).rotateZ(0.25);
  parts.push(shape(fin, (f) => (f.y > 2.0 ? pick(r, P.planeStripe) : white()), r, { jit: 0.02 }));
  const tail = new THREE.BoxGeometry(2.4, 0.1, 0.8, 3, 1, 1);
  tail.translate(-0.5, 0.95, 4.0).rotateZ(0.2);
  parts.push(shape(tail, white, r, { jit: 0.02 }));
  const g = merge(parts);
  g.rotateZ(0.14).rotateX(-0.06).translate(0, 0.45, 0); // 傾いて、半分砂に埋まる
  return g;
}

// 貨物の木箱（小）: 0.6m の木の箱に、角の補強の板 4 本
export function crate(r) {
  const parts = [shape(new THREE.BoxGeometry(0.6, 0.6, 0.6).translate(0, 0.3, 0), () => pick(r, [P.wood[2], P.wood[3]]), r)];
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    parts.push(shape(new THREE.BoxGeometry(0.1, 0.62, 0.1).translate(x * 0.27, 0.31, z * 0.27), P.wood[1], r));
  }
  return merge(parts);
}

// 置く: 木箱 4（木材 3、うち 2 つに機内食 2）、救急箱（救急セット 2）、水のボトル 3、操縦席のそばに設計図「炉」
// removeCollider: 開けて消えた箱の当たり判定を消す
export function placeWreck({ group, terrain, at, addCollider, removeCollider, resources }) {
  const r = rng(77), rot = at.rot ?? 0, cs = Math.cos(rot), sn = Math.sin(rot);
  const local = (lx, lz) => ({ x: at.x + lx * cs + lz * sn, z: at.z - lx * sn + lz * cs }); // 残骸の向きで回す
  const m = makeMesh(planeWreck(r));
  m.position.set(at.x, terrain.heightAt(at.x, at.z), at.z);
  m.rotation.y = rot;
  group.add(m);
  for (let lz = -3.8; lz <= 3.6; lz += 1.2) { // 胴体: 長い向きに丸い当たり判定を並べる
    const c = local(0, lz);
    addCollider(c.x, c.z, lz > 2 ? 0.55 : 0.85, terrain.heightAt(c.x, c.z) + 1.4);
  }
  for (const lx of [-1.6, -2.8, -4, -5.2]) { const c = local(lx, -0.4); addCollider(c.x, c.z, 0.55, terrain.heightAt(c.x, c.z) + 0.25); } // 左の翼（乗れる）

  const thing = (geo, lx, lz, store, kind, collide) => {
    const c = local(lx, lz), y = terrain.heightAt(c.x, c.z), mesh = makeMesh(geo);
    mesh.position.set(c.x, y, c.z);
    mesh.rotation.y = r() * Math.PI * 2;
    group.add(mesh);
    const box = new THREE.InstancedMesh(mesh.geometry, mesh.material, 1); // resources は InstancedMesh の 1 つを消す・戻す
    box.setMatrixAt(0, mesh.matrix.compose(mesh.position, mesh.quaternion, mesh.scale));
    box.castShadow = box.receiveShadow = true;
    group.remove(mesh); group.add(box);
    const e = resources.add({ kind, x: c.x, y, z: c.z, r: 0.35, h: 0.5, parts: [{ mesh: box, index: 0 }], store });
    if (collide) { const k = addCollider(c.x, c.z, 0.38, y + 0.6); e.onGone = () => removeCollider(k); }
  };
  const crateGeo = crate(r);
  [[2.2, -2.5, true], [2.6, -1.6, false], [-1.4, 2.4, true], [1.6, 3.6, false]].forEach(([lx, lz, meal]) =>
    thing(crateGeo, lx, lz, [{ id: 'wood', n: 3 }, meal ? { id: 'meal', n: 2 } : null], 'crate', true));
  thing(itemGeometry('firstAid'), 1.6, -4.4, [{ id: 'firstAid', n: 2 }], 'aidbox', false); // 持ったときと同じ形
  for (const [lx, lz] of [[-1.3, -3.2], [2.8, 0.6], [-2.6, 4.8]]) thing(itemGeometry('waterBottle'), lx, lz, [{ id: 'waterBottle', n: 1 }], 'drop', false);
  thing(itemGeometry('bpFurnace'), -1.1, -4.6, [{ id: 'bpFurnace', n: 1 }], 'drop', false);
}

// 地面に 1 つ置く（右クリックで拾う）。AI の跡の設計図など
export function placeLoot({ group, terrain, resources }, id, x, z, late = false, dy = 0) { // dy: 地面からの高さ（岩の上など）
  const y = terrain.heightAt(x, z) + dy, box = new THREE.InstancedMesh(itemGeometry(id), makeMesh(itemGeometry(id)).material, 1);
  box.setMatrixAt(0, new THREE.Matrix4().makeRotationY(x * 7.3).setPosition(x, y, z));
  box.castShadow = box.receiveShadow = true;
  group.add(box);
  return resources.add({ kind: 'drop', x, y, z, r: 0.35, h: 0.3, parts: [{ mesh: box, index: 0 }], store: [{ id, n: 1 }] }, late);
}
