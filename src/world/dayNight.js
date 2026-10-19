// 昼と夜の時計（docs/rules/survival.md「HP・空腹・昼夜」）。1 日 20 分（昼 14 分 = 6〜20 時、夜 6 分 = 20〜6 時）
export const DAY_SEC = 14 * 60, NIGHT_SEC = 6 * 60, DAY_LEN = DAY_SEC + NIGHT_SEC;
const START_HOUR = 7;

// 時（0〜24）→ その日の始まり（6 時）からの秒
function secOf(hour) {
  const h = (hour - 6 + 24) % 24;
  return h < 14 ? (h / 14) * DAY_SEC : DAY_SEC + ((h - 14) / 10) * NIGHT_SEC;
}

export function createDayNight() {
  const state = { day: 1, sec: secOf(START_HOUR) }; // sec: その日の 6 時からの秒
  return {
    state,
    reset() { state.day = 1; state.sec = secOf(START_HOUR); },
    update(dt) {
      state.sec += dt;
      if (state.sec >= DAY_SEC + NIGHT_SEC) { state.sec -= DAY_SEC + NIGHT_SEC; state.day++; }
    },
    // 眠る: 朝 6:00 まで進める。進めた秒を返す（夜だけ呼ぶ）
    skipToMorning() {
      const left = DAY_LEN - state.sec;
      state.sec = 0;
      state.day++;
      return left;
    },
    // はじめからの秒（苗木が育つのに使う）
    get total() { return (state.day - 1) * DAY_LEN + state.sec; },
    // 今の時（0〜24、小数）
    get hour() {
      const s = state.sec;
      const h = s < DAY_SEC ? 6 + (s / DAY_SEC) * 14 : 20 + ((s - DAY_SEC) / NIGHT_SEC) * 10;
      return h % 24;
    },
    // 昼 / 夕方 / 夜 / 朝方
    get isNight() { return state.sec >= DAY_SEC; }, // 20:00〜6:00
    get phase() {
      const h = this.hour;
      return h >= 7 && h < 19 ? '昼' : h >= 19 && h < 21 ? '夕方' : h >= 5 && h < 7 ? '朝方' : '夜';
    },
    get label() {
      const h = this.hour, hh = Math.floor(h), mm = Math.floor((h - hh) * 6) * 10;
      return `${state.day}日目 ${hh}:${String(mm).padStart(2, '0')}`;
    },
  };
}
