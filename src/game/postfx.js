// 画面の効果（docs/rules/style.md「画面の効果」、設定は ui.md「画質」）: 明るさ 1 を超えられる画面（HDR）に、設定の細かさで描く
// → 光る物だけのブルーム（光る物が映ったフレームだけ。小さい画面に縮めてから広げる）
// → まとめのシェーダー（丸め、グレーディング、周辺減光、色ずれ、ディザ）→ SMAA → 拡大とシャープ処理で画面に出す。使わない段は飛ばす
// 後処理「軽い」（ui.md「画質」）: まとめ・FXAA・拡大を 1 回で画面に直接描く。MSAA・SMAA・シャープ処理はしない。ブルームは 1/4 の大きさから 3 段
import * as THREE from 'three';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { glowSeen } from '../style/lowpoly.js';import { VERT, DOWN, PRE, UP, FINAL, UPSCALE } from './postfxShaders.js';

const MIPS = 5; // ブルームの段数（1 段ごとに半分の大きさ）
const MSAA = { none: 0, smaa: 0, msaa2: 2, msaa4: 4 };
// 重いとき自動で細かさを下げる: 端末の fps の上限（30・60・120。今までで一番速く回れた 2 秒の、速い方 1 割のフレームから決める）に
// 間に合わなければ 1 段下げる（段は TIERS。画面の作り直しを減らすため細かく刻まない）。下げたあと 5 秒は戻さず、3 秒続けて余裕があれば 1 段戻す
// 戻してすぐ（2 秒以内）また下がったら、戻さない時間を倍にする（最長 60 秒。行ったり来たりで絵が揺れないように）
const AUTO = { slow: 1.08, fast: 1.03, hold: 5, good: 3 }, TIERS = [1, 0.85, 0.7, 0.6];

export function createPostFx(renderer) {
  const canHdr = renderer.capabilities.isWebGL2 && !!(renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
  let type = canHdr ? THREE.HalfFloatType : THREE.UnsignedByteType; // hdr を切ると 8bit（明るさ 1 を超えられない。しきい値のブルームは使えないので切る）
  const target = (w, h, opt = {}) => new THREE.WebGLRenderTarget(w, h, { type, depthBuffer: false, ...opt });
  // 設定（main.js が settings から入れる）。rscale: 画面の画素の何倍まで描くか
  const opt = { aa: 'smaa', rscale: 1.5, autoRes: true, bloom: true, bloomq: 'high', grade: true, sharpen: true, hdr: true, post: 'normal' };
  const light = () => opt.post === 'light';
  let w = 1, h = 1, cw = 1, ch = 1, tier = 0; // w, h: 描く大きさ、cw, ch: 画面（canvas）の大きさ、tier: 自動で下げた段（TIERS）
  // 世界を描く画面。奥行きは後で使わないので、MSAA を戻すときに奥行きは写さない（軽くする）
  const sceneTarget = () => { const t = target(w, h, { depthBuffer: true, samples: light() ? 0 : MSAA[opt.aa] }); t.resolveDepthBuffer = false; return t; };
  let hdr = sceneTarget();
  let mips = Array.from({ length: MIPS }, () => target(1, 1));
  const ldr = [0, 1].map(() => new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false })); // まとめ・SMAA の出口（sRGB の値のまま 8bit）
  const smaa = new SMAAPass(1, 1);
  smaa.clear = true; // 輪郭の画面を毎回消す（renderer.autoClear は切ってある）
  // SMAA の中の画面（輪郭・重み）は 8bit で足りる。three は HalfFloat で作るので、作り直して軽くする
  for (const k of ['edgesRT', 'weightsRT']) { smaa[k].dispose(); smaa[k] = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false }); }
  smaa.uniformsWeights.tDiffuse.value = smaa.edgesRT.texture;
  smaa.uniformsBlend.tDiffuse.value = smaa.weightsRT.texture;

  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)), fsScene = new THREE.Scene();
  quad.frustumCulled = false;
  fsScene.add(quad);
  const mat = (frag, u, blend = THREE.NoBlending) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms: u, depthTest: false, depthWrite: false, blending: blend });
  const tex = () => ({ tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
  const pre = mat(PRE, { ...tex(), uThresh: { value: 1.7 }, uKnee: { value: 0.25 }, uCap: { value: 4 } });
  const down = mat(DOWN, tex()), up = mat(UP, tex(), THREE.AdditiveBlending);
  const upscale = mat(UPSCALE, { ...tex(), uSharp: { value: 0 } });
  const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); black.needsUpdate = true;
  const U = {
    tScene: { value: null }, tBloom: { value: black }, uBloom: { value: 0.5 }, uTime: { value: 0 }, uAspect: { value: 1 },
    uExposure: { value: 1 }, uContrast: { value: 1 }, uSat: { value: 1 }, uTint: { value: new THREE.Color(1, 1, 1) }, uLift: { value: new THREE.Color(0, 0, 0) },
    uVig: { value: 0.15 }, uCA: { value: 0 }, uGrade: { value: 1 }, uTexel: { value: new THREE.Vector2() },
  };
  const final = mat(FINAL, U), finalLight = mat(FINAL, U);
  finalLight.defines = { FXAA: 1 };

  function draw(m, dst) { quad.material = m; renderer.setRenderTarget(dst); renderer.render(fsScene, cam); }
  function pass(m, src, dst) {
    m.uniforms.tSrc.value = src.texture;
    m.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
    draw(m, dst);
  }
  // 画面の大きさと設定から、描く大きさを決める（変わったときだけ画面を作り直す）
  const size = new THREE.Vector2();
  function resize() {
    renderer.getDrawingBufferSize(size);
    const s = Math.min(1, opt.rscale / renderer.getPixelRatio()) * TIERS[tier];
    const nw = Math.max(1, Math.round(size.x * s)), nh = Math.max(1, Math.round(size.y * s));
    if (nw === w && nh === h && size.x === cw && size.y === ch) return;
    cw = size.x; ch = size.y; w = nw; h = nh;
    hdr.setSize(w, h);
    mips.forEach((t, i) => t.setSize(Math.max(1, w >> (i + 1)), Math.max(1, h >> (i + 1))));
    ldr.forEach((t) => t.setSize(w, h));
    smaa.setSize(w, h);
    U.uAspect.value = w / h;
    U.uTexel.value.set(1 / w, 1 / h);
    upscale.uniforms.uSharp.value = opt.sharpen ? Math.min(1, (1 - w / cw) * 2.5) : -1; // 粗いほど強く。-1 = かけない
    U.uGrade.value = opt.grade ? 1 : 0;
  }
  // 自動で細かさを下げる（end で毎フレーム）
  let lastT = 0, cap = 30, avg = 1 / 30, holdT = 0, goodT = 0, hold = AUTO.hold, sinceUp = 99;
  const win = []; let winT = 0;
  function findCap(dt) { // 端末の fps の上限
    win.push(dt); winT += dt;
    if (winT < 2) return;
    win.sort((a, b) => a - b);
    const f = 1 / win[Math.floor(win.length * 0.1)], c = f > 90 ? 120 : f > 40 ? 60 : 30;
    if (c > cap) { cap = c; avg = 1 / cap; }
    win.length = 0; winT = 0;
  }
  function autoRes(t) {
    const dt = t - lastT;
    lastT = t;
    if (!(dt > 0 && dt < 0.1)) return; // 裏に回っていた・止まっていた間は数えない
    findCap(dt);
    if (!opt.autoRes) { tier = 0; return; }
    avg += (dt - avg) * 0.1;
    holdT -= dt; sinceUp += dt;
    if (avg > AUTO.slow / cap && holdT <= 0 && tier < TIERS.length - 1) {
      hold = sinceUp < 2 ? Math.min(60, hold * 2) : AUTO.hold;
      tier++; holdT = 0.5; goodT = -hold; avg = 1 / cap; sinceUp = 99;
      return;
    }
    goodT = avg < AUTO.fast / cap ? goodT + dt : Math.min(goodT, 0);
    if (goodT >= AUTO.good && tier > 0) { tier--; goodT = 0; sinceUp = 0; }
  }

  return {
    hdr: () => hdr, canHdr,
    U, // まとめのシェーダーの値（grade.js が毎フレーム入れる）
    bloom: pre.uniforms, smaa,
    get scale() { return +(w / cw).toFixed(2); }, // 今の描く細かさ（画面の画素の何倍か）
    // 設定を入れる: { aa, rscale, autoRes, bloom }
    setOptions(o) {
      const aa = opt.aa, wasHdr = opt.hdr, wasLight = light();
      Object.assign(opt, o, { rscale: Number(o.rscale ?? opt.rscale) });
      if (!opt.autoRes) tier = 0;
      const hdrChanged = wasHdr !== opt.hdr && canHdr;
      if (hdrChanged) { type = opt.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType; mips.forEach((t) => t.dispose()); mips = Array.from({ length: MIPS }, () => target(1, 1)); }
      if (hdrChanged || MSAA[aa] !== MSAA[opt.aa] || wasLight !== light()) { hdr.dispose(); hdr = sceneTarget(); }
      w = 0; // 次の resize で作り直す
    },
    get options() { return { ...opt, auto: TIERS[tier], cap }; },
    // 描く前に呼ぶ: これから世界を描く画面を選ぶ
    begin() {
      resize();
      glowSeen.v = false;
      renderer.setRenderTarget(hdr);
      renderer.clear();
    },
    // 世界を描き終えたら呼ぶ: ブルーム → まとめ → SMAA → 拡大で画面に出す
    end(t) {
      const bloomOn = opt.bloom && canHdr && opt.hdr && glowSeen.v && U.uBloom.value > 0; // 光る物が映っていないフレームは飛ばす
      const b0 = light() ? 1 : 0; // ブルームの始めの段（軽い: 1/4 の大きさから）
      if (bloomOn) {
        const steps = light() || opt.bloomq === 'low' ? 3 : MIPS; // 段数
        pass(pre, hdr, mips[b0]);
        for (let i = b0 + 1; i < b0 + steps; i++) pass(down, mips[i - 1], mips[i]);
        for (let i = b0 + steps - 1; i > b0; i--) pass(up, mips[i], mips[i - 1]);
      }
      U.tScene.value = hdr.texture;
      U.tBloom.value = bloomOn ? mips[b0].texture : black;
      U.uTime.value = t % 100;
      if (light()) { draw(finalLight, null); autoRes(t); return; } // 1 回で画面へ（拡大は読むときに線形でならす）
      const scaled = w !== cw || h !== ch, useSmaa = opt.aa === 'smaa';
      let out = null; // 今の絵が入っている画面（null = もう画面に出した）
      draw(final, scaled || useSmaa ? ldr[0] : null);
      if (scaled || useSmaa) out = ldr[0];
      if (useSmaa) {
        smaa.renderToScreen = !scaled;
        smaa.render(renderer, ldr[1], ldr[0]);
        out = scaled ? ldr[1] : null;
      }
      if (out) pass(upscale, out, null);
      autoRes(t);
    },
    // 調べる用: HDR の画面の 1 点の明るさ（0〜1 の割合の位置）
    probe(x, y) {
      const b = new Uint16Array(4);
      if (!canHdr) return null;
      renderer.readRenderTargetPixels(hdr, Math.floor(w * x), Math.floor(h * y), 1, 1, b);
      return [...b.slice(0, 3)].map((v) => +THREE.DataUtils.fromHalfFloat(v).toFixed(3));
    },
  };
}
