// __tests__/discoverFiltersScreen.test.js
//
// "Ne izlesem?" ekranı (screens/shared/DiscoverFiltersScreen.js): açılış süzgeci önceliği, çip kaldırma,
// Film↔Dizi geçişi, filtre sayfası, kaydetme, "Şaşırt beni" (+ ana ekrandan otomatik), boş/hata durumları.
// Ağ akışı (useFilteredDiscover) ve ızgara (SeeAllGrid) taklit; depo GERÇEK.

import React from "react";
import { act, create } from "react-test-renderer";

let mockLang = "tr";
let mockProviders = [];
let mockFeed;
const mockToast = { success: jest.fn(), info: jest.fn(), error: jest.fn() };
const mockTrack = jest.fn();

jest.mock("react-native", () => ({
  StyleSheet: { create: (styles) => styles },
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Text: "Text",
  View: "View",
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("../components/AppToast", () => ({ toast: mockToast }));
jest.mock("../services/analytics", () => ({
  ANALYTICS_EVENTS: { DISCOVER_FILTER_APPLIED: "discover_filter_applied", DISCOVER_SURPRISE: "discover_surprise" },
  trackEvent: (...args) => mockTrack(...args),
}));
jest.mock("../context/AppSettingsContext", () => ({
  useStreamingProviderSettings: () => ({ streamingProviderIds: mockProviders }),
}));
jest.mock("../context/LanguageContext", () => ({
  useLanguage: () => ({ language: mockLang, t: { tvShows: "Diziler", movies: "Filmler" } }),
}));
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: {
      accent: "#3388ff",
      primary: "#111111",
      secondary: "#222222",
      border: "#333333",
      text: { primary: "#ffffff", secondary: "#cccccc", muted: "#999999" },
    },
  }),
}));
jest.mock("../hooks/useFilteredDiscover", () => ({
  __esModule: true,
  default: jest.fn((args) => {
    mockFeed.args = args;
    return mockFeed;
  }),
}));
jest.mock("../components/home/MediaTypeSwitch", () => ({ __esModule: true, default: "MediaSwitch" }));
jest.mock("../components/home/DiscoverFilterSheet", () => ({ __esModule: true, default: "FilterSheet" }));
jest.mock("../screens/shared/SeeAllScreen", () => ({
  __esModule: true,
  SeeAllGrid: ({ headerExtra, emptyComponent }) => (
    <>
      {headerExtra}
      {emptyComponent}
    </>
  ),
}));

const { __resetAllMMKV } = require("react-native-mmkv");
const { Keys, get } = require("../services/storage");
const { __resetStoreCaches } = require("../services/storage/store");
const { __resetStores } = require("../services/storage/instances");
const { saveDiscoverPreset, writeLastDiscoverFilters } = require("../hooks/useDiscoverFilterStore");
const DiscoverFiltersScreen = require("../screens/shared/DiscoverFiltersScreen").default;
const { DISCOVER_FILTERS_COPY } = require("../screens/shared/discoverFiltersCopy");
const { DEFAULT_FILTERS, QUICK_PRESETS, normalizeFilters, resolveQuickPreset } = require("../utils/discoverFilters");

global.IS_REACT_ACT_ENVIRONMENT = true;

const makeFeed = (over = {}) => ({
  items: [{ id: 1, poster_path: "/a" }],
  status: "ready",
  loading: false,
  loadingMore: false,
  hasMore: false,
  loadMore: jest.fn(),
  reload: jest.fn(),
  surprise: jest.fn().mockResolvedValue({ id: 99, poster_path: "/s" }),
  ...over,
});

let renderer;
let warn;
let navigation;
beforeEach(() => {
  mockLang = "tr";
  mockProviders = [];
  mockFeed = makeFeed();
  Object.values(mockToast).forEach((fn) => fn.mockClear());
  mockTrack.mockClear();
  navigation = { push: jest.fn(), navigate: jest.fn() };
  __resetStores();
  __resetAllMMKV();
  __resetStoreCaches();
  const original = console.error;
  warn = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
});
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = null;
  warn.mockRestore();
});

const render = (params) => act(() => { renderer = create(<DiscoverFiltersScreen route={{ params }} navigation={navigation} />); });
const find = (testID) => renderer.root.findAllByProps({ testID })[0];
const maybe = (testID) => renderer.root.findAllByProps({ testID }).length > 0;
// Geri çağrı DEĞER DÖNMEMELİ: onSurprise async'tir; act'e söz dönerse eşzamansız act sayılır ve
// beklenmediği için render ağacı bozulur ("You called act(async …) without await").
const press = (testID) => act(() => { find(testID).props.onPress(); });
const feedFilters = () => mockFeed.args.filters;
const sheet = () => renderer.root.findByType("FilterSheet");
const texts = () => renderer.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));
const flush = () => act(async () => { await new Promise((resolve) => setImmediate(resolve)); });

describe("açılış süzgeci", () => {
  test("parametresiz: son kullanılan süzgeç (medya türüne göre)", () => {
    writeLastDiscoverFilters("movie", { genres: [35], minRating: 7 });
    render({ mediaType: "movie" });
    expect(mockFeed.args.mediaType).toBe("movie");
    expect(feedFilters()).toMatchObject({ genres: [35], minRating: 7 });
  });

  test("hiçbir şey yoksa varsayılan; mediaType yoksa Dizi (ana ekranın varsayılanı)", () => {
    render(undefined);
    expect(mockFeed.args.mediaType).toBe("tv");
    expect(feedFilters()).toEqual(DEFAULT_FILTERS);
  });

  test("hazır süzgeç, son kullanılanı EZER", () => {
    writeLastDiscoverFilters("movie", { genres: [35] });
    render({ mediaType: "movie", presetId: "classics" });
    expect(feedFilters()).toEqual(resolveQuickPreset("classics", "movie"));
  });

  test("'Bu akşam' hazırı platformu varsa platform süzgecini açar, yoksa açmaz", () => {
    mockProviders = [8];
    render({ mediaType: "movie", presetId: "tonight" });
    expect(feedFilters().onMyPlatforms).toBe(true);
    act(() => renderer.unmount());
    mockProviders = [];
    render({ mediaType: "movie", presetId: "tonight" });
    expect(feedFilters().onMyPlatforms).toBe(false);
  });

  test("kayıtlı süzgeç kimliğiyle açılır", () => {
    const { id } = saveDiscoverPreset({ name: "K", mediaType: "movie", filters: { genres: [27], minRating: 8 } }, 1000);
    render({ mediaType: "movie", savedId: id });
    expect(feedFilters()).toMatchObject({ genres: [27], minRating: 8 });
  });

  test("açılan süzgeç 'son kullanılan' olarak saklanır", () => {
    render({ mediaType: "tv", presetId: "fresh" });
    const stored = get(Keys.discoverFilters);
    expect(stored.tv).toMatchObject({ era: "last1", minRating: 7 });
  });
});

describe("çip satırı", () => {
  test("varsayılanda yalnız 'Filtreler' ve 'Şaşırt beni'; kaydet ve çipler yok", () => {
    render({ mediaType: "movie" });
    expect(texts()).toContain(DISCOVER_FILTERS_COPY.tr.ui.filters);
    expect(texts()).toContain(DISCOVER_FILTERS_COPY.tr.ui.surprise);
    expect(maybe("discover-save")).toBe(false);
    expect(renderer.root.findAll((n) => String(n.props.testID || "").startsWith("discover-chip-"))).toHaveLength(0);
  });

  test("etkin süzgeçler çip olur, düğme etiketi sayıyı yazar, kaydet görünür", () => {
    render({ mediaType: "movie", filters: { genres: [35, 18], minRating: 7 } });
    expect(maybe("discover-chip-genres-35")).toBe(true);
    expect(maybe("discover-chip-genres-18")).toBe(true);
    expect(maybe("discover-chip-minRating")).toBe(true);
    expect(texts()).toContain("Filtreler · 2");
    expect(maybe("discover-save")).toBe(true);
  });

  test("çipe basmak YALNIZ o süzgeci kaldırır (tür tek tek, diğerleri varsayılana)", () => {
    render({ mediaType: "movie", filters: { genres: [35, 18], minRating: 7, era: "d2010" } });
    press("discover-chip-genres-35");
    expect(feedFilters()).toMatchObject({ genres: [18], minRating: 7, era: "d2010" });
    press("discover-chip-minRating");
    expect(feedFilters()).toMatchObject({ genres: [18], minRating: 0, era: "d2010" });
    press("discover-chip-era");
    press("discover-chip-genres-18");
    expect(feedFilters()).toEqual(normalizeFilters(DEFAULT_FILTERS, "movie"));
  });

  test("çip kaldırma etiketi çipin adını söyler", () => {
    render({ mediaType: "movie", filters: { genres: [35] } });
    expect(find("discover-chip-genres-35").findByType("Pressable").props.accessibilityLabel).toBe(
      DISCOVER_FILTERS_COPY.tr.ui.removeFilter.replace("{name}", DISCOVER_FILTERS_COPY.tr.genres[35]),
    );
  });

  test("varsayılandan farklı sıralama ayrı çip; basınca popülere döner", () => {
    render({ mediaType: "movie", filters: { sort: "rating" } });
    expect(maybe("discover-chip-sort")).toBe(true);
    press("discover-chip-sort");
    expect(feedFilters().sort).toBe("popular");
    expect(maybe("discover-chip-sort")).toBe(false);
  });

  test("platformlarım açık ama platform yok: uyarı satırı çıkar", () => {
    render({ mediaType: "movie", filters: { onMyPlatforms: true } });
    expect(maybe("discover-platforms-missing")).toBe(true);
    act(() => renderer.unmount());
    mockProviders = [8];
    render({ mediaType: "movie", filters: { onMyPlatforms: true } });
    expect(maybe("discover-platforms-missing")).toBe(false);
  });
});

describe("Film ↔ Dizi geçişi", () => {
  test("süzgeç eşlenerek taşınır; akış yeni medya türüyle çalışır", () => {
    render({ mediaType: "movie", filters: { genres: [35, 28, 27], minRating: 7, runtime: "short" } });
    act(() => renderer.root.findByType("MediaSwitch").props.onChange("tv"));
    expect(mockFeed.args.mediaType).toBe("tv");
    const f = feedFilters();
    expect(f.genres.sort((a, b) => a - b)).toEqual([35, 10759]); // korku Dizi'de yok, aksiyon eşlendi
    expect(f).toMatchObject({ minRating: 7, runtime: "short" });
  });

  test("aynı türe geçiş hiçbir şey yapmaz", () => {
    render({ mediaType: "movie", filters: { genres: [35] } });
    const before = feedFilters();
    act(() => renderer.root.findByType("MediaSwitch").props.onChange("movie"));
    expect(feedFilters()).toBe(before);
  });

  test("anahtar etiketleri çevrilmiş metinlerden gelir", () => {
    render({ mediaType: "movie" });
    expect(renderer.root.findByType("MediaSwitch").props.labels).toEqual({ tv: "Diziler", movie: "Filmler" });
  });
});

describe("filtre sayfası ve kaydetme", () => {
  test("'Filtreler' sayfayı açar; uygula süzgeci değiştirir ve sayfayı kapatır", () => {
    render({ mediaType: "movie" });
    expect(sheet().props.visible).toBe(false);
    press("discover-open-filters");
    expect(sheet().props.visible).toBe(true);
    act(() => sheet().props.onApply(normalizeFilters({ genres: [35], minRating: 8 }, "movie")));
    expect(sheet().props.visible).toBe(false);
    expect(feedFilters()).toMatchObject({ genres: [35], minRating: 8 });
  });

  test("sayfaya yalnız ŞU medya türünün kayıtlıları ve platform durumu iletilir", () => {
    saveDiscoverPreset({ name: "F", mediaType: "movie", filters: { minRating: 7 } }, 1000);
    saveDiscoverPreset({ name: "D", mediaType: "tv", filters: { minRating: 8 } }, 2000);
    mockProviders = [8];
    render({ mediaType: "movie" });
    expect(sheet().props.presets.map((p) => p.name)).toEqual(["F"]);
    expect(sheet().props.hasProviders).toBe(true);
    expect(sheet().props.mediaType).toBe("movie");
  });

  test("kaydet çipi: süzgeçten otomatik ad üretir, depoya yazar, toast gösterir", () => {
    render({ mediaType: "movie", filters: { genres: [35], minRating: 7 } });
    press("discover-save");
    const stored = get(Keys.discoverPresets);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ mediaType: "movie", name: "Komedi · ★ 7+" });
    expect(mockToast.success).toHaveBeenCalledWith(DISCOVER_FILTERS_COPY.tr.ui.saved);
  });

  test("aynı süzgeci iki kez kaydetmek kopya üretmez", () => {
    render({ mediaType: "movie", filters: { genres: [35] } });
    press("discover-save");
    press("discover-save");
    expect(get(Keys.discoverPresets)).toHaveLength(1);
  });

  test("kayıtlı süzgeç silinince bilgi toast'ı", () => {
    const { id } = saveDiscoverPreset({ name: "F", mediaType: "movie", filters: { minRating: 7 } }, 1000);
    render({ mediaType: "movie" });
    act(() => sheet().props.onDeletePreset(id));
    expect(get(Keys.discoverPresets)).toBeNull();
    expect(mockToast.info).toHaveBeenCalledWith(DISCOVER_FILTERS_COPY.tr.ui.savedRemoved);
  });
});

describe("Şaşırt beni", () => {
  test("öneri bulunca ilgili detay ekranını açar (Film → MovieDetails, Dizi → TvShowsDetails)", async () => {
    render({ mediaType: "movie" });
    press("discover-surprise");
    await flush();
    expect(navigation.push).toHaveBeenCalledWith("MovieDetails", { id: 99 });
    act(() => renderer.unmount());
    navigation.push.mockClear();
    render({ mediaType: "tv" });
    press("discover-surprise");
    await flush();
    expect(navigation.push).toHaveBeenCalledWith("TvShowsDetails", { id: 99 });
  });

  test("öneri yoksa bilgi, ağ hatasında hata toast'ı; ikisinde de gezinme yok", async () => {
    render({ mediaType: "movie" });
    mockFeed.surprise.mockResolvedValueOnce(null);
    press("discover-surprise");
    await flush();
    expect(mockToast.info).toHaveBeenCalledWith(DISCOVER_FILTERS_COPY.tr.ui.surpriseNone);
    mockFeed.surprise.mockRejectedValueOnce(new Error("ağ yok"));
    press("discover-surprise");
    await flush();
    expect(mockToast.error).toHaveBeenCalledWith(DISCOVER_FILTERS_COPY.tr.ui.surpriseFailed);
    expect(navigation.push).not.toHaveBeenCalled();
  });

  test("istek sürerken ikinci dokunuş yok sayılır; bitince çip yeniden etkin", async () => {
    let resolve;
    render({ mediaType: "movie" });
    mockFeed.surprise.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    press("discover-surprise");
    press("discover-surprise");
    expect(mockFeed.surprise).toHaveBeenCalledTimes(1);
    expect(texts()).toContain(DISCOVER_FILTERS_COPY.tr.ui.surpriseBusy);
    await act(async () => { resolve({ id: 5 }); await Promise.resolve(); });
    await flush();
    expect(texts()).toContain(DISCOVER_FILTERS_COPY.tr.ui.surprise);
    expect(navigation.push).toHaveBeenCalledTimes(1);
  });
});

describe("boş ve hata durumları", () => {
  test("yüklenirken özel bir durum kartı YOK (ızgara kendi göstergesini çizer)", () => {
    mockFeed = makeFeed({ status: "loading", loading: true, items: [] });
    render({ mediaType: "movie" });
    expect(maybe("discover-empty")).toBe(false);
    expect(maybe("discover-error")).toBe(false);
  });

  test("hata: yeniden dene akışı yeniden yükler", () => {
    mockFeed = makeFeed({ status: "error", items: [] });
    render({ mediaType: "movie" });
    expect(maybe("discover-error")).toBe(true);
    press("discover-error-action");
    expect(mockFeed.reload).toHaveBeenCalledTimes(1);
  });

  test("sonuç yok: kart çıkar, eylem süzgeçleri sıfırlar", () => {
    mockFeed = makeFeed({ items: [] });
    render({ mediaType: "movie", filters: { genres: [35], minRating: 8 } });
    expect(maybe("discover-empty")).toBe(true);
    press("discover-empty-action");
    expect(feedFilters()).toEqual(DEFAULT_FILTERS);
  });

  test("otomatik doldurma sürerken (loadingMore) boş kart ÇIKMAZ", () => {
    mockFeed = makeFeed({ items: [], loadingMore: true, hasMore: true });
    render({ mediaType: "movie" });
    expect(maybe("discover-empty")).toBe(false);
  });

  test("sonuç varsa ne boş ne hata kartı", () => {
    render({ mediaType: "movie" });
    expect(maybe("discover-empty")).toBe(false);
    expect(maybe("discover-error")).toBe(false);
  });

  test.each(["tr", "en", "es"])("%s: durum kartı kendi dilinde", (dil) => {
    mockLang = dil;
    mockFeed = makeFeed({ items: [] });
    render({ mediaType: "movie" });
    expect(texts()).toContain(DISCOVER_FILTERS_COPY[dil].ui.emptyTitle);
    expect(texts()).toContain(DISCOVER_FILTERS_COPY[dil].ui.emptyAction);
  });
});

describe("ölçüm", () => {
  const applied = () => mockTrack.mock.calls.filter(([name]) => name === "discover_filter_applied").map(([, p]) => p);
  const surprises = () => mockTrack.mock.calls.filter(([name]) => name === "discover_surprise").map(([, p]) => p);

  test("parametresiz açılışta olay YOK (yalnız bakmak 'uygulama' sayılmaz)", () => {
    render({ mediaType: "movie" });
    expect(mockTrack).not.toHaveBeenCalled();
  });

  test("hazır çipten gelince bir kez: kaynak, hazır kimliği ve süzgeç sayısı", () => {
    render({ mediaType: "movie", presetId: "fresh" });
    expect(applied()).toEqual([
      expect.objectContaining({ source: "preset", preset: "fresh", media_type: "movie", filter_count: 2, sort: "popular" }),
    ]);
  });

  test("kayıtlı süzgeçten gelince kaynak 'saved'", () => {
    const { id } = saveDiscoverPreset({ name: "K", mediaType: "movie", filters: { genres: [27], minRating: 8 } }, 1000);
    render({ mediaType: "movie", savedId: id });
    expect(applied()).toEqual([expect.objectContaining({ source: "saved", media_type: "movie", filter_count: 2, genre_count: 1 })]);
  });

  test("filtre sayfasından uygulayınca kaynak 'manual'", () => {
    render({ mediaType: "tv" });
    act(() => sheet().props.onApply(normalizeFilters({ genres: [35], hideWatched: true, onMyPlatforms: true }, "tv")));
    expect(applied()).toEqual([
      expect.objectContaining({ source: "manual", media_type: "tv", filter_count: 3, platform: true, hide_watched: true }),
    ]);
  });

  test("olay parametreleri kullanıcı metni içermez (ad/arama yok)", () => {
    const { id } = saveDiscoverPreset({ name: "Gizli kişisel ad", mediaType: "movie", filters: { minRating: 7 } }, 1000);
    render({ mediaType: "movie", savedId: id });
    expect(JSON.stringify(mockTrack.mock.calls)).not.toContain("Gizli kişisel ad");
  });

  test("Şaşırt beni sonuçları: opened / none / error", async () => {
    render({ mediaType: "movie" });
    press("discover-surprise");
    await flush();
    mockFeed.surprise.mockResolvedValueOnce(null);
    press("discover-surprise");
    await flush();
    mockFeed.surprise.mockRejectedValueOnce(new Error("ağ yok"));
    press("discover-surprise");
    await flush();
    expect(surprises().map((p) => p.outcome)).toEqual(["opened", "none", "error"]);
    expect(surprises()[0]).toMatchObject({ media_type: "movie", filter_count: 0 });
    // 'auto' parametresi (ana ekran kartından gelme) kalktı: kart yok.
    expect(surprises().every((p) => !("auto" in p))).toBe(true);
  });
});

describe("süzgeç yokken hazır ve kayıtlı çipler", () => {
  const quickIds = () => renderer.root.findAll((n) => String(n.props.testID || "").startsWith("discover-quick-") && n.type !== "Pressable");
  const applied = () => mockTrack.mock.calls.filter(([name]) => name === "discover_filter_applied").map(([, p]) => p);

  test("varsayılan süzgeçte tüm hazır süzgeçler çip olarak sunulur (kartın yerini alır)", () => {
    render({ mediaType: "movie" });
    QUICK_PRESETS.forEach((preset) => {
      expect(maybe(`discover-quick-${preset.id}`)).toBe(true);
      expect(texts()).toContain(DISCOVER_FILTERS_COPY.tr.presets[preset.id][0]);
    });
    expect(quickIds().length).toBeGreaterThan(0);
  });

  test("çipe basmak hazır süzgeci TEK dokunuşla uygular; çipler kalkar, etkin süzgeç çipleri gelir", () => {
    render({ mediaType: "movie" });
    press("discover-quick-classics");
    expect(feedFilters()).toEqual(resolveQuickPreset("classics", "movie"));
    expect(maybe("discover-quick-classics")).toBe(false);
    expect(maybe("discover-chip-era")).toBe(true);
    expect(maybe("discover-chip-minRating")).toBe(true);
  });

  test("ölçüm: kaynak 'preset' + hazır kimliği, süzgeç sayısı", () => {
    render({ mediaType: "movie" });
    press("discover-quick-fresh");
    expect(applied()).toEqual([expect.objectContaining({ source: "preset", preset: "fresh", media_type: "movie", filter_count: 2 })]);
  });

  test("'Bu akşam' platformu varsa platform süzgecini açar, yoksa açmaz", () => {
    mockProviders = [8];
    render({ mediaType: "movie" });
    press("discover-quick-tonight");
    expect(feedFilters().onMyPlatforms).toBe(true);
    act(() => renderer.unmount());
    // Ekran uygulanan süzgeci "son kullanılan" olarak sakladı: ikinci açılış temiz başlasın.
    writeLastDiscoverFilters("movie", DEFAULT_FILTERS);
    mockProviders = [];
    render({ mediaType: "movie" });
    press("discover-quick-tonight");
    expect(feedFilters().onMyPlatforms).toBe(false);
  });

  test("süzgeç kaldırılınca (hepsi sıfırlanınca) çipler geri gelir", () => {
    render({ mediaType: "movie" });
    press("discover-quick-classics");
    expect(maybe("discover-quick-classics")).toBe(false);
    press("discover-chip-era");
    press("discover-chip-minRating");
    press("discover-chip-sort");
    expect(maybe("discover-quick-classics")).toBe(true);
  });

  test("süzgeçle açılışta (rota süzgeci / son kullanılan) hazır çipler YOK, etkin çipler var", () => {
    render({ mediaType: "movie", filters: { genres: [35] } });
    expect(maybe("discover-quick-tonight")).toBe(false);
    expect(maybe("discover-chip-genres-35")).toBe(true);
  });

  test("yalnız sıralama değişse de süzgeç 'var' sayılır (hazır çipler gizlenir)", () => {
    render({ mediaType: "movie", filters: { sort: "rating" } });
    expect(maybe("discover-quick-tonight")).toBe(false);
    expect(maybe("discover-chip-sort")).toBe(true);
  });

  test("kayıtlı süzgeçler yalnız AYNI medya türünde çip olur ve basınca uygular", () => {
    saveDiscoverPreset({ name: "Film kaydı", mediaType: "movie", filters: { genres: [27], minRating: 8 } }, 1000);
    saveDiscoverPreset({ name: "Dizi kaydı", mediaType: "tv", filters: { minRating: 7 } }, 2000);
    render({ mediaType: "movie" });
    expect(texts()).toContain("Film kaydı");
    expect(texts()).not.toContain("Dizi kaydı");
    const saved = renderer.root.findAll((n) => String(n.props.testID || "").startsWith("discover-saved-") && typeof n.props.onPress === "function");
    act(() => { saved[0].props.onPress(); });
    expect(feedFilters()).toMatchObject({ genres: [27], minRating: 8 });
    expect(applied()).toEqual([expect.objectContaining({ source: "saved", media_type: "movie" })]);
  });

  test("Film↔Dizi geçişinde çipler yeni türün kayıtlılarıyla yenilenir", () => {
    saveDiscoverPreset({ name: "Film kaydı", mediaType: "movie", filters: { minRating: 8 } }, 1000);
    saveDiscoverPreset({ name: "Dizi kaydı", mediaType: "tv", filters: { minRating: 7 } }, 2000);
    render({ mediaType: "movie" });
    act(() => renderer.root.findByType("MediaSwitch").props.onChange("tv"));
    expect(texts()).toContain("Dizi kaydı");
    expect(texts()).not.toContain("Film kaydı");
    expect(maybe("discover-quick-tonight")).toBe(true);
  });

  test("hazır çiplerin erişilebilirlik etiketi ad + açıklama", () => {
    render({ mediaType: "movie" });
    const host = find("discover-quick-tonight").findByType("Pressable");
    expect(host.props.accessibilityLabel).toBe(
      `${DISCOVER_FILTERS_COPY.tr.presets.tonight[0]}. ${DISCOVER_FILTERS_COPY.tr.presets.tonight[1]}`,
    );
  });
});

describe("çip satırı kaydırması", () => {
  test("hazır çiplerden etkin çiplere geçince (ve geri) satır BAŞA kaydırılır", () => {
    const scrollTo = jest.fn();
    act(() => {
      renderer = create(<DiscoverFiltersScreen route={{ params: { mediaType: "movie" } }} navigation={navigation} />, {
        createNodeMock: () => ({ scrollTo }),
      });
    });
    const initialCalls = scrollTo.mock.calls.length;
    press("discover-quick-classics"); // süzgeç yok → var
    expect(scrollTo.mock.calls.length).toBe(initialCalls + 1);
    expect(scrollTo).toHaveBeenLastCalledWith({ x: 0, animated: false });
    press("discover-chip-era");
    press("discover-chip-minRating");
    press("discover-chip-sort"); // süzgeç var → yok
    expect(scrollTo).toHaveBeenLastCalledWith({ x: 0, animated: false });
    expect(maybe("discover-quick-classics")).toBe(true);
  });

  test("aynı durumda kalan değişiklikte (bir süzgeçten diğerine) satır yerinde kalır", () => {
    const scrollTo = jest.fn();
    act(() => {
      renderer = create(<DiscoverFiltersScreen route={{ params: { mediaType: "movie", filters: { genres: [35, 18] } } }} navigation={navigation} />, {
        createNodeMock: () => ({ scrollTo }),
      });
    });
    const calls = scrollTo.mock.calls.length;
    press("discover-chip-genres-35"); // hâlâ süzgeç var (Dram)
    expect(scrollTo.mock.calls.length).toBe(calls);
  });
});
