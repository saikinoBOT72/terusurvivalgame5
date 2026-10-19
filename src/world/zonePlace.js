// 区域ごとに決まった数だけ、物を置く場所を選ぶ（docs/rules/islands.md「資源の量」）
// want: { 区域の字: 数 }（数は islandMap.js の counts）。ok(x, z, t): そこに置けるか（平らさ・まわりの物）
// gap: 選んだ場所どうしの最小の間（m）。weight(x, z): 選ばれやすさ（森の濃さで木をかためるなど。なければ同じ）
import { ISLAND } from './islandGen.js';

export function pickSpots({ r, terrain, gen, want, ok, gap = 2, weight = null }) {
  const half = ISLAND / 2, cand = [];
  for (let tz = 0; tz < ISLAND; tz++) for (let tx = 0; tx < ISLAND; tx++) {
    const zone = gen.tileZone(tx, tz);
    if (!want[zone]) continue;
    const x = -half + tx + 0.2 + r() * 0.6, z = -half + tz + 0.2 + r() * 0.6;
    if (gen.inSpot(x, z)) continue; // スポットの中は、スポットの物だけ（islands.md「スポット」）
    const w = weight ? Math.max(1e-3, weight(x, z)) : 1;
    cand.push({ x, z, zone, key: -Math.log(1 - r()) / w }); // 重みつきで、ばらばらの順に並べる
  }
  cand.sort((a, b) => a.key - b.key);
  const left = { ...want }, out = [];
  for (const c of cand) {
    if (!left[c.zone]) continue;
    if (out.some((o) => Math.hypot(o.x - c.x, o.z - c.z) < gap)) continue;
    const t = terrain.tileAt(c.x, c.z);
    if (!t || !ok(c.x, c.z, t)) continue;
    out.push(c);
    left[c.zone]--;
  }
  return out;
}
