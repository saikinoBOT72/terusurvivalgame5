// 敵の弾（enemies.md「ブンブン」の風の弾・「ガラクタ犬」の泥飛ばし）: 見える玉が飛ぶ。地形・水・木・岩で消え、プレイヤーに当たると攻撃力と押し
// 数値は mobTypes.js の攻撃の shot: { speed m/秒（重力があれば横の速さ）, r 半径 m, range 消えるまでの m, g 重力（m/秒²、なければまっすぐ） }
// 見た目は攻撃の fx で: 'wind' 白い渦（windFx.js）、'mud' 泥の玉としずく（mudFx.js）
import * as THREE from 'three';
const _d = new THREE.Vector3();
import { P } from '../style/palette.js';

const BODY_LO = 0.1, BODY_HI = 1.2, BODY_R = 0.3; // プレイヤーの体（足から上の高さ、太さ）

export function createMobShots({ wind, mud }) {
  const list = [];
  const outer = new THREE.MeshBasicMaterial({ color: P.fx.wind[2], transparent: true, opacity: 0.4, depthWrite: false });
  const inner = new THREE.MeshBasicMaterial({ color: P.fx.wind[0], transparent: true, opacity: 0.8, depthWrite: false });
  const muddy = new THREE.MeshLambertMaterial({ color: P.fx.mud[0], flatShading: true });
  const outerGeo = new THREE.IcosahedronGeometry(1, 1), innerGeo = new THREE.IcosahedronGeometry(1, 0);

  function vanish(s) {
    if (s.mud) mud?.splat(s.p); else wind?.puff(s.p);
    s.mesh.removeFromParent();
    list.splice(list.indexOf(s), 1);
  }

  return {
    count: () => list.length,
    // m の a の弾を from から dir の向きへ。重力のある弾は dir の先（ねらう所）に落ちるように上へ投げる。parent: 世界の group
    fire(m, a, from, dir, parent) {
      const mesh = new THREE.Group();
      const isMud = a.fx === 'mud';
      let o, i;
      if (isMud) { o = new THREE.Mesh(innerGeo, muddy); o.scale.set(a.shot.r * 0.9, a.shot.r * 0.75, a.shot.r * 0.9); mesh.add(o); }
      else { o = new THREE.Mesh(outerGeo, outer); i = new THREE.Mesh(innerGeo, inner); o.scale.setScalar(a.shot.r * 0.6); i.scale.setScalar(a.shot.r * 0.3); mesh.add(o, i); }
      mesh.position.copy(from);
      parent.add(mesh);
      const v = dir.clone();
      if (a.shot.g) { // 横は speed で、ちょうど dir の先に届くように上へ
        const flat = Math.hypot(v.x, v.z) || 1, t = flat / a.shot.speed;
        v.set(v.x / flat * a.shot.speed, v.y / t + 0.5 * a.shot.g * t, v.z / flat * a.shot.speed);
      } else v.normalize().multiplyScalar(a.shot.speed);
      list.push({ m, a, p: from.clone(), v, went: 0, mesh, o, i, mud: isMud });
    },
    clear() { for (const s of [...list]) { s.mesh.removeFromParent(); list.splice(list.indexOf(s), 1); } },
    // terrain・blockers(x, z, r)・player.state。hit(撃った敵, 攻撃力, 攻撃, 来た所) で当てる
    update(dt, { terrain, blockers, player, hit, dead }) {
      const p = player.state;
      for (const s of [...list]) {
        if (s.a.shot.g) s.v.y -= s.a.shot.g * dt;
        s.p.addScaledVector(s.v, dt); s.went += s.v.length() * dt;
        s.mesh.position.copy(s.p);
        const d = _d.copy(s.v).normalize(); // 使い回し（毎フレーム作らない）
        if (s.mud) { s.o.rotation.x += dt * 7; s.o.rotation.z += dt * 4; mud?.trail(s.p, dt); } // 転がりながら飛び、しずくを落とす
        else { s.o.rotation.y += dt * 9; s.o.rotation.x += dt * 5; s.i.rotation.z -= dt * 14; wind?.swirl(s.p, d, dt); } // 渦を巻く
        // プレイヤー: 体（縦の線）との近さ
        const by = Math.max(p.y + BODY_LO, Math.min(p.y + BODY_HI, s.p.y));
        if (!dead && Math.hypot(s.p.x - p.x, s.p.y - by, s.p.z - p.z) < s.a.shot.r + BODY_R) {
          hit(s.m, Math.round(s.a.dmg * s.m.tier.dmg), s.a, { x: s.p.x - d.x, y: s.p.y, z: s.p.z - d.z, shot: true }); // 来た向きは弾の後ろ
          vanish(s); continue;
        }
        const g = Math.max(terrain.groundNear(s.p.x, s.p.z, s.p.y), terrain.waterLevel);
        const wall = blockers(s.p.x, s.p.z, 0.1).some((c) => c.top > s.p.y && (c.bottom ?? -Infinity) < s.p.y);
        if (s.p.y < g || wall || s.went > s.a.shot.range) vanish(s);
      }
    },
  };
}
