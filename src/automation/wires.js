// 電線（automation.md「電線」）: 銅線で電気の物を 2 つつなぐ。線は st.list のパーツではなく、ここの一覧に持つ
// 線の見た目は少したるんだ銅色の管。狙って撤去できるように、太い見えない当たり用の管を重ねる（userData.wire）
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { MAT, rng, shape } from '../style/lowpoly.js';
import { PARTS } from '../build/parts.js';

export const MAX_LEN = 12;
const SAG = 0.05; // たるみ（長さに対する割合）

// 碍子の位置（世界）。toward に近いほうを使う
function endpoint(part, toward) {
  const a = (part.rot * Math.PI) / 4, c = Math.cos(a), s = Math.sin(a);
  const pts = PARTS[part.type].wirePts.map(([x, y, z]) => ({ x: part.pos.x + x * c + z * s, y: part.pos.y + y, z: part.pos.z - x * s + z * c }));
  return pts.reduce((best, q) => (Math.hypot(q.x - toward.x, q.z - toward.z) < Math.hypot(best.x - toward.x, best.z - toward.z) ? q : best));
}
const centerOf = (p) => ({ x: p.pos.x, y: p.pos.y, z: p.pos.z });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

function curve(p, q) {
  const mid = new THREE.Vector3((p.x + q.x) / 2, (p.y + q.y) / 2 - dist(p, q) * SAG, (p.z + q.z) / 2);
  return new THREE.QuadraticBezierCurve3(new THREE.Vector3(p.x, p.y, p.z), mid, new THREE.Vector3(q.x, q.y, q.z));
}
const hitMat = new THREE.MeshBasicMaterial({ visible: false });

// group: 世界に足す入れ物。link した線は group の子になる
export function createWires(group) {
  const list = []; // { a, b, p, q, len, mesh }
  const r = rng(31);
  const maxOf = (part) => PARTS[part.type].maxWires ?? 0;
  const count = (part) => list.filter((w) => w.a === part || w.b === part).length;
  const connectable = (part) => !!PARTS[part.type].wirePts;
  let first = null; // 1 つ目に選んだ物
  const aimLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: P.copperMetal[1] }));
  aimLine.visible = false;
  aimLine.frustumCulled = false;
  group.add(aimLine);

  function reason(a, b) {
    if (a === b) return 'ほかの物をつなぐ';
    if (list.some((w) => (w.a === a && w.b === b) || (w.a === b && w.b === a))) return 'もうつながっている';
    if (count(a) >= maxOf(a) || count(b) >= maxOf(b)) return 'つなげる線がいっぱい';
    if (dist(endpoint(a, centerOf(b)), endpoint(b, centerOf(a))) > MAX_LEN) return `遠すぎる（${MAX_LEN}m まで）`;
    return null;
  }

  function link(a, b) {
    const p = endpoint(a, centerOf(b)), q = endpoint(b, centerOf(a)), cv = curve(p, q);
    const tube = (rad, seg) => new THREE.TubeGeometry(cv, 10, rad, seg, false);
    const mesh = new THREE.Mesh(shape(tube(0.014, 4), () => P.copperMetal[1], r), MAT.solid);
    mesh.castShadow = true;
    const hit = new THREE.Mesh(tube(0.15, 4), hitMat);
    mesh.add(hit);
    const w = { a, b, p, q, len: dist(p, q), mesh };
    mesh.userData.wire = hit.userData.wire = w;
    group.add(mesh);
    list.push(w);
    return w;
  }
  function unlink(w) {
    const i = list.indexOf(w);
    if (i < 0) return false;
    list.splice(i, 1);
    group.remove(w.mesh);
    w.mesh.traverse((o) => o.geometry?.dispose());
    return true;
  }

  return {
    list, link, unlink, reason, connectable,
    get first() { return first; },
    cancel() { first = null; aimLine.visible = false; },
    // 銅線を持って電気の物を右クリック。{ msg, used } を返す（used: 銅線を 1 本使った）。haveWire: 銅線を持っているか
    click(part, haveWire) {
      if (!part || !connectable(part)) { this.cancel(); return { msg: '電気の物をつなぐ' }; }
      if (!first) {
        if (count(part) >= maxOf(part)) return { msg: 'つなげる線がいっぱい' };
        first = part;
        return { msg: `${PARTS[part.type].name} から線を張る。つなぐ物を右クリック` };
      }
      if (first === part) { this.cancel(); return { msg: 'やめた' }; }
      const why = reason(first, part);
      if (why) return { msg: why };
      if (!haveWire) { this.cancel(); return { msg: '銅線が足りない' }; }
      link(first, part);
      const name = PARTS[first.type].name;
      this.cancel();
      return { msg: `${name} と ${PARTS[part.type].name} をつないだ`, used: true };
    },
    // 照準の先までのびる線。point: 照準の先（なければ null）
    showAim(point) {
      if (!first || !point) { aimLine.visible = false; return; }
      const p = endpoint(first, point), pos = aimLine.geometry.attributes.position;
      pos.setXYZ(0, p.x, p.y, p.z); pos.setXYZ(1, point.x, point.y, point.z); pos.needsUpdate = true;
      aimLine.material.color.set(dist(p, point) > MAX_LEN ? P.ui.ng : P.copperMetal[1]);
      aimLine.visible = true;
    },
    // 機械を撤去したとき: その物の線を全部外す。外した数（銅線が戻る）
    removeFor(part) {
      if (first === part) this.cancel();
      const gone = list.filter((w) => w.a === part || w.b === part);
      gone.forEach(unlink);
      return gone.length;
    },
    // セーブ: 線を [番号, 番号] の組で（番号は parts の並び）
    save: (parts) => list.map((w) => [parts.indexOf(w.a), parts.indexOf(w.b)]),
    load(pairs, parts) { for (const [i, j] of pairs ?? []) if (parts[i] && parts[j]) link(parts[i], parts[j]); },
  };
}
