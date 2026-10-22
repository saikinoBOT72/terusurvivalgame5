// 描画の準備と、1 フレームの描き方（世界 → 1人称の腕と持つ物を重ねる → 画面の効果。postfx.js）
import * as THREE from 'three';
import { VIEW_LAYER } from '../player/firstPerson.js';
import { touch } from '../input/touch.js';
import { createPostFx } from './postfx.js';

export function createRenderer(camera) {
  const renderer = new THREE.WebGLRenderer({ antialias: false }); // ふちのギザギザは HDR の画面の MSAA で消す（postfx.js）
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight, false); // 見た目の大きさは CSS（ui.css。画面いっぱい）
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; // 影は 1 フレームに 1 回だけ作る（下の描画で 2 回描くため）
  renderer.autoClear = false;
  renderer.info.autoReset = false; // 2 回描くので、1 フレーム分をまとめて数える（perf.js）
  document.body.appendChild(renderer.domElement);
  const dom = renderer.domElement;
  const fx = createPostFx(renderer);
  // 描く大きさを、画面に出ている大きさに合わせる（スマホは向きを変えたあと resize が遅れることがあるので、毎フレーム見る）
  let w = 0, h = 0;
  function fit() {
    const nw = dom.clientWidth || innerWidth, nh = dom.clientHeight || innerHeight;
    if (nw === w && nh === h) return;
    w = nw; h = nh;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  fit();
  addEventListener('resize', fit);
  return {
    renderer, dom, fx,
    // マウスを固定する。加速なしの生の移動量を使うと視点が飛びにくい（使えないブラウザでは普通に固定）
    lockPointer() {
      if (touch.on) return; // タッチは固定なしで遊ぶ（input/touch.js）
      const p = dom.requestPointerLock?.({ unadjustedMovement: true });
      p?.catch?.(() => dom.requestPointerLock?.()?.catch?.(() => {}));
    },
    // 世界を描いてから、奥行きを消して 1人称の腕と持つ物を重ねる（arms: 1人称のとき）
    draw(scene, arms) {
      fit();
      renderer.info.reset();
      renderer.shadowMap.needsUpdate = true;
      fx.begin();
      renderer.render(scene, camera);
      if (arms) drawArms(scene);
      fx.end(performance.now() / 1000);
    },
  };
  function drawArms(scene) {
    renderer.clearDepth();
    const bg = scene.background;
    scene.background = null; // 背景の色があると、描く前に画面が塗りつぶされる
    camera.layers.set(VIEW_LAYER);
    renderer.render(scene, camera);
    camera.layers.set(0);
    scene.background = bg;
  }
}
