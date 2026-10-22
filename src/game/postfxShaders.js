// 画面の効果のシェーダー（game/postfx.js が使う。docs/rules/style.md「画面の効果」）

export const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
// 縮める（中心 4 + 斜め 4。dual filter）
export const DOWN = `uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
  vec3 tap(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
  void main() { vec3 c = tap(vec2(0.0)) * 4.0 + tap(vec2(-1.0, -1.0)) + tap(vec2(1.0, -1.0)) + tap(vec2(-1.0, 1.0)) + tap(vec2(1.0, 1.0));
    gl_FragColor = vec4(c / 8.0, 1.0); }`;
// 最初の縮小: しきい値より明るい分だけ取り出す。色の濃いネオン（青など）も光るよう、明るさは一番強い色で測る。上限で強さを抑える
export const PRE = `uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThresh, uKnee, uCap; varying vec2 vUv;
  vec3 pick(vec3 c) { float m = max(c.r, max(c.g, c.b)); float s = clamp(m - uThresh + uKnee, 0.0, 2.0 * uKnee); s = s * s / (4.0 * uKnee + 1e-4);
    float w = max(s, m - uThresh) / max(m, 1e-4); return c * w * min(1.0, uCap / max(m, 1e-4)); }
  vec3 tap(vec2 o) { return pick(texture2D(tSrc, vUv + o * uTexel).rgb); }
  void main() { vec3 c = tap(vec2(0.0)) * 4.0 + tap(vec2(-1.0, -1.0)) + tap(vec2(1.0, -1.0)) + tap(vec2(-1.0, 1.0)) + tap(vec2(1.0, 1.0));
    gl_FragColor = vec4(c / 8.0, 1.0); }`;
// 広げる（まわり 8。加算で 1 つ大きい段に足す）
export const UP = `uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
  vec3 tap(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
  void main() { vec3 c = tap(vec2(-2.0, 0.0)) + tap(vec2(2.0, 0.0)) + tap(vec2(0.0, -2.0)) + tap(vec2(0.0, 2.0))
    + (tap(vec2(-1.0, -1.0)) + tap(vec2(1.0, -1.0)) + tap(vec2(-1.0, 1.0)) + tap(vec2(1.0, 1.0))) * 2.0;
    gl_FragColor = vec4(c / 12.0, 1.0); }`;
// まとめ
export const FINAL = `uniform sampler2D tScene, tBloom; uniform float uBloom, uExposure, uContrast, uSat, uVig, uCA, uAspect, uTime, uGrade;
  uniform vec3 uTint, uLift; varying vec2 vUv;
  // 1 より下はそのまま。日なたの砂など少し超えた所は今までどおり色ごとに切る（昼の見た目を変えない）。
  // 光る物（1.3 より明るい）は一番強い色で全体を縮めるので、ネオンの色合いが白に飛ばない
  vec3 shoulder(vec3 x) { float m = max(x.r, max(x.g, x.b)); return mix(min(x, 1.0), x / max(m, 1e-4), smoothstep(1.3, 2.5, m)); }
  vec3 toSRGB(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
  void main() {
    vec2 d = vUv - 0.5;
    vec3 c = texture2D(tScene, vUv).rgb;
    if (uCA > 0.0) { vec2 o = d * uCA; c.r = texture2D(tScene, vUv + o).r; c.b = texture2D(tScene, vUv - o).b; } // 色ずれ（端ほど大きい）
    c += texture2D(tBloom, vUv).rgb * uBloom;
    c = toSRGB(shoulder(c * uExposure));
    if (uGrade < 0.5) { gl_FragColor = vec4(c, 1.0); return; } // カラーグレーディング オフ: 丸めだけ
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(vec3(l), c, uSat);
    c = (c - 0.5) * uContrast + 0.5;
    c *= uTint;
    c += uLift * (1.0 - l) * (1.0 - l); // 暗い所に色を足す（夜の青など）
    float r = length(d * vec2(uAspect, 1.0)) / length(vec2(uAspect, 1.0) * 0.5);
    c *= 1.0 - uVig * smoothstep(0.35, 1.05, r);
    c += (fract(sin(dot(gl_FragCoord.xy + uTime, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0; // ディザ（縞を消す）
    gl_FragColor = vec4(c, 1.0);
  }`;

// 拡大（粗く描いたときだけ）: CAS（まわり 4 つとの差で輪郭をはっきりさせる。明るさの差が大きい所ほど控えめ）。uSharp 0〜1
export const UPSCALE = `uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uSharp; varying vec2 vUv;
  vec3 tap(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
  void main() {
    if (uSharp < 0.0) { gl_FragColor = vec4(tap(vec2(0.0)), 1.0); return; } // シャープネス オフ
    vec3 c = tap(vec2(0.0)), n = tap(vec2(0.0, 1.0)), s = tap(vec2(0.0, -1.0)), e = tap(vec2(1.0, 0.0)), w = tap(vec2(-1.0, 0.0));
    vec3 mn = min(c, min(min(n, s), min(e, w))), mx = max(c, max(max(n, s), max(e, w)));
    vec3 amp = sqrt(clamp(min(mn, 2.0 - mx) / max(mx, 1e-4), 0.0, 1.0));
    vec3 k = amp * (-1.0 / mix(8.0, 5.0, uSharp));
    gl_FragColor = vec4(clamp((c + (n + s + e + w) * k) / (1.0 + 4.0 * k), 0.0, 1.0), 1.0);
  }`;
