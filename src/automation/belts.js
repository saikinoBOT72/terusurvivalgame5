// ベルトコンベアと口の出し入れ（automation.md「ベルトコンベア」「機械の向きと口」）
// ベルトは 0.5m のマスに 1 枚。向き dir = rot / 2。1 枚に物 1 個（p.item = { id, t, mesh }、t は 0〜1）で、1 枚を 0.5 秒で進む
// 機械の入れる口のマスにあるベルトが、口へ向かって流れていれば、先まで来た物が機械に入る（stations.js insertInto。Shift＋クリックと同じ振り分け）
// 機械の出す口のマスにあるベルトが、機械から離れる向きなら、0.5 秒に 1 個ずつ「出る」から乗る
import { PARTS } from '../build/parts.js';
import { takeOutOne, insertInto } from '../survival/stations.js';
import { makeMesh, rng } from '../style/lowpoly.js';
import { itemGeometry } from '../survival/itemShapes.js';
import { partGeometry } from '../build/parts.js';
import { beltCurveGeo } from './beltShapes.js';
import { BELT_Y } from './machineParts.js';
import { cellOf, cellKey, nextCell, dirOfRot, opposite, portsOf, feedsIn, takesOut, heightOk } from './ports.js';

const STEP = 0.5;       // 1 マスを進む秒
const BELT_REACH = 0.25; // ベルトどうしの高さの差の上限
const curveGeo = {};
const geoOf = (side) => (side ? (curveGeo[side] ??= beltCurveGeo(rng(77), side)) : partGeometry('belt'));

export function createBelts() {
  let belts = new Map(), ins = new Map(), outs = [], dirty = true;

  function rebuild(list) {
    belts = new Map(); ins = new Map(); outs = [];
    for (const p of list) {
      if (PARTS[p.type].belt) { p.dir = dirOfRot(p.rot); belts.set(cellKey(cellOf(p.pos.x, p.pos.z)), p); continue; }
      if (!PARTS[p.type].machine && p.type !== 'chest') continue;
      const ports = portsOf(p.type, p.pos, p.rot);
      for (const port of ports.in) { const k = cellKey(port.cell); (ins.get(k) ?? ins.set(k, []).get(k)).push({ part: p, port }); }
      for (const port of ports.out) outs.push({ part: p, port });
    }
    // 曲がり: 後ろから来ず、横から 1 本だけ流れ込むときは曲がったベルト
    for (const [k, p] of belts) {
      const c = k.split(',').map(Number), flows = [];
      for (let e = 0; e < 4; e++) {
        const b = belts.get(cellKey(nextCell(c, e)));
        if (b && b.dir === opposite(e)) flows.push(b.dir);
      }
      for (const o of outs) if (cellKey(o.port.cell) === k) flows.push(o.port.dir);
      let side = 0;
      if (!flows.includes(p.dir) && flows.length === 1) {
        if (flows[0] === (p.dir + 3) % 4) side = 1; else if (flows[0] === (p.dir + 1) % 4) side = -1;
      }
      if (p.side !== side) { p.side = side; p.mesh.geometry = geoOf(side); }
    }
    dirty = false;
  }

  const itemPos = (p) => { // ベルトの中での物の位置
    const t = p.item.t, s = p.side;
    return s ? (t < 0.5 ? [s * 0.25 * (1 - 2 * t), 0] : [0, (t - 0.5) * 0.5]) : [0, (t - 0.5) * 0.5];
  };
  function showItem(p) {
    const it = p.item;
    if (!it) { if (p.itemMesh) { p.mesh.remove(p.itemMesh); p.itemMesh = null; } return; }
    if (!p.itemMesh || p.itemMesh.userData.id !== it.id) {
      if (p.itemMesh) p.mesh.remove(p.itemMesh);
      p.itemMesh = makeMesh(itemGeometry(it.id), { shadow: false });
      p.itemMesh.userData.id = it.id;
      p.itemMesh.scale.setScalar(0.4);
      p.mesh.add(p.itemMesh);
    }
    const [x, z] = itemPos(p);
    p.itemMesh.position.set(x, BELT_Y + 0.05, z);
  }

  const put = (p, id) => { p.item = { id, t: 0 }; showItem(p); };

  return {
    touch() { dirty = true; },
    tick(list, dt) {
      if (dirty) rebuild(list);
      for (const o of outs) { // 機械 → ベルト
        const { part, port } = o, b = belts.get(cellKey(port.cell));
        part.outT = (part.outT ?? 0) + dt;
        if (part.outT < STEP || !b || b.item || !takesOut(port, b.dir) || !heightOk(part.pos.y, b.pos.y)) continue;
        const id = takeOutOne(part);
        if (id) { put(b, id); part.outT = 0; }
        else part.outT = STEP;
      }
      for (const [k, p] of belts) { // ベルトの上を進む
        if (!p.item) continue;
        p.item.t = Math.min(1, p.item.t + dt / STEP);
        if (p.item.t >= 1) {
          const into = (ins.get(k) ?? []).find(({ part, port }) => feedsIn(port, p.dir) && heightOk(part.pos.y, p.pos.y));
          if (into) {
            if (insertInto(into.part, { id: p.item.id, n: 1 })) p.item = null;
          } else {
            const nb = belts.get(cellKey(nextCell([...k.split(',').map(Number)], p.dir)));
            if (nb && !nb.item && nb.dir !== opposite(p.dir) && Math.abs(nb.pos.y - p.pos.y) <= BELT_REACH) { put(nb, p.item.id); p.item = null; }
          }
        }
        showItem(p);
      }
    },
    // 右クリックで拾う: 乗っている物の id（なければ null）
    take(p) { const id = p.item?.id ?? null; p.item = null; showItem(p); return id; },
    load(p, d) { if (d) { p.item = { id: d.id, t: d.t ?? 0 }; showItem(p); } },
  };
}
