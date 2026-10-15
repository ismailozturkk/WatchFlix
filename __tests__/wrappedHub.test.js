// __tests__/wrappedHub.test.js
//
// Hub Wrapped kartının beslendiği saf hesaplar: yıl özetleri, geçen yılla
// kıyas penceresi, aktif gün / en uzun seri ve TR↔EN metin eşitliği.

import {
  buildYearlyRecap,
  getYearPace,
  getYearSummaries,
  longestStreakOf,
  countShows,
} from "../utils/wrapped";
import { getWrappedStrings } from "../utils/wrappedStrings";

const movie = (dateAdded, minutes = 100, extra = {}) => ({
  id: `m-${dateAdded}-${minutes}`,
  type: "movie",
  dateAdded,
  minutes,
  ...extra,
});
const ep = (episodeWatchTime, showId, episodeMinutes = 40, extra = {}) => ({
  id: `${showId}_${episodeWatchTime}_${episodeMinutes}`,
  showId,
  showName: `Show ${showId}`,
  episodeWatchTime,
  episodeMinutes,
  ...extra,
});

describe("getYearSummaries", () => {
  it("her yılı tek geçişte film/bölüm/dizi/dakika olarak toplar", () => {
    const movies = [movie("2025-03-01", 120), movie("2025-06-10", 90), movie("2024-01-02", 60)];
    const episodes = [
      ep("2025-03-02", 1, 40),
      ep("2025-03-03", 1, 40),
      ep("2025-04-01", 2, 50),
      ep("2024-05-05", 3, 45),
    ];
    const out = getYearSummaries(movies, episodes);
    expect(out[2025]).toEqual({ movies: 2, episodes: 3, shows: 2, minutes: 120 + 90 + 40 + 40 + 50 });
    expect(out[2024]).toEqual({ movies: 1, episodes: 1, shows: 1, minutes: 60 + 45 });
  });

  it("dizi sayısı countShows ile aynı sonucu verir (üç yüzeyde tek hesap)", () => {
    const episodes = [ep("2025-03-02", 1), ep("2025-03-03", 1), ep("2025-04-01", 2), ep("2025-04-02", 3)];
    expect(getYearSummaries([], episodes)[2025].shows).toBe(countShows(episodes));
  });

  it("geçersiz tarihli kayıtları yok sayar, boş girdide patlamaz", () => {
    expect(getYearSummaries([movie(null)], [ep("bozuk", 1)])).toEqual({});
    expect(getYearSummaries()).toEqual({});
  });
});

describe("getYearPace", () => {
  const movies = [
    movie("2025-02-01", 100),
    movie("2025-11-20", 300), // geçen yılın "bugünden sonraki" kısmı
    movie("2026-03-01", 200),
  ];

  it("devam eden yılda geçen yılın yalnız aynı dönemini alır", () => {
    const now = new Date(2026, 9, 3); // 3 Ekim 2026
    const pace = getYearPace({ movies, year: 2026, now });
    expect(pace.sameWindow).toBe(true);
    expect(pace.minutes).toBe(200);
    expect(pace.prevMinutes).toBe(100); // 20 Kasım 2025 dışarıda
    expect(pace.deltaPct).toBe(100);
  });

  it("bitmiş yılda iki yılı da tam kıyaslar", () => {
    const now = new Date(2027, 0, 5);
    const pace = getYearPace({ movies, year: 2026, now });
    expect(pace.sameWindow).toBe(false);
    expect(pace.prevMinutes).toBe(400);
    expect(pace.deltaPct).toBe(-50);
  });

  it("önceki yıl verisi yoksa yüzde üretmez (∞% yok)", () => {
    const pace = getYearPace({ movies: [movie("2026-03-01", 200)], year: 2026, now: new Date(2026, 9, 3) });
    expect(pace.prevMinutes).toBe(0);
    expect(pace.deltaPct).toBeNull();
  });

  it("bölüm dakikalarını da sayar", () => {
    const pace = getYearPace({
      episodes: [ep("2025-02-01", 1, 50), ep("2026-02-01", 1, 75)],
      year: 2026,
      now: new Date(2026, 9, 3),
    });
    expect(pace.minutes).toBe(75);
    expect(pace.prevMinutes).toBe(50);
    expect(pace.deltaPct).toBe(50);
  });
});

describe("longestStreakOf", () => {
  it("ardışık günlerin en uzununu bulur", () => {
    expect(longestStreakOf(["2025-03-01", "2025-03-02", "2025-03-03", "2025-03-10", "2025-03-11"])).toBe(3);
  });

  it("sırasız ve yinelenen günlerde doğru çalışır", () => {
    expect(longestStreakOf(["2025-03-03", "2025-03-01", "2025-03-02", "2025-03-02"])).toBe(3);
  });

  it("ay ve yıl sınırını geçen seriyi böler değil birleştirir", () => {
    expect(longestStreakOf(["2025-01-30", "2025-01-31", "2025-02-01"])).toBe(3);
    expect(longestStreakOf(["2024-12-31", "2025-01-01"])).toBe(2);
  });

  it("DST geçişi gününde seriyi bozmaz", () => {
    // Mart sonu / Ekim sonu: yerel saatte 23/25 saatlik günler.
    expect(longestStreakOf(["2025-03-29", "2025-03-30", "2025-03-31"])).toBe(3);
    expect(longestStreakOf(["2025-10-25", "2025-10-26", "2025-10-27"])).toBe(3);
  });

  it("boş girdi 0, tek gün 1", () => {
    expect(longestStreakOf([])).toBe(0);
    expect(longestStreakOf(["2025-05-05"])).toBe(1);
  });
});

describe("buildYearlyRecap: aktif gün ve seri", () => {
  it("aynı günde birden çok kayıt tek aktif gündür", () => {
    const recap = buildYearlyRecap({
      movies: [movie("2025-03-01"), movie("2025-03-01"), movie("2025-03-02")],
      episodes: [ep("2025-03-03", 1), ep("2025-03-10", 1)],
      year: 2025,
    });
    expect(recap.activeDays).toBe(4);
    expect(recap.longestStreak).toBe(3);
  });

  it("veri yoksa ikisi de 0", () => {
    const recap = buildYearlyRecap({ year: 2025 });
    expect(recap.activeDays).toBe(0);
    expect(recap.longestStreak).toBe(0);
  });
});

describe("wrappedStrings", () => {
  it("TR ve EN aynı anahtar kümesine sahip", () => {
    const tr = Object.keys(getWrappedStrings("tr")).sort();
    const en = Object.keys(getWrappedStrings("en")).sort();
    expect(en).toEqual(tr);
  });

  it("kilitli yıl satırı {plan} yer tutucusunu taşır", () => {
    ["tr", "en"].forEach((lang) => {
      expect(getWrappedStrings(lang).hubArchiveLockedSub).toContain("{plan}");
    });
  });

  it("arşiv alt metni {n} yer tutucusunu taşır", () => {
    ["tr", "en"].forEach((lang) => {
      const s = getWrappedStrings(lang);
      expect(s.hubArchiveSubOne).toContain("{n}");
      expect(s.hubArchiveSubMany).toContain("{n}");
    });
  });
});
