// 1人称の視点と移動。
// state（位置・向き・動き）は見た目と分けて持つ。あとでマルチプレイで同期する情報。
import { createFpHands } from '../avatar/simple.js'; // 仮のキャラ。猫に戻すときは cat.js の createFpArms

export const BODY = 0.8; // 体の大きさ（2026-10-16 に 1 → 0.8。速さ・跳ぶ高さ・目と頭の高さ・太さもこれに合わせる。player.md）
const SPEED = 3.6 * BODY;     // 歩く速さ（m/秒）
const GRAVITY = 14;
const JUMP = 5.2 * Math.sqrt(BODY); // 約 0.8m 跳べる（跳ぶ高さは速さの 2 乗に比例）
const RADIUS = 0.3 * BODY;    // 体の太さ（木や岩との当たり判定）
const STEP_UP = 0.5;   // これ以下の高さの物には、歩くだけで乗れる（docs/rules/player.md）
const HEAD = 1.3 * BODY;      // 頭の高さ（これより上にある物の下はくぐれる）
const DEEP = 1.2 * BODY;      // これより深い水では泳ぐ（player.md「泳ぐ」）
const FLOAT = 1.1 * BODY - 0.15; // 浮いているときの、水面から足元までの深さ（目が水面の 0.15m 上）
const SWIM_UP = 1.8, SWIM_DOWN = 1.5; // Space で上へ・Shift で潜る速さ（m/秒）
const SWIM_STEP = 1.2; // 泳いでいるときに上がれる高さ（岸・いかだ・土台）
export const VIEW_LAYER = 1; // 1人称の腕と持つ物の描画の層

// onLand(h): 着地したとき。h は落ちた高さ（宙にいる間の一番高い所から）
export function createFirstPerson({ camera, dom, eyeHeight = 1.1 * BODY, onLand = () => {} }) {
  // wish: 歩こうとしている向き（単位ベクトル。止まっていれば 0）。いかだを押すのに使う（vehicles.js）
  // ride: 舵を持っている・小舟に座っている間 {v, kind}。その間は歩かず、位置は乗り物が決める（vehicles.js）
  // swimming: 深い水で泳いでいる、underwater: 目が水の中（息が減る。stats.js）
  // slow: 歩く速さの倍率（ため・ガード・覗き込みで 0.5。weapons.md）
  const state = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, vy: 0, onGround: true, moving: false, wish: { x: 0, z: 0 }, ride: null, swimming: false, underwater: false, slow: 1 };
  const view = { shake: 0, secs: 0.25, amp: 0, kick: 0, freq: 22, roll: 0, t: 0 }; // 画面の揺れ（受けたとき。速さ freq・横の傾き roll）と反動（銃）。weapons.md
  let bodies = () => []; // 敵の体（combat.js の bodies。setBodies でつなぐ）
  let shove = null; // ステップ・押し戻し: { x, z, v 速さ, t 残りの秒 }
  const keys = {};
  let top = null;
  let active = false, terrain = null, colliders = () => [], sens = 0.0022; // sens: マウス 1 ピクセルで回る角度（ラジアン。設定の感度から。settings.js の sensRad）

  camera.rotation.order = 'YXZ';
  const arms = createFpHands();
  arms.root.visible = false;
  // 腕と持つ物は別の層で、世界のあとに重ねて描く（壁や地面にめり込んで見えないように。main.js の描画）
  const toView = (o) => o?.traverse((c) => c.layers.set(VIEW_LAYER));
  toView(arms.root);
  const hold = arms.hold;
  arms.hold = (obj, ...a) => { toView(obj); hold(obj, ...a); };
  camera.add(arms.root);

  addEventListener('keydown', (e) => { if (!active) return; keys[e.code] = true; if (import.meta.env.DEV && e.code === 'KeyF' && !e.repeat) state.fly = !state.fly; }); // 開発用: F で飛行（Space 上・Shift 下・3 倍速）
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  // マウスの固定直後や、ブラウザの不具合で極端に大きい移動量が来ることがあるので捨てる
  let skip = 0;
  document.addEventListener('pointerlockchange', () => { skip = 2; });
  addEventListener('mousemove', (e) => {
    if (!active || document.pointerLockElement !== dom) return;
    if (skip > 0) { skip--; return; }
    if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return;
    state.yaw -= e.movementX * sens;
    state.pitch = Math.max(-1.45, Math.min(1.45, state.pitch - e.movementY * sens));
  });

  function free(x, z) {
    const { x0, z0, w, d } = terrain.bounds;
    if (x < x0 + RADIUS || z < z0 + RADIUS || x > x0 + w - RADIUS || z > z0 + d - RADIUS) return false;
    // 物: てっぺんが足元より上がれる高さ以上ならぶつかる（ジャンプで上に来ていれば通れる）
    return !colliders(x, z, RADIUS).some((c) => c.top - state.y > stepUp() + 0.02 && (c.bottom ?? -1e9) < state.y + HEAD);
  }
  // 上がれる高さ: 泳いでいるときは水から岸・いかだへ上がれるよう高い
  const stepUp = () => (state.swimming ? SWIM_STEP : STEP_UP);
  // 地面（ブロックの地形、player.md）: 足元の床は「今の足の高さ＋上がれる高さ」より下のいちばん高い床。
  // それより高い壁（崖）や、頭が当たる天井（洞窟・ひさし）へは進めない。
  // 体のまわり（半径 RADIUS の 8 点）も同じに調べて、崖・天井の面にカメラが近づきすぎないようにする
  const RING = [...Array(8)].map((_, i) => [Math.cos(i * Math.PI / 4) * RADIUS, Math.sin(i * Math.PI / 4) * RADIUS]);
  const floorOf = (x, z, y = state.y) => terrain.floorAt(x, y + stepUp() + 0.02, z);
  // (x, z) に足の高さ y で立てないか（壁の中・天井が低い）
  const blocked = (x, z, y) => {
    const f = floorOf(x, z, y);
    if (f > y + stepUp() + 0.02) return true;
    const b = Math.max(y, f); // 坂の上では、その点の床から上を調べる
    return terrain.ceilingAt(x, b + 0.05, z) < b + HEAD;
  };
  const ringBad = (x, z, y) => RING.reduce((n, [ox, oz]) => n + blocked(x + ox, z + oz, y), 0);
  function canStep(x, z) {
    const g = floorOf(x, z), y = Math.max(g, state.y);
    if (blocked(x, z, y)) return false;
    const bad = ringBad(x, z, y);
    if (!bad) return true;
    // 壁の面にふれている（上から落ちてきた）: 今より悪くならない向きなら進める
    return bad <= ringBad(state.x, state.z, Math.max(floorOf(state.x, state.z), state.y));
  }
  // 頭の上の物（床・屋根・地形の天井）: ジャンプで頭が入り込まないように止める
  function ceilingAt(x, z, from) {
    let c = terrain.ceilingAt(x, from - 0.02, z);
    for (const k of colliders(x, z, RADIUS)) if (k.bottom != null && k.bottom >= from - 0.02) c = Math.min(c, k.bottom);
    return c;
  }
  // 足元の高さ: 地面か、乗っている物のてっぺんの高い方
  function groundAt(x, z) {
    let g = floorOf(x, z);
    for (const c of colliders(x, z, 0)) if (c.top <= state.y + stepUp() + 0.02) g = Math.max(g, c.top);
    return g;
  }
  // 壁にめり込んだとき（壁ぎりぎりに上から落ちた、閉まるドアなど）: 1 歩では抜けられないので、いちばん近い空いた所へ出す
  function unstick() {
    if (free(state.x, state.z)) return;
    for (let r = 0.05; r <= 1; r += 0.05) {
      for (let i = 0; i < 16; i++) {
        const nx = state.x + Math.cos(i * Math.PI / 8) * r, nz = state.z + Math.sin(i * Math.PI / 8) * r;
        if (free(nx, nz) && canStep(nx, nz)) { state.x = nx; state.z = nz; return; }
      }
    }
  }
  function tryMove(dx, dz) {
    for (const [mx, mz] of [[dx, dz], [dx, 0], [0, dz]]) { // まっすぐ → 横すべり
      const nx = state.x + mx, nz = state.z + mz;
      if (free(nx, nz) && canStep(nx, nz)) { state.x = nx; state.z = nz; return; }
    }
  }

  // カメラを体の位置へ。揺れと反動を足す
  function place() {
    const e = view.shake > 0 ? view.shake / view.secs : 0, k = view.amp * e * 0.5, a = view.t * view.freq * Math.PI * 2;
    camera.position.set(state.x + Math.sin(a) * k, state.y + eyeHeight + Math.sin(a * 1.31 + 2) * k, state.z + Math.sin(a * 0.77 + 4) * k);
    camera.rotation.set(state.pitch + view.kick, state.yaw, view.roll * Math.sin(Math.PI / 2 * Math.min(1, (1 - e) * 4 + 0.1)) * e ** 0.7); // 横の傾き: すぐ傾いてゆっくり戻る
  }

  function update(dt) {
    view.shake = Math.max(0, view.shake - dt);
    view.t += dt;
    view.kick *= Math.exp(-dt * 12); // 反動は 0.2 秒ほどで戻る
    if (!active || !terrain) { arms.update(dt, false); return; }
    if (state.ride) { // 乗っている間: 見回すだけ
      state.moving = false;
      state.wish.x = state.wish.z = 0;
      state.vy = 0;
      state.onGround = true;
      top = null;
      place();
      arms.update(dt, false);
      return;
    }
    if (!state.fly) unstick();
    let f = 0, s = 0;
    if (keys.KeyW) f += 1;
    if (keys.KeyS) f -= 1;
    if (keys.KeyD) s += 1;
    if (keys.KeyA) s -= 1;
    const len = Math.hypot(f, s);
    state.moving = len > 0;
    state.wish.x = state.wish.z = 0;
    if (state.moving) {
      const sp = SPEED * state.slow * (state.fly ? 3 : state.swimming ? 0.5 : state.y < terrain.waterLevel - 0.1 ? 0.6 : 1) * dt / len; // 水の中は遅い
      const sy = Math.sin(state.yaw), cy = Math.cos(state.yaw);
      state.wish.x = (-sy * f + cy * s) / len;
      state.wish.z = (-cy * f - sy * s) / len;
      tryMove(state.wish.x * len * sp, state.wish.z * len * sp);
    }
    if (state.fly) { // 開発用の飛行: 重力・水・落下ダメージなし
      state.vy = (keys.Space ? 1 : 0) - (keys.ShiftLeft || keys.ShiftRight ? 1 : 0);
      state.y = Math.max(state.y + state.vy * SPEED * 3 * dt, terrain.floorAt(state.x, state.y, state.z));
      state.swimming = state.underwater = false;
      state.onGround = false;
      top = null;
      place();
      arms.update(dt, false);
      return;
    }
    // 泳ぐ: 深い水で、足が水面より下（いかだ・土台の上に立っていれば泳がない）
    const wl = terrain.waterLevel, gh = groundAt(state.x, state.z);
    state.swimming = wl - floorOf(state.x, state.z) > DEEP && state.y < wl - 0.3 && gh < wl - 0.3;
    if (state.swimming) {
      swim(dt, gh);
      place();
      state.underwater = state.y + eyeHeight < wl;
      arms.update(dt, false);
      return;
    }
    state.underwater = false;
    if (shove) { // ステップ・押し戻し
      const d = Math.min(shove.t, dt) * shove.v;
      tryMove(shove.x * d, shove.z * d);
      if ((shove.t -= dt) <= 0) shove = null;
    }
    if (keys.Space && state.onGround) { state.vy = JUMP; state.onGround = false; }

    // 重力と地面
    state.vy -= GRAVITY * dt;
    const headY = state.y + HEAD;
    state.y += state.vy * dt;
    if (state.vy > 0) {
      const c = ceilingAt(state.x, state.z, headY);
      if (state.y + HEAD > c) { state.y = c - HEAD; state.vy = 0; }
    }
    if (state.y <= gh) { state.y = gh; state.vy = 0; state.onGround = true; }
    else if (state.onGround && state.vy <= 0 && state.y - gh < 0.3) { state.y = gh; state.vy = 0; } // 下り坂に沿う
    else state.onGround = false;
    if (!state.onGround) top = Math.max(top ?? state.y, state.y);
    else if (top !== null) { onLand(top - state.y); top = null; }

    place();
    arms.update(dt, state.moving && state.onGround, state.slow);
  }

  // 泳ぐ: ふつうは浮く（目が水面の上）。Space で上へ、Shift で潜る。水の底より下へは行かない。落ちてきても水ならダメージなし
  function swim(dt, gh) {
    const floatY = terrain.waterLevel - FLOAT;
    state.vy = keys.Space ? SWIM_UP : keys.ShiftLeft || keys.ShiftRight ? -SWIM_DOWN : Math.max(-1, Math.min(1, (floatY - state.y) * 2));
    state.y = Math.min(state.y + state.vy * dt, Math.max(floatY + 0.05, state.y));
    if (state.y <= gh) { state.y = gh; state.vy = 0; }
    state.onGround = false;
    top = null;
  }

  return {
    state, arms, keys, // keys: 押しているキー（乗り物の操作に使う）
    setSensitivity(k) { sens = k; },
    // (x, z) の向きへ dist m を secs 秒で動かす（ステップ・押し戻し）
    shove(x, z, dist, secs) { const l = Math.hypot(x, z) || 1; shove = { x: x / l, z: z / l, v: dist / secs, t: secs }; },
    setBodies(fn) { bodies = fn; },
    shake(amp, secs = 0.25, kick = 0, { freq = 22, roll = 0 } = {}) { view.amp = view.shake > 0 ? Math.max(view.amp, amp) : amp; view.shake = view.secs = secs; view.kick += kick; view.freq = freq; view.roll = roll; },
    kick(rad) { view.kick += rad; }, // 反動で視点が上へはねる
    get shoving() { return !!shove; },
    lift(v) { if (state.ride || state.swimming) return; state.vy = Math.max(state.vy, v); state.onGround = false; }, // 上へ浮かせる（吹き飛ばし）
    update,
    setActive(v) {
      active = v;
      arms.root.visible = v;
      for (const k in keys) keys[k] = false;
    },
    // 歩く世界を切り替えて、スタート地点に立つ。structures: その世界の建築パーツ
    setWorld(world, structures) {
      terrain = world.terrain;
      colliders = (x, z, r) => world.colliders(x, z, r).concat(structures.query(x, z, r), world.vehicles?.query(x, z, r) ?? [], bodies(x, z, r)); // いかだの形も。敵の体も（player.md）
      const { x, z, yaw = 0 } = world.spawn;
      Object.assign(state, { x, z, y: terrain.heightAt(x, z), yaw, pitch: 0, vy: 0, onGround: true, ride: null });
      top = null;
    },
  };
}
