// 道具の使い方（docs/rules/survival.md「採り方と道具の使い方」）
// 釣り竿で釣る、竹筒に水をくむ、苗木を植える、ピッケルで粘土を掘る、かいでこぐ
import * as THREE from 'three';
import { P } from '../style/palette.js';
import { rng, makeMesh } from '../style/lowpoly.js';
import { ITEMS } from './items.js';
import { fish as fishGeo } from './materialShapes.js';
import { dropItem, throwItem } from './death.js';

const CAST_RANGE = 10, KEEP_RANGE = 12, BITE = 1.5; // 釣り: 投げる距離、離れると戻る距離、かかってから引ける秒数
const NEAR = 3, SCOOP = 4, CLAY_SHORE = 0.6; // 植える距離、水をくむ距離、粘土が出る水ぎわの高さ
const between = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// now(): はじめからの秒（苗木を植えた時刻）
export function createTools({ camera, scene, inventory, now, onGain = () => {}, onMessage = () => {} }) {
  let world = null;
  const o = new THREE.Vector3(), d = new THREE.Vector3(), p = new THREE.Vector3();
  const look = () => { camera.getWorldPosition(o); camera.getWorldDirection(d); };
  const wear = () => { const broke = inventory.wear(); if (broke) onMessage(`${broke}が壊れた`); };
  const give = (id, n) => { const got = inventory.add(id, n); if (got) onGain(id, got); else onMessage('持ち物がいっぱい'); return got; };

  // 照準の線が最初に当たる地面か水 { x, y, z, water, ground }（max m まで）
  function surfaceHit(max) {
    look();
    const t = world.terrain, wl = t.waterLevel;
    for (let s = 0.1; s <= max; s += 0.08) {
      p.copy(o).addScaledVector(d, s);
      const g = t.floorAt(p.x, p.y + 0.01, p.z); // 洞窟の中でも、照準の点の下の床
      if (p.y <= wl && g < wl) return { x: p.x, y: wl, z: p.z, water: true, ground: g };
      const pool = world.pools?.find((q) => p.y <= q.y && Math.hypot(p.x - q.x, p.z - q.z) < q.r); // 泉の水たまり（spots.js）
      if (pool) return { x: p.x, y: pool.y, z: p.z, water: true, ground: g };
      if (p.y <= g) return { x: p.x, y: g, z: p.z, water: false, ground: g };
    }
    return null;
  }

  // スリングの的（巣の卵・ヤシの実）に弾が当たった: 地面に落ちる（弾は combat/ranged.js）
  function hitTarget(t) {
    if (!t.ready) return;
    for (const [id, n] of t.drops()) { // 物理があれば、的の高さから落ちる
      const x = t.x + (Math.random() - 0.5) * 0.8, z = t.z + (Math.random() - 0.5) * 0.8;
      dropItem(world, id, n, x, z, world.physics ? t.y + 0.1 : undefined);
    }
    world.resources.regrow(t, t.regrow);
  }

  // ---- 釣り: 水に投げる → 4〜12 秒でえさが沈む → 1.5 秒以内に右クリック ----
  const lure = makeMesh(fishGeo(rng(31), { s: 0.5, col: P.water[3], eyes: false }), { shadow: false });
  let cast = null; // { x, y, z, phase: 'wait' | 'bite', t }
  function endCast() { cast = null; scene.remove(lure); }
  function rod() {
    if (!cast) {
      const h = surfaceHit(CAST_RANGE);
      if (!h || !h.water) { onMessage('水に向けて投げる'); return; }
      cast = { ...h, phase: 'wait', t: 4 + Math.random() * 8 };
      lure.position.set(h.x, h.y, h.z);
      scene.add(lure);
      return;
    }
    if (cast.phase === 'bite') { if (give('fish', 1)) wear(); } else onMessage('逃げられた');
    endCast();
  }

  return {
    setWorld(w) { world = w; if (cast) endCast(); },
    // 右クリック: 持っている物の働き。何かしたら true（しなければ、ふつうの右クリックへ）
    rightClick(held) {
      if (!world?.terrain) return false;
      if (held === 'fishingRod') { rod(); return true; }
      if (held === 'paddle') { // いかだの上でこぐ（physics.md「いかだを動かす」）
        look();
        const r = world.vehicles?.paddle(d.x, d.z);
        if (r === false) onMessage('いかだの上でこぐ');
        else if (r) wear();
        return true;
      }
      if (held === 'tubeEmpty') {
        const h = surfaceHit(SCOOP);
        if (!h?.water) return false;
        inventory.remove('tubeEmpty', 1);
        give('tubeSea', 1);
        return true;
      }
      if (held === 'sapling' && world.planting) {
        const h = surfaceHit(NEAR);
        if (!h || h.water) return false;
        if (!world.planting.canPlant(h.x, h.z)) { onMessage('ここには植えられない'); return true; }
        world.planting.plant(h.x, h.z, now());
        inventory.remove('sapling', 1);
        return true;
      }
      return false;
    },
    // 左クリック（叩く物が照準の先にないとき）: ピッケルで水ぎわの地面から粘土、草地から土
    leftClick(held) {
      if (!world?.terrain) return false;
      if (ITEMS[held]?.tool === 'pick') {
        const h = surfaceHit(2.5);
        if (!h || h.water) return false;
        if (Math.abs(h.ground - world.terrain.waterLevel) <= CLAY_SHORE) { if (give('clay', between(1, 2))) wear(); return true; }
        const t = world.terrain.tileAt(h.x, h.z); // 草地（砂浜・坂・崖でない所）なら土
        if (!t || t.min < 1.5 || t.max - t.min > 0.5) return false;
        if (give('soil', between(1, 2))) wear();
        return true;
      }
      return false;
    },
    // Q: 手に持つ物を 1 個投げる（physics.md「落ちた物・投げた物」）
    throwHeld() {
      const s = inventory.held();
      if (!s || !world?.physics) return false;
      look();
      throwItem(world, s, o, d);
      if (!--s.n) inventory.slots[inventory.sel] = null;
      inventory.changed();
      return true;
    },
    // 釣りの今の様子（照準の下のヒント用）: null / 'wait' / 'bite'
    get fishing() { return cast?.phase ?? null; },
    hitTarget,
    update(dt, held) {
      if (!cast) return;
      camera.getWorldPosition(o);
      if (held !== 'fishingRod' || Math.hypot(o.x - cast.x, o.z - cast.z) > KEEP_RANGE) return endCast();
      cast.t -= dt;
      lure.position.y = cast.y + (cast.phase === 'bite' ? -0.12 : Math.sin(performance.now() / 300) * 0.02);
      if (cast.t > 0) return;
      if (cast.phase === 'wait') { cast.phase = 'bite'; cast.t = BITE; onMessage('かかった！'); }
      else { onMessage('逃げられた'); endCast(); }
    },
  };
}
