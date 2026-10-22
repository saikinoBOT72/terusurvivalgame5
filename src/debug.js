// 確認用（開発中だけ）: 今の状態を短い文字で返す。スクリーンショットの代わりに使う（CLAUDE.md「トークンを減らす」）
// ブラウザのコンソールで __game.debug()
import { ITEMS } from './survival/items.js';
import { statsText } from './survival/equip.js';
import * as THREE from 'three';
import { PARTS, PREVIEW_MAT } from './build/parts.js';
import { pebble } from './world/pickups.js';
import { rng, makeMesh } from './style/lowpoly.js';

// 物理の確認: __game.physics.test(n) で照準の先 2m の上から石を n 個落とす
export function createPhysicsTest(g) {
  const r = rng(77);
  return {
    test(n = 5) {
      const ph = g.world.physics, s = g.player.state;
      if (!ph) return '物理なし';
      const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw);
      for (let k = 0; k < n; k++) {
        const size = 0.12, geo = pebble(r, size);
        geo.center();
        const pos = { x: s.x + fx * 2 + (r() - 0.5) * 0.6, y: s.y + 2 + k * 0.3, z: s.z + fz * 2 + (r() - 0.5) * 0.6 };
        ph.add({ mesh: makeMesh(geo), shape: { ball: size * 0.9 }, pos, density: 2.5 });
      }
      return `石 ${n} 個`;
    },
  };
}

// 今ある物の大きさ・三角形・部品の数と、目安に入っているか（style.md「大きさごとの目安」）。__game.stats()
export async function modelStats() {
  const { buildShowcase } = await import('./world/showcase.js');
  return buildShowcase().report.map((m) => `${m.ok ? '  ' : '× '}${m.cls} ${m.name} ${m.size}m 三角形 ${m.tris} 部品 ${m.parts}`).join('\n');
}

const physicsLine = (ph) => {
  if (!ph) return '物理 なし';
  const t = ph.stats();
  return t.ready ? `物理 動く ${t.awake}  眠る ${t.sleeping}  止めた ${t.frozen}  相手 ${t.statics}` : '物理 準備中';
};

// 乗り物: いかだは床の数・位置・向き・速さ・回る速さ・帆、小舟は位置・向き・速さ・傾き。プレイヤーが乗っているか
const vehicleLine = (vs, ps) => {
  if (!vs?.list.length) return '乗り物 なし';
  const deg = (r) => Math.round(r * 180 / Math.PI);
  return '乗り物 ' + vs.list.map((v) => {
    const on = ps.ride?.v === v ? (ps.ride.kind === 'helm' ? ' 舵を持つ' : ' 座っている') : v.rider ? ' 乗っている' : '';
    if (v.kind === 'boat') {
      const b = v.h.body, vel = b ? b.linvel() : { x: 0, z: 0 };
      return `[小舟 位置 ${v.shown.x.toFixed(1)},${v.shown.z.toFixed(1)} 高さ ${v.y.toFixed(2)} 向き ${deg(v.shown.yaw)}° 速さ ${Math.hypot(vel.x, vel.z).toFixed(2)} 傾き ${deg(Math.acos(Math.min(1, v.up)))}°${v.capsized ? ' ひっくり返った' : ''}${on}]`;
    }
    const s = v.state, sails = v.st.list.filter((p) => p.type === 'sail');
    return `[いかだ 床${v.floors}${v.st.list.some((p) => PARTS[p.type].core) ? ' コアあり' : ' コアなし'} 位置 ${s.x.toFixed(1)},${s.z.toFixed(1)} 向き ${deg(s.yaw)}° 速さ ${Math.hypot(s.vx, s.vz).toFixed(2)} 回る ${s.w.toFixed(2)}${sails.length ? ` 帆${sails.filter((p) => p.open).length}/${sails.length}` : ''}${on}]`;
  }).join(' ');
};

// 自動化（automation.md）: 電気の網ごとの出す量・使う量・動くか、機械ごとの状態と中身、ベルトの数と乗っている物
const autoLines = (st) => {
  const ms = (st?.list ?? []).filter((p) => PARTS[p.type].machine && !PARTS[p.type].belt), belts = (st?.list ?? []).filter((p) => PARTS[p.type].belt);
  if (!ms.length && !belts.length) return [];
  const nets = [...new Set(ms.map((p) => p.net).filter(Boolean))];
  const slots = (p) => p.slots?.map((x) => (x ? `${ITEMS[x.id]?.name ?? x.id}x${x.n}` : '-')).join(' ') ?? '';
  return [
    `電気 ${nets.map((n, i) => `[網${i + 1} 出す ${n.gen} 使う ${n.use} ${n.ok ? (n.running ? '動く' : '仕事なし') : '足りなくて止まる'}: ${n.parts.map((p) => PARTS[p.type].name).join(' ')}]`).join(' ') || '網なし'}  線 ${st.wires.list.length}`,
    `機械 ${ms.filter((p) => p.slots).map((p) => `[${PARTS[p.type].name} ${p.burning ? '動く' : p.net ? (p.net.ok ? '止まる' : '電気不足') : '線なし'} 進み ${(p.prog ?? []).map((v) => v.toFixed(1)).join(',')}${p.type === 'generator' ? ` 燃え残り ${p.burn.toFixed(0)}` : ''} ${slots(p)}]`).join(' ')}`,
    `ベルト ${belts.length} 枚  乗っている物 ${belts.filter((p) => p.item).map((p) => ITEMS[p.item.id]?.name).join(' ') || 'なし'}`,
  ];
};

export function createDebug(g) {
  // FPS: 直近 1 秒のフレーム数
  let fps = 0, frames = 0, last = performance.now();
  const tick = (now) => {
    frames++;
    if (now - last >= 1000) { fps = Math.round(frames * 1000 / (now - last)); frames = 0; last = now; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  const f1 = (v) => v.toFixed(1);
  const deg = (r) => Math.round(r * 180 / Math.PI);
  const name = (type) => PARTS[type]?.name ?? type;
  const item = (s) => s ? `${ITEMS[s.id]?.name ?? s.id}x${s.n}${s.dur != null ? `(耐${s.dur})` : ''}` : '-';

  return () => {
    const s = g.player.state, inv = g.inventory, b = g.build, st = g.st, w = g.world;
    const bag = {};
    for (const x of inv.slots) if (x) bag[x.id] = (bag[x.id] ?? 0) + x.n;
    const parts = {};
    for (const p of st?.list ?? []) parts[name(p.type)] = (parts[name(p.type)] ?? 0) + 1;
    const near = (st?.list ?? []).filter((p) => PARTS[p.type].furniture && Math.hypot(p.pos.x - s.x, p.pos.z - s.z) < 3).map((p) => name(p.type));
    const aim = g.mode === 'fps' ? g.gather.aimedInfo() : null;
    const t = b.target;
    const lines = [
      `画面 ${g.mode}  モード ${g.gameMode}  世界 ${w?.report ? '確認島' : w?.range ? '訓練島' : w ? '島' : 'なし'}  FPS ${fps}`,
      `HP ${g.vitals.state.hp}  空腹 ${g.vitals.state.food}  水分 ${g.vitals.state.water}${g.vitals.state.dead ? ' 倒れた' : ''}  ${g.time.label} ${g.time.phase}`,
      `位置 ${f1(s.x)},${f1(s.y)},${f1(s.z)}  向き ${deg(s.yaw)}°/${deg(s.pitch)}°  ${s.swimming ? "泳ぐ" : s.onGround ? "地面" : "空中"}${s.underwater ? " 水中" : ""}${s.moving ? " 移動中" : ""}  息 ${f1(g.vitals.state.breath)}/${g.vitals.state.maxBreath}${w?.zoneAt ? `  島 ${w.name} 区域 ${w.zoneAt(s.x, s.z)}` : ""}`,
      ...[g.ranged.debug(g.inventory.held()?.id)].filter(Boolean), // 銃（combat/ranged.js）
      `動き ${s.gait}${s.sneak ? '(忍び足を入れている)' : ''}  目 ${f1(s.eyeH)} 頭 ${f1(s.headH)}  スタミナ ${Math.round(g.pc.state.stam)}${s.canRun ? '' : ' 走れない'}${s.canFloat ? '' : ' 浮けない'}`,
      ...(w?.spots ? [`スポット ${w.spots.map((p) => ({ p, d: Math.hypot(p.x - s.x, p.z - s.z) })).sort((a, b) => a.d - b.d).slice(0, 3)
        .map(({ p, d }) => `${p.n}.${p.name} ${Math.round(d)}m`).join(' / ')}`] : []),
      `手 [${inv.sel}] ${item(inv.held())}  列 ${inv.slots.slice(0, 6).map(item).join(' ')}`,
      `持ち物 ${Object.entries(bag).map(([k, n]) => `${ITEMS[k]?.name ?? k}${n}`).join(' ') || 'なし'}`,
      `広さ ${inv.slots.length} マス（奥 ${inv.rows} 段）  大事な物 ${g.keyItems?.list().map((id) => ITEMS[id].name).join(' ') || 'なし'}  装備 ${g.equip?.slots.map(item).join(' ')}（${statsText(g.equip?.stats()) || '効き目なし'}）`,
      g.invHud?.station ? `設備 ${g.invHud.station.type} [${g.invHud.station.slots.map((x) => (x ? x.id + "x" + x.n : "-")).join(" ")}] 燃え残り ${f1(g.invHud.station.burn ?? 0)}秒 進み ${(g.invHud.station.prog ?? []).map(f1).join(",")}${g.invHud.station.burning ? " 燃えている" : ""}` : "設備 閉じている",
      `照準 ${aim ? `${aim.name}（${aim.key}）` : b.aimedPart() ? name(b.aimedPart().type) : '-'}`,
      `建築 ${b.hammer ? 'ハンマー' : '-'}${b.active ? ` 置く中 ${t ? `${name(t.type)} ${b.preview.material === PREVIEW_MAT.ok ? '置ける' : '置けない'}` : '対象なし'}` : ''}`,
      ...autoLines(st),
      physicsLine(w?.physics),
      `敵の数 ${g.spawner?.counts ?? '-'}`,
      `戦闘の記録 ${g.combat?.log.join(' / ') || 'なし'}`,
      vehicleLine(w?.vehicles, s),
      `敵 ${(g.combat?.list ?? []).map((m) => `${m.def.name} ${m.hp}/${m.maxHp} ${m.state}${m.band ? `(${m.band})` : ''} ${f1(Math.hypot(m.x - s.x, m.z - s.z))}m${m.lastHit ? ` 受けた${m.lastHit}` : ''}`).join(' / ') || 'なし'}`,
      g.perf.report(g.renderer.info),
      `パーツ ${Object.entries(parts).map(([k, n]) => `${k}${n}`).join(' ') || 'なし'}  近くの家具 ${near.join(' ') || 'なし'}`,
    ];
    return lines.join('\n');
  };
}
