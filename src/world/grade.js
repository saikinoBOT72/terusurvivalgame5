// 画面の色（docs/rules/style.md「画面の効果」）: 時刻・場所・のぞき込み・洞窟で、まとめのシェーダーの値を決める（game/postfx.js）
// 昼はそのまま（パレットの色を変えない）。朝方・夕方は暖かく、夜は青く色を抜き、沼は緑がかった灰色
import * as THREE from 'three';
import { P } from '../style/palette.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// 色味はシェーダーの中で sRGB のまま掛けるので、16 進の値をそのまま 0〜1 にする（色の変換をしない）
const srgb = (hex) => { const n = parseInt(hex.slice(1), 16); return new THREE.Color().setRGB((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, THREE.LinearSRGBColorSpace); };
const G = P.grade;
// tint: 色味、sat: 彩度、con: コントラスト、lift: 暗い所に足す色
const LOOK = {
  day: { tint: srgb(G.day), sat: 1, con: 1, lift: 0 },
  morning: { tint: srgb(G.morning), sat: 1.04, con: 1.02, lift: 0 },
  dusk: { tint: srgb(G.dusk), sat: 1.08, con: 1.04, lift: 0 },
  night: { tint: srgb(G.night), sat: 0.78, con: 1.05, lift: 1 },
  swamp: { tint: srgb(G.swamp), sat: 0.72, con: 0.95, lift: 0 },
};
const LIFT = srgb(G.nightLift);
const VIG = { base: 0.15, ads: 0.25, cave: 0.3 }; // 周辺減光: いつも薄く、のぞき込みと洞窟で強める
const CA_SEC = 0.2, CA_MAX = 0.012; // 色ずれ（PvP だけ）: 0.2 秒で消える

export function createGrade(post) {
  const U = post.U, tint = new THREE.Color();
  let sat = 1, con = 1, lift = 1, ca = 0;
  // 今の値を w の割合で b に近づける
  function mixLook(b, w) {
    if (w <= 0) return;
    tint.lerp(b.tint, w); sat += (b.sat - sat) * w; con += (b.con - con) * w;
    lift += (b.lift - lift) * w;
  }
  return {
    // 爆発・大きな被弾（world.pvp のときだけ呼ぶ）。k: 0〜1 の強さ
    kick(k = 1) { ca = Math.max(ca, Math.min(1, k)); },
    // hour: 時刻、swamp: 沼の霧の濃さ 0〜1、cave: 洞窟の暗さ 0〜1、ads: のぞき込み 0〜1、look: 世界ごとの上書き（world.grade）
    update(dt, { hour = 12, swamp = 0, cave = 0, ads = 0, look = null } = {}) {
      const day = smooth(5, 7, hour) * (1 - smooth(19, 21, hour)); // sky.js と同じ重み
      const dusk = Math.max(0, 1 - Math.min(Math.abs(hour - 6), Math.abs(hour - 20)) / 1.2);
      tint.copy(LOOK.night.tint); sat = LOOK.night.sat; con = LOOK.night.con; lift = 1;
      mixLook(LOOK.day, day);
      mixLook(hour < 12 ? LOOK.morning : LOOK.dusk, dusk * 0.8);
      mixLook(LOOK.swamp, swamp);
      if (look) mixLook({ tint: srgb(look.tint ?? G.day), sat: look.sat ?? 1, con: look.con ?? 1, lift: look.lift ?? 0 }, 1);
      U.uTint.value.copy(tint); U.uLift.value.copy(LIFT).multiplyScalar(lift); U.uSat.value = sat; U.uContrast.value = con;
      U.uVig.value = VIG.base + VIG.ads * ads + VIG.cave * cave;
      ca = Math.max(0, ca - dt / CA_SEC);
      U.uCA.value = ca * ca * CA_MAX;
    },
  };
}
