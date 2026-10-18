// __tests__/discoveryRailSettings.test.js
//
// Keşif rayı (components/DiscoveryMediaRail — "Platform Favorileri", "Yeni
// Beğenilenler", "Gizli Cevherler", "Favori Türlerin") ayar değişince:
//   • yetişkin içerik: yeni kovadan yeniden yüklenir, kapatınca kayıtlar kalkar
//   • platform üyeliği: yeni platform kümesiyle yeniden yüklenir
//   • İSTEK SIRASI: art arda değişimde yavaş gelen ESKİ sonuç yenisini ezmez
// Gerçek bileşen çalışır; yalnız ağ, görsel alt bileşenler ve bağlamlar taklit.

import React from "react";
import { act, create } from "react-test-renderer";
import { clearCachedByPrefix, rawCachedEntry } from "../utils/apiCache";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockSettings = { adult: false, providers: [] };
const mockCalls = [];
let mockResolver = null; // (url, params) => Promise<{data}> | null
let mockRail = null; // PaginatedRail taklidinin son prop'ları

jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  TouchableOpacity: "TouchableOpacity",
  StyleSheet: { create: (s) => s, flatten: (s) => s },
  Animated: {
    Value: class { constructor(v) { this.v = v; } },
    timing: () => ({ start: () => {} }),
    View: "AnimatedView",
  },
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("../components/PosterImage", () => "PosterImage");
jest.mock("../components/ListBadges", () => "ListBadges");
jest.mock("../components/PosterInfoBadges", () => ({
  RatingBadge: "RatingBadge",
  POSTER_BADGE_POS: { bottomRight: {} },
}));
jest.mock("../components/home/SectionHeader", () => "SectionHeader");
jest.mock("../components/Skeleton", () => ({ RailSkeleton: "RailSkeleton" }));
jest.mock("../components/PaginatedRail", () => (props) => {
  mockRail = props;
  return null;
});
jest.mock("../hooks/useRailPosterStyle", () => () => ({
  itemWidth: 100, itemHeight: 150, posterWidth: 100, posterHeight: 150, radius: 8,
}));
jest.mock("../context/MediaQuickActionsContext", () => ({
  useMediaQuickActions: () => ({ openQuickActions: () => {} }),
}));
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: { secondary: "#222", border: "#333", text: { primary: "#fff", muted: "#999" } },
  }),
}));
jest.mock("../context/LanguageContext", () => ({
  useLanguage: () => ({ language: "tr" }),
}));
jest.mock("../context/AppSettingsContext", () => ({
  useApiSettings: () => ({ API_KEY: "test-key" }),
  useStreamingProviderSettings: () => ({ streamingProviderIds: mockSettings.providers }),
  useContentSettings: () => ({ adultContent: mockSettings.adult }),
  useImageQualitySettings: () => ({ imageQualityLevel: "good", getTmdbUrl: () => "u" }),
  useListLayoutSettings: () => ({
    railPosterSize: "normal", railPosterRadius: 15, posterBadges: {},
  }),
}));
jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: (url, config) => {
      mockCalls.push({ url, params: config?.params || {} });
      return mockResolver(url, config?.params || {});
    },
  },
}));

const DiscoveryMediaRail = require("../components/DiscoveryMediaRail").default;

const VAKIT = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const ogeler = (...idler) =>
  idler.map((id) => (typeof id === "object" ? id : { id, poster_path: `/${id}.jpg`, adult: false }));
const yanit = (...idler) => Promise.resolve({ data: { results: ogeler(...idler), total_pages: 2 } });
const gosterilen = () => (mockRail?.data || []).map((o) => o.id);

describe("DiscoveryMediaRail — ayar değişimi", () => {
  let kok;
  const kur = async (preset) => {
    await act(async () => {
      kok = create(<DiscoveryMediaRail mediaType="movie" preset={preset} navigation={{}} />);
    });
    await VAKIT();
    await VAKIT();
  };
  const yenidenCiz = async (preset) => {
    await act(async () => {
      kok.update(<DiscoveryMediaRail mediaType="movie" preset={preset} navigation={{}} />);
    });
    await VAKIT();
    await VAKIT();
  };

  beforeEach(() => {
    clearCachedByPrefix("");
    mockCalls.length = 0;
    mockRail = null;
    mockSettings.adult = false;
    mockSettings.providers = [];
    // Gerçek TMDB gibi: yetişkin kayıt yalnız ayar AÇIKKEN gelir.
    mockResolver = () =>
      mockSettings.adult
        ? yanit(1, 2, { id: 99, poster_path: "/a.jpg", adult: true })
        : yanit(1, 2);
  });

  afterEach(async () => {
    await act(async () => { kok.unmount(); });
  });

  test("başlangıç: yetişkin kapalıyken ray yetişkin kayıt içermez", async () => {
    await kur("recentFavorites");
    expect(gosterilen()).toEqual([1, 2]);
  });

  test("yetişkin içerik AÇILINCA ray yeniden yüklenir ve ayrı kovaya yazar", async () => {
    await kur("recentFavorites");
    const once = mockCalls.length;

    mockSettings.adult = true;
    await yenidenCiz("recentFavorites");

    // ESKİ HATA: taze önbellek yüzünden ağ isteği atılmıyor, ray aynı kalıyordu.
    expect(mockCalls.length).toBeGreaterThan(once);
    expect(gosterilen()).toContain(99);
    const kovalar = ["~a", ""].map((ek) =>
      rawCachedEntry(`discovery_v2_movie_recentFavorites_tr_all_1${ek}`),
    );
    expect(kovalar[0]).not.toBeNull();
    expect(kovalar[1]).not.toBeNull();
    // İzinsiz kova yetişkin kayıt İÇERMEZ.
    expect(kovalar[1].data.results.map((o) => o.id)).not.toContain(99);
  });

  test("KAPATILINCA yetişkin kayıt kalkar ve taze kovadan okunduğu için ağa gidilmez", async () => {
    await kur("recentFavorites");
    mockSettings.adult = true;
    await yenidenCiz("recentFavorites");
    expect(gosterilen()).toContain(99);
    const acikIstek = mockCalls.length;

    mockSettings.adult = false;
    await yenidenCiz("recentFavorites");

    expect(gosterilen()).not.toContain(99);
    expect(mockCalls.length).toBe(acikIstek);
  });

  test("platform üyeliği değişince ray yeni platform kümesiyle yeniden yüklenir", async () => {
    mockSettings.providers = [8];
    mockResolver = (_url, params) =>
      yanit(Number(params.with_watch_providers) * 10 + 1);
    await kur("subscriptions");
    expect(gosterilen()).toEqual([81]);

    mockSettings.providers = [8, 337];
    await yenidenCiz("subscriptions");

    expect(new Set(gosterilen())).toEqual(new Set([81, 3371]));
    const kullanilan = mockCalls.map((c) => c.params.with_watch_providers);
    expect(kullanilan).toContain(337);
  });

  // İSTEK SIRASI. Kullanıcı Ayarlar'da platformları art arda açıp kapatınca
  // birkaç yükleme aynı anda uçuşta olur. Yavaş gelen ESKİ sonuç, ekranda yeni
  // seçimin sonucunun üstüne yazılıyordu.
  test("yavaş gelen ESKİ platform sonucu, yeni seçimin sonucunu ezmez", async () => {
    let yavasiBirak;
    const yavas = new Promise((coz) => { yavasiBirak = coz; });
    mockResolver = (_url, params) => {
      if (params.with_watch_providers === 8) {
        return yavas.then(() => ({ data: { results: ogeler(81), total_pages: 1 } }));
      }
      return yanit(3371);
    };

    mockSettings.providers = [8];
    await kur("subscriptions"); // 8 için istek uçuşta, henüz dönmedi

    mockSettings.providers = [337];
    await yenidenCiz("subscriptions"); // 337 hızlı döner
    expect(gosterilen()).toEqual([3371]);

    // Şimdi ESKİ (8) yanıtı geç geliyor.
    await act(async () => { yavasiBirak(); });
    await VAKIT();
    await VAKIT();

    expect(gosterilen()).toEqual([3371]);
    // Ama eskimiş sonuç kendi (doğru) anahtarına önbelleğe yazıldı.
    expect(rawCachedEntry("discovery_v2_movie_subscriptions_tr_8_1")).not.toBeNull();
  });

  test("ayar değişmeden yeniden çizim ağ isteği üretmez", async () => {
    await kur("hiddenGems");
    const once = mockCalls.length;
    await yenidenCiz("hiddenGems");
    await yenidenCiz("hiddenGems");
    expect(mockCalls.length).toBe(once);
  });
});
