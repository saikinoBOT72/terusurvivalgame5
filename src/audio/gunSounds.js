// 銃の音（docs/rules/sound.md「銃の音」）: 銃声・込め直しの出来事・弾切れのカチッ・薬きょう。全部コードで作る
import { sound } from './sound.js';

// 銃声の値（sound.md の表）: 低い音の高さ f0 → f1（Hz）、尾の秒、破裂の明るさ（Hz）、大きさ
const SND = {
  rifle: { f0: 95, f1: 40, tail: 0.45, bright: 2400, vol: 1 },
  pistol: { f0: 140, f1: 55, tail: 0.3, bright: 3200, vol: 0.85 },
};

// 雑音をフィルターに通し、すぐ立ち上がって decay 秒で消える音
function burst(c, out, t, { type = 'bandpass', f = 2000, Q = 1, g = 1, decay = 0.05 }) {
  const s = c.createBufferSource(), fl = c.createBiquadFilter(), gn = c.createGain();
  s.buffer = sound.noise;
  fl.type = type; fl.frequency.value = f; fl.Q.value = Q;
  gn.gain.setValueAtTime(g, t);
  gn.gain.exponentialRampToValueAtTime(0.001, t + decay);
  s.connect(fl).connect(gn).connect(out);
  s.start(t, Math.random() * 0.5, decay + 0.02);
}
// 正弦波が f0 → f1 へ下がりながら decay 秒で消える音（ドン・響き・チャリン）
function tone(c, out, t, { f0, f1 = f0, g = 1, decay = 0.2, type = 'sine' }) {
  const o = c.createOscillator(), gn = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + decay * 0.6);
  gn.gain.setValueAtTime(g, t);
  gn.gain.exponentialRampToValueAtTime(0.001, t + decay);
  o.connect(gn).connect(out);
  o.start(t); o.stop(t + decay + 0.02);
}
const click = (c, out, t, f, g, decay = 0.02) => burst(c, out, t, { f, Q: 4, g, decay });
const clack = (c, out, t, f, g) => { click(c, out, t, f, g, 0.03); tone(c, out, t, { f0: f * 0.09, f1: f * 0.05, g: g * 0.6, decay: 0.07 }); }; // 金属の重い音

export const gunSounds = {
  // 銃声。kind: items.js の ranged.snd
  shot(kind = 'pistol', at = null) {
    const p = SND[kind] ?? SND.pistol, c = sound.ctx, out = sound.out(at, p.vol, p.tail + 0.1);
    if (!c || !out) return;
    const t = c.currentTime;
    tone(c, out, t, { f0: p.f0, f1: p.f1, g: 0.9, decay: 0.22 }); // ドン
    burst(c, out, t, { type: 'lowpass', f: p.bright, g: 1.1, decay: 0.07 }); // 破裂
    burst(c, out, t, { type: 'highpass', f: 5000, g: 0.5, decay: 0.012 }); // パン
    burst(c, out, t + 0.01, { type: 'lowpass', f: 700, g: 0.3, decay: p.tail }); // 尾
  },
  // 出来事の音（weapons.md「銃の仕組み」。eject は薬きょうなのでここでは鳴らさない）
  event(name, at = null) {
    const c = sound.ctx, out = sound.out(at, 0.5, 0.4);
    if (!c || !out) return;
    const t = c.currentTime;
    if (name === 'magOut') { click(c, out, t, 3500, 0.6); burst(c, out, t + 0.02, { f: 1800, Q: 0.8, g: 0.15, decay: 0.14 }); click(c, out, t + 0.06, 2500, 0.4); }
    else if (name === 'magIn') { clack(c, out, t, 2000, 0.9); click(c, out, t + 0.03, 4000, 0.4); }
    else if (name === 'rack') { click(c, out, t, 3000, 0.6); burst(c, out, t, { f: 2200, Q: 0.8, g: 0.12, decay: 0.07 }); clack(c, out, t + 0.08, 2400, 1); }
    else if (name === 'insert' || name === 'slap' || name === 'close') clack(c, out, t, name === 'insert' ? 2600 : name === 'slap' ? 1700 : 2200, 0.8);
  },
  // 弾切れで撃った: ごく短い高いクリック
  dry(at = null) {
    const c = sound.ctx, out = sound.out(at, 0.5, 0.1);
    if (c && out) click(c, out, c.currentTime, 5000, 0.7, 0.012);
  },
  // 薬きょうが地面に当たった: 高い金属のチャリン（毎回少し高さを変える）
  shell(at = null, g = 1) {
    const c = sound.ctx, out = sound.out(at, 0.25 * g, 0.4);
    if (!c || !out) return;
    const t = c.currentTime, k = 0.85 + Math.random() * 0.3;
    for (const [f, gg, dec] of [[3100, 0.5, 0.18], [4700, 0.35, 0.12], [6300, 0.25, 0.08], [8200, 0.15, 0.05]]) tone(c, out, t, { f0: f * k, g: gg, decay: dec });
  },
};
