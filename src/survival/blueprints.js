// 設計図（docs/rules/survival.md「設計図」）: 読んだ設計図の名前を覚える
// レシピ・建築パーツに bp があると、その設計図を読むまで作れず、画面にも出さない。今あるレシピ（bp なし）は最初から作れる
export function createBlueprints({ onLearn = () => {} } = {}) {
  const known = new Set();
  return {
    has: (bp) => !bp || known.has(bp),
    // 読む: 新しく覚えたら true
    learn(bp) {
      if (known.has(bp)) return false;
      known.add(bp);
      onLearn(bp);
      return true;
    },
    reset() { known.clear(); },
    save: () => [...known],
    load(list) { known.clear(); for (const bp of list ?? []) known.add(bp); },
  };
}
