const { formatTimeAgo } = require("../utils/postTime");

const AGO = { now: "az önce", minute: "dk önce", hour: "saat önce", day: "gün önce", week: "hafta önce" };
const NOW = 1_800_000_000_000;
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("formatTimeAgo", () => {
  test("bir dakikadan azı → 'şimdi' etiketi", () => {
    expect(formatTimeAgo(NOW - 5 * 1000, AGO, NOW)).toBe("az önce");
    expect(formatTimeAgo(NOW, AGO, NOW)).toBe("az önce");
  });

  test("dakika / saat / gün / hafta basamakları", () => {
    expect(formatTimeAgo(NOW - 5 * MIN, AGO, NOW)).toBe("5 dk önce");
    expect(formatTimeAgo(NOW - 3 * HOUR, AGO, NOW)).toBe("3 saat önce");
    expect(formatTimeAgo(NOW - 2 * DAY, AGO, NOW)).toBe("2 gün önce");
    expect(formatTimeAgo(NOW - 15 * DAY, AGO, NOW)).toBe("2 hafta önce");
  });

  test("sınırlar: 59 dk dakika, 60 dk saat; 23 sa saat, 24 sa gün; 6 gün gün, 7 gün hafta", () => {
    expect(formatTimeAgo(NOW - 59 * MIN, AGO, NOW)).toBe("59 dk önce");
    expect(formatTimeAgo(NOW - 60 * MIN, AGO, NOW)).toBe("1 saat önce");
    expect(formatTimeAgo(NOW - 23 * HOUR, AGO, NOW)).toBe("23 saat önce");
    expect(formatTimeAgo(NOW - 24 * HOUR, AGO, NOW)).toBe("1 gün önce");
    expect(formatTimeAgo(NOW - 6 * DAY, AGO, NOW)).toBe("6 gün önce");
    expect(formatTimeAgo(NOW - 7 * DAY, AGO, NOW)).toBe("1 hafta önce");
  });

  test("zaman damgası veya etiket yoksa boş dize", () => {
    expect(formatTimeAgo(0, AGO, NOW)).toBe("");
    expect(formatTimeAgo(undefined, AGO, NOW)).toBe("");
    expect(formatTimeAgo(NOW - MIN, undefined, NOW)).toBe("");
  });
});
