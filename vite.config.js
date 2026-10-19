import { defineConfig } from 'vite';

// 確認用サーバーは 5180 番に固定する。base は相対にして、GitHub Pages（/terusurvivalgame5/）でも読めるようにする
export default defineConfig({
  base: './',
  server: { port: 5180, strictPort: true },
});
