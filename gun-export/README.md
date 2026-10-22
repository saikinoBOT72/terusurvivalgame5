# 将棋FPS の銃（初期スキン・単色ローポリ・動きつき）

将棋FPS で駒が持っている銃 13 丁を、別のゲームへ移すために書き出したものです。
受け取る側の Claude 向けの説明です。

- `*.glb`：1丁につき1ファイル。形・単色の材質・動きが入っています。テクスチャは入っていません。
- `guns.json`：銃ごとの補足です。動きの長さ、出来事のタイミング、色、銃口と排莢口の位置、構えの位置、ゲームでの連射間隔やリロード時間が入っています。

| ファイル | 銃 | 持っている駒 |
|---|---|---|
| glock17.glb | Glock 17 | 歩 |
| deagle.glb | デザートイーグル | と（歩の成り） |
| b93r.glb | ベレッタ 93R | 銀 |
| famas.glb | FAMAS | 全（銀の成り） |
| mk2.glb | マークスマン Mk2 | 香 |
| awm.glb | AWM | 杏（香の成り） |
| m870.glb | M870 | 金 |
| m79.glb | M79 | 角 |
| mgl.glb | MGL | 馬（角の成り） |
| mp5k.glb | MP5K | 飛 |
| vector.glb | KRISS Vector | 龍（飛の成り） |
| ak47.glb | AK-47 | 王 |
| m4a1.glb | M4A1 | 帝（王の成り） |

次の物は入れていません。

- 銃でない武器：和弓・クロスボウ・刀・手裏剣・カランビット
- 初期以外のスキンと、その飾り
- グリップの滑り止めや木目の絵

## 形の決まり

- 単位はメートルで、実銃の寸法どおりです。前が **−Z**、上が **+Y**、右が **+X** です。
- 原点はグリップの付け根あたりです。
- 一番上のノードはファイル名と同じ名前です（例：`glock17`）。その下に、動く部品のノードがあります。
  - `slide`：スライド
  - `mag`：弾倉
  - `trigger`：引き金
  - `lhand`：左手
  - `pump`：M870 の先台
  - `lever`：Mk2 のボルトハンドル
  - ほかにもあります。各動きで動く部品は、guns.json の `clips.<名前>.parts` に書いてあります。
- メッシュの名前は `部品名_塗りの場所` です（例：`slide_slideDark`）。
- 空のノードが2つあります。
  - `muzzle`：銃口です。光や弾をここから出します。
  - `eject`：排莢口です。薬莢をここから出します。
- 面ごとの単色ローポリです。頂点は共有していないので、法線は面ごとに分かれています。頂点のデータは位置と法線だけで、uv はありません。
- 材質は、塗りの場所ごとに1つずつ入っています。すべて `MeshStandardMaterial`（flatShading）で、材質の名前が塗りの場所の名前です。
  - 塗りの場所：`slide` `barrel` `frame` `grip` `detail` `mag` `slideDark` `bore` `hand` など
  - 色は guns.json の `colors` にも書いてあります。
  - 色を変えるときは、材質を名前で探して色だけ差し替えてください。
- **手**：`hand_R`（右手）と `hand_L`（左手、`lhand` の下）は木の塊です。いらなければメッシュだけ消してください。
  - `lhand` ノードは残してください。リロードで弾を運ぶ部品が `lhand` の下に付いている銃があります（M870 の `shell` など）。
- 隠れている部品：`shell` や `round` など、途中で出てくる部品は、初めは大きさ 0 になっています。
  - 見える/見えないは、大きさ（scale）の STEP の動きで切り替えています。

## 動き（アニメーション）

どの銃にも次のクリップがあります。すべて一回だけ流してください（LoopOnce）。

| クリップ | 中身 |
|---|---|
| `fire` | 1発撃つ（スライドが下がって戻る、引き金） |
| `reload` | リロード |
| `inspect` | 眺める（約 2.6 秒） |
| `equip` | 持ち替えて構える |
| `fireLast` | （ハンドガン3丁だけ）最後の1発。スライドが下がったまま止まるので、`clampWhenFinished = true` にする |
| `release` | （ハンドガン3丁だけ）止まっていたスライドを戻す |
| `reloadEmpty` | （ハンドガン3丁だけ）弾切れからのリロード。`fireLast` で止まった形から始まり、途中でスライドが戻る |

- 動きは、動く部品と一番上のノードの位置・回転を、そのまま入れたものです。ゲームと同じ形になるように確かめてあります（差は 3mm・1° 以内）。
- **一度に流す動きは1つだけにしてください。** どのクリップも全身の形を持っているので、2つ同時に流すと平均になってしまいます。切り替えは、ゲームと同じ次の決まりにしてください。
  - `fire` は `inspect` と `equip` を止める。
  - `reload` は `inspect` を止める。
  - リロード中は `inspect` を受け付けない。
  - `equip` はすべてを止めてから流す。
  - ハンドガンが弾切れのとき（`fireLast` で止まっているとき）は、`fireLast` を止めて `reloadEmpty` を流す（`reload` は使わない）。
  - **一番上のノードも動きます。** 画面での位置・向き・大きさは、自分で作った入れ物のノードを親にして決めてください。一番上のノードに直接置いても、動きで上書きされます。
- **リロードの長さ**：ゲームでは、クリップの速さを銃ごとのリロード時間に合わせています。
  - `action.timeScale = clips.reload.dur / game.reload` にすると、ゲームと同じ長さになります。`reloadEmpty` も同じ式で合わせてください。
- **撃つ間隔**：`game.rate` 秒です。連射の銃は `game.auto` が true です。
  - `game.burst` 発ずつ撃つ銃（93R・FAMAS）は、1発ごとに `game.burstGap` 秒あけます。
  - 撃つたびに `fire` を最初から流し直してください。
- **出来事**：`clips.<名前>.events` に `[秒, 名前]` で書いてあります。時刻は流し始めからの秒で、リロードの時間を伸ばしたときは同じ割合で伸びます。
  - `eject`：`eject` ノードから薬莢を出す。
  - `magOut` `magIn` `insert` `rack` `slap` `close`：音を鳴らす合図。
  - `release`（ハンドガンの `reload` / `reloadEmpty` の中）：スライドが戻る合図です。`reloadEmpty` には戻る動きが入っているので、音を鳴らすだけでかまいません。
- glTF の決まりで、動きの曲線は、キーの間をまっすぐつないだものに置き換えてあります（1/120 秒ごとと、元のキーの時刻に点を打っています）。

```js
const gltf = await new GLTFLoader().loadAsync('glock17.glb');
const holder = new THREE.Group(); holder.add(gltf.scene); camera.add(holder);   // 構えの位置は holder に
const mixer = new THREE.AnimationMixer(gltf.scene);
const clip = n => THREE.AnimationClip.findByName(gltf.animations, n);
function play(name, timeScale = 1) {
  const a = mixer.clipAction(clip(name));
  a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = name === 'fireLast'; a.timeScale = timeScale; a.play();
  return a;
}
// play('fire') / play('reload', info.clips.reload.dur / info.game.reload)
```

## 一人称の構え（ゲームでは動きの上に重ねているもの）

クリップのほかに、ゲームは入れ物のノードを次のように動かしています。移したいときの参考にしてください。

- **構えの位置**：`vm.fit16x9` は、画面が 16:9、銃を描くカメラの縦の画角が 58° のときの値です。
  - `holder.rotation`：`rotYXZ`（順番は 'YXZ'）
  - `holder.scale`：`scale`
  - 腰だめの位置は `hip`、覗き込みの位置は `ads` です。覗き込むほど `hip` から `ads` へ寄せ、向きには `adsRot` を `[x, y]` で足します。
  - スコープのある銃（Mk2・AWM）は、接眼レンズの中心 `adsEye` が目の前に来るようにします。
  - 覗き込むと、銃のカメラの画角を 58° から 50° にします。
- **反動**：撃った瞬間に `kick` を決めます。
  - ふつうの銃：`kick = clamp(game.recoil / 0.022, 1, 2.2)`
  - 擲弾（M79・MGL）：`kick = 1.6`
  - `kick` は 1 秒に 9 ずつ減らします。
  - 入れ物の z に `kick*0.07` を足し、rotation.x に `kick*0.22` を足します。
- **持ち替え**：`equip` を 1 から始めて、1 秒に 2.2 ずつ減らします。
  - 入れ物の y から `equip*0.35` を引き、rotation.x から `equip*0.6` を引きます。
- **揺れ**：マウスで横に `sway` 動かすと、rotation.y に `sway*1.5`、rotation.z に `sway*1.2` を足します。歩くと上下左右に少し揺れます。
- ゲームでは、一番上のノードの角度を、構えの角度に足し合わせています（オイラー角 YXZ）。このファイルでは、回していない銃を基準にした回転になっています。入れ物の中で回るので、ほんの少しだけ違いますが、見て分かるほどではありません。
