// 描画の準備と、1 フレームの描き方（世界 → 1人称の腕と持つ物を重ねる → 画面の効果。postfx.js）、影の品質（ui.md「画質」）
import * as THREE from 'three';
import { VIEW_LAYER } from '../player/firstPerson.js';
import { touch } from '../input/touch.js';
import { createPostFx } from './postfx.js';
import { setIconRenderer } from '../ui/icons.js';
import { shadowDirty } from '../style/lowpoly.js';
import { terrainShadow } from '../world/terrain.js';
import { setBatchSupport } from '../world/batch.js';

// 影の品質: [影の画面の大きさ, 作り直す間（秒。0 = 毎フレーム）, 地形が影を落とすか]。オフは太陽が影を作らない
const SHADOW = { high: [2048, 0, true], mid: [2048, 0.2, true], low: [1024, 0.2, false] };

export function createRenderer(camera) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' }); // ふちのギザギザは HDR の画面の MSAA で消す（postfx.js）。2 つ GPU があれば速い方
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
  setIconRenderer(renderer); // アイコンも本体で描く（ui/icons.js）
  setBatchSupport(renderer.extensions.has('WEBGL_multi_draw')); // まとめて描けるか（world/batch.js）
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
  // 影: 間を空けるときは、0.2 秒たつか、影の中心（カメラについて 1m ごとに動く。sky.js）が動いたか、太陽の向きが変わったか、建てた・壊したときだけ作り直す
  // 作り直さない間も、影の行列は前に作ったときのままなので、影は地面の上でずれない
  let shq = 'high', sun = null, shT = -1;
  const armScene = new THREE.Scene(), armLights = []; // 1人称の腕のシーンと、[世界の光, 写し]
  const shAt = new THREE.Vector3(), shDir = new THREE.Vector3(), d = new THREE.Vector3();
  function shadowNow(t) {
    if (!sun?.castShadow) return false;
    const gap = SHADOW[shq][1];
    if (!gap) return true;
    d.subVectors(sun.position, sun.target.position).normalize();
    if (!(shadowDirty.v || t - shT >= gap || sun.target.position.distanceToSquared(shAt) > 0.01 || d.dot(shDir) < 0.9998)) return false;
    shadowDirty.v = false; shT = t; shAt.copy(sun.target.position); shDir.copy(d);
    return true;
  }
  return {
    renderer, dom, fx,
    // 1人称の腕を照らす光（世界の光の写し）を作る。src: 空の光・太陽・使い回しの点の光（毎フレーム値を写す）
    setArmLights(src) {
      for (const l of src) {
        const c = l.isHemisphereLight ? new THREE.HemisphereLight() : l.isDirectionalLight ? new THREE.DirectionalLight() : new THREE.PointLight();
        c.layers.enable(VIEW_LAYER);
        if (c.isDirectionalLight) { c.shadow = l.shadow; armScene.add(c.target); } // 影は世界の太陽の影をそのまま使う（作り直さない）
        armScene.add(c);
        armLights.push([l, c]);
      }
    },
    // 影の品質を入れる（high / mid / low / off）。s: 太陽（sky.js）、scene: 地形の影を切り替える
    setShadows(q, s, scene) {
      sun = s; shq = SHADOW[q] ? q : 'high';
      sun.castShadow = q !== 'off'; // 切り替えると材質が作り直しになる（設定を変えたときだけ）
      const [size, , terr] = SHADOW[shq];
      if (sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); sun.shadow.map?.dispose(); sun.shadow.map = null; }
      terrainShadow.on = terr;
      scene.traverse((o) => { if (o.userData.terrain) o.castShadow = terr; });
      shT = -1;
    },
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
      renderer.shadowMap.needsUpdate = shadowNow(performance.now() / 1000);
      fx.begin();
      renderer.render(scene, camera);
      if (arms) drawArms(scene);
      fx.end(performance.now() / 1000);
    },
  };
  // 腕と持つ物は、光の写しだけの小さなシーンで描く（世界のシーンを 2 回たどらない）。カメラ（腕はその子）をその間だけ移す
  function drawArms(scene) {
    renderer.clearDepth();
    for (const [l, c] of armLights) {
      c.color.copy(l.color); c.intensity = l.intensity; c.visible = l.visible;
      l.getWorldPosition(c.position);
      if (c.isHemisphereLight) c.groundColor.copy(l.groundColor);
      if (c.isPointLight) { c.distance = l.distance; c.decay = l.decay; }
      if (c.isDirectionalLight) { c.castShadow = l.castShadow; l.target.getWorldPosition(c.target.position); }
    }
    armScene.fog = scene.fog;
    const parent = camera.parent;
    armScene.add(camera);
    camera.layers.set(VIEW_LAYER);
    renderer.render(armScene, camera);
    camera.layers.set(0);
    parent?.add(camera);
  }
}
