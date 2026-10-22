// 1人称の銃の動き（docs/rules/weapons.md「武器の動きと演出」の銃）: 撃つと撃鉄が倒れて戻り、弾倉が 1/5 回る。弾切れは撃鉄が倒れたまま
// リロード: 傾けて下げる → 左手で弾倉を抜いて下へ → 新しい弾倉を差し込む → 左手で撃鉄を起こす → 構え直す
// 銃の形は survival/gunShapes.js の gunRig（userData に hammer・cyl・muzzle）
import * as THREE from 'three';

const COCK = -0.75; // 撃鉄が後ろへ倒れた角度
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const seg = (p, a, b) => ease((p - a) / (b - a)); // p が a → b の間で 0 → 1

export function createGunMotion() {
  let rig = null, hammerT = 0, empty = false, spin = 0, spinTo = 0, reload = null;
  const v = new THREE.Vector3();
  const out = { r: new Float32Array(6), left: new THREE.Vector3(), leftW: 0, events: [] };
  const SOUNDS = [[0.22, 'magOut'], [0.62, 'magIn'], [0.76, 'rack']]; // 込め直しの音を鳴らす割合（sound.md）

  return {
    attach(g) { rig = g?.userData.hammer ? g : null; hammerT = 0; empty = false; spin = spinTo = 0; reload = null; },
    get rig() { return rig; },
    fire(isEmpty) { if (!rig) return; hammerT = 0.0001; empty = isEmpty; spinTo += Math.PI * 2 / 5; },
    startReload(secs) { if (rig) reload = { t: 0, secs }; },
    reloadAt(p) { if (rig) reload = p == null ? null : { t: p * 2, secs: 2, frozen: true }; }, // 開発用: リロードを p（0〜1）の所で止めて見る
    get reloading() { return !!reload; },
    // 右手のずれ out.r と、左手の行き先（hands の root の中の位置）out.left・重み out.leftW
    update(dt, hand, root) {
      out.r.fill(0); out.leftW = 0; out.events.length = 0;
      if (!rig) return out;
      const H = rig.userData.hammer, C = rig.userData.cyl;
      // 撃鉄: 0.05 秒で倒れ、0.08 秒で戻る（弾切れは倒れたまま）
      let cock = 0;
      if (hammerT > 0) {
        hammerT += dt;
        cock = hammerT < 0.05 ? hammerT / 0.05 : empty ? 1 : Math.max(0, 1 - (hammerT - 0.05) / 0.08);
        if (!empty && hammerT > 0.13) hammerT = 0;
      }
      spin += (spinTo - spin) * Math.min(1, dt * 30);
      C.position.copy(C.userData.home);
      if (reload) {
        const p0 = reload.t / reload.secs, p = (reload.t += reload.frozen ? 0 : dt) / reload.secs;
        for (const [at, ev] of SOUNDS) if (p0 < at && p >= at) out.events.push(ev);
        if (p >= 1) { reload = null; empty = false; hammerT = 0; spin = spinTo = 0; }
        else {
          // 傾けて銃口を下げる（0〜15%。手もとは画面の真ん中寄りへ上げて、弾倉の出し入れが見えるように）、構え直す（90〜100%）
          const tilt = seg(p, 0, 0.15) * (1 - seg(p, 0.9, 1));
          out.r.set([-0.12 * tilt, 0.09 * tilt, 0.05 * tilt, -0.35 * tilt, 0.25 * tilt, 0.65 * tilt]);
          // 弾倉: 横へ抜く（22〜28%）→ 下へ（28〜40%）→ 上がってくる（40〜60%）→ 差し込む（60〜70%）
          const side = seg(p, 0.22, 0.28) * (1 - seg(p, 0.6, 0.7));
          const down = seg(p, 0.28, 0.4) * (1 - seg(p, 0.4, 0.6));
          C.position.x += 0.07 * side + 0.03 * down;
          C.position.y -= 0.4 * down;
          C.position.z += 0.06 * down;
          if (p > 0.22 && p < 0.7) spin = spinTo = 0;
          // 撃鉄を起こす（75〜82%）→ 戻す（82〜88%）
          cock = Math.max(empty && p < 0.75 ? 1 : 0, seg(p, 0.75, 0.82) * (1 - seg(p, 0.82, 0.88)));
          // 左手: 弾倉へ寄る（15〜22%）→ 弾倉といっしょ（〜70%）→ 撃鉄へ（70〜75%）→ 戻る（88〜96%）
          const toCyl = seg(p, 0.15, 0.22), toHammer = seg(p, 0.7, 0.75);
          out.leftW = toCyl * (1 - seg(p, 0.88, 0.96));
          hand.updateMatrixWorld(true);
          const at = (o, dy) => root.worldToLocal(v.setFromMatrixPosition(o.matrixWorld)).add({ x: 0, y: dy, z: 0.02 });
          out.left.copy(at(C, -0.035));
          if (toHammer > 0) out.left.lerp(at(H, 0.0), toHammer);
        }
      }
      H.rotation.x = COCK * cock;
      C.rotation.z = spin;
      return out;
    },
  };
}
