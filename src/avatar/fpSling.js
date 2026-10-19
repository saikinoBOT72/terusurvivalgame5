// 1人称のスリングの動き（docs/rules/weapons.md「武器の動きと演出」のスリング）
// 引くほど袋（石入り）が手前へ伸びてひもが張る（最大 PULL）。放つと袋が前へはじけ、少し震えて元へ戻る
// 形は survival/itemShapes.js の slingParts（Y 字の枝は frame、袋は bag に分けてある）
import * as THREE from 'three';
import { rng, shape, merge, makeMesh } from '../style/lowpoly.js';
import { P } from '../style/palette.js';
import { slingParts } from '../survival/itemShapes.js';
import { pebble } from '../world/pickups.js';

const PULL = 0.25;   // 袋が手前（持ち物の形の -z）へ伸びる最大の長さ（m）
const SPRING = { k: 900, c: 14 }; // 袋のばね。弱めに止まるので、放すと前へはね、少し震えて元へ戻る
const UP = new THREE.Vector3(0, 1, 0);

// 手に持つスリング: 枝・袋・石・ひも 2 本を別の部品にして動かせるようにする
export function slingRig(id) {
  const { frame, bag, tips, pouch } = slingParts(rng(id.length * 31 + id.charCodeAt(0))); // itemShapes.js の itemGeometry と同じ種
  const root = new THREE.Group();
  root.add(makeMesh(merge(frame), { shadow: false }));
  const bagM = makeMesh(merge(bag).translate(-pouch.x, -pouch.y, -pouch.z), { shadow: false });
  bagM.position.copy(pouch);
  const stone = makeMesh(pebble(rng(7), 0.05).translate(0, 0.02, 0), { shadow: false });
  bagM.add(stone);
  root.add(bagM);
  const strapGeoUnit = shape(new THREE.CylinderGeometry(0.007, 0.007, 1, 4), P.straw[1], rng(5)); // 長さ 1、真ん中が原点、向きは y
  const straps = tips.map(() => {
    const m = makeMesh(strapGeoUnit, { shadow: false });
    root.add(m);
    return m;
  });
  root.userData.sling = { bag: bagM, stone, straps, tips, pouch };
  return root;
}

export function createSlingMotion() {
  let rig = null, z = 0, vz = 0, loaded = true, fireT = 1;
  const d = new THREE.Vector3(), mid = new THREE.Vector3(), p = new THREE.Vector3();

  function place() { // 袋の位置に合わせて、ひもを先から袋へ張り直す
    const { bag, straps, tips } = rig.userData.sling;
    bag.position.set(rig.userData.sling.pouch.x, rig.userData.sling.pouch.y, rig.userData.sling.pouch.z + z);
    p.copy(bag.position);
    straps.forEach((m, i) => {
      d.copy(p).sub(tips[i]);
      const len = d.length();
      mid.copy(tips[i]).add(p).multiplyScalar(0.5);
      m.position.copy(mid);
      m.quaternion.setFromUnitVectors(UP, d.divideScalar(len));
      m.scale.set(1, len, 1);
    });
  }

  return {
    attach(g) { rig = g?.userData.sling ? g : null; z = vz = 0; fireT = 1; if (rig) place(); },
    get rig() { return rig; },
    fire() { fireT = 0; }, // 放った: 石が飛んで袋が空になる
    setLoaded(on) { loaded = on; }, // 持ち物に石があるか（なければ袋は空）
    // charge: 引いた割合 0〜1
    update(dt, charge) {
      if (!rig) return;
      fireT += dt;
      const h = Math.min(dt, 1 / 30), target = -PULL * charge;
      vz += (SPRING.k * (target - z) - SPRING.c * vz) * h;
      z += vz * h;
      rig.userData.sling.stone.visible = loaded && (charge > 0.02 || fireT > 0.3);
      place();
    },
  };
}
