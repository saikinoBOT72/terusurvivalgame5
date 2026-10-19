// 建築メニュー（docs/rules/building.md「ハンマーの操作と建築の素材」、ui.md「建築の操作」）
// ハンマーを持って右クリックで開く。上のタブで種類を分ける。パーツか「撤去」を選ぶと閉じる
import * as THREE from 'three';
import { PARTS, PART_LIST, COSTS, partGeometry } from '../build/parts.js';
import { ITEMS } from '../survival/items.js';
import { MAT } from '../style/lowpoly.js';
import { iconUrl } from './icons.js';

function el(html, parent = document.body) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return parent.appendChild(t.content.firstChild);
}

// パーツのアイコン（ドアは枠と扉を合わせて描く）
export function partIcon(type) {
  return iconUrl('part:' + type, () => {
    const def = PARTS[type], g = new THREE.Group();
    g.add(new THREE.Mesh(partGeometry(type, def.frame ? 'frame' : 'build'), MAT.solid));
    if (def.panel) { const p = new THREE.Mesh(partGeometry(type, 'panel'), MAT.solid); p.position.x = def.hinge; g.add(p); }
    g.userData.upright = true;
    return g;
  });
}

// 必要な素材の表示「竹 50/3」（持っている数/要る数）。足りない物は赤くする
export function costHtml(type, inventory) {
  return Object.entries(COSTS[type]).map(([id, n]) => {
    const have = inventory.count(id);
    return `<span class="${have < n ? 'lack' : ''}">${ITEMS[id].name} ${have}/${n}</span>`;
  }).join('');
}
// 素材の一覧の表示「木材 2 ・ 竹 1」
export const itemsHtml = (m) => Object.entries(m).filter(([, n]) => n > 0).map(([id, n]) => `<span>${ITEMS[id].name} ${n}</span>`).join('') || '<span>なし</span>';

// メニューのタブ（種類）。ここにないパーツは家具に入れる
const CATS = [
  ['floor', '床', ['foundation', 'triangle', 'upperFloor', 'stoneFoundation', 'brickFoundation', 'stairs', 'steepStairs']],
  ['wall', '壁', ['wall', 'halfWall', 'pillar', 'door', 'window', 'stoneWall', 'brickWall']],
  ['roof', '屋根', ['roof', 'steepRoof']],
  ['furniture', '家具', []],
  ['water', '水', ['raftCore', 'raft', 'sail', 'helm', 'boat']],
];
const catOf = (t) => (CATS.find(([, , list]) => list.includes(t)) ?? CATS[3])[0];
export const canPay = (type, inventory) => Object.entries(COSTS[type]).every(([id, n]) => inventory.count(id) >= n);

// onPick(PART_LIST の番号): パーツを選んだ。onPick(-1): 撤去を選んだ
// known(bp): その設計図を読んだか（読んでいないパーツは出さない）
export function createBuildMenu({ inventory, onPick, known = () => true }) {
  const box = el(`
    <div class="panel build-menu" hidden>
      <div class="tabs">${CATS.map(([k, name]) => `<button type="button" class="tab" data-cat="${k}">${name}</button>`).join('')}
        <button type="button" class="tab remove">撤去</button></div>
      <div class="cards">${PART_LIST.map((t, i) => `
        <button type="button" class="card" data-i="${i}" data-cat="${catOf(t)}">
          <img src="${partIcon(t)}" alt="">
          <div class="name">${PARTS[t].name}</div>
          <div class="need"></div>
        </button>`).join('')}</div>
    </div>`);
  let cat = 'floor';
  function render() {
    box.querySelectorAll('.tab[data-cat]').forEach((b) => b.classList.toggle('on', b.dataset.cat === cat));
    box.querySelectorAll('.card').forEach((c) => {
      const t = PART_LIST[Number(c.dataset.i)];
      c.hidden = c.dataset.cat !== cat || !known(PARTS[t].bp);
      c.querySelector('.need').innerHTML = costHtml(t, inventory);
      c.classList.toggle('short', !canPay(t, inventory)); // 素材が足りない物は暗く
    });
  }
  box.addEventListener('click', (e) => {
    const tb = e.target.closest('.tab');
    if (tb) { if (tb.classList.contains('remove')) onPick(-1); else { cat = tb.dataset.cat; render(); } return; }
    const c = e.target.closest('.card');
    if (c) onPick(Number(c.dataset.i));
  });
  inventory.onChange(() => { if (!box.hidden) render(); });
  return {
    box,
    get open() { return !box.hidden; },
    setOpen(v) { box.hidden = !v; if (v) render(); },
  };
}
