// 装備の形（docs/rules/objects.md「装備」）。itemShapes.js の SHAPES に足して使う。体に着た見た目はなし（アイコンと落とし物だけ）
// 草・竹の物は straw・bamboo、ガラクタ・鉄の物は鉄の灰とさびのつぎはぎ、革は boots の色。地面に立てて置く（y ≥ 0、前は +z）
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { pick, shape, merge } from '../style/lowpoly.js';

const rust = (r) => () => pick(r, [P.ironMetal[1], P.ironMetal[2], P.ironMetal[1], P.robotRust[1]]); // 鉄の灰にさびがまだら
const leather = (r) => () => pick(r, [P.boots[1], P.boots[2]]);

// 上を細くし、左右の端を後ろへ反らせた板（胸当て）。w0: 下の幅、w1: 上の幅、bend: 端が下がる量
function plate(w0, w1, h, d, bend) {
  const g = new THREE.BoxGeometry(w0, h, d, 2, 1, 1), pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const k = pos.getY(i) > 0 ? w1 / w0 : 1, x = pos.getX(i) * k;
    pos.setXYZ(i, x, pos.getY(i), pos.getZ(i) - bend * (x / (w0 / 2)) ** 2);
  }
  return g;
}
// 胸当ての肩ひも: 上の端から後ろへ回る半円
const strap = (x, y, z) => new THREE.TorusGeometry(0.06, 0.012, 3, 6, Math.PI).rotateY(Math.PI / 2).translate(x, y, z - 0.06);
const screw = (x, y, z) => new THREE.CylinderGeometry(0.013, 0.013, 0.02, 6).rotateX(Math.PI / 2).translate(x, y, z);

// 革の靴: 箱の前の上を下げて、足首からつま先へ下がる形にする
function boot(x) {
  const g = new THREE.BoxGeometry(0.09, 0.16, 0.29, 1, 2, 2), pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0 && pos.getZ(i) > 0.1) pos.setY(i, -0.03);
  return g.translate(x, 0.105, 0);
}

export const WEAR_SHAPES = {
  // 竹のかさ: 低い円錐の笠、縁の輪、頂の結び目、あごひも
  bambooHat: (r) => {
    const cone = new THREE.ConeGeometry(0.26, 0.13, 10).translate(0, 0.165, 0);
    const rim = new THREE.TorusGeometry(0.255, 0.012, 3, 10).rotateX(Math.PI / 2).translate(0, 0.1, 0);
    const knot = new THREE.IcosahedronGeometry(0.025, 0).translate(0, 0.235, 0);
    const chin = new THREE.TorusGeometry(0.08, 0.006, 3, 8).translate(0, 0.085, 0);
    return merge([
      shape(cone, () => pick(r, [P.bamboo[2], P.bamboo[3]]), r, { jit: 0.008 }),
      shape(rim, P.bamboo[1], r),
      shape(knot, P.straw[0], r),
      shape(chin, P.straw[1], r),
    ]);
  },
  // 草の胸当て: 編み目の帯 3 段の台形の前板、肩ひも 2 本、胸の結び目
  grassVest: (r) => {
    const w = [0.34, 0.31, 0.28, 0.24], h = 0.13;
    const bands = [0, 1, 2].map((i) => shape(plate(w[i], w[i + 1], h, 0.04, 0.03).translate(0, h / 2 + i * h, 0), i % 2 ? P.straw[1] : P.straw[2], r, { jit: 0.006 }));
    return merge([
      ...bands,
      ...[-0.08, 0.08].map((x) => shape(strap(x, 0.39, 0), P.straw[0], r)),
      shape(new THREE.IcosahedronGeometry(0.022, 0).translate(0, 0.27, 0.03), P.straw[0], r),
    ]);
  },
  // 草のわらじ: 楕円の平たい底 2 枚（少しずらす）、それぞれに鼻緒
  strawSandals: (r) => merge([-0.07, 0.07].flatMap((x, i) => {
    const z = i ? 0.02 : -0.02;
    const sole = new THREE.CylinderGeometry(0.06, 0.06, 0.02, 8).scale(1, 1, 2.3).translate(x, 0.01, z);
    const thong = new THREE.TorusGeometry(0.04, 0.006, 3, 6, Math.PI).translate(x, 0.02, z + 0.04);
    return [shape(sole, () => pick(r, [P.straw[1], P.straw[2]]), r, { jit: 0.004 }), shape(thong, P.straw[0], r)];
  })),
  // ガラクタのヘルメット: なべの半球（まだら）、ひさし、頭頂の継ぎ当て、横のネジ、革のあごひも
  junkHelmet: (r) => {
    const y = 0.06;
    const dome = new THREE.SphereGeometry(0.15, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.85, 1).translate(0, y, 0);
    const visor = new THREE.BoxGeometry(0.22, 0.015, 0.08).rotateX(-0.15).translate(0, y + 0.01, 0.17);
    const patch = new THREE.BoxGeometry(0.09, 0.02, 0.09).rotateY(0.3).translate(0.02, y + 0.125, -0.01);
    const chin = new THREE.TorusGeometry(0.13, 0.008, 3, 8, Math.PI).rotateZ(Math.PI).scale(1, 0.4, 1).translate(0, y, 0);
    return merge([
      shape(dome, rust(r), r, { jit: 0.006 }),
      shape(visor, P.ironMetal[1], r),
      shape(patch, P.robotRust[0], r),
      ...[-1, 1].map((s) => shape(screw(0, 0, 0).rotateY(Math.PI / 2).translate(s * 0.15, y + 0.04, 0), P.ironMetal[3], r)),
      shape(chin, P.boots[1], r),
    ]);
  },
  // ガラクタの胸当て: 少し丸めた鉄の前板、さびた継ぎ当て、革の肩ひも 2 本、四隅のネジ
  junkPlate: (r) => {
    const front = 0.022;
    return merge([
      shape(plate(0.36, 0.3, 0.42, 0.04, 0.035).translate(0, 0.21, 0), () => pick(r, [P.ironMetal[1], P.ironMetal[2]]), r, { jit: 0.005 }), // 面が大きいので、さびは継ぎ当てだけ
      shape(new THREE.BoxGeometry(0.13, 0.11, 0.015).translate(-0.07, 0.31, front), P.robotRust[0], r),
      ...[-0.09, 0.09].map((x) => shape(strap(x, 0.42, 0), P.boots[1], r)),
      ...[[-0.14, 0.05], [0.14, 0.05], [-0.11, 0.38], [0.11, 0.38]].map(([x, y]) => shape(screw(x, y, front), P.ironMetal[3], r)),
    ]);
  },
  // 鉄底のブーツ: 革の靴 2 つ、それぞれに厚い鉄の底とつま先の鉄の当て
  ironBoots: (r) => merge([-0.065, 0.065].flatMap((x) => [
    shape(boot(x), leather(r), r, { jit: 0.004 }),
    shape(new THREE.BoxGeometry(0.1, 0.025, 0.3).translate(x, 0.0125, 0), P.ironMetal[1], r),
    shape(new THREE.BoxGeometry(0.1, 0.05, 0.05).translate(x, 0.045, 0.125), P.ironMetal[3], r),
  ])),
  // 貝のお守り: 細いひもの輪、扇形の貝、結び玉
  shellCharm: (r) => {
    const ring = new THREE.TorusGeometry(0.07, 0.005, 3, 8).translate(0, 0.15, 0);
    const shell = new THREE.ConeGeometry(0.045, 0.05, 6).scale(1, 1, 0.3).rotateZ(Math.PI).translate(0, 0.045, 0);
    const bead = new THREE.OctahedronGeometry(0.014).translate(0, 0.08, 0);
    return merge([shape(ring, P.straw[1], r), shape(shell, () => pick(r, [P.shell[1], P.shell[2]]), r), shape(bead, P.straw[0], r)]);
  },
  // 羽根の飾り: 白い羽根 3 枚を扇に開き、根元をひもで束ね、短いひもの輪
  featherCharm: (r) => {
    const vanes = [-0.4, 0, 0.4].map((a) => new THREE.IcosahedronGeometry(0.1, 0).scale(0.4, 1.5, 0.1).translate(0, 0.13, 0).rotateZ(a).translate(0, 0.06, 0));
    const bind = new THREE.CylinderGeometry(0.02, 0.02, 0.035, 6).translate(0, 0.06, 0);
    const loop = new THREE.TorusGeometry(0.03, 0.005, 3, 6).translate(0, 0.031, 0);
    return merge([
      ...vanes.map((g) => shape(g, () => pick(r, [P.catWhite[1], P.catWhite[2]]), r)),
      shape(bind, P.straw[0], r),
      shape(loop, P.straw[1], r),
    ]);
  },
  // 銅線の腕輪: 銅色の細い輪、留め具の板とネジ
  copperBangle: (r) => {
    const ring = new THREE.TorusGeometry(0.07, 0.01, 3, 8).rotateX(Math.PI / 2).translate(0, 0.012, 0);
    const clasp = new THREE.BoxGeometry(0.025, 0.025, 0.035).translate(0.07, 0.0125, 0);
    const pin = new THREE.CylinderGeometry(0.008, 0.008, 0.03, 5).translate(0.07, 0.03, 0);
    return merge([
      shape(ring, () => pick(r, [P.copperMetal[1], P.copperMetal[2]]), r),
      shape(clasp, P.copperMetal[0], r),
      shape(pin, P.ironMetal[3], r),
    ]);
  },
};
