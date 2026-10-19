// フレームレート表示（docs/rules/ui.md「設定の窓」）: 設定「画面」でオンにすると、右上の時計の下に「60 fps」。0.5 秒ごとに更新
import { el } from './uiKit.js';

// fps(): 今のフレームレート（perf.js）
export function createFpsMeter({ fps }) {
  const box = el('<div class="panel fps-meter" hidden></div>');
  let on = false, t = 0;
  return {
    setOn(v) { on = !!v; box.hidden = !on; t = 1; },
    update(dt) {
      if (!on || (t += dt) < 0.5) return;
      t = 0;
      box.textContent = `${fps()} fps`;
    },
  };
}
