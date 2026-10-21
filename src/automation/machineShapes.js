// 自動化の機械の形（objects.md「自動化の機械」）。共通の部品と向きの決まりは machineParts.js
// 機械は { body, 動く部分 } を返す。動く部分: bit（y 軸で回す）、rotor（z 軸で回す。rotorAt が軸の位置）、
// arm（armAt を中心に y 軸で振る）、glow（動いている間だけ見せる火の色）
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { merge, pick } from '../style/lowpoly.js';
import { sh, rod, box, oct, octX, rusty, coppery, woody, stony, insulator, cable, outPort, inPort, BELT_Y, OUT_X, IN_X } from './machineParts.js';

const glowColor = (r) => () => pick(r, [P.fire[1], P.fire[2]]);

// らせんの刃: 内の半径 ri・外の半径 ro、上 y0 から下 y1 へ turns 回り。厚さのある帯（上・下・外の縁）
function auger(r, y0, y1, turns, ri = 0.06, ro = 0.21) {
  const seg = Math.round(turns * 8), pos = [];
  const pt = (i, rad, dy) => { const a = (i / 8) * Math.PI * 2, y = y0 + (y1 - y0) * (i / seg); return new THREE.Vector3(Math.cos(a) * rad, y + dy, Math.sin(a) * rad); };
  const tri = (a, b, c, want) => { // want の向きに面が向くよう並べる
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    (n.dot(want) < 0 ? [a, c, b] : [a, b, c]).forEach((v) => pos.push(v.x, v.y, v.z));
  };
  const t = 0.04, up = new THREE.Vector3(0, 1, 0), down = new THREE.Vector3(0, -1, 0);
  for (let i = 0; i < seg; i++) {
    const a = (i + 0.5) / 8 * Math.PI * 2, out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const [i0, o0, i1, o1] = [pt(i, ri, 0), pt(i, ro, -0.04), pt(i + 1, ri, 0), pt(i + 1, ro, -0.04)];
    const [j0, p0, j1, p1] = [pt(i, ri, -t), pt(i, ro, -0.04 - t), pt(i + 1, ri, -t), pt(i + 1, ro, -0.04 - t)];
    tri(i0, o0, o1, up); tri(i0, o1, i1, up);
    tri(j0, p1, p0, down); tri(j0, j1, p1, down);
    tri(o0, p0, p1, out); tri(o0, p1, o1, out);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return sh(g, (f) => (f.ny > 0.5 ? pick(r, [P.ironMetal[2], P.ironMetal[3]]) : pick(r, [P.ironMetal[0], P.ironMetal[1]])), r);
}

// 電動ドリル（機械・1.5m）: 鉄の枠に足 4 本、上に銅のモーター、真ん中のらせんの刃が下の岩へ入る。
// 刃が上げた鉱石は受けの箱から前の右の樋へ出る
export function drillGeo(r) {
  const H = 0.76, L = 0.42; // 枠の上の高さ、足の位置
  const iron = rusty(r), parts = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    parts.push(sh(box(0.08, H, 0.08, sx * L, H / 2, sz * L), iron, r, { jit: 0.004 }));
    parts.push(sh(box(0.16, 0.04, 0.16, sx * L, 0.02, sz * L), iron, r, { jit: 0.006 }));
  }
  for (const s of [-1, 1]) { // 上の枠と、横の斜めの筋かい
    parts.push(sh(box(0.92, 0.08, 0.08, 0, H - 0.04, s * L), iron, r, { jit: 0.004 }));
    parts.push(sh(box(0.08, 0.08, 0.76, s * L, H - 0.04, 0), iron, r, { jit: 0.004 }));
    parts.push(sh(rod([s * L, 0.12, -L], [s * L, H - 0.08, L], 0.05), iron, r, { jit: 0.004 }));
  }
  parts.push(sh(box(0.76, 0.06, 0.06, 0, 0.3, -L), iron, r, { jit: 0.004 }));
  parts.push(sh(box(0.84, 0.04, 0.84, 0, H + 0.02, 0), (f) => (f.ny > 0.5 ? pick(r, [P.ironMetal[1], P.container.rust[0]]) : P.ironMetal[0]), r, { jit: 0.004 })); // 床板
  // モーター: 横に寝かせた銅の八角の胴、両はしに鉄のふた、胴を締める鉄の帯、下に台、横に小さな箱
  parts.push(sh(box(0.36, 0.1, 0.3, 0, H + 0.09, 0), iron, r, { jit: 0.004 }));
  parts.push(sh(octX(0.22, 0.44, 0, 1.07, 0), coppery(r), r, { jit: 0.006 }));
  for (const s of [-1, 1]) parts.push(sh(octX(0.24, 0.04, s * 0.24, 1.07, 0), iron, r));
  for (const x of [-0.1, 0.1]) parts.push(sh(octX(0.235, 0.035, x, 1.07, 0), () => P.ironMetal[0], r));
  parts.push(sh(box(0.12, 0.16, 0.18, 0.33, 0.95, 0), iron, r, { jit: 0.004 }));
  parts.push(insulator(r, -0.08, 1.27, 0), insulator(r, 0.08, 1.27, 0));
  parts.push(cable(r, [[-0.08, 1.37, 0], [-0.1, 1.42, -0.1], [-0.2, 1.36, -0.22], [-0.25, 1.2, -0.24], [-0.24, 1.07, -0.24]]));
  parts.push(cable(r, [[0.08, 1.37, 0], [0.18, 1.4, 0.06], [0.3, 1.26, 0.07], [0.33, 1.03, 0.05]]));
  // 受けの箱（刃の上のまわり。前は開いている）と、前の右の出す口
  for (const s of [-1, 1]) parts.push(sh(box(0.03, 0.18, 0.36, s * 0.18, 0.6, 0), iron, r));
  parts.push(sh(box(0.36, 0.18, 0.03, 0, 0.6, -0.18), iron, r));
  parts.push(outPort(r, 0.05, 0.56));
  // 刃: 鉄の軸（モーターの下から地面の下まで）、らせん 3 回り、先のとがり
  const bit = merge([
    sh(oct(0.06, 0.06, 1.0, 0, 0.32, 0), () => pick(r, [P.ironMetal[1], P.ironMetal[2]]), r),
    auger(r, 0.58, -0.12, 3),
    sh(new THREE.ConeGeometry(0.07, 0.18, 8).rotateX(Math.PI).translate(0, -0.27, 0), () => P.ironMetal[2], r),
  ]);
  return { body: merge(parts), bit };
}

// 発電機（機械・1.2m）: 石の足と木の台に、鋲を打った鉄のボイラーの箱。前に焚き口（燃えている間 glow）、上に曲がった煙突。
// 右（+x）に石の台に乗った銅のコイルの胴と碍子 2 つ。後ろの右（後ろから見て）に石炭を入れる口
export function generatorGeo(r) {
  const iron = rusty(r), parts = [];
  const X0 = -0.48, X1 = 0.16, Z0 = -0.46, Z1 = 0.4, Y0 = 0.16, Y1 = 0.86, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
  for (const [x, z] of [[-0.36, -0.36], [-0.36, 0.3], [0.06, -0.36], [0.06, 0.3]]) parts.push(sh(box(0.2, 0.12, 0.2, x, 0.06, z), stony(r), r, { jit: 0.03 }));
  for (const z of [-0.36, 0.3]) parts.push(sh(box(0.62, 0.06, 0.12, cx, 0.13, z), woody(r), r, { jit: 0.006 }));
  parts.push(sh(box(X1 - X0, Y1 - Y0, Z1 - Z0, cx, (Y0 + Y1) / 2, cz), iron, r, { jit: 0.008 }));
  parts.push(sh(box(X1 - X0 - 0.06, 0.05, Z1 - Z0 - 0.06, cx, Y1 + 0.02, cz), iron, r, { jit: 0.004 })); // 上のふち
  // 鋲: 面のふちに小さな八面体
  const rivet = (x, y, z) => parts.push(sh(new THREE.OctahedronGeometry(0.02, 0).translate(x, y, z), () => P.ironMetal[2], r));
  for (const y of [Y0 + 0.08, Y1 - 0.08]) {
    for (const x of [-0.4, -0.2, 0.0]) rivet(x, y, Z1 + 0.005);
    for (const z of [-0.32, -0.02, 0.26]) { rivet(X0 - 0.005, y, z); rivet(X1 + 0.005, y, z); }
  }
  // 焚き口: 前の面の鉄の枠、格子 3 本、中は火（glow）か暗い奥
  const fx = -0.16, fy = 0.46, fz = Z1 + 0.02;
  parts.push(sh(box(0.34, 0.05, 0.05, fx, fy + 0.16, fz), iron, r), sh(box(0.34, 0.05, 0.05, fx, fy - 0.16, fz), iron, r));
  parts.push(sh(box(0.05, 0.27, 0.05, fx - 0.15, fy, fz), iron, r), sh(box(0.05, 0.27, 0.05, fx + 0.15, fy, fz), iron, r));
  for (const dx of [-0.06, 0.02, 0.1]) parts.push(sh(box(0.025, 0.27, 0.025, fx + dx - 0.02, fy, fz + 0.01), () => P.ironMetal[0], r));
  parts.push(sh(box(0.06, 0.04, 0.04, fx + 0.2, fy, fz + 0.02), () => P.ironMetal[2], r)); // 取っ手
  parts.push(sh(box(0.26, 0.26, 0.01, fx, fy, Z1 + 0.004), () => P.robotScreen[0], r));
  const glow = sh(box(0.26, 0.26, 0.01, fx, fy, Z1 + 0.008), glowColor(r), r, { vary: 0.08 });
  // 煙突: 根元の板、まっすぐ上がって後ろへ曲がる
  parts.push(sh(oct(0.12, 0.13, 0.04, -0.3, Y1 + 0.06, -0.2), iron, r));
  parts.push(sh(rod([-0.3, Y1 + 0.04, -0.2], [-0.3, 1.12, -0.2], 0.075, 8), iron, r, { jit: 0.004 }));
  parts.push(sh(rod([-0.3, 1.1, -0.2], [-0.3, 1.24, -0.34], 0.075, 8, true), (f) => (f.ny > 0.5 || f.nz < -0.6 ? P.robotScreen[0] : iron()), r, { jit: 0.004 }));
  // 右のコイル: 石の台、銅の胴、ひだ 4 つ、上の板、碍子 2 つ、箱へ入る線
  parts.push(sh(oct(0.21, 0.23, 0.18, 0.33, 0.09, 0.02), stony(r), r, { jit: 0.02 }));
  parts.push(sh(oct(0.17, 0.17, 0.42, 0.33, 0.39, 0.02), coppery(r), r));
  for (let i = 0; i < 4; i++) parts.push(sh(oct(0.19, 0.19, 0.04, 0.33, 0.26 + i * 0.09, 0.02), () => pick(r, [P.copperMetal[1], P.copperMetal[2]]), r));
  parts.push(sh(oct(0.19, 0.19, 0.04, 0.33, 0.62, 0.02), () => P.copperMetal[2], r));
  parts.push(insulator(r, 0.27, 0.64, 0.02), insulator(r, 0.39, 0.64, 0.02));
  parts.push(cable(r, [[0.27, 0.74, 0.02], [0.24, 0.8, -0.04], [0.17, 0.74, -0.08]]));
  parts.push(inPort(r, { duct: 0.04 }));
  return { body: merge(parts), glow };
}

// 風車（機械・4m）: すぼまる木の格子の塔をひもとガラクタの板で補強。上に木の胴、前の羽根 4 枚（継ぎはぎの板）、
// 後ろに尾びれ。銅線が塔を下りて、根元の箱と碍子 2 つへ。rotor は rotorAt を通る z 軸で回す
export const WIND_ROTOR = [0, 3.5, 0.36];
export function windmillGeo(r) {
  const parts = [], wood = woody(r), T = 3.3;
  const leg = (sx, sz, y) => [sx * (0.42 - 0.27 * y / T), y, sz * (0.42 - 0.27 * y / T)];
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [sx, sz] of corners) parts.push(sh(rod(leg(sx, sz, 0), leg(sx, sz, T), 0.07), wood, r, { jit: 0.006 }));
  for (const y of [0.25, 1.3, 2.3]) for (let i = 0; i < 4; i++) { // 横木と、ひもを巻いた結び目
    const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
    parts.push(sh(rod(leg(ax, az, y), leg(bx, bz, y), 0.05), wood, r, { jit: 0.004 }));
    const k = leg(ax, az, y);
    parts.push(sh(box(0.1, 0.08, 0.1, k[0], k[1], k[2]), () => pick(r, P.straw), r, { jit: 0.01 }));
  }
  for (let i = 0; i < 4; i++) { // 筋かい（面ごとに斜め 1 本ずつ、2 段）
    const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
    parts.push(sh(rod(leg(ax, az, 0.25), leg(bx, bz, 1.3), 0.04), wood, r, { jit: 0.004 }));
    parts.push(sh(rod(leg(bx, bz, 1.3), leg(ax, az, 2.3), 0.04), wood, r, { jit: 0.004 }));
  }
  for (const [x, y, z, ry] of [[0.36, 0.8, 0.02, 0], [-0.2, 1.8, 0.31, Math.PI / 2]]) parts.push(sh(box(0.03, 0.22, 0.2, 0, 0, 0).rotateY(ry).translate(x, y, z), () => pick(r, [P.container.rust[1], P.copper[0], P.ironMetal[1]]), r)); // ガラクタの板
  parts.push(sh(box(0.36, 0.06, 0.36, 0, T + 0.03, 0), wood, r, { jit: 0.004 }));
  parts.push(sh(oct(0.05, 0.05, 0.12, 0, T + 0.1, 0), () => P.ironMetal[1], r));
  parts.push(sh(new THREE.CylinderGeometry(0.13, 0.13, 0.7, 8).rotateX(Math.PI / 2).translate(0, WIND_ROTOR[1], 0), wood, r, { jit: 0.008 })); // 胴（丸太）
  for (const z of [-0.22, 0.2]) parts.push(sh(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 8).rotateX(Math.PI / 2).translate(0, WIND_ROTOR[1], z), () => pick(r, P.straw), r));
  parts.push(sh(rod([0, WIND_ROTOR[1], -0.3], [0, WIND_ROTOR[1], -0.85], 0.04), () => P.ironMetal[1], r)); // 尾の腕
  parts.push(sh(box(0.03, 0.42, 0.42, 0, WIND_ROTOR[1] + 0.05, -0.95), () => pick(r, [P.container.rust[0], P.wood[2], P.wood[3]]), r));
  // 線: 胴の下から塔の中を下り、根元の箱へ。箱の上に碍子 2 つ
  parts.push(cable(r, [[0.08, WIND_ROTOR[1] - 0.1, -0.1], [0.12, 3.0, -0.12], [0.2, 1.8, -0.2], [0.26, 0.7, -0.28], [0.24, 0.24, -0.3]]));
  parts.push(sh(box(0.24, 0.16, 0.18, 0.24, 0.08, -0.3), woody(r), r, { jit: 0.004 }));
  parts.push(insulator(r, 0.18, 0.16, -0.3), insulator(r, 0.3, 0.16, -0.3));
  // 羽根（rotorAt が原点）: 鉄の軸、木の中心、腕 4 本、腕の先に継ぎはぎの板 2 枚（少しねじる）
  const rot = [
    sh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 8).rotateX(Math.PI / 2).translate(0, 0, -0.05), () => P.ironMetal[1], r),
    sh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 8).rotateX(Math.PI / 2), wood, r),
  ];
  for (let i = 0; i < 4; i++) {
    const g = [sh(box(0.05, 1.05, 0.04, 0, 0.55, 0), wood, r, { jit: 0.004 })];
    for (const [y, h, c] of [[0.62, 0.3, P.container.rust], [0.88, 0.26, [P.copper[0], P.copper[1]]]]) {
      g.push(sh(box(0.3, h, 0.02, 0, 0, 0).rotateY(0.25).translate(0.1, y, 0.02), () => pick(r, c), r));
    }
    rot.push(merge(g).rotateZ(i * Math.PI / 2 + 0.3));
  }
  return { body: merge(parts), rotor: merge(rot), rotorAt: WIND_ROTOR };
}

// 電柱（中・3m）: 八角の木の柱、上の横木と斜めの支え、両はしの碍子、根元の石 3 つ
export function poleGeo(r) {
  const wood = woody(r);
  return merge([
    sh(oct(0.06, 0.08, 3, 0, 1.5, 0), wood, r, { jit: 0.008 }),
    sh(box(0.7, 0.07, 0.08, 0, 2.78, 0), wood, r, { jit: 0.004 }),
    sh(rod([0, 2.45, 0.05], [0.24, 2.75, 0.05], 0.04), wood, r),
    insulator(r, -0.3, 2.815, 0), insulator(r, 0.3, 2.815, 0),
    ...[[0.14, 0.04], [-0.1, 0.12], [0, -0.14]].map(([x, z]) => sh(new THREE.DodecahedronGeometry(0.09, 0).scale(1, 0.6, 1).translate(x, 0.04, z), stony(r), r, { jit: 0.02 })),
  ]);
}

// 自動炉（機械・1.4m）: 積んだ石の八角の塔（上がすぼまる。段のすき間が動いている間 glow）。銅のコイルと鉄の帯を巻く。
// 上は開いた口。後ろの右に入れる口（塔までの管）、前の右に出す口とその上のひさし。左に碍子の台
export function smelterGeo(r) {
  const parts = [], glow = [], iron = rusty(r);
  const rad = (y) => 0.44 - 0.14 * Math.max(0, y - 0.2) / 0.9; // 高さ y の塔の半径
  const courses = [[0, 0.2], [0.25, 0.4], [0.45, 0.6], [0.65, 0.8], [0.85, 1.0], [1.05, 1.2]];
  courses.forEach(([y0, y1], i) => { // 段ごとに石の明るさを替え、ところどころ暗い石
    const c = () => (r() < 0.12 ? P.stone[0] : pick(r, i % 2 ? [P.stone[2], P.stone[3]] : [P.stone[1], P.stone[2]]));
    parts.push(sh(oct(rad(y1), rad(y0), y1 - y0, 0, (y0 + y1) / 2, 0), c, r, { jit: 0.025 }));
  });
  parts.push(sh(oct(rad(1.2) - 0.03, rad(0) - 0.04, 1.2, 0, 0.6, 0), () => P.robotScreen[0], r)); // すき間の奥（暗い）
  for (const [, y1] of courses.slice(0, -1)) glow.push(sh(oct(rad(y1) - 0.01, rad(y1) - 0.01, 0.05, 0, y1 + 0.025, 0, true), () => pick(r, [P.fire[1], P.fire[2], P.fire[2]]), r, { vary: 0.06 }));
  // 上の口: 石の輪（外と、裏返した内）、上の面、暗い底
  parts.push(sh(oct(0.3, 0.3, 0.12, 0, 1.26, 0, true), stony(r), r, { jit: 0.01 }));
  parts.push(sh(oct(0.22, 0.22, 0.12, 0, 1.26, 0, true).scale(-1, 1, 1), () => P.stone[0], r));
  parts.push(sh(new THREE.RingGeometry(0.22, 0.3, 8).rotateX(-Math.PI / 2).translate(0, 1.32, 0), stony(r), r));
  parts.push(sh(new THREE.CircleGeometry(0.22, 8).rotateX(-Math.PI / 2).translate(0, 1.22, 0), () => P.robotScreen[0], r));
  // 鉄の帯 2 本、銅のコイル 4 巻き
  for (const y of [0.23, 1.03]) parts.push(sh(oct(rad(y) + 0.03, rad(y) + 0.03, 0.05, 0, y, 0, true), iron, r));
  for (let i = 0; i < 4; i++) { const y = 0.5 + i * 0.08; parts.push(sh(oct(rad(y) + 0.035, rad(y) + 0.035, 0.03, 0, y, 0, true), () => pick(r, [P.copperMetal[1], P.copperMetal[2]]), r)); }
  // 左の碍子の台（塔の横の鉄の腕）と、コイルへの線
  parts.push(sh(box(0.16, 0.06, 0.12, -0.42, 0.42, 0.1), iron, r));
  parts.push(insulator(r, -0.46, 0.45, 0.07), insulator(r, -0.38, 0.45, 0.13));
  parts.push(cable(r, [[-0.46, 0.55, 0.07], [-0.47, 0.6, 0], [-0.44, 0.52, -0.08], [-0.42, 0.5, -0.1]]));
  // 口: 後ろの右に入れる口（塔までの管）、前の右に出す口とひさし
  parts.push(inPort(r, { duct: 0.16 }));
  parts.push(sh(box(0.34, 0.2, 0.14, OUT_X, 0.58, 0.3), iron, r, { jit: 0.004 }));
  parts.push(sh(box(0.26, 0.14, 0.01, OUT_X, 0.56, 0.375), () => P.robotScreen[0], r));
  parts.push(outPort(r, 0.37, 0.5));
  return { body: merge(parts), glow: merge(glow) };
}

// 自動作業台（機械・1m）: 鉄の枠の木の作業台。天板に機械の腕（arm。armAt を中心に振る）と鉄の板、
// 下に歯車 2 つと銅のモーター。後ろの右に入れる口と受けの箱、前の右に出す口。天板の奥の右に碍子の箱
export const ARM_AT = [-0.3, 0.76, -0.28];
export function benchGeo(r) {
  const parts = [], wood = woody(r), iron = rusty(r), TOP = 0.76;
  for (const z of [-0.33, 0, 0.33]) parts.push(sh(box(1, 0.06, 0.32, 0, TOP - 0.03, z), (f) => (f.ny > 0.5 ? pick(r, [P.wood[2], P.wood[3]]) : P.wood[1]), r, { jit: 0.004 }));
  for (const s of [-1, 1]) { // 天板のまわりの鉄の帯
    parts.push(sh(box(1.02, 0.06, 0.04, 0, TOP - 0.05, s * 0.49), iron, r));
    parts.push(sh(box(0.04, 0.06, 0.96, s * 0.49, TOP - 0.05, 0), iron, r));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(sh(box(0.09, TOP - 0.06, 0.09, sx * 0.42, (TOP - 0.06) / 2, sz * 0.42), wood, r, { jit: 0.006 }));
  for (const s of [-1, 1]) parts.push(sh(box(0.06, 0.07, 0.76, s * 0.42, 0.14, 0), wood, r, { jit: 0.004 })); // 横の貫
  parts.push(sh(box(0.5, 0.04, 0.5, 0.12, 0.24, 0.1), wood, r, { jit: 0.004 })); // 下の棚
  // 歯車 2 つ（x の軸、歯 8 枚）と銅のモーター、軸
  const gear = (x, y, z, rad) => {
    parts.push(sh(octX(rad, 0.04, x, y, z), () => P.ironMetal[1], r));
    for (let i = 0; i < 8; i++) { const a = (i + 0.5) * Math.PI / 4; parts.push(sh(box(0.04, 0.05, 0.04, 0, 0, 0).rotateX(a).translate(x, y + Math.cos(a) * (rad + 0.02), z + Math.sin(a) * (rad + 0.02)), () => P.ironMetal[0], r)); }
  };
  gear(-0.06, 0.42, 0.12, 0.11); gear(-0.06, 0.53, 0.33, 0.07);
  parts.push(sh(octX(0.09, 0.26, 0.24, 0.36, 0.12), coppery(r), r), sh(octX(0.1, 0.03, 0.1, 0.36, 0.12), iron, r), sh(octX(0.1, 0.03, 0.38, 0.36, 0.12), iron, r));
  parts.push(sh(octX(0.02, 0.24, 0.0, 0.36, 0.12), () => P.ironMetal[2], r));
  // 天板の上: 鉄の板と木のかけら、奥の右の碍子の箱、腕の台
  parts.push(sh(box(0.3, 0.02, 0.24, 0.12, TOP + 0.01, 0.06), () => P.ironMetal[2], r));
  parts.push(sh(box(0.08, 0.05, 0.05, 0.06, TOP + 0.045, 0.06), () => P.wood[3], r), sh(box(0.08, 0.05, 0.05, 0.17, TOP + 0.045, 0.06), () => P.wood[3], r));
  parts.push(sh(box(0.2, 0.12, 0.14, 0.34, TOP + 0.06, -0.36), iron, r, { jit: 0.004 }));
  parts.push(insulator(r, 0.29, TOP + 0.12, -0.36), insulator(r, 0.39, TOP + 0.12, -0.36));
  parts.push(sh(box(0.18, 0.04, 0.18, ARM_AT[0], TOP + 0.02, ARM_AT[2]), iron, r));
  // 口: 後ろの右に入れる口と受けの箱、前の右に出す口と箱
  parts.push(inPort(r, { duct: 0.06 }));
  parts.push(sh(box(0.34, 0.3, 0.3, IN_X, 0.38, -0.27), iron, r, { jit: 0.004 }));
  parts.push(sh(box(0.32, 0.14, 0.22, OUT_X, 0.6, 0.33), iron, r, { jit: 0.004 }));
  parts.push(outPort(r, 0.43, 0.54));
  // 腕（armAt が原点）: 台の上の柱、肩の関節、上の腕、ひじ、下の腕、先のはさみ
  const arm = merge([
    sh(box(0.08, 0.34, 0.08, 0, 0.21, 0), iron, r, { jit: 0.004 }),
    sh(octX(0.055, 0.12, 0, 0.38, 0), () => P.ironMetal[1], r),
    sh(rod([0, 0.38, 0], [0, 0.52, 0.3], 0.07), iron, r, { jit: 0.004 }),
    sh(octX(0.045, 0.1, 0, 0.52, 0.3), () => P.ironMetal[1], r),
    sh(rod([0, 0.52, 0.3], [0, 0.26, 0.36], 0.05), iron, r),
    sh(box(0.16, 0.03, 0.06, 0, 0.25, 0.36), () => P.ironMetal[2], r),
    ...[-1, 1].map((s) => sh(box(0.025, 0.1, 0.05, s * 0.07, 0.19, 0.36), () => P.ironMetal[2], r)),
  ]);
  return { body: merge(parts), arm, armAt: ARM_AT };
}

// ベルト 1 枚（0.5m 角。流れる向きが +z）: 木の枠の両側の縁、上に布の帯と矢印、両はしのローラー、足の板 2 枚
export function beltGeo(r) {
  const wood = woody(r), parts = [];
  for (const s of [-1, 1]) parts.push(sh(box(0.05, 0.1, 0.5, s * 0.225, BELT_Y - 0.03, 0), wood, r, { jit: 0.004 }));
  parts.push(sh(box(0.4, 0.03, 0.5, 0, BELT_Y - 0.015, 0), (f) => (f.ny > 0.5 ? P.canvas[0] : P.soil[0]), r, { vary: 0.02 }));
  for (const z of [-0.22, 0.22]) parts.push(sh(new THREE.CylinderGeometry(0.045, 0.045, 0.4, 6).rotateZ(Math.PI / 2).translate(0, BELT_Y - 0.05, z), () => P.ironMetal[1], r));
  for (const z of [-0.2, 0.2]) parts.push(sh(box(0.4, BELT_Y - 0.08, 0.05, 0, (BELT_Y - 0.08) / 2, z), wood, r, { jit: 0.004 })); // 足の板
  const arrow = new THREE.Shape([new THREE.Vector2(-0.12, -0.06), new THREE.Vector2(0, 0.06), new THREE.Vector2(0.12, -0.06), new THREE.Vector2(0.12, -0.12), new THREE.Vector2(0, 0), new THREE.Vector2(-0.12, -0.12)]);
  parts.push(sh(new THREE.ShapeGeometry(arrow).rotateX(-Math.PI / 2).rotateY(Math.PI).translate(0, BELT_Y + 0.002, 0.03), () => P.canvas[2], r, { vary: 0.01 }));
  return merge(parts);
}

// 口の見本: 1m の鉄の箱に、後ろの入れる口と前の出す口（高さの見比べ用）
export function portSampleGeo(r) {
  return merge([sh(box(1, 0.7, 1, 0, 0.35, 0), rusty(r), r, { jit: 0.006 }), inPort(r), outPort(r, 0.5, 0.5)]);
}
