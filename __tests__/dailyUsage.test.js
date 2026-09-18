// __tests__/dailyUsage.test.js
// Günlük premium haklarının (oyun, CineSwipe) saf sayaç mantığı.

import { localDayKey, readDailyCount, withDailyDelta } from "../utils/dailyUsage";

describe("günlük sayaç", () => {
  test("gün anahtarı YEREL takvim günüdür", () => {
    expect(localDayKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(localDayKey(new Date(2026, 11, 31, 0, 1))).toBe("2026-12-31");
  });

  test("boş veya bozuk durum sıfır sayılır", () => {
    expect(readDailyCount(null, "games", "2026-09-18")).toBe(0);
    expect(readDailyCount({ day: 5 }, "games", "2026-09-18")).toBe(0);
    expect(readDailyCount({ day: "2026-09-18", counts: { games: -3 } }, "games", "2026-09-18")).toBe(0);
  });

  test("aynı günde artar, başka özelliği etkilemez", () => {
    let state = null;
    state = withDailyDelta(state, "games", 1, "2026-09-18");
    state = withDailyDelta(state, "games", 1, "2026-09-18");
    state = withDailyDelta(state, "cineswipe_rooms", 1, "2026-09-18");
    expect(readDailyCount(state, "games", "2026-09-18")).toBe(2);
    expect(readDailyCount(state, "cineswipe_rooms", "2026-09-18")).toBe(1);
  });

  test("gün değişince TÜM sayaçlar sıfırlanır", () => {
    const yesterday = { day: "2026-09-17", counts: { games: 5, cineswipe_swipes: 60 } };
    expect(readDailyCount(yesterday, "games", "2026-09-18")).toBe(0);
    const today = withDailyDelta(yesterday, "games", 1, "2026-09-18");
    expect(today).toEqual({ day: "2026-09-18", counts: { games: 1 } });
  });

  test("iade sıfırın altına inmez ve boşalan sayaç silinir", () => {
    const state = { day: "2026-09-18", counts: { cineswipe_swipes: 1 } };
    const refunded = withDailyDelta(state, "cineswipe_swipes", -1, "2026-09-18");
    expect(refunded).toEqual({ day: "2026-09-18", counts: {} });
    const again = withDailyDelta(refunded, "cineswipe_swipes", -1, "2026-09-18");
    expect(readDailyCount(again, "cineswipe_swipes", "2026-09-18")).toBe(0);
  });

  test("girdi durumu yerinde değişmez", () => {
    const state = { day: "2026-09-18", counts: { games: 1 } };
    withDailyDelta(state, "games", 1, "2026-09-18");
    expect(state.counts.games).toBe(1);
  });
});
