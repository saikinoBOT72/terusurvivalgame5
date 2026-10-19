// 群れ（enemies.md「ガラクタ犬」の群れ）: 加勢・役（正面 / 回り込み）・挟み撃ち・交代。表の pack があれば使う
// pack: { call 加勢に来る m, flank: [回り込みで待つ距離 m（3〜5 秒ごとに選び直す）], gap 正面の放出のあと回り込みが攻めてよい秒, max 同時にためる数, wait これだけ待っても正面が攻めなければ回り込みも攻める秒 }
const BUSY = new Set(['stagger', 'flinch', 'rest']); // 正面を代わる状態（隙・のけぞり・休み）

const mates = (m, list) => list.filter((o) => o.kind === m.kind && o.state !== 'down' && o.aware === 'fight');

// 戦いはじめた・叩かれた: まわりの同じ種類が「！」で来る（寝ていても起きる）
export function callPack(m, list) {
  const P = m.def.pack;
  if (!P) return;
  for (const o of list) {
    if (o === m || o.kind !== m.kind || o.state === 'down' || o.aware === 'fight') continue;
    if (Math.hypot(o.x - m.x, o.z - m.z) > P.call) continue;
    o.asleep = false; o.aware = 'fight'; o.alertT = 1; o.state = 'chase'; o.t = 0;
    o.model.setPose('move');
  }
}

// 役を決める。正面: プレイヤーにいちばん近い、隙・休みでない犬（みんな隙なら一番近い犬）。ほかは回り込み（左右に順に散る）
export function packRole(m, list, p) {
  const all = mates(m, list);
  if (all.length < 2) { m.role = 'front'; m.flankSlot = 0; return null; }
  const d = (o) => Math.hypot(o.x - p.x, o.z - p.z);
  const ready = all.filter((o) => !BUSY.has(o.state));
  const front = (ready.length ? ready : all).reduce((a, b) => (d(b) < d(a) ? b : a));
  m.role = m === front ? 'front' : 'flank';
  const flanks = all.filter((o) => o !== front).sort((a, b) => (a.packId ??= Math.random()) - (b.packId ??= Math.random()));
  m.flankSlot = flanks.indexOf(m);
  return front;
}

// 攻撃してよいか（挟み撃ち）: 同時にためるのは max まで。回り込みは、正面の放出の gap 秒あとから（正面が wait 秒攻めなければいつでも）
export function packMayAttack(m, list, front) {
  const P = m.def.pack;
  if (!P || !front) return true;
  if (mates(m, list).filter((o) => o !== m && o.state === 'windup').length >= P.max) return false;
  if (m.role === 'front') return true;
  const since = front.sinceRel ?? Infinity;
  return (since >= P.gap && since < P.gap + 1.5) || (m.flankWait ?? 0) > P.wait;
}

// 回り込みの犬の行き先: 正面の犬の反対側（プレイヤーの背中側）から、順に左右へ散る。距離は flank の中
export function flankSpot(m, front, p, dt) {
  const P = m.def.pack;
  const base = Math.atan2(front.x - p.x, front.z - p.z) + Math.PI; // 正面の犬の反対側
  const k = m.flankSlot ?? 0, side = k % 2 ? -1 : 1;
  const a = base + side * (0.5 + Math.floor(k / 2) * 0.6);
  if ((m.flankT = (m.flankT ?? 0) - dt) <= 0) { m.flankR = P.flank[0] + Math.random() * (P.flank[1] - P.flank[0]); m.flankT = 3 + Math.random() * 2; } // 待つ距離を 3〜5 秒ごとに選び直す
  return { x: p.x + Math.sin(a) * m.flankR, z: p.z + Math.cos(a) * m.flankR };
}
