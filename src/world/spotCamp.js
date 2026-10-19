// 墜落島のスポットの物（前の漂着者の跡）: テント跡、消えたたき火、旗竿、手帳、水車の残骸、崩れた小屋
// docs/rules/objects.md「墜落島のスポットの物」。前は +z、地面は y = 0。布は両面（{ cloth, frame } の cloth を両面で描く）
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { pick, shape, merge, nonIndexed } from '../style/lowpoly.js';

// 三角形を間引く（布の裂け目）。drop(重心) が true の三角形を消す
function cutTris(geo, drop) {
  const g = nonIndexed(geo), p = g.attributes.position, keep = [];
  for (let i = 0; i < p.count; i += 3) {
    const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    if (drop(cx, cy, cz)) continue;
    for (let k = 0; k < 3; k++) keep.push(p.getX(i + k), p.getY(i + k), p.getZ(i + k));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
  return out;
}

// 布の面: 棟（ridge(s)）から地面のふち（edge(s)）へ張る。sag: たるみ。s は長い向き 0〜1、t は下へ 0〜1
function sheet(ridge, edge, sag, ns = 8, nt = 5) {
  const g = new THREE.PlaneGeometry(1, 1, ns, nt), p = g.attributes.position;
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const s = p.getX(i) + 0.5, t = 0.5 - p.getY(i);
    ridge(s, a); edge(s, b);
    a.lerp(b, t);
    a.y -= sag(s, t);
    p.setXYZ(i, a.x, a.y, a.z);
  }
  return g;
}

// テント跡（大。3.5m）: 長い向きが x の三角テント。後ろの支柱が傾いて棟が下がり、+z の布はたるんで裂け、すそがめくれる
export function tentRuin(r) {
  const F = new THREE.Vector3(1.15, 1.65, 0), Bk = new THREE.Vector3(-1.05, 1.15, 0.1); // 支柱のてっぺん（後ろは傾いて低い）
  const ridge = (s, o) => o.lerpVectors(Bk, F, s);
  const left = sheet(ridge, (s, o) => o.set(-1.3 + s * 2.6, 0.05, -1.0), (s, t) => 0.1 * Math.sin(s * Math.PI) * Math.sin(t * Math.PI));
  const right = sheet(ridge, (s, o) => o.set(-1.3 + s * 2.6, 0.25 + Math.max(0, 0.6 - s) * 0.5, 0.95 + Math.sin(s * 9) * 0.06),
    (s, t) => 0.32 * Math.sin(s * Math.PI) * Math.sin(t * Math.PI));
  const tear = (x, y, z) => z > 0.2 && ((x + 0.05) / 0.42) ** 2 + ((y - 0.7) / 0.26) ** 2 < 1 + Math.sin(x * 23 + y * 7) * 0.45; // ふちがギザギザの裂け目
  const clothCol = (f) => pick(r, f.ny > 0.3 ? [P.canvas[1], P.canvas[2]] : [P.canvas[0], P.canvas[1]]);
  const cloth = merge([shape(left, clothCol, r), shape(cutTris(right, tear), clothCol, r)]);
  const pole = (top, lean) => shape(new THREE.CylinderGeometry(0.06, 0.06, top.y + 0.1, 8).translate(0, (top.y + 0.1) / 2 - 0.05, 0)
    .rotateZ(lean).translate(top.x + Math.sin(lean) * top.y, 0, top.z), () => pick(r, [P.wood[1], P.wood[2]]), r); // 傾けても先が top に来る
  const frame = [pole(F, 0), pole(Bk, -0.22)];
  const len = F.distanceTo(Bk), mid = F.clone().add(Bk).multiplyScalar(0.5);
  frame.push(shape(new THREE.CylinderGeometry(0.05, 0.05, len + 0.2, 8).rotateZ(Math.PI / 2).rotateZ(Math.atan2(F.y - Bk.y, F.x - Bk.x))
    .translate(mid.x, mid.y + 0.06, mid.z), P.wood[2], r));
  for (const [top, gx] of [[F, 2.3], [Bk, -2.1]]) { // 張り綱と杭
    const a = new THREE.Vector3(gx, 0.15, 0), d = top.clone().sub(a), L = d.length();
    const rope = new THREE.BoxGeometry(L, 0.04, 0.04).translate(L / 2, 0, 0).rotateZ(Math.atan2(d.y, d.x)).translate(a.x, a.y, a.z);
    frame.push(shape(rope, P.straw[1], r));
    frame.push(shape(new THREE.BoxGeometry(0.1, 0.32, 0.1).translate(gx, 0.12, 0).rotateZ(Math.sign(gx) * -0.3), P.wood[3], r));
  }
  return { cloth, frame: merge(frame) };
}

// 消えたたき火（中。1.1m）: 1 つにつながった石の輪（内側はすす）、交差した炭の薪 2 本、灰
export function deadFire(r) {
  const ring = new THREE.TorusGeometry(0.45, 0.13, 5, 8).rotateX(Math.PI / 2);
  ring.scale(1, 0.75, 1).translate(0, 0.07, 0);
  const parts = [shape(ring, (f) => (f.x * f.nx + f.z * f.nz < 0 ? P.coal[2] : pick(r, [P.stone[1], P.stone[2], P.stone[3]])), r, { jit: 0.06 })];
  for (const a of [0.4, -0.7]) {
    const log = new THREE.CylinderGeometry(0.07, 0.08, 0.72, 6).rotateZ(Math.PI / 2).rotateY(a).translate(0, 0.1 + (a > 0 ? 0.06 : 0), 0);
    parts.push(shape(log, (f) => (Math.abs(f.nx * Math.cos(a) - f.nz * Math.sin(a)) > 0.9 ? P.wood[2] : pick(r, [P.coal[0], P.coal[1], P.coal[2]])), r, { jit: 0.02 }));
  }
  parts.push(shape(new THREE.CylinderGeometry(0.34, 0.38, 0.1, 8).translate(0, 0.02, 0), () => pick(r, [P.rockGray[3], P.rockGray[2]]), r, { jit: 0.02 }));
  return merge(parts);
}

// 旗竿（大。6.5m）: 竹の竿（節は少し太い）を石 3 つで支え、てっぺんに色あせた布。オレンジの帯 1 本。はしはほつれる
export function flagPole(r) {
  const H = 6.5, g = new THREE.CylinderGeometry(0.06, 0.07, H, 8, 12), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) + H / 2) / H;
    if (t > 0.01 && t < 0.99 && Math.round(t * 6) === t * 6) { p.setX(i, p.getX(i) * 1.3); p.setZ(i, p.getZ(i) * 1.3); }
  }
  g.translate(0, H / 2, 0).rotateZ(0.04);
  const parts = [shape(g, () => pick(r, [P.bamboo[1], P.bamboo[2]]), r)];
  const flag = new THREE.PlaneGeometry(1.25, 0.7, 5, 3), fp = flag.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    const u = fp.getX(i) / 1.25 + 0.5;
    fp.setZ(i, Math.sin(u * 5) * 0.12 * u);
    if (u > 0.95) fp.setY(i, fp.getY(i) + (r() - 0.5) * 0.12); // ほつれ
  }
  flag.translate(0.66, H - 0.45, 0).rotateZ(0.04);
  parts.push(shape(flag, (f) => (Math.abs(f.y - (H - 0.45)) < 0.1 ? P.catOrange[0] : pick(r, [P.canvas[2], P.canvas[1]])), r));
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2, st = new THREE.DodecahedronGeometry(0.2, 0).scale(1.2, 0.8, 1).translate(Math.cos(a) * 0.22, 0.1, Math.sin(a) * 0.22);
    parts.push(shape(st, () => pick(r, [P.stone[1], P.stone[2]]), r, { jit: 0.04 }));
  }
  return merge(parts);
}

// 手帳（小。0.3m）: 厚い表紙（暗い革）とページのふち、表紙を巻くオレンジの帯
export function notebook(r) {
  const cover = new THREE.BoxGeometry(0.3, 0.1, 0.22, 2, 1, 2).translate(0, 0.05, 0); // 表紙の真ん中を少しふくらませる
  cover.attributes.position.array.forEach((v, i, a) => { if (i % 3 === 1 && v > 0.09 && Math.abs(a[i - 1]) < 0.01) a[i] = v + 0.012; });
  const parts = [shape(cover, (f) => (f.ny > 0.9 || f.ny < -0.9 || f.nx < -0.9 ? P.wood[0] : P.sand[3]), r)];
  parts.push(shape(new THREE.BoxGeometry(0.1, 0.11, 0.23).translate(0.06, 0.05, 0), P.catOrange[1], r));
  return merge(parts);
}

// 水車の残骸（大。3.5m）: 八角の輪 2 枚、輻 4 本（8 方向）、軸、羽根板 8 枚のうち 3 枚が欠ける。回る軸は x。濡れた下は暗い
export function waterWheel(r) {
  const R = 1.75, wet = (f, c) => (f.y < 0 ? P.wood[0] : c);
  const parts = [];
  for (const x of [-0.38, 0.38]) parts.push(shape(new THREE.TorusGeometry(R, 0.1, 4, 8).rotateY(Math.PI / 2).translate(x, 0, 0), (f) => wet(f, P.wood[1]), r, { jit: 0.02 }));
  for (let k = 0; k < 4; k++) parts.push(shape(new THREE.BoxGeometry(0.12, R * 2 - 0.1, 0.12).rotateX((k / 4) * Math.PI), (f) => wet(f, P.wood[2]), r));
  parts.push(shape(new THREE.CylinderGeometry(0.18, 0.18, 1.2, 8).rotateZ(Math.PI / 2), P.wood[1], r));
  for (let k = 0; k < 8; k++) {
    if (k === 1 || k === 4 || k === 6) continue; // 欠けた羽根板
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8, broken = k === 7;
    const b = new THREE.BoxGeometry(0.86, 0.5, 0.1).translate(0, broken ? 0.12 : 0, 0).rotateX(broken ? 0.7 : 0).translate(0, R + 0.12, 0).rotateX(a);
    parts.push(shape(b, (f) => wet(f, pick(r, [P.wood[2], P.wood[3]])), r, { jit: 0.02 }));
  }
  const g = merge(parts);
  g.rotateZ(0.28).translate(0, R * 0.55, 0); // 傾いて、下は川に沈む
  return g;
}

// 崩れた小屋（大。3m）: 板の壁 2 枚（上はギザギザに折れる。1 枚は低い）、柱 3 本（1 本は途中で折れる）、水を引く樋
export function millHut(r) {
  const parts = [];
  const wall = (w, h, cut) => {
    const g = new THREE.BoxGeometry(w, h, 0.12, 6, 4, 1), p = g.attributes.position, drop = Array.from({ length: 7 }, () => r() * cut);
    for (let i = 0; i < p.count; i++) if (p.getY(i) > h / 2 - 0.01) p.setY(i, p.getY(i) - drop[Math.round((p.getX(i) / w + 0.5) * 6)]);
    return shape(g.translate(0, h / 2, 0), (f) => (Math.floor((f.x / w + 0.5) * 6) % 2 ? P.wood[1] : P.wood[2]), r, { jit: 0.02 });
  };
  parts.push(wall(3, 2.1, 0.9).translate(0, 0, -1.4));
  parts.push(wall(2.6, 1.2, 0.5).rotateY(Math.PI / 2).translate(-1.45, 0, -0.1));
  for (const [x, z, h] of [[1.45, -1.4, 2.4], [1.45, 1.3, 1.3], [-1.45, 1.3, 2.2]]) {
    const post = new THREE.CylinderGeometry(0.1, 0.11, h, 8, 2), pp = post.attributes.position;
    for (let i = 0; i < pp.count; i++) if (pp.getY(i) > h / 2 - 0.01) pp.setY(i, pp.getY(i) - r() * 0.25); // 折れた先
    parts.push(shape(post.translate(x, h / 2, z), () => pick(r, [P.wood[0], P.wood[1]]), r));
  }
  const u = new THREE.Shape([[-0.2, 0], [0.2, 0], [0.2, 0.22], [0.1, 0.22], [0.1, 0.1], [-0.1, 0.1], [-0.1, 0.22], [-0.2, 0.22]].map(([x, y]) => new THREE.Vector2(x, y)));
  const trough = new THREE.ExtrudeGeometry(u, { depth: 3.2, bevelEnabled: false }).rotateX(0.12).translate(1.0, 0.9, -0.2);
  parts.push(shape(trough, () => pick(r, [P.wood[2], P.wood[3]]), r));
  return merge(parts);
}
