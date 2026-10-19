// ロード画面（docs/rules/ui.md「ロード画面」）: 島を作っている間、画面いっぱいに出す
// 夜の海の色の背景に、島の名前と一言、石の板の進み具合のバー、いまの作業、ヒントを 1 つ
const TIPS = [
  '木箱は右クリックで開けられる',
  '木を切ると苗木が出る。植えないと、島の木は戻らない',
  '急な坂は登れない。回り道を探すか、階段を建てよう',
  '夜はロボットが動き出す。たき火のそばは回復が速い',
  '海の水は浄水器で真水にしてから飲む',
];

export function createLoading() {
  const root = document.createElement('div');
  root.className = 'loading';
  root.hidden = true;
  root.innerHTML = `
    <div class="loading-box">
      <div class="loading-name outlined"></div>
      <div class="loading-sub"></div>
      <div class="loading-bar panel"><div class="loading-fill"></div></div>
      <div class="loading-step"></div>
    </div>
    <div class="loading-tip"></div>`;
  document.body.appendChild(root);
  const $ = (c) => root.querySelector(c);
  return {
    show(name, sub = '危険海域の内側') {
      $('.loading-name').textContent = name;
      $('.loading-sub').textContent = sub;
      $('.loading-tip').textContent = `ヒント: ${TIPS[Math.floor(Math.random() * TIPS.length)]}`;
      this.set(0, '');
      root.hidden = false;
    },
    set(p, label) {
      $('.loading-fill').style.width = `${Math.round(p * 100)}%`;
      $('.loading-step').textContent = label;
    },
    hide() { root.hidden = true; },
  };
}
