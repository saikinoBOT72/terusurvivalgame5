// マップ作りの空と色（docs/rules/building.md「マップ作りの空と色」）: 値を持ち、空（world/sky.js）と画面の色（world/grade.js）に渡す
// マップ作りの世界だけ。ほかの世界では、この値は使われない（main.js が世界を替えるたびに上書きを外す）
import { P } from '../style/palette.js';

const HEX = /^#[0-9a-fA-F]{6}$/;
// 範囲 [最小, 最大]。窓のスライダーと、読み込みの確認に使う
export const RANGE = {
  hour: [0, 24], sunK: [0, 3], el: [5, 90], az: [0, 360], hemiK: [0, 3], fogK: [0, 4],
  sat: [0, 2], con: [0.6, 1.6], lift: [0, 2], vig: [0, 0.6], exp: [0.4, 2], bloom: [0, 1.5],
};
// 初めの値。null は「時刻まかせ」（今の昼夜の計算のまま）
export const DEFAULTS = {
  hour: 12, sunC: null, sunK: 1, az: null, el: 45, hemiC: null, groundC: null, hemiK: 1, sky: null, fogK: 1,
  tint: null, sat: 1, con: 1, lift: 0, vig: 0, exp: 1, bloom: 0.5,
  clouds: true, stars: 'night', // 雲を出す。星: 'night'（夜だけ）'on'（いつも）'off'（出さない）
};

const clamp = (k, v) => Math.min(RANGE[k][1], Math.max(RANGE[k][0], v));

export function createMapEnv(onChange) {
  const env = { ...DEFAULTS };
  const api = {
    env,
    set(patch) { Object.assign(env, patch); onChange(); },
    reset() { Object.assign(env, DEFAULTS); onChange(); },
    // 保存する値（初めの値と同じ物は入れない）
    data() { return Object.fromEntries(Object.entries(env).filter(([k, v]) => v !== DEFAULTS[k])); },
    // 保存・書き出しの値から入れる（知らない項目・範囲外・色でない値は捨てる）
    load(d) {
      Object.assign(env, DEFAULTS);
      for (const [k, v] of Object.entries(d ?? {})) {
        if (!(k in DEFAULTS)) continue;
        if (['sunC', 'hemiC', 'groundC', 'tint'].includes(k)) { if (HEX.test(v)) env[k] = v; } // 色
        else if (k === 'sky') { if (Number.isInteger(v) && P.mapEnv.sky[v]) env.sky = v; }
        else if (k === 'clouds') { if (typeof v === 'boolean') env.clouds = v; }
        else if (k === 'stars') { if (['night', 'on', 'off'].includes(v)) env.stars = v; }
        else if (k === 'az' && v === null) env.az = null;
        else if (Number.isFinite(v) && RANGE[k]) env[k] = clamp(k, v);
      }
      onChange();
    },
    // sky.setOverride に渡す値
    skyOverride() {
      return {
        sunC: env.sunC, sunK: env.sunK, hemiC: env.hemiC, groundC: env.groundC, hemiK: env.hemiK, fogK: env.fogK,
        clouds: env.clouds, stars: env.stars, az: env.az, el: env.el, sky: env.sky === null ? null : P.mapEnv.sky[env.sky].slice(1),
      };
    },
    // world.grade（grade.js の look）
    grade() { return { tint: env.tint, sat: env.sat, con: env.con, lift: env.lift, vig: env.vig, exposure: env.exp, bloom: env.bloom }; },
  };
  return api;
}
