// __tests__/favoritesSeeAll.test.js
//
// "Favorilerine Göre" rafının "Tümü" düğmesi: raf düğmeyi SeeAllScreen'in `fromFavorites` bölümüne
// bağlar; ekran önerileri aynı kaynaktan çeker, İZLENMİŞLERİ eler ve hepsini ızgarada gösterir.
// Ağ servisi, bağlamlar ve yaprak bileşenler taklit; SeeAllScreen / SeeAllGrid / raf GERÇEK.

import React from "react";
import { act, create } from "react-test-renderer";

let mockFavorites;
let mockStatusIndex;
let mockRecommendations;
let mockFetchError;
const mockFetch = jest.fn();

jest.mock("react-native", () => {
  const React = require("react");
  return {
    StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
    Dimensions: { get: () => ({ width: 400, height: 800 }) },
    View: "View",
    Text: "Text",
    TouchableOpacity: "TouchableOpacity",
    ActivityIndicator: "ActivityIndicator",
    Animated: {
      Value: function Value() {},
      timing: () => ({ start: () => {} }),
      View: "AnimatedView",
    },
    // Gerçek FlatList'in yerine: satırları ve boş durumu düz çizer.
    FlatList: ({ data, renderItem, ListEmptyComponent }) =>
      data && data.length
        ? React.createElement(
            "FlatList",
            null,
            data.map((item, index) => React.createElement(React.Fragment, { key: index }, renderItem({ item, index }))),
          )
        : React.createElement("FlatList", null, ListEmptyComponent),
  };
});
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("axios", () => ({ get: jest.fn() }));
jest.mock("@components/PosterImage", () => ({ __esModule: true, default: "PosterImage" }));
jest.mock("../components/BackButton", () => ({ __esModule: true, default: "BackButton" }));
jest.mock("../components/ListBadges", () => ({ __esModule: true, default: "ListBadges" }));
jest.mock("../components/ScreenDecor", () => ({ __esModule: true, default: "ScreenDecor" }));
jest.mock("../components/AppIcon", () => ({ __esModule: true, default: "AppIcon" }));
jest.mock("../components/AppToast", () => ({ toast: { info: jest.fn() } }));
jest.mock("@context/ThemeContext", () => ({
  useTheme: () => ({
    theme: {
      accent: "#3388ff",
      primary: "#111111",
      secondary: "#222222",
      secondaryt: "#333333",
      border: "#333333",
      shadow: "#000000",
      text: { primary: "#ffffff", secondary: "#cccccc", muted: "#999999" },
    },
  }),
}));
jest.mock("@context/MovieContex", () => ({ MovieProvider: ({ children }) => children, useMovie: () => ({}) }));
jest.mock("@context/TvShowContex", () => ({ useTvShow: () => ({}) }));
jest.mock("@context/AppSettingsContext", () => ({
  useListLayoutSettings: () => ({
    seeAllGridColumns: 3,
    changeSeeAllGridColumns: () => {},
    seeAllPosterRadius: 10,
    changeSeeAllPosterRadius: () => {},
    posterBadges: {},
  }),
  useApiSettings: () => ({ API_KEY: "key" }),
  useStreamingProviderSettings: () => ({ streamingProviderIds: [] }),
}));
jest.mock("@context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
jest.mock("@context/MediaQuickActionsContext", () => ({
  useMediaQuickActions: () => ({ openQuickActions: () => {} }),
}));
jest.mock("../context/UserProfileContext", () => ({
  useUserProfile: () => ({ profile: { fourFavorites: mockFavorites } }),
}));
jest.mock("../context/ListStatusContext", () => ({
  useListStatusContext: () => ({ statusIndex: mockStatusIndex }),
}));
jest.mock("../services/favoriteRecommendations", () => ({
  fetchFavoriteRecommendations: (...args) => mockFetch(...args),
}));
// Film dalının "Yaklaşan" süzgeci (bu testin konusu değil): çip/sayfa/kanca kabuk.
jest.mock("../components/home/UpcomingFilterChips", () => ({ __esModule: true, default: "UpcomingFilterChips" }));
jest.mock("../components/home/TvUpcomingRangeChips", () => ({ __esModule: true, default: "TvUpcomingRangeChips" }));
jest.mock("../components/home/UpcomingFilterSheet", () => ({ __esModule: true, default: "UpcomingFilterSheet" }));
jest.mock("../components/home/UpcomingEmptyState", () => ({ __esModule: true, default: "UpcomingEmptyState" }));
jest.mock("../hooks/useUpcomingFilterControls", () => ({
  __esModule: true,
  default: () => ({ filters: {}, sheetVisible: false }),
}));

const SeeAllScreen = require("../screens/shared/SeeAllScreen").default;

global.IS_REACT_ACT_ENVIRONMENT = true;

const flush = () => act(async () => { await new Promise((resolve) => setImmediate(resolve)); });

let renderer;
let warn;
beforeEach(() => {
  mockFavorites = { movies: [{ id: 27205, title: "Inception" }], shows: [], people: [] };
  mockStatusIndex = { movie: {}, tv: {} };
  mockRecommendations = [
    { id: 1, poster_path: "/a", vote_average: 7 },
    { id: 2, poster_path: "/b", vote_average: 8 },
    { id: 3, poster_path: "/c", vote_average: 9 },
  ];
  mockFetchError = false;
  mockFetch.mockReset();
  mockFetch.mockImplementation(() =>
    mockFetchError
      ? Promise.reject(new Error("offline"))
      : Promise.resolve({ items: mockRecommendations, sources: [] }),
  );
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

const render = async (params = {}) => {
  act(() => {
    renderer = create(
      <SeeAllScreen
        route={{ params: { mediaType: "movie", section: "fromFavorites", title: "Favorilerine Göre", ...params } }}
        navigation={{ push: jest.fn(), navigate: jest.fn() }}
      />,
    );
  });
  await flush();
};
const shownPaths = () => renderer.root.findAllByType("PosterImage").map((node) => node.props.path);
const texts = () => renderer.root.findAllByType("Text").map((node) => [].concat(node.props.children).join(""));

describe("SeeAllScreen — fromFavorites", () => {
  test("favoriden türeyen önerilerin hepsini ızgarada gösterir", async () => {
    await render();
    expect(shownPaths()).toEqual(["/a", "/b", "/c"]);
    expect(texts()).toContain("Favorilerine Göre");
  });

  test("raftaki 20 sınırını aşar: büyük bir limitle ister (ray 40 çekip 20 gösteriyor)", async () => {
    await render();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toMatchObject({ mediaType: "movie", apiKey: "key", language: "tr" });
    expect(mockFetch.mock.calls[0][0].limit).toBeGreaterThan(40);
  });

  test("izlenmişleri eler (raftakiyle aynı kural)", async () => {
    mockStatusIndex = { movie: { 2: { isWatched: true } }, tv: {} };
    await render();
    expect(shownPaths()).toEqual(["/a", "/c"]);
  });

  test("izleme durumu değişince ağa çıkmadan güncellenir", async () => {
    await render();
    expect(shownPaths()).toEqual(["/a", "/b", "/c"]);
    mockStatusIndex = { movie: { 1: { isWatched: true } }, tv: {} };
    act(() => renderer.update(
      <SeeAllScreen
        route={{ params: { mediaType: "movie", section: "fromFavorites", title: "Favorilerine Göre" } }}
        navigation={{ push: jest.fn(), navigate: jest.fn() }}
      />,
    ));
    await flush();
    expect(shownPaths()).toEqual(["/b", "/c"]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("dizi sekmesinden gelince dizi favorilerinin kaynaklarına gider", async () => {
    mockFavorites = { movies: [], shows: [{ id: 1396, title: "Breaking Bad" }], people: [] };
    await render({ mediaType: "tv" });
    expect(mockFetch.mock.calls[0][0].mediaType).toBe("tv");
  });

  test("yükleme hatasında sonsuz dönmez, mesaj gösterir", async () => {
    mockFetchError = true;
    await render();
    expect(renderer.root.findAllByType("ActivityIndicator")).toHaveLength(0);
    expect(texts()).toContain("Liste yüklenemedi.");
  });

  test("hepsi izlenmişse boş mesaj gösterir", async () => {
    mockStatusIndex = {
      movie: { 1: { isWatched: true }, 2: { isWatched: true }, 3: { isWatched: true } },
      tv: {},
    };
    await render();
    expect(renderer.root.findAllByType("ActivityIndicator")).toHaveLength(0);
    expect(texts()).toContain("Sonuç bulunamadı");
  });

  test("kaynak yoksa (favori boş) ağa çıkmaz", async () => {
    mockFavorites = { movies: [], shows: [], people: [] };
    await render();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(shownPaths()).toEqual([]);
  });
});

describe("Favorilerine Göre rafı — Tümü düğmesi", () => {
  const rail = require("fs").readFileSync(
    require("path").join(__dirname, "..", "components/favorites/FavoritesRecommendationRail.js"),
    "utf8",
  );

  test("diğer raflar gibi SectionHeader.onPressAction ile SeeAllScreen'in fromFavorites bölümünü açar", () => {
    expect(rail).toMatch(/onPressAction=\{/);
    expect(rail).toMatch(/navigate\("SeeAllScreen"/);
    expect(rail).toMatch(/section: "fromFavorites"/);
    expect(rail).toMatch(/title: copy\.rail\.title/);
  });
});
