// __tests__/reminderBadge.test.js
//
// Poster "hatırlatma" (zil) rozetinin saf mantığı (utils/reminderBadge.js).
// Kural: kullanıcı o içerik için hatırlatma kurduysa VE hatırlatma hâlâ
// bekliyorsa (çıkış / yayın günü geçmediyse) rozet görünür. "Süren" tanımı
// hatırlatma limitinin sayacıyla (utils/reminderCounts.js) aynı fonksiyonlardan gelir.
//
// Son bölüm gerçek alan motoruyla (services/userData) çalışır: rozetin okuduğu
// görünüm biçimi ile hatırlatma eylemlerinin yazdığı biçim ayrışırsa burada kırılır.

import { REMINDER_BADGE, hasUpcomingReminder, upcomingReminderIndex } from "../utils/reminderBadge";

const { boot } = require("./helpers/userDataHarness");

const NOW = new Date(2026, 9, 15, 14, 0); // 15 Ekim 2026, öğleden sonra

const movie = (movieId, releaseDate = "2026-12-01") => ({ movieId, movieName: `Film ${movieId}`, releaseDate, type: "movie" });
const episode = (showId, episodeId, airDate = "2026-12-01") => ({
  episodeId: String(episodeId),
  episodeNumber: 1,
  showId,
  showName: `Dizi ${showId}`,
  seasonNumber: 1,
  airDate,
});
const view = (movies = [], episodes = []) => Object.freeze({ lists: Object.freeze({ movies, episodes }) });

describe("REMINDER_BADGE kaydı", () => {
  test("ayar anahtarı, simge ve renk sabit", () => {
    expect(REMINDER_BADGE.key).toBe("reminder");
    expect(REMINDER_BADGE.icon).toBe("notifications");
    expect(REMINDER_BADGE.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(Object.isFrozen(REMINDER_BADGE)).toBe(true);
  });

  test("renk, yığındaki diğer rozetlerin sabit renkleriyle çakışmaz", () => {
    // ListBadges FALLBACK değerleri + ayar ekranındaki rozet renkleri.
    const others = ["#64b4ff", "#29b864", "#e33", "#ff6400", "#38bdf8", "#FFEB3B", "#c060e0"];
    expect(others.map((c) => c.toLowerCase())).not.toContain(REMINDER_BADGE.color.toLowerCase());
  });
});

describe("hasUpcomingReminder — film", () => {
  test("çıkışı gelecekte olan film için zil var", () => {
    expect(hasUpcomingReminder(view([movie(1, "2026-12-01")]), 1, "movie", NOW)).toBe(true);
  });

  test("yarın ve bugün çıkan film hâlâ bekliyor (saat kaç olursa olsun)", () => {
    const v = view([movie(1, "2026-10-16"), movie(2, "2026-10-15")]);
    expect(hasUpcomingReminder(v, 1, "movie", NOW)).toBe(true);
    expect(hasUpcomingReminder(v, 2, "movie", NOW)).toBe(true);
  });

  test("çıkışı geçmiş film için zil YOK (bildirim zaten verildi)", () => {
    const v = view([movie(1, "2026-10-14"), movie(2, "2025-01-01")]);
    expect(hasUpcomingReminder(v, 1, "movie", NOW)).toBe(false);
    expect(hasUpcomingReminder(v, 2, "movie", NOW)).toBe(false);
  });

  test("tarihi olmayan / çözülemeyen kayıt süren sayılır (limit sayacıyla aynı)", () => {
    const v = view([movie(1, ""), { movieId: 2 }, movie(3, "yakında")]);
    [1, 2, 3].forEach((id) => expect(hasUpcomingReminder(v, id, "movie", NOW)).toBe(true));
  });

  test("hatırlatması olmayan film için yok", () => {
    expect(hasUpcomingReminder(view([movie(1)]), 2, "movie", NOW)).toBe(false);
  });

  test("kimlik sayı da olsa string de olsa aynı kayıt", () => {
    const v = view([movie(603)]);
    expect(hasUpcomingReminder(v, 603, "movie", NOW)).toBe(true);
    expect(hasUpcomingReminder(v, "603", "movie", NOW)).toBe(true);
  });

  test("mediaType 'tv' dışındaki her şey film sayılır (useListStatus sözleşmesi)", () => {
    const v = view([movie(5)]);
    expect(hasUpcomingReminder(v, 5, undefined, NOW)).toBe(true);
    expect(hasUpcomingReminder(v, 5, "movie", NOW)).toBe(true);
  });
});

describe("hasUpcomingReminder — dizi", () => {
  test("yayınlanmamış bir bölüm hatırlatması varsa dizi posterinde zil var", () => {
    expect(hasUpcomingReminder(view([], [episode(77, "a", "2026-11-01")]), 77, "tv", NOW)).toBe(true);
  });

  test("bir bölüm yayınlandı ama bir başkası bekliyor → zil var", () => {
    const v = view([], [episode(77, "a", "2026-10-01"), episode(77, "b", "2026-10-22")]);
    expect(hasUpcomingReminder(v, 77, "tv", NOW)).toBe(true);
  });

  test("tüm bölümleri yayınlanmış dizide zil YOK", () => {
    const v = view([], [episode(77, "a", "2026-09-01"), episode(77, "b", "2026-10-14")]);
    expect(hasUpcomingReminder(v, 77, "tv", NOW)).toBe(false);
  });

  test("başka dizinin bölüm hatırlatması bu diziyi etkilemez", () => {
    expect(hasUpcomingReminder(view([], [episode(1, "a")]), 2, "tv", NOW)).toBe(false);
  });

  test("tarihsiz bölüm süren sayılır", () => {
    expect(hasUpcomingReminder(view([], [episode(9, "a", "")]), 9, "tv", NOW)).toBe(true);
  });
});

describe("film ve dizi kimlik uzayları AYRI", () => {
  // TMDB'de aynı sayı hem bir film hem bir dizi olabilir.
  const v = view([movie(1399)], []);
  const w = view([], [episode(1399, "a")]);

  test("film hatırlatması aynı numaralı dizi posterine zil koymaz", () => {
    expect(hasUpcomingReminder(v, 1399, "movie", NOW)).toBe(true);
    expect(hasUpcomingReminder(v, 1399, "tv", NOW)).toBe(false);
  });

  test("dizi hatırlatması aynı numaralı film posterine zil koymaz", () => {
    expect(hasUpcomingReminder(w, 1399, "tv", NOW)).toBe(true);
    expect(hasUpcomingReminder(w, 1399, "movie", NOW)).toBe(false);
  });
});

describe("hasUpcomingReminder — savunmacı girdiler", () => {
  test("kimlik yoksa / boşsa false", () => {
    const v = view([movie(1)]);
    [undefined, null, ""].forEach((id) => expect(hasUpcomingReminder(v, id, "movie", NOW)).toBe(false));
  });

  test("0 geçerli bir kimlik değildir ama çökmez", () => {
    expect(hasUpcomingReminder(view([movie(1)]), 0, "movie", NOW)).toBe(false);
  });

  test("görünüm yok / bozuk ise false (çıkış yapmış kullanıcı, boş alan)", () => {
    [undefined, null, {}, "x", 5].forEach((bad) => {
      expect(hasUpcomingReminder(bad, 1, "movie", NOW)).toBe(false);
      expect(hasUpcomingReminder(bad, 1, "tv", NOW)).toBe(false);
    });
  });

  test("listeler eksik / dizi değilse çökmez", () => {
    expect(hasUpcomingReminder({ lists: {} }, 1, "movie", NOW)).toBe(false);
    expect(hasUpcomingReminder({ lists: { movies: null, episodes: "x" } }, 1, "tv", NOW)).toBe(false);
  });

  test("kimliksiz film kaydı kümeye girmez", () => {
    const idx = upcomingReminderIndex(view([{ releaseDate: "2026-12-01" }, { movieId: null }, { movieId: "" }]), NOW);
    expect(idx.movies.size).toBe(0);
  });
});

describe("upcomingReminderIndex — önbellek", () => {
  test("aynı görünüm + aynı gün: AYNI indeks nesnesi (poster başına yeniden hesap yok)", () => {
    const v = view([movie(1)]);
    const a = upcomingReminderIndex(v, NOW);
    const b = upcomingReminderIndex(v, new Date(2026, 9, 15, 23, 59));
    expect(b).toBe(a);
  });

  test("gece yarısı geçince indeks yenilenir: dünkü film artık 'geçmiş'", () => {
    const v = view([movie(1, "2026-10-15")]);
    expect(hasUpcomingReminder(v, 1, "movie", new Date(2026, 9, 15, 23, 59))).toBe(true);
    expect(hasUpcomingReminder(v, 1, "movie", new Date(2026, 9, 16, 0, 1))).toBe(false);
  });

  test("farklı görünüm nesnesi kendi indeksini alır (veri değişince bayat kalmaz)", () => {
    const a = view([movie(1)]);
    const b = view([movie(2)]);
    expect(hasUpcomingReminder(a, 1, "movie", NOW)).toBe(true);
    expect(hasUpcomingReminder(b, 1, "movie", NOW)).toBe(false);
    expect(hasUpcomingReminder(b, 2, "movie", NOW)).toBe(true);
  });

  test("boş girdi paylaşılan donmuş boş indeks döner", () => {
    expect(upcomingReminderIndex(null, NOW)).toBe(upcomingReminderIndex(undefined, NOW));
    expect(upcomingReminderIndex(null, NOW).movies.size).toBe(0);
  });
});

describe("gerçek alan motoruyla (services/userData)", () => {
  jest.useFakeTimers();
  afterEach(() => jest.clearAllTimers());

  // Gerçek tarih: motor hatırlatmaları şimdiki zamana göre değerlendirir.
  const iso = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const hazir = async (h) => {
    await h.mods.reminders.ensureHydrated("u1");
    h.mods.worker.start("u1");
    await jest.advanceTimersByTimeAsync(0);
  };
  const snap = (h) => h.mods.reminders.getSnapshot("u1");

  test("Reminder.js'in yazdığı film hatırlatması rozeti açar, kaldırınca kapatır", async () => {
    const h = boot();
    await hazir(h);
    const a = h.mods.remindersActions;

    expect(hasUpcomingReminder(snap(h), 603, "movie")).toBe(false);
    a.setMovie("u1", movie(603, iso(30)));
    expect(hasUpcomingReminder(snap(h), 603, "movie")).toBe(true);
    a.removeMovie("u1", 603);
    expect(hasUpcomingReminder(snap(h), 603, "movie")).toBe(false);
  });

  test("çıkışı geçmiş film kaydı kalsa da rozet yok", async () => {
    const h = boot();
    await hazir(h);
    h.mods.remindersActions.setMovie("u1", movie(10, iso(-3)));
    expect(h.mods.remindersActions.hasMovie("u1", 10)).toBe(true); // kayıt duruyor
    expect(hasUpcomingReminder(snap(h), 10, "movie")).toBe(false); // rozet yok
  });

  test("bölüm hatırlatması dizi posterine zil koyar; son bölüm kalkınca söner", async () => {
    const h = boot();
    await hazir(h);
    const a = h.mods.remindersActions;

    a.setEpisode("u1", episode(1399, "s1e1", iso(7)));
    a.setEpisode("u1", episode(1399, "s1e2", iso(14)));
    expect(hasUpcomingReminder(snap(h), 1399, "tv")).toBe(true);
    expect(hasUpcomingReminder(snap(h), 1399, "movie")).toBe(false);

    a.removeEpisode("u1", 1399, "s1e1");
    expect(hasUpcomingReminder(snap(h), 1399, "tv")).toBe(true);
    a.removeEpisode("u1", 1399, "s1e2");
    expect(hasUpcomingReminder(snap(h), 1399, "tv")).toBe(false);
  });

  test("her değişimde yeni görünüm nesnesi gelir, indeks bayat kalmaz", async () => {
    const h = boot();
    await hazir(h);
    const before = snap(h);
    h.mods.remindersActions.setMovie("u1", movie(7, iso(5)));
    const after = snap(h);
    expect(after).not.toBe(before);
    expect(upcomingReminderIndex(after).movies.has("7")).toBe(true);
    expect(upcomingReminderIndex(before).movies.has("7")).toBe(false);
  });
});
