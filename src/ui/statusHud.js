// 状態の表示（docs/rules/ui.md「画面の整理」）: 左上に HP・「おなか」・水分のゲージ、右上に時計、ダメージで画面のふちが赤くなる
import { MAX_HP, MAX_FOOD, MAX_WATER, MAX_BREATH } from '../survival/stats.js';
import { iconUrl } from './icons.js';
import { UI_SHAPES } from './uiShapes.js';

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return document.body.appendChild(t.content.firstChild);
}
// icon: uiShapes.js の形（ローポリのアイコン）
const gauge = (cls, icon) => `<div class="gauge ${cls}"><img src="${iconUrl('ui:' + icon, UI_SHAPES[icon])}" alt=""><div class="track"><i></i></div></div>`;

export function createStatusHud() {
  const box = el(`<div class="status-hud" hidden>${gauge('hp', 'heart')}${gauge('food', 'fish')}${gauge('water', 'drop')}${gauge('stamina', 'bolt')}${gauge('breath', 'bubbles')}</div>`);
  const sea = el('<div class="underwater"></div>'); // 目が水の中のとき、画面を水の色に薄く染める
  const clock = el('<div class="panel clock" hidden><span class="time"></span><span class="phase"></span></div>');
  const flash = el('<div class="hurt"></div>');
  const dark = el('<div class="sleep-fade"></div>'); // 眠るときの暗転
  const set = (cls, v, max) => {
    const g = box.querySelector(`.${cls}`);
    g.querySelector('i').style.width = `${(v / max) * 100}%`;
    g.classList.toggle('low', v / max <= 0.25);
  };
  let last = '';
  return {
    set hidden(v) { box.hidden = clock.hidden = v; },
    // stats: { hp, food }、time: dayNight
    update(stats, time) {
      const key = `${stats.hp}|${stats.food}|${stats.water}|${stats.breath.toFixed(1)}|${time.label}`;
      if (key === last) return;
      last = key;
      box.querySelector('.breath').hidden = stats.breath >= MAX_BREATH; // 息は減っている間だけ
      set('breath', stats.breath, MAX_BREATH);
      set('hp', stats.hp, MAX_HP);
      set('food', stats.food, MAX_FOOD);
      set('water', stats.water, MAX_WATER);
      clock.querySelector('.time').textContent = time.label;
      clock.querySelector('.phase').textContent = time.phase;
    },
    // スタミナ（weapons.md）。満タンの間は薄く
    stamina(v, max) {
      set('stamina', v, max);
      box.querySelector('.stamina').classList.toggle('full', v >= max);
    },
    fade(on) { dark.classList.toggle('on', on); },
    setUnderwater(on) { sea.classList.toggle('on', on); },
    hurt() {
      flash.classList.remove('on');
      void flash.offsetWidth; // アニメーションをやり直す
      flash.classList.add('on');
    },
  };
}

// 倒れた画面: 「起きる」で起きる
export function createDeathScreen({ onWake }) {
  const box = el(`
    <div class="death-back" hidden>
      <div class="panel win death">
        <div class="win-h1">倒れた…</div>
        <div class="sub"></div>
        <button type="button" class="btn-l">起きる</button>
      </div>
    </div>`);
  box.querySelector('button').addEventListener('click', onWake);
  return {
    set hidden(v) { box.hidden = v; },
    // dropped: 持ち物を袋で落としたか
    setDropped(dropped) {
      box.querySelector('.sub').textContent = dropped
        ? '手に持つ列のほかの持ち物は、ここに袋で落とした。袋は右クリックで拾える'
        : '手に持つ列のほかに、落とした物はない';
    },
  };
}
