// マップ作りのコンクリート（docs/rules/building.md「コンクリートとマップ作り」段階 1）
// のっぺりした平らな形（style.md「のっぺりの例外」）。頂点色は白で、色は材質（見本の番号 c）で付ける
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { shape, merge, glowMat } from '../style/lowpoly.js';

export const COLORS = P.concrete.length; // 見本の数（c は 0〜11）
export const DEFAULT_COLOR = 1;          // 明るい灰

const flat = (g) => shape(g, P.concreteBase, () => 0.5, { vary: 0 });
export const cbox = (w, h, d, x, y, z) => flat(new THREE.BoxGeometry(w, h, d).translate(x, y, z));

// 坂: 幅 w、長さ len、上り rise。-z の向きに上る。下端の中心が原点
export function wedge(w, len, rise) {
  const s = new THREE.Shape([new THREE.Vector2(len / 2, 0), new THREE.Vector2(-len / 2, 0), new THREE.Vector2(-len / 2, rise)]);
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  g.rotateY(-Math.PI / 2); // 形の x → 世界の z、押し出し → -x
  g.translate(w / 2, 0, 0);
  return flat(g);
}

// 材質: 見本ごとに 1 つ作って使い回す。concrete は光を受ける、glow は受けない（光って見える）
const mats = {};
export function paintMat(kind, c) {
  const k = kind + c;
  if (!mats[k]) {
    mats[k] = kind === 'glow'
      ? glowMat({ vertexColors: true, color: P.glow[c] })
      : new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, color: P.concrete[c] });
  }
  return mats[k];
}

// 土台の足（0.2m 角のコンクリート、高さ 1 を伸ばして使う）
let legGeo = null;
export const concreteLegGeo = () => legGeo ?? (legGeo = cbox(0.2, 1, 0.2, 0, 0.5, 0));

const railingGeo = () => merge([cbox(0.1, 0.9, 0.1, -0.45, 0.45, 0), cbox(0.1, 0.9, 0.1, 0.45, 0.45, 0), cbox(1, 0.1, 0.1, 0, 0.95, 0)]);

// base: 今の仕組みのパーツ（木）。同じ置き方・支え・当たり判定のまま、形だけコンクリートにする
// map: マップ作りのタブ / paint: 色を塗れる（'concrete' か 'glow'）
export function concreteParts(base, wallBand) {
  const c = { map: 'concrete', paint: 'concrete', bp: undefined };
  return {
    cFoundation: { ...base.foundation, ...c, name: 'コンクリートの土台', build: () => cbox(1, 0.25, 1, 0, -0.125, 0) },
    cFloor: { ...base.upperFloor, ...c, name: 'コンクリートの床', build: () => cbox(1, 0.25, 1, 0, -0.125, 0) },
    cWall: { ...base.wall, ...c, name: 'コンクリートの壁', build: () => cbox(1, 2, 0.15, 0, 1, 0) },
    cLowWall: { ...base.wall, ...c, name: '腰壁', shape: wallBand(-0.5, 0.5, 0, 1), build: () => cbox(1, 1, 0.15, 0, 0.5, 0) },
    cPillar: { ...base.pillar, ...c, name: 'コンクリートの柱', build: () => cbox(0.5, 2, 0.5, 0, 1, 0) },
    cRamp: { ...base.stairs, ...c, name: 'ゆるいスロープ', build: () => wedge(1, 1, 0.5) },
    cSteepRamp: { ...base.steepStairs, ...c, name: '急なスロープ', build: () => wedge(1, 1, 1) },
    cRailing: { ...base.wall, ...c, name: '手すり', shape: wallBand(-0.5, 0.5, 0, 1), build: railingGeo },
  };
}
