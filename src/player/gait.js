// 動き方（docs/rules/player.md「動き方」「泳ぐ」）: 走る・歩く・忍び足・しゃがみの数字の表と、敵の気づきへ渡す値
// back: 後ろでも気づく距離（m）、sight: 前の見える距離の倍率、secs: 「？」→「！」の秒、bob: 手の揺れの大きさ・速さ
export const GAIT = {
  run: { speed: 2.6, back: 6, sight: 1, secs: 2, bob: 1.3 },
  walk: { speed: 1.9, back: 3, sight: 1, secs: 2, bob: 1 },
  sneak: { speed: 1.3, back: 1, sight: 0.6, secs: 3, bob: 0.6 },
  crouch: { speed: 1, back: 2, sight: 0.8, secs: 2, bob: 0.5 },
};
export const SWIM = { speed: 1.45, fast: 2.15, up: 1.8, down: 1.5, sink: 0.3 }; // 泳ぐ速さ・速く泳ぐ・Space で上へ・潜る・スタミナ 0 で沈む（m/秒）
// スタミナ（1 秒に使う量。戻る・戻らないは combat/playerCombat.js）
export const COST = { run: 6, swim: 4, float: 1.5, swimFast: 10, resume: 20 }; // resume: 走れなくなったあと、これだけたまるまで走れない
export const EYE_CROUCH = 0.55, HEAD_CROUCH = 0.7, CROUCH_SECS = 0.15; // しゃがんだときの目・頭の高さ（立っているときは firstPerson.js の BODY から）

// 敵に気づかれやすさ: 後ろの距離・前の倍率・「！」までの秒（止まっていれば後ろは 1m まで。立っていても）
export function awareness(p) {
  const g = GAIT[p.gait] ?? GAIT.walk;
  return { back: p.moving ? g.back : Math.min(g.back, GAIT.sneak.back), sight: g.sight, secs: g.secs };
}
