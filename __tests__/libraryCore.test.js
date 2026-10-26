const {
  LIBRARY_ERROR,
  LibraryError,
  classifyLibraryError,
  toLibraryError,
  createKeyedQueue,
  mapConcurrentStrict,
  mediaKey,
  isMembershipList,
  isCustomListName,
  isSameMedia,
  customListHas,
  listItemFromDetails,
  listSourceOrCard,
  movieWatchItemFromDetails,
  showMetaFromDetails,
  episodeFromTmdb,
  watchableSeasonsOf,
} = require("../utils/libraryCore");
const { applyStatusOverlay, EMPTY_LIST_STATUS } = require("../utils/listStatusIndex");

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("anahtarlar ve liste adları", () => {
  test("mediaKey tipi normalize eder", () => {
    expect(mediaKey("tv", 1399)).toBe("tv_1399");
    expect(mediaKey("movie", 550)).toBe("movie_550");
    expect(mediaKey(undefined, 550)).toBe("movie_550");
    expect(mediaKey("person", 7)).toBe("movie_7");
  });

  test("yalnız favoriler ve izlenecekler üyelik listesidir", () => {
    expect(isMembershipList("favorites")).toBe(true);
    expect(isMembershipList("watchList")).toBe(true);
    expect(isMembershipList("watchedMovies")).toBe(false);
    expect(isMembershipList("watchedTv")).toBe(false);
    expect(isMembershipList("Cuma")).toBe(false);
  });

  test("özel liste adı: ayrılmış alanlar ve boş ad geçersiz", () => {
    expect(isCustomListName("Cuma gecesi")).toBe(true);
    expect(isCustomListName("S.W.A.T. Favorilerim")).toBe(true);
    ["counts", "stats", "statusIndex", "activityIndex", "customLists", "watchedTv", ""].forEach(
      (name) => expect(isCustomListName(name)).toBe(false),
    );
    expect(isCustomListName("   ")).toBe(false);
    expect(isCustomListName(null)).toBe(false);
  });

  test("isSameMedia id string/number karışımına dayanıklı, tip ayırır", () => {
    expect(isSameMedia({ id: 550, type: "movie" }, "550", "movie")).toBe(true);
    expect(isSameMedia({ id: "550", type: "movie" }, 550, "movie")).toBe(true);
    expect(isSameMedia({ id: 550, type: "movie" }, 550, "tv")).toBe(false);
    // Tipi olmayan eski girdi film sayılır.
    expect(isSameMedia({ id: 550 }, 550, "movie")).toBe(true);
    expect(isSameMedia(null, 550, "movie")).toBe(false);
  });

  test("customListHas dizi olmayan alanı yok sayar", () => {
    const lists = { Cuma: [{ id: 1, type: "tv" }], counts: { favorites: 1 } };
    expect(customListHas(lists, "Cuma", "1", "tv")).toBe(true);
    expect(customListHas(lists, "Cuma", 1, "movie")).toBe(false);
    expect(customListHas(lists, "counts", 1, "tv")).toBe(false);
    expect(customListHas(null, "Cuma", 1, "tv")).toBe(false);
  });
});

describe("classifyLibraryError", () => {
  const code = (error) => classifyLibraryError(error).code;

  test("Firestore ağ hataları çevrimdışıdır ve tekrar denenebilir", () => {
    expect(code({ code: "unavailable" })).toBe(LIBRARY_ERROR.OFFLINE);
    expect(code({ code: "deadline-exceeded" })).toBe(LIBRARY_ERROR.OFFLINE);
    expect(code({ code: "firestore/unavailable" })).toBe(LIBRARY_ERROR.OFFLINE);
    expect(
      code({ message: "Failed to get document because the client is offline." }),
    ).toBe(LIBRARY_ERROR.OFFLINE);
    expect(classifyLibraryError({ code: "unavailable" }).retryable).toBe(true);
  });

  test("axios ağ hataları çevrimdışıdır", () => {
    expect(code({ code: "ERR_NETWORK", message: "Network Error" })).toBe(LIBRARY_ERROR.OFFLINE);
    expect(code({ code: "ECONNABORTED", message: "timeout of 10000ms exceeded" })).toBe(
      LIBRARY_ERROR.OFFLINE,
    );
    expect(code({ message: "Network request failed" })).toBe(LIBRARY_ERROR.OFFLINE);
  });

  test("yetki / çakışma / kota", () => {
    expect(code({ code: "permission-denied" })).toBe(LIBRARY_ERROR.PERMISSION);
    expect(code({ code: "unauthenticated" })).toBe(LIBRARY_ERROR.PERMISSION);
    expect(code({ code: "aborted" })).toBe(LIBRARY_ERROR.CONFLICT);
    expect(code({ code: "resource-exhausted" })).toBe(LIBRARY_ERROR.QUOTA);
    expect(classifyLibraryError({ code: "permission-denied" }).retryable).toBe(false);
  });

  test("yayın kapısı ve liste adı kodları aynen geçer", () => {
    expect(code({ code: "unreleased" })).toBe(LIBRARY_ERROR.UNRELEASED);
    expect(code({ code: "unknown-release" })).toBe(LIBRARY_ERROR.UNKNOWN_RELEASE);
    expect(code({ code: "list-name-conflict" })).toBe(LIBRARY_ERROR.LIST_CONFLICT);
    expect(code({ code: "list-name-reserved" })).toBe(LIBRARY_ERROR.LIST_RESERVED);
    expect(classifyLibraryError({ code: "unreleased" }).retryable).toBe(false);
  });

  test("bilinmeyen / boş girdi UNKNOWN", () => {
    expect(code(new Error("boom"))).toBe(LIBRARY_ERROR.UNKNOWN);
    expect(code(null)).toBe(LIBRARY_ERROR.UNKNOWN);
    expect(code(undefined)).toBe(LIBRARY_ERROR.UNKNOWN);
  });

  test("toLibraryError idempotent, nedeni korur", () => {
    const cause = Object.assign(new Error("client is offline"), { code: "unavailable" });
    const wrapped = toLibraryError(cause);
    expect(wrapped).toBeInstanceOf(LibraryError);
    expect(wrapped.code).toBe(LIBRARY_ERROR.OFFLINE);
    expect(wrapped.cause).toBe(cause);
    expect(wrapped.retryable).toBe(true);
    expect(toLibraryError(wrapped)).toBe(wrapped);
  });
});

describe("createKeyedQueue", () => {
  test("aynı anahtardaki işler SIRAYLA çalışır", async () => {
    const queue = createKeyedQueue();
    const order = [];
    const first = deferred();

    const a = queue.run("k", async () => {
      order.push("a:start");
      await first.promise;
      order.push("a:end");
      return "A";
    });
    const b = queue.run("k", async () => {
      order.push("b:start");
      return "B";
    });

    await Promise.resolve();
    expect(order).toEqual(["a:start"]);
    first.resolve();
    await expect(a).resolves.toBe("A");
    await expect(b).resolves.toBe("B");
    expect(order).toEqual(["a:start", "a:end", "b:start"]);
  });

  test("farklı anahtarlar paralel çalışır", async () => {
    const queue = createKeyedQueue();
    const gate = deferred();
    const order = [];
    const slow = queue.run("x", async () => {
      await gate.promise;
      order.push("x");
    });
    await queue.run("y", async () => {
      order.push("y");
    });
    expect(order).toEqual(["y"]);
    gate.resolve();
    await slow;
    expect(order).toEqual(["y", "x"]);
  });

  test("bir işin hatası sonrakini ENGELLEMEZ ve kendi çağırana ulaşır", async () => {
    const queue = createKeyedQueue();
    const failing = queue.run("k", async () => {
      throw new Error("kırıldı");
    });
    const next = queue.run("k", async () => "devam");
    await expect(failing).rejects.toThrow("kırıldı");
    await expect(next).resolves.toBe("devam");
  });

  test("iş bitince anahtar temizlenir (sızıntı yok)", async () => {
    const queue = createKeyedQueue();
    await queue.run("k", async () => 1);
    await queue.run("k", async () => 2);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(queue.size).toBe(0);
    expect(queue.isBusy("k")).toBe(false);
  });

  test("ekle→çıkar yarışı: sonuç çağrı sırasını izler", async () => {
    const queue = createKeyedQueue();
    const log = [];
    const slowAdd = deferred();
    const add = queue.run("movie_1", async () => {
      await slowAdd.promise;
      log.push("add");
    });
    const remove = queue.run("movie_1", async () => {
      log.push("remove");
    });
    slowAdd.resolve();
    await Promise.all([add, remove]);
    expect(log).toEqual(["add", "remove"]);
  });
});

describe("mapConcurrentStrict", () => {
  test("sırayı korur ve sınırı aşmaz", async () => {
    let active = 0;
    let peak = 0;
    const out = await mapConcurrentStrict([1, 2, 3, 4, 5, 6], 2, async (n) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 3));
      active -= 1;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50, 60]);
    expect(peak).toBeLessThanOrEqual(2);
  });

  test("ilk hatada reddeder; kalan işler başlatılmaz", async () => {
    const started = [];
    await expect(
      mapConcurrentStrict([1, 2, 3, 4, 5, 6], 1, async (n) => {
        started.push(n);
        if (n === 2) throw new Error("sezon 2 düştü");
        return n;
      }),
    ).rejects.toThrow("sezon 2 düştü");
    expect(started).toEqual([1, 2]);
  });

  test("boş girdi boş dizi döner", async () => {
    await expect(mapConcurrentStrict([], 4, async () => 1)).resolves.toEqual([]);
    await expect(mapConcurrentStrict(null, 4, async () => 1)).resolves.toEqual([]);
  });
});

describe("kanonik öğe kurucuları", () => {
  const movieDetails = {
    id: 27205,
    title: "Inception",
    poster_path: "/i.jpg",
    runtime: 148,
    release_date: "2010-07-16",
    status: "Released",
    genres: [
      { id: 28, name: "Action" },
      { id: 878, name: "Science Fiction" },
    ],
  };
  const tvDetails = {
    id: 1399,
    name: "Game of Thrones",
    poster_path: "/got.jpg",
    first_air_date: "2011-04-17",
    status: "Ended",
    number_of_episodes: 73,
    number_of_seasons: 8,
    episode_run_time: [60],
    genres: [{ id: 18, name: "Drama" }],
  };

  test("film: ad, poster, tür adları, süre", () => {
    expect(listItemFromDetails(movieDetails, "movie", { dateAdded: "2026-01-01" })).toEqual({
      id: 27205,
      type: "movie",
      name: "Inception",
      imagePath: "/i.jpg",
      dateAdded: "2026-01-01",
      genres: ["Action", "Science Fiction"],
      minutes: 148,
    });
  });

  test("dizi: bölüm süresi/sayısı/sezon ve türetilmiş toplam süre (süresiz kapı yok)", () => {
    const item = listItemFromDetails(tvDetails, "tv", { dateAdded: "2026-01-01" });
    expect(item).toMatchObject({
      id: 1399,
      type: "tv",
      name: "Game of Thrones",
      imagePath: "/got.jpg",
      genres: ["Drama"],
      episodeMinutes: 60,
      episodeCount: 73,
      seasonCount: 8,
      totalMinutes: 4380,
    });
    // `minutes` diziye ASLA yazılmaz: toplam süre hesapları şişerdi.
    expect(item.minutes).toBeUndefined();
  });

  test("süresi 0/bilinmeyen film için minutes anahtarı hiç konmaz", () => {
    const item = listItemFromDetails({ ...movieDetails, runtime: 0 }, "movie");
    expect(Object.prototype.hasOwnProperty.call(item, "minutes")).toBe(false);
  });

  test("id yoksa null", () => {
    expect(listItemFromDetails(null, "movie")).toBeNull();
    expect(listItemFromDetails({ title: "x" }, "movie")).toBeNull();
  });

  test("detay yokken kart verisi liste öğesi kurar (T3 B14: çevrimdışı hızlı eylem)", () => {
    const card = { id: 66732, title: "Stranger Things", posterPath: "/st.jpg" };
    expect(listSourceOrCard(tvDetails, card)).toBe(tvDetails);
    const item = listItemFromDetails(listSourceOrCard(null, card), "tv", { dateAdded: "2026-10-26" });
    expect(item).toMatchObject({ id: 66732, type: "tv", imagePath: "/st.jpg", dateAdded: "2026-10-26" });
    expect(item.name).toBe("Stranger Things");
    expect(listSourceOrCard(null, {})).toBeNull();
  });

  test("movieWatchItemFromDetails yayın kapısı alanlarını taşır", () => {
    expect(movieWatchItemFromDetails(movieDetails, { dateAdded: "2026-02-01" })).toMatchObject({
      id: 27205,
      type: "movie",
      dateAdded: "2026-02-01",
      releaseDate: "2010-07-16",
      status: "Released",
    });
  });

  test("showMetaFromDetails: sayılar, tür adları, kapı alanları, yedek değerler", () => {
    expect(showMetaFromDetails(tvDetails)).toEqual({
      id: 1399,
      name: "Game of Thrones",
      showEpisodeCount: 73,
      showSeasonCount: 8,
      imagePath: "/got.jpg",
      genres: ["Drama"],
      firstAirDate: "2011-04-17",
      status: "Ended",
    });
    const sparse = showMetaFromDetails(
      { id: 5, number_of_episodes: undefined },
      { name: "Yedek Ad", imagePath: "/yedek.jpg" },
    );
    expect(sparse).toMatchObject({
      name: "Yedek Ad",
      imagePath: "/yedek.jpg",
      showEpisodeCount: 0,
      genres: [],
    });
    expect(showMetaFromDetails(null)).toBeNull();
  });

  test("episodeFromTmdb: releaseDate alanı null olsa da VAR (kapı kapalı kalsın)", () => {
    const episode = episodeFromTmdb({
      episode_number: 3,
      name: null,
      still_path: undefined,
      vote_average: 7.456,
      runtime: undefined,
      air_date: null,
    });
    expect(episode).toEqual({
      episodeNumber: 3,
      episodePosterPath: null,
      episodeName: "Unknown",
      episodeRatings: 7.5,
      episodeMinutes: 0,
      releaseDate: null,
    });
    expect(Object.prototype.hasOwnProperty.call(episode, "releaseDate")).toBe(true);
  });

  test("watchableSeasonsOf: 0. sezon ve boş sezonlar atlanır", () => {
    expect(
      watchableSeasonsOf({
        seasons: [
          { season_number: 0, episode_count: 5 },
          { season_number: 1, episode_count: 10 },
          { season_number: 2, episode_count: 0 },
          { season_number: 3, episode_count: 8 },
        ],
      }).map((season) => season.season_number),
    ).toEqual([1, 3]);
    expect(watchableSeasonsOf(null)).toEqual([]);
  });
});

describe("applyStatusOverlay", () => {
  const base = {
    movie: { 550: { ...EMPTY_LIST_STATUS, inWatchList: true } },
    tv: {},
  };

  test("boş bindirmede AYNI referans döner", () => {
    expect(applyStatusOverlay(base, { movie: {}, tv: {} })).toBe(base);
    expect(applyStatusOverlay(base, null)).toBe(base);
    expect(applyStatusOverlay(base, undefined)).toBe(base);
  });

  test("bayraklar mevcut durumun üstüne biner, olmayan eser sıfırdan kurulur", () => {
    const next = applyStatusOverlay(base, {
      movie: { 550: { inFavorites: true }, 603: { isWatched: true } },
      tv: { 1399: { inWatchList: true } },
    });
    expect(next).not.toBe(base);
    expect(next.movie[550]).toEqual({ ...EMPTY_LIST_STATUS, inWatchList: true, inFavorites: true });
    expect(next.movie[603]).toEqual({ ...EMPTY_LIST_STATUS, isWatched: true });
    expect(next.tv[1399].inWatchList).toBe(true);
    // Girdi değişmedi.
    expect(base.movie[603]).toBeUndefined();
  });

  test("niyet 'false' ise sunucudaki true'yu da bastırır", () => {
    const next = applyStatusOverlay(base, { movie: { 550: { inWatchList: false } }, tv: {} });
    expect(next.movie[550].inWatchList).toBe(false);
  });
});

const { findDriftedLists } = require("../utils/listStatusIndex");

describe("findDriftedLists", () => {
  const index = {
    movie: {
      550: { ...EMPTY_LIST_STATUS, inFavorites: true },
      603: { ...EMPTY_LIST_STATUS, inWatchList: true, isWatched: true },
      27205: { ...EMPTY_LIST_STATUS, inFavorites: false },
    },
    tv: {
      1399: { ...EMPTY_LIST_STATUS, isWatched: true },
    },
  };
  const consistent = {
    favorites: { movie_550: { id: 550, type: "movie" } },
    watchList: { movie_603: { id: 603, type: "movie" } },
    watchedMovies: { movie_603: { id: 603, type: "movie" } },
    watchedTv: { tv_1399: { id: 1399, type: "tv" } },
  };

  test("tutarlı durumda sapma yok", () => {
    expect(findDriftedLists(index, consistent)).toEqual([]);
  });

  test("sunucuda var, yerelde yok → sapma (başka cihazda eklendi)", () => {
    expect(findDriftedLists(index, { ...consistent, favorites: {} })).toEqual(["favorites"]);
    expect(findDriftedLists(index, { ...consistent, watchedTv: {} })).toEqual(["watchedTv"]);
  });

  test("sunucuda açıkça false, yerelde var → sapma (başka cihazda silindi)", () => {
    expect(
      findDriftedLists(index, {
        ...consistent,
        favorites: { ...consistent.favorites, movie_27205: { id: 27205, type: "movie" } },
      }),
    ).toEqual(["favorites"]);
  });

  test("bayrağı hiç olmayan yerel öğe sapma SAYILMAZ (eski kayıt)", () => {
    expect(
      findDriftedLists(index, {
        ...consistent,
        favorites: { ...consistent.favorites, movie_999: { id: 999, type: "movie" } },
      }),
    ).toEqual([]);
  });

  test("yüklenmemiş (undefined) liste atlanır — ilk indirmeyi o yönetir", () => {
    expect(findDriftedLists(index, { favorites: undefined, watchList: consistent.watchList })).toEqual([]);
  });

  test("izlenen listeler yalnız kendi tipine bakar; favoriler iki tipi de kapsar", () => {
    const mixedIndex = {
      movie: { 1: { ...EMPTY_LIST_STATUS, isWatched: true } },
      tv: { 1: { ...EMPTY_LIST_STATUS, isWatched: true, inFavorites: true } },
    };
    // watchedMovies film 1'i bekler; dizi 1 watchedTv'ye aittir.
    expect(
      findDriftedLists(mixedIndex, {
        watchedMovies: { movie_1: { id: 1, type: "movie" } },
        watchedTv: { tv_1: { id: 1, type: "tv" } },
        favorites: { tv_1: { id: 1, type: "tv" } },
      }),
    ).toEqual([]);
    expect(
      findDriftedLists(mixedIndex, {
        watchedMovies: { movie_1: { id: 1, type: "movie" } },
        watchedTv: {},
      }),
    ).toEqual(["watchedTv"]);
  });

  test("bare ve tv_ çift belge (eski göç) sapma üretmez", () => {
    expect(
      findDriftedLists(index, {
        watchedTv: { 1399: { id: 1399 }, tv_1399: { id: 1399, type: "tv" } },
      }),
    ).toEqual([]);
  });

  test("statusIndex yoksa / bozuksa boş döner", () => {
    expect(findDriftedLists(null, consistent)).toEqual([]);
    expect(findDriftedLists(undefined, consistent)).toEqual([]);
    expect(findDriftedLists({ movie: [], tv: null }, consistent)).toEqual([]);
  });
});
