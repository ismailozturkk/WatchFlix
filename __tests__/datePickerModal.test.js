// __tests__/datePickerModal.test.js
//
// Ortak tarih seçicinin AKIŞI (saf takvim hesabı __tests__/datePickerCalendar.test.js'te):
// gün / ay / yıl dokunuşları, ok ve yatay kaydırma yalnız sayfayı değiştirir, sınır dışı
// dokunuş uyarı verir ama seçimi değiştirmez, ay/yıl değişince gün korunur ya da sınıra
// çekilir, açıkken gelen render'lar seçimi SIFIRLAMAZ (eski çarkın "geri sekme" sınıfı),
// onay son seçimi verir. Görsel parçalar (alt sayfa kabuğu, cam düğme, simgeler) taklit edilir.

import React from "react";
import { act, create } from "react-test-renderer";

let mockPanConfig = null;
jest.mock("react-native", () => {
  const mockReact = require("react");
  class Value {
    constructor(v) { this.v = v; }
    setValue(v) { this.v = v; }
    stopAnimation() {}
    interpolate() { return {}; }
  }
  const anim = () => ({ start: (cb) => cb && cb({ finished: true }), stop() {} });
  const Pressable = ({ children, style, ...props }) =>
    mockReact.createElement(
      "Pressable",
      { ...props, style: typeof style === "function" ? style({ pressed: false }) : style },
      typeof children === "function" ? children({ pressed: false }) : children,
    );
  const FlatList = ({ data, renderItem, keyExtractor, initialScrollIndex }) =>
    mockReact.createElement(
      "FlatList",
      { initialScrollIndex },
      data.map((item, index) =>
        mockReact.createElement(mockReact.Fragment, { key: keyExtractor(item, index) }, renderItem({ item, index })),
      ),
    );
  return {
    StyleSheet: { create: (s) => s, absoluteFill: {}, absoluteFillObject: {}, hairlineWidth: 1, flatten: (s) => s },
    View: "View",
    Text: "Text",
    Pressable,
    TouchableOpacity: "TouchableOpacity",
    FlatList,
    Easing: { out: (f) => f, cubic: (t) => t },
    PanResponder: {
      create: (config) => {
        mockPanConfig = config;
        return { panHandlers: {} };
      },
    },
    useWindowDimensions: () => ({ width: 390, height: 844 }),
    Animated: { View: "AnimatedView", Value, timing: anim, spring: anim },
  };
});
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 34 }) }));
jest.mock("../components/common/GlassCloseButton", () => ({
  __esModule: true,
  default: (props) => require("react").createElement("CloseButton", props),
}));
jest.mock("../components/common/BottomSheetModal", () => ({
  __esModule: true,
  default: (props) => (props.visible ? require("react").createElement("Sheet", null, props.children) : null),
}));
const mockTheme = {
  primary: "#111111", secondary: "#1b1b1b", between: "#222222", border: "#333333", accent: "#3388ff",
  text: { primary: "#ffffff", secondary: "#bbbbbb", muted: "#888888" },
  colors: { red: "#ff3232" },
};
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
let mockLanguage = "tr";
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: mockLanguage }) }));
jest.mock("../utils/i18nText", () => ({ i18nText: (key, fallback) => fallback }));
let mockReduce = false;
jest.mock("../hooks/useReduceMotion", () => ({ __esModule: true, default: () => mockReduce }));

const DatePickerModal = require("../components/modals/DatePickerModal").default;

global.IS_REACT_ACT_ENVIRONMENT = true;
const realError = console.error;
beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation((...args) => {
    if (String(args[0]).includes("react-test-renderer is deprecated")) return;
    realError(...args);
  });
});
afterAll(() => console.error.mockRestore());

beforeEach(() => {
  jest.useFakeTimers();
  // Bugün: 23 Ekim 2026 Cuma.
  jest.setSystemTime(new Date(2026, 9, 23, 12, 0, 0));
  mockLanguage = "tr";
  mockReduce = false;
  mockPanConfig = null;
});
afterEach(() => {
  jest.useRealTimers();
});

function open(props) {
  let renderer;
  const onConfirm = jest.fn();
  const onClose = jest.fn();
  const element = (extra = {}) => (
    <DatePickerModal visible onConfirm={onConfirm} onClose={onClose} {...props} {...extra} />
  );
  act(() => {
    renderer = create(element());
  });
  const texts = () =>
    renderer.root
      .findAll((n) => n.type === "Text")
      .map((n) => [].concat(n.props.children).join(""));
  const pressables = () => renderer.root.findAll((n) => n.type === "Pressable");
  const byLabel = (label) => {
    const found = pressables().filter((n) => n.props.accessibilityLabel === label);
    if (found.length !== 1) throw new Error(`"${label}" için ${found.length} düğme`);
    return found[0];
  };
  const byLabelStart = (prefix) => {
    const found = pressables().filter((n) => String(n.props.accessibilityLabel || "").startsWith(prefix));
    if (found.length !== 1) throw new Error(`"${prefix}…" için ${found.length} düğme`);
    return found[0];
  };
  const byText = (label) => {
    const found = pressables().filter((p) =>
      p.findAll((n) => n.type === "Text").some((t) => [].concat(t.props.children).join("") === label),
    );
    if (found.length !== 1) throw new Error(`"${label}" yazılı ${found.length} düğme`);
    return found[0];
  };
  const press = (node) => act(() => node.props.onPress());
  const header = () =>
    renderer.root.find((n) => n.type === "View" && n.props.accessibilityRole === "header").props.accessibilityLabel;
  const rerender = (extra) => act(() => renderer.update(element(extra)));
  return { renderer, onConfirm, onClose, texts, byLabel, byLabelStart, byText, press, header, rerender };
}

describe("DatePickerModal — gün takvimi", () => {
  test("değerin ayında açılır; başlık seçili tarihi ve gününü gösterir", () => {
    const ui = open({ value: "2024-03-05", title: "İzleme Tarihi" });
    expect(ui.header()).toBe("İzleme Tarihi: 5 Mart 2024, Salı");
    expect(ui.texts()).toContain("Mart 2024");
    // Türkçe hafta Pazartesi başlar.
    const head = ui.texts();
    expect(head.indexOf("Pzt")).toBeLessThan(head.indexOf("Paz"));
  });

  test("güne dokunmak seçer; onay son seçimi ISO olarak verir", () => {
    const ui = open({ value: "2024-03-05" });
    ui.press(ui.byLabel("12 Mart 2024, Salı"));
    expect(ui.header()).toContain("12 Mart 2024");
    const day = ui.byLabel("12 Mart 2024, Salı");
    expect(day.props.accessibilityState).toEqual({ selected: true, disabled: false });
    ui.press(ui.byLabelStart("Tarihi Onayla"));
    expect(ui.onConfirm).toHaveBeenCalledWith("2024-03-12");
  });

  test("art arda onay çift kayıt üretmez", () => {
    const ui = open({ value: "2024-03-05" });
    const confirm = ui.byLabelStart("Tarihi Onayla");
    ui.press(confirm);
    ui.press(confirm);
    expect(ui.onConfirm).toHaveBeenCalledTimes(1);
  });

  test("ok ve yatay kaydırma yalnız SAYFAYI değiştirir, seçim yerinde kalır", () => {
    const ui = open({ value: "2024-03-05" });
    ui.press(ui.byLabel("Sonraki ay"));
    expect(ui.texts()).toContain("Nisan 2024");
    expect(ui.header()).toContain("5 Mart 2024");

    act(() => mockPanConfig.onPanResponderRelease({}, { dx: -90, vx: -0.5 }));
    expect(ui.texts()).toContain("Mayıs 2024");
    act(() => mockPanConfig.onPanResponderRelease({}, { dx: 90, vx: 0.5 }));
    act(() => mockPanConfig.onPanResponderRelease({}, { dx: 90, vx: 0.5 }));
    expect(ui.texts()).toContain("Mart 2024");
    // Kısa / yavaş sürükleme sayfa değiştirmez.
    act(() => mockPanConfig.onPanResponderRelease({}, { dx: -20, vx: -0.1 }));
    expect(ui.texts()).toContain("Mart 2024");
    // Dikey ağırlıklı hareketi devralmaz (dokunuş ve dikey kaydırma hücrelere kalır).
    expect(mockPanConfig.onMoveShouldSetPanResponderCapture({}, { dx: 20, dy: 30 })).toBe(false);
    expect(mockPanConfig.onMoveShouldSetPanResponderCapture({}, { dx: 30, dy: 4 })).toBe(true);
  });

  test("sınır dışı güne dokunmak seçimi DEĞİŞTİRMEZ, uyarı gösterir; uyarı kendiliğinden kalkar", () => {
    const ui = open({ value: "2026-10-23", maxDate: new Date(), subtitle: "Bu filmi ne zaman izlediniz?" });
    const future = ui.byLabel("24 Ekim 2026, Cumartesi");
    expect(future.props.accessibilityState).toEqual({ selected: false, disabled: true });
    ui.press(future);
    expect(ui.header()).toContain("23 Ekim 2026");
    expect(ui.texts()).toContain("Gelecek bir tarih seçilemez");
    expect(ui.texts()).not.toContain("Bu filmi ne zaman izlediniz?");
    act(() => jest.advanceTimersByTime(3000));
    expect(ui.texts()).not.toContain("Gelecek bir tarih seçilemez");
    expect(ui.texts()).toContain("Bu filmi ne zaman izlediniz?");
  });

  test("tamamen kapalı aya geçilemez (ok pasif, kaydırma etkisiz)", () => {
    const ui = open({ value: "2026-10-23", maxDate: new Date() });
    const next = ui.byLabel("Sonraki ay");
    expect(next.props.disabled).toBe(true);
    act(() => mockPanConfig.onPanResponderRelease({}, { dx: -90, vx: -0.5 }));
    expect(ui.texts()).toContain("Ekim 2026");
  });

  test("hızlı seçimler: sınır dışı olan çıkmaz, dokununca seçer ve o aya gider", () => {
    const ui = open({ value: "2026-08-01", maxDate: new Date() });
    expect(ui.texts()).toEqual(expect.arrayContaining(["Dün", "Bugün"]));
    expect(ui.texts()).not.toContain("Yarın");
    ui.press(ui.byText("Dün"));
    expect(ui.header()).toContain("22 Ekim 2026");
    expect(ui.texts()).toContain("Ekim 2026");
    expect(ui.byText("Dün").props.accessibilityState).toEqual({ selected: true });
  });

  test("hızlı seçim kapalıysa (doğum tarihi) çip yok", () => {
    const ui = open({ value: "2000-01-01", quickActions: false });
    expect(ui.texts()).not.toContain("Bugün");
  });

  test("İngilizce hafta Pazar başlar ve ABD tarih biçimi kullanılır", () => {
    mockLanguage = "en";
    const ui = open({ value: "2024-03-05", title: "Watch date" });
    const head = ui.texts();
    expect(head.indexOf("Sun")).toBeLessThan(head.indexOf("Mon"));
    expect(ui.header()).toBe("Watch date: March 5, 2024, Tuesday");
  });
});

describe("DatePickerModal — ay ve yıl ızgarası", () => {
  test("başlık → ay ızgarası; aya dokunmak seçer (gün korunur) ve takvime döner", () => {
    const ui = open({ value: "2024-01-31" });
    ui.press(ui.byLabelStart("Ocak 2024"));
    expect(ui.texts()).toContain("2024");
    ui.press(ui.byLabel("Şubat"));
    // 31 Şubat yok: ayın son gününe düşer, uyarı YOK (sınır değil).
    expect(ui.header()).toContain("29 Şubat 2024");
    expect(ui.texts()).toContain("Şubat 2024");
    expect(ui.texts()).not.toContain("Gelecek bir tarih seçilemez");
  });

  test("ay ızgarasında oklar yılı değiştirir; tamamı kapalı ay soluk ve seçilmez", () => {
    const ui = open({ value: "2026-10-23", maxDate: new Date() });
    ui.press(ui.byLabelStart("Ekim 2026"));
    const kasim = ui.byLabel("Kasım");
    expect(kasim.props.accessibilityState).toEqual({ selected: false, disabled: true });
    ui.press(kasim);
    expect(ui.header()).toContain("23 Ekim 2026");
    expect(ui.texts()).toContain("Gelecek bir tarih seçilemez");
    expect(ui.byLabel("Sonraki yıl").props.disabled).toBe(true);

    ui.press(ui.byLabel("Önceki yıl"));
    expect(ui.texts()).toContain("2025");
    // Seçim yalnız aya dokununca değişir.
    expect(ui.header()).toContain("23 Ekim 2026");
    ui.press(ui.byLabel("Aralık"));
    expect(ui.header()).toContain("23 Aralık 2025");
    expect(ui.texts()).toContain("Aralık 2025");
  });

  test("yıl ızgarası: seçili yıla yakın açılır; yıla dokunmak seçer ve ay ızgarasına geçer", () => {
    const ui = open({ value: "2024-03-05" });
    ui.press(ui.byLabelStart("Mart 2024"));
    ui.press(ui.byLabelStart("2024,"));
    const list = ui.renderer.root.find((n) => n.type === "FlatList");
    // 1926…2036, 4 sütun: 2024 satırı 24; ilk konum ona yakın (ortalanmış).
    expect(list.props.initialScrollIndex).toBeGreaterThan(18);
    expect(list.props.initialScrollIndex).toBeLessThanOrEqual(24);

    ui.press(ui.byLabel("1998"));
    expect(ui.header()).toContain("5 Mart 1998");
    expect(ui.texts()).toContain("1998");
    expect(ui.renderer.root.findAll((n) => n.type === "FlatList")).toHaveLength(0);
  });

  test("yıl seçimi sınırı aşarsa en yakın geçerli tarihe çekilir ve uyarı verir", () => {
    const ui = open({ value: "2025-12-15", maxDate: new Date() });
    ui.press(ui.byLabelStart("Aralık 2025"));
    ui.press(ui.byLabelStart("2025,"));
    ui.press(ui.byLabel("2026"));
    expect(ui.header()).toContain("23 Ekim 2026");
    expect(ui.texts()).toContain("Gelecek bir tarih seçilemez");
  });

  test("doğum tarihi: yıl ızgarasıyla açılır; yıl → ay → gün", () => {
    const ui = open({
      value: "2006-01-01",
      initialView: "years",
      quickActions: false,
      minDate: new Date(1906, 0, 1),
      maxDate: new Date(),
    });
    expect(ui.renderer.root.findAll((n) => n.type === "FlatList")).toHaveLength(1);
    ui.press(ui.byLabel("1998"));
    ui.press(ui.byLabel("Mart"));
    ui.press(ui.byLabel("5 Mart 1998, Perşembe"));
    ui.press(ui.byLabelStart("Tarihi Onayla"));
    expect(ui.onConfirm).toHaveBeenCalledWith("1998-03-05");
  });
});

describe("DatePickerModal — kararlılık", () => {
  test("açıkken gelen render'lar (yeni Date nesneleri, aynı değer) seçimi ve sayfayı SIFIRLAMAZ", () => {
    const ui = open({ value: "2026-10-23", maxDate: new Date() });
    ui.press(ui.byLabel("Önceki ay"));
    ui.press(ui.byLabel("12 Eylül 2026, Cumartesi"));
    // ListsScreen gibi çağıranlar her render'da `maxDate={new Date()}` verir.
    ui.rerender({ maxDate: new Date() });
    ui.rerender({ maxDate: new Date(), subtitle: "x" });
    expect(ui.header()).toContain("12 Eylül 2026");
    expect(ui.texts()).toContain("Eylül 2026");
  });

  test("kapatıp açınca değer yeniden okunur", () => {
    const ui = open({ value: "2024-03-05" });
    ui.press(ui.byLabel("12 Mart 2024, Salı"));
    ui.rerender({ visible: false });
    ui.rerender({ visible: true, value: "2023-07-09" });
    expect(ui.header()).toContain("9 Temmuz 2023");
  });

  test("geçersiz değer bugüne düşer; aralık dışı değer sınıra çekilir", () => {
    expect(open({ value: "2023-02-30" }).header()).toContain("23 Ekim 2026");
    expect(open({ value: "2030-01-01", maxDate: new Date() }).header()).toContain("23 Ekim 2026");
    expect(open({ value: "2020-01-01", minDate: "2024-06-01" }).header()).toContain("1 Haziran 2024");
  });

  test("'Hareketi azalt' açıkken de akış aynı", () => {
    mockReduce = true;
    const ui = open({ value: "2024-03-05" });
    ui.press(ui.byLabel("Sonraki ay"));
    ui.press(ui.byLabel("9 Nisan 2024, Salı"));
    expect(ui.header()).toContain("9 Nisan 2024");
  });
});
