// 敵の出方（docs/rules/islands.md「敵の出方」）。島ごとの表は islandMap.js の spawns
// 夜の敵: プレイヤーの近くの決まった区域に出る。朝に消える（5 日目からは昼も半分）。倒した分は次の夜に戻る
// いつもいる敵: 決まった場所・スポットの番人（spot。enemies.md「番人」）。倒した時刻をセーブし、back 日で戻る（null は戻らない）
// 夜に来る番人（spot と when: night）: 夜、スポットのそばの見えない所に出て、スポットまで歩く。朝に消える
// 呼ばれて来る敵: 監視カメラの警報で、カメラから 40m の所にブンブン 3 体（call）
import { DAY_LEN } from '../world/dayNight.js';
import { MOBS } from './mobTypes.js';

const NEAR = 30, FAR = 90; // 夜の敵が出る、プレイヤーからの距離
const LOST = 150; // これより遠く、戦っていなければ消して出し直す
const MORNING = 30; // 朝に消える距離
const BACK_AWAY = 40; // いつもいる敵が戻るとき、プレイヤーがこれより離れていること
const SHOW = 70, HIDE = 100; // いつもいる敵は SHOW m 以内に入ったら出し、HIDE m より離れたら消す（倒した記録は残る。HP は戻る）
const EVERY = 2; // 出す間かく（秒）
const DAY_FROM = 5; // この日から昼も出る

const ORE_ITEM = { coal: 'coal', copper: 'copperOre', iron: 'ironOre' };

export function createSpawner({ combat, time, player }) {
  let world = null, t = 0, period = -1;
  const spent = new Map(); // 夜の敵: この夜（昼）に出した数
  let dead = {}; // いつもいる敵: 'kind:番号' → 倒した時刻（time.total）
  let fixed = []; // いつもいる敵の置き場所 { key, entry, x, z, ore, spot, yaw }

  const p = () => player.state;
  const dist = (x, z) => Math.hypot(x - p().x, z - p().z);
  const day = () => Math.floor(time.total / DAY_LEN) + 1;
  const want = (e) => (time.isNight ? e.n : e.spot ? 0 : day() >= DAY_FROM ? Math.ceil(e.n / 2) : 0); // 同時の数（組）。夜に来る番人は夜だけ

  // スポットの番人の置き場所 n か所。ore があれば、スポットの中のその鉱石の岩のそば。face: [x, z] があればそちらを向く
  function guardSpots(e, s) {
    if (e.ore) {
      const c = s.oreIn ?? { x: s.x, z: s.z, r: s.r }, rocks = world.resources.entries().filter((o) => o.kind === e.ore && Math.hypot(o.x - c.x, o.z - c.z) < c.r + 1);
      return Array.from({ length: Math.min(e.n, rocks.length) }, (_, i) => rocks[Math.floor((i + 0.5) * rocks.length / e.n)]).map((o) => ({ x: o.x + 1.3, z: o.z + 1.3, y: o.y + 1 }));
    }
    if (e.n === 1 && e.face) return [{ x: s.x, z: s.z, yaw: Math.atan2(e.face[0] - s.x, e.face[1] - s.z) }];
    const out = [], d = e.d ?? Math.min(5, s.r * 0.45);
    for (let k = 0; k < e.n; k++) {
      for (let tries = 0; tries < 12; tries++) {
        const a = (k / e.n) * Math.PI * 2 + 0.6 + tries * 0.4, x = s.x + Math.sin(a) * (d + tries * 0.4), z = s.z + Math.cos(a) * (d + tries * 0.4);
        if (world.colliders(x, z, 0.6).length || world.terrain.heightAt(x, z) < world.terrain.waterLevel - 0.1) continue;
        out.push({ x, z }); break;
      }
    }
    return out;
  }

  // プレイヤーから NEAR〜FAR m の、区域 zones の、立てる場所（なければ null）
  function spot(e) {
    const T = world.terrain, swim = MOBS[e.kind].swim;
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2, r = NEAR + Math.random() * (FAR - NEAR);
      const x = p().x + Math.sin(a) * r, z = p().z + Math.cos(a) * r;
      if (!e.zones.includes(world.zoneAt(x, z))) continue;
      if (T.heightAt(x, z) < T.waterLevel - (swim ? 0.3 : -0.1)) continue;
      if (world.colliders(x, z, 0.6).length) continue;
      return { x, z };
    }
    return null;
  }

  // (c.x, c.z) から d m の、プレイヤーから 25m より遠い、立てる場所。fly: 飛ぶ敵（水の上でもよい）
  function near(c, d, fly = false) {
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2, x = c.x + Math.sin(a) * d, z = c.z + Math.cos(a) * d;
      if (dist(x, z) < 25 || (!fly && world.terrain.heightAt(x, z) < world.terrain.waterLevel + 0.1) || world.colliders(x, z, 0.6).length) continue;
      return { x, z };
    }
    return null;
  }
  function placeFixed(f) {
    const m = combat.spawn(f.entry.kind, f.x, f.z, f.y);
    m.spawnKey = f.key;
    if (f.ore) m.extraDrops = [[ORE_ITEM[f.ore], 2, 2, 1]]; // その場の鉱石 2
    if (f.spot) guard(m, f.spot, f.entry.mode);
    if (f.yaw !== undefined) m.yaw = f.yaw;
    return m;
  }
  // 番人にする: スポットの中心から 35m であきらめる。mode: guard | sleep | visit | fake
  function guard(m, s, mode) {
    m.spot = s.n; m.spotC = { x: s.x, z: s.z }; m.giveUpR = 35; m.mode = mode;
    if (mode === 'sleep') m.asleep = !time.isNight;
  }

  return {
    setWorld(w) {
      world = w?.spawns ? w : null;
      spent.clear(); period = -1; fixed = [];
      if (!world) return;
      world.spawns.forEach((e, i) => {
        if (e.when !== 'always') return;
        if (e.at) fixed.push({ key: `${e.kind}:${i}:0`, entry: e, x: e.at.x, z: e.at.z });
        if (e.spot) { const s = world.spots.find((o) => o.n === e.spot); guardSpots(e, s).forEach((g, k) => fixed.push({ key: `${e.kind}:s${e.spot}:${k}`, entry: e, x: g.x, z: g.z, y: g.y, ore: e.ore, spot: s, yaw: g.yaw })); }
      });
    },
    // 監視カメラの警報: カメラから 40m の、プレイヤーから見えにくい所にブンブン 3 体。カメラへ飛び、そこから追う（30 秒見つけなければ消える）
    call(cam) {
      for (let k = 0; k < 3; k++) {
        const at = near({ x: cam.x, z: cam.z }, 40, true);
        if (!at) continue;
        const m = combat.spawn('drone', at.x, at.z);
        m.home = { x: cam.x + Math.sin(k * 2.1) * 2, z: cam.z + Math.cos(k * 2.1) * 2 }; m.state = 'return'; m.called = 30; m.model.setPose('move');
      }
    },
    // 倒した: いつもいる敵は時刻を残す
    onDead(m) { if (m.spawnKey) dead[m.spawnKey] = time.total; },
    update(dt) {
      if (!world || (t += dt) < EVERY) return;
      t = 0;
      const now = Math.floor(time.total / DAY_LEN) * 2 + (time.isNight ? 1 : 0); // 昼・夜の番号
      if (now !== period) { // 新しい昼・夜: 夜の敵は数え直し。昼に出ない敵は、遠くて戦っていなければ消える
        period = now;
        spent.clear();
        for (const m of [...combat.list]) {
          if (m.spawnEntry && !want(m.spawnEntry) && m.aware !== 'fight' && dist(m.x, m.z) > MORNING) combat.remove(m);
        }
      }
      // いつもいる敵: いなければ置く（倒されていれば back 日たってから、プレイヤーが離れているとき）。寝る番人は昼に寝る
      for (const f of fixed) {
        const live = combat.list.find((m) => m.spawnKey === f.key && m.state !== 'down');
        if (live?.mode === 'sleep' && live.aware === 'none' && live.state === 'idle' && !time.isNight) live.asleep = true;
        if (live?.asleep && time.isNight) live.asleep = false;
        if (live && live.aware !== 'fight' && dist(live.x, live.z) > HIDE && dist(f.x, f.z) > HIDE) combat.stash(live);
        else if (live) continue;
        if (dist(f.x, f.z) > SHOW) continue;
        const d = dead[f.key];
        if (d !== undefined && (f.entry.back == null || time.total - d < f.entry.back * DAY_LEN || dist(f.x, f.z) < BACK_AWAY)) continue;
        delete dead[f.key];
        placeFixed(f);
      }
      // 夜の敵: 遠くへ離れた物は消して出し直す。足りなければ 1 組出す
      for (const m of [...combat.list]) {
        if (m.spawnEntry && m.aware !== 'fight' && dist(m.x, m.z) > LOST) { combat.remove(m); spent.set(m.spawnEntry, Math.max(0, (spent.get(m.spawnEntry) ?? 0) - 1 / (m.spawnEntry.group ?? 1))); }
      }
      for (const e of world.spawns) {
        if (e.when !== 'night' || (spent.get(e) ?? 0) >= want(e) - 1e-6) continue;
        const s = e.spot && world.spots.find((o) => o.n === e.spot);
        const at = s ? near(s, 30) : spot(e);
        if (!at) continue;
        for (let k = 0; k < (e.group ?? 1); k++) {
          const m = combat.spawn(e.kind, at.x + k * 1.5, at.z + k * 1.2);
          m.spawnEntry = e;
          if (s) { guard(m, s, e.mode); m.home = { x: s.x + Math.sin(k * 2.4) * 3, z: s.z + Math.cos(k * 2.4) * 3 }; m.state = 'return'; m.model.setPose('move'); } // 夜に来る: スポットまで歩く
        }
        spent.set(e, (spent.get(e) ?? 0) + 1);
        break; // 2 秒に 1 組
      }
    },
    save: () => ({ dead }),
    load(d) { dead = { ...(d?.dead ?? {}) }; },
    get counts() { return world ? world.spawns.map((e) => `${MOBS[e.kind].name}${combat.list.filter((m) => m.kind === e.kind && m.state !== 'down').length}`).join(' ') : 'なし'; },
  };
}
