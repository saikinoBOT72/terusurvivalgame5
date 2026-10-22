// gun-export の glb から動き（クリップ）を読み、作り直しの向き（前が +z・左が +x）に直して JS のデータに書く（weapons.md「銃の仕組み」）
// 使い方: node scripts/gunClips.mjs ak   （guns.json の名前。書く先は src/survival/gunClips/<名前>.js）
// 向き: 位置 (x, y, z) → (−x, y, −z)、回転 (qx, qy, qz, qw) → (−qx, qy, −qz, qw)。まっすぐつなげる点は間引く（ずれ 1mm・0.5° 以内）
import fs from 'fs';

const id = process.argv[2] ?? 'ak';
const info = JSON.parse(fs.readFileSync('gun-export/guns.json', 'utf8'))[id];
const buf = fs.readFileSync(`gun-export/${info.file}`);
const jlen = buf.readUInt32LE(12);
const gl = JSON.parse(buf.subarray(20, 20 + jlen).toString());
const bin = buf.subarray(20 + jlen + 8);
const SIZE = { SCALAR: 1, VEC3: 3, VEC4: 4 };
const acc = (i) => {
  const a = gl.accessors[i], bv = gl.bufferViews[a.bufferView];
  return Array.from(new Float32Array(bin.buffer, bin.byteOffset + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0), a.count * SIZE[a.type]));
};
const flipP = (v) => [-v[0], v[1], -v[2]];
const flipQ = (q) => [-q[0], q[1], -q[2], q[3]];
const round = (v) => v.map((x) => Math.round(x * 1e5) / 1e5 + 0); // +0: -0 を 0 に
const node = (name) => gl.nodes.find((n) => n.name === name);

// ---- 間引き: i から j へまっすぐ（回転は球面で）つないで、間の点がずれなければ間の点を捨てる ----
const lerp = (a, b, u) => a.map((x, k) => x + (b[k] - x) * u);
function slerp(a, b, u) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const bb = d < 0 ? b.map((x) => -x) : b;
  d = Math.abs(d);
  if (d > 0.9995) { const q = lerp(a, bb, u), l = Math.hypot(...q); return q.map((x) => x / l); }
  const th = Math.acos(d), s = Math.sin(th);
  return a.map((x, k) => (Math.sin((1 - u) * th) * x + Math.sin(u * th) * bb[k]) / s);
}
const errP = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const errQ = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3])));
function decimate(times, vals, kind) {
  if (kind === 's') return times.map((t, i) => i).filter((i) => i === 0 || vals[i].some((x, k) => x !== vals[i - 1][k])); // 段の動き: 変わった所だけ
  const tol = kind === 'p' ? 0.001 : 0.5 * Math.PI / 180, err = kind === 'p' ? errP : errQ, mix = kind === 'p' ? lerp : slerp;
  const keep = [0];
  for (let i = 0; i < times.length - 1;) {
    let j = i + 1;
    while (j + 1 < times.length) {
      const jj = j + 1;
      let ok = true;
      for (let k = i + 1; k < jj && ok; k++) ok = err(mix(vals[i], vals[jj], (times[k] - times[i]) / (times[jj] - times[i])), vals[k]) <= tol;
      if (!ok) break;
      j = jj;
    }
    keep.push(j);
    i = j;
  }
  return keep;
}

// ---- 止まっている形（ノードの位置・回転）と、手の位置 ----
const rest = {};
const MOVING = new Set(gl.animations.flatMap((a) => a.channels.map((c) => gl.nodes[c.target.node].name)));
for (const name of MOVING) {
  const n = node(name);
  rest[name] = { p: round(flipP(n.translation ?? [0, 0, 0])), q: round(flipQ(n.rotation ?? [0, 0, 0, 1])) };
}
const handR = node('hand_R'), handL = node('hand_L');
const bboxOf = (n) => { const a = gl.accessors[gl.meshes[n.mesh].primitives[0].attributes.POSITION]; return a.max.map((x, k) => (x - a.min[k]) * (n.scale?.[k] ?? 1)); };
const hands = { R: round(flipP(handR.translation)), L: round(flipP(handL.translation)), size: round(bboxOf(handR)) };

// ---- クリップ ----
const PATH = { translation: 'p', rotation: 'q', scale: 's' };
const clips = {};
let before = 0, after = 0;
for (const an of gl.animations) {
  const tracks = [];
  for (const ch of an.channels) {
    const name = gl.nodes[ch.target.node].name, kind = PATH[ch.target.path], s = an.samplers[ch.sampler];
    const times = acc(s.input), flat = acc(s.output), n = kind === 'q' ? 4 : 3;
    const vals = times.map((_, i) => {
      const v = flat.slice(i * n, i * n + n);
      return kind === 'p' ? flipP(v) : kind === 'q' ? flipQ(v) : v;
    });
    const keep = decimate(times, vals, kind);
    before += times.length; after += keep.length;
    // 流し始めの形が止まっている形と違うと、流した瞬間に部品が飛ぶ: 違いを出しておく
    if (rest[name] && kind !== 's') {
      const d = kind === 'p' ? errP(vals[0], rest[name].p) * 1000 : errQ(vals[0], rest[name].q) * 180 / Math.PI;
      if (d > (kind === 'p' ? 1 : 0.5)) console.log(`  ${an.name} ${name} ${kind}: 始めが止まっている形から ${d.toFixed(1)}${kind === 'p' ? 'mm' : '°'}`);
    }
    tracks.push([name, kind, keep.map((i) => Math.round(times[i] * 1e4) / 1e4), keep.flatMap((i) => round(vals[i]))]);
  }
  const c = info.clips[an.name] ?? {};
  clips[an.name] = { dur: c.dur ?? Math.max(...tracks.map((t) => t[2].at(-1))), events: c.events ?? [], tracks };
}

const vm = info.vm.fit16x9;
const out = `// 自動生成（scripts/gunClips.mjs ${id}）。gun-export/${info.file} の動きを、作り直しの向き（前が +z・左が +x）に直した物。手で直さない
// root: 一番上のノードの名前。rest: 動くノードの止まっている形 { p 位置, q 回転 }。hands: 右手（一番上のノードの中）・左手（lhand の中）の位置と、export の手の大きさ
// vm: 構えの値（README「一人称の構え」。export の向きのまま）。recoil: game.recoil（kick を決める）。clips: { dur, events [[秒, 名前]], tracks [[ノード, p|q|s, 時刻, 値]] }
export default ${JSON.stringify({ id, root: gl.nodes[gl.scenes[0].nodes[0]].name, rest, hands, vm: { rotYXZ: vm.rotYXZ, scale: vm.scale, hip: vm.hip, ads: vm.ads, adsRot: vm.adsRot }, recoil: info.game.recoil, muzzle: round(flipP(info.muzzle)), eject: round(flipP(info.eject)), clips })};
`;
fs.mkdirSync('src/survival/gunClips', { recursive: true });
fs.writeFileSync(`src/survival/gunClips/${id}.js`, out);
console.log(`${id}: 点 ${before} → ${after}、${(out.length / 1024).toFixed(1)}KB`, JSON.stringify(hands), JSON.stringify(rest));
