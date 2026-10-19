// 素材と道具の定義、クラフトの作り方（docs/rules/survival.md）
// heal: 使うと増える HP。key: 大事な物に入る（拾うと持ち物でなく大事な物へ。keyItems.js）。bp: 持っているとレシピが作れる設計図の名前（survival.md「設計図」）。expand: 右クリックで使うと持ち物が広がり、奥の段がこの数になる。equip: 入れる装備の枠（head・body・feet・acc。equip.js）。desc: 大事な物の一覧に出す説明
// tier: 道具の段階（木 1・石 2・鉄 3。gather.js の HITS の tier 以上でないと叩けない）。time: 作業台で長押しして作る秒（なければ 2）
// dur: 道具の耐久（使うと 1 減り、0 で壊れる）。dmg: 相手（gather.js の HITS の名前、敵は mob か mobTypes.js の名前）ごとの攻撃力。swing: 1 回振る秒数（なければ 0.4）。cd: 振ってから次を振れるまでの秒（なければ swing。weapons.md「攻撃間隔」）。reach・knock・hit・stam・heavy・ranged: 戦いの項目（weapons.md の表）。food / water: 食べた・飲んだときに増える空腹度・水分。after: 飲んだあとに残る入れ物
export const ITEMS = {
  stick: { name: '枝', stack: 50 },
  stone: { name: '石', stack: 50 },
  wood: { name: '木材', stack: 50 },
  berry: { name: '木の実', stack: 50, food: 8 },
  // 序盤の素材と食べ物（survival.md「序盤の素材と水分」）
  fiber: { name: '植物繊維', stack: 50 },
  rope: { name: 'ひも', stack: 50 },
  flint: { name: '火打ち石', stack: 50 },
  clay: { name: '粘土', stack: 50 },
  brick: { name: 'レンガ', stack: 50 },
  sand: { name: '砂', stack: 50 }, // 砂の塊・砂の鉱床。炉でガラス
  glass: { name: 'ガラス', stack: 50 }, // 炉で砂 2 から。窓の材料
  bamboo: { name: '竹', stack: 50 },
  palmLeaf: { name: 'ヤシの葉', stack: 50 },
  feather: { name: '羽根', stack: 50 },
  sapling: { name: '苗木', stack: 20 },
  // 墜落した飛行機から出た物（islands.md「始まり」）
  meal: { name: '機内食', stack: 10, food: 20, top: true }, // top: 手に持つと上の面を見せる
  waterBottle: { name: '水のボトル', stack: 10, water: 30 },
  firstAid: { name: '救急セット', stack: 5, heal: 40, top: true },
  bpFurnace: { key: true, name: '設計図「炉」', stack: 1, bp: 'furnace', desc: '建築で炉が作れる' },
  // 畑（survival.md「畑（プランター）」）。seed: 植えると育つ作物
  soil: { name: '土', stack: 50 },
  seedPotato: { name: '種イモ', stack: 20, seed: 'potato' },
  hempSeed: { name: '麻の種', stack: 20, seed: 'hemp' },
  potato: { name: 'イモ', stack: 20, food: 6 },
  cookedPotato: { name: '焼いたイモ', stack: 20, food: 20 },
  // 鉱石（survival.md「鉱石と炉」）
  coal: { name: '石炭', stack: 50 },
  copperOre: { name: '銅鉱石', stack: 50 },
  ironOre: { name: '鉄鉱石', stack: 50 },
  // 炉と金属（survival.md「鉱石と炉」）。ネジ・ガラクタのかけらは敵が落とす（enemies.md）
  copperIngot: { name: '銅の延べ棒', stack: 50 },
  ironIngot: { name: '鉄の延べ棒', stack: 50 },
  copperWire: { name: '銅線', stack: 50 },
  screw: { name: 'ネジ', stack: 50 },
  scrap: { name: 'ガラクタのかけら', stack: 50 },
  bpIronTools: { key: true, name: '設計図「鉄の道具」', stack: 1, bp: 'ironTools', desc: '鉄の斧・ピッケル・やりが作れる' },
  bpLantern: { key: true, name: '設計図「銅線」', stack: 1, bp: 'lantern', desc: '銅の延べ棒から銅線が作れる' },
  bpJunkPistol: { key: true, name: '設計図「ガラクタ拳銃」', stack: 1, bp: 'junkPistol', desc: 'ガラクタ拳銃とガラクタ弾が作れる' }, // weapons.md
  mushroom: { name: 'キノコ', stack: 50, food: 5 },
  egg: { name: '卵', stack: 20 },
  coconut: { name: 'ヤシの実', stack: 20, food: 5, water: 15 },
  fish: { name: '魚', stack: 20, food: 6 },
  cookedBerry: { name: '焼いた木の実', stack: 50, food: 12 },
  cookedMushroom: { name: '焼いたキノコ', stack: 50, food: 15 },
  cookedEgg: { name: '焼いた卵', stack: 20, food: 15 },
  cookedFish: { name: '焼いた魚', stack: 20, food: 25 },
  shell: { name: '貝', stack: 20, food: 4 }, // 潮だまり（survival.md「スポットの物と中身」）
  cookedShell: { name: '焼いた貝', stack: 20, food: 14 },
  glowShroom: { name: '光るキノコ', stack: 1, tool: 'light', dur: 600 }, // 持っている間だけ青緑に光る（松明と同じく 1 秒に 1 減る）
  // 持ち物を広げる（survival.md「持ち物の広さ・大事な物・装備」）
  grassBag: { name: '草の袋', stack: 1, expand: 3 },
  toughBag: { name: '丈夫なかばん', stack: 1, expand: 4 },
  tubeEmpty: { name: '竹筒（空）', stack: 5 },
  tubeSea: { name: '竹筒（生水）', stack: 5 }, // 海・川・泉の水。そのままは飲めない
  tubeFresh: { name: '竹筒（真水）', stack: 5, water: 30, after: 'tubeEmpty' },
  // 木の道具（段階 1）: 石の道具より弱い。木の斧は木を 10 回、木のピッケルは岩を 10〜17 回
  woodAxe: { name: '木の斧', stack: 1, tool: 'axe', tier: 1, dur: 30, swing: 0.8, cd: 0.9, reach: 1.5, hit: 'arc', stam: 12, dmg: { tree: 6, palm: 6, log: 6, bamboo: 6, pileLog: 6, mob: 3 } },
  woodPick: { name: '木のピッケル', stack: 1, tool: 'pick', tier: 1, dur: 30, swing: 0.9, cd: 1, reach: 1.5, hit: 'arc', stam: 12, dmg: { rock: 6, junk: 6, stoneBed: 6, sand: 6, sandBed: 6, mob: 3 } },
  stoneAxe: { name: '石の斧', stack: 1, tool: 'axe', tier: 2, dur: 60, swing: 0.8, cd: 0.9, reach: 1.5, hit: 'arc', stam: 12, dmg: { tree: 10, palm: 10, log: 10, bamboo: 10, pileLog: 10, mob: 5 } },
  stonePick: { name: '石のピッケル', stack: 1, tool: 'pick', tier: 2, dur: 60, swing: 0.9, cd: 1, reach: 1.5, hit: 'arc', stam: 12, dmg: { rock: 10, coal: 10, iron: 10, junk: 10, stoneBed: 10, sand: 10, sandBed: 10, coalBed: 10, ironBed: 10, mob: 5 } },
  stoneHammer: { name: '石のハンマー', stack: 1, tool: 'hammer', dur: 100, swing: 0.7 },
  stoneSpear: { name: '石のやり', stack: 1, tool: 'spear', dur: 40, swing: 0.6, cd: 0.7, reach: 2.5, knock: 0.4, stam: 8, dmg: { mob: 5 } },
  stoneKnife: { name: '石のナイフ', stack: 1, tool: 'knife', dur: 60, swing: 0.5, cd: 0.5, reach: 1.5, stam: 5, dmg: { grass: 10, mob: 8 } },
  // 遠距離武器（weapons.md「遠距離武器」）。ranged の項目は weapons.md の表
  sling: { name: 'スリング', stack: 1, tool: 'sling', dur: 50,
    ranged: { ammo: 'stone', dmg: 5, speed: 28, drop: 1, spread: [1.5, 4, 1.5], draw: 1, rate: 0.3, falloff: [12, 30, 0.3], knock: 0.2 } },
  junkPistol: { name: 'ガラクタ拳銃', stack: 1, tool: 'gun', dur: 400, hold: 1.6, // hold: 手に持ったときの大きさ（倍）
    ranged: { ammo: 'junkAmmo', dmg: 10, speed: 90, drop: 0.15, spread: [2, 5, 1], draw: 0, rate: 0.6, mag: 5, reload: 2.2, falloff: [10, 35, 0.35], recoil: 4, aim: true, knock: 0.3 } },
  junkAmmo: { name: 'ガラクタ弾', stack: 60 },
  fishingRod: { name: '釣り竿', stack: 1, tool: 'rod', dur: 40 },
  torch: { name: '松明', stack: 1, tool: 'torch', dur: 240 }, // 持っている間だけ 1 秒に 1 減る
  paddle: { name: 'かい', stack: 1, tool: 'paddle', dur: 150 }, // いかだをこぐ（physics.md）
  // 鉄の道具: 石の 2 倍の攻撃力、3 倍の耐久（survival.md「鉱石と炉」）
  ironAxe: { name: '鉄の斧', stack: 1, tool: 'axe', tier: 3, dur: 180, swing: 0.8, cd: 0.9, reach: 1.5, hit: 'arc', stam: 12, dmg: { tree: 20, palm: 20, log: 20, bamboo: 20, pileLog: 20, mob: 10 } },
  ironPick: { name: '鉄のピッケル', stack: 1, tool: 'pick', tier: 3, dur: 180, swing: 0.9, cd: 1, reach: 1.5, hit: 'arc', stam: 12, dmg: { rock: 20, coal: 20, copper: 20, iron: 20, junk: 20, stoneBed: 20, sand: 20, sandBed: 20, coalBed: 20, copperBed: 20, ironBed: 20, mob: 10 } },
  ironSpear: { name: '鉄のやり', stack: 1, tool: 'spear', dur: 120, swing: 0.6, cd: 0.7, reach: 2.5, knock: 0.4, stam: 8, dmg: { mob: 10 } },
};

// 消した物（バッテリー・ランタン。survival.md）。古いセーブの持ち物・箱・落とし物にあれば、読むときに捨てる
export const REMOVED = new Set(['battery', 'lantern']);

// 素手（何も持っていない、または攻撃力のない物を持っているとき）。項目は道具と同じ
export const HAND = { name: '素手', swing: 0.4, cd: 0.4, reach: 1, knock: 0.2, stam: 4, dmg: { mob: 1 } };

// station: そのそばでだけ作れる家具（3m 以内）
export const RECIPES = [
  { out: 'rope', n: 1, need: { fiber: 3 } },
  { out: 'woodAxe', n: 1, need: { stick: 3, rope: 1 } },
  { out: 'woodPick', n: 1, need: { stick: 3, rope: 1 } },
  { out: 'stoneAxe', n: 1, need: { stick: 3, stone: 4, rope: 2 } },
  { out: 'stonePick', n: 1, need: { stick: 3, stone: 5, rope: 2 } },
  { out: 'stoneHammer', n: 1, need: { stick: 3, stone: 3, rope: 2 } },
  { out: 'stoneKnife', n: 1, need: { stick: 1, flint: 2, rope: 2 } },
  { out: 'grassBag', n: 1, need: { fiber: 10, rope: 4 } },
  { out: 'toughBag', n: 1, need: { rope: 6, wood: 2, scrap: 3, screw: 2 }, station: 'workbench', time: 2 },
  { out: 'sling', n: 1, need: { stick: 2, rope: 3 } },
  { out: 'junkPistol', n: 1, need: { ironIngot: 3, screw: 4, scrap: 6, rope: 2 }, station: 'workbench', bp: 'junkPistol', time: 5 },
  { out: 'junkAmmo', n: 5, need: { scrap: 1, coal: 1 }, station: 'workbench', bp: 'junkPistol', time: 1.5 },
  { out: 'fishingRod', n: 1, need: { bamboo: 2, rope: 3, feather: 1 } },
  { out: 'tubeEmpty', n: 1, need: { bamboo: 1 } },
  { out: 'torch', n: 1, need: { stick: 1, rope: 1, palmLeaf: 1 } },
  { out: 'paddle', n: 1, need: { wood: 4, rope: 2 } },
  { out: 'stoneSpear', n: 1, need: { stick: 4, stone: 4, rope: 2 }, station: 'workbench', time: 2 },
  { out: 'stick', n: 2, need: { wood: 1 } },
  // bp: その設計図を持っていないと作れない（survival.md「設計図」）
  { out: 'copperWire', n: 2, need: { copperIngot: 1 }, bp: 'lantern' },
  { out: 'ironAxe', n: 1, need: { ironIngot: 3, wood: 1, screw: 2 }, station: 'workbench', bp: 'ironTools', time: 3 },
  { out: 'ironPick', n: 1, need: { ironIngot: 3, wood: 1, screw: 2 }, station: 'workbench', bp: 'ironTools', time: 3 },
  { out: 'ironSpear', n: 1, need: { ironIngot: 3, wood: 2, screw: 2 }, station: 'workbench', bp: 'ironTools', time: 3 },
];
