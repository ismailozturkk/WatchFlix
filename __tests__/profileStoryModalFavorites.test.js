// "Profili paylaş" düzenleyicisi × dört favori (bileşen düzeyi).
//
// 15 Eki: İçerik sekmesine "Dört favori" anahtarı + kategori seçimi, Düzen
// sekmesine "Seçki" düzeni eklendi. Burada kilitlenen şey ETKİLEŞİM mantığı:
//   - Seçki favorisiz seçilemez ve nedenini söyler; favori varken seçilince
//     anahtar da açılır,
//   - kategori satırı yalnız favoriler etkinken görünür; boş kategori seçilemez,
//     son kategori kapatılamaz, seçim diske yazılır,
//   - Poster düğmesi favoriler etkinken pasiflenir ve nedenini söyler,
//   - "paylaşıma hazır" kapısı kartta ÇİZİLEN görselleri bekler (favoriler),
//   - karıştır düğmesi favorisizken Seçki'yi seçmez.
// Kart bileşeni burada taklit edilir (aldığı props okunur); kartın kendi çizimi
// profileStoryCardFavorites.test.js'te. Gerçek görünüm cihazda doğrulanır.
import React from "react";
import { act, create } from "react-test-renderer";
import ProfileStoryModal from "../components/storyShare/ProfileStoryModal";
import { textOf } from "./helpers/storyCardFixtures";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockSet = jest.fn();
let mockSaved;

jest.mock("react-native", () => {
  const React = require("react");
  return {
    View: "View",
    Text: "Text",
    ScrollView: "ScrollView",
    TextInput: "TextInput",
    ActivityIndicator: "ActivityIndicator",
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
    Platform: { OS: "ios", select: (o) => o.ios },
    Keyboard: { addListener: () => ({ remove() {} }), dismiss() {} },
    useWindowDimensions: () => ({ width: 390, height: 844 }),
  };
});
jest.mock("../components/typography/AppText", () => ({ AppText: "Text", AppTextInput: "TextInput" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
jest.mock("../components/common/BottomSheetModal", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({ visible, children }) => (visible ? React.createElement("Sheet", null, children) : null),
  };
});
jest.mock("../components/AppIcon", () => ({ __esModule: true, default: "AppIcon" }));
jest.mock("../components/common/GlassIconButton", () => ({ __esModule: true, default: "GlassIconButton" }));
jest.mock("../components/common/GlassCloseButton", () => ({ __esModule: true, default: "GlassCloseButton" }));
jest.mock("../components/storyShare/ProfileStoryCard", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: (props) => React.createElement("StoryCard", props),
    STORY_CARD_H: 640,
    STORY_CARD_W: 360,
    getStoryPalette: () => ({ accent: "#3388ff", colors: ["#000000", "#111111", "#222222", "#333333"] }),
  };
});
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: {
      primary: "#111111",
      secondary: "#202020",
      border: "#333333",
      accent: "#3388ff",
      text: { primary: "#ffffff", secondary: "#cccccc", muted: "#888888" },
    },
  }),
}));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
jest.mock("../context/ProfileStatsContext", () => ({
  useProfileStats: () => ({
    lists: [
      ["favorites", [{ id: 1, type: "movie", name: "Kalp 1", imagePath: "/k1.jpg", listOrder: 0 }]],
      ["watchedMovies", [{ id: 2, type: "movie", name: "İzlenen", imagePath: "/w2.jpg", dateAdded: 5, genres: ["Drama"] }]],
      ["watchedTv", []],
    ],
    displayMovieCount: 12,
    displayTvCount: 3,
    displayEpisodesCount: 40,
    totalMinutesTime: 1000,
    totalMinutesTimeTv: 500,
    borderColor: "hsl(265, 60%, 60%)",
    borderColor2: "hsl(265, 74%, 76%)",
  }),
}));
jest.mock("../context/WatchProgressContext", () => ({
  useWatchProgressContext: () => ({ perde: null, seriler: null, acikSayisi: 0, toplamRozet: 0, kartlar: [] }),
}));
jest.mock("../context/AppSettingsContext", () => ({
  useImageQualitySettings: () => ({
    getTmdbUrl: (path, kind) => (path ? `https://img.test${path}?${kind}` : null),
  }),
}));
jest.mock("../utils/i18nText", () => ({ i18nText: (_key, fallback) => fallback }));
jest.mock("../services/hapticsService", () => ({ triggerHaptic: jest.fn() }));
jest.mock("../services/storage", () => ({
  Keys: { profileStoryCard: "profileStoryCard" },
  get: () => mockSaved,
  set: (...args) => mockSet(...args),
}));
jest.mock("../services/storyShare/storyShareService", () => ({
  captureStoryCard: jest.fn(),
  saveStoryToGallery: jest.fn(),
  shareStoryImage: jest.fn(),
}));

const entry = (id, extra = {}) => ({ id, title: `Başlık ${id}`, image: `/i${id}.jpg`, ...extra });
const FULL = {
  movies: [entry(1), entry(2)],
  shows: [entry(11)],
  people: [entry(21)],
};

function open(favorites = FULL) {
  let tree;
  act(() => {
    tree = create(
      <ProfileStoryModal
        visible
        onClose={() => {}}
        name="Ayşe"
        username="ayse"
        avatar={null}
        isCustomPhoto={false}
        badges={[]}
        bio=""
        joinedAt={Date.UTC(2024, 2, 15, 12)}
        favorites={favorites}
      />,
    );
  });
  return tree;
}

const labelOf = (node) =>
  node
    .findAll((n) => n.type === "Text")
    .flatMap((n) => textOf(n.props.children))
    .join("");

const pressables = (tree) => tree.root.findAll((n) => n.type === "Pressable");
const byLabel = (tree, label) => pressables(tree).find((n) => labelOf(n) === label);
const press = (tree, label) => {
  const node = byLabel(tree, label);
  if (!node) throw new Error(`düğme yok: ${label}`);
  act(() => node.props.onPress());
};
const has = (tree, label) => Boolean(byLabel(tree, label));
const card = (tree) => tree.root.findAll((n) => n.type === "StoryCard")[0].props;
const allText = (tree) => textOf(tree.toJSON()).join(" ");
const shareButton = (tree) => pressables(tree).find((n) => n.props.accessibilityLabel === "Hikâyede paylaş");
const unmount = (tree) => act(() => tree.unmount());

beforeEach(() => {
  mockSaved = undefined;
  mockSet.mockClear();
});

describe("Düzen sekmesi: Seçki", () => {
  test("beş düzen listelenir, Seçki dahil", () => {
    const tree = open();
    for (const label of ["Vitrin", "Kimlik", "Duvar", "Minimal", "Seçki"]) expect(has(tree, label)).toBe(true);
    unmount(tree);
  });

  test("favori varken Seçki seçilir: kart favorilerle çizilir, anahtar da açılır", () => {
    mockSaved = { showFavorites: false };
    const tree = open();
    expect(card(tree).favorites).toBeNull(); // anahtar kapalı
    press(tree, "Seçki");
    expect(card(tree).options.layout).toBe("picks");
    expect(card(tree).options.showFavorites).toBe(true);
    const { favorites } = card(tree);
    expect(favorites.count).toBe(4);
    expect(favorites.groups.map((g) => g.kind)).toEqual(["movies", "shows", "people"]);
    // Etiketler büyük harfli ve favori metninden; görsel adresi türüne göre (poster / profil).
    expect(favorites.groups.map((g) => g.label)).toEqual(["FİLMLER", "DİZİLER", "OYUNCULAR"]);
    expect(favorites.groups[0].items[0]).toEqual({ key: "movies-1", title: "Başlık 1", uri: "https://img.test/i1.jpg?poster" });
    expect(favorites.groups[2].items[0].uri).toBe("https://img.test/i21.jpg?profile");
    unmount(tree);
  });

  test("favori yokken Seçki seçilmez ve nedenini söyler", () => {
    const tree = open({});
    press(tree, "Seçki");
    expect(card(tree).options.layout).toBe("showcase");
    expect(card(tree).favorites).toBeNull();
    expect(allText(tree)).toContain("Henüz dört favorin yok");
    expect(byLabel(tree, "Seçki").props.accessibilityState).toMatchObject({ disabled: true });
    unmount(tree);
  });

  test("kayıtlı düzen Seçki ama favori kalmadıysa: kart Vitrin'i seçili gösterir", () => {
    mockSaved = { layout: "picks" };
    const tree = open({});
    expect(byLabel(tree, "Vitrin").props.accessibilityState.selected).toBe(true);
    expect(byLabel(tree, "Seçki").props.accessibilityState.selected).toBe(false);
    unmount(tree);
  });

  test("kayıtlı düzen Seçki ve favori varsa Seçki seçili gelir", () => {
    mockSaved = { layout: "picks" };
    const tree = open();
    expect(byLabel(tree, "Seçki").props.accessibilityState.selected).toBe(true);
    unmount(tree);
  });
});

describe("İçerik sekmesi: dört favori anahtarı ve kategoriler", () => {
  test("favori varken anahtar açık, kategori satırı görünür (Kaynak satırı yerine)", () => {
    const tree = open();
    press(tree, "İçerik");
    expect(byLabel(tree, "Dört favori").props.accessibilityState.checked).toBe(true);
    expect(has(tree, "Oyuncular")).toBe(true);
    expect(has(tree, "Favoriler")).toBe(false); // poster kaynağı satırı gizli
    unmount(tree);
  });

  test("anahtar kapanınca poster kaynağı satırı geri gelir ve kart favorisiz", () => {
    const tree = open();
    press(tree, "İçerik");
    press(tree, "Dört favori");
    expect(card(tree).options.showFavorites).toBe(false);
    expect(card(tree).favorites).toBeNull();
    expect(has(tree, "Favoriler")).toBe(true);
    expect(has(tree, "Oyuncular")).toBe(false);
    unmount(tree);
  });

  test("kategori kapatılır / açılır, seçim diske yazılır (not hariç)", () => {
    const tree = open();
    press(tree, "İçerik");
    press(tree, "Diziler");
    expect(card(tree).favorites.groups.map((g) => g.kind)).toEqual(["movies", "people"]);
    expect(byLabel(tree, "Diziler").props.accessibilityState.selected).toBe(false);
    const saved = mockSet.mock.calls[mockSet.mock.calls.length - 1][1];
    expect(saved).toMatchObject({ showFavorites: true, favoriteKinds: ["movies", "people"] });
    expect(saved).not.toHaveProperty("note");
    press(tree, "Diziler");
    expect(card(tree).favorites.groups.map((g) => g.kind)).toEqual(["movies", "shows", "people"]);
    unmount(tree);
  });

  test("son kategori kapatılamaz ve nedenini söyler", () => {
    mockSaved = { favoriteKinds: ["movies"] };
    const tree = open();
    press(tree, "İçerik");
    press(tree, "Filmler");
    expect(card(tree).favorites.groups.map((g) => g.kind)).toEqual(["movies"]);
    expect(allText(tree)).toContain("En az bir kategori açık kalmalı");
    unmount(tree);
  });

  test("boş kategori seçilemez ve nedenini söyler", () => {
    const tree = open({ movies: FULL.movies });
    press(tree, "İçerik");
    expect(byLabel(tree, "Oyuncular").props.accessibilityState.disabled).toBe(true);
    press(tree, "Oyuncular");
    expect(allText(tree)).toContain("Bu kategoride favorin yok");
    expect(card(tree).favorites.groups.map((g) => g.kind)).toEqual(["movies"]);
    unmount(tree);
  });

  test("favori yokken anahtar pasif; basınca neden gösterilir, değer değişmez", () => {
    const tree = open({});
    press(tree, "İçerik");
    expect(byLabel(tree, "Dört favori").props.accessibilityState.disabled).toBe(true);
    press(tree, "Dört favori");
    expect(allText(tree)).toContain("Henüz dört favorin yok");
    expect(card(tree).options.showFavorites).toBe(true);
    // Kategori satırı yok: poster kaynağı satırı görünür.
    expect(has(tree, "Favoriler")).toBe(true);
    unmount(tree);
  });

  test("favoriler etkinken Poster düğmesi pasif ve nedenini söyler", () => {
    const tree = open();
    press(tree, "İçerik");
    expect(byLabel(tree, "Poster").props.accessibilityState.disabled).toBe(true);
    press(tree, "Poster");
    expect(allText(tree)).toContain("posterlerin yerini favorilerin alır");
    expect(card(tree).options.showPosters).toBe(true); // değer değişmedi
    unmount(tree);
  });

  test("favoriler kapalıyken Poster düğmesi yine çalışır", () => {
    const tree = open();
    press(tree, "İçerik");
    press(tree, "Dört favori");
    expect(byLabel(tree, "Poster").props.accessibilityState.disabled).toBe(false);
    press(tree, "Poster");
    expect(card(tree).options.showPosters).toBe(false);
    unmount(tree);
  });

  test("bayat kayıt: yalnız 'oyuncular' seçili ama oyuncu kalmadı → tüm kategoriler görünür", () => {
    mockSaved = { favoriteKinds: ["people"] };
    const tree = open({ movies: FULL.movies });
    expect(card(tree).favorites.groups.map((g) => g.kind)).toEqual(["movies"]);
    unmount(tree);
  });
});

describe("paylaşıma hazır kapısı", () => {
  test("favoriler etkinken kartta çizilen favori görselleri beklenir (liste posterleri değil)", () => {
    const tree = open();
    expect(shareButton(tree).props.disabled).toBe(true);
    const uris = card(tree).favorites.groups.flatMap((g) => g.items.map((i) => i.uri));
    expect(uris).toHaveLength(4);
    act(() => uris.forEach((uri) => card(tree).onImageSettled(uri)));
    expect(shareButton(tree).props.disabled).toBe(false);
    unmount(tree);
  });

  test("favoriler kapalıyken poster görselleri beklenir", () => {
    mockSaved = { showFavorites: false };
    const tree = open();
    expect(shareButton(tree).props.disabled).toBe(true);
    act(() => card(tree).posters.items.forEach((item) => card(tree).onImageSettled(item.uri)));
    expect(shareButton(tree).props.disabled).toBe(false);
    unmount(tree);
  });

  test("görseli olmayan favori beklemeyi kilitlemez", () => {
    const tree = open({ people: [entry(21, { image: null })] });
    expect(card(tree).favorites.groups[0].items[0].uri).toBeNull();
    expect(shareButton(tree).props.disabled).toBe(false);
    unmount(tree);
  });
});

describe("karıştır", () => {
  const shuffleButton = (tree) =>
    tree.root.findAll((n) => n.type === "GlassIconButton" && n.props.accessibilityLabel === "Karıştır")[0];

  test("favorisizken Seçki hiç seçilmez", () => {
    const tree = open({});
    for (let i = 0; i < 60; i += 1) {
      act(() => shuffleButton(tree).props.onPress());
      expect(card(tree).options.layout).not.toBe("picks");
    }
    unmount(tree);
  });

  test("favoriliyken Seçki seçilebilir ve seçilince anahtar açılır", () => {
    mockSaved = { showFavorites: false };
    const tree = open();
    let picked = false;
    for (let i = 0; i < 200 && !picked; i += 1) {
      act(() => shuffleButton(tree).props.onPress());
      if (card(tree).options.layout === "picks") {
        picked = true;
        expect(card(tree).options.showFavorites).toBe(true);
      }
    }
    expect(picked).toBe(true);
    unmount(tree);
  });
});
