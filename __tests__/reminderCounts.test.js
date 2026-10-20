// Film/dizi hatırlatma limitinin sayacı (utils/reminderCounts.js).
// Kural: yalnız SÜREN hatırlatmalar hak harcar; çıkışı geçmiş film ve yayınlanmış
// bölümler hakkı serbest bırakır, bir dizinin tüm bölümleri tek hak sayılır.

import { activeMovieReminders, activeTvShowIds } from "../utils/reminderCounts";

const NOW = new Date(2026, 9, 10, 15, 30); // 10 Ekim 2026, öğleden sonra

describe("activeMovieReminders", () => {
  test("çıkışı geçmemiş filmler sayılır, geçmiş olanlar sayılmaz", () => {
    const movies = [
      { movieId: 1, releaseDate: "2026-12-01" }, // gelecek
      { movieId: 2, releaseDate: "2026-10-11" }, // yarın
      { movieId: 3, releaseDate: "2026-10-09" }, // dün — çıktı
      { movieId: 4, releaseDate: "2025-01-01" }, // çoktan çıktı
    ];
    expect(activeMovieReminders(movies, NOW).map((m) => m.movieId)).toEqual([1, 2]);
  });

  test("bugün çıkan film hâlâ süren sayılır (saat kaç olursa olsun)", () => {
    const movies = [{ movieId: 1, releaseDate: "2026-10-10" }];
    expect(activeMovieReminders(movies, NOW)).toHaveLength(1);
  });

  test("tarihi olmayan ya da çözülemeyen kayıt süren sayılır (limiti sessizce delmesin)", () => {
    const movies = [
      { movieId: 1, releaseDate: "" },
      { movieId: 2 },
      { movieId: 3, releaseDate: "yakında" },
    ];
    expect(activeMovieReminders(movies, NOW)).toHaveLength(3);
  });

  test("dizi değilse ya da bozuk girdide boş döner, çökmez", () => {
    expect(activeMovieReminders(undefined, NOW)).toEqual([]);
    expect(activeMovieReminders(null, NOW)).toEqual([]);
    expect(activeMovieReminders("x", NOW)).toEqual([]);
  });
});

describe("activeTvShowIds", () => {
  test("aynı dizinin onlarca bölümü TEK hak sayılır", () => {
    const episodes = Array.from({ length: 30 }, (_, i) => ({
      showId: 77,
      airDate: `2026-11-${String((i % 28) + 1).padStart(2, "0")}`,
    }));
    expect(activeTvShowIds(episodes, NOW).size).toBe(1);
  });

  test("farklı diziler ayrı sayılır; kimlikler string'e çevrilir", () => {
    const episodes = [
      { showId: 1, airDate: "2026-11-01" },
      { showId: "2", airDate: "2026-11-02" },
      { showId: 2, airDate: "2026-11-09" },
    ];
    expect([...activeTvShowIds(episodes, NOW)].sort()).toEqual(["1", "2"]);
  });

  test("tüm bölümleri yayınlanmış dizi hak harcamaz", () => {
    const episodes = [
      { showId: 1, airDate: "2026-09-01" },
      { showId: 1, airDate: "2026-10-09" },
    ];
    expect(activeTvShowIds(episodes, NOW).size).toBe(0);
  });

  test("bir bölümü hâlâ gelecekte olan dizi sayılır", () => {
    const episodes = [
      { showId: 1, airDate: "2026-09-01" },
      { showId: 1, airDate: "2026-10-17" },
    ];
    expect([...activeTvShowIds(episodes, NOW)]).toEqual(["1"]);
  });

  test("kimliksiz kayıt atlanır, tarihsiz bölüm süren sayılır, bozuk girdi çökmez", () => {
    expect(activeTvShowIds([{ airDate: "2026-11-01" }, { showId: null }], NOW).size).toBe(0);
    expect(activeTvShowIds([{ showId: 5 }], NOW).has("5")).toBe(true);
    expect(activeTvShowIds(undefined, NOW).size).toBe(0);
  });
});
