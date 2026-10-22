// 建築メニュー（docs/rules/building.md「ハンマーの操作と建築の素材」、ui.md「建築の操作」）
// ハンマーを持って右クリックで開く。上のタブで種類を分ける。パーツか「撤去」を選ぶと閉じる
import * as THREE from 'three';
import { PARTS, PART_LIST, COSTS, partGeometry } from '../build/parts.js';
import { ITEMS } from '../survival/items.js';
import { MAT } from '../style/lowpoly.js';
import { iconUrl } from './icons.js';
import { el, winHead } from './uiKit.js';
import { P } from '../style/palette.js';
import { PAINT } from '../build/buildMode.js';

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
  return (PARTS[type].bp ? '<span class="bp">設計図 ✓</span>' : '') + Object.entries(COSTS[type]).map(([id, n]) => {
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
  ['machine', '機械', ['generator', 'windmill', 'pole', 'drill', 'autoFurnace', 'autoBench', 'belt']],
  ['water', '水', ['raftCore', 'raft', 'sail', 'helm', 'boat']],
  // マップ作りだけのタブ（building.md「コンクリートとマップ作り」）
  ['concrete', 'コンクリート', ['cFoundation', 'cFloor', 'cWall', 'cLowWall', 'cPillar', 'cRamp', 'cSteepRamp', 'cRailing'], true],
  ['block', 'ブロック', ['block1', 'block2', 'block4', 'slab2', 'slab4', 'column4', 'tower8', 'panel4', 'ramp2', 'ramp4'], true],
  ['glow', '光・仕掛け', ['glowLine1', 'glowLine2', 'glowPanel', 'jumpPad', 'launchPad'], true],
];
const catOf = (t) => (CATS.find(([, , list]) => list.includes(t)) ?? CATS[3])[0];
export const canPay = (type, inventory) => Object.entries(COSTS[type]).every(([id, n]) => inventory.count(id) >= n);

// onPick(PART_LIST の番号): パーツを選んだ。onPick(-1): 撤去を選んだ。onPick(PAINT): 塗るを選んだ
// known(bp): その設計図を持っているか（持っていないパーツは出さない）
// mapMode(): マップ作りの世界か（マップ用のタブ・色見本・書き出し・読み込みを出す。ui.md「マップ作りの建築メニュー」）
// color(): 今の色、onColor(c): 色見本を押した、onExport() / onImport(file): 書き出す・読み込む、onSettings(): マップの設定の窓を開く
export function createBuildMenu({ inventory, onPick, known = () => true, mapMode = () => false, color = () => 0, onColor = () => {}, onExport = () => {}, onImport = () => {}, onSettings = () => {} }) {
  const box = el(`
    <div class="panel win build-menu" hidden>
      ${winHead('建築')}
      <div class="tabs">${CATS.map(([k, name, , map]) => `<button type="button" class="tab" data-cat="${k}"${map ? ' data-map' : ''}>${name}</button>`).join('')}
        <span class="ends"><button type="button" class="tab paint" data-map>塗る</button><button type="button" class="tab remove danger">撤去</button></span></div>
      <div class="cards">${PART_LIST.map((t, i) => `
        <button type="button" class="card" data-i="${i}" data-cat="${catOf(t)}">
          <img src="${partIcon(t)}" alt="">
          <div class="name">${PARTS[t].name}</div>
          <div class="need"></div>
        </button>`).join('')}</div>
      <div class="map-row" data-map>
        <div class="swatches">${P.concrete.map((c, i) => `<button type="button" class="sw" data-c="${i}" style="--sw: ${c}; --glow: ${P.glow[i]}"></button>`).join('')}</div>
        <button type="button" class="btn-s" data-io="settings">マップの設定</button><button type="button" class="btn-s" data-io="export">書き出す</button><button type="button" class="btn-s" data-io="import">読み込む</button>
        <input type="file" accept=".json,application/json" hidden>
      </div>
    </div>`);
  let cat = 'floor';
  const file = box.querySelector('input[type=file]');
  function render() {
    const map = mapMode();
    if (!!CATS.find(([k]) => k === cat)[3] !== map) cat = map ? 'concrete' : 'floor'; // 世界に合わないタブなら最初のタブへ
    box.querySelectorAll('[data-map]').forEach((b) => { b.hidden = !map; });
    box.querySelectorAll('.tab[data-cat]').forEach((b) => { b.classList.toggle('on', b.dataset.cat === cat); b.hidden = 'map' in b.dataset !== map; });
    box.querySelectorAll('.sw').forEach((b) => b.classList.toggle('on', Number(b.dataset.c) === color()));
    box.querySelectorAll('.card').forEach((c) => {
      const t = PART_LIST[Number(c.dataset.i)];
      c.hidden = c.dataset.cat !== cat || !known(PARTS[t].bp);
      c.querySelector('.need').innerHTML = map ? '' : costHtml(t, inventory);
      c.classList.toggle('short', !canPay(t, inventory)); // 素材が足りない物は暗く
    });
  }
  box.addEventListener('click', (e) => {
    const tb = e.target.closest('.tab');
    if (tb) { if (tb.classList.contains('remove')) onPick(-1); else if (tb.classList.contains('paint')) onPick(PAINT); else { cat = tb.dataset.cat; render(); } return; }
    const sw = e.target.closest('.sw');
    if (sw) { onColor(Number(sw.dataset.c)); render(); return; }
    const io = e.target.closest('[data-io]');
    if (io) { if (io.dataset.io === 'export') onExport(); else if (io.dataset.io === 'settings') onSettings(); else file.click(); return; }
    const c = e.target.closest('.card');
    if (c) onPick(Number(c.dataset.i));
  });
  file.addEventListener('change', () => { if (file.files[0]) onImport(file.files[0]); file.value = ''; });
  inventory.onChange(() => { if (!box.hidden) render(); });
  return {
    box,
    get open() { return !box.hidden; },
    setOpen(v) { box.hidden = !v; if (v) render(); },
  };
}
