// アイコン: 持ち物の形を小さく描いて画像にする（docs/rules/ui.md）。最初に使うときに1回だけ描く
// 本体の描画（setIconRenderer）で小さな画面に描いて読み出す（2 つ目の WebGL を作らない。PLAN.md「軽くする」）
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { itemMesh } from '../survival/itemShapes.js';
import { ITEMS } from '../survival/items.js';

const SIZE = 160, OUT = 112; // 描く大きさ、切りつめたあとの絵の大きさ（ui.md「持ち物の操作」）
let renderer = null, rt = null, buf = null, scene = null, camera = null;
const urls = new Map();

export const setIconRenderer = (r) => { renderer = r; };

function setup() {
  rt = new THREE.WebGLRenderTarget(SIZE, SIZE, { samples: 4 });
  rt.texture.colorSpace = THREE.SRGBColorSpace; // 画面と同じ sRGB の値で読み出す
  buf = new Uint8Array(SIZE * SIZE * 4);
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
  if (!rt) setup();
  const m = make();
  m.rotation.set(0.35, -0.8, m.userData.upright || ITEMS[id]?.equip ? 0 : 0.5); // 斜め上から見る（道具は斜めに倒す。装備は立てたまま）
  scene.add(m);
  const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3());
  const r = box.getSize(new THREE.Vector3()).length() / 2;
  camera.position.set(c.x, c.y + r * 0.6, c.z + r / Math.tan((15 * Math.PI) / 180) * 1.05);
  camera.lookAt(c);
  const prev = renderer.getRenderTarget(), cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.readRenderTargetPixels(rt, 0, 0, SIZE, SIZE, buf);
  renderer.setRenderTarget(prev);
  renderer.setClearColor(cc, ca);
  scene.remove(m);
  const url = crop();
  urls.set(id, url);
  return url;
}

// まわりの透明な所を切りつめ、形が絵いっぱいになるよう正方形に描き直す
function crop() {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d');
  const img = g.createImageData(SIZE, SIZE), d = img.data;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) { // 上下を返し、ふちの半透明は色を戻す（描いた画面は透明と混ざって暗い）
    const i = ((SIZE - 1 - y) * SIZE + x) * 4, o = (y * SIZE + x) * 4, a = buf[i + 3], k = a > 0 && a < 255 ? 255 / a : 1;
    d[o] = Math.min(255, buf[i] * k); d[o + 1] = Math.min(255, buf[i + 1] * k); d[o + 2] = Math.min(255, buf[i + 2] * k); d[o + 3] = a;
  }
  g.putImageData(img, 0, 0);
  let x0 = SIZE, y0 = SIZE, x1 = -1, y1 = -1;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (d[(y * SIZE + x) * 4 + 3] < 10) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return c.toDataURL();
  const side = Math.max(x1 - x0, y1 - y0) + 3, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const o = document.createElement('canvas');
  o.width = o.height = OUT;
  o.getContext('2d').drawImage(c, cx - side / 2, cy - side / 2, side, side, 0, 0, OUT, OUT);
  return o.toDataURL();
}
