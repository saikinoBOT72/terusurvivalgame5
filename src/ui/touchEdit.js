// タッチのボタンの配置の編集（docs/rules/ui.md「タッチ操作」）: 設定のタッチのタブから開く。全部のボタン（建築のも）を並べる
// ドラッグで動かす、タップで選んで大きさ・不透明度、全部の不透明度、はじめに戻す、完了（保存）。Esc は完了と同じ
// 板はボタンに重なるので、題の行をドラッグして動かせる。編集の間はメニューを隠す
import { el, winHead } from './uiKit.js';
import { TOUCH_BTNS, SIZE, OPACITY, loadLayout, saveLayout, defaultLayout, posFrom, posKey, btnHtml, applyBtn } from './touchLayout.js';

const slider = (key, name, [min, max], step) =>
  `<label class="field"><span>${name}</span><input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}"><b></b></label>`;

// onDone(): 保存して閉じたとき（遊びの画面に並びを当て直す）
export function openTouchEdit(onDone) {
  let L = loadLayout(), sel = 'attack', drag = null;
  const box = el(`<div class="touch-edit">${TOUCH_BTNS.map(btnHtml).join('')}
    <div class="panel win edit-panel">${winHead('ボタンの配置')}
      <div class="sub selName"></div>
      ${slider('s', '大きさ', SIZE, 0.05)}${slider('o', '不透明度', OPACITY, 0.05)}${slider('all', '全部の不透明度', OPACITY, 0.05)}
      <div class="row"><button type="button" class="btn-s danger reset">はじめに戻す</button><button type="button" class="btn-s done">完了</button></div>
    </div></div>`);
  const nodes = Object.fromEntries(TOUCH_BTNS.map((b) => [b.id, box.querySelector(`[data-id="${b.id}"]`)]));
  const inputs = Object.fromEntries([...box.querySelectorAll('input[data-k]')].map((i) => [i.dataset.k, i]));
  const pct = (v) => `${Math.round(v * 100)}%`;
  function render() {
    for (const b of TOUCH_BTNS) { applyBtn(nodes[b.id], b, L); nodes[b.id].classList.toggle('sel', b.id === sel); }
    const c = L.btn[sel];
    const b = TOUCH_BTNS.find((x) => x.id === sel);
    box.querySelector('.selName').textContent = `選んでいる: ${b.name}${b.build ? '（置くときだけ出る）' : ''}　ドラッグで動かす・タップで選ぶ`;
    inputs.s.value = c.s; inputs.s.nextElementSibling.textContent = `${c.s.toFixed(2)} 倍`;
    inputs.o.value = c.o; inputs.o.nextElementSibling.textContent = pct(c.o);
    inputs.all.value = L.all; inputs.all.nextElementSibling.textContent = pct(L.all);
  }
  render();

  const panel = box.querySelector('.edit-panel');
  document.documentElement.classList.add('touch-editing');
  box.addEventListener('pointerdown', (e) => {
    const head = e.target.closest('.win-head');
    if (head) { // 板を動かす
      const r = panel.getBoundingClientRect();
      try { head.setPointerCapture(e.pointerId); } catch { /* 指がもう離れている */ }
      drag = { id: e.pointerId, panel: true, dx: r.left - e.clientX, dy: r.top - e.clientY };
      return;
    }
    const n = e.target.closest('.tbtn');
    if (!n) return;
    e.preventDefault();
    try { n.setPointerCapture(e.pointerId); } catch { /* 指がもう離れている */ }
    sel = n.dataset.id;
    const r = n.getBoundingClientRect();
    drag = { id: e.pointerId, dx: r.left + r.width / 2 - e.clientX, dy: r.top + r.height / 2 - e.clientY };
    render();
  });
  box.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.panel) return Object.assign(panel.style, { left: `${e.clientX + drag.dx}px`, top: `${e.clientY + drag.dy}px`, transform: 'none' });
    L.btn[sel][posKey()] = posFrom(e.clientX + drag.dx, e.clientY + drag.dy);
    applyBtn(nodes[sel], TOUCH_BTNS.find((b) => b.id === sel), L);
  });
  const end = (e) => { if (drag?.id === e.pointerId) drag = null; };
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', end);
  box.addEventListener('input', (e) => {
    const k = e.target.dataset.k, v = Number(e.target.value);
    if (k === 'all') L.all = v; else if (k) L.btn[sel][k] = v;
    render();
  });
  function done() {
    saveLayout(L);
    box.remove();
    document.documentElement.classList.remove('touch-editing');
    removeEventListener('keydown', onKey, true);
    removeEventListener('resize', render);
    onDone?.();
  }
  function onKey(e) { if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); done(); } }
  addEventListener('keydown', onKey, true);
  addEventListener('resize', render);
  box.querySelector('.done').addEventListener('click', done);
  box.querySelector('.reset').addEventListener('click', () => { L = defaultLayout(); render(); });
}
