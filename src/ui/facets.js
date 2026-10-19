// 石の板の面の模様（docs/rules/ui.md「石の板の見た目」）。三角形に割った面を少しずつ違う明るさで塗った、つなぎ目のない SVG 画像
import * as THREE from 'three';
import { rng } from '../style/lowpoly.js';

// base: 元の色、size: 1 枚の大きさ（px）、n: 1 辺の分け方、vary: 明るさの揺らぎ
export function facetsUrl(base, { size = 240, n = 4, vary = 0.035, seed = 3 } = {}) {
  const r = rng(seed), step = size / n, c = new THREE.Color();
  // 格子の点を内側だけずらす（ふちの点はそのまま。並べたときにつながる）
  const pt = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const inner = i > 0 && i < n && j > 0 && j < n;
    pt.push([i * step + (inner ? (r() - 0.5) * step * 0.6 : 0), j * step + (inner ? (r() - 0.5) * step * 0.6 : 0)]);
  }
  const P = (i, j) => pt[j * (n + 1) + i].map((v) => v.toFixed(1)).join(',');
  let tris = '';
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const quad = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)];
    const halves = r() < 0.5 ? [[0, 1, 2], [0, 2, 3]] : [[0, 1, 3], [1, 2, 3]];
    for (const h of halves) {
      c.set(base).offsetHSL(0, 0, (r() - 0.5) * 2 * vary);
      tris += `<polygon points="${h.map((k) => quad[k]).join(' ')}" fill="#${c.getHexString()}" stroke="#${c.getHexString()}" stroke-width="0.6"/>`;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${tris}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
