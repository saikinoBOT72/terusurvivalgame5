// 電気の網（automation.md「電気」）: 電線でつながった物を 1 つの網にして、出す量と使う量を足す
// 使う量 ≦ 出す量なら網の機械が全部動き、＞ なら全部止まる。純粋な計算だけ（形・時間は machines.js）
// gen(p): その物が出す量、use(p): いま使う量（仕事がある機械だけ）。戻り値の網は { parts, gen, use, ok, running }
// 各 part に p.net（つながっていなければ null）を入れる
export function solveNets(parts, wires, gen, use) {
  const parent = new Map();
  const find = (a) => {
    while (parent.get(a) !== a) { parent.set(a, parent.get(parent.get(a))); a = parent.get(a); }
    return a;
  };
  for (const w of wires) {
    for (const p of [w.a, w.b]) if (!parent.has(p)) parent.set(p, p);
    parent.set(find(w.a), find(w.b));
  }
  const nets = new Map();
  for (const p of parts) {
    p.net = null;
    if (!parent.has(p)) continue;
    const root = find(p);
    if (!nets.has(root)) nets.set(root, { parts: [], gen: 0, use: 0, ok: true, running: false });
    const n = nets.get(root);
    n.parts.push(p);
    n.gen += gen(p);
    n.use += use(p);
    p.net = n;
  }
  for (const n of nets.values()) { n.ok = n.use <= n.gen; n.running = n.use > 0 && n.ok; }
  return [...nets.values()];
}

// 窓・ヒントに出す短い文
export function netText(p) {
  if (!p.net) return '線がつながっていない';
  const { use, gen, ok } = p.net;
  return ok ? `動いている ⚡使う ${use} / 出す ${gen}` : `電気が足りない ⚡使う ${use} / 出す ${gen}`;
}
