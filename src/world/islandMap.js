// 島ごとの設計（docs/rules/islands.md）: 区域の下絵と、地形の決まった場所
// 下絵は北が上、1 文字 = cell m。列が x（東へ増える）、行が z（南へ増える）。島の中心が (0, 0)
// 字: ~ 海、B 浜、L 入り江、M 湿地、G 草原と丘、F 林、D 深い森、K 見晴らしの丘、r 川、P 滝つぼ、Q 岩場、C 峡谷、H 高台、S 海食崖
// 島の中身だけを持つ。海のどこに置くか（位置）は別に決める
export const ISLANDS = {
  crash: {
    id: 'crash', name: '墜落島', seed: 7, cell: 20, size: 480, // size: 地図の一辺（m）。陸はおよそ 400m
    map: [
      '~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~SSHHHHHHHSS~~~~~~~',
      '~~~~QQQHHHHHHHHHCC~~~~~~',
      '~~~QQQQQHHHHHHHHCCC~~~~~',
      '~~QQQQQQQHHHHHHHCCCC~~~~',
      '~~QQQQQQDDHHPHHCCCCC~~~~',
      '~~GQQQDDDDDDrDDDDCCC~~~~',
      '~~GGQDDDDDDDrDDDDDCC~~~~',
      '~GGGGDDDDDDDrDDDDDDF~~~~',
      '~GGGGGDDDDDKrKDDDFFF~~~~',
      '~GGGGGFFFFKKrKKFFFFF~~~~',
      '~GGGGGFFFFFKrKFFFFFF~~~~',
      '~GGGGFFFFFFFrFFFFFFF~~~~',
      '~GGGGFFFFFFFrrFFFFFFF~~~',
      '~~GGGFFFFFFFFrFFFFFLL~~~',
      '~~MMMGFFFFFFFrrFFFFLLL~~',
      '~~MMMMFFFFFFFFrFFFLLLL~~',
      '~~~MMMMFFFFFFFrrFFLLL~~~',
      '~~~MMMMBFFFFFFFrLLLL~~~~',
      '~~~~MMBBBBBBBBBLLLL~~~~~',
      '~~~~~BBBBBBBBBB~~~~~~~~~',
      '~~~~~~BBBBBBB~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~',
    ],
    spawn: { x: -50, z: 166, yaw: Math.PI }, // 墜落の浜。残骸のほう（南）を向いて起きる
    dummy: { x: -45, z: 163 }, // 練習用の的（enemies.md）
    // 固定湧き（islands.md「敵の出方」）。n: 数、group: 1 組の数、when: always いつも | night 夜に来る番人
    // at: 決まった場所（mode・n も付けられる）、back: 倒してから戻るまでの日（null で戻らない）
    spawns: [
      // スポットの番人（islands.md「スポット」、enemies.md「番人」）。spot: スポットの番号、mode: guard いつもいる | sleep 寝ている | visit 夜に来る | fake 死んだふり
      // ore: その鉱石の岩のそばに置く（倒すとその鉱石 2）。face: [x, z] そちらを向く
      { kind: 'crab', spot: 2, n: 2, mode: 'guard', when: 'always', back: 2 },
      { kind: 'crab', spot: 3, n: 5, mode: 'guard', when: 'always', back: 2, d: 3.5 },
      { kind: 'crab', spot: 4, n: 2, mode: 'guard', when: 'always', back: 2 },
      { kind: 'dog', spot: 6, n: 1, mode: 'sleep', when: 'always', back: 2, d: 3 },
      { kind: 'drone', spot: 7, n: 1, group: 2, mode: 'visit', when: 'night' },
      { kind: 'mining', spot: 8, n: 1, mode: 'fake', when: 'always', back: 2, d: 2.6 },
      { kind: 'dog', spot: 9, n: 2, mode: 'guard', when: 'always', back: 2 },
      { kind: 'drone', spot: 10, n: 2, mode: 'guard', when: 'always', back: 2 },
      { kind: 'dog', spot: 11, n: 4, mode: 'sleep', when: 'always', back: 2, d: 3.2 },
      { kind: 'drone', spot: 13, n: 3, mode: 'guard', when: 'always', back: 2 },
      { kind: 'dog', spot: 15, n: 1, group: 2, mode: 'visit', when: 'night' },
      { kind: 'dog', spot: 18, n: 3, mode: 'guard', when: 'always', back: 2, d: 6 },
      { kind: 'mining', spot: 22, n: 3, mode: 'guard', when: 'always', back: 2, ore: 'coal' },
      { kind: 'mining', spot: 24, n: 1, mode: 'guard', when: 'always', back: 2, ore: 'iron' },
      { kind: 'camera', spot: 25, n: 1, mode: 'guard', when: 'always', back: null, face: [149, -62] },
      { kind: 'mining', spot: 26, n: 2, mode: 'guard', when: 'always', back: 2, ore: 'copper' },
      { kind: 'mining', spot: 28, n: 2, mode: 'guard', when: 'always', back: 2, ore: 'iron' },
      { kind: 'drone', spot: 28, n: 2, mode: 'guard', when: 'always', back: 2 },
      { kind: 'gangi', at: { x: 20, z: -185 }, when: 'always', back: null },
      // 鉱石の密集地（islands.md「鉱石の密集地」）
      { kind: 'crab', spot: 32, n: 2, mode: 'guard', when: 'always', back: 2, d: 7 },
      { kind: 'crab', spot: 33, n: 2, mode: 'guard', when: 'always', back: 2, d: 6 },
      { kind: 'drone', spot: 33, n: 1, mode: 'guard', when: 'always', back: 2 },
      { kind: 'drone', spot: 34, n: 2, mode: 'guard', when: 'always', back: 2 },
      { kind: 'dog', spot: 34, n: 2, mode: 'guard', when: 'always', back: 2, d: 6 },
      { kind: 'dog', spot: 26, n: 2, mode: 'guard', when: 'always', back: 2, d: 4 },
    ],
    // 自然湧き（islands.md「敵の出方」）: 円（x, z, r）の中の区域 zones に出る。mobs: [種類, 1 組の数] から 1 つ選ぶ
    // night / day: 生きている数（組）の上限（日数は関係ない）、every: 出す間隔の幅（秒）。範囲は重なってよい（2026-10-21 見直し）
    wild: [
      { name: '浜の西', zones: 'B', x: -95, z: 180, r: 75, mobs: [['crab', 1]], night: 4, day: 2, every: [25, 70] },
      { name: '浜の東', zones: 'B', x: 15, z: 180, r: 75, mobs: [['crab', 1]], night: 4, day: 2, every: [25, 70] },
      { name: '入り江', zones: 'L', x: 130, z: 110, r: 85, mobs: [['crab', 1]], night: 4, day: 2, every: [25, 70] },
      { name: '湿地', zones: 'M', x: -155, z: 115, r: 80, mobs: [['crab', 1]], night: 4, day: 2, every: [25, 70] },
      { name: '林の南', zones: 'F', x: 20, z: 110, r: 100, mobs: [['drone', 1], ['crab', 1]], night: 4, day: 2, every: [40, 100] },
      { name: '林の西', zones: 'F', x: -70, z: 50, r: 90, mobs: [['drone', 1], ['dog', 2]], night: 4, day: 2, every: [40, 100] },
      { name: '林の東', zones: 'F', x: 125, z: 20, r: 100, mobs: [['drone', 1], ['dog', 2]], night: 4, day: 2, every: [40, 100] },
      { name: '西の草原の南', zones: 'G', x: -180, z: 30, r: 90, mobs: [['drone', 1], ['dog', 2]], night: 4, day: 2, every: [40, 100] },
      { name: '西の草原の北', zones: 'G', x: -180, z: -70, r: 90, mobs: [['drone', 1], ['dog', 2]], night: 4, day: 2, every: [40, 100] },
      { name: '林の北', zones: 'F', x: 40, z: -5, r: 100, mobs: [['drone', 1], ['dog', 2]], night: 5, day: 2, every: [35, 90] },
      { name: '深い森', zones: 'D', x: 0, z: -85, r: 130, mobs: [['drone', 1], ['dog', 2]], night: 5, day: 2, every: [35, 90] },
      { name: '深い森の西', zones: 'D', x: -110, z: -80, r: 80, mobs: [['drone', 1], ['dog', 2]], night: 4, day: 2, every: [40, 100] },
      { name: '岩場', zones: 'Q', x: -130, z: -150, r: 90, mobs: [['dog', 2], ['drone', 1]], night: 4, day: 2, every: [40, 100] },
      { name: '峡谷', zones: 'C', x: 125, z: -135, r: 90, mobs: [['dog', 2], ['drone', 1]], night: 4, day: 2, every: [40, 100] },
      { name: '北の高台', zones: 'H', x: -10, z: -165, r: 110, mobs: [['dog', 2], ['drone', 1]], night: 3, day: 2, every: [50, 120] },
      // 生き物（creatures.md）: creature は昼夜とも day の数だけ出る（night は使わない）。倒した分は 3 日で戻る。島全体で鳥 30・ウサギ 11・イノシシ 8（遠い範囲は出ない）
      { name: '西の草原の南 ウサギ', creature: true, zones: 'G', x: -180, z: 30, r: 90, mobs: [['rabbit', 1]], day: 3, every: [15, 40] },
      { name: '西の草原の北 ウサギ', creature: true, zones: 'G', x: -180, z: -70, r: 90, mobs: [['rabbit', 1]], day: 3, every: [15, 40] },
      { name: '西の草原の北 イノシシ', creature: true, zones: 'G', x: -180, z: -70, r: 90, mobs: [['boar', 1]], day: 2, every: [25, 60] },
      { name: '林の北 鳥', creature: true, zones: 'F', x: 40, z: -5, r: 100, mobs: [['bird', 1]], day: 4, every: [15, 40] },
      { name: '林の北 イノシシ', creature: true, zones: 'F', x: 40, z: -5, r: 100, mobs: [['boar', 1]], day: 2, every: [25, 60] },
      { name: '林の南 鳥', creature: true, zones: 'F', x: 20, z: 110, r: 100, mobs: [['bird', 1]], day: 3, every: [15, 40] },
      { name: '風の丘の一本木 鳥', creature: true, zones: 'G', x: -190, z: -70, r: 35, mobs: [['bird', 1]], day: 3, every: [15, 40] },
      { name: '浜の西 鳥', creature: true, zones: 'B', x: -95, z: 180, r: 75, mobs: [['bird', 1]], day: 2, every: [20, 50] },
      { name: '浜の東 鳥', creature: true, zones: 'B', x: 15, z: 180, r: 75, mobs: [['bird', 1]], day: 2, every: [20, 50] },
      { name: '入り江 鳥', creature: true, zones: 'L', x: 130, z: 110, r: 85, mobs: [['bird', 1]], day: 2, every: [20, 50] },
      { name: '湿地 鳥', creature: true, zones: 'M', x: -155, z: 115, r: 80, mobs: [['bird', 1]], day: 2, every: [20, 50] },
      { name: '林の西 ウサギ', creature: true, zones: 'F', x: -70, z: 50, r: 90, mobs: [['rabbit', 1]], day: 3, every: [15, 40] },
      { name: '林の東 イノシシ', creature: true, zones: 'F', x: 125, z: 20, r: 100, mobs: [['boar', 1]], day: 2, every: [25, 60] },
      { name: '林の東 鳥', creature: true, zones: 'F', x: 125, z: 20, r: 100, mobs: [['bird', 1]], day: 3, every: [15, 40] },
      { name: '深い森 イノシシ', creature: true, zones: 'D', x: 0, z: -85, r: 130, mobs: [['boar', 1]], day: 2, every: [25, 60] },
      { name: '深い森の西 ウサギ', creature: true, zones: 'D', x: -110, z: -80, r: 80, mobs: [['rabbit', 1]], day: 2, every: [20, 50] },
      { name: '岩場 鳥', creature: true, zones: 'Q', x: -130, z: -150, r: 90, mobs: [['bird', 1]], day: 3, every: [20, 50] },
      { name: '見晴らしの丘 鳥', creature: true, zones: 'K', x: 0, z: -40, r: 60, mobs: [['bird', 1]], day: 3, every: [20, 50] },
      { name: '北の高台 鳥', creature: true, zones: 'H', x: -10, z: -165, r: 110, mobs: [['bird', 1]], day: 3, every: [20, 50] },
    ],
    wreck: { x: -52, z: 178, rot: 0.35 },     // 飛行機の残骸（機首が北）
    sandBed: { x: -32, z: 184 },              // 砂の鉱床（stonePlace.js）
    high: 19,                                 // 高台の高さ（崖の上）
    // 峡谷の底の道: 入口（林）から高台まで、canyonFrom → canyonTo m へ上る
    canyon: [[148, -60], [150, -90], [140, -130], [120, -150], [95, -165], [68, -170]], canyonFrom: 3, canyonTo: 19,
    river: [[10, -120], [10, -40], [12, 20], [28, 40], [34, 70], [48, 96], [60, 116], [84, 130]], // 滝つぼ → 入り江
    pond: { x: 10, z: -126, r: 9 },           // 高台の崖に 3 方を囲まれた滝つぼ
    fall: { x: 10, z: -139.3 },               // 滝の崖の面（裏に洞窟の口。スポット 20）
    reef: { x: 205, z: -45, r: 10 },          // 沖の岩礁
    stacks: [                                 // 海から立つ岩の柱
      { x: -70, z: -215, r: 2.5, h: 9 }, { x: 90, z: -212, r: 2, h: 7 }, { x: 195, z: -120, r: 2.5, h: 10 },
    ],
    // AI の跡（islands.md「設計図の置き場所」）。端末の形はステップ 10。今は設計図だけ地面に置く
    traces: [{ x: -150, z: -132, item: 'bpIronTools' }, { x: 121, z: -149, item: 'bpLantern' }, { x: 141, z: -127, item: 'bpJunkPistol' }],
    // 自動化の設計図（端末のそば）: 発電機は銅の鉱脈の壁（26）、自動炉・ベルトは露天掘りの大穴（22）、風車は見晴らしの岩（19）のてっぺん
    autoTraces: [{ x: 123, z: -149, item: 'bpGenerator' }, { x: -152, z: -132, item: 'bpAutoFurnace' }, { x: -148, z: -131, item: 'bpBelt' }, { x: -10, z: -30, item: 'bpWindmill', dy: 3 }],
    // スポット（islands.md「スポット」）: 番号・名前・中心・r（区域の木・岩・小物を置かない半径）。bed: 鉱床（kind、x・z がなければ中心。survival.md「鉱床」）
    spots: [
      { n: 1, name: '墜落地点', x: -52, z: 178, r: 0 },
      { n: 2, name: '流れ着いた貨物', x: 30, z: 170, r: 10 },
      { n: 3, name: 'カニの集積所', x: -110, z: 170, r: 10 },
      { n: 4, name: '河口の干潟', x: 150, z: 110, r: 10 },
      { n: 5, name: '沈んだ漁船', x: 190, z: 70, r: 8 },
      { n: 6, name: '竹林の奥のテント跡', x: 150, z: 30, r: 16, shape: [{ type: 'flat', h: 3.5, r: 7, edge: 4 }] },
      { n: 7, name: '立ち枯れの沼', x: -150, z: 110, r: 16 },
      { n: 8, name: 'ロボの墓場', x: -170, z: 70, r: 12, shape: [{ type: 'flat', h: 2.5, r: 14, edge: 6 }, { type: 'bowl', r: 10, d: 2 }], ground: { kind: 'mud', r: 12 } },
      { n: 9, name: '石垣の畑跡', x: -170, z: -10, r: 14 },
      { n: 10, name: '風の丘の一本木', x: -190, z: -70, r: 12, shape: [{ type: 'bowl', r: 14, d: -4 }] },
      { n: 11, name: '犬のねぐら', x: -150, z: 30, r: 12, shape: [{ type: 'bowl', r: 12, d: 3 }], ground: { kind: 'dirt', r: 11 } },
      { n: 12, name: '西の潮だまり', x: -205, z: -30, r: 10, shape: [{ type: 'cove', h: 1, r: 10, a: 0, rw: 3, rl: 10 }] },
      { n: 13, name: '切り株の空き地', x: 110, z: -10, r: 14, shape: [{ type: 'flat', h: 4, r: 11, edge: 5 }], ground: { kind: 'dirt', r: 10 } },
      { n: 14, name: '倒木の谷', x: -70, z: 70, r: 18, shape: [{ type: 'trench', a: 0.6, len: 34, w: 6, d: 3 }], ground: { kind: 'moss', r: 17 } },
      { n: 15, name: '泉', x: -50, z: 10, r: 8, shape: [{ type: 'flat', h: 4, r: 6, edge: 3 }], ground: { kind: 'moss', r: 7 } },
      { n: 17, name: '苔の巨岩と洞窟', x: -90, z: -70, r: 14, shape: [{ type: 'bowl', r: 40, d: -7 }], ground: { kind: 'stone', r: 7 }, ores: { coal: [0, 3] }, oreIn: { x: -113, z: -85, r: 3.5, y: 2.5 } },
      { n: 18, name: '昼でも暗い森', x: 70, z: -90, r: 0 },
      { n: 19, name: '見晴らしの岩', x: -10, z: -30, r: 6, shape: [{ type: 'calm', r: 26, edge: 8 }, { type: 'bowl', r: 16, d: -8 }], ground: { kind: 'stone', r: 6 } },
      { n: 20, name: '滝と裏の洞窟', x: 10, z: -126, r: 10, ground: { kind: 'stone', r: 9 } },
      { n: 21, name: '川の飛び石と水車小屋跡', x: 30, z: 50, r: 8, shape: [{ type: 'raise', h: -0.5, r: 5 }] },
      { n: 22, name: '露天掘りの大穴', x: -150, z: -140, r: 22, shape: [{ type: 'steps', h: 12.5, rings: [20, 14, 8], step: 2.5, a: Math.PI / 2, rw: 4 }], ground: { kind: 'pit', r: 21 }, ores: { coal: [8, 8] } },
      { n: 24, name: '岩場の鍾乳洞', x: -103, z: -186, r: 8, shape: [{ type: 'flat', h: 8.5, r: 7, edge: 4 }], ground: { kind: 'stone', r: 10 }, ores: { iron: [0, 3] }, oreIn: { x: -44, z: -206, r: 6, y: 4 } },
      { n: 25, name: '峡谷入口の監視カメラ', x: 144, z: -81.5, r: 3 },
      { n: 26, name: '銅の鉱脈の壁', x: 140, z: -130, r: 12, shape: [{ type: 'flat', h: 10.5, r: 6.5, edge: 1 }], ground: { kind: 'copper', r: 16 }, ores: { copper: [6, 6] }, bed: { kind: 'copper' } },
      { n: 27, name: '崩れた坂', x: 108, z: -158, r: 8, shape: [{ type: 'crack', a: Math.atan2(-15, -25), len: 6, d: 4, top: 17 }], ground: { kind: 'stone', r: 9 } },
      { n: 28, name: '鉄の鉱脈', x: -70, z: -190, r: 16, shape: [{ type: 'flat', h: 18.5, r: 6, edge: 2 }], ground: { kind: 'rust', r: 14 }, ores: { iron: [7, 8] } },
      // 鉱石の密集地（islands.md「鉱石の密集地」）。cluster: stone は stonePlace.js が岩と石を置く。鉱床の下は flat で平らにする（斜面に置かない）
      { n: 32, name: '石の密集地', x: -34, z: 126, r: 12, shape: [{ type: 'flat', h: 4, r: 10, edge: 4 }], ground: { kind: 'stone', r: 7 }, cluster: 'stone' },
      { n: 33, name: '石炭の密集地', x: -115, z: 75, r: 13, shape: [{ type: 'calm', r: 18, edge: 6 }, { type: 'flat', h: 4.5, r: 11, edge: 4 }], ground: { kind: 'pit', r: 9 }, ores: { coal: [8, 10] }, bed: { kind: 'coal', x: -113, z: 74.5 } },
      { n: 34, name: '鉄の密集地', x: 66, z: 4, r: 13, shape: [{ type: 'flat', h: 4.5, r: 11, edge: 4 }], ground: { kind: 'rust', r: 10 }, ores: { iron: [8, 8] }, bed: { kind: 'iron' } },
      { n: 29, name: 'ガンギの広場', x: 20, z: -185, r: 12 },
    ],
    // 洞窟（terrain.md「洞窟」、islands.md「スポット」17・20・24）。地形を削る（caveCarve.js）
    // mouth: 入口（暗さを計る起点）。parts: path（[x, z, 床の高さ] の折れ線、幅 w・高さ h）か room（[x, z, 床]、半径 rx・rz、真ん中の天井 h、pit: 真ん中のくぼみ）
    // lvl: 段（同じ段の部品は床と天井を 1 つにまとめる）。chest など: 中に置く物の場所
    caves: [
      { spot: 17, mouth: { x: -90, z: -54, open: 9 }, coal: { x: -113, z: -85, r: 3.5 }, shrooms: { x: -72, z: -97 }, parts: [
        { path: [[-90, -46, 9], [-90, -50, 8], [-90, -57, 5.5], [-91, -64, 3.5], [-92, -71, 2.5]], w: 3.6, h: 3 },
        { room: [-93, -78, 2], rx: 9, rz: 7, h: 5.5, a: 0.3 },
        { path: [[-100, -80, 2], [-109, -84, 2.5]], w: 3.4, h: 2.8 },
        { room: [-113, -85, 2.5], rx: 6, rz: 5, h: 4, a: -0.4 }, // 石炭の広場
        { path: [[-89, -80, 2], [-84, -83, 2], [-79, -88, 2.5], [-74, -94, 2.5]], w: 3.4, h: 2.8 },
        { room: [-72, -97, 2.5], rx: 4, rz: 3.5, h: 3.2 }, // 光るキノコの行き止まり
        { path: [[-94, -81, 2], [-96, -86, 2], [-97, -92, 1.5], [-92, -98, 1.5]], w: 3.4, h: 2.8 },
        { room: [-88, -99, 1.5], rx: 6, rz: 5, h: 4, a: 0.5 },
        { path: [[-85, -97, 1.5], [-79, -90, 2.5]], w: 3.2, h: 2.6 }, // 奥の広場から東の通路へ戻る輪
      ] },
      { spot: 20, mouth: { x: 10, z: -138 }, chest: { x: 35, z: -190 }, parts: [
        { path: [[10, -134, 0.5], [10, -142, 1], [10, -150, 1.5], [9, -156, 2]], w: 4, h: 3.2 },
        { room: [8, -163, 2], rx: 10, rz: 8, h: 7 },
        { path: [[0, -166, 2], [-4, -174, 1.5], [-4, -183, 1]], w: 3.4, h: 3 },
        { room: [-4, -188, 1], rx: 8, rz: 7, h: 6, pit: 2.5, a: 0.2 }, // 地下の水たまり
        { path: [[14, -165, 2], [26, -170, 2.5], [32, -178, 3], [35, -188, 3.5]], w: 3.4, h: 2.8 },
        { room: [35, -190, 3.5], rx: 4, rz: 3.5, h: 3.2 }, // 宝箱
        { path: [[8, -168, 2], [12, -180, 3.5], [16, -190, 5], [13, -202, 6]], w: 3.4, h: 3 },
        { room: [12, -206, 6], rx: 7, rz: 6, h: 5, a: -0.3 },
      ] },
      { spot: 24, mouth: { x: -101, z: -186 }, parts: [
        { path: [[-106, -186, 8.5], [-96, -186, 8.5], [-86, -185, 9], [-72, -182, 9]], w: 4, h: 3.2 },
        { room: [-66, -181, 9.5], rx: 9, rz: 7, h: 6.5, a: 0.2 },
        { path: [[-65, -185, 9.5], [-60, -197, 10], [-57, -206, 10]], w: 3.4, h: 3 },
        { room: [-57, -208, 10], rx: 4, rz: 3.5, h: 3.5 },
        { path: [[-60, -180, 9.5], [-46, -176, 10], [-32, -173, 10]], w: 3.4, h: 3 },
        { room: [-26, -172, 10], rx: 8, rz: 6, h: 5.5, a: -0.2 },
        { path: [[-23, -170, 10], [-17, -163, 10.5]], w: 3.2, h: 2.8 },
        { lvl: 1, path: [[-70, -186, 9.5], [-74, -193, 7.5], [-72, -200, 6], [-66, -205, 4.5], [-53, -207, 4]], w: 3.4, h: 3.2 }, // 下の段へ下りる坂
        { lvl: 1, room: [-44, -206, 4], rx: 12, rz: 8, h: 8.5, a: 0.1 }, // いちばん大きい広場（鉄と採掘ロボ）
        { lvl: 1, path: [[-36, -205, 4], [-25, -201, 4.5]], w: 3.4, h: 3 },
        { lvl: 1, room: [-22, -200, 5], rx: 6, rz: 5, h: 4.5 },
      ] },
    ],
    // 木の密集地帯（islands.md「木の密集地帯」）: 中心・半径・本数。区域の木とは別に足す
    groves: [
      { x: -40, z: -8, r: 22, n: 45 }, { x: 48, z: 26, r: 18, n: 35 }, { x: -24, z: 64, r: 20, n: 40 },
      { x: 76, z: -28, r: 16, n: 30 }, { x: -84, z: 30, r: 18, n: 32 }, { x: 34, z: 92, r: 15, n: 26 },
      { x: 70, z: -90, r: 22, n: 80 }, // 昼でも暗い森（スポット 18）: 島で一番密
    ],
    // 区域ごとの数（islands.md「資源の量」）。nest は広葉樹のうち何本に巣をかけるか
    counts: {
      tree: { F: 180, D: 170, G: 30, Q: 15, H: 20, K: 10, M: 10 }, rock: { Q: 40, F: 20, G: 20, B: 8, H: 12, K: 20, D: 10 },
      palm: { B: 25, L: 10 }, log: { F: 10, D: 10 }, bamboo: { r: 10, L: 6, M: 10, P: 2 }, bush: { G: 12, F: 12, M: 6 },
      mushroom: { F: 20, D: 20, M: 10 }, flint: { B: 16, L: 6 }, stick: { F: 80, D: 40, G: 30, B: 20, M: 10 },
      stone: { F: 25, G: 25, B: 20, Q: 30, K: 20 }, nest: 15,
      wildPotato: { G: 4 }, wildHemp: { G: 4 }, // 野生の作物（最初の種。survival.md「畑」）。ほかに石垣の畑跡（スポット 9）に 6 ずつ
      coal: { Q: 6 }, copper: { C: 10 }, iron: {}, // ほかにスポットの ores（22・24・26・28・33・34）
      oreSmall: { coal: { Q: 10 }, copper: { C: 14 }, iron: { H: 4 } }, // 小さい鉱石の岩
      // 密集地のまわりの小さい鉱石: 区域の字ごとの数を、中心 near [x, z, 半径] の中にだけ置く
      oreNear: [{ kind: 'coal', want: { M: 4, G: 3, F: 3 }, near: [-115, 75, 60] }, { kind: 'iron', want: { K: 4, D: 4 }, near: [66, 4, 70] }],
    },
  },
};
