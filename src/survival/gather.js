// 拾う・採る・叩く（docs/rules/survival.md）。照準の先の物を調べて、持ち物に入れる
import * as THREE from 'three';
import { ITEMS } from './items.js';
import { moveSlot } from './inventory.js';
import { DAY_LEN } from '../world/dayNight.js';

const REACH = 2.5; // 届く距離（m）
const between = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// 右クリックで拾う・採る物
export const TAKES = {
  stick: { name: '枝', item: 'stick', n: () => 1 },
  stone: { name: '石', item: 'stone', n: () => 1 },
  bag: { name: '落とした袋' }, // 中身は袋ごとに違う（interact で先に扱う）
  drop: { name: '落ちた物' }, // 中身が 1 種類なら、その名前を出す
  crate: { name: '貨物の木箱', verb: '開ける' }, // 墜落の浜（islands.md「始まり」）。中身は store
  aidbox: { name: '救急箱', verb: '開ける' },
  bush: { name: '木の実の茂み', verb: '採る', item: 'berry', n: () => between(2, 3), regrow: DAY_LEN * 2 },
  mushroom: { name: 'キノコ', verb: '採る', item: 'mushroom', n: () => 1, regrow: DAY_LEN },
  flint: { name: '火打ち石', item: 'flint', n: () => 1 },
  grass: { name: '草', verb: '刈る', item: 'fiber', n: () => 1 }, // 素手。刈った草は戻らない
  wildPotato: { name: '野生のイモ', verb: '採る', item: 'seedPotato', n: () => 1 }, // 野生の作物は戻らない（survival.md「畑」）
  wildHemp: { name: '野生の麻', verb: '採る', item: 'hempSeed', n: () => 1 },
  // 墜落島のスポット（survival.md「スポットの物と中身」）。container・barrel は箱と同じく中身（store）を開ける
  container: { name: 'コンテナ', verb: '開ける' },
  barrel: { name: '樽', verb: '開ける' },
  shell: { name: '貝', verb: '拾う', item: 'shell', n: () => 1, regrow: DAY_LEN * 2 },
  glowShroom: { name: '光るキノコ', verb: '採る', item: 'glowShroom', n: () => between(1, 2), regrow: DAY_LEN },
  clayLump: { name: '粘土', verb: '拾う', item: 'clay', n: () => 1 },
};
// 道具で叩いて壊す物（survival.md「叩く強さ」）。hp: 内部の HP。道具の攻撃力は items.js の dmg[種類]。extra: いっしょに手に入る物 [[id, 数], ...]
// tier: 叩くのに要る道具の段階（なければ 1。木 1・石 2・鉄 3。survival.md「道具の段階」）
// need: 攻撃力のない道具で叩いたときの一言（null なら何も言わない）。tool: 合う道具（ヒントの文字を出すのにだけ使う）
const rockHp = (e) => Math.max(60, Math.min(100, 60 + Math.round((e.size - 0.4) / 0.5) * 10));
export const HITS = {
  tree: { name: '木', verb: '切る', tool: 'axe', need: '斧が必要', item: 'wood', hp: () => 60, n: () => between(1, 2), extra: () => [['sapling', Math.random() < 0.25 ? 2 : 1]] }, // 植えた分だけ返り、たまに 2
  rock: { name: '岩', verb: '割る', tool: 'pick', need: 'ピッケルが必要', item: 'stone', hp: rockHp, n: (e) => Math.min(5, 2 + Math.round((rockHp(e) - 60) / 15)), extra: () => (Math.random() < 0.35 ? [['flint', 1]] : []) },
  // 鉱石の岩（islands.md・survival.md「鉱石と炉」）。3 日で戻る（island.js の REGROW）
  // 小さい岩（e.small）は HP が半分で、1 つだけ採れる
  coal: { name: '石炭の岩', tier: 2, verb: '割る', tool: 'pick', need: 'ピッケルが必要', item: 'coal', hp: (e) => (e.small ? 40 : 80), n: (e) => (e.small ? 1 : between(2, 3)), extra: () => [['stone', 1]] },
  copper: { name: '銅の岩', tier: 3, verb: '割る', tool: 'pick', need: 'ピッケルが必要', item: 'copperOre', hp: (e) => (e.small ? 50 : 100), n: (e) => (e.small ? 1 : between(2, 3)) },
  iron: { name: '鉄の岩', tier: 2, verb: '割る', tool: 'pick', need: 'ピッケルが必要', item: 'ironOre', hp: (e) => (e.small ? 70 : 140), n: (e) => (e.small ? 1 : between(2, 3)) },
  log: { name: '倒木', verb: '切る', tool: 'axe', need: '斧が必要', item: 'wood', hp: () => 50, n: () => between(4, 6) },
  bamboo: { name: '竹やぶ', verb: '切る', tool: 'axe', need: '斧が必要', item: 'bamboo', hp: () => 40, n: () => between(2, 3) },
  palm: { name: 'ヤシの木', verb: '切る', tool: 'axe', need: '斧が必要', item: 'wood', hp: () => 80, n: () => between(3, 4), extra: () => [['palmLeaf', between(2, 3)]] },
  grass: { name: '草', verb: '刈る', tool: 'knife', need: null, item: 'fiber', hp: () => 10, n: () => between(2, 3) },
  // 墜落島のスポット: ガラクタ（3 日で戻る。island.js の REGROW）と、丸太の山の丸太（上から 1 本ずつ）
  junk: { name: 'ガラクタ', verb: '壊す', tool: 'pick', need: 'ピッケルが必要', item: 'scrap', hp: () => 30, n: () => between(1, 2),
    extra: () => (Math.random() < 0.3 ? [['screw', 1]] : []) },
  pileLog: { name: '丸太', verb: '切る', tool: 'axe', need: '斧が必要', item: 'wood', hp: () => 20, n: () => 2 },
  // 鉱床（survival.md「鉱床」）: 壊れず、なくならない（endless）。当てた攻撃力をため、100 ごとに鉱石 1
  coalBed: { name: '石炭の鉱床', tier: 2, verb: '掘る', tool: 'pick', need: 'ピッケルが必要', item: 'coal', hp: () => 100, n: () => 1, endless: true },
  copperBed: { name: '銅の鉱床', tier: 3, verb: '掘る', tool: 'pick', need: 'ピッケルが必要', item: 'copperOre', hp: () => 100, n: () => 1, endless: true },
  ironBed: { name: '鉄の鉱床', tier: 2, verb: '掘る', tool: 'pick', need: 'ピッケルが必要', item: 'ironOre', hp: () => 100, n: () => 1, endless: true },
  // 石と砂（survival.md「道具の段階・木の道具・砂とガラス」）: 鉱床は 50 ごとに 1。砂の塊は 2 日で戻る（island.js の REGROW）
  stoneBed: { name: '石の鉱床', verb: '掘る', tool: 'pick', need: 'ピッケルが必要', item: 'stone', hp: () => 50, n: () => 1, endless: true },
  sand: { name: '砂の塊', verb: '掘る', tool: 'pick', need: 'ピッケルが必要', item: 'sand', hp: () => 20, n: () => between(2, 3) },
  sandBed: { name: '砂の鉱床', verb: '掘る', tool: 'pick', need: 'ピッケルが必要', item: 'sand', hp: () => 50, n: () => 1, endless: true },
};

const TIER_NAME = ['', '木', '石', '鉄'], TOOL_NAME = { pick: 'ピッケル', axe: '斧' };

export function createGather({ camera, inventory, onGain = () => {}, onMessage = () => {} }) {
  let world = null;
  const o = new THREE.Vector3(), d = new THREE.Vector3();
  function aimed() {
    if (!world || !world.resources) return null;
    camera.getWorldPosition(o);
    camera.getWorldDirection(d);
    return world.resources.aim(o, d, REACH, world.terrain);
  }
  const attack = (kind) => { const s = inventory.held(); return (s && ITEMS[s.id].dmg?.[kind]) || 0; }; // 持っている道具の、その相手への攻撃力
  // 合う道具なのに段階が足りないときの一言（足りているか、合う道具でなければ null）
  const lowTier = (def) => {
    const s = inventory.held(), it = s && ITEMS[s.id], need = def.tier ?? 1;
    return it && it.tool === def.tool && (it.tier ?? 1) < need ? `${TIER_NAME[need]}の${TOOL_NAME[def.tool]}以上が必要` : null;
  };
  const wearTool = () => { const broke = inventory.wear(); if (broke) onMessage(`${broke}が壊れた`); };

  return {
    setWorld(w) { world = w; },
    // 照準の先の物（なければ null）。枠で囲むのに使う
    aimedEntity() { return aimed()?.e ?? null; },
    // 照準の先の物の名前と操作（なければ null）
    aimedInfo() {
      const h = aimed();
      if (!h) return null;
      if (h.e.use) return { name: h.e.label, key: `右クリック ${h.e.verb}` }; // 射撃訓練島の台（range.js）
      const t = TAKES[h.e.kind];
      const one = h.e.kind === 'drop' && h.e.store?.filter(Boolean);
      if (t) return { name: one?.length === 1 ? ITEMS[one[0].id].name : t.name, key: `右クリック ${t.verb ?? '拾う'}` };
      const def = HITS[h.e.kind], hp = def.hp(h.e), dmg = attack(h.e.kind);
      const hit = def.endless ? (dmg ? `（あと ${Math.ceil((hp - (h.e.taken || 0)) / dmg)} 回）` : '') : h.e.taken ? ` ${Math.max(0, hp - h.e.taken)}/${hp}` : ''; // 鉱床は次の鉱石まで何回、ほかは残りの HP
      return { name: def.name + hit, key: lowTier(def) ?? (attack(h.e.kind) ? `左クリック ${def.verb}` : def.need) };
    },
    // 右クリック: 照準の先の物を拾う。拾える物に当たれば true（ドアの開け閉めより先に調べる）
    interact() {
      const h = aimed();
      if (h?.e.use) { onMessage(h.e.use()); return true; } // 射撃訓練島の台（range.js）
      if (h && h.e.store) { // 落とした袋: 中身を持ち物へ（設計図などの大事な物は大事な物へ）。全部入れば袋は消え、入りきらない分は袋に残る
        inventory.takeKeys?.(h.e.store);
        h.e.store.forEach((_, i) => moveSlot(h.e.store, i, inventory.slots));
        inventory.changed();
        if (h.e.store.some(Boolean)) onMessage('持ち物がいっぱい');
        else { world.resources.remove(h.e); onMessage(h.e.kind === 'bag' ? '袋を拾った' : h.e.kind === 'drop' ? '拾った' : `${TAKES[h.e.kind].name}を開けた`); }
        return true;
      }
      if (h && h.e.caps) { // 倒木の上のキノコ
        if (!h.e.caps.ready) return false;
        const n = between(1, 2);
        if (inventory.room('mushroom') < n) { onMessage('持ち物がいっぱい'); return true; }
        inventory.add('mushroom', n);
        world.resources.regrow(h.e.caps, DAY_LEN);
        onGain('mushroom', n);
        return true;
      }
      const def = h && TAKES[h.e.kind];
      if (!def) return false;
      const n = def.n();
      if (inventory.room(def.item) < n) { onMessage('持ち物がいっぱい'); return true; }
      inventory.add(def.item, n);
      if (def.regrow) world.resources.regrow(h.e, def.regrow);
      else world.resources.remove(h.e);
      onGain(def.item, n);
      return true;
    },
    // 左クリック: 持っている道具で叩く。合う道具でなければ揺れるだけ。照準の先に叩ける物がなければ false
    use() {
      const h = aimed();
      const def = h && HITS[h.e.kind];
      if (!def) return false;
      const e = h.e, dx = e.x - o.x, dz = e.z - o.z;
      if (e.blockedBy?.some((b) => b.ready)) { world.resources.shake(e, dx, dz); onMessage('上の丸太から切る'); return true; } // 丸太の山は上から
      const low = lowTier(def);
      if (low) { world.resources.shake(e, dx, dz); onMessage(low); return true; }
      const dmg = attack(e.kind);
      if (!dmg) { world.resources.shake(e, dx, dz); if (def.need) onMessage(def.need); return true; }
      e.taken = (e.taken || 0) + dmg;
      if (e.taken < def.hp(e)) { world.resources.shake(e, dx, dz); wearTool(); return true; }
      const n = def.n(e);
      if (inventory.room(def.item) < n) { e.taken -= dmg; world.resources.shake(e, dx, dz); onMessage('持ち物がいっぱい'); return true; }
      inventory.add(def.item, n);
      onGain(def.item, n);
      for (const [id, k] of def.extra?.() ?? []) { const got = inventory.add(id, k); if (got) onGain(id, got); }
      e.taken = 0;
      if (!def.endless) world.harvest(e, dx, dz); // 鉱床はなくならない
      wearTool();
      return true;
    },
  };
}
