// 霧（docs/rules/style.md「画面の効果」）: three の霧のシェーダーを差し替える。どの材質にも同じ霧がかかる
// ① ふつうのかすみ（今までどおり、遠いほど濃い）② 低い所ほど濃い霧（谷・沼・朝もや。濃さがゆっくり揺れる）③ 太陽の方を向くと霧が明るく暖かい色
// 値は sky.js が毎フレーム入れる（FOG）。読み込んだ時点で差し替わるので、main.js の最初の方で import する
// 計算の細かさ（ui.md「画質」の霧の計算）: high = 画素ごと、mid = 揺れを単純にした安い計算、low = ②③を頂点ごと。濃さはどれも同じ
import * as THREE from 'three';

export const FOG = {
  fogSunDir: { value: new THREE.Vector3(0, 1, 0) },
  fogSunColor: { value: new THREE.Color(1, 1, 1) },
  fogSun: { value: 0 }, // 太陽の方の色の強さ 0〜1
  fogHeight: { value: new THREE.Vector4(0, 0, 4, 0) }, // x: 低い所の霧の濃さ（1m あたり）、y: 霧の底の高さ、z: 薄くなる高さ（m）、w: 時間（揺れ）
};

const UNI = 'uniform vec3 fogSunDir; uniform float fogSun; uniform vec4 fogHeight;';
// 低い所の霧で残る割合（0〜1）と、太陽の方の色の強さ。高さで指数に薄くなる霧を、目から物までの道のりで足し合わせる（目が霧の底より下なら底にいるとみなす）
const calc = (cheap) => `
  vec3 fogRay = fogW - cameraPosition;
  float fogDist = length( fogRay );
  float fogKeep = 1.0;
  if ( fogHeight.x > 0.0 ) {
    float camH = max( cameraPosition.y, fogHeight.y );
    float hc = ( camH - fogHeight.y ) / fogHeight.z, dy = ( fogW.y - camH ) / fogHeight.z;
    float along = abs( dy ) > 0.01 ? ( 1.0 - exp( - dy ) ) / dy : 1.0;
    ${cheap
    ? 'float wob = 0.8 + 0.2 * sin( ( fogW.x * 0.06 + fogW.z * 0.05 ) + fogHeight.w * 0.15 );'
    : 'float wob = 0.75 + 0.25 * sin( fogW.x * 0.06 + fogHeight.w * 0.15 ) * sin( fogW.z * 0.05 - fogHeight.w * 0.11 );'}
    fogKeep = exp( - fogHeight.x * wob * exp( - hc ) * along * fogDist );
  }
  ${cheap
    ? 'float fogS = max( dot( fogRay / max( fogDist, 1e-3 ), fogSunDir ), 0.0 ); fogS *= fogS; fogS *= fogS; fogS *= fogS; float fogSunK = fogSun * fogS;'
    : 'float fogSunK = fogSun * pow( max( dot( fogRay / max( fogDist, 1e-3 ), fogSunDir ), 0.0 ), 8.0 );'}`;
const BASE = `#ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif`;
const PARS_F = (more) => `#ifdef USE_FOG
  uniform vec3 fogColor, fogSunColor; varying float vFogDepth; ${more}
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear; uniform float fogFar;
  #endif
#endif`;
// 世界の位置: 視点の回転は直交なので、逆行列の代わりに転置を使う（インスタンスや板の絵でも mvPosition から出せる）
const WORLD = 'vec3 fogW = cameraPosition + transpose( mat3( viewMatrix ) ) * mvPosition.xyz;';
const CHUNKS = {
  high: {
    pv: '#ifdef USE_FOG\n varying float vFogDepth;\n varying vec3 vFogWorld;\n#endif',
    v: `#ifdef USE_FOG\n vFogDepth = - mvPosition.z;\n vFogWorld = cameraPosition + transpose( mat3( viewMatrix ) ) * mvPosition.xyz;\n#endif`,
    pf: PARS_F(`varying vec3 vFogWorld; ${UNI}`),
    f: `#ifdef USE_FOG\n ${BASE}\n vec3 fogW = vFogWorld; ${calc(false)}\n fogFactor = 1.0 - ( 1.0 - fogFactor ) * fogKeep;\n gl_FragColor.rgb = mix( gl_FragColor.rgb, mix( fogColor, fogSunColor, fogSunK ), fogFactor );\n#endif`,
  },
  low: {
    pv: `#ifdef USE_FOG\n varying float vFogDepth;\n varying vec2 vFogHS;\n ${UNI}\n#endif`,
    v: `#ifdef USE_FOG\n vFogDepth = - mvPosition.z;\n ${WORLD} ${calc(true)}\n vFogHS = vec2( fogKeep, fogSunK );\n#endif`,
    pf: PARS_F('varying vec2 vFogHS;'),
    f: `#ifdef USE_FOG\n ${BASE}\n fogFactor = 1.0 - ( 1.0 - fogFactor ) * vFogHS.x;\n gl_FragColor.rgb = mix( gl_FragColor.rgb, mix( fogColor, fogSunColor, vFogHS.y ), fogFactor );\n#endif`,
  },
};
CHUNKS.mid = { ...CHUNKS.high, f: CHUNKS.high.f.replace(calc(false), calc(true)) };

let quality = '';
// 計算の細かさを変える。scenes の材質を作り直す（three はシェーダーを覚えているので、覚える名前にも細かさを入れる）
export function setFogQuality(q, scenes = []) {
  if (!CHUNKS[q] || q === quality) return;
  quality = q;
  const c = CHUNKS[q], S = THREE.ShaderChunk;
  S.fog_pars_vertex = c.pv; S.fog_vertex = c.v; S.fog_pars_fragment = c.pf; S.fog_fragment = c.f;
  for (const sc of scenes) sc?.traverse((o) => { for (const m of [o.material].flat()) if (m?.fog) m.needsUpdate = true; });
}
setFogQuality('high');

// どの材質にも霧の値を渡す（自分の onBeforeCompile を持つ材質は、中で addFog を呼ぶ）
export function addFog(shader) { Object.assign(shader.uniforms, FOG); }
THREE.Material.prototype.onBeforeCompile = addFog;
THREE.Material.prototype.customProgramCacheKey = function () { return this.onBeforeCompile.toString() + quality; };
