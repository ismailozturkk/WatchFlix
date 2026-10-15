// __tests__/userDataReminders.test.js
//
// Hatırlatıcılar: movies + tvShows/{id}/episodes. Eski kod her çan simgesi için
// buluttan "var mı?" ve "dizide başka bölüm kaldı mı?" diye soruyordu; artık
// ikisi de yerel kopyadan bilinir, dizi belgesi bölüm sayısından türetilir.

const { boot } = require("./helpers/userDataHarness");

jest.useFakeTimers();
afterEach(() => jest.clearAllTimers());

const movie = (id, extra = {}) => ({
  movieId: id,
  movieName: `Film ${id}`,
  releaseDate: "2026-12-01",
  posterPath: "/p.jpg",
  type: "movie",
  ...extra,
});
const episode = (showId, epId, extra = {}) => ({
  episodeId: String(epId),
  episodeNumber: 1,
  showId,
  showName: `Dizi ${showId}`,
  showPosterPath: "/s.jpg",
  seasonNumber: 1,
  airDate: "2026-12-01",
  ...extra,
});

const hazir = async (h) => {
  await h.mods.reminders.ensureHydrated("u1");
  h.mods.worker.start("u1");
  await jest.advanceTimersByTimeAsync(0);
};
const flush = () => jest.advanceTimersByTimeAsync(500);
const view = (h) => h.mods.reminders.getSnapshot("u1");

describe("film hatırlatıcısı", () => {
  test("ekle/kaldır yerelde anında, buluta arka planda", async () => {
    const h = boot();
    await hazir(h);
    const a = h.mods.remindersActions;

    a.setMovie("u1", movie(603));
    expect(a.hasMovie("u1", 603)).toBe(true);
    expect(h.remote.db.has("Reminders/u1/movies/603")).toBe(false); // henüz gitmedi
    await flush();
    expect(h.remote.db.get("Reminders/u1/movies/603")).toMatchObject({ movieId: 603 });

    a.removeMovie("u1", 603);
    expect(a.hasMovie("u1", 603)).toBe(false);
    await flush();
    expect(h.remote.db.has("Reminders/u1/movies/603")).toBe(false);
  });

  test("toggleMovie işlem SONRASI durumu döner", async () => {
    const h = boot();
    await hazir(h);
    const a = h.mods.remindersActions;
    expect(a.toggleMovie("u1", movie(1))).toBe(true);
    expect(a.toggleMovie("u1", movie(1))).toBe(false);
  });

  test("anahtar sayı da olsa string da olsa aynı kayıt (603 === '603')", async () => {
    const h = boot();
    await hazir(h);
    const a = h.mods.remindersActions;
    a.setMovie("u1", movie(603));
    expect(a.hasMovie("u1", "603")).toBe(true);
    a.setMovie("u1", movie("603"));
    expect(view(h).lists.movies).toHaveLength(1);
  });

  test("movieId'si olmayan kayıt reddedilir", async () => {
    const h = boot();
    await hazir(h);
    expect(h.mods.remindersActions.setMovie("u1", { movieName: "x" })).toBe(false);
    expect(h.mods.remindersActions.setMovie("u1", { movieId: "" })).toBe(false);
  });
});

describe("bölüm hatırlatıcısı ve dizi belgesi", () => {
  test("İLK bölüm eklenince dizi belgesi de yazılır", async () => {
    const h = boot();
    await hazir(h);
    h.mods.remindersActions.setEpisode("u1", episode(1399, "1399-1-1"));
    await flush();

    expect(h.remote.db.get("Reminders/u1/tvShows/1399")).toEqual({
      showId: 1399,
      showName: "Dizi 1399",
      showPosterPath: "/s.jpg",
    });
    expect(h.remote.db.has("Reminders/u1/tvShows/1399/episodes/1399-1-1")).toBe(true);
  });

  test("ikinci bölüm dizi belgesini TEKRAR yazmaz", async () => {
    const h = boot();
    await hazir(h);
    const a = h.mods.remindersActions;
    a.setEpisode("u1", episode(1399, "1399-1-1"));
    await flush();
    h.remote.calls.commit.length = 0;

    a.setEpisode("u1", episode(1399, "1399-1-2", { episodeNumber: 2 }));
    await flush();

    const yazilanlar = h.remote.calls.commit.flat().map((op) => op.path);
    expect(yazilanlar).toEqual(["Reminders/u1/tvShows/1399/episodes/1399-1-2"]);
  });

  test("bir bölüm kalkınca dizi belgesi KALIR, SON bölüm kalkınca silinir", async () => {
    const h = boot();
    await hazir(h);
    const a = h.mods.remindersActions;
    a.setEpisode("u1", episode(1399, "e1"));
    a.setEpisode("u1", episode(1399, "e2"));
    await flush();

    a.removeEpisode("u1", 1399, "e1");
    await flush();
    expect(h.remote.db.has("Reminders/u1/tvShows/1399")).toBe(true);
    expect(h.remote.db.has("Reminders/u1/tvShows/1399/episodes/e1")).toBe(false);

    a.removeEpisode("u1", 1399, "e2");
    await flush();
    expect(h.remote.db.has("Reminders/u1/tvShows/1399")).toBe(false);
    expect(h.remote.db.has("Reminders/u1/tvShows/1399/episodes/e2")).toBe(false);
  });

  test("başka dizinin bölümleri dizi belgesini korumaz/etkilemez", async () => {
    const h = boot();
    await hazir(h);
    const a = h.mods.remindersActions;
    a.setEpisode("u1", episode(1, "a"));
    a.setEpisode("u1", episode(2, "b"));
    await flush();
    a.removeEpisode("u1", 1, "a");
    await flush();
    expect(h.remote.db.has("Reminders/u1/tvShows/1")).toBe(false);
    expect(h.remote.db.has("Reminders/u1/tvShows/2")).toBe(true);
  });

  test("ekle-sil aynı pencerede birleşir: bulutta iz kalmaz", async () => {
    const h = boot();
    await hazir(h);
    const a = h.mods.remindersActions;
    a.setEpisode("u1", episode(7, "x"));
    a.removeEpisode("u1", 7, "x");
    await flush();
    expect(h.remote.db.has("Reminders/u1/tvShows/7")).toBe(false);
    expect(h.remote.db.has("Reminders/u1/tvShows/7/episodes/x")).toBe(false);
  });

  test("hasEpisode / toggleEpisode", async () => {
    const h = boot();
    await hazir(h);
    const a = h.mods.remindersActions;
    expect(a.hasEpisode("u1", 5, "e")).toBe(false);
    expect(a.toggleEpisode("u1", episode(5, "e"))).toBe(true);
    expect(a.hasEpisode("u1", 5, "e")).toBe(true);
    expect(a.hasEpisode("u1", "5", "e")).toBe(true); // sayı/string
    expect(a.toggleEpisode("u1", episode(5, "e"))).toBe(false);
  });

  test("eksik showId/episodeId reddedilir", async () => {
    const h = boot();
    await hazir(h);
    const a = h.mods.remindersActions;
    expect(a.setEpisode("u1", { episodeId: "e" })).toBe(false);
    expect(a.setEpisode("u1", { showId: 1 })).toBe(false);
  });

  test("OKUMA YAPMAZ: hatırlatıcı eklemek/kaldırmak buluttan hiçbir şey okutmaz", async () => {
    const h = boot();
    await hazir(h);
    const okuma = h.remote.reads();
    const a = h.mods.remindersActions;
    for (let i = 0; i < 20; i += 1) {
      a.hasEpisode("u1", 1, `e${i}`);
      a.setEpisode("u1", episode(1, `e${i}`));
    }
    a.removeEpisode("u1", 1, "e3");
    await flush();
    expect(h.remote.reads()).toBe(okuma);
  });

  test("20 bölüm eklemek tek batch (tek ağ turu)", async () => {
    const h = boot();
    await hazir(h);
    h.remote.calls.commit.length = 0;
    const a = h.mods.remindersActions;
    for (let i = 0; i < 20; i += 1) a.setEpisode("u1", episode(1, `e${i}`));
    await flush();
    expect(h.remote.calls.commit).toHaveLength(1);
    expect(h.remote.calls.commit[0]).toHaveLength(21); // 20 bölüm + 1 dizi belgesi
  });
});

describe("tek seferlik indirme", () => {
  const seedCloud = (h) => {
    h.remote.seed("Reminders/u1/movies/10", movie(10));
    h.remote.seed("Reminders/u1/tvShows/1", { showId: 1, showName: "D1" });
    h.remote.seed("Reminders/u1/tvShows/1/episodes/a", episode(1, "a"));
    h.remote.seed("Reminders/u1/tvShows/1/episodes/b", episode(1, "b"));
    h.remote.seed("Reminders/u1/tvShows/2", { showId: 2, showName: "D2" });
    h.remote.seed("Reminders/u1/tvShows/2/episodes/c", episode(2, "c"));
  };

  test("filmler + tüm dizilerin bölümleri gelir", async () => {
    const h = boot();
    seedCloud(h);
    await h.mods.reminders.ensureHydrated("u1");
    expect(view(h).lists.movies).toHaveLength(1);
    expect(view(h).lists.episodes.map((e) => e.episodeId).sort()).toEqual(["a", "b", "c"]);
  });

  test("açılışta (kopya varken) SIFIR okuma — eski kod 2+N dinleyici açıyordu", async () => {
    const h = boot();
    seedCloud(h);
    await h.mods.reminders.ensureHydrated("u1");
    h.restart();
    h.remote.calls.fetchCollection.length = 0;
    h.remote.calls.fetchDoc.length = 0;

    expect(view(h).ready).toBe(true);
    expect(view(h).lists.episodes).toHaveLength(3);
    await h.mods.reminders.ensureHydrated("u1");
    expect(h.remote.reads()).toBe(0);
  });

  test("iki parçadan biri eksikse (yarım kopya) hazır SAYILMAZ", async () => {
    const h = boot();
    seedCloud(h);
    await h.mods.reminders.ensureHydrated("u1");
    // yalnız 'episodes' dosyasını sil
    h.mods.cacheStore.remove(...h.mods.cacheKeys.reminders("u1", "episodes"));
    h.restart();
    expect(view(h).ready).toBe(false);
  });

  test("eski disk biçimi (dizi) AYNEN okunur: güncellemede indirme yok", async () => {
    const h = boot();
    // eski sürüm şekli: movies = dizi, episodes = düz dizi
    h.mods.cacheStore.setJSON(...h.mods.cacheKeys.reminders("u1", "movies"), [movie(10)]);
    h.mods.cacheStore.setJSON(...h.mods.cacheKeys.reminders("u1", "episodes"), [
      episode(1, "a"),
    ]);
    h.restart();
    expect(view(h).ready).toBe(true);
    expect(h.mods.remindersActions.hasMovie("u1", 10)).toBe(true);
    expect(h.mods.remindersActions.hasEpisode("u1", 1, "a")).toBe(true);
    expect(h.remote.reads()).toBe(0); // ilk karede ağ beklenmedi
  });

  test("EKSİK eski önbellek (kısmi dizi bölümleri) bir kez buluttan tamamlanır", async () => {
    const h = boot();
    seedCloud(h); // bulutta 3 bölüm: a, b (dizi 1) ve c (dizi 2)
    // Eski sürüm dizi başına dinleyiciler gelirken kapanmıştı: yalnız 'a' yazılmış.
    h.mods.cacheStore.setJSON(...h.mods.cacheKeys.reminders("u1", "movies"), [movie(10)]);
    h.mods.cacheStore.setJSON(...h.mods.cacheKeys.reminders("u1", "episodes"), [episode(1, "a")]);
    h.restart();
    expect(view(h).lists.episodes).toHaveLength(1);

    await h.mods.reminders.ensureHydrated("u1");
    expect(view(h).lists.episodes.map((e) => e.episodeId).sort()).toEqual(["a", "b", "c"]);

    // ve bir daha sorulmaz
    h.restart();
    h.remote.calls.fetchCollection.length = 0;
    await h.mods.reminders.ensureHydrated("u1");
    expect(h.remote.reads()).toBe(0);
  });

  test("yazma sonrası disk biçimi de dizi (eski sürüme dönüşte okunabilir)", async () => {
    const h = boot();
    await hazir(h);
    h.mods.remindersActions.setMovie("u1", movie(5));
    h.mods.snapshot.flushSnapshotWrites();
    const disk = h.mods.cacheStore.getJSON(...h.mods.cacheKeys.reminders("u1", "movies"));
    expect(Array.isArray(disk)).toBe(true);
    expect(disk[0].movieId).toBe(5);
  });
});

describe("eski şema göçü (Reminders/{uid} dizileri)", () => {
  test("legacyRemindersToDocs: film, dizi belgesi ve bölümleri üretir", () => {
    const { legacyRemindersToDocs } = require("../services/userData/domains");
    const out = legacyRemindersToDocs("u1", {
      movieReminders: [movie(1)],
      tvReminders: [
        {
          showId: 9,
          showName: "D",
          showPosterPath: "/x",
          seasons: [
            { seasonNumber: 2, seasonPosterPath: "/sp", episodes: [{ episodeNumber: 3 }, { episodeId: "zz", episodeNumber: 4 }] },
          ],
        },
      ],
    });
    expect(out.movies).toHaveLength(1);
    expect(out.episodes.map((e) => e.episodeId)).toEqual(["9-2-3", "zz"]);
    expect(out.episodes[0]).toMatchObject({ showId: 9, seasonNumber: 2, seasonPosterPath: "/sp" });
    const yollar = out.ops.map((o) => o.path);
    expect(yollar).toContain("Reminders/u1/movies/1");
    expect(yollar).toContain("Reminders/u1/tvShows/9");
    expect(yollar).toContain("Reminders/u1/tvShows/9/episodes/9-2-3");
  });

  test("alt koleksiyonlar boşsa eski belge taşınır ve gösterilir", async () => {
    const h = boot();
    h.remote.seed("Reminders/u1", {
      movieReminders: [movie(1)],
      tvReminders: [{ showId: 9, showName: "D", seasons: [{ seasonNumber: 1, episodes: [{ episodeNumber: 1 }] }] }],
    });
    await h.mods.reminders.ensureHydrated("u1");
    expect(view(h).lists.movies).toHaveLength(1);
    expect(view(h).lists.episodes).toHaveLength(1);
    expect(h.remote.db.has("Reminders/u1/movies/1")).toBe(true);
  });
});
