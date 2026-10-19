// アップデート（docs/rules/ui.md「アップデート」）: 公開している版（version.json）が今の版と違えば、タイトルに「アップデート」を出す
/* global __VERSION__ */
export const VERSION = typeof __VERSION__ === 'string' ? __VERSION__ : 'dev';

// 新しい版の名前。なければ null（開発中・オフラインも null）
export async function newerVersion() {
  if (VERSION === 'dev') return null;
  try {
    const r = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    const { v } = await r.json();
    return v && v !== VERSION ? v : null;
  } catch { return null; }
}
// 読み直す。URL を変えて、古い index.html がブラウザに残っていても新しいのを取る
export function applyUpdate(v) {
  location.replace(`${location.pathname}?v=${encodeURIComponent(v)}`);
}
