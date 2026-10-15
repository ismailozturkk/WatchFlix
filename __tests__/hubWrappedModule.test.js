// Hub "Wrapped & Arşiv" modülü + Wrapped ekranının rota kaydı.
//
// 15 Eki: (1) Hero kartın altındaki ayrı "Yılın rakamları" bento bölümü kaldırıldı;
// değerler (film / dizi / bölüm / aktif gün / en uzun seri) hero kartın içinde tek
// satırlık kompakt bir şeride taşındı. (2) Arşivden bir yıla basınca açılan
// WrappedScreen `presentation: "modal"` idi: iOS sayfa sheet'i açıp üstte ~60pt
// boşluk bırakıyor, ekran da kök güvenli alanı (`insets.top`) yine ekleyip içeriği
// sheet'in kendi tepesinden ~70pt aşağı itiyordu. Artık tam ekran.
//
// Burada kilitlenen şey: rakamlar kartın İÇİNDE ve eski bölüm başlığı yok, değerler
// recap hesabıyla aynı; rota kaydı sheet'e geri dönmüyor. Gerçek çizim (gradyan,
// cam şerit, kırpılma) cihazda doğrulanır.
import fs from "fs";
import path from "path";
import React from "react";
import { act, create } from "react-test-renderer";
import HubWrappedModule from "../components/hub/HubWrappedModule";
import { buildYearlyRecap, formatNumber } from "../utils/wrapped";
import { getWrappedStrings } from "../utils/wrappedStrings";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Önceki yıl: "unlimited" planda her yıl açık, tarih bugüne göre gelecekte kalmaz.
const YEAR = new Date().getFullYear() - 1;

const mockTheme = {
  primary: "#111111",
  secondary: "#202020",
  between: "#181818",
  border: "#333333",
  accent: "#3388ff",
  text: { primary: "#ffffff", secondary: "#cccccc", muted: "#888888" },
};

const movie = (day, minutes = 100) => ({
  id: `m-${day}-${minutes}-${Math.random()}`,
  type: "movie",
  dateAdded: `${YEAR}-${day}`,
  minutes,
});
const ep = (day, showId, minutes = 40) => ({
  id: `${showId}_${day}_${Math.random()}`,
  showId,
  showName: `Show ${showId}`,
  episodeWatchTime: `${YEAR}-${day}`,
  episodeMinutes: minutes,
});

// 4 film, 2 dizi, 5 bölüm, 6 aktif gün (03-01,02,03,04,10,20), en uzun seri 4.
const mockListItems = [movie("03-01"), movie("03-01", 90), movie("03-02"), movie("03-20")];
const mockEpisodes = [
  ep("03-03", 1),
  ep("03-04", 1),
  ep("03-04", 1, 45),
  ep("03-04", 1, 50),
  ep("03-10", 2),
];

jest.mock("react-native", () => {
  const React = require("react");
  return {
    View: "View",
    Text: "Text",
    ScrollView: "ScrollView",
    Pressable: ({ style, children, ...rest }) =>
      React.createElement(
        "Pressable",
        { ...rest, style: typeof style === "function" ? style({ pressed: false }) : style },
        children,
      ),
    StyleSheet: {
      create: (styles) => styles,
      flatten: (style) => style,
      absoluteFill: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
      hairlineWidth: 1,
    },
  };
});

// Babel eklentisi (scripts/babel-transform-app-text.js) `Text`'i AppText'e çevirir.
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));

jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const AnimatedView = React.forwardRef(({ children, ...rest }, ref) =>
    React.createElement("AnimatedView", { ...rest, ref }, children),
  );
  const ease = (f) => f;
  const chain = {};
  ["delay", "springify", "damping", "reduceMotion"].forEach((k) => {
    chain[k] = () => chain;
  });
  return {
    __esModule: true,
    default: { View: AnimatedView },
    useSharedValue: (value) => ({ value }),
    useAnimatedStyle: (updater) => updater(),
    withSpring: (value) => value,
    withTiming: (value) => value,
    withDelay: (_ms, value) => value,
    withRepeat: (value) => value,
    withSequence: (...values) => values[values.length - 1],
    Easing: { inOut: ease, sin: ease, quad: ease, out: ease, cubic: ease },
    ReduceMotion: { System: "system" },
    FadeInDown: chain,
  };
});

jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("@expo/vector-icons/MaterialCommunityIcons", () => "MaterialCommunityIcons");
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("../components/common/BottomSheetModal", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({ visible, children }) =>
      visible ? React.createElement("BottomSheetModal", null, children) : null,
  };
});
jest.mock("../components/common/GlassCloseButton", () => "GlassCloseButton");
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
jest.mock("../context/ProfileStatsContext", () => ({
  useProfileStats: () => ({ listItems: mockListItems, flatEpisodesTv: mockEpisodes }),
}));
jest.mock("../context/AppSettingsContext", () => ({
  useImageQualitySettings: () => ({ getTmdbUrl: () => null }),
}));
jest.mock("../hooks/usePremiumGate", () => ({
  usePremiumGate: () => ({ plan: "unlimited", showUpsell: jest.fn() }),
}));
// Hareketi azalt açık: sayaçlar ilk efektte doğrudan son değere atlar.
jest.mock("../hooks/useReduceMotion", () => ({ __esModule: true, default: () => true }));
jest.mock("../services/hapticsService", () => ({ triggerHaptic: jest.fn() }));
jest.mock("../utils/i18nText", () => ({ i18nText: (_key, fallback) => fallback }));

const textOf = (node) => {
  if (node == null) return [];
  if (typeof node === "string") return [node];
  if (Array.isArray(node)) return node.flatMap(textOf);
  return textOf(node.children);
};

function render() {
  let tree;
  act(() => {
    tree = create(<HubWrappedModule navigation={{ navigate: jest.fn() }} revealed />);
  });
  return tree;
}

describe("HubWrappedModule rakam şeridi", () => {
  const str = getWrappedStrings("tr");
  const recap = buildYearlyRecap({ movies: mockListItems, episodes: mockEpisodes, year: YEAR, language: "tr" });

  it("test verisi beklenen rakamları üretiyor (sağlama)", () => {
    expect(recap.totalMovies).toBe(4);
    expect(recap.totalShows).toBe(2);
    expect(recap.totalEpisodes).toBe(5);
    expect(recap.activeDays).toBe(6);
    expect(recap.longestStreak).toBe(4);
  });

  it("eski 'Yılın rakamları' bölümü ve 'En yoğun ay' kutusu yok", () => {
    const all = textOf(render().toJSON());
    expect(all).not.toContain("Yılın rakamları");
    expect(all).not.toContain("En yoğun ay");
  });

  it("rakamlar hero kartın İÇİNDE, recap ile aynı değerlerle ve sırayla", () => {
    const tree = render();
    const hero = tree.root.findAll(
      (n) => n.type === "Pressable" && n.props.accessibilityLabel === `${str.brand} ${YEAR}`,
    )[0];
    expect(hero).toBeTruthy();

    const inHero = hero
      .findAll((n) => n.type === "Text")
      .flatMap((n) => textOf(n.props.children));
    const fmt = (n) => formatNumber(n, "tr");
    const labels = [
      str.summaryMovies,
      str.summaryShows,
      str.summaryEpisodes,
      str.hubTileActiveDays,
      str.hubTileStreak,
    ];
    // Değer her etiketten hemen önce gelir (gün birimi olan hücrelerde birim araya girer).
    const expectedValues = [
      fmt(recap.totalMovies),
      fmt(recap.totalShows),
      fmt(recap.totalEpisodes),
      fmt(recap.activeDays),
      fmt(recap.longestStreak),
    ];
    labels.forEach((label, i) => {
      const at = inHero.indexOf(label);
      expect(at).toBeGreaterThan(0);
      const before = inHero.slice(Math.max(0, at - 2), at);
      expect(before).toContain(expectedValues[i]);
    });
    // Sıra: Film → Dizi → Bölüm → Aktif gün → En uzun seri.
    const order = labels.map((l) => inHero.indexOf(l));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("arşiv satırı yerinde duruyor", () => {
    expect(textOf(render().toJSON())).toContain(str.hubArchiveTitle);
  });

  it("silinen bölümün yazıları TR/EN'den de kalktı", () => {
    ["tr", "en"].forEach((lang) => {
      const s = getWrappedStrings(lang);
      expect(s).not.toHaveProperty("hubNumbersTitle");
      expect(s).not.toHaveProperty("hubTileBusiestMonth");
    });
  });
});

describe("WrappedScreen rotası", () => {
  const appSource = fs.readFileSync(path.join(__dirname, "..", "App.js"), "utf8");
  const block = appSource.match(/name="WrappedScreen"[\s\S]*?\/>/)[0];
  // Açıklama satırları sayılmaz: yorum eski "modal" ayarını anlatıyor.
  const code = block.replace(/\/\/.*$/gm, "");

  it("sayfa sheet'i (modal) değil tam ekran açılır", () => {
    expect(code).toMatch(/presentation:\s*"fullScreenModal"/);
    expect(code).not.toMatch(/presentation:\s*"modal"/);
  });

  it("alttan kayarak açılma animasyonu korunur", () => {
    expect(code).toMatch(/animation:\s*"slide_from_bottom"/);
  });
});
