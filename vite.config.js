import { defineConfig } from 'vite';

// 確認用サーバーは 5180 番に固定する
export default defineConfig({
  server: { port: 5180, strictPort: true },
});
