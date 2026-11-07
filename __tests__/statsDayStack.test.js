// __tests__/statsDayStack.test.js
//
// Film / Dizi istatistik ekranlarındaki gün kartı (StatsDateSection).
// Eskiden her gün o günün TÜM afişlerini (+ puan rozetlerini) çiziyordu; toplu
// eklemeli ya da maratonlu günlerde liste kaydırırken takılıyordu. Burada
// sabitlenen: gün başına en çok 4 yuva — 4'e kadar hepsi, fazlasında 3 afiş + kalanı "+N" yazan tek
// yığın karosu; yığına basınca o gün yerinde açılır, "Daralt" geri toplar.

import React from "react";
import { act, create } from "react-test-renderer";

const mockScrollToOffset = jest.fn();

jest.mock("react-native", () => {
  const mockReact = require("react");
  // Yatay listenin yerine: veriyi düz çizer, footer'ı sona koyar, ref'te
  // scrollToOffset verir (Daralt bunu çağırır).
  const FlatList = mockReact.forwardRef(function FlatList(
    { data, renderItem, keyExtractor, ListFooterComponent },
    ref,
  ) {
    mockReact.useImperativeHandle(ref, () => ({ scrollToOffset: mockScrollToOffset }));
    return mockReact.createElement(
      "FlatList",
      null,
      data.map((item, index) =>
        mockReact.createElement(mockReact.Fragment, { key: keyExtractor(item, index) },
          renderItem({ item, index })),
      ),
      ListFooterComponent,
    );
  });
  class Value {
    interpolate() {
      return this;
    }
  }
  return {
    StyleSheet: {
      create: (styles) => styles,
      hairlineWidth: 1,
      absoluteFill: { position: "absolute" },
      absoluteFillObject: { position: "absolute" },
    },
    View: "View",
    Text: "Text",
    TextInput: "TextInput",
    TouchableOpacity: "TouchableOpacity",
    Pressable: "Pressable",
    ScrollView: "ScrollView",
    SectionList: "SectionList",
    FlatList,
    Animated: {
      View: "Animated.View",
      Value,
      createAnimatedComponent: (c) => c,
      spring: () => ({ start() {} }),
      timing: () => ({ start() {} }),
      event: () => () => {},
    },
  };
});
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Icon",
  MaterialCommunityIcons: "Icon",
}));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("../components/PosterActivityBadge", () => ({ MyPosterActivityBadge: () => null }));
jest.mock("../utils/liquidGlass", () => ({ GLASS_PRESS_ROOM: 0 }));
jest.mock("../utils/i18nText", () => ({
  i18nText: (_key, fallback, options) =>
    options && "n" in options ? fallback.replace("{{n}}", options.n) : fallback,
}));

const {
  StatsDateSection,
  StatsPosterCard,
  DAY_PREVIEW_LIMIT,
  DAY_INLINE_LIMIT,
} = require("../components/profile/StatsComponents");

global.IS_REACT_ACT_ENVIRONMENT = true;

const theme = {
  accent: "#3388ff",
  primary: "#111111",
  secondary: "#222222",
  border: "#333333",
  text: { primary: "#ffffff", secondary: "#cccccc", muted: "#999999" },
};

const makePosters = (n) =>
  Array.from({ length: n }, (_, i) => ({
    key: `p${i}`,
    imageUri: `https://img/${i}.jpg`,
    mediaId: i,
    mediaType: "movie",
    minutes: 90,
    onPress: () => {},
  }));

let renderer;
beforeEach(() => {
  mockScrollToOffset.mockClear();
  const original = console.error;
  jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  console.error.mockRestore();
});

const render = (posters) => {
  act(() => {
    renderer = create(
      <StatsDateSection theme={theme} title="2026-10-29" posters={posters} rankColor="#ff8800" />,
    );
  });
};

// memo() sarmalı: test ağacındaki düğümün türü içteki fonksiyondur.
const cardCount = () =>
  renderer.root.findAll((n) => n.type === StatsPosterCard.type).length;
const allText = () =>
  renderer.root
    .findAll((n) => n.type === "Text")
    .map((n) => [].concat(n.props.children).join(""));
const stackButton = () =>
  renderer.root.find(
    (n) => n.type === "TouchableOpacity" && /içerik daha göster$/.test(n.props.accessibilityLabel || ""),
  );
const collapseButton = () =>
  renderer.root.find(
    (n) => n.type === "TouchableOpacity" && allTextOf(n).includes("Daralt"),
  );
const allTextOf = (node) =>
  node.findAll((n) => n.type === "Text").map((n) => [].concat(n.props.children).join(""));

test("gün kartı 4 yuva: 3 afiş + yığın", () => {
  expect(DAY_INLINE_LIMIT).toBe(4);
  expect(DAY_PREVIEW_LIMIT).toBe(3);
});

test("4 ve daha az içerikli gün tüm afişlerini çizer, yığın göstermez", () => {
  render(makePosters(4));
  expect(cardCount()).toBe(4);
  expect(allText().some((t) => t.startsWith("+"))).toBe(false);
});

test("kalabalık gün: 3 afiş + kalanı sayan yığın; basınca açılır, Daralt geri toplar", () => {
  render(makePosters(12));
  expect(cardCount()).toBe(3);
  expect(allText()).toContain("+9");
  expect(stackButton().props.accessibilityLabel).toBe("9 içerik daha göster");

  // Yığın katları gizli kalan afişlerden (4., 5., 6.) gelir — görünenleri tekrarlamaz.
  const stackUris = stackButton()
    .findAll((n) => n.type === "Image")
    .map((n) => n.props.source.uri);
  expect(stackUris.sort()).toEqual(["https://img/3.jpg", "https://img/4.jpg", "https://img/5.jpg"]);

  act(() => stackButton().props.onPress());
  expect(cardCount()).toBe(12);
  expect(allText()).not.toContain("+9");

  act(() => collapseButton().props.onPress());
  expect(mockScrollToOffset).toHaveBeenCalledWith({ offset: 0, animated: false });
  expect(cardCount()).toBe(3);
  expect(allText()).toContain("+9");
});

test("5 içerikte 3 afiş + \"+2\" yığın (yığın tek gizli afiş için açılmaz)", () => {
  render(makePosters(5));
  expect(cardCount()).toBe(3);
  expect(allText()).toContain("+2");
  expect(stackButton().findAll((n) => n.type === "Image")).toHaveLength(2);
});

describe("takvim yaprağı (tarih afişlerin yanında)", () => {
  const leaf = () =>
    renderer.root.find((n) => n.props.accessible && n.props.accessibilityLabel != null && typeof n.type === "string");
  const renderDay = (title, extra = {}) => {
    act(() => {
      renderer = create(
        <StatsDateSection theme={theme} title={title} posters={makePosters(2)} locale="en-US" {...extra} />,
      );
    });
  };

  test("üstte ay adı, ortada gün sayısı ve günün adı, en altta yıl", () => {
    renderDay("2026-10-29", { totalMinutes: 180, posterMinutesLabel: "min", formatDate: () => "29 Oct" });
    expect(allTextOf(leaf())).toEqual(["October", "29", "Thursday", "2026"]);
    expect(leaf().props.accessibilityLabel).toBe("29 Oct");
    expect(cardCount()).toBe(2);
  });

  test("geçen yılların yaprağında da yıl en altta", () => {
    renderDay("2019-03-05");
    expect(allTextOf(leaf())).toEqual(["March", "5", "Tuesday", "2019"]);
  });

  test("tarihsiz grup: yaprakta Eski Kayıtlar, yıl satırı yok", () => {
    renderDay("unknown");
    expect(allTextOf(leaf())).toEqual(["—", "Eski Kayıtlar"]);
  });

  test("onOpenDay verilirse yaprak düğmedir ve günün anahtarını iletir", () => {
    const onOpenDay = jest.fn();
    renderDay("2026-10-29", { onOpenDay });
    expect(leaf().type).toBe("Pressable");
    expect(leaf().props.accessibilityRole).toBe("button");
    act(() => leaf().props.onPress());
    expect(onOpenDay).toHaveBeenCalledWith("2026-10-29");
  });

  test("onOpenDay yoksa yaprak düz görünümdür", () => {
    renderDay("2026-10-29");
    expect(leaf().type).toBe("View");
  });
});
