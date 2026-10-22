// マップ作り（docs/rules/building.md「コンクリートとマップ作り」）: 世界を作り、変えるたびに自動で保存、
// ファイルへの書き出し・読み込み、ジャンプ台・飛ばし台で跳ばす（player.md「ジャンプ台」）
import { buildMapWorld } from '../world/mapWorld.js';
import { PARTS } from '../build/parts.js';
import { COLORS } from '../build/concreteParts.js';
import { angleOf } from '../build/grid.js';

const KEY = 'oasobi5.map'; // 島のセーブとは別
const KIND = 'oasobi-map';
const LIMIT = 4000;        // 記録の座標の範囲（0.25m 単位。±1000m）
const PAD = { r: 0.55, top: 0.15, up: 13, dirUp: 9, dirDist: 12, dirSecs: 1.3, cool: 0.5 };

// 読み込んだ 1 つのパーツが正しいか（知らない物・マップ作りでない物・壊れた値は飛ばす）
const num = (v) => Number.isFinite(v) && Math.abs(v) < LIMIT;
const valid = (x) => x && PARTS[x.type]?.map && x.i && num(x.i.x) && num(x.i.y) && num(x.i.z)
  && Number.isInteger(x.rot) && x.rot >= 0 && x.rot < 8 && (x.c === undefined || (Number.isInteger(x.c) && x.c >= 0 && x.c < COLORS));

// structuresOf: 世界 → 建築パーツ。playing(): 1 人称で遊んでいるか。onMessage(文): 画面に出す
export function createMapMaker({ structuresOf, player, playing, onMessage }) {
  const world = buildMapWorld();
  const st = () => structuresOf.get(world);
  const data = () => ({ kind: KIND, v: 1, parts: st().list.map((p) => ({ type: p.type, i: p.i, rot: p.rot, c: p.c })) });

  let saveT = null, loading = false;
  const saveNow = () => {
    if (saveT === null) return;
    clearTimeout(saveT);
    saveT = null;
    try { localStorage.setItem(KEY, JSON.stringify(data())); } catch { onMessage('マップを保存できなかった'); }
  };
  world.changed = () => { // パーツを置く・撤去する・塗るたびに（structures.js）。まとめて 0.5 秒後に保存
    if (loading) return;
    clearTimeout(saveT);
    saveT = setTimeout(saveNow, 500);
  };
  addEventListener('pagehide', saveNow); // 閉じる直前の変更も残す
  // 今のマップを消して、記録から置く。置いた数を返す
  function load(d) {
    const s = st();
    loading = true;
    for (const p of [...s.list]) s.remove(p);
    let n = 0;
    for (const x of d.parts) if (valid(x)) { s.add(x.type, x.i, x.rot, { c: x.c }); n++; }
    loading = false;
    world.changed();
    return n;
  }

  // ジャンプ台・飛ばし台: 輪の内側に立つか落ちてきたら跳ばす
  let last = 0, cool = 0;
  world.onUpdate = (t) => {
    const dt = Math.min(0.1, t - last), s = player.state;
    last = t;
    cool -= dt;
    if (cool > 0 || !playing() || s.fly || s.vy > 0.5 || !st()) return;
    for (const p of st().list) {
      const kind = PARTS[p.type].pad, top = p.pos.y + PAD.top;
      if (!kind || Math.hypot(s.x - p.pos.x, s.z - p.pos.z) > PAD.r || s.y < top - 0.05 || s.y > top + 0.3) continue;
      if (kind === 'up') player.lift(PAD.up);
      else {
        const a = angleOf(p.rot);
        player.lift(PAD.dirUp);
        player.shove(-Math.sin(a), -Math.cos(a), PAD.dirDist, PAD.dirSecs); // 矢印（形の -z）の向き
      }
      cool = PAD.cool;
      return;
    }
  };

  // 書き出し・読み込み（建築メニューのボタン。game/building.js が world.io を呼ぶ）
  const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  world.io = {
    exportFile() {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data())], { type: 'application/json' }));
      a.download = `oasobi-map-${stamp()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      onMessage('マップを書き出した');
    },
    async importFile(file) {
      let d = null;
      try { d = JSON.parse(await file.text()); } catch { /* 下で知らせる */ }
      if (d?.kind !== KIND || !Array.isArray(d.parts)) return onMessage('マップのファイルではない');
      if (st().list.length && !confirm('今のマップと置きかえますか？')) return;
      onMessage(`${load(d)} 個のパーツを読み込んだ`);
    },
  };

  let loaded = false;
  return {
    world,
    // 世界に入った後（建築パーツができてから）。初めてなら保存してあるマップを置く
    entered() {
      if (loaded) return;
      loaded = true;
      try { const d = JSON.parse(localStorage.getItem(KEY)); if (d?.kind === KIND && Array.isArray(d.parts)) load(d); } catch { /* 保存がない・壊れている */ }
    },
    data, load, // 確認用（__game.map）
  };
}

