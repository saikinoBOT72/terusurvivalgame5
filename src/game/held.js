// 手に持つ物の見た目（道具は柄を握る。素材は手のひらにのせる。クリップで動く銃は clipGuns.js の形）と、持っている間だけ光る物（松明・光るキノコ）
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { glowShroomGill, GLOW_MAT } from '../world/spotNature.js';
import { PISTOL_HOLD, gunRig } from '../survival/gunShapes.js';
import { slingRig } from '../avatar/fpSling.js';
import { CLIP_GUNS } from '../survival/clipGuns.js';
import { weaponMotion } from '../avatar/fpMotion.js';
import { ITEMS } from '../survival/items.js';
import { itemMesh, gripOf } from '../survival/itemShapes.js';
import { rng } from '../style/lowpoly.js';
import { campfire } from '../world/props.js';

export function createHeld({ inventory, player, build, onMessage }) {
  let heldId = null, torchFire = null, torchT = 0;
  inventory.onChange(() => {
    const s = inventory.held(), id = s ? s.id : null;
    if (id === heldId) return;
    heldId = id;
    torchFire = null;
    build.setHammer(!!id && ITEMS[id].tool === 'hammer'); // 石のハンマーを持っている間だけ建築できる（右クリックでメニュー）
    player.arms.setWeapon(weaponMotion(id)); // 振り方と重さ（avatar/fpMotion.js）
    if (!id) return player.arms.hold(null);
    const tool = !!ITEMS[id].tool;
    if (ITEMS[id].clip) return player.arms.hold(CLIP_GUNS[id].rig(), 0, 1, false, true, false, { clip: CLIP_GUNS[id] }); // クリップで動く銃（avatar/gunAnim.js）
    const mesh = ITEMS[id].tool === 'gun' ? gunRig(id) : ITEMS[id].tool === 'sling' ? slingRig(id) : itemMesh(id); // 銃は撃鉄・弾倉、スリングは袋とひもが動く形
    player.arms.hold(mesh, tool ? gripOf(id) : -0.1, ITEMS[id].hold ?? (tool ? 0.7 : 0.55), ITEMS[id].tool === 'spear', tool, !!ITEMS[id].top, ITEMS[id].tool === 'gun' ? PISTOL_HOLD : null);
    if (id === 'torch') { // 持っている間だけ明るい。炎は光の影響を受けない材質で、まわりを照らす
      torchFire = campfire(rng(3), { base: false });
      torchFire.root.scale.setScalar(0.5);
      torchFire.root.position.y = 0.75;
      mesh.add(torchFire.root);
    }
    if (id === 'glowShroom') { // 光るキノコ: 青緑の弱い光（松明の半分）。ひだは光の影響を受けない材質
      mesh.add(new THREE.Mesh(glowShroomGill(rng(4)), GLOW_MAT));
      const light = new THREE.PointLight(P.magic[2], 1.5, 7, 1.6);
      light.position.y = 0.2;
      mesh.add(light);
      torchFire = { root: light, update() {} };
    }
  });
  return {
    get id() { return heldId; },
    // 松明は持っている間だけ燃える（1 秒ごとに減る。眠っている間は減らない）
    update(t, dt, sleeping) {
      if (!torchFire) return;
      torchFire.update(t);
      if (sleeping || (torchT += dt) < 1) return;
      torchT -= 1;
      const broke = inventory.wear();
      if (broke) onMessage(broke === '光るキノコ' ? '光るキノコが光らなくなった' : '松明が燃え尽きた');
    },
  };
}
