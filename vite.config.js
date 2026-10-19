import { defineConfig } from 'vite';

// 版: GitHub Actions ではコミットの番号、手元のビルドでは時刻。dist/version.json にも書き、タイトルで新しい版があるか比べる（ui/update.js）
const version = process.env.GITHUB_SHA?.slice(0, 7) || Date.now().toString(36);

// 確認用サーバーは 5180 番に固定する。base は相対にして、GitHub Pages（/terusurvivalgame5/）でも読めるようにする
export default defineConfig(({ command }) => ({
  base: './',
  server: { port: 5180, strictPort: true },
  define: { __VERSION__: JSON.stringify(command === 'build' ? version : 'dev') },
  plugins: [{
    name: 'version-json',
    apply: 'build',
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ v: version }) }); },
  }],
}));
