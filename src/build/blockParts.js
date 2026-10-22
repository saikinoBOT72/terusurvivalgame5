// マップ作りの、面に吸い付くパーツ（docs/rules/building.md「コンクリートとマップ作り」段階 2・3）
// 位置の基準は下端の中心。面に貼る物（光る線・パネル）は、貼る面が原点（横の面では +z へ出る）
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { shape, merge } from '../style/lowpoly.js';
import { cbox, wedge } from './concreteParts.js';

const rect = (x0, x1, z0, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const boxShape = (w, h, d) => ({ poly: rect(-w / 2, w / 2, -d / 2, d / 2), y: [0, h] });
// 坂の当たり判定: 0.25m の段（階段と同じ）
const rampShapes = (w, len, rise) => {
  const n = Math.round(rise / 0.25), d = len / n;
  return Array.from({ length: n }, (_, k) => ({ poly: rect(-w / 2, w / 2, len / 2 - (k + 1) * d, len / 2 - k * d), y: [0, (k + 1) * 0.25] }));
};

// face: 'block' 面に吸い付く箱 / 'surface' 面に貼る / 'top' 上の面にだけ置く
// size: [幅, 高さ, 奥行き]（向き 0 のとき）/ arrow: プレビューに向きの矢印
const B = { map: 'block', paint: 'concrete', face: 'block', rotStep: 2 };
const block = (name, w, h, d) => ({ ...B, name, size: [w, h, d], shape: boxShape(w, h, d), build: () => cbox(w, h, d, 0, h / 2, 0) });
const ramp = (name, w, len, rise) => ({ ...B, name, arrow: true, size: [w, rise, len], shapes: rampShapes(w, len, rise), build: () => wedge(w, len, rise) });

// 光る物: 平ら（上・下の面）、横向き・縦向き（横の面）の 3 つの形。選ぶのは平らな物だけ
const G = { map: 'glow', paint: 'glow', face: 'surface', rotStep: 2, noCollide: true };
function glowSet(id, name, L, T) { // L: 長さ、T: 幅（光る線は 0.1、パネルは 1）
  const th = T < 0.5 ? 0.06 : 0.05;
  return {
    [id]: { ...G, name, size: [L, th, T], shape: { poly: rect(-L / 2, L / 2, -T / 2, T / 2), y: [0, th] }, build: () => cbox(L, th, T, 0, th / 2, 0), side: id + 'W', up: T < 0.5 ? id + 'V' : null },
    [id + 'W']: { ...G, hidden: true, name, size: [L, T, th], shape: { poly: rect(-L / 2, L / 2, 0, th), y: [-T / 2, T / 2] }, build: () => cbox(L, T, th, 0, 0, th / 2) },
    ...(T < 0.5 ? { [id + 'V']: { ...G, hidden: true, name, size: [T, L, th], shape: { poly: rect(-T / 2, T / 2, 0, th), y: [-L / 2, L / 2] }, build: () => cbox(T, L, th, 0, 0, th / 2) } } : {}),
  };
}

// ジャンプ台・飛ばし台: 灰色の八角の台（色は変えない）と、光る輪（glow の形。色を塗れる）
const oct = (r) => Array.from({ length: 8 }, (_, k) => { const a = (k + 0.5) * Math.PI / 4; return [Math.cos(a) * r, Math.sin(a) * r]; });
const PAD_R = 0.6, PAD_H = 0.15;
const padBody = () => shape(new THREE.CylinderGeometry(PAD_R, PAD_R, PAD_H, 8).rotateY(Math.PI / 8).translate(0, PAD_H / 2, 0), P.concreteLeg, () => 0.5, { vary: 0 });
const flatTop = (g) => shape(g.rotateX(-Math.PI / 2).translate(0, PAD_H + 0.004, 0), P.concreteBase, () => 0.5, { vary: 0 });
const ring = () => flatTop(new THREE.RingGeometry(0.38, 0.5, 8, 1, Math.PI / 8));
const arrowGeo = () => flatTop(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.2, -0.12), new THREE.Vector2(0.2, -0.12), new THREE.Vector2(0, 0.28)])));
const pad = (name, kind) => ({
  name, map: 'glow', paint: 'pad', face: 'top', rotStep: 2, pad: kind, arrow: kind === 'dir', size: [PAD_R * 2, PAD_H, PAD_R * 2],
  shape: { poly: oct(PAD_R), y: [0, PAD_H] }, build: padBody, glow: kind === 'dir' ? () => merge([ring(), arrowGeo()]) : ring,
});

export function blockParts() {
  return {
    block1: block('箱 1m', 1, 1, 1), block2: block('箱 2m', 2, 2, 2), block4: block('箱 4m', 4, 4, 4),
    slab2: block('板 2m', 2, 0.25, 2), slab4: block('板 4m', 4, 0.5, 4),
    column4: block('柱 4m', 1, 4, 1), tower8: block('塔 8m', 2, 8, 2), panel4: block('壁板 4m', 4, 4, 0.5),
    ramp2: ramp('坂 2m', 2, 2, 1), ramp4: ramp('坂 4m', 4, 4, 2),
    ...glowSet('glowLine1', '光る線 1m', 1, 0.1), ...glowSet('glowLine2', '光る線 2m', 2, 0.1), ...glowSet('glowPanel', '光るパネル', 1, 1),
    jumpPad: pad('ジャンプ台', 'up'), launchPad: pad('飛ばし台', 'dir'),
  };
}
