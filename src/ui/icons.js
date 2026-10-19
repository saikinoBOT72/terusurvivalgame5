// アイコン: 持ち物の形を小さく描いて画像にする（docs/rules/ui.md）。最初に使うときに1回だけ描く
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { itemMesh } from '../survival/itemShapes.js';

const SIZE = 160, OUT = 112; // 描く大きさ、切りつめたあとの絵の大きさ（ui.md「持ち物の操作」）
let renderer = null, scene = null, camera = null;
const urls = new Map();

function setup() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(SIZE, SIZE);
  renderer.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(P.skyLight, P.groundLight, 1.6));
  const sun = new THREE.DirectionalLight(P.sunLight, 1.8);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  camera = new THREE.PerspectiveCamera(30, 1, 0.01, 20);
}

// id: 持ち物の名前。make を渡すと、その形を描く（建築パーツなど）
export function iconUrl(id, make = () => itemMesh(id)) {
  if (urls.has(id)) return urls.get(id);
  if (!renderer) setup();
  const m = make();
  m.rotation.set(0.35, -0.8, m.userData.upright ? 0 : 0.5); // 斜め上から見る（道具は斜めに倒す）
  scene.add(m);
  const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3());
  const r = box.getSize(new THREE.Vector3()).length() / 2;
  camera.position.set(c.x, c.y + r * 0.6, c.z + r / Math.tan((15 * Math.PI) / 180) * 1.05);
  camera.lookAt(c);
  renderer.render(scene, camera);
  scene.remove(m);
  const url = crop(renderer.domElement);
  urls.set(id, url);
  return url;
}

// まわりの透明な所を切りつめ、形が絵いっぱいになるよう正方形に描き直す
function crop(src) {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, SIZE, SIZE).data;
  let x0 = SIZE, y0 = SIZE, x1 = -1, y1 = -1;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (d[(y * SIZE + x) * 4 + 3] < 10) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return src.toDataURL();
  const side = Math.max(x1 - x0, y1 - y0) + 3, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const o = document.createElement('canvas');
  o.width = o.height = OUT;
  o.getContext('2d').drawImage(c, cx - side / 2, cy - side / 2, side, side, 0, 0, OUT, OUT);
  return o.toDataURL();
}
