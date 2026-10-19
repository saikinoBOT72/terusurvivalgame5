// 銃の持ち物の形（weapons.md「ガラクタ拳銃」、参考画像 docs/refs/weapons/junkPistol.jpg）
// 銃はほかの道具より細かく作る（style.md「銃（例外）」）。前（銃口）が +z、上が +y、見える側（左の面）が +x。原点は握りの上（手で握る所）
import { P } from '../style/palette.js';
import * as THREE from 'three';
import { merge, rng, makeMesh } from '../style/lowpoly.js';
import { robot as R } from '../mobs/parts.js';

const ALONG = Math.PI / 2; // 柱（軸 y）を前後（z）に向ける回転

// ガラクタ拳銃: ロボの装甲の板で作った本体に、曲がった鉄の銃身、6 発の回転弾倉、色ちがいの継ぎ当て、ひもを巻いた木の握り、はみ出た配線
// 動く部品（weapons.md「武器の動きと演出」）: 撃鉄（スライドの代わり）と回転弾倉（弾倉の代わり）。作る順番（乱数の順）は 1 つの形のときと同じ
function pistolParts(r) {
  const body = [
    // 銃身: 前の区間と、本体へ少し上がって入る区間（曲がった銃身）
    R.tube(r, 0.011, 0.075, P.ironMetal, { rot: [ALONG, 0, 0], at: [0, 0.036, 0.155], flat: true }),
    R.tube(r, 0.0115, 0.066, P.ironMetal, { rot: [ALONG + 0.11, 0, 0], at: [0, 0.0395, 0.087], flat: true }),
    R.tube(r, 0.019, 0.026, P.robotFrame, { rot: [ALONG, 0, 0], at: [0, 0.037, 0.204], flat: true }), // 銃口の太い輪
    R.tube(r, 0.0135, 0.01, P.robotRust, { rot: [ALONG, 0, 0], at: [0, 0.036, 0.14], seg: 6 }), // 補強の帯 ×2（間かくふぞろい）
    R.tube(r, 0.0135, 0.012, P.robotRust, { rot: [ALONG, 0, 0], at: [0, 0.036, 0.121], seg: 6 }),
    R.block(r, [0.006, 0.009, 0.01], P.robotFrame, { at: [0, 0.06, 0.207] }), // 前の照準
    R.block(r, [0.014, 0.006, 0.006], P.robotFrame, { at: [0, 0.057, -0.004] }), // 後ろの照準
    // 本体: ロボの装甲（青灰）を切った板
    R.plate(r, [[0.08, 0.053], [-0.002, 0.054], [-0.034, 0.041], [-0.051, 0.01], [-0.034, -0.003], [-0.01, -0.008], [0.048, -0.014], [0.068, -0.003], [0.08, 0.024]], 0.024, P.robotShell),
  ];
  // 回転弾倉: 本体の左右からはみ出す六角柱。前の面に穴 6 つと真ん中の軸
  const cyl = [
    R.tube(r, 0.023, 0.044, P.ironMetal, { rot: [ALONG, 0, 0], at: [0, 0.024, 0.024], seg: 6 }),
    R.block(r, [0.008, 0.008, 0.004], P.robotFrame, { at: [0, 0.024, 0.047] }),
    ...Array.from({ length: 6 }, (_, i) => {
      const a = i * Math.PI / 3 + Math.PI / 6;
      return R.block(r, [0.008, 0.008, 0.003], P.robotScreen, { at: [Math.cos(a) * 0.014, 0.024 + Math.sin(a) * 0.014, 0.0465], rot: [0, 0, a] });
    }),
  ];
  body.push(
    // 継ぎ当ての板 ×3（さび・黄色・銅）。少し傾けて貼り、角をネジで留める
    R.block(r, [0.003, 0.025, 0.027], P.robotRust, { at: [0.0135, 0.037, 0.064], rot: [0.12, 0, 0] }),
    R.block(r, [0.003, 0.02, 0.019], P.robotHazard, { at: [0.0135, 0.008, 0.057], rot: [-0.15, 0, 0] }),
    R.block(r, [0.003, 0.022, 0.026], P.copperMetal, { at: [0.0135, 0.009, -0.021], rot: [0.2, 0, 0] }),
    R.block(r, [0.0035, 0.004, 0.004], P.ironMetal, { at: [0.0155, 0.047, 0.074] }),
    R.block(r, [0.0035, 0.004, 0.004], P.ironMetal, { at: [0.0155, 0.026, 0.054] }),
    R.block(r, [0.0035, 0.004, 0.004], P.ironMetal, { at: [0.0155, 0.016, 0.064] }),
    R.block(r, [0.0035, 0.004, 0.004], P.ironMetal, { at: [0.0155, 0.017, -0.01] }),
  );
  // 撃鉄（後ろの上、とがった曲がり板）と引き金・囲い
  const hammer = [R.strut(r, [[0, 0.046, -0.012], [0, 0.064, -0.026], [0, 0.058, -0.04]], [0.004, 0.0035, 0], P.robotFrame)];
  body.push(
    R.strut(r, [[0, -0.008, 0.012], [0, -0.024, 0.009], [0, -0.034, -0.001]], [0.003, 0.0028, 0], P.robotFrame),
    R.duct(r, 0.022, 0.004, 0.007, P.robotShell, { rot: [0, 0, Math.PI / 2], at: [0, -0.026, 0.012] }),
    // 握り: 後ろへ傾いた古い木。ひもを 3 か所に巻く。上の端は本体に 8mm 差し込む（すき間が見えないように）
    R.bevel(r, [0.022, 0.096, 0.038], [P.wood[1], P.wood[2], P.wood[3]], { at: [0, -0.039, -0.045], rot: [0.27, 0, 0], taper: 1.1 }),
    ...[0.022, -0.006, -0.03].map((u) => R.block(r, [0.025, 0.006, 0.041], P.straw, { at: [0, -0.039 + u * Math.cos(0.27), -0.045 + u * Math.sin(0.27)], rot: [0.27, 0, 0] })),
    // はみ出た配線（赤・黄）: 銃身の下から垂れて本体へ
    R.strut(r, [[0.004, 0.027, 0.105], [0.006, 0.01, 0.088], [0.008, 0.006, 0.066]], [0.0015, 0.0015, 0.0015], P.robotEye),
    R.strut(r, [[-0.004, 0.027, 0.098], [0.002, 0.004, 0.084], [0.006, 0.0, 0.066]], [0.0015, 0.0015, 0.0015], P.robotHazard),
  );
  return { body, cyl, hammer };
}
export function junkPistol(r) {
  const { body, cyl, hammer } = pistolParts(r);
  return merge([...body, ...cyl, ...hammer]);
}
// 手に持つ銃: 本体・撃鉄・回転弾倉を別の部品にして動かせるようにする（avatar/fpGun.js）。見た目は持ち物の形と同じ
const PIVOT = { hammer: [0, 0.046, -0.012], cyl: [0, 0.024, 0.024] }; // 撃鉄の付け根、弾倉の軸の真ん中
export const PISTOL_MUZZLE = [0, 0.036, 0.218]; // 銃口の先
export function gunRig(id) {
  const { body, cyl, hammer } = pistolParts(rng(id.length * 31 + id.charCodeAt(0))); // itemShapes.js の itemGeometry と同じ種
  const root = new THREE.Group();
  root.add(makeMesh(merge(body), { shadow: false }));
  const part = (geos, at) => {
    const m = makeMesh(merge(geos).translate(-at[0], -at[1], -at[2]), { shadow: false });
    m.position.set(...at);
    root.add(m);
    return m;
  };
  root.userData.hammer = part(hammer, PIVOT.hammer);
  root.userData.cyl = part(cyl, PIVOT.cyl);
  root.userData.cyl.userData.home = root.userData.cyl.position.clone();
  root.userData.muzzle = new THREE.Object3D();
  root.userData.muzzle.position.set(...PISTOL_MUZZLE);
  root.add(root.userData.muzzle);
  return root;
}
// 握る所（手の中心にくる点）と、照準のてっぺんの高さ（覗き込んだとき画面の真ん中に来る）
export const PISTOL_HOLD = { grip: [0, -0.073, -0.054], sight: 0.065 }; // 手（丸いこぶし）は握りの下のほうを持つ。本体が手に埋まらないように

// ガラクタ弾: 銅の薬きょう 5 本（丸く並べる）を、さびた鉄のバンドで束ねた形。先は鉄のとがり（長さ・高さが少しふぞろい）
export function junkAmmo(r) {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2 + 0.3, x = Math.sin(a) * 0.0235, z = Math.cos(a) * 0.0235, h = 0.04 + (r() - 0.5) * 0.006;
    parts.push(R.tube(r, 0.011, h, P.copperMetal, { at: [x, h / 2, z], seg: 5 }));
    parts.push(R.tube(r, 0, 0.02, P.ironMetal, { at: [x, h + 0.01, z], seg: 5 }, 0.011));
  }
  parts.push(R.tube(r, 0.0375, 0.011, P.robotRust, { at: [0, 0.017, 0], seg: 6 })); // 束ねるバンド
  return merge(parts);
}

export const GUN_SHAPES = { junkPistol, junkAmmo };
