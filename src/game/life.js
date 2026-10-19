// 生きる・倒れる・眠る（survival.md）: HP などの状態、倒れた画面、寝床で起きる、夜に眠る、たき火のそば
import { createStats } from '../survival/stats.js';
import { createDeathScreen } from '../ui/statusHud.js';
import { dropBag } from '../survival/death.js';

// world(): 今の世界。setMode・lockPointer は main.js の画面の切り替え
export function createLife({ player, inventory, invHud, statusHud, sky, time, structuresOf, world, setMode, lockPointer }) {
  let sleeping = false; // 眠って暗転している間は、時間も空腹も止める
  const stats = createStats({
    onDamage: () => statusHud.hurt(),
    onDeath: () => (world()?.range ? (stats.reset(), invHud.message('HP を戻した（訓練島）')) : fallDown()), // 訓練島では倒れない
  });
  // 倒れる: 手に持つ列のほかを袋で落とし、倒れた画面へ。起きる: 島の最初の場所で（寝床ができたら寝床で）
  const deathScreen = createDeathScreen({ onWake: wake });
  function fallDown() {
    const s = player.state;
    deathScreen.setDropped(dropBag(world(), inventory, s.x, s.y, s.z));
    setMode('dead');
    document.exitPointerLock?.();
  }
  function wake() {
    const w = world();
    stats.wake();
    player.setWorld(w, structuresOf.get(w));
    const bed = structuresOf.get(w)?.list.findLast((p) => p.type === 'bed'); // 寝床があれば、その横で起きる
    if (bed) {
      const a = bed.mesh.rotation.y, s = player.state;
      Object.assign(s, { x: bed.pos.x + Math.sin(a), z: bed.pos.z + Math.cos(a), y: bed.pos.y + 0.6 });
    }
    setMode('fps');
    lockPointer();
  }
  return {
    stats, deathScreen,
    get sleeping() { return sleeping; },
    // 眠る（寝床に右クリック）: 夜だけ。暗転して朝 6:00 になる
    sleep() {
      if (sleeping) return;
      if (!time.isNight) return invHud.message('夜になってから眠れる');
      sleeping = true;
      statusHud.fade(true);
      setTimeout(() => {
        stats.sleep(time.skipToMorning());
        sky.setHour(time.hour);
        statusHud.update(stats.state, time);
        statusHud.fade(false);
        setTimeout(() => (sleeping = false), 1000);
      }, 1100);
    },
    // たき火から 3m 以内か（建てたたき火と、島のはじめからあるたき火）。そばだと HP の回復が速い
    // 建てたたき火は燃えている間だけ（survival.md「設備の窓と燃料」）
    nearFire() {
      const w = world(), st = structuresOf.get(w), s = player.state;
      return !!st?.list.some((p) => p.type === 'campfire' && p.burning && Math.hypot(p.pos.x - s.x, p.pos.z - s.z) < 3 && Math.abs(p.pos.y - s.y) < 3)
        || (w.fires ?? []).some((f) => Math.hypot(f.x - s.x, f.z - s.z) < 3);
    },
  };
}
