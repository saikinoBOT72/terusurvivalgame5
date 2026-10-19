// 畑（docs/rules/survival.md「畑（プランター）」）: プランターに植えた作物 part.crop = { kind, t: 育った秒, water: 水をやったか }
// 操作は持って右クリック（ユーザー決定。設備の窓の例外）: 種で植える、竹筒（真水）で水をやる、実ったら収穫
import { rng, makeMesh } from '../style/lowpoly.js';
import { crop } from '../world/crops.js';
import { DAY_LEN } from '../world/dayNight.js';
import { ITEMS } from './items.js';

export const CROPS = {
  potato: { name: 'イモ', seed: 'seedPotato', time: DAY_LEN * 1.5, yield: [['potato', 3]] },
  hemp: { name: '麻', seed: 'hempSeed', time: DAY_LEN, yield: [['fiber', 5]] },
};
const STAGE = ['芽', '育ち中', '実り'];
const stageOf = (c) => (c.t >= CROPS[c.kind].time ? 2 : c.t >= CROPS[c.kind].time / 3 ? 1 : 0);
// 収穫: 作物と、植えた分の種（25% で 2）
const harvestOf = (c) => [...CROPS[c.kind].yield, [CROPS[c.kind].seed, Math.random() < 0.25 ? 2 : 1]];
const status = (c) => `${CROPS[c.kind].name}（${STAGE[stageOf(c)]}${!c.water ? '・水がない' : stageOf(c) < 2 ? ` ${Math.floor((c.t / CROPS[c.kind].time) * 100)}%` : ''}）`;

const geos = {}; // 作物の形は種類と段ごとに 1 つ
const geoOf = (kind, stage) => (geos[kind + stage] ??= crop(rng(kind.length * 31 + stage), kind, stage));
function show(part) {
  if (part.cropMesh) part.mesh.remove(part.cropMesh);
  part.cropMesh = null;
  const c = part.crop;
  if (!c) return;
  part.cropMesh = makeMesh(geoOf(c.kind, stageOf(c)), { double: true }); // 麻の葉は平たいので両面
  part.mesh.add(part.cropMesh);
}

export function initPlanter(part) { part.crop = null; }
// 時間を進める（遊んでいる間だけ）。水がなければ芽のまま
export function tickPlanter(part, dt) {
  const c = part.crop;
  if (!c?.water) return;
  const before = stageOf(c);
  c.t = Math.min(CROPS[c.kind].time, c.t + dt);
  if (stageOf(c) !== before) show(part);
}
export const planterData = (p) => (p.crop ? { crop: p.crop } : {});
export function loadPlanter(part, d) { if (d.crop) { part.crop = { ...d.crop }; show(part); } }
// 撤去: 植えた種は戻る。実っていれば収穫した物
export const planterRefund = (part) => (!part.crop ? [] : stageOf(part.crop) === 2 ? harvestOf(part.crop) : [[CROPS[part.crop.kind].seed, 1]]);

export function createFarm({ inventory, onGain, onMessage }) {
  return {
    // 右クリック（プランターを狙っているとき）
    use(part, held) {
      const c = part.crop;
      if (!c) {
        const kind = held && ITEMS[held].seed;
        if (!kind) { onMessage('種を持って右クリックで植える'); return true; }
        inventory.remove(held, 1);
        part.crop = { kind, t: 0, water: false };
        show(part);
        return true;
      }
      if (stageOf(c) === 2) {
        const got = harvestOf(c);
        if (!got.every(([id, n]) => inventory.room(id) >= n)) { onMessage('持ち物がいっぱい'); return true; }
        for (const [id, n] of got) { inventory.add(id, n); onGain(id, n); }
        part.crop = null;
        show(part);
        return true;
      }
      if (!c.water && held === 'tubeFresh') {
        inventory.remove('tubeFresh', 1);
        inventory.add('tubeEmpty', 1);
        c.water = true;
        onMessage('水をやった');
        return true;
      }
      onMessage(status(c));
      return true;
    },
    // 照準の下のヒント
    hint(part, held) {
      const c = part.crop;
      if (!c) return { name: 'プランター', key: held && ITEMS[held].seed ? '右クリック 植える' : '種を持って右クリックで植える' };
      if (stageOf(c) === 2) return { name: status(c), key: '右クリック 収穫' };
      if (!c.water) return { name: status(c), key: held === 'tubeFresh' ? '右クリック 水をやる' : '竹筒（真水）で水をやる' };
      return { name: status(c), key: '育っている' };
    },
  };
}
