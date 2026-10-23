// 点の光の使い回し（docs/rules/style.md「描き方の決まり」）: PointLight は決まった数（N）だけ作って、ずっと置いておく
// 光の数が変わると全部の材質の作り直しになって止まるため。たき火・松明・光るキノコは「光の元」を登録し、目に近い順に光を割り当てる
// 割り当てを替えるときは、強さを少しずつ下げてから移し、少しずつ上げる（ちらつかない）
import * as THREE from 'three';

const N = 2, FADE = 4; // 光の数、切り替えの速さ（1 秒で 4 = 0.25 秒）
const sources = new Set(), slots = [];
const _p = new THREE.Vector3();

// 光の元を登録する。obj: 光る位置の物（世界の位置を毎フレーム読む。シーンから外れたら使わない）
// o: { color, intensity（数か、t を受けて返す関数）, distance, decay, y（obj からの高さ） }。戻り値の remove() で外す
export function lightSource(obj, o) {
  const s = { obj, color: new THREE.Color(o.color), intensity: o.intensity, distance: o.distance, decay: o.decay ?? 2, y: o.y ?? 0, on: true, seen: false };
  sources.add(s);
  s.remove = () => sources.delete(s);
  return s;
}

// シーンに N 個の光を置く（main.js が 1 回）
export function createLightPool(scene) {
  for (let i = 0; i < N; i++) {
    const l = new THREE.PointLight(0xffffff, 0, 1, 2);
    l.layers.enable(1); // 1人称の腕の層も照らす
    scene.add(l);
    slots.push({ l, src: null, k: 0 });
  }
  // 1: 見えている（自分と親が全部 visible で、シーンまでつながっている）、0: 隠れている、-1: シーンから外れている
  const live = (s) => {
    let o = s.obj, shown = true;
    for (; o; o = o.parent) { if (!o.visible) shown = false; if (o.isScene) return shown ? 1 : 0; }
    return -1;
  };
  const strength = (s, t) => (typeof s.intensity === 'function' ? s.intensity(t) : s.intensity);
  return {
    lights: slots.map((x) => x.l), // 1人称の腕の光に写す（game/renderer.js）
    get count() { return slots.filter((x) => x.src && x.k > 0).length; }, // 調べる用: 光っている数
    update(t, dt, cam) {
      // 近い順の N 個を選ぶ（届く距離より遠い元は選ばない）
      const near = [];
      for (const s of sources) {
        const lv = live(s), on = s.on && lv === 1;
        if (lv >= 0) s.seen = true; else if (s.seen) { sources.delete(s); continue; } // 一度シーンに入ってから外れた物（壊したたき火・持ち替えた松明）は忘れる
        if (!on || !(strength(s, t) > 0)) continue;
        s.obj.getWorldPosition(_p);
        s.pos = (s.pos ?? new THREE.Vector3()).set(_p.x, _p.y + s.y, _p.z);
        const d = s.pos.distanceTo(cam);
        if (d < s.distance + 25) near.push({ s, d });
      }
      near.sort((a, b) => a.d - b.d);
      const want = near.slice(0, N).map((x) => x.s);
      for (const sl of slots) {
        if (sl.src && want.includes(sl.src)) sl.k = Math.min(1, sl.k + dt * FADE);
        else if (sl.k > 0) sl.k = Math.max(0, sl.k - dt * FADE);
        else sl.src = null;
      }
      for (const s of want) { // 空いた光に、まだ割り当てていない元を入れる
        if (slots.some((sl) => sl.src === s)) continue;
        const sl = slots.find((x) => !x.src);
        if (sl) { sl.src = s; sl.k = 0; }
      }
      for (const { l, src, k } of slots) {
        if (!src) { l.intensity = 0; continue; }
        l.position.copy(src.pos ?? l.position);
        l.color.copy(src.color);
        l.distance = src.distance;
        l.decay = src.decay;
        l.intensity = strength(src, t) * k;
      }
    },
  };
}
