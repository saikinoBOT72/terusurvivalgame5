// 戦闘の表示（docs/rules/ui.md「戦闘の表示」）: ダメージの数字、照準の ×、攻撃の来た向き、弾数、敵の頭の上の ？／！、攻撃間隔の線、HP が低いときの赤いにじみ、泥
// 3D の位置は毎フレーム画面に写す（update）
import * as THREE from 'three';
import { P } from '../style/palette.js';

const NUM_SECS = 0.8, ARC_SECS = 1;

const hexA = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${a})`;

function el(html, parent = document.body) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return parent.appendChild(t.content.firstChild);
}

export function createCombatHud({ camera }) {
  const layer = el('<div class="combat-hud"></div>');
  const cross = el('<div class="hit-mark"></div>', layer);
  const ammo = el('<div class="ammo" hidden><span></span><i></i></div>', layer);
  // 攻撃間隔の線（照準の 18px 下。下地は同じ白の 25%）と、画面のふちの赤いにじみ
  const cd = el(`<div style="position:fixed;left:50%;top:calc(50% + 18px);width:36px;height:3px;transform:translateX(-50%);background:${hexA(P.ui.cooldown, 0.25)};pointer-events:none" hidden><i style="display:block;height:100%;width:0;background:${P.ui.cooldown}"></i></div>`, layer);
  const cdBar = cd.firstChild;
  const stance = el('<div class="sub stance" hidden></div>', layer); // 動き方の札（忍び足・しゃがみ。ui.md）
  let stanceText = null;
  const vig = el(`<div style="position:fixed;inset:0;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center, transparent 62%, ${hexA(P.ui.lowHp, 0.35)} 84%, ${hexA(P.ui.lowHp, 0.9)} 100%)"></div>`);
  // 画面のふちの泥（ui.md「泥」）: しみ 4〜6 個。ふちから内側へ 25% くらいまで、真ん中にはかけない
  const mudLayer = el('<div style="position:fixed;inset:0;pointer-events:none;opacity:0;overflow:hidden"></div>');
  const MUD_IN = 0.3, MUD_OUT = 2, MUD_MAX = 0.85, MUD_KEEP = 0.3; // MUD_KEEP: 鈍足の間に残す濃さ
  let mudT = -1, mudHold = 0;
  let low = 0, pulse = 0;
  const nums = [], arcs = [], marks = [];
  const v = new THREE.Vector3(), f = new THREE.Vector3();

  // 世界の位置 → 画面の位置（後ろなら null）
  function screen(p) {
    v.copy(p).project(camera);
    if (v.z > 1) return null;
    return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight];
  }

  return {
    number(point, n, weak, cls = '') {
      const e = el(`<div class="dmg-num${weak ? ' weak' : ''}${cls}">${n}</div>`, layer);
      nums.push({ e, p: point.clone(), t: 0 });
    },
    mark(weak) {
      cross.className = 'hit-mark';
      void cross.offsetWidth; // アニメーションをやり直す
      cross.className = `hit-mark on${weak ? ' weak' : ''}`;
    },
    // 受けた攻撃の来た場所（世界の位置）
    hurtFrom(p) {
      arcs.push({ e: el('<div class="hurt-arc"></div>', layer), p: p.clone(), t: 0 });
    },
    // 弾数（null で隠す）。reload: 込め直しの進み 0〜1（込め直していなければ null）
    setAmmo(text, reload = null) {
      ammo.hidden = text == null;
      if (text == null) return;
      ammo.querySelector('span').textContent = text;
      const bar = ammo.querySelector('i');
      bar.hidden = reload == null;
      if (reload != null) bar.style.width = `${reload * 100}%`;
    },
    // 敵の頭の上の印 [{ p, kind: '?' | '!' }]
    setMarks(list) {
      while (marks.length < list.length) marks.push(el('<div class="mob-mark"></div>', layer));
      marks.forEach((e, i) => {
        const it = list[i], s = it && screen(it.p);
        e.hidden = !s;
        if (!s) return;
        e.textContent = it.kind === '?' ? '？' : it.kind === 'z' ? 'z' : '！';
        e.className = `mob-mark ${it.kind === '?' ? 'aware' : it.kind === 'z' ? 'sleep' : 'alert'}`;
        e.style.transform = `translate(${s[0]}px, ${s[1]}px) translate(-50%, -100%)`;
      });
    },
    // 攻撃間隔の満ち具合 0〜1（満ちていれば null で隠す）
    setCooldown(k) {
      cd.hidden = k == null;
      if (k != null) cdBar.style.width = `${Math.min(1, k) * 100}%`;
    },
    // 照準の下の動き方の札（null で隠す）
    setStance(text) {
      if (text === stanceText) return;
      stanceText = text;
      stance.hidden = text == null;
      stance.textContent = text ?? '';
    },
    // HP の割合（0〜1）。30% 以下で赤くにじんで脈打つ。off: 倒れた画面などで出さない
    setLowHp(frac, off = false) { low = off ? 0 : Math.max(0, Math.min(1, (0.3 - frac) / 0.3 + (frac <= 0.3 ? 0.001 : 0))); },
    get lowHp() { return low; },
    // 泥が当たった: しみを置き直して、0.3 秒で濃く → 2 秒で薄れる
    mud(hold = 0) { // hold: 鈍足の秒（この間は薄い泥を残す）
      mudHold = hold;
      mudLayer.textContent = '';
      const n = 4 + Math.floor(Math.random() * 3), cols = P.fx.mud;
      for (let i = 0; i < n; i++) {
        const side = (i + Math.floor(Math.random() * 4)) % 4, along = 10 + Math.random() * 80, size = 22 + Math.random() * 16; // 画面の短い辺に対する %
        const pos = side === 0 ? `left:${along}%;top:0` : side === 1 ? `left:${along}%;top:100%` : side === 2 ? `left:0;top:${along}%` : `left:100%;top:${along}%`;
        const c = cols[i % cols.length];
        el(`<div style="position:absolute;${pos};width:${size}vmin;height:${size * (0.7 + Math.random() * 0.5)}vmin;transform:translate(-50%,-50%) rotate(${Math.random() * 180}deg);border-radius:${40 + Math.random() * 20}% ${50 + Math.random() * 20}% ${45 + Math.random() * 20}% ${55 + Math.random() * 20}%;background:radial-gradient(ellipse at center, ${hexA(c, 0.95)} 45%, ${hexA(c, 0.6)} 70%, transparent 100%)"></div>`, mudLayer);
      }
      mudT = 0;
    },
    hidden(on) { layer.hidden = on; if (on) { vig.style.opacity = '0'; mudLayer.style.opacity = '0'; mudT = -1; mudHold = 0; } },
    update(dt) {
      mudHold = Math.max(0, mudHold - dt);
      if (mudT >= 0) {
        mudT += dt;
        const a = mudT < MUD_IN ? mudT / MUD_IN : 1 - (mudT - MUD_IN) / MUD_OUT;
        mudLayer.style.opacity = String(Math.max(0, a, MUD_KEEP / MUD_MAX * Math.min(1, mudHold / 0.5)) * MUD_MAX);
        if (mudT >= MUD_IN + MUD_OUT && mudHold <= 0) mudT = -1;
      }
      if (low > 0 && !layer.hidden) { // 低いほど速く濃く: 1 秒に 1 → 2.2 回、濃さ 0.3 → 0.75
        pulse += dt * (1 + 1.2 * low) * Math.PI * 2;
        const base = 0.3 + 0.45 * low;
        vig.style.opacity = String(base * (0.65 + 0.35 * Math.sin(pulse)));
      } else vig.style.opacity = '0';
      for (let i = nums.length - 1; i >= 0; i--) {
        const n = nums[i];
        n.t += dt;
        if (n.t >= NUM_SECS) { n.e.remove(); nums.splice(i, 1); continue; }
        const s = screen(v.copy(n.p).setY(n.p.y + n.t * 0.8));
        n.e.hidden = !s;
        if (s) {
          n.e.style.transform = `translate(${s[0]}px, ${s[1]}px) translate(-50%, -50%)`;
          n.e.style.opacity = String(Math.min(1, (NUM_SECS - n.t) / 0.3));
        }
      }
      camera.getWorldDirection(f);
      const yaw = Math.atan2(f.x, f.z);
      for (let i = arcs.length - 1; i >= 0; i--) {
        const a = arcs[i];
        a.t += dt;
        if (a.t >= ARC_SECS) { a.e.remove(); arcs.splice(i, 1); continue; }
        const ang = Math.atan2(a.p.x - camera.position.x, a.p.z - camera.position.z) - yaw; // 正面 0、右が +
        a.e.style.transform = `translate(-50%, -50%) rotate(${-ang}rad)`;
        a.e.style.opacity = String(1 - a.t / ARC_SECS);
      }
    },
  };
}
