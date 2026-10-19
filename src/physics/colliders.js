// 物理の世界に入れる「相手」の形（docs/rules/physics.md「世界の形」）
// 物理の物のまわりの相手だけを入れ、0.25 秒ごとに入れ替える。
const TILES = 8;    // 地形の物理の形の一辺（タイル数 = m）
const MARGIN = 1.5; // 物理の物のまわりで相手を入れる広さ（m）

// 水平面の凸多角形 pts を、高さ y0〜y1 の角柱の形にする
export function hullDesc(R, s) {
  const v = new Float32Array(s.pts.length * 6);
  s.pts.forEach(([x, z], k) => v.set([x, s.y0, z, x, s.y1, z], k * 6));
  return R.ColliderDesc.convexHull(v);
}

// R: Rapier、pw: 物理の世界、world: その世界（terrain、colliders）、structures: 建築パーツ
export function createStaticSync(R, pw, world, structures) {
  const live = new Map(); // 相手（オブジェクトまたは地形の区画の名前） → {collider, sig, at}
  const t = world.terrain, b = t.bounds;

  // 島の外の海の底: 地形の一番低い高さの平らな床
  pw.createCollider(R.ColliderDesc.cuboid(2000, 1, 2000).setTranslation(0, t.base - 1, 0));

  function terrainDesc(cx, cz) {
    const tx0 = cx * TILES, tz0 = cz * TILES;
    const { pos } = t.triangles(tx0, tz0, Math.min(TILES, b.w - tx0), Math.min(TILES, b.d - tz0));
    if (!pos.length) return null;
    const v = new Float32Array(pos), idx = new Uint32Array(pos.length / 3);
    for (let k = 0; k < idx.length; k++) idx[k] = k;
    return R.ColliderDesc.trimesh(v, idx);
  }
  // 木の幹・葉・岩: 円柱（下の端がなければ地面より少し下から）
  function natureDesc(c) {
    const y0 = c.bottom ?? t.heightAt(c.x, c.z) - 0.3, h = Math.max(0.05, c.top - y0);
    return R.ColliderDesc.cylinder(h / 2, c.r).setTranslation(c.x, y0 + h / 2, c.z);
  }
  // 建築パーツの形（凸の角柱）と土台の足（細い箱）
  function solidDesc(s) {
    if (!s.pts) {
      const h = Math.max(0.05, s.top - s.bottom);
      return R.ColliderDesc.cuboid(s.w / 2, h / 2, s.w / 2).setTranslation(s.x, s.bottom + h / 2, s.z);
    }
    return hullDesc(R, s);
  }

  // 物理の物の位置の一覧から、要る相手を集めて、足りない物を入れ、要らない物を消す。消した相手の位置を返す（上の物を起こすため）
  function sync(points) {
    const removed = [];
    const want = new Map(); // 相手 → {sig, make}
    for (const { x, z, r } of points) {
      const rr = r + MARGIN;
      const cx0 = Math.floor((x - rr - b.x0) / TILES), cx1 = Math.floor((x + rr - b.x0) / TILES);
      const cz0 = Math.floor((z - rr - b.z0) / TILES), cz1 = Math.floor((z + rr - b.z0) / TILES);
      for (let cz = Math.max(0, cz0); cz <= Math.min(cz1, Math.ceil(b.d / TILES) - 1); cz++) {
        for (let cx = Math.max(0, cx0); cx <= Math.min(cx1, Math.ceil(b.w / TILES) - 1); cx++) {
          want.set(`t${cx},${cz}`, { sig: '', at: null, make: () => terrainDesc(cx, cz) });
        }
      }
      for (const c of world.colliders(x, z, rr)) want.set(c, { sig: `${c.top},${c.bottom}`, at: c, make: () => natureDesc(c) });
      for (const s of structures?.solids(x, z, rr) ?? []) {
        want.set(s, { sig: s.pts ? `${s.y0},${s.y1}` : `${s.top},${s.bottom}`, at: s.pts ? { x: s.cx, z: s.cz } : s, make: () => solidDesc(s) });
      }
    }
    for (const [k, e] of live) {
      if (want.get(k)?.sig === e.sig) continue;
      if (e.at) removed.push({ x: e.at.x, z: e.at.z });
      pw.removeCollider(e.collider, true);
      live.delete(k);
    }
    for (const [k, w] of want) {
      if (live.has(k)) continue;
      const desc = w.make();
      if (desc) live.set(k, { collider: pw.createCollider(desc), sig: w.sig, at: w.at });
    }
    return removed;
  }

  return { sync, get count() { return live.size; } };
}
