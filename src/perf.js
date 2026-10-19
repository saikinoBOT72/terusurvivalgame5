// 重さを測る（開発用。__game.debug() に出す）: 仕組みごとの 1 フレームの時間（ミリ秒、直近の平均）
// frame() の中で perf.start() → 仕組みが終わるごとに perf.lap('名前')
const avg = {};
let t0 = 0, frameMs = 0, lastStart = 0;
const now = () => performance.now();
const ema = (a, v) => (a == null ? v : a * 0.95 + v * 0.05);

export const perf = {
  start() {
    const n = now();
    if (lastStart) frameMs = ema(frameMs || null, n - lastStart);
    lastStart = t0 = n;
  },
  lap(name) {
    const n = now();
    avg[name] = ema(avg[name], n - t0);
    t0 = n;
  },
  fps: () => (frameMs ? Math.round(1000 / frameMs) : 0), // 今のフレームレート（画面表示用）
  // 文字にする: 重い順
  report(info) {
    const parts = Object.entries(avg).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(' / ');
    const r = info?.render;
    return `重さ fps ${frameMs ? Math.round(1000 / frameMs) : '-'}（1 フレーム ${frameMs.toFixed(1)}ms）  ${parts}${r ? `  描画 ${r.calls} 回・三角形 ${r.triangles}` : ''}`;
  },
  reset() { for (const k in avg) delete avg[k]; frameMs = 0; },
};
