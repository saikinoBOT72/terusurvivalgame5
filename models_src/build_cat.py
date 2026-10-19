# 猫のモデルを Blender の中で作るスクリプト（docs/modeling-guide.md の決まりに合わせる）
# 参考: ユーザーの 6 方向の画像（四角い面が並ぶ、丸っこいローポリの猫）
# 大きさ: 全高 約 1.4m、足の裏 Z=0、正面は -Y。左右対称（しっぽ以外）。
# 何度実行してもよい（コレクション「Cat」の中を作り直す）。
import bpy, bmesh, math
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

# ---- 色（src/style/palette.js と同じ名前・値） ----
COLORS = {
    'catOrange_0': 'C9732E', 'catOrange_1': 'E89A4A', 'catOrange_2': 'F2B26A',
    'catWhite_1': 'EDEBE6', 'catWhite_2': 'F9F8F5', 'catPink_1': 'E79AA8', 'eye': '1E1E22',
    'boots_0': '4A2A1A', 'boots_1': '5A3422', 'boots_2': '7A4A30',
}

def lin(c):
    c /= 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def material(name):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    h = COLORS[name]
    rgba = (*(lin(int(h[i:i + 2], 16)) for i in (0, 2, 4)), 1)
    m.diffuse_color = rgba
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = rgba
        bsdf.inputs['Roughness'].default_value = 1.0
    return m

# ---- 形の部品 ----
def quadball(bm, nx, ny, nz, f, half, center, mat=0):
    """立方体の表面をマス目（nx×ny×nz）に分け、f だけ球に近づけた形（球状に変形）を bm に足す。"""
    made = {}
    def V(p):
        k = tuple(round(c, 6) for c in p)
        if k not in made:
            q = Vector(p)
            q = q.lerp(q.normalized(), f)
            made[k] = bm.verts.new((center[0] + q.x * half[0], center[1] + q.y * half[1], center[2] + q.z * half[2]))
        return made[k]
    n = (nx, ny, nz)
    faces = []
    for axis in range(3):
        a, b = (axis + 1) % 3, (axis + 2) % 3
        for side in (-1, 1):
            for i in range(n[a]):
                for j in range(n[b]):
                    quad = []
                    for di, dj in ((0, 0), (1, 0), (1, 1), (0, 1)):
                        p = [0, 0, 0]
                        p[axis] = side
                        p[a] = -1 + 2 * (i + di) / n[a]
                        p[b] = -1 + 2 * (j + dj) / n[b]
                        quad.append(V(p))
                    if side < 0: quad.reverse()
                    f_ = bm.faces.new(quad)
                    f_.material_index = mat
                    faces.append(f_)
    return faces

def box(bm, half, center, mat=0, rot=None):
    out = []
    vs = []
    for x in (-1, 1):
        for y in (-1, 1):
            for z in (-1, 1):
                p = Vector((x * half[0], y * half[1], z * half[2]))
                if rot: p = rot @ p
                vs.append(bm.verts.new(Vector(center) + p))
    idx = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    for q in idx:
        f = bm.faces.new([vs[i] for i in q])
        f.material_index = mat
        out.append(f)
    return out

def tube(bm, pts, radii, sides=8, mat=0, tangents=None):
    """点の列に沿った八角形の管（両端にふた）。tangents で輪の向きを決められる（節のつなぎ目をそろえる）"""
    rings = []
    for i, p in enumerate(pts):
        p = Vector(p)
        t = Vector(tangents[i]).normalized() if tangents else (Vector(pts[min(i + 1, len(pts) - 1)]) - Vector(pts[max(i - 1, 0)])).normalized()
        u = t.cross(Vector((1, 0, 0))).normalized()
        if u.length < 0.1: u = t.cross(Vector((0, 0, 1))).normalized()
        w = t.cross(u)
        ring = [bm.verts.new(p + (u * math.cos(k / sides * 2 * math.pi + math.pi / sides) + w * math.sin(k / sides * 2 * math.pi + math.pi / sides)) * radii[i]) for k in range(sides)]
        rings.append(ring)
    for r0, r1 in zip(rings, rings[1:]):
        for k in range(sides):
            bm.faces.new([r0[k], r0[(k + 1) % sides], r1[(k + 1) % sides], r1[k]]).material_index = mat
    bm.faces.new(list(reversed(rings[0]))).material_index = mat
    bm.faces.new(rings[-1]).material_index = mat

def paint(bm, fn):
    """面ごとに材質の番号を決める。fn(中心, 法線, 今の番号) → 番号"""
    bm.normal_update()
    for f in bm.faces:
        f.material_index = fn(f.calc_center_median(), f.normal, f.material_index)

# ---- オブジェクトを作る ----
def make(name, bm, mats, origin, parent=None, mirror=False):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if mirror:  # 右半分（X < 0）を消して、ミラーで左右対称にする
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.x < -1e-5], context='VERTS')
    bm.transform(Matrix.Translation(-Vector(origin)))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats: me.materials.append(material(m))
    for p in me.polygons: p.use_smooth = False
    ob = bpy.data.objects.new(name, me)
    COLL.objects.link(ob)
    ob.location = origin
    if mirror:
        mod = ob.modifiers.new('Mirror', 'MIRROR')
        mod.use_axis[0] = True
        mod.use_clip = True
        mod.use_mirror_merge = True
    if parent:
        bpy.context.view_layer.update()
        ob.parent = parent
        ob.matrix_parent_inverse = parent.matrix_world.inverted()
    return ob

def surface_y(bm, x, z):
    """正面（-Y）から光線を当てて、表面の Y を調べる"""
    tree = BVHTree.FromBMesh(bm)
    hit = tree.ray_cast(Vector((x, -3, z)), Vector((0, 1, 0)))
    return hit[0], hit[1]

# ---- 準備: コレクション「Cat」を作り直す ----
COLL = bpy.data.collections.get('Cat')
if COLL:
    for ob in list(COLL.objects): bpy.data.objects.remove(ob, do_unlink=True)
else:
    COLL = bpy.data.collections.new('Cat')
    bpy.context.scene.collection.children.link(COLL)
for me in [m for m in bpy.data.meshes if m.users == 0]: bpy.data.meshes.remove(me)

root = bpy.data.objects.new('root', None)
COLL.objects.link(root)
root.empty_display_size = 0.3

# ---- 胴: 下が太い卵形。お腹は白 ----
TC = (0, 0.02, 0.45)
bm = bmesh.new()
quadball(bm, 6, 6, 6, 0.75, (0.3, 0.275, 0.31), TC)
for v in bm.verts:
    w = (v.co.z - TC[2]) / 0.31
    k = 1.08 - 0.22 * (w + 1) / 2          # 下ほど太く
    v.co.x *= k
    v.co.y = TC[1] + (v.co.y - TC[1]) * k
    if w < -0.85: v.co.z = TC[2] - 0.31 * 0.85 - (v.co.z - TC[2] + 0.31 * 0.85) * 0.3  # 底を平らに
paint(bm, lambda c, n, i: 1 if n.y < -0.3 and (c.x / 0.2) ** 2 + ((c.z - 0.45) / 0.24) ** 2 < 1 else 0)
torso = make('torso', bm, ['catOrange_1', 'catWhite_1'], (0, 0, 0.3), root, mirror=True)

# ---- 頭: 大きく丸い。頬が少しふくらみ、口元が前に出る。口元とあごは白 ----
HC = Vector((0, 0, 1.03))
HX, HY, HZ = 0.35, 0.27, 0.30
bm = bmesh.new()
quadball(bm, 6, 6, 6, 0.9, (HX, HY, HZ), HC)
for v in bm.verts:
    u, s, w = v.co.x / HX, (v.co.y - HC.y) / HY, (v.co.z - HC.z) / HZ
    if w < 0: v.co.x *= 1 + 0.08 * -w                                   # 頬
    if w > 0.8: v.co.z = HC.z + HZ * (0.8 + (w - 0.8) * 0.7)           # 頭の上をほんの少し平らに
    if s < -0.4 and -0.75 < w < 0.05:                                   # 口元を前に
        v.co.y -= 0.05 * max(0, 1 - abs(u) * 1.6) * math.sin((w + 0.75) / 0.8 * math.pi)
    if w < -0.8 and s < 0: v.co.y += 0.02                               # あごを少し引く
paint(bm, lambda c, n, i: 1 if (n.y < -0.2 and c.z < HC.z - 0.05 and abs(c.x) < 0.27) or (n.z < -0.5 and c.y < 0.06) else 0)
# 目（小さな黒い四角）と鼻（ピンクの三角）を表面に付ける
for sx in (-1, 1):
    hit, nrm = surface_y(bm, 0.15 * sx, HC.z + 0.01)
    box(bm, (0.028, 0.014, 0.032), hit + Vector((0, 0.004, 0)), 2)  # まっすぐ前向き（左右で見え方をそろえる）
hit, nrm = surface_y(bm, 0, HC.z - 0.075)
hit.x = 0  # 鼻は右半分だけ作り、ミラーで左を付ける
nose = [bm.verts.new(hit + Vector(p)) for p in ((0, -0.012, 0.02), (0.03, -0.012, 0.02), (0, -0.018, -0.02), (0, 0.01, 0.02), (0.03, 0.01, 0.02), (0, 0.01, -0.02))]
for q in ((0, 2, 1), (3, 4, 5), (0, 1, 4, 3), (1, 2, 5, 4)):
    bm.faces.new([nose[i] for i in q]).material_index = 3
head = make('head', bm, ['catOrange_1', 'catWhite_1', 'eye', 'catPink_1'], (0, 0, 0.76), torso, mirror=True)

# ---- 耳: 頭の上の両端の三角。少し外に開く。内側（前）はピンク ----
for sx, nm in ((1, 'ear_L'), (-1, 'ear_R')):
    base = Vector((0.19 * sx, 0.03, 1.25))
    bm = bmesh.new()
    rot = Matrix.Rotation(-0.25 * sx, 3, 'Y')
    ring0 = [bm.verts.new(base + rot @ Vector((math.cos(a) * 0.1, math.sin(a) * 0.075, 0))) for a in (0.5 * math.pi, 1.1 * math.pi, 1.9 * math.pi)]
    ring1 = [bm.verts.new(base + rot @ Vector((math.cos(a) * 0.06, math.sin(a) * 0.042, 0.085))) for a in (0.5 * math.pi, 1.1 * math.pi, 1.9 * math.pi)]
    tip = bm.verts.new(base + rot @ Vector((0, -0.01, 0.19)))
    for k in range(3):
        bm.faces.new([ring0[k], ring0[(k + 1) % 3], ring1[(k + 1) % 3], ring1[k]])
        bm.faces.new([ring1[k], ring1[(k + 1) % 3], tip])
    bm.faces.new(list(reversed(ring0)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    front = [f for f in bm.faces if f.normal.y < -0.6]      # 前の面の内側だけピンクにする
    inner = bmesh.ops.inset_region(bm, faces=front, thickness=0.018, depth=0.005)
    for f in front: f.material_index = 1
    make(nm, bm, ['catOrange_1', 'catPink_1'], base, head)

# ---- 腕: 短く太い。前に出して構える。手は白、手のひら側にピンクの肉球 ----
for sx, nm in ((1, 'arm_L'), (-1, 'arm_R')):
    shoulder = Vector((0.26 * sx, -0.06, 0.66))
    d = Vector((0.08 * sx, -0.2, -0.1)).normalized()       # 腕の向き（肩 → 手）
    rot = Vector((0, 0, -1)).rotation_difference(d).to_matrix()
    bm = bmesh.new()
    quadball(bm, 2, 2, 4, 0.55, (0.075, 0.075, 0.15), (0, 0, -0.13))
    paint(bm, lambda c, n, i: 1 if c.z < -0.17 else 0)          # 手（先の方）は白
    for v in bm.verts: v.co = shoulder + rot @ v.co
    paint(bm, lambda c, n, i: 2 if i == 1 and n.z < -0.55 else i)  # 手のひら（下を向いた面）は肉球のピンク
    make(nm, bm, ['catOrange_1', 'catWhite_1', 'catPink_1'], shoulder, torso)

# ---- 脚と、四角いブーツ ----
for sx, nm in ((1, 'leg_L'), (-1, 'leg_R')):
    hip = Vector((0.11 * sx, 0, 0.27))
    bm = bmesh.new()
    quadball(bm, 2, 2, 2, 0.5, (0.065, 0.065, 0.11), (hip.x, 0, 0.2))
    quadball(bm, 2, 2, 2, 0.25, (0.08, 0.11, 0.075), (hip.x, -0.025, 0.075), 1)
    for v in bm.verts:
        if v.co.z < 0.02: v.co.z = 0                       # 底を Z=0 にそろえる
    paint(bm, lambda c, n, i: i if i == 0 else (2 if n.z < -0.7 else 1))
    make(nm, bm, ['catOrange_1', 'boots_2', 'boots_0'], hip, root)

# ---- しっぽ: 腰の後ろから出て、後ろへ伸びてから上に曲がる。先が白 ----
P = [Vector(p) for p in ((0, 0.2, 0.42), (0, 0.36, 0.46), (0, 0.49, 0.55), (0, 0.58, 0.66), (0, 0.64, 0.78))]
R = [0.075, 0.075, 0.072, 0.07, 0.05]
T = [(P[min(i + 1, 4)] - P[max(i - 1, 0)]) for i in range(5)]   # つなぎ目では、前後の節で同じ向きの輪にする
parent = torso
for k in range(4):
    a, b = P[k], P[k + 1]
    bm = bmesh.new()
    tube(bm, [a, b], [R[k], R[k + 1]], 8, 1 if k == 3 else 0, [T[k], T[k + 1]])
    parent = make(f'tail_{k + 1}', bm, ['catOrange_1', 'catWhite_1'], a, parent)

# ---- 見やすくする（形には関係しない） ----
cube = bpy.data.objects.get('Cube')
if cube: cube.hide_set(True)
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        sp = area.spaces[0]
        sp.overlay.show_wireframes = True       # 参考画像のように辺を見せる
        sp.shading.type = 'SOLID'
        sp.shading.color_type = 'MATERIAL'

tris = 0
for ob in COLL.objects:
    if ob.type != 'MESH': continue
    me = ob.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh()
    tris += sum(len(p.vertices) - 2 for p in me.polygons)
print('猫の三角形の数:', tris)
