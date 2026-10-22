// ロボットの共通部品（docs/rules/enemies.md）。敵はすべてここの部品で作る。
// 形は原点まわりに作り、scale（のばす）→ rot（回転、ラジアン）→ at（位置）の順で置く。人工物なので、ゆがませない。
// 見た目は docs/refs/enemies/ の参考画像をできるだけ真似る。
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { shape, merge, makeMesh, GLOW, markGlow } from '../style/lowpoly.js';

// 光る部品の材質に印をつける: ブルームのしきい値に届くくらい光っている間だけ数える（lowpoly.js glowSeen）
const markEmissive = (mat) => markGlow(mat, () => mat.emissiveIntensity * Math.max(mat.emissive.r, mat.emissive.g, mat.emissive.b) > 1.2);

// 面の向きで色を変える: 上向きは明るく、横は中、下は暗い
const byFace = (pal) => (f) => (f.ny > 0.6 ? pal[2] : f.ny < -0.6 ? pal[0] : pal[1]);

function put(geo, { at = [0, 0, 0], rot = [0, 0, 0], scale } = {}) {
  if (scale) geo.scale(...scale);
  if (rot[0] || rot[1] || rot[2]) geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot)));
  return geo.translate(...at);
}

// pal: 色 1 つ、色の 3 段（面の向きで塗る）、または面 → 色の関数（場所で塗り分ける。カニの脚の暗い先など）
const paintAs = (geo, pal, rand, o) => shape(put(geo, o), typeof pal === 'string' || typeof pal === 'function' ? pal : byFace(pal), rand, { vary: 0.03 });

export const robot = {
  // 箱（胴、装甲板、足の裏）。薄くすれば板
  block: (rand, [w, h, d], pal = P.robotShell, o) => paintAs(new THREE.BoxGeometry(w, h, d), pal, rand, o),
  // 柱（脚、腕、軸）。上と下で太さを変えられる。角の数は o.seg（ふつうは 8）。o.flat: 角でなく平らな面を ±z・±x に向ける
  tube: (rand, r, h, pal = P.robotFrame, o, rBottom = r) => {
    const seg = o?.seg ?? 8;
    return paintAs(new THREE.CylinderGeometry(r, rBottom, h, seg, 1, false, o?.flat ? Math.PI / seg : 0), pal, rand, o);
  },
  // 角を落とした箱（胴、頭、腕の装甲）。八角柱をのばして作る。o.axis: 角を落とす辺の向き（'y' ふつう・'z' 前後・'x' 左右）
  // o.taper: 軸の - 側のはしの太さ（1 で同じ。y なら下、z なら後ろ、x なら -x 側）
  bevel: (rand, [w, h, d], pal = P.robotShell, o = {}) => {
    const k = 1 / Math.cos(Math.PI / 8), ax = o.axis ?? 'y';
    const g = new THREE.CylinderGeometry(1, o.taper ?? 1, 1, 8, 1, false, Math.PI / 8);
    if (ax === 'z') g.rotateX(Math.PI / 2);
    else if (ax === 'x') g.rotateZ(-Math.PI / 2);
    g.scale(ax === 'x' ? w : w / 2 * k, ax === 'y' ? h : h / 2 * k, ax === 'z' ? d : d / 2 * k);
    return paintAs(g, pal, rand, { at: o.at, rot: o.rot });
  },
  // 折れ線の脚（カニの脚など）: 点をつなぐ四角い棒。つなぎ目の角を共有するので、曲がっていても部品 1 つ。太さ 0 の点はとがる
  strut: (rand, pts, radii, pal = P.robotShell, o) => {
    const V = pts.map((p) => new THREE.Vector3(...p)), n = V.length;
    const rings = V.map((p, i) => {
      const t = new THREE.Vector3();
      if (i > 0) t.add(p.clone().sub(V[i - 1]).normalize());
      if (i < n - 1) t.add(V[i + 1].clone().sub(p).normalize());
      t.normalize();
      const up = Math.abs(t.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const s = new THREE.Vector3().crossVectors(t, up).normalize(), u = new THREE.Vector3().crossVectors(s, t);
      return [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([a, b]) => p.clone().addScaledVector(s, a * radii[i]).addScaledVector(u, b * radii[i]));
    });
    const v = [], tri = (a, b, c) => v.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < 4; k++) {
      const a = rings[i][k], b = rings[i][(k + 1) % 4], c = rings[i + 1][(k + 1) % 4], d = rings[i + 1][k];
      if (radii[i] > 0) tri(a, c, b); // 太さ 0 の点（とがった端）では、つぶれた三角形を作らない
      if (radii[i + 1] > 0) tri(a, d, c);
    }
    const c0 = rings[0];
    if (radii[0] > 0) { tri(c0[0], c0[1], c0[2]); tri(c0[0], c0[2], c0[3]); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    return paintAs(g, pal, rand, o);
  },
  // 横から見た形を押し出した板（銃の本体など）。pts: 横から見た形 [[z, y], ...]（前が +z）、w: 厚み（x の向き）
  plate: (rand, pts, w, pal = P.robotShell, o) => {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y))), { depth: w, bevelEnabled: false });
    g.translate(0, 0, -w / 2);
    g.rotateY(-Math.PI / 2); // 形の x → z、押し出しの z → x
    return paintAs(g, pal, rand, o);
  },
  // 面の多い丸いかたまり（フード、丸い胸、肩当て）。低分割の球をのばす。seg: [横の分割, 縦の分割]
  blob: (rand, [rx, ry, rz], pal = P.robotShell, o = {}, [ws, hs] = [8, 4]) => {
    const g = new THREE.SphereGeometry(1, ws, hs, Math.PI / ws);
    g.scale(rx, ry, rz);
    return paintAs(g, pal, rand, { at: o.at, rot: o.rot });
  },
  // 岩の形（十二面体。岩のふりの殻など）。o.scale でつぶす
  boulder: (rand, r, pal = P.robotShell, o) => paintAs(new THREE.DodecahedronGeometry(r, 0), pal, rand, o),
  // 関節の球（低分割）
  ball: (rand, r, pal = P.robotFrame, o) => paintAs(new THREE.IcosahedronGeometry(r, 0), pal, rand, o),
  // 目・光る所
  eye: (rand, r, o) => paintAs(new THREE.OctahedronGeometry(r), P.robotEye, rand, o),
  // ネジ・リベット（小さい飾り）
  bolt: (rand, r, pal = P.robotFrame, o) => paintAs(new THREE.CylinderGeometry(r, r, r, 6), pal, rand, o),
  // 厚みのある八角の輪（ファンの囲い、冷却口のふち）。r: 外側、w: 輪の幅、h: 高さ。軸は y
  duct: (rand, r, w, h, pal = P.robotFrame, o) => {
    const ri = r - w, pts = [[ri, -h / 2], [r, -h / 2], [r, h / 2], [ri, h / 2], [ri, -h / 2]].map(([x, y]) => new THREE.Vector2(x, y));
    return paintAs(new THREE.LatheGeometry(pts, 8, Math.PI / 8), pal, rand, o);
  },
  // ファンの羽: 中心から先が広がる三角形を n 枚、少しひねって並べる（中心でつながるので部品 1 つ）。solid(…, { double: true }) で両面にする
  blades: (rand, r, n, width, pal = P.robotMetal, o) => {
    const v = [], tw = 0.35, dy = Math.sin(tw) * width / 2, dz = Math.cos(tw) * width / 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const p = (x, y, z) => [x * c + z * s, y, -x * s + z * c]; // y 軸まわりに a 回す
      v.push(0, 0, 0, ...p(r, -dy, dz), ...p(r, dy, -dz));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    return paintAs(g, pal, rand, o);
  },
};

// 敵の共通の目（enemies.md）: 怒った角度の棒 ×2（＼ ／）。dead 1 で × になる。blink 1 で速く点滅（ため）
// at: 両目の真ん中、gap: 目と目の間、len: 棒の長さ。前は +z
export function angryEyes(rand, { at = [0, 0, 0], gap = 0.1, len = 0.07 } = {}) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: new THREE.Color(P.robotEye[1]).multiplyScalar(GLOW), emissiveIntensity: 0 });
  markEmissive(mat);
  const group = new THREE.Group();
  group.position.set(...at);
  const ANGRY = 0.4, X = Math.PI / 4;
  const eyes = [-1, 1].map((side) => { // side -1 が見る人から見て左（＼）
    const bar = () => {
      const m = new THREE.Mesh(paintAs(new THREE.BoxGeometry(len, len * 0.26, len * 0.15), P.robotEye, rand), mat);
      m.position.x = side * gap / 2;
      group.add(m);
      return m;
    };
    return { side, a: bar(), b: bar() }; // a: いつもの棒、b: × のもう 1 本（ふだんは隠す）
  });
  return {
    group,
    update(t, { glow = 0.5, blink = 0, dead = 0 } = {}) {
      for (const { side, a, b } of eyes) {
        a.rotation.z = side * (ANGRY + (X - ANGRY) * dead);
        b.rotation.z = -side * X;
        b.scale.setScalar(Math.max(0.001, dead));
      }
      mat.emissiveIntensity = glow * (1 - blink * (Math.sin(t * 30) > 0 ? 0.85 : 0));
    },
  };
}

// 目のまわりの光の輪（enemies.md「戦闘の演出」の目の光）: ためで赤く広がり、放出の瞬間に白く光る。光の板（いつもこちらを向く）
let haloTex = null;
function haloTexture() {
  if (haloTex) return haloTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.45)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return (haloTex = new THREE.CanvasTexture(c));
}
const HALO_RED = new THREE.Color(P.fx.eyeHalo), HALO_WHITE = new THREE.Color(P.fx.flash);
export function eyeHalo({ at = [0, 0, 0], size = 0.35 } = {}) {
  const mat = new THREE.SpriteMaterial({ map: haloTexture(), color: HALO_RED.clone(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const sprite = new THREE.Sprite(mat);
  sprite.position.set(...at);
  sprite.renderOrder = 3;
  return {
    sprite,
    // charge: ための強さ（0〜1）、flash: 放出の白い光（0〜1）
    update(charge, flash) {
      const a = Math.max(charge * 0.8, flash);
      mat.opacity = a;
      mat.color.copy(HALO_RED).lerp(HALO_WHITE, flash);
      sprite.scale.setScalar(size * (0.5 + charge * 0.7 + flash * 0.9));
      sprite.visible = a > 0.01;
    },
  };
}

// 光る部品（冷却口など）: 自分の材質を持つ。mat.emissiveIntensity で明るさを変える
export function glowing(geos, pal) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: new THREE.Color(pal[1]).multiplyScalar(GLOW), emissiveIntensity: 0.5 });
  markEmissive(mat);
  const g = merge(geos);
  g.computeVertexNormals();
  return { mesh: new THREE.Mesh(g, mat), mat };
}

// 塗った形を 1 つのメッシュにする（動かない部分）。double: 裏も見せる（輪など）
export const solid = (geos, opt) => makeMesh(merge(geos), opt);

// 動く部品: 原点が関節の Group。geos は関節を原点にして作る。Group を子に足せば、関節がつながる
export function limb(geos, at = [0, 0, 0], opt) {
  const g = new THREE.Group();
  g.add(solid(geos, opt));
  g.position.set(...at);
  return g;
}

// ポーズのつなぎ方（enemies.md「ため → 放出の緩急」「戦闘の演出」）。how: ポーズ名 → 'charge' ため | 'release' 放出。ほかは「ばね」で追いかける
// 放出のポーズから離れるときは「戻り」。どのつなぎも、前の動きの速さを引き継いで始まる（急に止まらない）
// opt: rate つなぎの速さの倍率、settle 戻りの秒。set(name, secs): secs はためる秒。step(dt) は cur を動かし、震えの強さ（0〜1）を返す
const RELEASE = 0.08, CARRY = 0.07; // 放出の秒、前の速さを引き継ぐ長さ（秒）
const outCubic = (u) => 1 - (1 - u) ** 3;
const outBack = (u) => { const c = 1.70158, v = u - 1; return 1 + (c + 1) * v ** 3 + c * v * v; }; // 少し行き過ぎて戻る
const smooth = (u) => u * u * (3 - 2 * u);
export function createPoser(poses, how = {}, { rate = 1, settle = 0.45 } = {}) {
  const cur = { ...poses.idle }, vel = {};
  for (const k in cur) vel[k] = 0;
  const w = 11 * rate; // ばねの強さ（臨界減衰。行き過ぎない）
  let name = 'idle', target = poses.idle, from = cur, v0 = vel, curve = null, dur = 1, t = 0;
  return {
    cur,
    get name() { return name; },
    get curve() { return curve; },
    set(next, secs) {
      if (next === name) return;
      curve = how[next] ?? (how[name] === 'release' ? 'settle' : null);
      name = next; target = poses[next] ?? poses.idle;
      from = { ...cur }; v0 = { ...vel }; t = 0;
      dur = curve === 'charge' ? Math.max(0.1, secs || 0.5) : curve === 'release' ? RELEASE : settle;
    },
    step(dt) {
      if (dt <= 0) return 0;
      if (!curve) { // ばね: 速さが続いたまま目標へ
        for (const k in cur) { vel[k] += (w * w * (target[k] - cur[k]) - 2 * w * vel[k]) * dt; cur[k] += vel[k] * dt; }
        return 0;
      }
      t += dt;
      const u = Math.min(1, t / dur);
      const e = curve === 'charge' ? outCubic(Math.min(1, u / 0.45)) * 0.85 + 0.15 * u * u // グッ: 大きく引いて、ゆっくり押し込む
        : curve === 'release' ? outBack(u) : smooth(u); // バッ・戻り
      const carry = t * Math.exp(-t / CARRY); // 前の速さの引き継ぎ（はじめの傾きが前の速さ、すぐ消える）
      for (const k in cur) { const n = from[k] + (target[k] - from[k]) * e + v0[k] * carry; vel[k] = (n - cur[k]) / dt; cur[k] = n; }
      const shake = curve === 'charge' ? smooth(Math.max(0, (u - 0.55) / 0.45)) : 0; // ためきる前に震える
      if (u >= 1 && curve !== 'charge') { curve = null; for (const k in vel) vel[k] = 0; }
      return shake;
    },
  };
}
