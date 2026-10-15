// CineSwipe saf deste modeli: istek kurulumu, normalizasyon, birleştirme, oda kodu.
// RN / Firebase / axios içermeyen modül olduğu için doğrudan jest ile sınanır.

const {
  SWIPE_CATEGORIES,
  GENRE_OPTIONS,
  cineMediaKey,
  categoryOf,
  genreSupports,
  normalizeFilters,
  sameFilters,
  tmdbLanguage,
  buildDeckRequests,
  normalizeDeckItem,
  normalizeWatchlistItem,
  mergeUniqueCards,
  interleaveCards,
  shuffleCards,
  cardGenreNames,
  posterUrl,
  fillText,
  sanitizeRoomCode,
  extractRoomCode,
  formatListDate,
  basketListName,
  toListItem,
} = require("../services/cineswipe/deckModel");

const NOW = new Date("2026-10-03T10:00:00Z");
const build = (overrides) => buildDeckRequests({ now: NOW, language: "en-US", ...overrides });

describe("filtre tutarlılığı", () => {
  test("tek türlü kaynak içerik türünü zorlar", () => {
    expect(normalizeFilters({ category: "popular_tv", mediaType: "movie" }).mediaType).toBe("tv");
    expect(normalizeFilters({ category: "now_playing", mediaType: "tv" }).mediaType).toBe("movie");
  });

  test("izleme listesinde tür filtresi temizlenir", () => {
    expect(normalizeFilters({ category: "watchlist", mediaType: "all", genreId: 28 })).toEqual({
      category: "watchlist",
      mediaType: "all",
      genreId: null,
    });
  });

  test("dizide karşılığı olmayan tür (Korku, Romantik) dizi modunda temizlenir", () => {
    expect(normalizeFilters({ category: "trending", mediaType: "tv", genreId: 27 }).genreId).toBeNull();
    expect(normalizeFilters({ category: "trending", mediaType: "tv", genreId: 10749 }).genreId).toBeNull();
    expect(normalizeFilters({ category: "trending", mediaType: "movie", genreId: 27 }).genreId).toBe(27);
  });

  test("geçersiz değerler güvenli varsayılana düşer", () => {
    expect(normalizeFilters({ category: "yok", mediaType: "kitap", genreId: 999999 })).toEqual({
      category: "trending",
      mediaType: "movie",
      genreId: null,
    });
    expect(normalizeFilters()).toEqual({ category: "trending", mediaType: "movie", genreId: null });
  });

  test("genreSupports ve sameFilters", () => {
    expect(genreSupports(null, "tv")).toBe(true);
    expect(genreSupports(28, "tv")).toBe(true);
    expect(genreSupports(27, "tv")).toBe(false);
    expect(genreSupports(27, "all")).toBe(true);
    expect(sameFilters({ category: "a", mediaType: "movie", genreId: null }, { category: "a", mediaType: "movie" })).toBe(true);
    expect(sameFilters({ category: "a", mediaType: "movie" }, { category: "b", mediaType: "movie" })).toBe(false);
    expect(sameFilters(null, null)).toBe(false);
  });

  test("tanımlar tutarlı: benzersiz kimlik, her kaynak çözülür", () => {
    const ids = SWIPE_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(categoryOf(id).id).toBe(id));
    expect(categoryOf("bilinmeyen").id).toBe("trending");
    const genreIds = GENRE_OPTIONS.map((g) => g.id);
    expect(new Set(genreIds).size).toBe(genreIds.length);
  });
});

describe("dil", () => {
  test("uygulama dili TMDB diline çevrilir", () => {
    expect(tmdbLanguage("tr")).toBe("tr-TR");
    expect(tmdbLanguage("en")).toBe("en-US");
    expect(tmdbLanguage("tr-TR")).toBe("tr-TR");
    expect(tmdbLanguage(undefined)).toBe("en-US");
    expect(tmdbLanguage("de")).toBe("en-US");
  });
});

describe("TMDB isteği kurulumu", () => {
  test("filtresiz kaynaklar hazır uçlara gider", () => {
    expect(build({ category: "trending", mediaType: "all" })).toEqual([
      { endpoint: "/trending/all/week", params: { language: "en-US", page: 1 }, mediaType: null },
    ]);
    expect(build({ category: "trending", mediaType: "movie" })[0].endpoint).toBe("/trending/movie/week");
    expect(build({ category: "trending", mediaType: "tv" })[0].endpoint).toBe("/trending/tv/week");
    expect(build({ category: "now_playing" })[0].endpoint).toBe("/movie/now_playing");
    expect(build({ category: "upcoming" })[0].endpoint).toBe("/movie/upcoming");
    expect(build({ category: "top_rated_movie" })[0].endpoint).toBe("/movie/top_rated");
    expect(build({ category: "popular_tv" })[0].endpoint).toBe("/tv/popular");
    expect(build({ category: "top_rated_tv" })[0].endpoint).toBe("/tv/top_rated");
  });

  test("sayfa ve dil parametreye yazılır; include_adult YAZILMAZ (merkezî guard ekler)", () => {
    const [request] = build({ category: "trending", mediaType: "movie", page: 3, language: "tr-TR" });
    expect(request.params).toEqual({ language: "tr-TR", page: 3 });
    build({ category: "trending", mediaType: "movie", genreId: 28 }).forEach((r) => {
      expect(r.params).not.toHaveProperty("include_adult");
    });
  });

  test("tür seçiliyken hazır uçlar yerine anlamdaş /discover sorgusu kurulur", () => {
    const [nowPlaying] = build({ category: "now_playing", genreId: 28 });
    expect(nowPlaying.endpoint).toBe("/discover/movie");
    expect(nowPlaying.params.with_genres).toBe(28);
    expect(nowPlaying.params["primary_release_date.gte"]).toBe("2026-08-19");
    expect(nowPlaying.params["primary_release_date.lte"]).toBe("2026-10-03");

    const [upcoming] = build({ category: "upcoming", genreId: 35 });
    expect(upcoming.params["primary_release_date.gte"]).toBe("2026-10-04");
    expect(upcoming.params.with_genres).toBe(35);

    const [topMovie] = build({ category: "top_rated_movie", genreId: 18 });
    expect(topMovie.params).toMatchObject({ sort_by: "vote_average.desc", "vote_count.gte": 500, with_genres: 18 });

    const [popularTv] = build({ category: "popular_tv", genreId: 28 });
    expect(popularTv.endpoint).toBe("/discover/tv");
    expect(popularTv.params).toMatchObject({ sort_by: "popularity.desc", with_genres: 10759 });

    const [topTv] = build({ category: "top_rated_tv", genreId: 878 });
    expect(topTv.params).toMatchObject({ sort_by: "vote_average.desc", with_genres: 10765 });
  });

  test("dizi modunda film tür kimliği dizi karşılığına çevrilir", () => {
    const [tv] = build({ category: "trending", mediaType: "tv", genreId: 28 });
    expect(tv.endpoint).toBe("/discover/tv");
    expect(tv.params.with_genres).toBe(10759);
    expect(tv.mediaType).toBe("tv");
  });

  test("karışık + tür: film ve dizi AYRI isteklerle gelir", () => {
    const requests = build({ category: "trending", mediaType: "all", genreId: 28 });
    expect(requests.map((r) => r.endpoint)).toEqual(["/discover/movie", "/discover/tv"]);
    expect(requests.map((r) => r.params.with_genres)).toEqual([28, 10759]);
  });

  test("karışık + dizide karşılığı olmayan tür: yalnız film isteği", () => {
    const requests = build({ category: "trending", mediaType: "all", genreId: 27 });
    expect(requests.map((r) => r.endpoint)).toEqual(["/discover/movie"]);
  });

  test("izleme listesi TMDB isteği üretmez", () => {
    expect(build({ category: "watchlist" })).toEqual([]);
  });
});

describe("kart normalizasyonu", () => {
  const raw = {
    id: 1,
    title: "Inception",
    poster_path: "/p.jpg",
    vote_average: 8.4,
    release_date: "2010-07-16",
    genre_ids: [28, 878, 12, 99],
  };

  test("film kaydı kart biçimine çevrilir; tür kimlikleri en fazla 3", () => {
    expect(normalizeDeckItem(raw)).toMatchObject({
      id: 1,
      title: "Inception",
      mediaType: "movie",
      poster_path: "/p.jpg",
      release_date: "2010-07-16",
      genre_ids: [28, 878, 12],
    });
  });

  test("tür çözümü: media_type > uç türü > başlık/ad ayrımı", () => {
    expect(normalizeDeckItem({ ...raw, media_type: "tv" }, "movie").mediaType).toBe("tv");
    expect(normalizeDeckItem({ id: 2, name: "Dizi", poster_path: "/x" }, "tv").mediaType).toBe("tv");
    expect(normalizeDeckItem({ id: 3, name: "Dizi", poster_path: "/x" }).mediaType).toBe("tv");
    expect(normalizeDeckItem({ ...raw }, null).mediaType).toBe("movie");
  });

  test("dizinin first_air_date alanı yıl için kullanılır", () => {
    expect(normalizeDeckItem({ id: 4, name: "D", poster_path: "/x", first_air_date: "2020-01-01" }).release_date).toBe("2020-01-01");
  });

  test("afişsiz, başlıksız, kimliksiz ve kişi kayıtları elenir", () => {
    expect(normalizeDeckItem({ ...raw, poster_path: null })).toBeNull();
    expect(normalizeDeckItem({ id: 5, poster_path: "/x" })).toBeNull();
    expect(normalizeDeckItem({ title: "x", poster_path: "/x" })).toBeNull();
    expect(normalizeDeckItem({ id: 6, name: "Biri", media_type: "person", profile_path: "/p" })).toBeNull();
    expect(normalizeDeckItem(null)).toBeNull();
  });

  test("izleme listesi belgesi: kimlik belge adından da çözülür", () => {
    expect(normalizeWatchlistItem({ name: "X", imagePath: "/i", type: "tv", id: 7 }, "tv_7")).toMatchObject({
      id: 7,
      mediaType: "tv",
      poster_path: "/i",
    });
    expect(normalizeWatchlistItem({ name: "Y", imagePath: "/i" }, "movie_550").id).toBe(550);
    expect(normalizeWatchlistItem({ name: "Z" }, "movie_1")).toBeNull();
    expect(normalizeWatchlistItem({ name: "Z", imagePath: "/i" }, "yanlis")).toBeNull();
  });
});

describe("liste yardımcıları", () => {
  const m = (id, mediaType = "movie") => ({ id, mediaType });

  test("cineMediaKey tür ile ayrışır", () => {
    expect(cineMediaKey(m(1))).toBe("movie_1");
    expect(cineMediaKey({ id: 1 })).toBe("movie_1");
    expect(cineMediaKey(m(1, "tv"))).toBe("tv_1");
  });

  test("mergeUniqueCards: mevcut, görülmüş ve tekrarlananları eler; aynı id farklı tür kalır", () => {
    const fresh = mergeUniqueCards([m(1)], [m(1), m(2), m(2), m(3), m(1, "tv")], { movie_3: true });
    expect(fresh.map(cineMediaKey)).toEqual(["movie_2", "tv_1"]);
  });

  test("interleaveCards sırayla karıştırır, uzunluk farkını sona ekler", () => {
    expect(interleaveCards([1, 2, 3], ["a"])).toEqual([1, "a", 2, 3]);
    expect(interleaveCards([], [1])).toEqual([1]);
  });

  test("shuffleCards kaynağı bozmaz ve tüm elemanları korur", () => {
    const source = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffleCards(source, () => 0.5);
    expect(source).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort()).toEqual(source);
    expect(shuffleCards([], Math.random)).toEqual([]);
  });

  test("cardGenreNames bilinmeyenleri atlar ve sınırlar", () => {
    const names = { 28: "Aksiyon", 878: "Bilim Kurgu", 12: "Macera" };
    expect(cardGenreNames({ genre_ids: [28, 99, 878, 12] }, names)).toEqual(["Aksiyon", "Bilim Kurgu"]);
    expect(cardGenreNames({}, names)).toEqual([]);
    expect(cardGenreNames(null, names)).toEqual([]);
  });
});

describe("posterUrl", () => {
  test("TMDB yolunu tam URL yapar, tam URL'e dokunmaz, boşta null döner", () => {
    expect(posterUrl("/p.jpg")).toBe("https://image.tmdb.org/t/p/w780/p.jpg");
    expect(posterUrl("/p.jpg", "w342")).toBe("https://image.tmdb.org/t/p/w342/p.jpg");
    expect(posterUrl("https://cdn.example.com/p.jpg")).toBe("https://cdn.example.com/p.jpg");
    expect(posterUrl("")).toBeNull();
    expect(posterUrl(null)).toBeNull();
    expect(posterUrl(42)).toBeNull();
  });
});

describe("fillText", () => {
  test("değişkenleri doldurur, eksik olanı boş bırakır", () => {
    expect(fillText("{{n}} kart · {{source}}", { n: 3, source: "Trend" })).toBe("3 kart · Trend");
    expect(fillText("{{n}} kart", {})).toBe(" kart");
    expect(fillText("{{n}} {{n}}", { n: 0 })).toBe("0 0");
    expect(fillText(undefined)).toBe("");
    expect(fillText("düz metin")).toBe("düz metin");
  });
});

describe("oda kodu", () => {
  test("sanitizeRoomCode yalnız rakam bırakır ve 6 haneye keser", () => {
    expect(sanitizeRoomCode("749 215")).toBe("749215");
    expect(sanitizeRoomCode("a1b2c3d4e5f6g7")).toBe("123456");
    expect(sanitizeRoomCode(null)).toBe("");
  });

  test("extractRoomCode paylaşım mesajından kodu çıkarır", () => {
    expect(extractRoomCode("Seelogd'da bu akşam ne izleyeceğimizi seçiyoruz! Oda Kodum: 749215")).toBe("749215");
    expect(extractRoomCode("749 215")).toBe("749215");
    expect(extractRoomCode("749215")).toBe("749215");
    expect(extractRoomCode("kod:123456.")).toBe("123456");
  });

  test("extractRoomCode kod olmayanı reddeder", () => {
    expect(extractRoomCode("12345")).toBe("");
    expect(extractRoomCode("1234567")).toBe("");
    expect(extractRoomCode("merhaba")).toBe("");
    expect(extractRoomCode(undefined)).toBe("");
  });
});

describe("sepet → liste", () => {
  test("liste adı gün-ay-yıl, '/' içermez", () => {
    expect(formatListDate(new Date(2026, 9, 3))).toBe("03.10.2026");
    expect(basketListName(new Date(2026, 0, 9))).toBe("CineSwipe (09.01.2026)");
    expect(basketListName()).not.toContain("/");
  });

  test("toListItem kartı liste öğesine çevirir", () => {
    expect(toListItem({ id: 5, mediaType: "tv", title: "Dizi", poster_path: "/p" }, "2026-10-03")).toEqual({
      id: 5,
      type: "tv",
      name: "Dizi",
      imagePath: "/p",
      minutes: null,
      genres: [],
      dateAdded: "2026-10-03",
    });
    expect(toListItem({ id: 6 }, "d").type).toBe("movie");
    expect(toListItem({ id: 6, name: "Ad" }, "d").name).toBe("Ad");
  });
});
