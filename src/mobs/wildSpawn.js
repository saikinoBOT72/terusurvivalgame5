// 自然湧き（docs/rules/islands.md「敵の出方」）。範囲の表は islandMap.js の wild
// 範囲ごとに、生きている数（組）が上限より少なければ、間隔（幅の中のランダム）ごとに 1 組出す。夜と昼（5 日目から）で上限が違う
// 出る所: 範囲の円の中の、その区域の字の、プレイヤーから NEAR〜FAR m の立てる場所。強さは固定湧きと同じ
import { DAY_LEN } from '../world/dayNight.js';
import { MOBS } from './mobTypes.js';

const NEAR = 30, FAR = 90; // プレイヤーからの距離
const LOST = 150; // これより遠く、戦っていなければ消す（上限が空いて、また出る）
const MORNING = 30; // 昼・夜が変わって上限より多いとき、これより遠いものから消す
const DAY_FROM = 5; // この日から昼も出る

export function createWildSpawner({ combat, time, player }) {
  let world = null, ranges = []; // { def, next: 次に出せる時刻（秒）}
  let clock = 0, t = 0;
  const p = () => player.state;
  const dist = (x, z) => Math.hypot(x - p().x, z - p().z);
  const day = () => Math.floor(time.total / DAY_LEN) + 1;
  const cap = (w) => (time.isNight ? w.night : day() >= DAY_FROM ? w.day : 0);
  const wait = (w) => w.every[0] + Math.random() * (w.every[1] - w.every[0]);
  const live = (rg) => combat.list.filter((m) => m.wild === rg && m.state !== 'down');
  const groups = (rg) => new Set(live(rg).map((m) => m.wildGroup)).size;

  // 範囲の中の、区域の字の、プレイヤーから NEAR〜FAR m の立てる場所（なければ null）
  function place(w, kind) {
    const T = world.terrain, swim = MOBS[kind].swim;
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * w.r, x = w.x + Math.sin(a) * d, z = w.z + Math.cos(a) * d, pd = dist(x, z);
      if (pd < NEAR || pd > FAR || !w.zones.includes(world.zoneAt(x, z))) continue;
      if (T.heightAt(x, z) < T.waterLevel - (swim ? 0.3 : -0.1) || world.colliders(x, z, 0.6).length) continue;
      return { x, z };
    }
    return null;
  }

  let gid = 0;
  return {
    setWorld(w) {
      world = w?.wild ? w : null;
      ranges = world ? world.wild.map((def) => ({ def, next: Math.random() * def.every[0] })) : [];
      clock = 0;
    },
    // 昼・夜が変わった: 上限より多い分を、戦っていない遠いものから消す
    onPeriod() {
      for (const rg of ranges) {
        let over = groups(rg) - cap(rg.def);
        if (over <= 0) continue;
        const byGroup = new Map();
        for (const m of live(rg)) (byGroup.get(m.wildGroup) ?? byGroup.set(m.wildGroup, []).get(m.wildGroup)).push(m);
        for (const ms of byGroup.values()) {
          if (over <= 0) break;
          if (ms.some((m) => m.aware === 'fight' || dist(m.x, m.z) <= MORNING)) continue;
          ms.forEach((m) => combat.remove(m)); over--;
        }
      }
    },
    update(dt) {
      clock += dt;
      if (!world || (t += dt) < 1) return; // 1 秒ごと
      t = 0;
      for (const m of [...combat.list]) if (m.wild && m.aware !== 'fight' && dist(m.x, m.z) > LOST) combat.remove(m);
      for (const rg of ranges) {
        const w = rg.def;
        if (dist(w.x, w.z) > w.r + FAR) continue; // プレイヤーが遠い範囲からは出ない
        if (groups(rg) >= cap(w)) { rg.full = true; continue; }
        if (rg.full) { rg.full = false; rg.next = clock + wait(w); } // 空いたら（倒した・夜になった）間隔だけ待つ
        if (clock < rg.next) continue;
        const [kind, n] = w.mobs[Math.floor(Math.random() * w.mobs.length)], at = place(w, kind);
        if (!at) continue;
        const g = ++gid;
        for (let k = 0; k < n; k++) {
          const m = combat.spawn(kind, at.x + k * 1.5, at.z + k * 1.2);
          m.wild = rg; m.wildGroup = g;
        }
        rg.next = clock + wait(w);
        break; // 1 回に 1 組
      }
    },
    // 確認用: プレイヤーから届く範囲と、範囲ごとの 数/上限
    get counts() {
      if (!world) return 'なし';
      const near = ranges.filter((rg) => dist(rg.def.x, rg.def.z) <= rg.def.r + FAR);
      return near.length ? near.map((rg) => `${rg.def.name} ${groups(rg)}/${cap(rg.def)}${groups(rg) < cap(rg.def) ? `(${Math.max(0, Math.ceil(rg.next - clock))}秒)` : ''}`).join(' ') : '届く範囲なし';
    },
  };
}
