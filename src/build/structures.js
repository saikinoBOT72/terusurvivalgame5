// 置いた建築パーツの管理: 記録、追加と撤去、支えと連鎖撤去、土台の足、草、当たり判定
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { MAT, rng, pick, shape } from '../style/lowpoly.js';
import { campfire } from '../world/props.js';
import { PARTS, partGeometry, localShapes } from './parts.js';
import { initStation, tickStation } from '../survival/stations.js';
import { initPlanter, tickPlanter } from '../survival/farm.js';
import { createWires } from '../automation/wires.js';
import { createAutomation } from '../automation/machines.js';
import { isBedCollider } from '../automation/place.js';
import { fromI, toI, angleOf, makeShape, shapesOverlap, circleHitsShape } from './grid.js';
import { paintMat, concreteLegGeo, DEFAULT_COLOR } from './concreteParts.js';

// 色を塗れるパーツの材質（building.md「コンクリートとマップ作り」）。ジャンプ台の台はふつうの材質で、光る輪だけ塗る
const matOf = (def, c) => (def.paint === 'concrete' || def.paint === 'glow' ? paintMat(def.paint, c) : MAT.solid);

const LEG = 0.15;      // 足の太さ
const LEG_SINK = 0.15; // 足を地面に埋める深さ
const FURLED = 0.06;   // たたんだ帆の布の長さ（張ったときを 1 として）

export const shapesOf = (type, pos, rot) => localShapes(PARTS[type]).map((l) => Object.assign(makeShape(l, pos, rot), { panel: !!l.panel }));
// 足をつける形（なければ最初の形）
const footOf = (type, pos, rot) => {
  const def = PARTS[type], l = localShapes(def)[0];
  return makeShape({ poly: def.foot || l.poly, y: l.y }, pos, rot);
};

let legGeo = null;
const legGeometry = () => {
  if (!legGeo) {
    const r = rng(5), g = new THREE.BoxGeometry(LEG, 1, LEG);
    g.translate(0, 0.5, 0);
    legGeo = shape(g, () => pick(r, [P.wood[1], P.wood[2]]), r);
    legGeo.computeVertexNormals();
  }
  return legGeo;
};

// world: その世界（terrain、colliders、cover を使う）。changed があれば、パーツが変わるたびに呼ぶ（いかだの物理の形）
export function createStructures(world) {
  const group = new THREE.Group();
  const list = []; // {type, i, rot, pos, shapes, mesh, supportedBy, supports}
  const legs = new Map(); // 角の格子座標 → {x, z, users, mesh, top, bottom}
  const wires = createWires(group); // 電線（automation/wires.js）
  const auto = createAutomation(wires, list); // 機械の動き・ベルト（automation/machines.js）

  const ignores = (a, b) => PARTS[a].ignores?.includes(b) || PARTS[b].ignores?.includes(a);
  const overlaps = (type, mine) => list.some((p) => !ignores(type, p.type) && p.shapes.some((b) => mine.some((S) => shapesOverlap(S, b))));
  // 木の幹・葉や岩と重なるか（てっぺんがパーツの下端より低い物と、下の端がパーツの上端より高い物は除く）
  const hitsNature = (S, machine = false) => world.colliders(S.cx, S.cz, S.radius)
    .some((c) => !(machine && isBedCollider(world, c)) && c.top > S.y0 + 0.01 && (c.bottom ?? -1e9) < S.y1 - 0.01 && circleHitsShape(c.x, c.z, c.r, S));

  function canPlace(type, pos, rot) {
    const mine = shapesOf(type, pos, rot);
    return !overlaps(type, mine) && !mine.some((S) => hitsNature(S, !!PARTS[type].machine));
  }

  // 下で支えるパーツ: 種類が restsOn に入っていて、上面がこのパーツの下端に接しているもの
  // touch のパーツ（屋根）は、下端が支えの高さの範囲内にあり、接しているだけでよい
  function supportersOf(type, S) {
    const def = PARTS[type], on = def.restsOn || [];
    return list.filter((p) => on.includes(p.type) && p.shapes.some((pb) => (def.touch
      ? S.y0 >= pb.y0 - 0.01 && S.y0 <= pb.y1 + 0.01 && shapesOverlap({ ...S, y1: S.y0 + 0.02 }, { ...pb, y0: S.y0 - 0.02, y1: S.y0 + 0.03 }, -0.01)
      : Math.abs(pb.y1 - S.y0) < 0.01 && shapesOverlap(S, { ...pb, y1: pb.y1 + 0.05 }, 0.02))));
  }

  // 床（2 階）の張り出し: 壁・柱などに直接のっていれば 0、床だけに支えられていれば その床 + 1（なければ Infinity）
  const spanOf = (sup) => Math.min(...sup.map((s) => (PARTS[s.type].upper ? (s.span ?? 0) + 1 : 0)), Infinity);
  const spanAt = (type, pos, rot) => spanOf(supportersOf(type, shapesOf(type, pos, rot)[0]));

  // ---- 土台の足 ----
  function refreshLeg(key) {
    const leg = legs.get(key);
    if (!leg.users.size) { group.remove(leg.mesh); legs.delete(key); return; }
    leg.top = Math.max(...[...leg.users].map((u) => u.foot.y0));
    leg.bottom = world.terrain.heightAt(leg.x, leg.z) - LEG_SINK;
    leg.mesh.visible = leg.top - leg.bottom > LEG_SINK + 0.05;
    const conc = [...leg.users].every((u) => PARTS[u.type].map); // マップ作りの物（コンクリートの土台・スロープ）だけなら、コンクリートの足
    leg.mesh.geometry = conc ? concreteLegGeo() : legGeometry();
    leg.mesh.material = conc ? paintMat('concrete', 2) : MAT.solid;
    leg.mesh.position.set(leg.x, leg.bottom, leg.z);
    leg.mesh.scale.y = Math.max(0.01, leg.top - leg.bottom);
  }
  function useLegs(part, add) {
    for (const [x, z] of part.foot.pts) { // 床の角ごとに1本
      const key = `${toI(x)},${toI(z)}`;
      if (!legs.has(key)) {
        if (!add) continue;
        const mesh = new THREE.Mesh(legGeometry(), MAT.solid);
        mesh.castShadow = mesh.receiveShadow = true;
        group.add(mesh);
        legs.set(key, { x: fromI(toI(x)), z: fromI(toI(z)), users: new Set(), mesh });
      }
      legs.get(key).users[add ? 'add' : 'delete'](part);
      refreshLeg(key);
    }
  }

  // y: 格子にそろわない高さ（地面に置く家具）。c: 色の見本の番号（塗れるパーツだけ）
  function add(type, i, rot, { y, c = DEFAULT_COLOR } = {}) {
    const pos = { x: fromI(i.x), y: y ?? fromI(i.y), z: fromI(i.z) };
    const def = PARTS[type];
    const mesh = new THREE.Mesh(partGeometry(type, def.frame ? 'frame' : 'build'), matOf(def, c));
    mesh.position.set(pos.x, pos.y, pos.z);
    mesh.rotation.y = angleOf(rot);
    mesh.castShadow = mesh.receiveShadow = true;
    const shapes = shapesOf(type, pos, rot);
    const part = { type, i, rot, pos, shapes, foot: footOf(type, pos, rot), mesh, supportedBy: new Set(supportersOf(type, shapes[0])), supports: new Set() };
    if (def.upper) part.span = spanOf([...part.supportedBy]);
    for (const s of part.supportedBy) s.supports.add(part);
    mesh.userData.part = part;
    if (def.panel) { // ドアの扉: 蝶番を軸に回る
      const pm = new THREE.Mesh(partGeometry(type, 'panel'), MAT.solid);
      pm.castShadow = pm.receiveShadow = true;
      pm.userData.part = part;
      part.panel = new THREE.Group();
      part.panel.position.set(def.hinge, def.hingeY ?? 0, 0);
      part.panel.add(pm);
      mesh.add(part.panel);
      part.open = false;
      if (def.sail) part.panel.scale.y = FURLED; // 帆はたたんで置く
    }
    if (y !== undefined) part.y = y; // 記録用
    if (def.paint) part.c = c;
    if (def.glow) { // 光る輪（ジャンプ台）
      part.glow = new THREE.Mesh(partGeometry(type, 'glow'), paintMat('glow', c));
      part.glow.userData.part = part;
      mesh.add(part.glow);
    }
    if (def.fire) { part.fire = campfire(rng(list.length + 3), { base: false }); mesh.add(part.fire.root); }
    if (def.store) part.store = Array(def.store).fill(null); // チェストの中身
    if (def.planter) initPlanter(part); // 畑（farm.js）
    initStation(part, def); // 設備の中身（stations.js。チェストは store をそのまま使う）
    if (def.machine) auto.init(part, world); // 動く部分・ドリルの鉱床
    group.add(mesh);
    list.push(part);
    auto.touch();
    if (PARTS[type].grounded) { useLegs(part, true); world.cover?.(shapes, 1); }
    world.changed?.();
    return part;
  }

  // 撤去: 支えがなくなった上のパーツも連鎖して撤去する。撤去したパーツの一覧を返す
  function remove(part, out = []) {
    if (!list.includes(part)) return out;
    out.push(part);
    group.remove(part.mesh);
    list.splice(list.indexOf(part), 1);
    part.wireRefund = wires.removeFor(part); // 線も外れて銅線が戻る
    auto.touch();
    for (const s of part.supportedBy) s.supports.delete(part);
    if (PARTS[part.type].grounded) { useLegs(part, false); world.cover?.(part.shapes, -1); }
    for (const up of [...part.supports]) {
      up.supportedBy.delete(part);
      if (!up.supportedBy.size && !PARTS[up.type].grounded) remove(up, out);
    }
    world.changed?.();
    return out;
  }

  // 撤去したら消えるパーツ（実際には消さない。撤去の目印用）: part と、支えが全部なくなる上のパーツ
  function chainOf(part, out = new Set()) {
    out.add(part);
    for (const up of part.supports) {
      if (!out.has(up) && !PARTS[up.type].grounded && [...up.supportedBy].every((s) => out.has(s))) chainOf(up, out);
    }
    return out;
  }

  // 当たり判定: (x, z) の半径 r と重なる形と足を {top, bottom} で返す
  function query(x, z, r) {
    const out = [];
    for (const p of list) {
      if (PARTS[p.type].noCollide) continue;
      for (const b of p.shapes) if (!(b.panel && p.open) && circleHitsShape(x, z, r, b)) out.push({ top: b.y1, bottom: b.y0 });
    }
    for (const leg of legs.values()) {
      if (leg.mesh.visible && Math.hypot(x - leg.x, z - leg.z) < r + LEG / 2) out.push({ top: leg.top, bottom: leg.bottom });
    }
    return out;
  }

  // 物理用: (x, z) の半径 r と重なる形（pts・y0・y1）と足（x・z・top・bottom・w）。同じ物は同じオブジェクトを返す
  function solids(x, z, r) {
    const out = [];
    for (const p of list) {
      if (PARTS[p.type].noCollide) continue;
      for (const b of p.shapes) if (!(b.panel && p.open) && circleHitsShape(x, z, r, b)) out.push(b);
    }
    for (const leg of legs.values()) {
      if (leg.mesh.visible && Math.hypot(x - leg.x, z - leg.z) < r + LEG / 2) { leg.w = LEG; out.push(leg); }
    }
    return out;
  }

  // 色を塗る（塗れるパーツだけ）
  function setColor(part, c) {
    const def = PARTS[part.type];
    if (!def.paint || part.c === c) return false;
    part.c = c;
    part.mesh.material = matOf(def, c);
    if (part.glow) part.glow.material = paintMat('glow', c);
    world.changed?.();
    return true;
  }

  // ドアの開け閉め
  function toggle(part) {
    if (!part.panel) return false;
    part.open = !part.open;
    world.changed?.();
    return true;
  }
  // 炎を揺らし、扉をなめらかに回す。run: 遊んでいる間だけ true（設備の時間はこのときだけ進む）
  let time = 0;
  function update(dt, run = true) {
    time += dt;
    auto.animate(dt);
    if (run) auto.tick(dt);
    for (const p of list) {
      if (p.fire) p.fire.update(time);
      if (run) { if (!PARTS[p.type].machine) tickStation(p, dt); if (p.type === 'planter') tickPlanter(p, dt); }
      if (!p.panel) continue;
      if (PARTS[p.type].sail) { // 帆: 張ると下へのび、たたむと上の横木へ巻き上がる
        p.panel.scale.y += ((p.open ? 1 : FURLED) - p.panel.scale.y) * Math.min(1, dt * 4);
        continue;
      }
      const to = p.open ? -Math.PI / 2 : 0;
      p.panel.rotation.y += (to - p.panel.rotation.y) * Math.min(1, dt * 10);
    }
  }

  return { group, list, wires, auto, canPlace, spanAt, add, remove, chainOf, query, solids, toggle, setColor, update };
}
