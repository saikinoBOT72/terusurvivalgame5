// クリップで動く銃（docs/rules/weapons.md「銃の仕組み」）: gun-export の動き（survival/gunClips/）を AnimationMixer で 1 つずつ流し、構えの入れ物と手の行き先を決める
// 組み方: 画角合わせ（x・y を f 倍）→ 構えの入れ物（README の向き。腰だめ・覗き込み・kick・持ち替え・歩く揺れ）→ 裏返し（Y に 180°・vm.scale）→ 銃の一番上のノード（クリップだけが動かす）
import * as THREE from 'three';

const GUN_FOV = [58, 50]; // vm の値を決めたときの銃のカメラの縦の画角（腰だめ・覗き込み）
const D2R = Math.PI / 180;
const PAW = 0.15; // 猫の手（fpHands.js の handGeo）のだいたいの太さ（m）
const clipCache = new WeakMap();

// データ → AnimationClip。位置・回転は線で、大きさ（隠れている部品の出し入れ）は段でつなぐ
export function clipsOf(data) {
  if (clipCache.has(data)) return clipCache.get(data);
  const out = {};
  for (const [name, c] of Object.entries(data.clips)) {
    const tracks = c.tracks.map(([node, k, t, v]) => k === 'q' ? new THREE.QuaternionKeyframeTrack(`${node}.quaternion`, t, v)
      : new THREE.VectorKeyframeTrack(`${node}.${k === 'p' ? 'position' : 'scale'}`, t, v, k === 's' ? THREE.InterpolateDiscrete : THREE.InterpolateLinear));
    out[name] = new THREE.AnimationClip(name, c.dur, tracks);
  }
  clipCache.set(data, out);
  return out;
}

// 形（akRig など）をクリップで動かせるようにする: ノードの名前、止まっている形、左手の lhand、右手の握り gripR・左手 handL
export function prepRig(rig, data) {
  if (rig.userData.prepped) return rig;
  rig.name = data.root;
  for (const k of ['carrier', 'mag', 'trigger']) if (rig.userData[k]) rig.userData[k].name = k;
  const lhand = new THREE.Object3D();
  lhand.name = 'lhand';
  rig.add(lhand);
  for (const [name, r] of Object.entries(data.rest)) {
    const o = rig.getObjectByName(name);
    if (o) { o.position.fromArray(r.p); o.quaternion.fromArray(r.q); }
  }
  const anchor = (parent, at) => { const o = new THREE.Object3D(); o.position.fromArray(at); parent.add(o); return o; };
  Object.assign(rig.userData, { lhand, gripR: anchor(rig, data.hands.R), handL: anchor(lhand, data.hands.L), prepped: true });
  return rig;
}

// 一度に 1 つ流す（README の切り替えの決まり）。update が返す出来事は、流れた時刻が通り過ぎたフレームに 1 回ずつ
export function createClipPlayer(rig, data) {
  const mixer = new THREE.AnimationMixer(rig), clips = clipsOf(data), events = [];
  let cur = null; // { name, action, last 前のフレームの時刻 }
  function play(name, timeScale = 1) {
    if (!clips[name]) return false;
    if (name === 'inspect' && cur?.name === 'reload') return false; // 込め直し中は眺めない
    cur?.action.stop(); // fire は inspect・equip を、reload は inspect を、equip は全部を止める（1 つずつなので、どれも今のを止める）
    const a = mixer.clipAction(clips[name]);
    a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = false; a.timeScale = timeScale; a.play();
    cur = { name, action: a, last: -1 };
    return true;
  }
  return {
    play,
    stop() { cur?.action.stop(); cur = null; },
    get name() { return cur?.name ?? null; },
    get time() { return cur?.action.time ?? 0; },
    // 開発用: name を t 秒の所で止めて見る
    poseAt(name, t) { play(name); cur.action.paused = true; cur.action.time = t; mixer.update(0); cur.last = t; },
    update(dt) {
      events.length = 0;
      if (!cur) return events;
      mixer.update(dt);
      const a = cur.action, t = a.isRunning() || a.paused ? a.time : data.clips[cur.name].dur;
      for (const [at, ev] of data.clips[cur.name].events) if (at > cur.last && at <= t) events.push(ev);
      cur.last = t;
      if (!a.isRunning() && !a.paused) cur = null;
      return events;
    },
  };
}

// 照準（後ろのみぞ rear・前の先 front。形の向き）を結ぶ線がカメラの真ん中を通る、入れ物の向き（YXZ）と位置
function adsPose(sight, scale, z) {
  const flip = (p) => new THREE.Vector3(-p[0], p[1], -p[2]).multiplyScalar(scale);
  const rear = flip(sight.rear), dir = flip(sight.front).sub(rear).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(dir, new THREE.Vector3(0, 0, -1));
  rear.applyQuaternion(q);
  return { rot: new THREE.Euler().setFromQuaternion(q, 'YXZ'), pos: new THREE.Vector3(-rear.x, -rear.y, z) };
}

// 1人称で持つ: root（fpHands の root）の中に入れ物を作る。手の行き先は root の中の位置と向きで返す
export function createClipGun(root) {
  const fovG = new THREE.Group(), holder = new THREE.Group(), flip = new THREE.Group();
  holder.rotation.order = 'YXZ';
  flip.rotation.y = Math.PI;
  fovG.add(holder); holder.add(flip); root.add(fovG);
  fovG.visible = false;
  let rig = null, def = null, player = null, ads = null, kick = 0, equipK = 0;
  const out = { handK: 1, events: [], R: { p: new THREE.Vector3(), q: new THREE.Quaternion() }, L: { p: new THREE.Vector3(), q: new THREE.Quaternion() } };
  const inv = new THREE.Matrix4(), m = new THREE.Matrix4(), s = new THREE.Vector3();
  const toRoot = (o, dst) => { m.multiplyMatrices(inv, o.matrixWorld).decompose(dst.p, dst.q, s); };

  return {
    get active() { return !!rig; },
    get rig() { return rig; },
    get clip() { return player?.name ?? null; },
    // obj: 形（null で外す）、d: { data クリップのデータ, sight 照準 }
    attach(obj, d) {
      player?.stop();
      flip.clear();
      rig = player = null;
      fovG.visible = !!obj;
      if (!obj) return;
      def = d; rig = prepRig(obj, d.data);
      flip.scale.setScalar(d.data.vm.scale);
      flip.add(rig);
      player = createClipPlayer(rig, d.data);
      ads = adsPose(d.sight, d.data.vm.scale, d.data.vm.ads[2]);
      equipK = 1; kick = 0;
      player.play('equip');
    },
    fire() { kick = THREE.MathUtils.clamp(def.data.recoil / 0.022, 1, 2.2); player.play('fire'); },
    reload(secs) { player.play('reload', def.data.clips.reload.dur / secs); },
    inspect() { return player.play('inspect'); },
    poseAt(name, t) { player.poseAt(name, t); }, // 開発用
    dur: (name) => def.data.clips[name]?.dur ?? 1,
    // aim: 覗き込みの進み 0〜1、bob: 歩く揺れ [x, y, z]、cam: カメラ（画角と拡大）
    update(dt, aim, bob, cam) {
      out.events = player.update(dt);
      kick = Math.max(0, kick - dt * 9);
      equipK = Math.max(0, equipK - dt * 2.2);
      const vm = def.data.vm;
      // 画角合わせ: 今の縦の画角（覗き込みの拡大も）で、vm の画角のときと同じ所に見えるように x・y を広げる
      const now = Math.atan(Math.tan(cam.fov * D2R / 2) / cam.zoom), gunFov = (GUN_FOV[0] + (GUN_FOV[1] - GUN_FOV[0]) * aim) * D2R / 2;
      const f = Math.tan(now) / Math.tan(gunFov);
      fovG.scale.set(f, f, 1);
      const hs = def.data.hands.size;
      out.handK = (hs[0] + hs[1] + hs[2]) / 3 * vm.scale * f / PAW; // 手を export の手と同じくらいの大きさに
      holder.position.set(
        vm.hip[0] + (ads.pos.x - vm.hip[0]) * aim + bob[0],
        vm.hip[1] + (ads.pos.y - vm.hip[1]) * aim + bob[1] - equipK * 0.35,
        vm.hip[2] + (ads.pos.z - vm.hip[2]) * aim + bob[2] + kick * 0.07,
      );
      holder.rotation.set(
        vm.rotYXZ[0] + (ads.rot.x - vm.rotYXZ[0]) * aim + kick * 0.22 - equipK * 0.6,
        vm.rotYXZ[1] + (ads.rot.y - vm.rotYXZ[1]) * aim,
        vm.rotYXZ[2] + (ads.rot.z - vm.rotYXZ[2]) * aim,
      );
      // 手: root の中の位置と向き（root の古い行列どうしで割るので、このフレームの分だけが残る）
      fovG.updateMatrixWorld(true);
      inv.copy(root.matrixWorld).invert();
      toRoot(rig.userData.gripR, out.R);
      toRoot(rig.userData.handL, out.L);
      return out;
    },
  };
}
