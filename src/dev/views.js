// 開発用: 生き物を 横・正面・斜め の 3 方向から大きく描き、参考画像と並べる（creatures.md「見本が先」）。
// コンソールで (await import('/src/dev/views.js')).showViews('boar', 'idle')。もう一度呼ぶと描き直し、hideViews() で閉じる。
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { createBoar } from '../creatures/boar.js';
import { createRabbit } from '../creatures/rabbit.js';
import { createBird } from '../creatures/bird.js';
import { createChara } from '../avatar/chara.js';

const MAKERS = { chara: createChara, boar: createBoar, rabbit: createRabbit, bird: createBird };
let box = null;

export function hideViews() { box?.remove(); box = null; }

// aspect: 1 つの窓の 幅/高さ（縦長の物は 0.5 くらいにして、正方形に押し込まない）
// zoom: 拡大の倍率、at: 見る所 [x, y, z]（なければ全体の真ん中）
export function showViews(name = 'boar', pose = 'idle', { size = 360, zoom = 1, at, aspect = 1 } = {}) {
  hideViews();
  const make = MAKERS[name];
  const m = make();
  m.setPose?.(pose);
  if (m.update) for (let i = 0; i < 90; i++) m.update(i / 30, 1 / 30);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(P.ui?.panel ?? '#dddddd').lerp(new THREE.Color('#ffffff'), 0.6);
  scene.add(new THREE.HemisphereLight(P.skyLight, P.groundLight, 1.2));
  const sun = new THREE.DirectionalLight(P.sunLight, 1.6);
  sun.position.set(2, 4, 3);
  scene.add(sun, m.root);
  const bb = new THREE.Box3().setFromObject(m.root), c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3());
  const half = Math.max(s.x, s.y, s.z) * 0.6 / zoom;
  if (at) c.set(...at);

  box = document.createElement('div');
  box.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;flex-wrap:wrap;gap:6px;padding:6px;background:#888;align-content:flex-start';
  const ren = new THREE.WebGLRenderer({ antialias: true });
  const cw = Math.round(size * aspect);
  ren.setSize(cw * 3, size);
  const views = [
    ['横', new THREE.Vector3(1, 0, 0)],
    ['正面', new THREE.Vector3(0, 0, 1)],
    ['斜め', new THREE.Vector3(1, 0.45, 1.2)],
  ];
  ren.setScissorTest(true);
  views.forEach(([, dir], i) => {
    const cam = i < 2 ? new THREE.OrthographicCamera(-half * aspect, half * aspect, half, -half, 0.01, 20) : new THREE.PerspectiveCamera(30, aspect, 0.01, 20);
    cam.position.copy(c).addScaledVector(dir.normalize(), i < 2 ? 5 : half * 4.2);
    cam.lookAt(c);
    ren.setViewport(i * cw, 0, cw, size);
    ren.setScissor(i * cw, 0, cw, size);
    ren.render(scene, cam);
  });
  box.appendChild(ren.domElement);
  const img = document.createElement('img');
  img.src = `/docs/refs/creatures/${name}.jpg`;
  img.style.cssText = `height:${size}px`;
  box.appendChild(img);
  document.body.appendChild(box);
  return `${name} ${pose} 大きさ ${s.x.toFixed(2)}×${s.y.toFixed(2)}×${s.z.toFixed(2)}m`;
}

// 開発用: 同じ生き物・キャラの案を 1 つの絵に横に並べる（案の見比べ）。showRow('chara', [{ seed: 1 }, { seed: 2 }]) のように createXxx に渡す値を並べる
export function showRow(name, optsList, { size = 420, gap = 0.9, dir = [0.55, 0.15, 1], look = 0.65, dist, turn = 0, walk = [] } = {}) {
  hideViews();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e8e8ea');
  scene.add(new THREE.HemisphereLight(P.skyLight, P.groundLight, 1.2));
  const sun = new THREE.DirectionalLight(P.sunLight, 1.6);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  const heights = optsList.map((o, i) => {
    const m = MAKERS[name](o);
    m.root.position.x = (i - (optsList.length - 1) / 2) * gap;
    m.root.rotation.y = turn;
    if (walk[i] !== undefined) for (let t = 0; t < walk[i]; t += 1 / 60) m.update(1 / 60, { moving: walk[i] > 0 }); // walk[i] 秒歩いた所（0 は立ち止まり）
    scene.add(m.root);
    return new THREE.Box3().setFromObject(m.root).getSize(new THREE.Vector3()).y;
  });
  const W = Math.round(size * optsList.length * 0.6);
  box = document.createElement('div');
  box.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#888';
  const ren = new THREE.WebGLRenderer({ antialias: true });
  ren.setSize(W, size);
  const cam = new THREE.PerspectiveCamera(20, W / size, 0.1, 50);
  const d = new THREE.Vector3(...dir).normalize();
  cam.position.set(0, look + 0.05, 0).addScaledVector(d, dist ?? optsList.length * gap * 1.6 + 2);
  cam.lookAt(0, look, 0);
  ren.render(scene, cam);
  ren.domElement.style.cssText = "width:100%;height:auto";
  box.appendChild(ren.domElement);
  document.body.appendChild(box);
  return heights.map((h) => h.toFixed(2)).join(' ');
}
