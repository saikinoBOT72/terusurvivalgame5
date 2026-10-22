// AK47（作り直し）: 前の FPS の銃（gun-export/ak47.glb）を、このゲームの作り方で作り直した物（style.md「実銃（例外）」）
// 寸法と動く部品の分け方は export に合わせる。前（銃口）が +z、上が +y、左の面が +x（gunShapes.js と同じ）。原点は機関部の下・握りの付け根
// 色: 鋼（黒い青）= robotFrame、明るい金属の小物 = ironMetal、木 = wood。丸い部品（銃床・握り・ハンドガード・弾倉・上のふた）はロフト
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { rng, shape, merge, makeMesh } from '../style/lowpoly.js';
import { robot as R } from '../mobs/parts.js';
import { flesh } from '../creatures/flesh.js';

const ALONG = Math.PI / 2; // 柱（軸 y）を前後（z）に向ける
const SIDE = [0, 0, Math.PI / 2]; // 柱を左右（x）に向ける
const STEEL = P.robotFrame, BRIGHT = P.ironMetal.slice(0, 3);
const WOOD = P.wood.slice(1, 4), DARKWOOD = P.wood.slice(0, 3);
const BORE_Y = 0.038; // 銃身の軸の高さ
export const AK_MUZZLE = [0, BORE_Y, 0.564];
export const AK_EJECT = [-0.015, 0.034, 0.132];
const PIVOT = { carrier: [0, 0.03, 0.13], mag: [0, 0, 0.132], trigger: [0, 0, 0.04] }; // export のノードの位置（z を反対に）

// 穴のあいた板（用心金など）: 横から見た外の形と穴の形 [[z, y], ...] を、厚み w で左右（x）に押し出す
function holed(r, outer, inner, w, pal, at = [0, 0, 0]) {
  const s = new THREE.Shape(outer.map(([z, y]) => new THREE.Vector2(z, y)));
  s.holes.push(new THREE.Path(inner.map(([z, y]) => new THREE.Vector2(z, y))));
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false, curveSegments: 2 });
  g.translate(0, 0, -w / 2).rotateY(-Math.PI / 2).translate(...at);
  return shape(g, typeof pal === 'string' ? pal : (f) => (f.ny > 0.55 ? pal[2] : f.ny < -0.55 ? pal[0] : pal[1]), r, { vary: 0.03 });
}

// 本体（動かない部分）
function bodyParts(r) {
  const out = [];
  // ---- 機関部: 箱の板、前の帯、排莢口（右）、肉抜きのくぼみ（左右）、リベット ----
  out.push(R.plate(r, [[-0.086, 0.004], [-0.086, 0.036], [0.204, 0.036], [0.204, 0.002], [0.19, -0.005], [0.084, -0.005], [0.078, 0], [-0.07, 0]], 0.026, STEEL));
  out.push(R.block(r, [0.03, 0.042, 0.01], STEEL, { at: [0, 0.023, 0.199] })); // 前の帯（トラニオン）
  out.push(R.block(r, [0.002, 0.012, 0.052], P.coal, { at: [-0.0126, 0.03, 0.124] })); // 排莢口の暗い穴（右）
  for (const s of [1, -1]) {
    out.push(R.block(r, [0.002, 0.016, 0.06], STEEL[0], { at: [s * 0.0128, 0.012, 0.165] })); // 弾倉の上の肉抜き
    for (const [z, y] of [[0.126, 0.008], [0.138, 0.008], [0.15, 0.006], [-0.044, 0.009], [-0.056, 0.009]]) {
      out.push(R.block(r, [0.0016, 0.004, 0.004], BRIGHT, { at: [s * 0.0136, y, z], rot: [Math.PI / 4, 0, 0] })); // リベット（小さいので菱形の箱）
    }
    for (const z of [0.038, 0.058]) out.push(R.block(r, [0.0018, 0.0035, 0.0035], STEEL, { at: [s * 0.0137, 0.01, z] })); // 引き金・撃鉄のピン
  }
  // ---- 上のふた: 上が丸いロフト、横のリブ 4 本、後ろのばねのボタン ----
  out.push(flesh.loft(r, [
    { z: -0.084, y: 0.036, w: 0.025, t: 0.013, b: 0.001, sq: 2.3 },
    { z: 0.0, y: 0.036, w: 0.026, t: 0.014, b: 0.001, sq: 2.3 },
    { z: 0.146, y: 0.036, w: 0.026, t: 0.014, b: 0.001, sq: 2.3 },
  ], STEEL, { seg: 10 }));
  for (const z of [-0.018, 0.026, 0.07, 0.114]) {
    out.push(flesh.loft(r, [{ z: z - 0.002, y: 0.036, w: 0.0275, t: 0.0152, b: 0.001, sq: 2.3 }, { z: z + 0.002, y: 0.036, w: 0.0275, t: 0.0152, b: 0.001, sq: 2.3 }], STEEL, { seg: 8 }));
  }
  out.push(R.tube(r, 0.004, 0.006, BRIGHT, { rot: [ALONG, 0, 0], at: [0, 0.042, -0.088], seg: 6 }));
  // ---- 切り替えレバー（右）: 長い板、後ろの軸、前の指かけ ----
  out.push(R.plate(r, [[0.006, 0.023], [0.006, 0.034], [0.022, 0.035], [0.128, 0.026], [0.137, 0.022], [0.137, 0.011], [0.126, 0.01], [0.022, 0.021]], 0.0016, BRIGHT, { at: [-0.0142, 0, 0] })); // 幅の広い板。撃てる位置（前が下がる）
  out.push(R.tube(r, 0.0055, 0.003, BRIGHT, { rot: SIDE, at: [-0.0143, 0.029, 0.012], seg: 8 }));
  out.push(R.block(r, [0.006, 0.01, 0.004], BRIGHT, { at: [-0.0165, 0.015, 0.137], rot: [0, 0.6, 0] }));
  // ---- 後ろの照準（タンジェント）: 台、斜めの板、目盛りの滑り、のぞく溝 ----
  out.push(R.plate(r, [[0.146, 0.036], [0.146, 0.047], [0.166, 0.053], [0.206, 0.056], [0.21, 0.036]], 0.02, STEEL));
  out.push(R.block(r, [0.012, 0.003, 0.044], STEEL, { at: [0, 0.055, 0.171], rot: [0.12, 0, 0] }));
  out.push(R.block(r, [0.017, 0.006, 0.009], BRIGHT, { at: [0, 0.057, 0.176], rot: [0.12, 0, 0] }));
  for (const s of [1, -1]) out.push(R.block(r, [0.0035, 0.006, 0.004], STEEL, { at: [s * 0.004, 0.061, 0.151] }));
  // ---- 銃身・ガスの筒・ガスの台・前の照準・銃口・クリーニングロッド ----
  out.push(R.tube(r, 0.0085, 0.346, STEEL, { rot: [ALONG, 0, 0], at: [0, BORE_Y, 0.377], seg: 8 }));
  out.push(R.tube(r, 0.0088, 0.24, STEEL, { rot: [ALONG, 0, 0], at: [0, 0.0515, 0.326], seg: 8 }));
  for (const s of [1, -1]) for (const z of [0.215, 0.223, 0.231]) out.push(R.block(r, [0.002, 0.004, 0.005], P.coal, { at: [s * 0.0086, 0.0515, z] })); // ガスの抜け穴
  out.push(R.plate(r, [[0.432, 0.03], [0.432, 0.062], [0.461, 0.062], [0.471, 0.046], [0.471, 0.03]], 0.02, STEEL));
  out.push(R.block(r, [0.008, 0.009, 0.026], STEEL, { at: [0, 0.025, 0.456] })); // 銃剣の止め
  out.push(R.block(r, [0.02, 0.024, 0.03], STEEL, { at: [0, 0.038, 0.512] })); // 前の照準の台（銃身を巻く）
  out.push(R.plate(r, [[0.497, 0.05], [0.506, 0.066], [0.518, 0.066], [0.527, 0.05]], 0.012, STEEL));
  for (const s of [1, -1]) out.push(R.block(r, [0.002, 0.03, 0.011], STEEL, { at: [s * 0.007, 0.064, 0.512] })); // 照準の耳
  out.push(R.tube(r, 0.0016, 0.014, BRIGHT, { at: [0, 0.072, 0.512], seg: 6 })); // 照星
  out.push(R.tube(r, 0.0105, 0.017, STEEL, { rot: [ALONG, 0, 0], at: [0, BORE_Y, 0.554], seg: 8 })); // 銃口のねじ守り
  out.push(R.tube(r, 0.0052, 0.002, P.coal, { rot: [ALONG, 0, 0], at: [0, BORE_Y, 0.5635], seg: 8 })); // 銃口の穴
  out.push(R.tube(r, 0.0022, 0.27, BRIGHT, { rot: [ALONG, 0, 0], at: [0, 0.0235, 0.41], seg: 6 })); // クリーニングロッド
  // ---- ハンドガード: 下（木・指の溝）、上（木。ガスの筒にかぶる）、前後の鉄の帯 ----
  out.push(flesh.loft(r, [
    { z: 0.204, y: 0.022, w: 0.034, t: 0.019, b: 0.018, sq: 2.8 },
    { z: 0.25, y: 0.022, w: 0.037, t: 0.019, b: 0.02, sq: 2.8 },
    { z: 0.34, y: 0.022, w: 0.036, t: 0.019, b: 0.02, sq: 2.8 },
    { z: 0.374, y: 0.023, w: 0.032, t: 0.017, b: 0.017, sq: 2.8 },
  ], WOOD, { seg: 12, start: null, end: null })); // 前後のはしは鉄の帯に隠れる
  for (const s of [1, -1]) out.push(R.block(r, [0.002, 0.005, 0.1], P.wood[0], { at: [s * 0.0178, 0.019, 0.297] })); // 指の溝
  out.push(flesh.loft(r, [
    { z: 0.236, y: 0.049, w: 0.026, t: 0.012, b: 0.004, sq: 2.4 },
    { z: 0.25, y: 0.049, w: 0.03, t: 0.015, b: 0.004, sq: 2.4 },
    { z: 0.37, y: 0.049, w: 0.03, t: 0.015, b: 0.004, sq: 2.4 },
    { z: 0.385, y: 0.049, w: 0.025, t: 0.012, b: 0.004, sq: 2.4 },
  ], WOOD, { seg: 10 }));
  out.push(R.bevel(r, [0.039, 0.04, 0.008], STEEL, { axis: 'z', at: [0, 0.022, 0.208] })); // 後ろの帯
  out.push(R.block(r, [0.003, 0.007, 0.014], BRIGHT, { at: [-0.02, 0.03, 0.208] })); // ハンドガードを外すレバー（右）
  out.push(R.bevel(r, [0.034, 0.041, 0.009], STEEL, { axis: 'z', at: [0, 0.026, 0.378] })); // 前の帯
  // ---- 銃床: 後ろへ太く・下へ下がるロフト、鉄の床尾板とふた、スリングの金具 ----
  out.push(flesh.loft(r, [
    { z: -0.322, y: -0.035, w: 0.036, t: 0.057, b: 0.059, sq: 3 },
    { z: -0.3, y: -0.033, w: 0.037, t: 0.056, b: 0.056, sq: 3 },
    { z: -0.2, y: -0.014, w: 0.034, t: 0.046, b: 0.04, sq: 3 },
    { z: -0.12, y: 0.004, w: 0.03, t: 0.033, b: 0.03, sq: 3 },
    { z: -0.084, y: 0.017, w: 0.027, t: 0.021, b: 0.019, sq: 3 },
  ], WOOD, { seg: 12, end: null })); // 前のはしは機関部に隠れる
  out.push(R.bevel(r, [0.039, 0.12, 0.006], STEEL, { axis: 'z', at: [0, -0.036, -0.325] }));
  out.push(R.block(r, [0.02, 0.04, 0.002], BRIGHT, { at: [0, -0.03, -0.3285] })); // 手入れ道具のふた
  out.push(R.tube(r, 0.003, 0.002, STEEL, { rot: [ALONG, 0, 0], at: [0, 0.0, -0.329], seg: 6 })); // ふたのボタン
  out.push(holed(r, [[-0.292, -0.083], [-0.292, -0.098], [-0.264, -0.094], [-0.264, -0.079]], [[-0.287, -0.086], [-0.287, -0.093], [-0.269, -0.09], [-0.269, -0.083]], 0.004, STEEL, [0.0205, 0, 0])); // スリングの金具（左）
  // ---- 握り（木）: 後ろへ傾いたロフト、下のねじ ----
  out.push(flesh.loft(r, [
    { z: 0, y: 0, w: 0.024, t: 0.017, b: 0.018, sq: 2.6 },
    { z: 0.04, y: -0.013, w: 0.027, t: 0.018, b: 0.019, sq: 2.6 },
    { z: 0.08, y: -0.026, w: 0.028, t: 0.018, b: 0.019, sq: 2.6 },
    { z: 0.104, y: -0.035, w: 0.026, t: 0.017, b: 0.018, sq: 2.6 },
  ], DARKWOOD, { seg: 10, start: null, rot: [ALONG, 0, 0], at: [0, -0.002, 0.002] })); // 上のはしは機関部に隠れる
  out.push(R.tube(r, 0.003, 0.002, STEEL, { at: [0, -0.107, -0.033], seg: 6 }));
  // ---- 用心金（穴のあいた板）・弾倉を外すレバー ----
  out.push(holed(r,
    [[0.084, -0.003], [0.08, -0.02], [0.066, -0.027], [0.014, -0.027], [0.004, -0.016], [0.004, -0.003], [0.01, -0.003], [0.012, -0.014], [0.018, -0.022], [0.064, -0.022], [0.075, -0.016], [0.078, -0.003]],
    [[0.07, -0.01], [0.066, -0.019], [0.02, -0.019], [0.016, -0.01]], 0.012, BRIGHT));
  out.push(R.block(r, [0.012, 0.012, 0.004], BRIGHT, { at: [0, -0.009, 0.08], rot: [-0.3, 0, 0] }));
  return out;
}

// ボルトキャリア（動く。原点は PIVOT.carrier）: 排莢口に見える明るい鉄と、右へ出たコッキングハンドル
function carrierParts(r) {
  return [
    R.block(r, [0.002, 0.007, 0.048], BRIGHT, { at: [-0.0133, 0.0, -0.006] }),
    R.tube(r, 0.0028, 0.016, BRIGHT, { rot: SIDE, at: [-0.021, 0.0, 0.0], seg: 6 }),
    R.bevel(r, [0.008, 0.009, 0.012], BRIGHT, { axis: 'x', at: [-0.032, 0.0015, 0.0], taper: 0.85 }),
  ];
}

// 弾倉（動く。原点は PIVOT.mag）: 下へいくほど前へ曲がるロフト、左右の縦のリブ、前の引っかけ、底の板
function magParts(r) {
  const rings = [
    { z: 0, y: 0.004, w: 0.023, t: 0.026, b: 0.026, sq: 4 },
    { z: 0.05, y: 0.009, w: 0.024, t: 0.027, b: 0.027, sq: 4 },
    { z: 0.1, y: 0.02, w: 0.024, t: 0.029, b: 0.029, sq: 4 },
    { z: 0.14, y: 0.034, w: 0.024, t: 0.031, b: 0.031, sq: 4 },
    { z: 0.168, y: 0.047, w: 0.024, t: 0.032, b: 0.032, sq: 4 },
  ];
  // 輪切りを曲がりに直角に傾ける: 深さ d で、前の点ほど上へ（底の板も前が上がる）
  const slope = (d) => 2.8 * d, mid = (d) => 0.004 + 0.06 * d + 1.2 * d * d;
  const warp = (v) => { v.z -= slope(v.z) * (v.y - mid(v.z)); };
  const out = [flesh.loft(r, rings, STEEL, { seg: 12, warp, rot: [ALONG, 0, 0] })];
  // 縦のリブ: 曲がりに沿った折れ線（左右に 2 本ずつ）
  for (const s of [1, -1]) for (const k of [-0.45, 0.35]) {
    const pts = rings.slice(1, 5).map((q) => [s * 0.0122, -(q.z - slope(q.z) * k * q.t), q.y + k * q.t]);
    out.push(R.strut(r, pts, pts.map(() => 0.0016), STEEL));
  }
  out.push(R.block(r, [0.014, 0.008, 0.006], STEEL, { at: [0, -0.004, 0.032] })); // 前の引っかけ
  out.push(R.bevel(r, [0.027, 0.006, 0.07], [STEEL[0], STEEL[0], STEEL[1]], { at: [0, -0.17, 0.047], rot: [-Math.atan(slope(0.168)), 0, 0] })); // 底の板
  return out;
}

// 引き金（動く。原点は PIVOT.trigger）: 下が後ろへ曲がった板
function triggerParts(r) {
  return [R.plate(r, [[0.004, 0.002], [0.006, -0.006], [0.004, -0.013], [-0.002, -0.019], [-0.005, -0.018], [-0.001, -0.012], [0.0, -0.006], [-0.003, 0.002]], 0.006, BRIGHT)];
}

// 動く部品を別にした形（fpGun.js などで動かせる）。userData: carrier・mag・trigger・muzzle・eject
export function akRig(seed = 47) {
  const r = rng(seed), root = new THREE.Group();
  root.add(makeMesh(merge(bodyParts(r))));
  const part = (geos, at) => {
    const m = makeMesh(merge(geos));
    m.position.set(...at);
    root.add(m);
    return m;
  };
  root.userData.carrier = part(carrierParts(r), PIVOT.carrier);
  root.userData.mag = part(magParts(r), PIVOT.mag);
  root.userData.trigger = part(triggerParts(r), PIVOT.trigger);
  for (const [k, at] of [['muzzle', AK_MUZZLE], ['eject', AK_EJECT]]) {
    root.userData[k] = new THREE.Object3D();
    root.userData[k].position.set(...at);
    root.add(root.userData[k]);
  }
  return root;
}
