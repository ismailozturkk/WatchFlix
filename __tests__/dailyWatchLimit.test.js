// Günlük 1440 dk izleme sınırı (utils/dailyWatchLimit.js) — saf çekirdek:
//   • kullanım haritası film + dizi olaylarından (tekrar izleme dahil) çıkar
//   • tek film/bölüm sığmazsa ret, sığıyorsa tam sınırda bile kabul
//   • toplu ekleme (tüm dizi / sezon) sığmayınca seçilen günden GERİYE doğru günlere
//     yayılır; her gün sınırın altında kalır, her bölüm tam bir kez yer alır, sıra korunur
//   • mevcut kullanım olan günlerin yalnız boş kısmı kullanılır; yayılma sınırı aşılırsa ret

const {
  DAY_MINUTES,
  MAX_SPREAD_DAYS,
  dayUsage,
  planDailyWatch,
  remainingMinutes,
  shiftDay,
} = require("../utils/dailyWatchLimit");

const eps = (count, minutes) => Array.from({ length: count }, () => ({ minutes }));
const usageOf = (entries) => new Map(Object.entries(entries));

describe("shiftDay", () => {
  it("ay ve yıl sınırlarını geçer", () => {
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDay("2024-03-01", -1)).toBe("2024-02-29");
    expect(shiftDay("2026-10-22", 3)).toBe("2026-10-25");
  });
  it("geçersiz gün null", () => {
    expect(shiftDay("22.10.2026", -1)).toBeNull();
    expect(shiftDay(undefined, -1)).toBeNull();
  });
});

describe("dayUsage", () => {
  it("film olaylarını (tekrar izleme dahil) süreleriyle toplar", () => {
    const usage = dayUsage({
      watchedMovies: {
        movie_1: {
          id: 1,
          minutes: 120,
          watchEvents: [
            { id: "a", watchedAt: "2026-10-01", scope: "movie" },
            { id: "b", watchedAt: "2026-10-01", scope: "movie" },
            { id: "c", watchedAt: "2026-10-02", scope: "movie" },
          ],
        },
      },
    });
    expect(usage.get("2026-10-01")).toBe(240);
    expect(usage.get("2026-10-02")).toBe(120);
  });

  it("olay listesi olmayan eski film kaydı dateAdded gününe yazılır", () => {
    const usage = dayUsage({ watchedMovies: { movie_2: { id: 2, minutes: 95, dateAdded: "2026-09-30" } } });
    expect(usage.get("2026-09-30")).toBe(95);
  });

  it("dizi olaylarını olayın gününe yazar; aynı gün iki olay toplanır", () => {
    const usage = dayUsage({
      watchedTv: {
        tv_9: {
          id: 9,
          seasons: [
            {
              seasonNumber: 1,
              episodes: [
                { episodeNumber: 1, episodeMinutes: 45 },
                { episodeNumber: 2, episodeMinutes: 45 },
                { episodeNumber: 3, episodeMinutes: 50 },
              ],
            },
          ],
          watchEvents: [
            { id: "e1", watchedAt: "2026-10-05", scope: "episode", episodeKeys: ["1:1", "1:2"] },
            { id: "e2", watchedAt: "2026-10-05", scope: "episode", episodeKeys: ["1:3"] },
          ],
        },
      },
    });
    expect(usage.get("2026-10-05")).toBe(140);
  });

  it("süresi bilinmeyen içerik sınırı doldurmaz; bozuk girdide çökmez", () => {
    const usage = dayUsage({
      watchedMovies: { movie_3: { id: 3, dateAdded: "2026-10-01" }, bad: null },
      watchedTv: { tv_1: null },
    });
    expect(usage.size).toBe(0);
    expect(dayUsage().size).toBe(0);
  });

  it("remainingMinutes: aşılmış gün 0", () => {
    const usage = usageOf({ "2026-10-01": 1500, "2026-10-02": 1000 });
    expect(remainingMinutes(usage, "2026-10-01")).toBe(0);
    expect(remainingMinutes(usage, "2026-10-02")).toBe(440);
    expect(remainingMinutes(usage, "2026-10-03")).toBe(DAY_MINUTES);
  });
});

describe("planDailyWatch — tek öğe (yayılma yok)", () => {
  const one = (minutes, usage) =>
    planDailyWatch({ items: [{ minutes }], watchDate: "2026-10-22", usage, allowSpread: false });

  it("boş güne sığar", () => {
    expect(one(180, new Map()).ok).toBe(true);
  });
  it("TAM sınırda kabul, 1 dk fazlada ret", () => {
    expect(one(440, usageOf({ "2026-10-22": 1000 })).ok).toBe(true);
    const over = one(441, usageOf({ "2026-10-22": 1000 }));
    expect(over).toMatchObject({ ok: false, reason: "full", day: "2026-10-22", used: 1000, remaining: 440, requested: 441 });
  });
  it("süresi 0 olan içerik dolu güne bile eklenir", () => {
    expect(one(0, usageOf({ "2026-10-22": 1440 })).ok).toBe(true);
  });
  it("tek başına bir günden uzun öğe boş güne yazılabilir (veri hatasına takılma)", () => {
    expect(one(2000, new Map()).ok).toBe(true);
    expect(one(2000, usageOf({ "2026-10-22": 10 })).ok).toBe(false);
  });
  it("geçersiz tarih", () => {
    expect(planDailyWatch({ items: [{ minutes: 5 }], watchDate: "yarın", usage: new Map() })).toMatchObject({
      ok: false,
      reason: "invalid",
    });
  });
});

describe("planDailyWatch — toplu ekleme (yayılma)", () => {
  const plan = (items, usage = new Map(), extra = {}) =>
    planDailyWatch({ items, watchDate: "2026-10-22", usage, ...extra });

  it("sığıyorsa tek parça, yayılma yok", () => {
    const result = plan(eps(10, 45)); // 450 dk
    expect(result).toMatchObject({ ok: true, spread: false, totalMinutes: 450 });
    expect(result.chunks).toEqual([{ date: "2026-10-22", from: 0, to: 9, minutes: 450 }]);
  });

  it("boş listede iş yok", () => {
    expect(plan([])).toMatchObject({ ok: true, chunks: [], spread: false });
  });

  it("sığmayan dizi seçilen günden geriye doğru günlere bölünür; sıra ve toplam korunur", () => {
    const items = eps(100, 45); // 4500 dk → 32 bölüm/gün (1440) → 4 gün
    const result = plan(items);
    expect(result.ok).toBe(true);
    expect(result.spread).toBe(true);
    // Kronolojik: ilk parça en eski gün, son parça seçilen gün.
    expect(result.chunks[result.chunks.length - 1].date).toBe("2026-10-22");
    expect(result.chunks.map((c) => c.date)).toEqual([...result.chunks.map((c) => c.date)].sort());
    expect(result.startDate).toBe(result.chunks[0].date);
    expect(result.endDate).toBe("2026-10-22");
    // Her gün sınırın altında.
    result.chunks.forEach((chunk) => expect(chunk.minutes).toBeLessThanOrEqual(DAY_MINUTES));
    // Parçalar bitişik: boşluk ve çakışma yok, her bölüm tam bir kez.
    let next = 0;
    result.chunks.forEach((chunk) => {
      expect(chunk.from).toBe(next);
      next = chunk.to + 1;
    });
    expect(next).toBe(items.length);
    expect(result.chunks.reduce((sum, c) => sum + c.minutes, 0)).toBe(4500);
  });

  it("seçilen günün yalnız BOŞ kısmını kullanır, dolu günü atlar", () => {
    const usage = usageOf({ "2026-10-22": 1400, "2026-10-21": 1440 }); // 22'sinde 40 dk boş, 21'i tam dolu
    const result = plan(eps(4, 30), usage); // 120 dk
    // 22: 1 bölüm (30 ≤ 40); 21: dolu → atlanır; 20: kalan 3 bölüm.
    expect(result.chunks).toEqual([
      { date: "2026-10-20", from: 0, to: 2, minutes: 90 },
      { date: "2026-10-22", from: 3, to: 3, minutes: 30 },
    ]);
  });

  it("süresi bilinmeyen (0 dk) bölümler günü doldurmaz ama kaybolmaz", () => {
    const result = plan([...eps(40, 45), ...eps(5, 0)]); // 1800 dk + 5 süresiz
    const covered = result.chunks.reduce((sum, c) => sum + (c.to - c.from + 1), 0);
    expect(covered).toBe(45);
  });

  it("yayılma sınırı aşılırsa HİÇBİR ŞEY planlanmaz (span)", () => {
    const huge = eps(MAX_SPREAD_DAYS * 40, 45); // ≈ 1 yıl + katı
    const result = plan(huge);
    expect(result).toMatchObject({ ok: false, reason: "span", day: "2026-10-22" });
    expect(result.requested).toBe(MAX_SPREAD_DAYS * 40 * 45);
  });

  it("sınır özelleştirilebilir", () => {
    expect(plan(eps(100, 45), new Map(), { maxSpreadDays: 3 }).ok).toBe(false);
    expect(plan(eps(100, 45), new Map(), { maxSpreadDays: 4 }).ok).toBe(true);
  });

  it("yarın dolu olsa da geriye gider: gelecek tarih ÜRETİLMEZ", () => {
    const result = plan(eps(100, 45), usageOf({ "2026-10-23": 1440 }));
    expect(result.chunks.every((c) => c.date <= "2026-10-22")).toBe(true);
  });
});
