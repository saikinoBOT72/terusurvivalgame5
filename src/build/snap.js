// パーツごとの吸い付き方（docs/rules/building.md）
// hit: 照準の先 {part?, point}、ctx: {world, st, rot, level}
import { PARTS, localShapes, WALL_H } from './parts.js';
import { G, SQRT2, snap, angleOf, rotOfDir, edgesOf, makeShape } from './grid.js';
import { keyName } from '../input/keymap.js';
import { machineTarget } from '../automation/place.js';
import { faceTarget } from './faceSnap.js';

// 1m 四方の足元の地面の、一番高い所
export function groundMax(world, x, z) {
  const h = world.terrain.heightAt;
  return Math.max(...[[0, 0], [-0.49, -0.49], [0.49, -0.49], [0.49, 0.49], [-0.49, 0.49]].map(([a, b]) => h(x + a, z + b)));
}

// 照準に一番近い辺（test に合う辺だけ）
function nearestEdge(part, point, test = () => true) {
  let best = null, bd = Infinity;
  for (const e of edgesOf(part.shapes[0])) {
    const d = e.dist(point.x, point.z);
    if (test(e) && d < bd) { bd = d; best = e; }
  }
  return best;
}
const isLen = (len) => (e) => Math.abs(e.len - len) < 0.01;
const clean = (p) => ({ x: snap(p.x), y: p.y, z: snap(p.z) });

function floorTarget(type, h, { world, st, rot, level }) {
  if (h.part && !PARTS[h.part.type].floor) return null;
  let pos, r = rot;
  if (h.part) {
    const e = nearestEdge(h.part, h.point);
    if (isLen(SQRT2)(e)) { // 斜めの辺には、同じマスの反対向きの三角の床だけが合う
      if (type !== 'triangle') return null;
      pos = { ...h.part.pos };
      r = (h.part.rot + 4) % 8;
    } else { // 辺をはさんだ隣のマス
      pos = clean({ x: e.mid[0] + e.n[0] * 0.5, y: h.part.pos.y, z: e.mid[1] + e.n[1] * 0.5 });
    }
  } else { // 地面: 格子に合わせ、上面を地面の一番高い所から level 段上に
    const x = snap(h.point.x), z = snap(h.point.z);
    pos = { x, y: (Math.ceil(groundMax(world, x, z) / G - 1e-6) + level) * G, z };
  }
  const above = groundMax(world, pos.x, pos.z) <= pos.y + 0.001; // 地面に埋まらない
  return { type, pos, rot: r, ok: above && st.canPlace(type, pos, r), why: above ? null : `地面に埋まる（${keyName('buildUp')} で高く）` };
}

// マップ作りの平らな地面は土台と同じ: 照準のマスに見えない土台があるとする（壁・柱が辺や角に吸い付く）
function groundFloor(world, p) {
  if (!world.mapMaker) return null;
  const x = snap(p.x), z = snap(p.z), y = world.terrain.heightAt(x, z);
  const flat = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].every(([a, b]) => Math.abs(world.terrain.heightAt(x + a * 0.98, z + b * 0.98) - y) < 0.001);
  if (!flat || Math.abs(p.y - y) > 0.05) return null;
  const pos = { x, y, z };
  return { type: 'foundation', pos, rot: 0, shapes: [makeShape(localShapes(PARTS.foundation)[0], pos, 0)] };
}

function wallTarget(type, h, { world, st, rot }) {
  if (type === 'wall' && rot % 2) type = 'diagWall'; // 壁を R で 45 度回すと斜めの壁
  const pd = h.part && PARTS[h.part.type];
  if (pd?.edge) { // 壁の上に壁: 同じ向きで上端に積む（辺の長さが同じ物だけ）
    if (type === 'wall' || type === 'diagWall') type = pd.edge === SQRT2 ? 'diagWall' : 'wall';
    if (PARTS[type].edge !== pd.edge) return null;
    const pos = { ...h.part.pos, y: Math.max(...h.part.shapes.map((S) => S.y1)) };
    return { type, pos, rot: h.part.rot, ok: st.canPlace(type, pos, h.part.rot) };
  }
  if (!h.part) h = { ...h, part: groundFloor(world, h.point) };
  const def = PARTS[type];
  if (!h.part || !PARTS[h.part.type].floor) return null;
  const e = nearestEdge(h.part, h.point, isLen(def.edge === SQRT2 ? SQRT2 : 1));
  if (!e) return null;
  let p = e.mid;
  if (def.edge === 'half') { // 照準が辺の前半なら始点から、後半なら中点から
    const t = (h.point.x - e.mid[0]) * e.dir[0] + (h.point.z - e.mid[1]) * e.dir[1];
    p = t < 0 ? e.a : e.mid;
  }
  const pos = clean({ x: p[0], y: h.part.pos.y, z: p[1] }), r = rotOfDir(e.dir[0], e.dir[1]);
  return { type, pos, rot: r, ok: st.canPlace(type, pos, r) };
}

function cornerTarget(type, h, { world, st }) {
  if (!h.part) h = { ...h, part: groundFloor(world, h.point) };
  if (!h.part || !PARTS[h.part.type].floor) return null;
  let best = null, bd = Infinity;
  for (const [x, z] of h.part.shapes[0].pts) {
    const d = Math.hypot(h.point.x - x, h.point.z - z);
    if (d < bd) { bd = d; best = [x, z]; }
  }
  const pos = clean({ x: best[0], y: h.part.pos.y, z: best[1] });
  return { type, pos, rot: 0, ok: st.canPlace(type, pos, 0) };
}

// 上る向き（ローカルの -z）の水平ベクトル と、その向きになる rot
const ascOf = (rot) => { const a = angleOf(rot); return [-Math.sin(a), -Math.cos(a)]; };
const rotOfAsc = (dx, dz) => (((Math.round(Math.atan2(-dx, -dz) / (Math.PI / 4))) % 8) + 8) % 8;
const even = (r) => r - (r % 2);

function stairsTarget(type, h, { world, st, rot }) {
  const rise = PARTS[type].rise;
  let c, bottom, r;
  if (h.part && PARTS[h.part.type].floor) { // 床の辺の隣で、床へ上っていく向き
    const e = nearestEdge(h.part, h.point, isLen(1));
    if (!e) return null;
    c = [e.mid[0] + e.n[0] * 0.5, e.mid[1] + e.n[1] * 0.5];
    bottom = h.part.pos.y - rise;
    r = rotOfAsc(-e.n[0], -e.n[1]);
  } else if (h.part && PARTS[h.part.type].stairs) { // 階段の上か下につなげる
    const p = h.part, d = ascOf(p.rot);
    const up = (h.point.x - p.pos.x) * d[0] + (h.point.z - p.pos.z) * d[1] > 0;
    c = up ? [p.pos.x + d[0], p.pos.z + d[1]] : [p.pos.x - d[0], p.pos.z - d[1]];
    bottom = up ? p.pos.y + PARTS[p.type].rise : p.pos.y - rise;
    r = p.rot;
  } else if (!h.part) { // 地面
    c = [h.point.x, h.point.z];
    bottom = Math.ceil(groundMax(world, snap(c[0]), snap(c[1])) / G - 1e-6) * G;
    r = even(rot);
  } else return null;
  const pos = clean({ x: c[0], y: bottom, z: c[1] });
  const above = groundMax(world, pos.x, pos.z) <= pos.y + 0.26; // 一番下の段は少し埋まってよい
  return { type, pos, rot: r, ok: above && st.canPlace(type, pos, r), why: above ? null : '地面に埋まる' };
}

function roofTarget(type, h, { st, rot, eye }) {
  const p = h.part;
  if (!p) return null;
  const pd = PARTS[p.type];
  let c, y, r;
  if (pd.edge === 1) { // 壁（ドア・窓も）の上: 自分のいる側のマス、壁から離れるほど高く
    const a = angleOf(p.rot), n = [Math.sin(a), Math.cos(a)];
    const side = (eye.x - p.pos.x) * n[0] + (eye.z - p.pos.z) * n[1] > 0 ? 1 : -1;
    c = [p.pos.x + n[0] * side * 0.5, p.pos.z + n[1] * side * 0.5];
    y = p.pos.y + WALL_H;
    r = (rotOfAsc(n[0] * side, n[1] * side) + even(rot)) % 8;
  } else if (pd.corner) { // 柱の上: 角をはさむ4マスのうち自分のいる側
    const sx = Math.sign(eye.x - p.pos.x) || 1, sz = Math.sign(eye.z - p.pos.z) || 1;
    c = [p.pos.x + sx * 0.5, p.pos.z + sz * 0.5];
    y = p.pos.y + WALL_H;
    r = (rotOfAsc(sx, 0) + even(rot)) % 8;
  } else if (pd.roof) { // 屋根の上・下・横につなげる
    const d = ascOf(p.rot), e = nearestEdge(p, h.point), k = e.n[0] * d[0] + e.n[1] * d[1];
    if (k > 0.5) { c = [p.pos.x + d[0], p.pos.z + d[1]]; y = p.pos.y + pd.rise; }
    else if (k < -0.5) { c = [p.pos.x - d[0], p.pos.z - d[1]]; y = p.pos.y - PARTS[type].rise; }
    else { c = [p.pos.x + e.n[0], p.pos.z + e.n[1]]; y = p.pos.y; }
    r = p.rot;
  } else return null;
  const pos = clean({ x: c[0], y, z: c[1] });
  return { type, pos, rot: r, ok: st.canPlace(type, pos, r) };
}

// 床（2 階）: 壁・ドア・窓の上なら自分のいる側のマス、柱の上なら角をはさむ 4 マスのうち自分のいる側、床なら辺の隣。上面は壁の上端
// 壁・柱から 2 マスまで張り出せる（building.md「床（2 階）」）
const MAX_SPAN = 2;
function upperTarget(type, h, { st, eye }) {
  const p = h.part;
  if (!p) return null;
  const pd = PARTS[p.type];
  let c, y = p.pos.y;
  if (pd.edge) {
    const a = angleOf(p.rot), n = [Math.sin(a), Math.cos(a)], side = (eye.x - p.pos.x) * n[0] + (eye.z - p.pos.z) * n[1] > 0 ? 1 : -1;
    c = [p.pos.x + n[0] * side * 0.5, p.pos.z + n[1] * side * 0.5];
    y += WALL_H;
  } else if (pd.corner) {
    c = [p.pos.x + (Math.sign(eye.x - p.pos.x) || 1) * 0.5, p.pos.z + (Math.sign(eye.z - p.pos.z) || 1) * 0.5];
    y += WALL_H;
  } else if (pd.floor) {
    const e = nearestEdge(p, h.point, isLen(1));
    if (!e) return null;
    c = [e.mid[0] + e.n[0] * 0.5, e.mid[1] + e.n[1] * 0.5];
  } else return null;
  const pos = clean({ x: c[0], y, z: c[1] }), span = st.spanAt(type, pos, 0);
  const why = span === Infinity ? '壁・柱の上か床の辺に置く' : span > MAX_SPAN ? `壁・柱から ${MAX_SPAN} マスまで` : null;
  return { type, pos, rot: 0, ok: !why && st.canPlace(type, pos, 0), why };
}

// 家具: 床の上（上面にのせる）か地面。地面では足元の高さの差が 0.3m までで、低い側に合わせて少し埋める
function furnitureTarget(type, h, { world, st, rot }) {
  if (h.part && !PARTS[h.part.type].floor) return null;
  if (PARTS[type].onRaft && !(h.part && PARTS[h.part.type].raft)) { // 帆・舵はいかだの床（コアも）の上にだけ
    const x = snap(h.point.x), z = snap(h.point.z);
    return { type, pos: { x, y: h.part ? h.part.pos.y : h.point.y, z }, rot, ok: false, why: 'いかだの床の上に置く' };
  }
  const x = snap(h.point.x), z = snap(h.point.z);
  if (h.part) {
    const pos = { x, y: h.part.pos.y, z };
    return { type, pos, rot, ok: st.canPlace(type, pos, rot) };
  }
  const S = makeShape(localShapes(PARTS[type])[0], { x, y: 0, z }, rot);
  const hs = [...S.pts, [x, z]].map(([px, pz]) => world.terrain.heightAt(px, pz));
  const lo = Math.min(...hs), hi = Math.max(...hs);
  const pos = { x, y: lo + (hi - lo) * 0.25, z };
  const why = hi - lo > 0.3 ? '地面がでこぼこ' : lo <= world.terrain.waterLevel ? '水の中には置けない' : null;
  return { type, pos, rot, exactY: true, ok: !why && st.canPlace(type, pos, rot), why };
}

export function findTarget(type, h, ctx) {
  if (!h) return null;
  const def = PARTS[type], T = ctx.world.terrain;
  // 洞窟の中（頭の上に地形がある所）には建てられない（terrain.md「洞窟」）
  if (ctx.world.inCave?.(h.point.x, h.point.z) && T.underRock(h.point.x, h.point.y + 0.2, h.point.z)) return { type, pos: { ...h.point }, rot: ctx.rot, ok: false, why: '洞窟の中には建てられない' };
  if (def.face) return faceTarget(type, h, ctx); // マップ作りのブロック・光る物（faceSnap.js）
  if (def.machine) return machineTarget(type, h, ctx); // 機械・ベルト（automation/place.js）
  if (def.furniture) { const t = furnitureTarget(type, h, ctx); if (t) return t; }
  if (def.upper) return upperTarget(type, h, ctx) ?? { type, pos: { ...h.point }, rot: ctx.rot, ok: false, why: '壁・柱の上か床の辺に置く' };
  if (def.floor) return floorTarget(type, h, ctx);
  if (def.stairs) return stairsTarget(type, h, ctx);
  const t = def.edge ? wallTarget(type, h, ctx) : def.corner ? cornerTarget(type, h, ctx) : def.roof ? roofTarget(type, h, ctx) : null;
  if (t) return t;
  // 置ける場所を見ていないときは、照準の先に赤で出す。どこに置くかを理由に出す
  const x = snap(h.point.x), z = snap(h.point.z);
  const why = def.edge ? '床の辺に置く' : def.corner ? '床の角に置く' : def.roof ? '壁か柱の上に置く' : def.upper ? '壁・柱の上か床の辺に置く' : '置けない場所';
  return { type, pos: { x, y: ctx.world.terrain.heightAt(x, z), z }, rot: ctx.rot, ok: false, why };
}
