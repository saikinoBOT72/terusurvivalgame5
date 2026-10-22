// 音の土台（docs/rules/sound.md）: 音のファイルは使わず Web Audio で作る。最初のクリックで始める、全体の音量、鳴らす場所で小さく・左右に振り分ける
import * as THREE from 'three';

let ctx = null, master = null, vol = 0.7, noiseBuf = null;
const ear = { p: new THREE.Vector3(), right: new THREE.Vector3(1, 0, 0) };
const q = new THREE.Quaternion(), d = new THREE.Vector3();
const NEAR = 2, FAR = 80; // ここまではそのまま、ここより遠いと鳴らさない（m）

export const sound = {
  // ブラウザは一度クリックするまで音を出せない: クリック（マウスを捕まえたとき）で呼ぶ
  start() {
    if (!ctx) {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = vol;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); // 雑音のもと（1 秒。1 回だけ作る）
      const a = noiseBuf.getChannelData(0);
      for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  },
  setVolume(v) { vol = v; if (master) master.gain.value = v; },
  // 聞く人（カメラ）の位置と右の向き。毎フレーム
  setListener(camera) {
    camera.getWorldPosition(ear.p);
    ear.right.set(1, 0, 0).applyQuaternion(camera.getWorldQuaternion(q));
  },
  get ctx() { return ctx?.state === 'running' ? ctx : null; },
  get noise() { return noiseBuf; },
  // 鳴らす先のノード（音量と左右を決めてある）。at: 世界の位置（なければ自分の音）。secs のあとで外す。鳴らせなければ null
  out(at, gain = 1, secs = 1) {
    if (ctx?.state !== 'running') return null;
    let g = gain, pan = 0;
    if (at) {
      const dist = d.copy(at).sub(ear.p).length();
      if (dist > FAR) return null;
      if (dist > NEAR) g *= NEAR / dist;
      if (dist > 0.01) pan = THREE.MathUtils.clamp(d.dot(ear.right) / dist, -1, 1) * 0.8;
    }
    const gn = ctx.createGain(), pn = ctx.createStereoPanner();
    gn.gain.value = g; pn.pan.value = pan;
    gn.connect(pn).connect(master);
    setTimeout(() => pn.disconnect(), (secs + 0.2) * 1000);
    return gn;
  },
};
