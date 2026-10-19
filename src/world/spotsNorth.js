// 墜落島のスポットに物を置く（北: 深い森・見晴らしの丘・滝・岩場・峡谷・高台）。共通の置き方 ctx は spots.js
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { shape, pick } from '../style/lowpoly.js';
import { rock } from './nature.js';
import { crate } from './wreck.js';
import { DAY_LEN } from './dayNight.js';
import { mossBoulder, glowShrooms, GLOW_MAT } from './spotNature.js';
import { deadRobot } from './spotAI.js';
import { createMining } from '../mobs/mining.js';

export function placeNorth(ctx) {
  const { S, r, H, resources, group, updates } = ctx;

  // ---- 17 苔の巨岩と洞窟: 岩の丘の南の切り通しの奥に洞窟の口（caveCarve.js）。口の上に苔の巨岩がのしかかる ----
  {
    const s = S[17], bx = s.x + 1, bz = s.z + 10.5;
    ctx.mesh(mossBoulder(r), bx, bz, { dy: -0.8, yaw: 0.4 });
    ctx.col(bx, bz, 4.4, H(bx, bz) + 9);
  }

  // ---- 18 昼でも暗い森: 光るキノコの群れ 8（採ると 1 日で戻る）と、森の奥の弱い青緑の光 2（遠いときは消す） ----
  {
    const s = S[18], sh = glowShrooms(r), list = [];
    for (let k = 0; list.length < 8 && k < 80; k++) {
      const p = ctx.at(s, 3 + r() * 16, r() * 6.28);
      if (ctx.colliders(p.x, p.z, 0.4).length || list.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < 3)) continue;
      list.push({ ...p, s: 1.2 + r() * 0.4 });
    }
    const body = ctx.many(sh.body, list, { shadow: false }), glow = ctx.many(sh.glow, list.map((it) => ({ ...it })), { shadow: false });
    glow.material = GLOW_MAT;
    list.forEach((it, k) => resources.add({ kind: 'glowShroom', x: it.x, y: it.y, z: it.z, r: 0.3, h: 0.35, regrow: DAY_LEN,
      parts: [{ mesh: body, index: k }, { mesh: glow, index: k }] }));
    const lights = [list.slice(0, 4), list.slice(4)].map((g) => {
      const l = new THREE.PointLight(P.magic[2], 0, 14, 1.6);
      l.position.set(g.reduce((a, o) => a + o.x, 0) / g.length, H(s.x, s.z) + 1.2, g.reduce((a, o) => a + o.z, 0) / g.length);
      group.add(l);
      return l;
    });
    updates.push((t, cam) => { for (const l of lights) l.intensity = cam && Math.hypot(cam.x - l.position.x, cam.z - l.position.z) < 45 ? 2.2 + Math.sin(t * 1.3) * 0.3 : 0; });
  }

  // ---- 19 見晴らしの岩: 丘の上の、平たい岩の段（0.75m ずつ。跳んで登る）。てっぺんから島が見える ----
  {
    const s = S[19];
    [[0.75, 2.6, 0], [1.5, 1.9, 1.7], [2.25, 1.2, 3.4], [3.0, 0, 0]].forEach(([top, d, a]) => {
      const x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d, m = rock(r, 1.6), y = H(s.x, s.z);
      ctx.mesh(m, x, z, { y: y + top - 0.98, yaw: m.rotation.y });
      ctx.col(x, z, 1.15, y + top);
    });
  }

  // ---- 20 滝の裏の洞窟: 崖の溝に岩の殻を置き、上を崖の高さまでふさぐ。奥に宝箱（滝は nature.js） ----
  {
    const c = ctx.cave(20).chest;
    ctx.box(crate(r), c.x, c.z, [['battery', 2], ['copperIngot', 2]], { y: ctx.floor(c.x, c.z, 20) });
  }


  // ---- 22 露天掘りの大穴: 穴の底に壊れた採掘ロボ（AI の跡 2）。石炭の岩は orePlace.js が寄せる ----
  {
    const s = S[22], x = s.x + 2, z = s.z + 1.5;
    ctx.mesh(deadRobot(createMining, 21), x, z, { yaw: 2.4, rz: 0.15 });
    ctx.col(x, z, 0.6, H(x, z) + 1.2);
  }

  // ---- 26 銅の鉱脈の壁: 掘り尽くされた跡（割れた岩のかけら）。銅の岩は orePlace.js ----
  {
    const s = S[26];
    for (let k = 0; k < 6; k++) { const p = ctx.at(s, 2 + r() * 6, r() * 6.28), m = rock(r, 0.25 + r() * 0.2); ctx.mesh(m, p.x, p.z, { dy: -0.05, yaw: m.rotation.y }); }
  }

  // ---- 27 崩れた坂: 裂け目の底の落ちた岩と、前にかかっていた板の残り ----
  {
    const s = S[27], a = s.shape[0].a;
    for (let k = 0; k < 4; k++) { const m = rock(r, 0.6 + r() * 0.5); ctx.mesh(m, s.x + (r() - 0.5) * 3, s.z + (r() - 0.5) * 3, { dy: -0.2, yaw: m.rotation.y }); }
    for (const side of [-1, 1]) { // 裂け目のふちから垂れた板
      const x = s.x + Math.cos(a) * side * 3.2, z = s.z + Math.sin(a) * side * 3.2;
      const g = new THREE.BoxGeometry(2.2, 0.12, 0.4).translate(-side * 1.0, 0, 0);
      ctx.mesh(plank(g, r), x, z, { yaw: -a, rz: side * 0.6 });
    }
  }
}

const plank = (g, r) => shape(g, () => pick(r, [P.wood[1], P.wood[2]]), r, { jit: 0.02 });
