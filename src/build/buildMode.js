// 建築モード（docs/rules/building.md、ui.md「建築の操作」）: ハンマーを持つと、選んでいるパーツのプレビューがいつも出る
// 持った直後は撤去（左クリックで撤去、ホイールは持ち替え）、右クリック 建築メニュー（controls.js）で選ぶと置く状態
// 置く状態: 左クリック 置く、ホイールか「回す」のキー、「高く」「低く」のキーで土台の高さ（input/keymap.js）
// どこに吸い付くかは snap.js が決める。置けないときは理由（why）を出す
import * as THREE from 'three';
import { PARTS, PART_LIST, COSTS, partGeometry, PREVIEW_MAT } from './parts.js';
import { toI, angleOf, snap } from './grid.js';
import { findTarget } from './snap.js';
import { createArrow, arrowYaw, createRemoveMarks, createPortArrows } from './buildMarks.js';
import { pressed } from '../input/keymap.js';
import { playing } from '../input/touch.js';

const REACH = 6;      // 届く距離（m）
const MAX_LEVEL = 4;  // 土台の高さの段階（0〜4 段 = 0〜2m）
export const REMOVE = -1; // メニューの「撤去」
const DECK = [[0, 0], [-0.45, -0.45], [0.45, -0.45], [0.45, 0.45], [-0.45, 0.45]]; // いかだの上の土台・階段の足元（甲板の上か調べる点）

// canPay(type): 素材が足りるか。onPlaced(type) / onRemoved([part…]): 素材を減らす・戻す。onBreak(乗り物): いかだのコアを撤去した（バラバラになる）
// onSwing(撤去か): 置く・撤去するときの腕の動き。swinging(): 腕を振っている最中か（撤去は振り終わるまで次ができない）
export function createBuildMode({ camera, dom, canPay = () => true, onPlaced = () => {}, onRemoved = () => {}, onBreak = () => {}, onWire = () => {}, onSwing = () => {}, swinging = () => false }) {
  let enabled = false, hammer = false, sel = 0, rot = 0, level = 1, world = null, st = null, target = null, removing = null;
  const ray = new THREE.Raycaster();
  ray.far = REACH;
  const preview = new THREE.Mesh(partGeometry(PART_LIST[0]), PREVIEW_MAT.ok);
  preview.visible = false;
  preview.renderOrder = 2;
  const arrow = createArrow();
  preview.add(arrow);
  const portArrows = createPortArrows(); // 機械の入れる口・出す口の矢印
  preview.add(portArrows.group);
  const marks = createRemoveMarks();
  const type = () => PART_LIST[sel];
  const active = () => enabled && hammer;

  // 地面との交点（照準の線を少しずつ進めて調べる）
  function terrainHit(o, d) {
    const T = world.terrain, p = (t) => [o.x + d.x * t, o.y + d.y * t, o.z + d.z * t], solid = (q) => (T.solidAt ? T.solidAt(...q) : q[1] <= T.heightAt(q[0], q[2]));
    for (let t = 0.1; t <= REACH; t += 0.05) {
      if (!solid(p(t))) continue;
      let lo = t - 0.05, hi = t;
      for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2; if (solid(p(m))) hi = m; else lo = m; }
      return { distance: hi, point: new THREE.Vector3(...p(hi)) };
    }
    return null;
  }

  // 照準の先: パーツ {part, point, v} か地面 {point}。地面とほぼ同じ距離ならパーツを優先（板のすき間対策）
  // v: パーツが乗り物（いかだ）のものなら、その乗り物。water: 水面も調べる（いかだ・小舟）→ {point, water: true}
  function aim(water = false) {
    camera.updateMatrixWorld();
    ray.setFromCamera({ x: 0, y: 0 }, camera);
    const vs = world.vehicles?.list ?? [];
    const groups = [st.group, ...vs.map((v) => v.st.group)].flatMap((g) => g.children);
    const ph = ray.intersectObjects(groups, true).find((x) => x.object.userData.part || (active() && sel === REMOVE && x.object.userData.wire)); // 電線は撤去の状態のときだけ狙える（機械の上の碍子で、機械の右クリックを邪魔しない）
    const o = ray.ray.origin, d = ray.ray.direction, th = terrainHit(o, d);
    if (ph && (!th || ph.distance <= th.distance + 0.3)) {
      const part = ph.object.userData.part;
      if (!part) return { wire: ph.object.userData.wire, point: ph.point }; // 電線（automation/wires.js）
      return { part, point: ph.point, v: world.vehicles?.owner(part) ?? null };
    }
    const tw = water && d.y < 0 ? (world.terrain.waterLevel - o.y) / d.y : Infinity; // 水面までの距離
    if (tw >= 0 && tw <= REACH && (!th || tw < th.distance)) return { point: o.clone().addScaledVector(d, tw), water: true };
    return th ? { point: th.point } : null;
  }
  const ownerSt = (h) => (h.v ? h.v.st : st);
  const bad = (t, pos, why, extra = {}) => ({ type: t, pos, rot, ok: false, why, ...extra });

  // いかだ（乗り物）のパーツを見ているとき: いかだの中の座標で吸い付きを決める（physics.md「いかだ」）
  function vehicleTarget(t, h) {
    const v = h.v, e = ray.ray.origin, [lx, lz] = v.toLocal(h.point.x, h.point.z), [ex, ez] = v.toLocal(e.x, e.z);
    const lh = { part: h.part, point: { x: lx, y: h.point.y - v.y, z: lz } };
    if (v.kind === 'boat') return bad(t, lh.point, '小舟の上には置けない', { v });
    if (PARTS[t].boat) return bad(t, lh.point, '小舟は水の上に置く', { v });
    if (PARTS[t].core) return bad(t, lh.point, 'コアはいかだに 1 つだけ', { v });
    // 土台・階段（足を伸ばす物）は、甲板を地面として置く（building.md「いかだの上の土台・階段」）
    const ground = PARTS[t].grounded && PARTS[h.part.type].raft;
    const tg = findTarget(t, ground ? { point: lh.point } : lh, { world: v.local, st: v.st, rot, level, eye: { x: ex, y: e.y - v.y, z: ez } });
    if (!tg) return null;
    if (tg.pos.y < -1e8) tg.pos.y = lh.point.y; // 置けない所（赤）は照準の先に出す
    if (tg.ok && PARTS[t].raft && !world.vehicles.floats(v, tg.pos)) Object.assign(tg, { ok: false, why: '下の水が浅いか、物に当たる' });
    if (tg.ok && PARTS[t].grounded && !DECK.every(([a, b]) => v.deckAt(tg.pos.x + a, tg.pos.z + b))) Object.assign(tg, { ok: false, why: 'いかだからはみ出す' });
    return Object.assign(tg, { v });
  }
  // 水面を見ているとき: 新しいいかだ（コア）・小舟。水の上でなければ置けない。いかだの床だけでは始められない
  function newVehicleTarget(t, h) {
    const vs = world.vehicles, boat = !!PARTS[t].boat, r = boat ? rot : 0;
    const pos = { x: snap(h.point.x), y: !vs ? h.point.y : boat ? world.terrain.waterLevel - 0.15 : vs.deckY, z: snap(h.point.z) };
    const why = !boat && !PARTS[t].core ? 'いかだはコアから始める（コアか床の辺を見る）'
      : !vs || !h.water ? '水の上に置く'
        : !vs.floats(null, pos, t, r) ? '水が浅いか、ほかの物に近い'
          : !st.canPlace(t, pos, r) ? 'ほかと重なる' : null;
    return { type: t, pos, rot: r, newVehicle: true, ok: !why, why };
  }
  // 置けない理由がまだなければ決める（重なり、素材）
  function explain(tg) {
    if (!tg) return tg;
    if (!tg.ok && !tg.why) tg.why = !(tg.v ? tg.v.st : st).canPlace(tg.type, tg.pos, tg.rot) ? 'ほかと重なる' : '置けない場所';
    if (tg.ok && !canPay(tg.type)) tg.why = '素材が足りない';
    return tg;
  }

  function place() {
    if (!target || !target.ok || !canPay(target.type)) return;
    const { pos } = target;
    if (target.newVehicle) { // 新しい乗り物: 置いた所が乗り物の中の原点
      const kind = PARTS[target.type].boat ? 'boat' : 'raft';
      world.vehicles.create(pos.x, pos.z, angleOf(target.rot), kind).st.add(target.type, { x: 0, y: 0, z: 0 }, 0);
    } else (target.v ? target.v.st : st).add(target.type, { x: toI(pos.x), y: toI(pos.y), z: toI(pos.z) }, target.rot, target.exactY ? { y: pos.y } : {});
    onPlaced(target.type);
  }
  // 撤去。いかだのコアならバラバラに。いかだの床なら、コアから切れた床もいっしょに（physics.md「いかだ」）
  function removeAimed() {
    const h = aim();
    if (h?.wire) return st.wires.unlink(h.wire) && onWire(); // 電線を外す（銅線が戻る）
    if (!h || !h.part) return;
    if (h.v && PARTS[h.part.type].core) return onBreak(h.v);
    const out = ownerSt(h).remove(h.part);
    if (h.v) out.push(...world.vehicles.prune(h.v));
    onRemoved(out);
  }
  // 撤去を選んでいるとき: 見ているパーツと、いっしょに消えるパーツ
  function removalPreview() {
    const h = aim();
    if (h?.wire) return { parts: [], wire: h.wire, breaks: false };
    if (!h || !h.part) return null;
    const parts = h.v ? world.vehicles.removalOf(h.v, h.part) : [...st.chainOf(h.part)];
    return { parts, breaks: !!(h.v && PARTS[h.part.type].core) };
  }

  const turn = (dir) => { if (sel !== REMOVE) rot = (rot + dir * PARTS[type()].rotStep + 8) % 8; };
  addEventListener('keydown', (e) => {
    if (!active() || e.repeat) return;
    if (pressed(e, 'buildTurn')) turn(1);
    const up = pressed(e, 'buildUp');
    if ((up || pressed(e, 'buildDown')) && sel !== REMOVE) level = Math.max(0, Math.min(MAX_LEVEL, level + (up ? 1 : -1)));
  });
  addEventListener('wheel', (e) => { if (active() && document.pointerLockElement === dom) turn(e.deltaY > 0 ? 1 : -1); });
  dom.addEventListener('mousedown', (e) => {
    // 左クリック: 置く・撤去（ほかのクリックの処理には渡さない）。右クリックは controls.js が建築メニューを開く
    if (!active() || e.button !== 0 || !playing(dom)) return;
    e.stopImmediatePropagation();
    if (sel === REMOVE) { if (swinging()) return; onSwing(true); removeAimed(); } else { onSwing(false); place(); }
  });
  dom.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    preview, marks: marks.group,
    get active() { return active(); }, // ハンマーを持っている（置く・撤去の状態）
    get hammer() { return active(); },
    get target() { return target; }, // 確認用: 今のプレビューの置き場所
    get placing() { return active() && sel !== REMOVE; }, // パーツを選んで置く状態（ホイールは向き）。撤去の間のホイールは持ち替え
    setHammer(v) { if (v && !hammer) sel = REMOVE; hammer = v; }, // 持った直後は撤去
    start(i) { sel = i; }, // メニューで選んだパーツ（REMOVE なら撤去）
    setWorld(w, s) { world = w; st = s; },
    setEnabled(v) { enabled = v; },
    // 右下の表示（ui.md）: 選んでいる物、置けない理由、土台の高さ、撤去で消える物
    status() {
      if (!active()) return null;
      if (sel === REMOVE) return { remove: true, parts: removing?.parts ?? [], breaks: removing?.breaks };
      const t = type();
      return { type: t, why: target ? target.why : null, level: PARTS[t].floor && PARTS[t].grounded ? level : null };
    },
    update() {
      target = null; removing = null;
      if (active() && world && sel === REMOVE) removing = removalPreview();
      else if (active() && world) {
        const t = type(), water = !!(PARTS[t].raft || PARTS[t].boat), h = aim(water);
        if (h) target = explain(h.v ? vehicleTarget(t, h) : water ? newVehicleTarget(t, h) : findTarget(t, h, { world, st, rot, level, eye: ray.ray.origin }));
      }
      marks.show(removing?.parts ?? []);
      preview.visible = !!target;
      if (!target) return;
      preview.geometry = partGeometry(target.type);
      portArrows.show(target.type);
      preview.material = target.ok && canPay(target.type) ? PREVIEW_MAT.ok : PREVIEW_MAT.ng;
      const { pos, v } = target, ay = arrowYaw(target.type);
      arrow.visible = ay !== null;
      if (ay !== null) { arrow.rotation.y = ay; arrow.position.y = 0.05; }
      if (v) { // いかだの中の座標 → 世界
        const [x, z] = v.toWorld(pos.x, pos.z);
        preview.position.set(x, v.y + pos.y, z);
        preview.rotation.y = v.shown.yaw + angleOf(target.rot);
      } else {
        preview.position.set(pos.x, pos.y, pos.z);
        preview.rotation.y = angleOf(target.rot);
      }
    },
    // 確認用: 照準の先に置く／撤去する（クリックと同じ動き）
    place, removeAimed,
    toggleAimed() { const h = aim(); return !!(h && h.part && ownerSt(h).toggle(h.part)); },
    aimPoint() { if (!st) return null; const h = aim(); return h ? h.point : null; }, // 照準の先（電線ののびる先）
    aimedPart() { if (!st) return null; const h = aim(); return h && h.part; },
    refund: (parts) => parts.reduce((a, p) => { for (const [id, n] of Object.entries(COSTS[p.type])) a[id] = (a[id] ?? 0) + Math.floor(n / 2); return a; }, {}),
  };
}
