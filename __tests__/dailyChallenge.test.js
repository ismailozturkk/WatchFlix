// utils/dailyChallenge.js — gün sınırı, seri ve günlük görünüm kuralları.
const {
  DAILY_BONUS_XP,
  DAILY_QUESTION_COUNT,
  dayKeyOf,
  previousDayKey,
  nextDayStartMs,
  dailySeed,
  dailyBoardId,
  effectiveStreak,
  nextStreak,
  buildDailyView,
  formatRemaining,
} = require("../utils/dailyChallenge");
const { computeSessionXp, XP_DAILY_BONUS } = require("../utils/gameScoring");

// 2026-10-03 12:00 UTC = TR 15:00 (UTC+3)
const NOON_UTC = Date.UTC(2026, 9, 3, 12, 0, 0);

describe("dayKeyOf (Türkiye günü, UTC+3)", () => {
  test("öğlen aynı takvim günü", () => {
    expect(dayKeyOf(NOON_UTC)).toBe("2026-10-03");
  });

  test("UTC 21:00 TR'de ertesi gün 00:00 → gün değişir", () => {
    expect(dayKeyOf(Date.UTC(2026, 9, 3, 20, 59, 59))).toBe("2026-10-03");
    expect(dayKeyOf(Date.UTC(2026, 9, 3, 21, 0, 0))).toBe("2026-10-04");
  });

  test("ay ve yıl sınırlarında doğru", () => {
    expect(dayKeyOf(Date.UTC(2026, 11, 31, 21, 0, 0))).toBe("2027-01-01");
    expect(dayKeyOf(Date.UTC(2028, 1, 28, 21, 0, 0))).toBe("2028-02-29"); // artık yıl
  });
});

describe("previousDayKey", () => {
  test("ay/yıl/artık yıl geçişleri", () => {
    expect(previousDayKey("2026-10-03")).toBe("2026-10-02");
    expect(previousDayKey("2026-03-01")).toBe("2026-02-28");
    expect(previousDayKey("2028-03-01")).toBe("2028-02-29");
    expect(previousDayKey("2027-01-01")).toBe("2026-12-31");
  });

  test("bozuk girdide null", () => {
    expect(previousDayKey("bozuk")).toBeNull();
  });
});

describe("nextDayStartMs", () => {
  test("bir sonraki TR gece yarısı (UTC 21:00)", () => {
    expect(nextDayStartMs(NOON_UTC)).toBe(Date.UTC(2026, 9, 3, 21, 0, 0));
  });

  test("tam sınırda bir sonraki güne atlar", () => {
    const boundary = Date.UTC(2026, 9, 3, 21, 0, 0);
    expect(nextDayStartMs(boundary)).toBe(Date.UTC(2026, 9, 4, 21, 0, 0));
  });

  test("dayKey sınırla tutarlı: sınır sonrası anahtar değişir", () => {
    const edge = nextDayStartMs(NOON_UTC);
    expect(dayKeyOf(edge - 1)).toBe("2026-10-03");
    expect(dayKeyOf(edge)).toBe("2026-10-04");
  });
});

describe("tohum ve tahta kimliği", () => {
  test("gün başına farklı, aynı gün aynı", () => {
    expect(dailySeed("2026-10-03")).toBe(dailySeed("2026-10-03"));
    expect(dailySeed("2026-10-03")).not.toBe(dailySeed("2026-10-04"));
    expect(dailyBoardId("2026-10-03")).toBe("scene_daily_2026-10-03");
  });
});

describe("effectiveStreak / nextStreak", () => {
  test("bugün veya dün oynandıysa seri korunur", () => {
    expect(effectiveStreak(4, "2026-10-03", NOON_UTC)).toBe(4);
    expect(effectiveStreak(4, "2026-10-02", NOON_UTC)).toBe(4);
  });

  test("iki gün önce kaldıysa seri KIRIKTIR", () => {
    expect(effectiveStreak(4, "2026-10-01", NOON_UTC)).toBe(0);
  });

  test("sayaç/gün yoksa 0", () => {
    expect(effectiveStreak(0, "2026-10-03", NOON_UTC)).toBe(0);
    expect(effectiveStreak(3, null, NOON_UTC)).toBe(0);
    expect(effectiveStreak(undefined, undefined, NOON_UTC)).toBe(0);
  });

  test("nextStreak: ilk oyun 1, ardışık gün +1, aynı gün sabit, kopukta 1", () => {
    expect(nextStreak(0, null, "2026-10-03")).toBe(1);
    expect(nextStreak(3, "2026-10-02", "2026-10-03")).toBe(4);
    expect(nextStreak(3, "2026-10-03", "2026-10-03")).toBe(3);
    expect(nextStreak(3, "2026-09-30", "2026-10-03")).toBe(1);
  });

  test("nextStreak ay sınırını aşar", () => {
    expect(nextStreak(5, "2026-09-30", "2026-10-01")).toBe(6);
  });
});

describe("buildDailyView", () => {
  test("hiç oynamamış kullanıcı: müsait, sonuç yok", () => {
    const view = buildDailyView(null, NOON_UTC);
    expect(view.status).toBe("available");
    expect(view.dayKey).toBe("2026-10-03");
    expect(view.result).toBeNull();
    expect(view.streak).toBe(0);
    expect(view.questionCount).toBe(DAILY_QUESTION_COUNT);
    expect(view.rewardXp).toBe(DAILY_BONUS_XP);
    expect(view.expiresAt).toBe(nextDayStartMs(NOON_UTC));
  });

  test("bugünkü deneme kullanılmış: tamamlandı + sonuç", () => {
    const stats = {
      dailyState: { dayKey: "2026-10-03", score: 740, correctCount: 7, totalCount: 10, outcome: "completed", xpEarned: 145 },
      dailyStreak: 2,
      lastDailyDay: "2026-10-03",
    };
    const view = buildDailyView(stats, NOON_UTC);
    expect(view.status).toBe("completed");
    expect(view.result).toEqual({ score: 740, correct: 7, total: 10, outcome: "completed", xpEarned: 145 });
    expect(view.streak).toBe(2);
  });

  test("dünün sonucu bugün 'müsait' sayılır ve seri hâlâ yaşar", () => {
    const stats = {
      dailyState: { dayKey: "2026-10-02", score: 500 },
      dailyStreak: 3,
      lastDailyDay: "2026-10-02",
    };
    const view = buildDailyView(stats, NOON_UTC);
    expect(view.status).toBe("available");
    expect(view.result).toBeNull();
    expect(view.streak).toBe(3);
  });
});

describe("formatRemaining", () => {
  test("saat:dakika", () => {
    expect(formatRemaining(NOON_UTC + 5 * 3600000 + 42 * 60000, NOON_UTC)).toBe("05:42");
    expect(formatRemaining(NOON_UTC, NOON_UTC)).toBe("00:00");
  });

  test("geçmişe düşmez, bozuk girdide --:--", () => {
    expect(formatRemaining(NOON_UTC - 1000, NOON_UTC)).toBe("00:00");
    expect(formatRemaining(undefined, NOON_UTC)).toBe("--:--");
  });
});

describe("günlük XP bonusu", () => {
  test("yalnız TAMAMLANAN günlükte verilir", () => {
    const base = computeSessionXp({ correctCount: 5, bestStreak: 0, outcome: "completed" });
    expect(computeSessionXp({ correctCount: 5, outcome: "completed", isDaily: true })).toBe(base + XP_DAILY_BONUS);
    expect(computeSessionXp({ correctCount: 5, outcome: "quit", isDaily: true })).toBe(50);
    expect(computeSessionXp({ correctCount: 5, outcome: "completed", isDaily: false })).toBe(base);
  });
});
