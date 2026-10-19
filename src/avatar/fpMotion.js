// 1人称の手の動きの表（docs/rules/weapons.md「武器の動きと演出」）
// ポーズは 12 個の数: 右手 [x, y, z, 回転 x, y, z]、左手 [x, y, z, 回転 x, y, z]。どれも構えの位置からのずれ（m・ラジアン）
// 右手の回転 x が + で道具の頭が後ろ（振りかぶる）、y が + で左を向く、z が + で頭が左へ傾く。位置 z が + で手前
import { ITEMS, HAND } from '../survival/items.js';

const N = 12;
export const pose0 = () => new Float32Array(N);
const P = (r = [], l = []) => { const p = pose0(); r.forEach((v, i) => (p[i] = v)); l.forEach((v, i) => (p[6 + i] = v)); return p; };

// 振り方ごと: w 構えの終わり・s 振りの終わり（当たる所）の割合。up/hit 構え・振り。heavy はため攻撃。alt は続けて振ったとき（交互）
// ため攻撃は構え（heavy.up）を飛ばして s で当たる
export const MOTIONS = {
  // 斧・ピッケル: 右上へ振りかぶり、左下へ斜めに振り下ろす。ため攻撃は頭の上まで振りかぶって真下へ
  chop: {
    w: 0.3, s: 0.425, trail: true,
    up: P([-0.06, 0.15, 0, 0.65, -0.05, -0.08], [0.03, -0.02, 0.02]),
    hit: P([-0.24, -0.08, -0.06, -0.6, 0.25, 0.55], [-0.02, -0.04, -0.02]),
    heavy: {
      up: P([-0.1, 0.24, 0.1, 1.55, 0.05, -0.05], [0.06, -0.04, 0.04]),
      hit: P([-0.13, -0.22, -0.14, -1.0, 0.1, 0.15], [-0.03, -0.06, -0.04]),
    },
  },
  // やり: 後ろへ引いて一気に突き出す。続けて突くと左右へ角度を変える。ため攻撃は大きく引いて、両手ごと前へ
  thrust: {
    w: 0.3, s: 0.42, trail: true,
    up: P([0.02, 0.01, 0.15, 0.1, -0.04, 0]),
    hit: P([-0.05, 0.03, -0.33, -0.08, 0.1, -0.05]),
    alt: { up: P([0.03, 0.02, 0.15, 0.12, 0.05, 0.08]), hit: P([0.0, 0.05, -0.33, -0.05, -0.12, 0.12]) },
    heavy: {
      up: P([0.06, -0.03, 0.25, 0.16, -0.08, 0], [0.04, -0.03, 0.12]),
      hit: P([-0.08, 0.03, -0.5, -0.1, 0.12, 0], [0.12, 0.04, -0.22]),
    },
  },
  // ナイフ（剣の代わり）: 刃を寝かせて横なぎ（右 → 左）と返し（左 → 右）を交互に。速い
  slash: {
    w: 0.25, s: 0.4, trail: true,
    up: P([0.08, 0.14, -0.04, 0.1, -0.65, 1.2]),
    hit: P([-0.3, 0.1, -0.14, -0.05, 0.95, 1.3], [0.02, -0.03]),
    alt: { up: P([-0.27, 0.14, -0.06, 0.15, 0.85, 1.25]), hit: P([0.12, 0.1, -0.12, -0.05, -0.6, 1.15]) },
    heavy: {
      up: P([0.16, 0.15, 0.02, 0.15, -0.95, 1.1], [0.03, -0.02]),
      hit: P([-0.36, 0.1, -0.18, -0.05, 1.15, 1.35], [0.04, -0.05]),
    },
  },
  // 素手: 左右の手で交互にまっすぐパンチ（alt は左手）
  punch: {
    w: 0.25, s: 0.4, trail: false,
    up: P([0.01, -0.01, 0.05, 0.1]),
    hit: P([-0.22, 0.08, -0.25, -0.2, 0.2]),
    alt: { up: P([], [-0.01, -0.01, 0.05, 0.1]), hit: P([], [0.22, 0.08, -0.25, -0.2, -0.2]) },
    heavy: {
      up: P([0.05, -0.04, 0.13, 0.2], [0.02, 0, -0.03]),
      hit: P([-0.24, 0.08, -0.33, -0.25, 0.25], [0.03, -0.03, 0.04]),
    },
  },
  // スリング: 引いた所（ため）から前へ振り出す
  fling: {
    w: 0, s: 0.35, trail: false,
    up: P([-0.05, -0.01, 0.09, 0.5, 0.05, 0.1]), // 引ききった所（手前へ倒して引く。画面から出ないように）
    hit: P([-0.05, 0.07, -0.18, -0.7]),
  },
};
MOTIONS.fling.heavy = { up: MOTIONS.fling.up, hit: MOTIONS.fling.hit };

// 手に持つ物 → 振り方と重さ（stam 12 で 1）
export function weaponMotion(id) {
  const it = id ? ITEMS[id] : null, tool = it?.tool;
  const kind = !id ? 'punch' : tool === 'spear' ? 'thrust' : tool === 'knife' ? 'slash' : tool === 'gun' ? 'gun' : tool === 'sling' || it?.ranged ? 'sling' : 'chop';
  return { kind, weight: Math.min(1.2, (it?.stam ?? HAND.stam) / 12) };
}

const ease = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - (1 - t) ** 3;
const mix = (out, a, b, k) => { for (let i = 0; i < N; i++) out[i] = a[i] + (b[i] - a[i]) * k; return out; };
const REST = pose0();

// u（0〜1）の時のポーズ。構え: ゆっくり入って一瞬止まる（グッ）→ 振り: 速く出て止まる（バッ）→ 戻り: ゆっくり
export function swingPose(kind, u, heavy, alt, out) {
  const M = MOTIONS[kind], K = heavy ? M.heavy : alt && M.alt ? M.alt : M;
  if (u < M.w) return mix(out, REST, K.up, ease(Math.min(1, u / (M.w * 0.85))));
  if (u < M.s) return mix(out, K.up, K.hit, easeOut((u - M.w) / (M.s - M.w)));
  return mix(out, K.hit, REST, ease((u - M.s) / (1 - M.s)));
}
// ため（0〜1）: ため攻撃の構えへ少しずつ入る
export const chargePose = (kind, k, out) => mix(out, REST, MOTIONS[kind].heavy.up, ease(k));
// 振りの向き（構え → 振り）。当てたら逆へ跳ね返り、外したら振り抜ける
export const strikeDir = (kind, heavy, alt, out) => { const M = MOTIONS[kind], K = heavy ? M.heavy : alt && M.alt ? M.alt : M; for (let i = 0; i < N; i++) out[i] = K.hit[i] - K.up[i]; return out; };
