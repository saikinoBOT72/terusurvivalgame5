// PvP のモード（docs/rules/modes.md）: マップ作りの世界、自分の持ち物、PvP の画面の効果。試合（リスポーン・点数・通信）はあとでここに足す
import { BAR, COLS, ROWS_START } from '../survival/inventory.js';
import { VIEW } from './modes.js';

// play(w): main.js の世界の切り替え。world()・screen(): 今の世界と画面（menu / fps / dead）
export function createPvp({ scene, sky, player, inventory, equip, invHud, structuresOf, play, world, screen }) {
  let mapMaker = null;
  // 持ち物は島とは別（島の持ち物・装備を持ち込まず、ここの物を島へ持ち帰らない）。
  // このモードにいる間だけ、島の持ち物と装備を預かる（stash）。ここの持ち物は kit に残る
  let stash = null, kit = null;
  const take = () => ({ slots: [...inventory.slots], equip: [...equip.save()], sel: inventory.sel });
  function put(k) {
    inventory.slots.splice(0, inventory.slots.length, ...k.slots);
    equip.load(k.equip);
    inventory.select(k.sel);
    inventory.changed();
  }

  return {
    ...VIEW,
    id: 'pvp',
    pvp: true, // 霧の見える距離の下限・被弾の色ずれ（style.md「画面の効果」）
    owns: (w) => !!w && w === mapMaker?.world,
    enter() { stash = take(); put(kit ?? { slots: Array(BAR + COLS * ROWS_START).fill(null), equip: [], sel: 0 }); },
    exit() { kit = take(); put(stash); stash = null; },
    get mapMaker() { return mapMaker; },
    // マップ作り（building.md「コンクリートとマップ作り」。game/mapMaker.js）: 最初に選ばれたときに作る
    openMap: () => import('../game/mapMaker.js').then(({ createMapMaker }) => {
      if (!mapMaker) { mapMaker = createMapMaker({ structuresOf, player, playing: () => screen() === 'fps', onMessage: (m) => invHud.message(m), sky, current: () => world() === mapMaker?.world }); scene.add(mapMaker.world.group); mapMaker.world.mapApi = mapMaker; }
      play(mapMaker.world);
      mapMaker.entered();
    }),
  };
}
