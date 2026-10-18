// __tests__/yearlyGoal.test.js
//
// Yıllık izleme hedefi: saf hesap çekirdeği (utils/yearlyGoal.js) + kalıcı kayıt
// (Keys.yearlyGoals, GERÇEK depo / bellek-içi MMKV) + kaynak bekçisi.
//
// En kritik şeyler:
//   1. SAYIM: yıl, izleme TARİHİNDEN gelir (kayıt tarihinden değil); aynı film / aynı bölüm yıl içinde
//      tekrar izlenirse bir sayılır; dizi, o yıl en az bir bölümü izlenince sayılır.
//   2. İKİ HAT: film ve dizi ayrı ayrı açılır; dizi "dizi sayısı" ya da "bölüm sayısı" ölçer.
//   3. TEMPO / PLAN: düz çizgi, ölçeğe göre tolerans, artık yıl, 1 Ocak / 31 Aralık, yıl sonu tahmini.
//   4. KAYIT: bozuk/eksik/ESKİ biçimli kayıt asla hata vermez; çıkışta SİLİNMEZ (bulut kopyası yok).

const fs = require("fs");
const path = require("path");

const {
  DEFAULT_SHOW_MEASURE,
  GOAL_DEFAULTS,
  GOAL_LIMITS,
  GOAL_MIN,
  GOAL_PRESETS,
  GOAL_STEPS,
  MAX_STORED_YEARS,
  PROJECTION_MIN_DAYS,
  activeTracks,
  buildTrackProgress,
  clampTarget,
  clearYearlyGoal,
  combineProgress,
  computeGoalProgress,
  computeYearClock,
  countForKind,
  countYearTitles,
  draftFromGoal,
  draftSetMeasure,
  draftSetTarget,
  draftStep,
  draftToggle,
  draftTrack,
  getYearlyGoal,
  goalFromDraft,
  kindOf,
  monthlyYearTitles,
  normalizeYearlyGoals,
  sameGoal,
  setYearlyGoal,
  suggestDraft,
  toStoredYearlyGoals,
} = require("../utils/yearlyGoal");

const film = (id, dateAdded) => ({ id, dateAdded });
const bolum = (showId, episodeWatchTime, seasonNumber, episodeNumber) => ({
  showId, episodeWatchTime, seasonNumber, episodeNumber,
});
const T = (iso) => new Date(`${iso}T12:00:00`);

describe("clampTarget", () => {
  test.each([
    [50, "movies", 50],
    ["50", "movies", 50],
    [12.6, "movies", 13],
    [0, "movies", GOAL_MIN],
    [-5, "shows", GOAL_MIN],
    [100000, "movies", 999],
    [100000, "shows", 999],
    [100000, "episodes", 9999],
    [5000, "episodes", 5000],
  ])("%p (%s) → %p", (girdi, tur, beklenen) => expect(clampTarget(girdi, tur)).toBe(beklenen));

  test.each([null, undefined, "", "  ", "abc", true, NaN, Infinity, {}, []])("sayı değil (%p) → null", (girdi) => {
    expect(clampTarget(girdi)).toBeNull();
    expect(clampTarget(girdi, "episodes")).toBeNull();
  });

  test("bilinmeyen tür film sınırına düşer", () => {
    expect(clampTarget(5000, "yok")).toBe(999);
  });

  test("kindOf: hat + ölçü → sayılan tür", () => {
    expect(kindOf("movies")).toBe("movies");
    expect(kindOf("movies", "episodes")).toBe("movies");
    expect(kindOf("shows", "shows")).toBe("shows");
    expect(kindOf("shows", "episodes")).toBe("episodes");
    expect(kindOf("shows")).toBe("shows");
  });
});

describe("normalizeYearlyGoals", () => {
  test.each([null, undefined, "x", 5, true, [], ["2026"], () => 1])("bozuk girdi %p → boş, hata yok", (girdi) => {
    expect(normalizeYearlyGoals(girdi)).toEqual({});
  });

  test("yeni biçimi korur, her hattı kendi sınırına çeker", () => {
    expect(
      normalizeYearlyGoals({
        2026: { movies: { target: 50.4 }, shows: { target: 4000, measure: "episodes" } },
        2025: { movies: { target: 5000 }, shows: { target: 5000, measure: "shows" } },
      }),
    ).toEqual({
      2025: { movies: { target: 999 }, shows: { target: 999, measure: "shows" } },
      2026: { movies: { target: 50 }, shows: { target: 4000, measure: "episodes" } },
    });
  });

  test("tek hatlı kayıt: kapalı hattın ANAHTARI yazılmaz", () => {
    const n = normalizeYearlyGoals({ 2026: { movies: { target: 10 } } });
    expect(Object.keys(n[2026])).toEqual(["movies"]);
    const m = normalizeYearlyGoals({ 2026: { shows: { target: 10 } } });
    expect(Object.keys(m[2026])).toEqual(["shows"]);
    expect(m[2026].shows.measure).toBe(DEFAULT_SHOW_MEASURE);
  });

  test("geçersiz ölçü 'shows'a düşer", () => {
    expect(normalizeYearlyGoals({ 2026: { shows: { target: 10, measure: "saat" } } })[2026].shows.measure).toBe("shows");
  });

  test("geçersiz hat atılır, diğeri kalır; ikisi de geçersizse yıl düşer", () => {
    expect(normalizeYearlyGoals({ 2026: { movies: { target: "çok" }, shows: { target: 8 } } })).toEqual({
      2026: { shows: { target: 8, measure: "shows" } },
    });
    expect(normalizeYearlyGoals({ 2026: { movies: { target: null }, shows: "x" } })).toEqual({});
    expect(normalizeYearlyGoals({ 2026: {} })).toEqual({});
  });

  test("geçersiz yıl anahtarı atılır", () => {
    const n = normalizeYearlyGoals({
      abc: { movies: { target: 5 } },
      "26": { movies: { target: 5 } },
      1800: { movies: { target: 5 } },
      2999: { movies: { target: 5 } },
      2025: "elli",
      2026: { movies: { target: 20 } },
    });
    expect(Object.keys(n)).toEqual(["2026"]);
  });

  test(`yalnız en yeni ${MAX_STORED_YEARS} yıl kalır`, () => {
    const raw = {};
    for (let y = 2010; y <= 2026; y += 1) raw[y] = { movies: { target: 10 } };
    const n = normalizeYearlyGoals(raw);
    expect(Object.keys(n)).toHaveLength(MAX_STORED_YEARS);
    expect(n[2026]).toBeDefined();
    expect(n[2010]).toBeUndefined();
  });

  test("aynı küme = aynı JSON (anahtar sırası kanonik)", () => {
    const a = normalizeYearlyGoals({ 2026: { shows: { target: 5 }, movies: { target: 7 } }, 2024: { movies: { target: 7 } } });
    const b = normalizeYearlyGoals({ 2024: { movies: { target: 7 } }, 2026: { movies: { target: 7 }, shows: { target: 5 } } });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("girdiyi değiştirmez", () => {
    const girdi = { 2026: { movies: { target: 50.4 }, shows: { target: 3, measure: "x" } } };
    const kopya = JSON.parse(JSON.stringify(girdi));
    normalizeYearlyGoals(girdi);
    expect(girdi).toEqual(kopya);
  });
});

describe("ESKİ biçim ({ target, unit }) okunurken çevrilir", () => {
  test("film → film hattı", () => {
    expect(normalizeYearlyGoals({ 2026: { target: 50, unit: "movie" } })).toEqual({ 2026: { movies: { target: 50 } } });
  });

  test("dizi → dizi hattı (ölçü 'shows')", () => {
    expect(normalizeYearlyGoals({ 2026: { target: 30, unit: "tv" } })).toEqual({
      2026: { shows: { target: 30, measure: "shows" } },
    });
  });

  test("'all' (ve birimi olmayan) → hedef ikiye bölünür, film yukarı yuvarlanır", () => {
    const beklenen = { 2026: { movies: { target: 13 }, shows: { target: 12, measure: "shows" } } };
    expect(normalizeYearlyGoals({ 2026: { target: 25, unit: "all" } })).toEqual(beklenen);
    expect(normalizeYearlyGoals({ 2026: { target: 25 } })).toEqual(beklenen);
  });

  test("'all' ve hedef 1 → yalnız film hattı (dizi hattı 0 olamaz)", () => {
    expect(normalizeYearlyGoals({ 2026: { target: 1, unit: "all" } })).toEqual({ 2026: { movies: { target: 1 } } });
  });

  test("eski kayıtta geçersiz hedef yılı düşürür", () => {
    expect(normalizeYearlyGoals({ 2026: { target: null, unit: "movie" } })).toEqual({});
  });

  test("eski ve yeni yıl aynı kayıtta birlikte okunur", () => {
    const n = normalizeYearlyGoals({
      2025: { target: 40, unit: "movie" },
      2026: { movies: { target: 60 } },
    });
    expect(n[2025]).toEqual({ movies: { target: 40 } });
    expect(n[2026]).toEqual({ movies: { target: 60 } });
  });
});

describe("setYearlyGoal / getYearlyGoal / clearYearlyGoal / toStoredYearlyGoals / activeTracks", () => {
  const ikisi = { movies: { target: 50 }, shows: { target: 300, measure: "episodes" } };

  test("koyar, okur (kapalı hat null), değiştirir, kaldırır", () => {
    let goals = setYearlyGoal(null, 2026, { movies: { target: 50 } });
    expect(getYearlyGoal(goals, 2026)).toEqual({ movies: { target: 50 }, shows: null });
    goals = setYearlyGoal(goals, 2026, ikisi);
    expect(getYearlyGoal(goals, 2026)).toEqual(ikisi);
    goals = setYearlyGoal(goals, 2026, { shows: { target: 20, measure: "shows" } });
    expect(getYearlyGoal(goals, 2026)).toEqual({ movies: null, shows: { target: 20, measure: "shows" } });
    goals = clearYearlyGoal(goals, 2026);
    expect(getYearlyGoal(goals, 2026)).toBeNull();
  });

  test("başka yılın hedefini ezmez", () => {
    const goals = setYearlyGoal({ 2025: { movies: { target: 30 } } }, 2026, { movies: { target: 40 } });
    expect(getYearlyGoal(goals, 2025).movies.target).toBe(30);
    expect(getYearlyGoal(goals, 2026).movies.target).toBe(40);
  });

  test("hiç geçerli hat yoksa ya da yıl geçersizse mevcut kaydı DEĞİŞTİRMEZ", () => {
    const goals = { 2026: { movies: { target: 50 } } };
    expect(setYearlyGoal(goals, 2026, { movies: { target: "çok" } })).toEqual(goals);
    expect(setYearlyGoal(goals, 2026, {})).toEqual(goals);
    expect(setYearlyGoal(goals, 2026)).toEqual(goals);
    expect(setYearlyGoal(goals, 99999, { movies: { target: 5 } })).toEqual(goals);
    expect(setYearlyGoal(goals, "x", { movies: { target: 5 } })).toEqual(goals);
  });

  test("getYearlyGoal kopya döner (dışarıdan değiştirilemez)", () => {
    const goals = { 2026: ikisi };
    const goal = getYearlyGoal(goals, 2026);
    goal.movies.target = 1;
    goal.shows.target = 1;
    expect(goals[2026].movies.target).toBe(50);
    expect(goals[2026].shows.target).toBe(300);
  });

  test("hiç hedef kalmadıysa depoya NULL yazılır", () => {
    expect(toStoredYearlyGoals({})).toBeNull();
    expect(toStoredYearlyGoals(null)).toBeNull();
    expect(toStoredYearlyGoals(clearYearlyGoal({ 2026: { movies: { target: 5 } } }, 2026))).toBeNull();
    expect(toStoredYearlyGoals({ 2026: { movies: { target: 5 } } })).toEqual({ 2026: { movies: { target: 5 } } });
  });

  test("activeTracks: açık hatlar film önce, doğru türle", () => {
    expect(activeTracks(getYearlyGoal({ 2026: ikisi }, 2026))).toEqual([
      { track: "movies", kind: "movies", target: 50 },
      { track: "shows", kind: "episodes", target: 300, measure: "episodes" },
    ]);
    expect(activeTracks(getYearlyGoal({ 2026: { shows: { target: 8 } } }, 2026))).toEqual([
      { track: "shows", kind: "shows", target: 8, measure: "shows" },
    ]);
    expect(activeTracks(null)).toEqual([]);
    expect(activeTracks({ movies: null, shows: null })).toEqual([]);
  });

  test("sameGoal: hat, hedef ve ölçü farkını görür; boş = boş", () => {
    const a = getYearlyGoal({ 2026: ikisi }, 2026);
    expect(sameGoal(a, getYearlyGoal({ 2026: ikisi }, 2026))).toBe(true);
    expect(sameGoal(null, null)).toBe(true);
    expect(sameGoal(null, { movies: null, shows: null })).toBe(true);
    expect(sameGoal(a, null)).toBe(false);
    expect(sameGoal(a, { ...a, movies: { target: 51 } })).toBe(false);
    expect(sameGoal(a, { ...a, shows: { target: 300, measure: "shows" } })).toBe(false);
    expect(sameGoal(a, { ...a, shows: null })).toBe(false);
  });
});

describe("countYearTitles", () => {
  test("yıl, izleme TARİHİNDEN gelir; başka yıl sayılmaz", () => {
    const sonuc = countYearTitles({
      movieEntries: [film(1, "2026-03-01"), film(2, "2025-12-31"), film(3, "2026-12-31"), film(4, "2027-01-01")],
      year: 2026,
    });
    expect(sonuc.movies).toBe(2);
  });

  test("aynı film yıl içinde tekrar izlenirse BİR sayılır", () => {
    const sonuc = countYearTitles({
      movieEntries: [film(7, "2026-01-05"), film(7, "2026-06-05"), film(7, "2026-09-05")],
      year: 2026,
    });
    expect(sonuc.movies).toBe(1);
  });

  test("geçen yıl izlenip bu yıl tekrar izlenen film bu yıl da sayılır", () => {
    const entries = [film(7, "2025-02-01"), film(7, "2026-02-01")];
    expect(countYearTitles({ movieEntries: entries, year: 2025 }).movies).toBe(1);
    expect(countYearTitles({ movieEntries: entries, year: 2026 }).movies).toBe(1);
  });

  test("kimliksiz eski kayıtlar tek filme çökmez", () => {
    const sonuc = countYearTitles({
      movieEntries: [{ dateAdded: "2026-01-01" }, { dateAdded: "2026-02-01" }, { dateAdded: "2026-03-01" }],
      year: 2026,
    });
    expect(sonuc.movies).toBe(3);
  });

  test("dizi, o yıl en az bir bölümü izlenince BİR kez sayılır", () => {
    const sonuc = countYearTitles({
      episodes: [
        bolum("a", "2026-01-02", 1, 1), bolum("a", "2026-01-03", 1, 2), bolum("a", "2026-05-03", 1, 3),
        bolum("b", "2026-02-02", 1, 1),
        bolum("c", "2025-12-30", 1, 1),
      ],
      year: 2026,
    });
    expect(sonuc.shows).toBe(2);
  });

  test("BÖLÜM sayısı: farklı (dizi, sezon, bölüm) üçlüleri; aynı bölümü yeniden izlemek BİR sayılır", () => {
    const sonuc = countYearTitles({
      episodes: [
        bolum("a", "2026-01-02", 1, 1),
        bolum("a", "2026-03-02", 1, 1),   // aynı bölüm tekrar
        bolum("a", "2026-01-03", 1, 2),
        bolum("a", "2026-01-04", 2, 1),   // başka sezon
        bolum("b", "2026-01-05", 1, 1),   // başka dizi, aynı numara
        bolum("a", "2025-12-31", 1, 3),   // geçen yıl
      ],
      year: 2026,
    });
    expect(sonuc.episodes).toBe(4);
    expect(sonuc.shows).toBe(2);
  });

  test("numarasız eski bölüm kayıtları tek bölüme çökmez", () => {
    const sonuc = countYearTitles({
      episodes: [
        { showId: "a", episodeWatchTime: "2026-01-02" },
        { showId: "a", episodeWatchTime: "2026-01-03" },
      ],
      year: 2026,
    });
    expect(sonuc.episodes).toBe(2);
  });

  test("dizi kimliği yoksa ada düşer; ikisi de yoksa dizi sayılmaz (bölüm sayılır)", () => {
    const sonuc = countYearTitles({
      episodes: [
        { showName: "Ada", episodeWatchTime: "2026-01-02", seasonNumber: 1, episodeNumber: 1 },
        { showName: "Ada", episodeWatchTime: "2026-01-03", seasonNumber: 1, episodeNumber: 2 },
        { episodeWatchTime: "2026-01-04", seasonNumber: 1, episodeNumber: 1 },
      ],
      year: 2026,
    });
    expect(sonuc.shows).toBe(1);
    expect(sonuc.episodes).toBe(3);
  });

  test("1 Ocak'ta izlenen önceki yıla KAYMAZ (yerel takvim, UTC değil)", () => {
    const sonuc = countYearTitles({
      movieEntries: [film(1, "2026-01-01")],
      episodes: [bolum("a", "2026-01-01", 1, 1)],
      year: 2026,
    });
    expect(sonuc).toEqual({ movies: 1, shows: 1, episodes: 1 });
    expect(countYearTitles({ movieEntries: [film(1, "2026-01-01")], year: 2025 }).movies).toBe(0);
  });

  test("tarihsiz/bozuk tarihli kayıt sayılmaz, boş girdi 0 döner", () => {
    expect(
      countYearTitles({ movieEntries: [film(1, null), film(2, "yok")], episodes: [bolum("a", undefined, 1, 1)], year: 2026 }),
    ).toEqual({ movies: 0, shows: 0, episodes: 0 });
    expect(countYearTitles({ year: 2026 })).toEqual({ movies: 0, shows: 0, episodes: 0 });
  });

  test("countForKind türe göre seçer", () => {
    const sayim = { movies: 3, shows: 4, episodes: 50 };
    expect(countForKind(sayim, "movies")).toBe(3);
    expect(countForKind(sayim, "shows")).toBe(4);
    expect(countForKind(sayim, "episodes")).toBe(50);
    expect(countForKind(sayim, "yok")).toBe(0);
    expect(countForKind(null, "movies")).toBe(0);
  });
});

describe("monthlyYearTitles", () => {
  test("her şey o yıl İLK görüldüğü ayda bir kez sayılır", () => {
    const aylik = monthlyYearTitles({
      movieEntries: [
        film(1, "2026-01-10"), film(1, "2026-03-10"),   // Ocak'a yazılır (Mart'ta tekrar)
        film(2, "2026-03-05"),
        film(3, "2025-12-31"),                            // başka yıl
      ],
      year: 2026,
    });
    expect(aylik.movies).toEqual([1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  test("ilk görülme TARİHE göre bulunur, liste sırasına değil", () => {
    const aylik = monthlyYearTitles({
      movieEntries: [film(1, "2026-06-10"), film(1, "2026-02-10")],
      year: 2026,
    });
    expect(aylik.movies[1]).toBe(1);
    expect(aylik.movies[5]).toBe(0);
  });

  test("dizi ilk bölümünün ayına, bölüm kendi ayına yazılır", () => {
    const aylik = monthlyYearTitles({
      episodes: [
        bolum("a", "2026-02-02", 1, 1),
        bolum("a", "2026-04-02", 1, 2),
        bolum("b", "2026-04-03", 1, 1),
      ],
      year: 2026,
    });
    expect(aylik.shows[1]).toBe(1);
    expect(aylik.shows[3]).toBe(1);
    expect(aylik.episodes[1]).toBe(1);
    expect(aylik.episodes[3]).toBe(2);
  });

  test("aylık toplam, yıllık sayıyla AYNI (grafik halkadan farklı sayı göstermez)", () => {
    const movieEntries = [film(1, "2026-01-10"), film(1, "2026-03-10"), film(2, "2026-03-05"), film(3, "2026-12-31")];
    const episodes = [bolum("a", "2026-02-02", 1, 1), bolum("a", "2026-02-02", 1, 1), bolum("b", "2026-12-01", 2, 4)];
    const yillik = countYearTitles({ movieEntries, episodes, year: 2026 });
    const aylik = monthlyYearTitles({ movieEntries, episodes, year: 2026 });
    const toplam = (dizi) => dizi.reduce((a, b) => a + b, 0);
    expect(toplam(aylik.movies)).toBe(yillik.movies);
    expect(toplam(aylik.shows)).toBe(yillik.shows);
    expect(toplam(aylik.episodes)).toBe(yillik.episodes);
  });

  test("12 elemanlı, boş girdi sıfır", () => {
    const aylik = monthlyYearTitles({ year: 2026 });
    for (const dizi of Object.values(aylik)) expect(dizi).toEqual(Array(12).fill(0));
  });
});

describe("computeYearClock", () => {
  test("yılın ortasında: geçen/kalan gün ve yüzde", () => {
    const clock = computeYearClock({ year: 2026, now: T("2026-07-01") });
    expect(clock.total).toBe(365);
    expect(clock.elapsed).toBe(182);
    expect(clock.daysLeft).toBe(183);
    expect(clock.percent).toBe(49);
  });

  test("1 Ocak: 1 gün geçti; 31 Aralık: kalan 0", () => {
    expect(computeYearClock({ year: 2026, now: T("2026-01-01") }).daysLeft).toBe(364);
    expect(computeYearClock({ year: 2026, now: T("2026-12-31") }).daysLeft).toBe(0);
  });

  test("artık yıl 366", () => {
    expect(computeYearClock({ year: 2028, now: T("2028-01-01") }).total).toBe(366);
  });

  test("geçmiş yıl tamam, gelecek yıl hiç", () => {
    expect(computeYearClock({ year: 2025, now: T("2026-03-01") }).percent).toBe(100);
    expect(computeYearClock({ year: 2027, now: T("2026-03-01") }).elapsed).toBe(0);
  });
});

describe("computeGoalProgress", () => {
  test("oran, yüzde, kalan; %100 yalnız hedefe ulaşılınca", () => {
    const p = computeGoalProgress({ count: 31, target: 50, year: 2026, now: T("2026-07-01") });
    expect(p.ratio).toBeCloseTo(0.62, 5);
    expect(p.percent).toBe(62);
    expect(p.remaining).toBe(19);
    expect(p.done).toBe(false);
    expect(computeGoalProgress({ count: 199, target: 200, year: 2026, now: T("2026-07-01") }).percent).toBe(99);
  });

  test.each([[29, 100, 29], [57, 100, 57], [58, 100, 58], [7, 100, 7], [1, 3, 33], [2, 3, 66]])(
    "kayan nokta tuzağı: %i/%i → %%%i (0,29×100 = 28,999… olmasın)",
    (count, target, beklenen) => {
      expect(computeGoalProgress({ count, target, year: 2026, now: T("2026-07-01") }).percent).toBe(beklenen);
    },
  );

  test("hedefi aşınca ratio 1'de kalır, kalan 0, fazla sayılır, done true", () => {
    const p = computeGoalProgress({ count: 70, target: 50, year: 2026, now: T("2026-05-01") });
    expect(p.ratio).toBe(1);
    expect(p.percent).toBe(100);
    expect(p.remaining).toBe(0);
    expect(p.over).toBe(20);
    expect(p.done).toBe(true);
    expect(p.pace).toBe("done");
    expect(p.perWeekNeeded).toBeNull();
    expect(p.perMonthNeeded).toBeNull();
  });

  test("tempo: düz çizgi beklenti, ±1 tolerans (hedef 50)", () => {
    // 1 Temmuz = 182. gün → beklenen 50×182/365 ≈ 24,93
    const now = T("2026-07-01");
    const pace = (count) => computeGoalProgress({ count, target: 50, year: 2026, now }).pace;
    expect(pace(25)).toBe("onTrack");
    expect(pace(24)).toBe("onTrack");   // −0,93 → tolerans içinde
    expect(pace(26)).toBe("ahead");     // +1,07
    expect(pace(23)).toBe("behind");    // −1,93
    expect(computeGoalProgress({ count: 31, target: 50, year: 2026, now }).paceDelta).toBe(6);
    expect(computeGoalProgress({ count: 10, target: 50, year: 2026, now }).paceDelta).toBe(-15);
  });

  test("tolerans hedefle büyür: 500 bölümde ±10 'tempoda'", () => {
    const now = T("2026-07-01");   // beklenen ≈ 249,3
    const pace = (count) => computeGoalProgress({ count, target: 500, year: 2026, now }).pace;
    expect(pace(255)).toBe("onTrack");
    expect(pace(240)).toBe("onTrack");
    expect(pace(260)).toBe("ahead");
    expect(pace(238)).toBe("behind");
  });

  test("1 Ocak: beklenen ~0; hiçbir şey izlenmediyse 'tempoda'", () => {
    const p = computeGoalProgress({ count: 0, target: 50, year: 2026, now: T("2026-01-01") });
    expect(p.pace).toBe("onTrack");
    expect(p.daysLeft).toBe(364);
  });

  test("plan alanları: bugün olması gereken, çubuk işareti, haftalık/aylık ortalama", () => {
    const p = computeGoalProgress({ count: 31, target: 50, year: 2026, now: T("2026-07-01") });
    expect(p.planToday).toBe(25);
    expect(p.expectedRatio).toBeCloseTo(182 / 365, 5);
    expect(p.perWeekPlan).toBeCloseTo((50 * 7) / 365, 5);
    expect(p.perMonthPlan).toBeCloseTo(50 / 12, 5);
  });

  test("kalan için gereken tempo YUKARI yuvarlanır (0,1 hassasiyet)", () => {
    // 183 gün kaldı → 26,14 hafta / 6,02 ay; kalan 19 → 0,727/hf → 0,8 ; 3,158/ay → 3,2
    const p = computeGoalProgress({ count: 31, target: 50, year: 2026, now: T("2026-07-01") });
    expect(p.perWeekNeeded).toBe(0.8);
    expect(p.perMonthNeeded).toBe(3.2);
  });

  test("yılın son günlerinde kesir patlamaz (alt sınır 1 hafta / 1 ay)", () => {
    const p = computeGoalProgress({ count: 40, target: 50, year: 2026, now: T("2026-12-29") });
    expect(p.daysLeft).toBe(2);
    expect(p.perWeekNeeded).toBe(10);
    expect(p.perMonthNeeded).toBe(10);
  });

  test("31 Aralık: gün kalmadı → gereken tempo yok", () => {
    const p = computeGoalProgress({ count: 40, target: 50, year: 2026, now: T("2026-12-31") });
    expect(p.daysLeft).toBe(0);
    expect(p.perWeekNeeded).toBeNull();
    expect(p.perMonthNeeded).toBeNull();
    expect(p.pace).not.toBe("done");
  });

  test(`yıl sonu tahmini: ${PROJECTION_MIN_DAYS} günden önce YOK, sonra hızdan hesaplanır`, () => {
    const proje = (iso, count) =>
      computeGoalProgress({ count, target: 50, year: 2026, now: T(iso) }).projected;
    expect(proje("2026-01-20", 3)).toBeNull();
    expect(proje(`2026-01-${PROJECTION_MIN_DAYS}`, 3)).toBe(Math.round((3 * 365) / PROJECTION_MIN_DAYS));
    expect(proje("2026-07-01", 31)).toBe(62);
    expect(proje("2026-07-01", 0)).toBeNull();
  });

  test("geçmiş yılda tahmin ve gereken tempo yok; gelecek yılda da", () => {
    const gecmis = computeGoalProgress({ count: 20, target: 50, year: 2025, now: T("2026-03-01") });
    expect(gecmis.projected).toBeNull();
    expect(gecmis.perWeekNeeded).toBeNull();
    expect(gecmis.pace).toBe("missed");
    expect(computeGoalProgress({ count: 50, target: 50, year: 2025, now: T("2026-03-01") }).pace).toBe("done");
    expect(computeGoalProgress({ count: 0, target: 50, year: 2027, now: T("2026-11-01") }).pace).toBe("upcoming");
  });

  test("geçersiz hedef güvenli (sıfıra bölme yok)", () => {
    for (const target of [0, -3, undefined, "x"]) {
      const p = computeGoalProgress({ count: 3, target, year: 2026, now: T("2026-07-01") });
      expect(Number.isFinite(p.ratio)).toBe(true);
      expect(p.ratio).toBeLessThanOrEqual(1);
    }
  });
});

describe("combineProgress / buildTrackProgress", () => {
  const prog = (ratio, pace, done = false) => ({ progress: { ratio, pace, done } });

  test("boş girdi → null", () => {
    expect(combineProgress([])).toBeNull();
    expect(combineProgress(null)).toBeNull();
    expect(combineProgress([{}])).toBeNull();
  });

  test("yüzde hatların oranlarının ORTALAMASI (toplam adet değil)", () => {
    const c = combineProgress([prog(0.62, "ahead"), prog(0.5, "ahead")]);
    expect(c.ratio).toBeCloseTo(0.56, 5);
    expect(c.percent).toBe(56);
    expect(c.count).toBe(2);
  });

  test("tek hat: kendi yüzdesi (kayan nokta tuzağına düşmeden)", () => {
    expect(combineProgress([prog(0.29, "onTrack")]).percent).toBe(29);
  });

  test("tempo: herhangi biri geride → geride; açık olanların hepsi önde → önde; aksi tempoda", () => {
    expect(combineProgress([prog(0.6, "ahead"), prog(0.2, "behind")]).pace).toBe("behind");
    expect(combineProgress([prog(0.6, "ahead"), prog(0.5, "ahead")]).pace).toBe("ahead");
    expect(combineProgress([prog(0.6, "ahead"), prog(0.5, "onTrack")]).pace).toBe("onTrack");
    expect(combineProgress([prog(1, "done", true), prog(0.5, "ahead")]).pace).toBe("ahead");
    expect(combineProgress([prog(1, "done", true), prog(0.2, "behind")]).pace).toBe("behind");
  });

  test("hepsi tamamsa done + %100; biri tamamsa değil", () => {
    const hepsi = combineProgress([prog(1, "done", true), prog(1, "done", true)]);
    expect(hepsi.done).toBe(true);
    expect(hepsi.percent).toBe(100);
    expect(hepsi.pace).toBe("done");
    const biri = combineProgress([prog(1, "done", true), prog(0.5, "onTrack")]);
    expect(biri.done).toBe(false);
    expect(biri.percent).toBe(75);
  });

  test("buildTrackProgress: her açık hat için türüne göre sayı + ilerleme", () => {
    const goal = getYearlyGoal({ 2026: { movies: { target: 50 }, shows: { target: 300, measure: "episodes" } } }, 2026);
    const tracks = buildTrackProgress({
      goal,
      counts: { movies: 31, shows: 6, episodes: 120 },
      year: 2026,
      now: T("2026-07-01"),
    });
    expect(tracks.map((t) => [t.track, t.kind, t.count, t.target])).toEqual([
      ["movies", "movies", 31, 50],
      ["shows", "episodes", 120, 300],
    ]);
    expect(tracks[0].progress.percent).toBe(62);
    expect(tracks[1].progress.percent).toBe(40);
  });

  test("hedef yoksa boş", () => {
    expect(buildTrackProgress({ goal: null, counts: {}, year: 2026, now: T("2026-07-01") })).toEqual([]);
  });
});

describe("taslak: öneri", () => {
  test("hiç veri yoksa iki hat da açık, ayda 2 film / ayda 1 dizi", () => {
    const d = suggestDraft({ goals: {}, year: 2026 });
    expect(d.movies).toEqual({ on: true, target: GOAL_DEFAULTS.movies });
    expect(d.shows).toEqual({
      on: true,
      measure: "shows",
      targets: { shows: GOAL_DEFAULTS.shows, episodes: GOAL_DEFAULTS.episodes },
    });
  });

  test("geçen yılın hedefi (hatlar ve ölçüyle) birebir önerilir", () => {
    const d = suggestDraft({
      goals: { 2025: { movies: { target: 40 }, shows: { target: 300, measure: "episodes" } } },
      year: 2026,
      previous: { movies: 99, shows: 99, episodes: 999 },
    });
    expect(d.movies).toEqual({ on: true, target: 40 });
    expect(d.shows.on).toBe(true);
    expect(d.shows.measure).toBe("episodes");
    expect(d.shows.targets.episodes).toBe(300);
    expect(d.shows.targets.shows).toBe(GOAL_DEFAULTS.shows);
  });

  test("geçen yıl yalnız film hedefi vardıysa dizi hattı KAPALI gelir", () => {
    const d = suggestDraft({ goals: { 2025: { movies: { target: 40 } } }, year: 2026 });
    expect(d.movies.on).toBe(true);
    expect(d.shows.on).toBe(false);
  });

  test("hedef yoksa geçen yıl izlenenin %10 fazlası; izleme olmayan hat KAPALI", () => {
    const d = suggestDraft({ goals: {}, year: 2026, previous: { movies: 40, shows: 0, episodes: 0 } });
    expect(d.movies).toEqual({ on: true, target: 45 });
    expect(d.shows.on).toBe(false);
    const e = suggestDraft({ goals: {}, year: 2026, previous: { movies: 0, shows: 8, episodes: 120 } });
    expect(e.movies.on).toBe(false);
    expect(e.shows.on).toBe(true);
    expect(e.shows.targets.shows).toBe(10);
    expect(e.shows.targets.episodes).toBe(150);
  });

  test("öneri tabanı: az izleme taban hedefe oturur", () => {
    const d = suggestDraft({ goals: {}, year: 2026, previous: { movies: 3, shows: 1, episodes: 5 } });
    expect(d.movies.target).toBe(12);
    expect(d.shows.targets.shows).toBe(6);
    expect(d.shows.targets.episodes).toBe(100);
  });

  test("öneri sınırı aşmaz", () => {
    const d = suggestDraft({ goals: {}, year: 2026, previous: { movies: 5000, shows: 5000, episodes: 99999 } });
    expect(d.movies.target).toBe(GOAL_LIMITS.movies.max);
    expect(d.shows.targets.shows).toBe(GOAL_LIMITS.shows.max);
    expect(d.shows.targets.episodes).toBe(GOAL_LIMITS.episodes.max);
  });
});

describe("taslak: dönüşümler ve düzenleme", () => {
  const oneri = suggestDraft({ goals: {}, year: 2026 });

  test("hedef yoksa taslak = öneri (KOPYA: öneriyi değiştirmez)", () => {
    const d = draftFromGoal(null, oneri);
    expect(d).toEqual(oneri);
    d.movies.target = 1;
    d.shows.targets.shows = 1;
    expect(oneri.movies.target).toBe(GOAL_DEFAULTS.movies);
    expect(oneri.shows.targets.shows).toBe(GOAL_DEFAULTS.shows);
  });

  test("kayıtlı hedef taslağa yansır; kapalı hat önerinin sayısını taşır", () => {
    const goal = getYearlyGoal({ 2026: { shows: { target: 30, measure: "episodes" } } }, 2026);
    const d = draftFromGoal(goal, oneri);
    expect(d.movies).toEqual({ on: false, target: GOAL_DEFAULTS.movies });
    expect(d.shows.on).toBe(true);
    expect(d.shows.measure).toBe("episodes");
    expect(d.shows.targets).toEqual({ shows: GOAL_DEFAULTS.shows, episodes: 30 });
  });

  test("goalFromDraft: açık hatlar; kapalı hat null; hiçbiri açık değilse null", () => {
    expect(goalFromDraft(oneri)).toEqual({
      movies: { target: 24 },
      shows: { target: 12, measure: "shows" },
    });
    expect(goalFromDraft(draftToggle(oneri, "shows", false))).toEqual({ movies: { target: 24 }, shows: null });
    expect(goalFromDraft(draftToggle(oneri, "movies", false))).toEqual({
      movies: null,
      shows: { target: 12, measure: "shows" },
    });
    expect(goalFromDraft(draftToggle(draftToggle(oneri, "movies", false), "shows", false))).toBeNull();
    expect(goalFromDraft(null)).toBeNull();
  });

  test("draftTrack: hattın türü ölçüye göre", () => {
    expect(draftTrack(oneri, "movies")).toEqual({ on: true, kind: "movies", target: 24 });
    expect(draftTrack(oneri, "shows")).toEqual({ on: true, kind: "shows", measure: "shows", target: 12 });
    expect(draftTrack(draftSetMeasure(oneri, "episodes"), "shows")).toEqual({
      on: true, kind: "episodes", measure: "episodes", target: 250,
    });
  });

  test("ölçü değişince İKİ ölçünün hedefi ayrı korunur", () => {
    let d = draftSetTarget(oneri, "shows", 15);
    d = draftSetMeasure(d, "episodes");
    d = draftSetTarget(d, "shows", 300);
    expect(draftTrack(d, "shows").target).toBe(300);
    d = draftSetMeasure(d, "shows");
    expect(draftTrack(d, "shows").target).toBe(15);
    expect(goalFromDraft(d).shows).toEqual({ target: 15, measure: "shows" });
  });

  test("geçersiz ölçü yok sayılır", () => {
    expect(draftSetMeasure(oneri, "saat")).toBe(oneri);
  });

  test("draftSetTarget türün sınırına oturur, geçersiz sayıyı yok sayar", () => {
    expect(draftTrack(draftSetTarget(oneri, "movies", 100000), "movies").target).toBe(999);
    expect(draftTrack(draftSetTarget(oneri, "movies", -4), "movies").target).toBe(GOAL_MIN);
    expect(draftTrack(draftSetTarget(oneri, "movies", "abc"), "movies").target).toBe(24);
    const bolum = draftSetMeasure(oneri, "episodes");
    expect(draftTrack(draftSetTarget(bolum, "shows", 20000), "shows").target).toBe(9999);
  });

  test("draftStep: film +1, bölüm +5 (kendi adımı), alt sınırda durur", () => {
    expect(draftTrack(draftStep(oneri, "movies", GOAL_STEPS.movies), "movies").target).toBe(25);
    const bolum = draftSetMeasure(oneri, "episodes");
    expect(draftTrack(draftStep(bolum, "shows", GOAL_STEPS.episodes), "shows").target).toBe(255);
    expect(draftTrack(draftStep(bolum, "shows", -GOAL_STEPS.episodes * 5), "shows").target).toBe(225);
    expect(draftTrack(draftStep(draftSetTarget(oneri, "movies", 2), "movies", -10), "movies").target).toBe(GOAL_MIN);
  });

  test("draftToggle diğer hattı ve hedefleri değiştirmez; girdiyi değiştirmez", () => {
    const kopya = JSON.parse(JSON.stringify(oneri));
    const d = draftToggle(oneri, "movies", false);
    expect(oneri).toEqual(kopya);
    expect(d.movies).toEqual({ on: false, target: 24 });
    expect(d.shows).toEqual(oneri.shows);
    expect(draftToggle(d, "movies", true).movies).toEqual({ on: true, target: 24 });
  });

  test("kaydedilmiş hedefle taslak aynıysa 'değişmedi' (sameGoal)", () => {
    const goal = getYearlyGoal({ 2026: { movies: { target: 50 }, shows: { target: 20, measure: "shows" } } }, 2026);
    const d = draftFromGoal(goal, oneri);
    expect(sameGoal(goalFromDraft(d), goal)).toBe(true);
    expect(sameGoal(goalFromDraft(draftStep(d, "movies", 1)), goal)).toBe(false);
    expect(sameGoal(goalFromDraft(draftToggle(d, "shows", false)), goal)).toBe(false);
  });
});

describe("sabitler", () => {
  test("hazır çipler artan ve türün sınırı içinde", () => {
    for (const [kind, list] of Object.entries(GOAL_PRESETS)) {
      expect([...list].sort((a, b) => a - b)).toEqual([...list]);
      list.forEach((n) => {
        expect(n).toBeGreaterThanOrEqual(GOAL_LIMITS[kind].min);
        expect(n).toBeLessThanOrEqual(GOAL_LIMITS[kind].max);
      });
    }
  });

  test("varsayılan hedefler ilgili türün hazır çipleri arasında", () => {
    for (const kind of Object.keys(GOAL_DEFAULTS)) expect(GOAL_PRESETS[kind]).toContain(GOAL_DEFAULTS[kind]);
  });

  test("adımlar pozitif ve sınırdan küçük", () => {
    for (const kind of Object.keys(GOAL_STEPS)) {
      expect(GOAL_STEPS[kind]).toBeGreaterThan(0);
      expect(GOAL_STEPS[kind] * 5).toBeLessThan(GOAL_LIMITS[kind].max);
    }
  });
});

describe("kalıcı kayıt (Keys.yearlyGoals) — gerçek depo", () => {
  const { __resetAllMMKV } = require("react-native-mmkv");
  const { Keys, clearUserScope, get, getStore, has, physicalKey, remove, set } = require("../services/storage");
  const { __resetStoreCaches } = require("../services/storage/store");
  const { __resetStores } = require("../services/storage/instances");

  const ikisi = { movies: { target: 50 }, shows: { target: 300, measure: "episodes" } };
  let warn;
  beforeEach(() => {
    __resetStores();
    __resetAllMMKV();
    __resetStoreCaches();
    warn = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  test("kayıt yokken null", () => {
    expect(get(Keys.yearlyGoals, { uid: "u1" })).toBeNull();
  });

  test("yaz/oku gidiş-dönüş, kullanıcı başına AYRI", () => {
    expect(set(Keys.yearlyGoals, setYearlyGoal(null, 2026, ikisi), { uid: "u1" })).toBe(true);
    expect(set(Keys.yearlyGoals, setYearlyGoal(null, 2026, { movies: { target: 12 } }), { uid: "u2" })).toBe(true);
    expect(getYearlyGoal(get(Keys.yearlyGoals, { uid: "u1" }), 2026)).toEqual(ikisi);
    expect(getYearlyGoal(get(Keys.yearlyGoals, { uid: "u2" }), 2026)).toEqual({ movies: { target: 12 }, shows: null });
  });

  test("null yazmak anahtarı siler", () => {
    set(Keys.yearlyGoals, setYearlyGoal(null, 2026, ikisi), { uid: "u1" });
    expect(has(Keys.yearlyGoals, { uid: "u1" })).toBe(true);
    expect(remove(Keys.yearlyGoals, { uid: "u1" })).toBe(true);
    expect(has(Keys.yearlyGoals, { uid: "u1" })).toBe(false);
  });

  test("dizi/metin gibi geçersiz değer YAZILMAZ", () => {
    expect(set(Keys.yearlyGoals, [2026], { uid: "u1" })).toBe(false);
    expect(set(Keys.yearlyGoals, "50", { uid: "u1" })).toBe(false);
    expect(get(Keys.yearlyGoals, { uid: "u1" })).toBeNull();
  });

  test("bozuk JSON okumayı bozmaz: varsayılana dönüp kendini onarır", () => {
    getStore(Keys.yearlyGoals.store).set(physicalKey(Keys.yearlyGoals, "u1"), "{bozuk json");
    expect(get(Keys.yearlyGoals, { uid: "u1" })).toBeNull();
    expect(normalizeYearlyGoals(get(Keys.yearlyGoals, { uid: "u1" }))).toEqual({});
  });

  test("ESKİ biçimde diske yazılmış kayıt yeni kodla okunur (veri kaybı yok)", () => {
    set(Keys.yearlyGoals, { 2026: { target: 50, unit: "movie" } }, { uid: "u1" });
    expect(getYearlyGoal(get(Keys.yearlyGoals, { uid: "u1" }), 2026)).toEqual({ movies: { target: 50 }, shows: null });
  });

  test("ÇIKIŞTA SİLİNMEZ (bulut kopyası yok; silinirse geri getirilemez)", () => {
    expect(Keys.yearlyGoals.keepOnLogout).toBe(true);
    set(Keys.yearlyGoals, setYearlyGoal(null, 2026, ikisi), { uid: "u1" });
    clearUserScope("u1");
    expect(getYearlyGoal(get(Keys.yearlyGoals, { uid: "u1" }), 2026)).toEqual(ikisi);
  });
});

describe("kapsam bekçisi", () => {
  const KOK = path.join(__dirname, "..");
  const oku = (...p) => fs.readFileSync(path.join(KOK, ...p), "utf8");

  test("Profil ekranı 'goal' bölümünü bölüm görünürlüğüne bağlar ve kimlik bloğuna geçirir", () => {
    expect(oku("screens", "tabs", "ProfileScreen.js")).toMatch(/showGoal=\{showSection\("goal"\)\}/);
    expect(oku("components", "profile", "ProfileIdentityBlock.js")).toMatch(/showGoal\s*\?\s*<YearlyGoalButton/);
  });

  test("eski kart kaldırıldı: profil gövdesinde ikinci bir hedef yüzeyi yok", () => {
    expect(oku("screens", "tabs", "ProfileScreen.js")).not.toMatch(/YearlyGoalCard/);
    expect(fs.existsSync(path.join(KOK, "components", "profile", "YearlyGoalCard.js"))).toBe(false);
  });

  test("analytics olayı kayıtlı", () => {
    const { ANALYTICS_EVENTS, isValidEventName } = require("../utils/analyticsEvents");
    expect(ANALYTICS_EVENTS.YEARLY_GOAL).toBe("yearly_goal");
    expect(isValidEventName(ANALYTICS_EVENTS.YEARLY_GOAL)).toBe(true);
  });

  test("yazma/okuma yolunda Firestore YOK (yalnız cihaz)", () => {
    for (const dosya of [["hooks", "useYearlyGoal.js"], ["utils", "yearlyGoal.js"]]) {
      // Yalnız KOD: yorumlarda "Firestore"dan söz etmek serbest.
      expect(oku(...dosya)).not.toMatch(/from\s+["'][^"']*(firebase|firestore)|\b(onSnapshot|getDoc|setDoc|updateDoc)\s*\(/i);
    }
  });
});
