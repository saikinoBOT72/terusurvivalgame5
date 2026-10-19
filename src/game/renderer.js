// 描画の準備と、1 フレームの描き方（世界 → 1人称の腕と持つ物を重ねる）
import * as THREE from 'three';
import { VIEW_LAYER } from '../player/firstPerson.js';

export function createRenderer(camera) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; // 影は 1 フレームに 1 回だけ作る（下の描画で 2 回描くため）
  renderer.autoClear = false;
  renderer.info.autoReset = false; // 2 回描くので、1 フレーム分をまとめて数える（perf.js）
  document.body.appendChild(renderer.domElement);
  const dom = renderer.domElement;
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
  return {
    renderer, dom,
    // マウスを固定する。加速なしの生の移動量を使うと視点が飛びにくい（使えないブラウザでは普通に固定）
    lockPointer() {
      const p = dom.requestPointerLock?.({ unadjustedMovement: true });
      p?.catch?.(() => dom.requestPointerLock?.()?.catch?.(() => {}));
    },
    // 世界を描いてから、奥行きを消して 1人称の腕と持つ物を重ねる（arms: 1人称のとき）
    draw(scene, arms) {
      renderer.info.reset();
      renderer.shadowMap.needsUpdate = true;
      renderer.clear();
      renderer.render(scene, camera);
      if (!arms) return;
      renderer.clearDepth();
      const bg = scene.background;
      scene.background = null; // 背景の色があると、描く前に画面が塗りつぶされる
      camera.layers.set(VIEW_LAYER);
      renderer.render(scene, camera);
      camera.layers.set(0);
      scene.background = bg;
    },
  };
}
