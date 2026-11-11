// Yol haritası 11 Kas (docs/performans/PERFORMANS_YOL_HARITASI_2026-11-11.md)
// maddelerinin davranış ve kaynak bekçileri.
jest.mock("react-native", () => ({ PixelRatio: { get: () => 3 } }));

const fs = require("fs");
const path = require("path");
const read = (rel) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

const { getOptimalTmdbSize } = require("../utils/tmdbImageUtils");
const {
  materializeTvWatchState,
  tvWatchEvents,
  flattenTvEpisodeWatchEntries,
  cachedTvHistoryState,
  cachedTvEpisodeEntries,
  episodeKey,
} = require("../utils/watchHistory");
const detailCache = require("../services/tmdbDetailCache");

describe("Y7 — TMDB görsel boyutu tavanı", () => {
  test("normal kalitede still/backdrop artık original değil", () => {
    expect(getOptimalTmdbSize("still", 300, "good")).toBe("w300");
    expect(getOptimalTmdbSize("backdrop", 1000, "good")).toBe("w1280");
    expect(getOptimalTmdbSize("poster", 200, "good")).toBe("w780");
  });
  test("bilinçli tam boy istekleri korunur", () => {
    expect(getOptimalTmdbSize("backdrop", "original", "good")).toBe("original");
    expect(getOptimalTmdbSize("poster", 200, "original")).toBe("original");
    expect(getOptimalTmdbSize("backdrop", 1000, "high")).toBe("original");
  });
  test("genişlik yoksa en büyük türev", () => {
    expect(getOptimalTmdbSize("poster", undefined, "good")).toBe("w780");
    expect(getOptimalTmdbSize("profile", 0, "good")).toBe("h632");
  });
});

// İki sezonluk, tekrar izlemeli sentetik dizi.
function fixtureShow() {
  const ep = (n, at) => ({ episodeNumber: n, episodeMinutes: 40, watchedAt: at });
  return {
    id: 42,
    name: "Dizi",
    seasons: [
      { seasonNumber: 1, episodes: [ep(1, "2026-01-01"), ep(2, "2026-01-02"), ep(3, "2026-01-03")] },
      { seasonNumber: 2, episodes: [ep(1, "2026-02-01"), ep(2, "2026-02-02")] },
    ],
  };
}

describe("Y5 — bölüm olay indeksi tvWatchEvents ile aynı", () => {
  test("her bölüm ve sezon için aynı olaylar, aynı sıra", () => {
    const show = fixtureShow();
    const state = materializeTvWatchState(show);
    const doc = { ...show, seasons: state.seasons, watchEvents: state.watchEvents };
    const bySeason = new Map();
    const byEpisode = new Map();
    for (const event of state.watchEvents) {
      for (const sn of new Set(event.seasonNumbers || [])) {
        bySeason.set(Number(sn), [...(bySeason.get(Number(sn)) || []), event]);
      }
      for (const key of new Set(event.episodeKeys || [])) {
        byEpisode.set(key, [...(byEpisode.get(key) || []), event]);
      }
    }
    for (const season of state.seasons) {
      expect((bySeason.get(season.seasonNumber) || []).map((e) => e.id)).toEqual(
        tvWatchEvents(doc, { seasonNumber: season.seasonNumber }).map((e) => e.id),
      );
      for (const episode of season.episodes) {
        expect(
          (byEpisode.get(episodeKey(season.seasonNumber, episode.episodeNumber)) || []).map((e) => e.id),
        ).toEqual(
          tvWatchEvents(doc, { seasonNumber: season.seasonNumber, episodeNumber: episode.episodeNumber }).map((e) => e.id),
        );
      }
    }
  });
  test("kanca artık satır başına tvWatchEvents çağırmıyor", () => {
    const src = read("hooks/useWatchedShow.js");
    expect(src).not.toMatch(/tvWatchEvents\(/);
  });
});

describe("Y14 — dizi bazında hazırlama önbelleği", () => {
  test("sonuç tam hesapla aynı; aynı nesne ikinci kez hazırlanmaz", () => {
    const shows = [fixtureShow(), { ...fixtureShow(), id: 7 }];
    const states = shows.map(cachedTvHistoryState);
    expect(states.flatMap(cachedTvEpisodeEntries)).toEqual(flattenTvEpisodeWatchEntries(shows));
    expect(cachedTvHistoryState(shows[0])).toBe(states[0]);
    expect(cachedTvEpisodeEntries(states[0])).toBe(cachedTvEpisodeEntries(states[0]));
  });
});

describe("Y12 — detay önbelleği", () => {
  beforeEach(() => detailCache.clearDetailCache());
  test("TTL içinde döner, sonra düşer", () => {
    const key = detailCache.detailCacheKey("movie", 1, "tr");
    detailCache.writeDetail(key, { id: 1 }, 1000);
    expect(detailCache.readDetail(key, 2000)).toEqual({ id: 1 });
    expect(detailCache.readDetail(key, 1000 + 11 * 60 * 1000)).toBeNull();
  });
  test("kapasite sınırlı (LRU)", () => {
    for (let i = 0; i < 40; i += 1) detailCache.writeDetail(`k${i}`, { i }, 1000);
    expect(detailCache.readDetail("k0", 1001)).toBeNull();
    expect(detailCache.readDetail("k39", 1001)).toEqual({ i: 39 });
  });
  test("iptal hatası tanınır", () => {
    expect(detailCache.isAbortError({ code: "ERR_CANCELED" })).toBe(true);
    expect(detailCache.isAbortError(new Error("ağ"))).toBe(false);
  });
});

describe("kaynak bekçileri", () => {
  test("Y1: sekme kabuğu TabActiveContext verir; odak kancası onu okur", () => {
    expect(read("components/navigation/AdaptiveTabShell.js")).toMatch(/TabActiveContext\.Provider value=\{state\.activeTab === tab\.name\}/);
    expect(read("hooks/useScreenFocused.js")).toMatch(/return focused && tabActive;/);
    expect(read("context/PostsContext.js")).toMatch(/acquire && tabActive \? acquire/);
  });
  test("Y3: kenar şeritleri küçük kaynaktan bulanıklaşır", () => {
    const src = read("components/detail/DetailHeroStage.js");
    expect(src).not.toMatch(/source=\{\{ uri \}\}\s*blurRadius/);
  });
  test("Y8: scrollToMessage mesaj dizisine bağlı değil", () => {
    const src = read("screens/chat/ChatScreen.js");
    const start = src.indexOf("const scrollToMessage = useCallback(");
    const body = src.slice(start, src.indexOf("const continueJump", start));
    expect(body).not.toMatch(/\[memoizedMessages\]/);
  });
  test("Y10: gönderi yorumları limitli canlı pencere + imleç", () => {
    const src = read("services/postsService.js");
    expect(src).toMatch(/orderBy\("createdAt", "desc"\),\s*limit\(pageSize\)/);
    expect(src).toMatch(/export async function fetchOlderPostComments/);
  });
  test("Y12: detay isteğinde okunmayan alanlar yok", () => {
    for (const f of ["screens/movie/MovieDetail.js", "screens/tv/TvShowsDetails.js"]) {
      const appends = read(f).match(/append_to_response:\s*"([^"]+)"/)[1].split(",");
      for (const unused of ["account_states", "alternative_titles", "changes", "lists"]) {
        expect(appends).not.toContain(unused);
      }
      expect(appends).toContain("keywords"); // detailAiRequest okur
    }
  });
  test("Y15: sezon bölümleri sanallaştırılmış", () => {
    expect(read("screens/tv/SeasonDetails.js")).toMatch(/<Animated\.FlatList/);
  });
  test("Y18: iskeletler tek paylaşılan döngü", () => {
    expect(read("components/Skeleton.js")).toMatch(/const sharedPulse = new Animated\.Value\(0\);/);
  });
});
