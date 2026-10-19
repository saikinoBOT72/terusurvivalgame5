// 墜落島のスポット（12〜15・21: 西の浜・林・谷・泉・川）。置き方の ctx は spots.js（placeSpots の中で、この順に呼ぶ。乱数の順を変えない）
import * as THREE from 'three';
import { rock, stump } from './nature.js';
import { mushrooms } from './props.js';
import { itemGeometry } from '../survival/itemShapes.js';
import { DAY_LEN } from './dayNight.js';
import { shellGeo, steppingStone } from './spotBeach.js';
import { waterWheel, millHut } from './spotCamp.js';
import { spring, poolMesh, POOL_Y, bridgeLog } from './spotNature.js';
import { loggerWreck, pileLog, pileStakes, LOG_PILE } from './spotAI.js';

export function placeWest(ctx) {
  const { r, H, S, pools } = ctx;

  // ---- 12 西の潮だまり: 崖下の浜に貝 12、火打ち石 3、潮だまり（小さな水たまりと石）2 ----
  {
    const s = S[12];
    ctx.take('shell', shellGeo(r), Array.from({ length: 12 }, () => ({ ...ctx.at(s, 1 + r() * 7.5, r() * 6.28), s: 1.3, extra: { regrow: DAY_LEN * 2 } })), { rad: 0.2, h: 0.15, shadow: false });
    ctx.take('flint', itemGeometry('flint'), Array.from({ length: 3 }, () => ctx.at(s, 2 + r() * 6, r() * 6.28)), { rad: 0.25, h: 0.25, shadow: false });
    for (const [dx, dz] of [[-3, 3], [2, -3.5]]) {
      const x = s.x + dx, z = s.z + dz, pool = new THREE.CircleGeometry(0.9, 8).rotateX(-Math.PI / 2);
      ctx.mesh(poolMesh(pool), x, z, { dy: 0.06 });
      for (let k = 0; k < 5; k++) { const m = rock(r, 0.3 + r() * 0.2); ctx.mesh(m, x + Math.cos(k * 1.25) * 1.05, z + Math.sin(k * 1.25) * 1.05, { dy: -0.08, yaw: m.rotation.y }); }
    }
  }

  // ---- 13 切り株の空き地: 伐採ロボの残骸、丸太の山（上から 1 本ずつ切れる）、切り株 14 ----
  {
    const s = S[13];
    ctx.mesh(loggerWreck(r), s.x - 1, s.z + 1, { dy: -0.1, yaw: 2.1 });
    ctx.col(s.x - 1, s.z + 1, 1.5, H(s.x - 1, s.z + 1) + 1.1);
    const px = s.x + 5, pz = s.z - 3, yaw = 0.5, y = H(px, pz), ca = Math.cos(yaw), sa = Math.sin(yaw);
    const logs = LOG_PILE.map(([lz, ly]) => ({ x: px + lz * sa, z: pz + lz * ca, y: y + ly, rot: yaw }));
    const logEs = ctx.take('pileLog', pileLog(r), logs, { rad: 0.3, h: 0.45 });
    logEs.forEach((e, k) => { e.y -= 0.2; e.blockedBy = logEs.filter((o, j) => LOG_PILE[j][1] > LOG_PILE[k][1] && Math.abs(LOG_PILE[j][0] - LOG_PILE[k][0]) < 0.5); });
    ctx.mesh(pileStakes(r), px + ca * 1.0, pz - sa * 1.0, { yaw });
    ctx.mesh(pileStakes(r), px - ca * 1.0, pz + sa * 1.0, { yaw });
    ctx.colLine(px, pz, yaw + Math.PI / 2, 1.6, 0.8, y + 1.25);
    const stumps = Array.from({ length: 14 }, () => ({ ...ctx.at(s, 3 + r() * 9, r() * 6.28), s: 1.6 + r() * 0.8 }));
    ctx.many(stump(r), stumps);
    for (const it of stumps) ctx.col(it.x, it.z, 0.2 * it.s, it.y + 0.3 * it.s); // 乗れる
  }

  // ---- 14 倒木の谷: 谷をまたぐ大きな倒木 2（橋）と、谷に沿って倒れた 1（壁）。谷の底にキノコ 6 ----
  {
    const s = S[14], sh = s.shape[0], ca = Math.cos(sh.a), sa = Math.sin(sh.a);
    for (const [u, len, along] of [[-6, 9, false], [7, 10, false], [1, 12, true]]) {
      const x = s.x + ca * u + (along ? -sa * 1.6 : 0), z = s.z + sa * u + (along ? ca * 1.6 : 0);
      const yaw = along ? -sh.a : -sh.a - Math.PI / 2, y = along ? H(x, z) + 0.3 : H(s.x + ca * u - sa * 4, s.z + sa * u + ca * 4) + 0.1;
      ctx.mesh(bridgeLog(r, len), x, z, { y, yaw, rz: along ? 0.05 : 0 });
      ctx.colLine(x, z, yaw, len, 0.5, y + 0.45);
    }
    ctx.take('mushroom', mushrooms(r), Array.from({ length: 6 }, (_, k) => ({ x: s.x + ca * (k * 4 - 10) + sa * (r() - 0.5) * 3, z: s.z + sa * (k * 4 - 10) - ca * (r() - 0.5) * 3, extra: { regrow: DAY_LEN } })), { rad: 0.25, h: 0.25, shadow: false });
  }

  // ---- 15 泉: 岩の割れ目から水が落ちる。水たまりは竹筒で汲める（生水） ----
  {
    const s = S[15], sp = spring(r), yaw = 0.3;
    ctx.mesh(sp.geo, s.x, s.z, { yaw, double: true });
    const pool = ctx.mesh(poolMesh(sp.pool), s.x, s.z, { yaw });
    pools.push({ x: s.x, z: s.z, r: 1.5, y: pool.position.y + POOL_Y });
    const back = ctx.at(s, 2, -Math.PI / 2 + yaw);
    ctx.col(back.x, back.z, 1.6, H(back.x, back.z) + 2.4);
  }

  // ---- 21 川の飛び石と水車小屋跡 ----
  {
    const s = S[21], dir = new THREE.Vector2(6, 30).normalize(), perp = new THREE.Vector2(dir.y, -dir.x);
    const stones = [];
    for (let k = -3; k <= 3; k++) stones.push({ x: s.x + perp.x * k * 1.35 + (r() - 0.5) * 0.3, z: s.z + perp.y * k * 1.35 + (r() - 0.5) * 0.3, s: 1 + r() * 0.2 });
    for (const st of stones) st.y = Math.max(H(st.x, st.z), -0.25) + 0.02;
    ctx.many(steppingStone(r), stones);
    for (const st of stones) ctx.col(st.x, st.z, 0.45, st.y + 0.19 * st.s);
    const wx = s.x + dir.x * 7 + perp.x * 2.4, wz = s.z + dir.y * 7 + perp.y * 2.4, yaw = Math.atan2(dir.x, dir.y);
    ctx.mesh(waterWheel(r), wx, wz, { y: -0.9, yaw });
    ctx.col(wx, wz, 1.6, 2);
    const hx = s.x + dir.x * 8 + perp.x * 6.5, hz = s.z + dir.y * 8 + perp.y * 6.5;
    ctx.mesh(millHut(r), hx, hz, { dy: -0.05, yaw: yaw + Math.PI });
    ctx.colLine(hx, hz, -yaw, 3, 0.4, H(hx, hz) + 2);
  }
}
