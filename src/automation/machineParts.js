// 機械の共通の部品（objects.md「自動化の機械」、automation.md「機械の向きと口」）
// どの機械も 1m 四方、前（出す側）が +z、後ろ（入れる側）が -z。地面が y = 0
// 口はその面に向かって見て右のマスに寄せる: 出す口は x = +0.25、入れる口は x = -0.25
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { shape, merge, pick } from '../style/lowpoly.js';

export const BELT_Y = 0.25; // ベルトの上面の高さ
export const OUT_X = 0.25, IN_X = -0.25; // 口のマスの x
const OUT_END = { y: 0.32, z: 0.62 }; // 出す口の先（ベルトの上に落とす）
const IN_Y = 0.3; // 入れる口の真ん中の高さ
export const sh = (g, color, r, o = {}) => shape(g, color, r, { pairs: true, ...o }); // 四角い面の 2 枚の三角形を同じ色に

const _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3(), _q = new THREE.Quaternion();
// a から b へのびる棒（角材 t × t。sides があれば半径 t の多角の管、cap で両はしを閉じる）
export function rod(a, b, t, sides = 0, cap = false) {
  _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = _d.length();
  const g = sides ? new THREE.CylinderGeometry(t, t, len, sides, 1, !cap) : new THREE.BoxGeometry(t, len, t);
  _q.setFromUnitVectors(_up, _d.normalize());
  return g.applyQuaternion(_q).translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
}
export const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
export const oct = (rt, rb, h, x, y, z, open = false) => new THREE.CylinderGeometry(rt, rb, h, 8, 1, open).translate(x, y, z);
export const octX = (rad, len, x, y, z) => new THREE.CylinderGeometry(rad, rad, len, 8).rotateZ(Math.PI / 2).translate(x, y, z); // 横（x）に寝かせた八角

// さびた鉄（暗い鉄にさびの面がまじる）、緑青が少しまじる銅、木、石
export const rusty = (r) => () => (r() < 0.3 ? pick(r, P.container.rust) : pick(r, [P.ironMetal[0], P.ironMetal[1]]));
export const coppery = (r) => () => (r() < 0.08 ? P.copper[0] : pick(r, [P.copperMetal[1], P.copperMetal[2]]));
export const woody = (r) => () => pick(r, [P.wood[1], P.wood[2]]);
export const stony = (r) => () => pick(r, [P.stone[1], P.stone[2], P.stone[3]]);

// 碍子: 白い焼き物の皿 2 段と鉄のピン。電線はてっぺん（y + 0.11）につく
export function insulator(r, x, y, z) {
  return merge([
    sh(oct(0.035, 0.05, 0.035, x, y + 0.018, z), () => pick(r, P.insulator), r),
    sh(oct(0.03, 0.045, 0.035, x, y + 0.055, z), () => pick(r, P.insulator), r),
    sh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 4).translate(x, y + 0.095, z), () => P.ironMetal[2], r),
  ]);
}

// 碍子から機械への線（飾り）: 点をつないだ細い銅の管
export function cable(r, pts) {
  return merge(pts.slice(1).map((p, i) => sh(rod(pts[i], p, 0.014, 4), () => P.copperMetal[1], r)));
}

// 出す口: (z0, y0) から前の辺の外（OUT_END）へ下る樋。底は鉄、両側の縁は黄土
export function outPort(r, z0, y0, w = 0.3, x = OUT_X) {
  const dz = OUT_END.z - z0, dy = y0 - OUT_END.y, len = Math.hypot(dz, dy), ang = Math.atan2(dy, dz);
  const place = (g) => g.rotateX(ang).translate(x, (y0 + OUT_END.y) / 2, (z0 + OUT_END.z) / 2);
  return merge([
    sh(place(box(w, 0.025, len, 0, 0, 0)), rusty(r), r),
    ...[-1, 1].map((s) => sh(place(box(0.025, 0.09, len, s * w / 2, 0.045, 0)), () => pick(r, P.port.out), r, { jit: 0.004 })),
  ]);
}

// 入れる口: 後ろの辺（z = -0.5）から外へ広がる四角いじょうご（口 0.44m 角）。中は暗く、口の縁は青。
// duct: じょうごの奥から機械の体まで（z = -0.48 から前へ）のびる四角い管の長さ
export function inPort(r, { x = IN_X, y = IN_Y, duct = 0 } = {}) {
  const h = 0.2, z = -0.5 - h / 2 + 0.02, half = 0.22;
  const cone = () => new THREE.CylinderGeometry(half * Math.SQRT2, 0.13 * Math.SQRT2, h, 4, 1, true).rotateY(Math.PI / 4).rotateX(-Math.PI / 2).translate(x, y, z);
  const inner = cone().translate(-x, 0, 0).scale(-1, 1, 1).translate(x, 0, 0); // 裏返して内側を向ける（外からは中の暗い面が見える）
  const mz = -0.5 - h + 0.02, rim = (w, hh, dx, dy) => sh(box(w, hh, 0.04, x + dx, y + dy, mz), () => pick(r, P.port.in), r);
  const parts = [
    sh(cone(), rusty(r), r),
    sh(inner, () => pick(r, [P.robotScreen[0], P.stone[0]]), r),
    rim(half * 2 + 0.04, 0.04, 0, half), rim(half * 2 + 0.04, 0.04, 0, -half), rim(0.04, half * 2 - 0.04, half, 0), rim(0.04, half * 2 - 0.04, -half, 0),
  ];
  if (duct) parts.push(sh(box(0.3, 0.3, duct, x, y, -0.48 + duct / 2), rusty(r), r, { jit: 0.004 }));
  return merge(parts);
}
