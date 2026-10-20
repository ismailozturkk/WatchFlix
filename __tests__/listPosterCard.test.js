// __tests__/listPosterCard.test.js
//
// Liste poster kartı (components/lists/ListPosterCard): rozetler poster genişliğine göre sadeleşir, dizi
// ilerlemesi, TMDB görsel genişliği, kişisel puan rozetinin yukarı kalkması, dokunma sözleşmesi.
// Görsel parçalar (afiş, puan rozeti, gradyan, simge) taklit edilir; props'ları doğrudan okunur.

import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, hairlineWidth: 1, flatten: (s) => s },
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "Gradient" }));
jest.mock("../components/PosterImage", () => ({
  __esModule: true,
  default: ({ children, ...props }) => require("react").createElement("Poster", props, children),
}));
jest.mock("../components/PosterActivityBadge", () => ({
  MyPosterActivityBadge: (props) => require("react").createElement("ActivityBadge", props),
}));

const ListPosterCard = require("../components/lists/ListPosterCard").default;

global.IS_REACT_ACT_ENVIRONMENT = true;

const theme = {
  primary: "#111111", secondary: "#1b1b1b", border: "#333333", accent: "#3388ff",
  text: { primary: "#ffffff", secondary: "#bbbbbb", muted: "#888888" },
};
const INFO = { title: true, mediaType: true, duration: true, rating: true, comment: true };
const LABELS = { movie: "Film", tv: "Dizi" };
const movie = { id: 603, type: "movie", name: "The Matrix", imagePath: "/matrix.jpg" };
const show = { id: 1399, type: "tv", name: "Game of Thrones", imagePath: "/got.jpg", showEpisodeCount: 24 };

let renderer;
let errorSpy;
beforeEach(() => {
  const original = console.error;
  errorSpy = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
});
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = null;
  errorSpy.mockRestore();
});

const flat = (style) => Object.assign({}, ...[].concat(style).flat(Infinity).filter(Boolean));
const render = (props = {}) => {
  act(() => {
    renderer = create(
      <ListPosterCard
        item={movie}
        posterWidth={116}
        radius={12}
        info={INFO}
        listName="watchList"
        theme={theme}
        durationMinutes={112}
        typeLabels={LABELS}
        {...props}
      />,
    );
  });
};
const host = (testID) => renderer.root.findAll((n) => typeof n.type === "string" && n.props.testID === testID);
const has = (testID) => host(testID).length > 0;
const one = (testID) => {
  const found = host(testID);
  if (found.length !== 1) throw new Error(`${testID}: ${found.length} düğüm`);
  return found[0];
};
const textOf = (testID) => {
  const node = one(testID);
  return node.findAllByType("Text").map((n) => [].concat(n.props.children).join("")).join("");
};
const iconsOf = (testID) => one(testID).findAllByType("Icon").map((n) => n.props.name);
const poster = () => renderer.root.findByType("Poster");
const badge = () => renderer.root.findByType("ActivityBadge");

describe("rozetler poster genişliğine göre", () => {
  it("geniş posterde tür yazılı, süre kısa biçimde (1:52); başlık görünür", () => {
    render({ posterWidth: 116 });
    expect(textOf("list-poster-type")).toBe("Film");
    expect(textOf("list-poster-duration")).toBe("1:52");
    expect(textOf("list-poster-title")).toBe("The Matrix");
  });

  it("dar posterde (4'lü ızgara, 70 dp) tür YALNIZ simge, süre sığar", () => {
    render({ posterWidth: 70 });
    expect(host("list-poster-type")[0].findAllByType("Text")).toHaveLength(0);
    expect(iconsOf("list-poster-type")).toEqual(["film-outline"]);
    expect(textOf("list-poster-duration")).toBe("1:52");
  });

  it("rozet puntosu poster küçüldükçe küçülür (hiçbir rozet 8 pt altına inmez)", () => {
    render({ posterWidth: 70 });
    const small = flat(one("list-poster-duration").findAllByType("Text")[0].props.style).fontSize;
    act(() => renderer.unmount());
    render({ posterWidth: 170 });
    const big = flat(one("list-poster-duration").findAllByType("Text")[0].props.style).fontSize;
    expect(small).toBeGreaterThanOrEqual(8);
    expect(big).toBeGreaterThan(small);
  });

  it("başlık puntosu poster büyüdükçe artar, tek satır", () => {
    render({ posterWidth: 70 });
    const small = flat(one("list-poster-title").props.style);
    act(() => renderer.unmount());
    render({ posterWidth: 170 });
    const big = flat(one("list-poster-title").props.style);
    expect(big.fontSize).toBeGreaterThan(small.fontSize);
    expect(one("list-poster-title").props.numberOfLines).toBe(1);
  });

  it("ayarlar kapalıysa ne rozet ne başlık çizilir", () => {
    render({ info: { title: false, mediaType: false, duration: false, rating: false, comment: false } });
    expect(has("list-poster-type")).toBe(false);
    expect(has("list-poster-duration")).toBe(false);
    expect(has("list-poster-title")).toBe(false);
  });

  it("süre bilinmiyorsa süre rozeti yok", () => {
    render({ durationMinutes: 0 });
    expect(has("list-poster-duration")).toBe(false);
    render({ durationMinutes: undefined });
    expect(has("list-poster-duration")).toBe(false);
  });

  it("dizinin tür simgesi tv, etiketi Dizi", () => {
    render({ item: show, durationMinutes: 600 });
    expect(textOf("list-poster-type")).toBe("Dizi");
    expect(iconsOf("list-poster-type")).toEqual(["tv-outline"]);
  });
});

describe("görsel", () => {
  it("TMDB görseli posterin GERÇEK genişliğiyle istenir (eski sabit 200 değil) ve geri dönüşüm anahtarı taşır", () => {
    render({ posterWidth: 116.4 });
    expect(poster().props.size).toBe(116);
    expect(poster().props.recyclingKey).toBe("movie:603");
    expect(poster().props.path).toBe("/matrix.jpg");
  });

  it("film ve dizi aynı id'yi paylaşsa da geri dönüşüm anahtarı farklı", () => {
    render({ item: { ...show, id: 603 } });
    expect(poster().props.recyclingKey).toBe("tv:603");
  });

  it("poster yüksekliği 2:3", () => {
    render({ posterWidth: 100 });
    const frame = renderer.root.findAll((n) => typeof n.type === "string" && n.type === "View" && flat(n.props.style).height === 150);
    expect(frame.length).toBeGreaterThan(0);
  });
});

describe("dizi ilerlemesi", () => {
  const tvProps = { item: show, listName: "watchedTv", durationMinutes: 600, totalCount: 24 };

  it("çubuk oranı kadar dolar; turuncu = devam, yeşil = bitti", () => {
    render({ ...tvProps, watchedCount: 12 });
    const fill = one("list-poster-progress").findAll((n) => typeof n.type === "string" && n.type === "View")[1];
    expect(flat(fill.props.style).width).toBe("50%");
    expect(flat(fill.props.style).backgroundColor).toBe("#FF9F43");
    act(() => renderer.unmount());
    render({ ...tvProps, watchedCount: 24 });
    const done = one("list-poster-progress").findAll((n) => typeof n.type === "string" && n.type === "View")[1];
    expect(flat(done.props.style).width).toBe("100%");
    expect(flat(done.props.style).backgroundColor).toBe("#34D17A");
  });

  it("'12/24' yazısı orta/geniş posterde var, dar posterde yok (çubuk kalır)", () => {
    render({ ...tvProps, watchedCount: 12, posterWidth: 116 });
    expect(textOf("list-poster-progress-text")).toBe("12/24");
    act(() => renderer.unmount());
    render({ ...tvProps, watchedCount: 12, posterWidth: 70 });
    expect(has("list-poster-progress-text")).toBe(false);
    expect(has("list-poster-progress")).toBe(true);
  });

  it("tamamlanan dizide yazının yanında onay simgesi", () => {
    render({ ...tvProps, watchedCount: 24 });
    expect(iconsOf("list-poster-progress-text")).toEqual(["checkmark-circle"]);
  });

  it("izleme listesi gibi ilerlemesiz listelerde çubuk yok; toplam bölüm bilinmiyorsa da yok", () => {
    render({ ...tvProps, listName: "watchList", watchedCount: 12 });
    expect(has("list-poster-progress")).toBe(false);
    render({ ...tvProps, watchedCount: 12, totalCount: undefined });
    expect(has("list-poster-progress")).toBe(false);
  });
});

describe("kişisel puan rozeti konumu", () => {
  it("ilerleme çubuğu yokken varsayılan köşede (ek konum yok)", () => {
    render();
    expect(badge().props.style).toBeNull();
    expect(badge().props.corner).toBe("bottomLeft");
    expect(badge().props.layout).toBe("overlay");
    expect(badge().props.showRating).toBe(true);
  });

  it("dizi ilerleme çubuğunun üstüne kalkar", () => {
    render({ item: show, listName: "watchedTv", watchedCount: 3, totalCount: 24, durationMinutes: 600 });
    expect(flat(badge().props.style).bottom).toBeGreaterThan(8);
  });

  it("alt yuva (Ortak liste: ekleyen çipi) yüksekliği kadar daha yukarı oturur", () => {
    render({ bottomSlot: <Slot />, bottomSlotHeight: 26 });
    expect(flat(badge().props.style).bottom).toBeGreaterThanOrEqual(26);
    expect(renderer.root.findAllByType("SlotHost")).toHaveLength(1);
  });

  it("puan / yorum anahtarları ayardan geçer", () => {
    render({ info: { ...INFO, rating: false, comment: true } });
    expect(badge().props.showRating).toBe(false);
    expect(badge().props.showComment).toBe(true);
  });
});

function Slot() {
  return React.createElement("SlotHost");
}

describe("dokunma sözleşmesi", () => {
  it("dokunma ve uzun basma öğeyi çağırana verir", () => {
    const onPress = jest.fn();
    const onLongPress = jest.fn();
    render({ onPress, onLongPress });
    const root = one("list-poster-movie:603");
    act(() => root.props.onPress());
    act(() => root.props.onLongPress());
    expect(onPress).toHaveBeenCalledWith(movie);
    expect(onLongPress).toHaveBeenCalledWith(movie);
  });

  it("işleyici verilmediyse patlamaz; erişilebilirlik etiketi ad + tür + süreyi taşır", () => {
    render();
    const root = one("list-poster-movie:603");
    expect(() => act(() => root.props.onPress())).not.toThrow();
    expect(root.props.accessibilityLabel).toBe("The Matrix, Film, 1:52");
  });

  it("basılıyken hafifçe küçülür", () => {
    render();
    const styleFn = one("list-poster-movie:603").props.style;
    expect(flat(styleFn({ pressed: true })).transform).toEqual([{ scale: 0.96 }]);
    expect(flat(styleFn({ pressed: false })).transform).toBeUndefined();
  });
});
