// 敵の数値の表（docs/rules/enemies.md「戦闘」）。攻撃・HP・速さ・落とす物はここだけに書く。敵を増やすときは 1 行足す
// hp: HP。speed: 歩く・飛ぶ速さ（m/秒）。hover: 浮く高さ（m、飛ぶ敵だけ）。sight: 見つける距離。giveUp: あきらめる距離（元の場所から）
// attacks: { name, dmg 攻撃力, windup ためる秒, reach 届く m, rest 次まで秒, dash 体当たりの速さ（m/秒、なければその場で振る）, push 当たったプレイヤーを押す m }
// flinch: のけぞりの倍率（武器の knock × これ。0 でのけぞらない）。weak: 弱点（体の中の場所 at・半径 r・倍率 mult）
// drops: 倒すと落とす物 [物, 最小, 最大, 確率]。low: HP がこの割合より減ったときの動き { at, act: 'flee' 逃げる | 'sea' 海へ逃げる | 'rage' 速く, speed 速さの倍率, windup ためる秒の倍率 }
// 攻撃の追加の項目: min 届く距離の下限（突進は遠くから）、hop 跳びかかる高さ m、wind / hit ためと攻撃のポーズ（なければ windup・attack）
// kind: 'spin' まわりを回る（area 半径 m の中に当たる、secs 回る秒）| 'shot' 弾を撃つ（shot: { speed, r 半径, range 消える m }）。band: この間合いのときだけ使う
// dust: ためと攻撃で土ぼこり（fx: 'wind' はいつも）。cd: 次にこの攻撃を使えるまでの秒（ためを始めてから。rest とは別）。pushSecs: 押す秒、lift: 上へ浮かせる速さ（m/秒、吹き飛ばし）。fx: 'wind' 風の演出（windFx.js）| 'mud' 泥と歯の火花（mudFx.js）
// bands: 間合い取り（spacing.js）{ near/mid/far: [下, 上] m, every: [選び直す秒], weight: 重み }
// turn: 向きを変える速さ（ラジアン/秒、なければ 8）。正面 35 度に入らないと攻撃しない。stagger: 足が止まる隙 { every 秒ごとに, secs 秒 }
// 犬の項目（enemies.md「ガラクタ犬」）: arc 弧を描いて追う曲げ方（ラジアン、なければ 0.3）。stagger.every は [最小, 最大] でランダム。
// pack: 群れ（pack.js）。攻撃の style: 演出の形（mudFx.js）。hits 噛む回数・gap 間の秒・step 踏み込む m・pushEach 最後の前に押す m（2 回目は向きを直し、無敵を無視）。over 跳ぶ先の余り m
// track: 跳ぶこの秒前まで向きをねらい直す。feint: 跳ばずに横へ跳ねる確率。miss: 外したときのつんのめりの秒。n・fan: 弾の数と扇の角度（ラジアン）。shake: 揺れの重さを攻撃力この値として扱う（かみつきの 2 回目は 1.3 倍）。smear: 画面に泥がつく。slow: [歩く速さの倍率, 秒]（当たってガードしなかったとき）。wander・vary・noRepeat: 犬の間合いのランダムさ（brain.js）
// pick: 'weight' 近距離の技を重み w で選ぶ（melee.js。同じ技は続けない）。cone: 振る・噛むの左右の角度（なければ 45）。around: 向いていなくても出せる。ground: 地面の上だけに当たる。stuck: 放出のあと刺さって動けない秒。hitR: 当たる距離（reach は使う距離）。lunge: { time 秒, hop 跳ぶ高さ, stop プレイヤーの何 m 手前まで, air 空中のポーズ（あれば着地の瞬間だけ当たる） } 踏み込み（melee.js）。roar: 岩の殻から出て吠える秒。leash: スポットの中心からあきらめる m。farGive: [m, 秒] これより遠いまま秒たつとあきらめる。fx: 'rock' 岩と土（rockFx.js）
// shot.g: 弾の重力（m/秒²。横は speed で、ねらった所に落ちる）
// disguise: 岩のふり（気づくまで disguise のポーズで動かない。見つけたらすぐ戦う）。swim: 水に入れる
// dummy: 練習用の的（攻撃しない。倒れず、3 秒で HP が戻る）
import { createDrone } from './drone.js';
import { createCrab } from './crab.js';
import { createDog } from './dog.js';
import { createMining } from './mining.js';
import { createGangi } from './gangi.js';
import { createDummy } from './dummy.js';
import { createCamera } from './camera.js';

// AI のバージョンごとの強さの倍率（enemies.md「強さの倍率」）。島ごとに使う段は islandMap.js の tier（なければ v0）
export const TIERS = {
  v0: { hp: 1, dmg: 1, speed: 1 },
};

export const MOBS = {
  drone: {
    name: 'ブンブン', make: createDrone, hp: 40, speed: 5.5, turn: 12, hover: 0.9, sight: 18, giveUp: 40, flinch: 1,
    bands: { near: [1.8, 2.6], mid: [5, 8], far: [12, 16], every: [2, 4], weight: [30, 40, 30] }, // 間合い取り（spacing.js）
    attacks: [
      { name: 'つむじ風', kind: 'spin', band: 'near', dmg: 50, windup: 0.55, reach: 3, area: 3.5, secs: 0.4, rest: 2, push: 3, pushSecs: 0.45, lift: 4, fx: 'wind', wind: 'windupSpin', hit: 'spin' },
      { name: '体当たり', band: 'mid', dmg: 30, windup: 0.45, min: 4, reach: 9, rest: 1.5, dash: 12, push: 1.5, fx: 'wind' },
      { name: '風の弾', kind: 'shot', dmg: 10, windup: 0.3, min: 10, reach: 20, rest: 1, cd: 3.5, push: 1, shot: { speed: 14, r: 0.35, range: 30 }, fx: 'wind', wind: 'windupShot', hit: 'shoot' },
    ],
    low: { at: 0.3, act: 'flee' },
    drops: [['screw', 1, 2, 1], ['battery', 1, 1, 0.2]],
  },
  crab: {
    name: 'カニ', make: createCrab, hp: 40, speed: 1.2, sight: 10, giveUp: 40, flinch: 1, turn: 1.6, swim: true, // 向きを変えるのが遅い: 背中へ回るとはさみが来ない
    attacks: [{ name: 'はさみ', dmg: 10, windup: 0.7, reach: 1.2, rest: 1.5, push: 0.8 }],
    low: { at: 0.3, act: 'sea' },
    drops: [['scrap', 1, 2, 1]],
  },
  dog: { // enemies.md「ガラクタ犬」
    name: 'ガラクタ犬', make: createDog, hp: 80, speed: 5, turn: 10, arc: 0.7, sight: 20, giveUp: 40, flinch: 0.7,
    stagger: { every: [3, 6], secs: 0.6 }, // 走っている最中につんのめる
    wander: { near: [1.2, 2.1], mid: [5, 8], far: [11, 15], every: [2, 4], weight: [35, 40, 25] }, // ほしい距離をランダムに選び直す（brain.js）
    vary: 0.2, noRepeat: true, // ため・休みの長さのばらつき、同じ攻撃を続けて選ばない
    pack: { call: 25, flank: [5, 7], gap: 0.3, max: 2, wait: 4 },
    attacks: [
      { name: '連続かみつき', band: 'near', style: 'bite', fx: 'mud', shake: 40, dmg: 18, hits: 2, gap: 0.3, step: 1, windup: 0.4, reach: 2.2, rest: 1, push: 1.2, pushEach: 0.2, wind: 'windupBite', hit: 'bite', hit2: 'bite2' },
      { name: '跳びかかり', band: 'mid', style: 'pounce', fx: 'mud', dust: true, dmg: 40, windup: 0.35, min: 4, reach: 9, over: 1.5, rest: 1.4, dash: 18, hop: 0.9, push: 2, track: 0.08, feint: 0.3, miss: 0.8, wind: 'windupPounce', hit: 'pounce' },
      { name: '泥飛ばし', band: 'far', style: 'mud', kind: 'shot', fx: 'mud', smear: true, slow: [0.5, 3], dmg: 18, windup: 0.5, min: 9, reach: 18, rest: 1.5, cd: 4, push: 0.5, shot: { speed: 32, r: 0.8, range: 35, g: 5 }, wind: 'windupMud', hit: 'mud' },
    ],
    low: { at: 0.4, act: 'rage', speed: 1.3, rest: 0.7 },
    drops: [['scrap', 2, 2, 1], ['screw', 1, 1, 1]],
  },
  mining: { // 「その場の鉱石 2」はステップ 7（置かれた場所を知ってから）。近距離だけで戦い、遠いとすぐあきらめる（enemies.md「採掘ロボ」）
    name: '採掘ロボ', make: createMining, hp: 120, speed: 2.5, sight: 6, giveUp: 40, flinch: 0.5, turn: 3, arc: 0.1, disguise: true,
    pick: 'weight', vary: 0.2, leash: 18, farGive: [12, 2], roar: 0.8, // roar: 岩の殻から出て吠える秒 // 技は重み w で選ぶ（melee.js）・同じ技は続けない、スポットの中心から 18m・12m より遠いまま 2 秒であきらめる
    attacks: [ // cone: 左右の角度、around: 向いていなくても出せる（背中側なら優先）、ground: 地面の上だけ（跳べばよけられる）、stuck: 刺さって抜けない秒
      { name: '振り下ろし', w: 40, dmg: 40, windup: 0.9, reach: 6, hitR: 2.6, track: 0.15, lunge: { time: 0.45, hop: 1, stop: 1.2, air: 'leapSmash' }, secs: 0.3, cone: 25, rest: 2, push: 2.5, stuck: 0.7, fx: 'rock', style: 'smash', wind: 'windupSmash', hit: 'smash', shake: 60 },
      { name: 'なぎ払い', w: 35, dmg: 25, windup: 0.6, reach: 4.5, hitR: 2.6, lunge: { time: 0.25, stop: 1 }, secs: 0.15, cone: 80, rest: 1.5, push: 2, fx: 'rock', style: 'sweep', wind: 'windupSweep', hit: 'sweep', dust: true },
      { name: '地割れ', w: 25, kind: 'spin', around: true, ground: true, dmg: 15, windup: 0.8, reach: 3.2, area: 3.5, secs: 0.2, rest: 2.5, cd: 5, push: 1.5, lift: 3, fx: 'rock', style: 'quake', wind: 'windupQuake', hit: 'quake', dust: true },
    ],
    low: { at: 0.5, act: 'rage', windup: 0.7 },
    drops: [['scrap', 3, 3, 1]],
  },
  gangi: { // 設計図「航海装置」はステップ 9
    name: 'ガンギ', make: createGangi, hp: 600, speed: 2.5, sight: 25, giveUp: 40, flinch: 0.2, turn: 2.5,
    attacks: [
      { name: '振り下ろし', dmg: 35, windup: 1.2, reach: 2.6, rest: 2, push: 3 },
      { name: '突進', dmg: 25, windup: 1.4, reach: 10, min: 5, rest: 3, dash: 9, push: 3, wind: 'crouch', hit: 'charge' },
    ],
    weak: { at: [0, 2.1, -0.6], r: 0.35, mult: 3 }, // 背中の冷却口
    low: { at: 0.5, act: 'rage', speed: 1.2 },
    drops: [['battery', 2, 2, 1], ['scrap', 6, 6, 1]],
  },
  camera: { // 監視カメラ（enemies.md「監視カメラ」）: 動かない。見つけると警報でブンブンを呼ぶ（cameraBrain.js）。sight は水平の距離
    name: '監視カメラ', make: createCamera, hp: 40, speed: 0, sight: 25, giveUp: 999, flinch: 0, camera: true,
    attacks: [], drops: [['copperWire', 1, 1, 1], ['battery', 1, 1, 1], ['screw', 2, 2, 1]],
  },
  dummy: {
    name: '練習用の的', make: createDummy, hp: 100, speed: 0, sight: 0, giveUp: 999, flinch: 1, dummy: true,
    attacks: [], drops: [],
    weak: { at: [-0.08, 1.08, 0.24], r: 0.1, mult: 3 }, // 胸の的
  },
};
