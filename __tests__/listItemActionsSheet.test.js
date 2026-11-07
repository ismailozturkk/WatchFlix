// __tests__/listItemActionsSheet.test.js
//
// Liste "İçerik işlemleri" sayfasının AKIŞI (3 Kas yeniden tasarımı): poster kartı + gruplu eylemler,
// taşıma adımı (−/+, hızlı düğmeler, konum çubuğuna dokunma, "N. sıraya taşı"), kaldırma onayı
// (Vazgeç / Kaldır) ve sıralama açıkken kilitli taşıma. Görsel parçalar taklit edilir.

import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, hairlineWidth: 1, flatten: (s) => s },
  View: "View",
  Text: "Text",
  TextInput: "TextInput",
  Pressable: "Pressable",
  ActivityIndicator: "Spinner",
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text", AppTextInput: "TextInput" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("@expo/vector-icons/Feather", () => ({ __esModule: true, default: "Icon" }));
const mockHost = (name) => ({
  __esModule: true,
  default: ({ children, ...props }) => require("react").createElement(name, props, children),
});
jest.mock("../components/common/GlassCloseButton", () => mockHost("CloseButton"));
jest.mock("../components/common/GlassTouchable", () => mockHost("Touch"));
jest.mock("../components/common/GlassBox", () => mockHost("Box"));
jest.mock("../components/PosterImage", () => mockHost("Poster"));
jest.mock("../components/common/BottomSheetModal", () => ({
  __esModule: true,
  default: ({ visible, children }) => (visible ? require("react").createElement("Sheet", null, children) : null),
}));
jest.mock("../services/hapticsService", () => ({ selectionAsync: jest.fn(() => Promise.resolve()) }));
jest.mock("../utils/genreLabels", () => ({ buildGenreMap: () => ({ 18: "Dram", 53: "Gerilim" }) }));
jest.mock("../utils/durationText", () => ({ hoursMinutesText: (m) => `${m} dk` }));
jest.mock("../utils/i18nText", () => ({
  // Eski davranışı taklit eder: cihaz diliyle büyük harf, Türkçe yüzde.
  upperText: (text) => String(text ?? "").toLocaleUpperCase(),
  percentText: (n) => `%${n}`,
  i18nCount: (_key, fallback, n) => String(fallback).replace("{{n}}", String(n)),
  i18nText: (_key, fallback, params = {}) =>
    String(fallback).replace(/\{\{(\w+)\}\}/g, (_, k) => String(params[k] ?? "")),
}));
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: {
      primary: "#111111", secondary: "#1b1b1b", border: "#333333",
      text: { primary: "#ffffff", secondary: "#bbbbbb", muted: "#888888" },
    },
  }),
}));

const ListItemActionsSheet = require("../components/lists/ListItemActionsSheet").default;

global.IS_REACT_ACT_ENVIRONMENT = true;

const item = { id: 7, type: "movie", name: "Film A", minutes: 120, genres: [18, 53], releaseDate: "2019-05-01" };

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

const render = (overrides = {}) => {
  const props = {
    visible: true,
    item,
    currentIndex: 2,
    itemCount: 10,
    accent: "#3388ff",
    onClose: jest.fn(),
    onMove: jest.fn(),
    onDelete: jest.fn(),
    ...overrides,
  };
  act(() => {
    renderer = create(<ListItemActionsSheet {...props} />);
  });
  return props;
};
const texts = () =>
  renderer.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));
const touch = (label) => {
  const found = renderer.root.findAll(
    (n) => n.type === "Touch" && (n.props.accessibilityLabel === label ||
      n.findAllByType("Text").some((t) => [].concat(t.props.children).join("") === label)),
  );
  if (found.length === 0) throw new Error(`düğme yok: ${label}`);
  return found[0];
};
const press = (label) => act(() => touch(label).props.onPress());
const input = () => renderer.root.findByType("TextInput");

test("ilk adım: poster kartı (tür · yıl · süre, türler, sıra) ve iki eylem", () => {
  render();
  const all = texts();
  expect(all).toContain("Film A");
  expect(all).toContain("Film  ·  2019  ·  120 dk");
  expect(all).toContain("Dram, Gerilim");
  expect(all).toContain("Mevcut sıra: 3/10");
  expect(touch("Sırayı değiştir").props.disabled).toBe(false);
  expect(touch("Listeden kaldır").props.disabled).toBe(false);
});

test("sıralama açıkken taşıma kilitli ve ipucu gösterilir", () => {
  render({ canMove: false, moveDisabledHint: "Önce Liste sırası" });
  expect(touch("Sırayı değiştir").props.disabled).toBe(true);
  expect(texts()).toContain("Önce Liste sırası");
});

test("taşıma: −/+ ve hızlı düğmeler hedefi değiştirir; düğme hedef sırayı söyler", () => {
  const props = render();
  press("Sırayı değiştir");
  expect(input().props.value).toBe("3");
  // Hedef = mevcut: taşı kapalı.
  expect(touch("Taşı").props.disabled).toBe(true);
  press("Bir yukarı");
  expect(input().props.value).toBe("2");
  expect(texts()).toContain("3. sıradan 2. sıraya");
  press("İlk sıra");
  expect(input().props.value).toBe("1");
  // İlk sıradayken yukarı düğmeleri kapalı.
  expect(touch("Bir yukarı").props.disabled).toBe(true);
  press("Son sıra");
  expect(input().props.value).toBe("10");
  press("10. sıraya taşı");
  expect(props.onMove).toHaveBeenCalledWith(9);
});

test("konum çubuğuna dokunmak hedefi o noktaya taşır", () => {
  render();
  press("Sırayı değiştir");
  const track = renderer.root.findAll((n) => n.type === "Pressable" && n.props.onLayout)[0];
  act(() => track.props.onLayout({ nativeEvent: { layout: { width: 300 } } }));
  act(() => track.props.onPress({ nativeEvent: { locationX: 150 } }));
  // 10 öğe → 9 aralık; ortası 5.5 → 6 (yuvarlama).
  expect(input().props.value).toBe("6");
});

test("elle yazılan geçersiz sıra taşımayı kapatır", () => {
  render();
  press("Sırayı değiştir");
  act(() => input().props.onChangeText("42"));
  expect(touch("Taşı").props.disabled).toBe(true);
  act(() => input().props.onChangeText("7a"));
  expect(input().props.value).toBe("7");
  expect(touch("7. sıraya taşı").props.disabled).toBe(false);
});

test("kaldırma: onay kartı; Vazgeç geri döner, Kaldır bildirir", () => {
  const props = render();
  press("Listeden kaldır");
  expect(texts()).toContain('"Film A" listeden kaldırılsın mı?');
  press("Vazgeç");
  expect(texts()).toContain("Mevcut sıra: 3/10");
  press("Listeden kaldır");
  press("Kaldır");
  expect(props.onDelete).toHaveBeenCalledTimes(1);
});

test("yeni metinler beş dilde var", () => {
  for (const lang of ["tr", "en", "es", "pt", "de"]) {
    const t = require(`../translations/${lang}.json`).autoI18n;
    for (const key of ["bir_yukari", "bir_asagi", "siraya_tasi", "siradan_siraya"]) {
      expect(t[key]).toBeTruthy();
    }
    expect(t.siraya_tasi).toContain("{{n}}");
    expect(t.siradan_siraya).toMatch(/\{\{from\}\}[\s\S]*\{\{to\}\}/);
  }
});
