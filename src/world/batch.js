// 動かない物を区画ごとにまとめて描く（docs/rules/style.md「描き方の決まり」）
// 中身の少ない InstancedMesh（木・岩・小物・箱など。nature.js の区画の中身も）を、区画・材質・影・形の作りごとに 1 つの BatchedMesh へ移す
// 元の InstancedMesh はシーンから外し、setMatrixAt・getMatrixAt を BatchedMesh へつなぎ替える（resources・grassCover などの使い方はそのまま）
// 中身の多い物（草の群れ）は InstancedMesh のまま（1 回で全部描ける方が速い）。島ができてから作る物（苗木・落とした袋）はまとめない
// WEBGL_multi_draw がない端末では、まとめると 1 つずつ描くことになって増えるので、まとめない。URL に ?nobatch でもまとめない（比べる用）
import * as THREE from 'three';
import { MAT } from '../style/lowpoly.js';

const CELL = 48, MAX = 8, MARGIN = 8; // 区画の大きさ、まとめる InstancedMesh の中身の数の上限、倒れる・揺れる分の見える範囲の足し
let supported = false;
export const setBatchSupport = (on) => { supported = on; }; // game/renderer.js が入れる
const _m = new THREE.Matrix4();

// 形の作り（同じ BatchedMesh に入れられるか）: 番号つきか、属性の名前・大きさ・型
const sig = (geo) => (geo.index ? 'i:' : 'n:') + Object.entries(geo.attributes).map(([k, a]) => `${k}${a.itemSize}${a.array.constructor.name}`).sort().join(',');
// 見えていて、group の中で動かされていない（group と同じ位置）か
function plain(o, group) {
  for (let p = o; p && p !== group; p = p.parent) if (!p.visible) return false;
  o.updateWorldMatrix(true, false);
  return o.matrixWorld.equals(group.matrixWorld);
}

// group の中の物をまとめる。まとめた数（BatchedMesh の数）を返す
export function bakeBatches(group) {
  if (!supported || new URLSearchParams(location.search).has('nobatch')) return 0;
  const sets = new Map();
  group.traverse((o) => {
    if (!o.isInstancedMesh || o.count === 0 || o.count > MAX || o.instanceColor || (o.material !== MAT.solid && o.material !== MAT.double)) return;
    if (!plain(o, group)) return;
    o.computeBoundingSphere();
    const c = o.boundingSphere.center;
    const near = !!o.parent?.userData.near; // 近くだけ描く物（草。island.js）は別にまとめる
    const key = `${Math.floor(c.x / CELL)},${Math.floor(c.z / CELL)}|${o.material.uuid}|${o.castShadow}|${near}|${sig(o.geometry)}`;
    if (!sets.has(key)) sets.set(key, Object.assign([], { near }));
    sets.get(key).push(o);
  });
  const holder = new THREE.Group();
  holder.isChunked = true; // island.js が、かすみの奥の区画を隠す（中身の boundingSphere を見る）
  for (const list of sets.values()) {
    if (list.length < 2) continue; // 1 つだけなら描く回数は変わらない
    const geos = [...new Set(list.map((o) => o.geometry))];
    const inst = list.reduce((a, o) => a + o.count, 0);
    const verts = geos.reduce((a, g) => a + g.attributes.position.count, 0), idx = geos.reduce((a, g) => a + (g.index?.count ?? 0), 0);
    const bm = new THREE.BatchedMesh(inst, verts, idx, list[0].material);
    const geoId = new Map(geos.map((g) => [g, bm.addGeometry(g)]));
    for (const o of list) {
      const ids = [];
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, _m);
        const id = bm.addInstance(geoId.get(o.geometry));
        bm.setMatrixAt(id, _m);
        bm.setVisibleAt(id, _m.determinant() !== 0); // 消してある物（大きさ 0。resources）は描かない
        ids.push(id);
      }
      o.setMatrixAt = (i, mat) => { bm.setMatrixAt(ids[i], mat); bm.setVisibleAt(ids[i], mat.determinant() !== 0); };
      o.getMatrixAt = (i, mat) => bm.getMatrixAt(ids[i], mat);
      o.parent.remove(o);
    }
    bm.castShadow = list[0].castShadow;
    bm.userData.near = list.near;
    bm.receiveShadow = true;
    bm.sortObjects = false; // 透けない物なので、並べ替えない（軽くする）
    bm.computeBoundingSphere();
    bm.boundingSphere.radius += MARGIN;
    holder.add(bm);
  }
  if (holder.children.length) group.add(holder);
  return holder.children.length;
}
