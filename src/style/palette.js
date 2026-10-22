// パレット（色の唯一の置き場所）。新しい色は先にここへ足す。
// 配列は暗い色 → 明るい色の順。

export const P = {
  // 4-1 世界の色
  grass: ['#3F5A2E', '#55703A', '#6E8A47', '#8AA35A', '#A9BC78'],
  conifer: ['#2F4A2C', '#3E5E36', '#557546', '#6F8A55'],
  broadleaf: ['#4A6A32', '#5E8240', '#789A52', '#94B068'],
  dryGrass: ['#7A6A3A', '#9C8A4E', '#B9A766', '#D2C38A'],
  autumn: ['#7A3E2C', '#8A4A32', '#A8633E', '#C07E4A'],
  soil: ['#4A3A2E', '#6A5444', '#8A7360', '#A8927C'],
  sand: ['#A8956E', '#C2AF86', '#D8C8A2', '#E8DCC0'],
  rockGray: ['#3C3F45', '#565A60', '#74777B', '#93959A', '#B5B6B8'],
  rockBrown: ['#4E4038', '#6B574B', '#8A7464', '#A8927F'],
  snow: ['#C9CDD2', '#E2E5E8', '#F4F5F6'],
  water: ['#3E6F86', '#5F93A8', '#8DB8C6', '#B9D6DE', '#E4EFF2'],
  // 鉱石（islands.md・objects.md「最初の島の物」）: 遠くからでも区別できる色の塊
  coal: ['#1A1A1D', '#2A2A2F', '#3C3C43'],
  copper: ['#2F7A6E', '#4E9F8E', '#C2702F'], // 緑青の青緑 2 段と、地のオレンジ
  iron: ['#5E2C1E', '#7E3E2A', '#A0553A'], // 赤茶
  // 墜落島のスポット（objects.md「墜落島のスポットの物」）
  moss: ['#3E5530', '#52693A', '#687F48'],       // 苔（岩の上を向いた面、泉、谷の底）
  deadWood: ['#8E8A80', '#ABA79C', '#C8C4B8'],   // 立ち枯れの木（灰白）。明るい段は樹皮のはがれた所
  shell: ['#C8A890', '#E2CDB6', '#F1E4D4'],      // 貝（淡い桃とクリーム）
  canvas: ['#8C8466', '#ABA27E', '#C6BD98'],     // テントの色あせた布
  paint: ['#B9B5AA', '#D6D2C6'],                 // 漁船の色あせた白い帯
  container: { rust: ['#7E3E26', '#A0552F'], blue: ['#2E5470', '#41708E'], green: ['#3E5E3E', '#557A52'] }, // コンテナ（暗い面・明るい面）

  // 4-2 建築の素材
  wood: ['#4E3826', '#6E4F35', '#8E6A48', '#AE8A64', '#CBAA84'],
  stone: ['#5A5854', '#6C6A66', '#8A8782', '#A8A59F', '#C6C3BC'],
  straw: ['#8E7A44', '#B09A5C', '#CDB87A'],
  bamboo: ['#6E7E3A', '#8C9C4E', '#AAB86A', '#D2CC92'],
  clay: ['#7A4A36', '#9A5E44', '#B87A5C'],

  // 4-3 空と光
  skyDay: { zenith: '#8EC3DA', mid: '#B4D8E6', horizon: '#DCEBF0' },
  cloud: ['#C9D2D8', '#E2E7EA', '#F6F7F8'],
  dusk: ['#9A6A8A', '#D98A6A', '#E8B48A', '#F2D2A8'],
  night: ['#141B2B', '#1E2A40', '#2E3E5A'],
  star: '#E8E4D0',
  // 画面の色味（style.md「画面の効果」。world/grade.js）: 画面全体にかける色（白 = そのまま）と、夜の暗い所に足す色。fog: 太陽の方の霧の色（world/fog.js）
  grade: { day: '#FFFFFF', morning: '#FFF4EA', dusk: '#FFEBDC', night: '#E2E8FA', nightLift: '#040818', swamp: '#E9F0DC', sunFog: '#FFE2B0' },
  sunLight: '#FFF2DC',
  skyLight: '#CFE3EC',
  groundLight: '#7A8A5A',

  // マップ作りの「空と色」の窓の見本（game/mapEnv.js）: [名前, 色]。空の色は [名前, 上, 中, 地平線]
  mapEnv: {
    sun: [['昼の白', '#FFF2DC'], ['真っ白', '#FFFFFF'], ['朝焼け', '#FFC48A'], ['夕焼け', '#FF9A5A'], ['琥珀', '#FFB84A'], ['赤い', '#FF5A4A'], ['桃', '#FFB0D0'], ['紫', '#C08AFF'], ['青白い', '#BFE4FF'], ['月', '#C8D8FF'], ['緑', '#8AFF9A'], ['毒々しい', '#B8FF3A']],
    hemi: [['昼の空', '#CFE3EC'], ['白', '#FFFFFF'], ['暖かい', '#FFE2C8'], ['夕方', '#E8B48A'], ['夜', '#4A5A9A'], ['紫', '#B89AE0'], ['緑', '#A8E0B0'], ['赤', '#E88A7A']],
    ground: [['草の照り返し', '#7A8A5A'], ['暗い', '#2A2A32'], ['砂', '#B09A6A'], ['白', '#D8D8D8'], ['赤茶', '#8A4A3A'], ['青', '#4A6A9A'], ['紫', '#6A4A8A']],
    sky: [['昼', '#8EC3DA', '#B4D8E6', '#DCEBF0'], ['夕焼け', '#9A6A8A', '#D98A6A', '#E8B48A'], ['朝焼け', '#6A8AB8', '#E8A88A', '#FFD8A8'], ['夜', '#0A0E2A', '#141C3E', '#222C52'], ['曇り', '#8A9098', '#A8AEB4', '#C8CCD0'], ['赤い空', '#6A1A1A', '#B83A2A', '#E87A4A'], ['紫の空', '#3A1A5A', '#7A3A8A', '#C07AB0'], ['緑の空', '#1A4A3A', '#3A8A6A', '#8AC8A0'], ['夕闇', '#1A1A3A', '#5A3A6A', '#C86A5A']],
    tint: [['なし', '#FFFFFF'], ['暖かい', '#FFE0C0'], ['冷たい', '#D0E0FF'], ['セピア', '#F0D8B0'], ['シアン', '#C8F0F0'], ['マゼンタ', '#F8D0F0'], ['緑がかった', '#E0F4D0'], ['夜', '#E2E8FA'], ['夕', '#FFEBDC'], ['朝', '#FFF4EA']],
  },

  // 4-4 キャラクターと大事な物
  catOrange: ['#C9732E', '#E89A4A', '#F2B26A'],
  catWhite: ['#D9D6D0', '#EDEBE6', '#F9F8F5'],
  catPink: ['#D9808F', '#E79AA8', '#F4BBC4'],
  eye: '#1E1E22',
  boots: ['#4A2A1A', '#5A3422', '#7A4A30'],
  fire: ['#E0602A', '#F49A3A', '#FFD27A'],
  food: ['#B0302E', '#D84A3A', '#F07A5A'],
  // 墜落した飛行機と、そこから出た物（islands.md「始まり」。大事な物なので明るい色）
  plane: ['#B9BEC4', '#DADDE0', '#EEF0F1'], // 白い機体
  planeStripe: ['#B8452E', '#D9603A'], // 機体の帯
  glass: ['#2A3A48', '#3E5466'], // 操縦席の窓
  glassItem: ['#6FA6A2', '#8FC4BE', '#BEE3DD'], // ガラス（持ち物）: 青緑がかった厚い板
  blueprint: ['#2F5E96', '#4C7DB8', '#86ACD8'], // 設計図の青い紙
  foil: ['#9EA5AD', '#BFC5CB', '#DCE0E4'], // 機内食のアルミのふた
  // 炉で作る金属（survival.md「鉱石と炉」）
  copperMetal: ['#8A4A26', '#B8693A', '#E09A62'],
  ironMetal: ['#4C5058', '#6E737C', '#9AA0A8', '#C4C9CF'],
  port: { in: ['#3E6676', '#56849A'], out: ['#9A7A30', '#BE9A44'] }, // 機械の入れる口（青）と出す口（黄土）の縁（automation.md）
  insulator: ['#BDB9AE', '#DEDBD2'], // 碍子（白い焼き物）
  lanternGlow: '#FFF4D6', // ランタンの白い光
  potato: ['#7E5E36', '#9E7A48', '#BC9862'], // イモ
  meat: { lean: ['#A04440', '#B85A52', '#CC7066'], fat: ['#E6D2C4', '#F1E3D6'], bone: ['#D8CFB8', '#EDE6D2'] }, // 生肉（赤身・脂・骨。焼くと焦げ茶へ寄せる）
  hide: { skin: ['#7A5A3E', '#8E6C4C', '#A58260'], under: ['#C2AC8E', '#D4C0A2'] }, // 皮（毛側・裏側）

  // 4-4c 原生生物（docs/rules/creatures.md。自然色。暗い色 → 明るい色）
  creatureEye: '#121214', // 生き物の黒い目
  eyeShine: '#F4F4F0',    // 目の白い光の点
  boar: {
    fur: ['#45403A', '#59524A', '#6E665C'], // 暗い茶灰の毛
    leg: ['#1F1C1A', '#2B2724'],            // 脚の下半分の黒い「靴下」
    hoof: ['#86847F', '#A4A29D'],           // ひづめ（灰）
    nose: ['#1E1D1D', '#2C2B2B', '#3A3938'], // 鼻の円盤（いちばん暗い段が鼻の穴）
    tusk: ['#C9C1A0', '#E2DBBF'],           // 牙（象牙。見分けの色）
    earIn: ['#37312D', '#443D38'],          // 耳の内側（くぼみ）
  },
  rabbit: {
    fur: ['#5C544C', '#756C62', '#8D8479'],   // 灰茶の毛
    light: ['#A39C91', '#B9B2A7', '#CCC6BB'], // 腹・胸・鼻づら・前足
    earIn: ['#5E4C46', '#725F57'],            // 耳の内側
    nose: ['#7A5C58', '#8E6E69'],             // 鼻
    tail: ['#D6D4CE', '#EAE9E4', '#F6F5F1'],  // 白いしっぽ（見分けの色）
  },
  bird: {
    feather: ['#69645E', '#807A73', '#968F88'], // 灰茶の羽
    wing: ['#5C5751', '#716B64', '#878079'],    // 翼（少し暗い）
    chest: ['#BF693D', '#D27B4B', '#E0925E'],   // だいだいの胸（見分けの色）
    beak: ['#C4AF95', '#DAC8AF'],               // くちばし
    feet: ['#9C7B75', '#B4928B'],               // 足
  },

  // 4-4b 敵ロボット（docs/rules/enemies.md。猫と区別できる青・黄・赤。暗い色 → 明るい色）
  robotShell: ['#3E5A7A', '#5A7FA6', '#86A9CC'], // 装甲（青灰）
  robotFrame: ['#2A2E38', '#3C424F', '#565D6C'], // 骨組み・関節（暗い鉄）
  robotHazard: ['#B8A02E', '#D9C040', '#F0DA6A'], // 作業機の警告色（黄）
  robotRust: ['#6A3E2E', '#8A5238', '#A8683F'], // さび・壊れた部分
  robotEye: ['#B02A2A', '#E8423A', '#FF8A70'], // 目・光る所（赤）
  robotScreen: ['#14161C', '#1C1F26', '#272B34'], // 顔の画面・口の中（ほぼ黒）
  robotMetal: ['#7E848E', '#9EA4AD', '#BFC4CB'], // むき出しの金属（ファンの羽）
  robotVent: ['#C77A1E', '#F0A530', '#FFD27A'], // 冷却口の光（弱点。だいだい）
  robotLamp: ['#E8C24A', '#FFE07A', '#FFF4C0'], // 採掘ロボのヘッドライト（黄）

  // マップ作りのコンクリート（docs/rules/building.md「コンクリートとマップ作り」）。見本の番号 c（0〜11）で選び、材質の色にする
  // 白・明るい灰・灰・暗い灰・炭・砂・赤茶・オレンジ・黄・青緑・青・紫
  concrete: ['#E6E3DD', '#BDBAB4', '#8E8C88', '#605F5D', '#36363A', '#C9B48E', '#9A4E3C', '#D9793A', '#D9B53E', '#3E8A86', '#3E5F9A', '#6E4E8A'],
  concreteBase: '#FFFFFF', // 形の頂点色（材質の色をそのまま出す）。面の明暗は flatShading で出る
  // 光る物（照明を受けない）。concrete と同じ番号で、原色寄りのネオン（パレットの決まりの外。style.md「のっぺりの例外」）
  glow: ['#FFFFFF', '#D2F2FF', '#8CB0D8', '#46608A', '#1C2036', '#FFC23A', '#FF1E2D', '#FF7400', '#FFEE00', '#00FFDC', '#1E66FF', '#B020FF'],
  concreteLeg: '#77756F', // ジャンプ台・飛ばし台の台（灰）

  // 4-4c サイバーガンシリーズ（docs/rules/weapons.md「サイバーガンシリーズ」）。世界の色と合わせない例外（ユーザー 2026-10-22）
  cyber: {
    black: ['#121116', '#18171D', '#1F1E25'], // 本体の黒い箱（下・横・上）
    gray: ['#24232A', '#2C2B33', '#36353E'], // 灰色の箱（銃床・ハンドガード・細い部品）
    edge: ['#4A4954', '#5E5D69'], // 面取りの細い面（絵の縁取りの代わり）
    neon: { ice: '#8FD8F7', volt: '#F5E04A', ember: '#FF7A3D', violet: '#A57BFF', mint: '#5FE3A1', crimson: '#FF4D5E', rose: '#FF6FB0', solar: '#FFC53D' }, // 銃ごとのネオン
  },

  // 4-5 画面表示
  // 石の板（docs/rules/ui.md「石の板の見た目」）
  ui: {
    panel: '#C9C6BF',
    slot: '#9C9993',
    edge: '#34312D',
    light: '#E6E3DC',
    label: '#F6F4EF',
    text: '#2E2A26',
    textSub: '#57514A',
    line: '#8E8A83',
    ok: '#6BCB77',
    ng: '#E05A5A',
    hp: '#D8584A',
    water: '#4F9AC2',
    hunger: '#E0A040',
    loadTop: '#1E2A40', // ロード画面: 夜空 → 深い海
    loadBottom: '#2E5468',
    loadFill: '#F49A3A', // 進み具合（たき火の色）
    stamina: '#6FBF5A', // スタミナ（weapons.md）
    dmg: '#FFFFFF', // ダメージの数字
    dmgWeak: '#FFD23A', // 弱点のダメージの数字
    barrier: '#8FD8F2', // 「バリア」の文字（ダメージ 0 のとき）
    hitMark: '#FFFFFF', // 照準の ×
    hitWeak: '#FF4A3A', // 弱点の ×
    hurtArc: '#E0302A', // 攻撃の来た向き
    lowHp: '#B01818', // HP が低いときの画面のふちのにじみ（ui.md）
    cooldown: '#FFFFFF', // 照準の下の攻撃間隔の線（ui.md）
    textShadow: '#000000',
    aware: '#FFD23A', // 敵の「？」
    alert: '#FF4A3A', // 敵の「！」
    sleep: '#BFD8F0', // 寝ている番人の「z」
  },

  // 戦闘の手ごたえ（weapons.md）
  fx: {
    flash: '#FFFFFF', // 当たった敵が白く光る
    barrier: '#8FD8F2', // 採掘ロボのバリア（遠くから撃つと体のまわりに光る六角の殻）
    spark: ['#FFE08A', '#FFB83A', '#FFF4C8'], // 火花
    smoke: ['#3A3A3E', '#55555A', '#77777C'], // 撃墜の煙
    trail: '#E8E2D0', // 飛ぶ弾の筋
    muzzle: ['#FFB83A', '#FFE08A'], // 銃口の火
    fang: '#F4FAFF', // 犬の白透明の牙（噛む瞬間にガチンと閉じる）
    wind: ['#FFFFFF', '#E4F1F4', '#C8E2EA'], // 風（ブンブンのつむじ風・風の弾）
    // 敵の演出（enemies.md「戦闘の演出」）
    steam: ['#F4F6F7', '#E2E6E8', '#CDD3D6'], // いつもの白煙（排気の湯気）
    sparkCool: ['#CFE8FF', '#9CCBFF', '#FFFFFF'], // 弱点の青白い火花
    ember: ['#FF6A2A', '#FF9A3A'], // 赤く光る小さな破片（冷めると暗くなる）
    dust: ['#A89A80', '#BFB298', '#8C8068'], // 土ぼこり
    mud: ['#5A4330', '#6E5238', '#46341F'], // 泥（犬の泥飛ばし・画面のふちの泥。enemies.md「ガラクタ犬」・ui.md「泥」）
    sand: ['#D9C89C', '#C8B386', '#E8DCB6', '#B8A274'], // 砂しぶき・砂ぼこり（カニ。enemies.md「カニ」）
    splash: ['#F2FAFC', '#CDE8F0', '#A8D6E4'], // 水しぶき・排水口のしずく（カニ）
    rock: ['#5E5A55', '#77716A', '#4A4642', '#8A8178'], // 岩の破片・突き出る岩・岩の殻（採掘ロボ。enemies.md「採掘ロボ」）
    crack: '#1E1B19', // 地割れのひび
    heat: ['#FF5A1A', '#FF8A2A', '#FFC060'], // 赤熱（振り下ろしのツルハシ・光るひび・火の粉）
    shock: ['#FFFFFF', '#FFE8C8', '#FFB070'], // 衝撃波の輪・斬撃の残像（白〜だいだい）
    eyeHalo: '#FF4A3A', // ためで目のまわりに広がる光
    // 自分の武器の演出（weapons.md「武器の動きと演出」）
    swing: '#FFFFFF', // 振りの軌跡
    tracer: ['#FFF2B0', '#FFD25A'], // 銃の軌道の線（芯・ふち）
    tracerSmoke: '#D8D8D4', // 軌道に残る薄い煙
  },

  // 4-6 異世界の色（予約・まだ使わない）
  magic: ['#6A4A9A', '#8E6AC0', '#7FC8C0'],
};
