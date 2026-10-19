// HP・空腹度・水分（docs/rules/survival.md「HP・空腹・昼夜」「序盤の素材と水分」）。state は見た目と分ける（あとで通信で同期しやすく）
import { ITEMS } from './items.js';

export const MAX_HP = 100, MAX_FOOD = 100, MAX_WATER = 100;
export const MAX_BREATH = 20; // 息（秒）。survival.md「息」
const BREATH_BACK = MAX_BREATH / 5, DROWN = 5; // 水の上に出ると 5 秒で戻る、息がないと 1 秒ごとに HP −5
const FOOD_EVERY = 10; // 空腹度が 1 減る秒数
const WATER_EVERY = 8; // 水分が 1 減る秒数
const STARVE_EVERY = 2; // 空腹度か水分が 0 で HP が 1 減る秒数（両方 0 なら 2 減る）
const HEAL_FOOD = 80, HEAL_WATER = 50; // 両方これ以上なら HP が回復する
const HEAL_EVERY = 3, HEAL_FIRE = 1; // 回復の秒数（たき火から 3m 以内は速い）
const SAFE_FALL = 4, FALL_DMG = 10; // 4m を超えた 1m ごとに HP −10
const WAKE_FOOD = 60, WAKE_WATER = 60; // 倒れて起きたとき
const SLEEP_HP = 50; // 眠ったときの HP の回復

// onDamage(n): ダメージを受けたとき。onDeath(): HP が 0 になったとき
export function createStats({ onDamage = () => {}, onDeath = () => {} } = {}) {
  const state = { hp: MAX_HP, food: MAX_FOOD, water: MAX_WATER, breath: MAX_BREATH, dead: false };
  let foodT = 0, waterT = 0, hurtT = 0, healT = 0, drownT = 0;
  const set = (v) => { Object.assign(state, { breath: MAX_BREATH }, v); foodT = waterT = hurtT = healT = drownT = 0; };

  function damage(n) {
    if (state.dead || n <= 0) return;
    state.hp = Math.max(0, state.hp - n);
    onDamage(n);
    if (!state.hp) { state.dead = true; onDeath(); }
  }

  return {
    state,
    reset() { set({ hp: MAX_HP, food: MAX_FOOD, water: MAX_WATER, dead: false }); },
    wake() { set({ hp: MAX_HP, food: WAKE_FOOD, water: WAKE_WATER, dead: false }); },
    damage,
    // 眠る: sec 秒ぶん時間が進む。空腹度と水分は普段の半分だけ減る（0 にはならない）。HP +50
    sleep(sec) {
      state.food = Math.max(1, state.food - Math.floor(sec / FOOD_EVERY / 2));
      state.water = Math.max(1, state.water - Math.floor(sec / WATER_EVERY / 2));
      state.hp = Math.min(MAX_HP, state.hp + SLEEP_HP);
    },
    // 落ちた高さ（m）
    fell(h) { if (h > SAFE_FALL) damage(Math.round((h - SAFE_FALL) * FALL_DMG)); },
    // 食べる・飲む: 空腹度か水分のどちらかが増やせるときだけ（持ち物から減らすのは呼ぶ側）
    canEat(id) {
      const it = ITEMS[id];
      return !!it && !state.dead && ((it.food > 0 && state.food < MAX_FOOD) || (it.water > 0 && state.water < MAX_WATER) || (it.heal > 0 && state.hp < MAX_HP));
    },
    eat(id) {
      const it = ITEMS[id];
      state.food = Math.min(MAX_FOOD, state.food + (it.food ?? 0));
      state.water = Math.min(MAX_WATER, state.water + (it.water ?? 0));
      state.hp = Math.min(MAX_HP, state.hp + (it.heal ?? 0)); // 救急セット
    },
    // nearFire: たき火から 3m 以内、underwater: 目が水の中
    update(dt, { nearFire = false, underwater = false } = {}) {
      if (state.dead) return;
      if (underwater) { // 息
        state.breath = Math.max(0, state.breath - dt);
        if (!state.breath && (drownT += dt) >= 1) { drownT -= 1; damage(DROWN); }
      } else { state.breath = Math.min(MAX_BREATH, state.breath + BREATH_BACK * dt); drownT = 0; }
      foodT += dt;
      while (foodT >= FOOD_EVERY) { foodT -= FOOD_EVERY; state.food = Math.max(0, state.food - 1); }
      waterT += dt;
      while (waterT >= WATER_EVERY) { waterT -= WATER_EVERY; state.water = Math.max(0, state.water - 1); }
      const lack = (state.food === 0) + (state.water === 0);
      if (lack) {
        hurtT += dt;
        if (hurtT >= STARVE_EVERY) { hurtT -= STARVE_EVERY; damage(lack); }
        return;
      }
      hurtT = 0;
      if (state.food < HEAL_FOOD || state.water < HEAL_WATER || state.hp >= MAX_HP) { healT = 0; return; }
      healT += dt;
      const every = nearFire ? HEAL_FIRE : HEAL_EVERY;
      if (healT >= every) { healT -= every; state.hp++; }
    },
  };
}
