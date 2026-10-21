// 開発用: 生き物を 横・正面・斜め の 3 方向から大きく描き、参考画像と並べる（creatures.md「見本が先」）。
// コンソールで (await import('/src/dev/views.js')).showViews('boar', 'idle')。もう一度呼ぶと描き直し、hideViews() で閉じる。
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { createBoar } from '../creatures/boar.js';
import { createRabbit } from '../creatures/rabbit.js';
import { createBird } from '../creatures/bird.js';

const MAKERS = { boar: createBoar, rabbit: createRabbit, bird: createBird };
let box = null;

export function hideViews() { box?.remove(); box = null; }

// zoom: 拡大の倍率、at: 見る所 [x, y, z]（なければ全体の真ん中）
export function showViews(name = 'boar', pose = 'idle', { size = 360, zoom = 1, at } = {}) {
  hideViews();
  const make = MAKERS[name];
  const m = make();
  m.setPose(pose);
  for (let i = 0; i < 90; i++) m.update(i / 30, 1 / 30);
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
  ren.setSize(size * 3, size);
  const views = [
    ['横', new THREE.Vector3(1, 0, 0)],
    ['正面', new THREE.Vector3(0, 0, 1)],
    ['斜め', new THREE.Vector3(1, 0.45, 1.2)],
  ];
  ren.setScissorTest(true);
  views.forEach(([, dir], i) => {
    const cam = i < 2 ? new THREE.OrthographicCamera(-half, half, half, -half, 0.01, 20) : new THREE.PerspectiveCamera(30, 1, 0.01, 20);
    cam.position.copy(c).addScaledVector(dir.normalize(), i < 2 ? 5 : half * 4.2);
    cam.lookAt(c);
    ren.setViewport(i * size, 0, size, size);
    ren.setScissor(i * size, 0, size, size);
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
