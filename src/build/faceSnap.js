// 面に吸い付く置き方（docs/rules/building.md「コンクリートとマップ作り」段階 2・3）
// h: 照準の先 {part?, point, normal}、ctx: {st, rot}。面と平行な向きは 0.5m の格子（細い物は 0.25m）にそろえる
import { PARTS } from './parts.js';
import { G, Q, circleHitsShape } from './grid.js';
import { shapesOf } from './structures.js';

// 端を格子に。大きさが 0.5m の倍数でない物は中心を格子に（細い物は 0.25m、ジャンプ台などは 0.5m）
const onGrid = (v, half) => {
  const k = (half * 2) / G;
  if (Math.abs(k - Math.round(k)) > 1e-6) return Math.round(v / (k < 1 ? Q : G)) * (k < 1 ? Q : G);
  return Math.round((v - half) / G) * G + half;
};
const bottomOnGrid = (v, h) => Math.round((v - h / 2) / G) * G; // 横の面: 下端を格子に（真ん中を照準に）
const rotOfNormal = (nx, nz) => ((Math.round(Math.atan2(nx, nz) / (Math.PI / 4)) % 8) + 8) % 8; // 形の +z が面の外を向く向き

// 一番強い向きの軸: ['x'|'y'|'z', 符号]
function axisOf(n) {
  const a = [['x', n.x], ['y', n.y], ['z', n.z]].sort((p, q) => Math.abs(q[1]) - Math.abs(p[1]))[0];
  return [a[0], Math.sign(a[1]) || 1];
}

// 自分の体（目の高さ eye から下 1m、半径 0.3m）と重なるか。大きい箱を自分の上に置かない
const hitsBody = (t, pos, r, eye) => !PARTS[t].noCollide && shapesOf(t, pos, r).some((S) => S.y0 < eye.y + 0.1 && S.y1 > eye.y - 1 && circleHitsShape(eye.x, eye.z, 0.3, S));

export function faceTarget(type, h, { st, rot, eye }) {
  const n = h.normal ?? { x: 0, y: 1, z: 0 }, [ax, sg] = axisOf(n), p = h.point;
  let t = type, r = rot, def = PARTS[t];
  const bad = (why) => ({ type: t, pos: { x: p.x, y: p.y, z: p.z }, rot: r, ok: false, why });
  if (def.face === 'top' && !(ax === 'y' && sg > 0)) return bad('上の面に置く');

  let pos;
  if (def.face === 'surface' && ax !== 'y') { // 横の面に貼る: R で横向き ↔ 縦向き。形の +z を面の外へ
    t = (rot / 2) % 2 && def.up ? def.up : def.side;
    def = PARTS[t];
    r = rotOfNormal(ax === 'x' ? sg : 0, ax === 'z' ? sg : 0);
    const [w, hh] = def.size, along = ax === 'x' ? 'z' : 'x';
    pos = { [ax]: p[ax], y: Math.round(p.y / Q) * Q, [along]: onGrid(p[along], w / 2) };
    if (t.endsWith('V')) pos.y = Math.round((p.y - hh / 2) / G) * G + hh / 2; // 縦向きは端を格子に
  } else {
    const [w, hh, d] = def.size, swap = r % 4 === 2, hx = (swap ? d : w) / 2, hz = (swap ? w : d) / 2;
    if (ax === 'y') pos = { x: onGrid(p.x, hx), y: sg > 0 ? p.y : p.y - hh, z: onGrid(p.z, hz) };
    else if (ax === 'x') pos = { x: p.x + sg * hx, y: bottomOnGrid(p.y, hh), z: onGrid(p.z, hz) };
    else pos = { x: onGrid(p.x, hx), y: bottomOnGrid(p.y, hh), z: p.z + sg * hz };
  }
  if (!h.part) pos.y = Math.round(pos.y / Q) * Q; // 地面: 照準の調べ方の誤差を消す（マップ作りの地面は平ら）
  for (const k of ['x', 'y', 'z']) pos[k] = Math.round(pos[k] * 1000) / 1000; // 面の位置の小さな誤差を消す
  if (eye && hitsBody(t, pos, r, eye)) return { type: t, pos, rot: r, exact: true, ok: false, why: '自分と重なる' };
  return { type: t, pos, rot: r, exact: true, ok: st.canPlace(t, pos, r) };
}
