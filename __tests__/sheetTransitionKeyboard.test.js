import React from "react";
import { act, create } from "react-test-renderer";
import useSheetTransition from "../hooks/useSheetTransition";
import useKeyboardMetrics from "../hooks/useKeyboardMetrics";

// Klavye açıkken kapanan alt sayfa, klavyesi inmiş ekranda klavye açıkmış gibi
// KISA ve YÜKSEKTE kalıp (yarım yükseklikte asılı) hareket bitince birden
// kayboluyordu. Kökler (ayrıntı: hooks/useSheetTransition.js başındaki "KAPANIŞ"):
//   • çıkış mesafesi yalnız sayfa boyuydu, sayfanın klavye yüzünden yukarıda
//     durduğu `lift` payı eklenmiyordu;
//   • klavye kapanışla birlikte inince sayfa çıkışın ortasında yeniden büyüyüp
//     yerinden oynuyordu (`fit` bütçesi ve yükselme canlı kalıyordu);
//   • klavye geometrisi pencere kalkınca sıfırlanmıyordu.
// Burada Animated/Keyboard/Dimensions sahte; gerçek çizim cihazda doğrulanır.

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockAnimLog = [];
const mockSetLog = [];
const mockFinishers = [];
const mockHandlers = {};
const mockSeq = { n: 0 };

jest.mock("react-native", () => {
  class Value {
    constructor(initial) {
      mockSeq.n += 1;
      this.id = mockSeq.n;
      this.value = initial;
    }
    setValue(next) {
      this.value = next;
      mockSetLog.push({ id: this.id, value: next });
    }
  }
  const makeAnim = (kind) => (value, config) => ({
    start: () => mockAnimLog.push({ kind, id: value.id, toValue: config.toValue }),
    stop: () => {},
  });
  const flatten = (style) =>
    Array.isArray(style)
      ? style.reduce((acc, item) => ({ ...acc, ...flatten(item) }), {})
      : style || {};
  return {
    Animated: {
      Value,
      subtract: (a, b) => ({ a, b }),
      timing: makeAnim("timing"),
      spring: makeAnim("spring"),
      parallel: (animations) => ({
        start: (callback) => {
          animations.forEach((animation) => animation.start());
          if (callback) mockFinishers.push(callback);
        },
        stop: () => animations.forEach((animation) => animation.stop()),
      }),
    },
    Easing: { in: (fn) => fn, out: (fn) => fn, ease: (t) => t },
    Dimensions: { get: () => ({ width: 390, height: 800 }) },
    Keyboard: {
      addListener: (name, handler) => {
        (mockHandlers[name] = mockHandlers[name] || []).push(handler);
        return {
          remove: () => {
            mockHandlers[name] = (mockHandlers[name] || []).filter((h) => h !== handler);
          },
        };
      },
    },
    Platform: { OS: "ios" },
    StatusBar: { currentHeight: 24 },
    StyleSheet: { flatten },
  };
});

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  return {
    SafeAreaInsetsContext: React.createContext({ top: 50, bottom: 34, left: 0, right: 0 }),
  };
});

const SHEET_ID = 2; // backdropOpacity=1, translateY=2, keyboardShift=3 (oluşturma sırası)
const SHIFT_ID = 3;

const layout = (height) => ({ nativeEvent: { layout: { height } } });
const emit = (name, payload) => {
  act(() => {
    (mockHandlers[name] || []).forEach((handler) => handler(payload));
  });
};
// 800 yüksekliğinde pencerede 336 yüksekliğinde klavye: screenY = 800 − 336.
const showKeyboard = (height = 336) =>
  emit("keyboardWillChangeFrame", { endCoordinates: { screenY: 800 - height, height } });
const hideKeyboard = () => emit("keyboardWillHide", {});

function renderSheet(options) {
  const state = { sheet: null };
  const Probe = ({ visible }) => {
    state.sheet = useSheetTransition(visible, options);
    return null;
  };
  let renderer;
  act(() => {
    renderer = create(<Probe visible={false} />);
  });
  return {
    state,
    setVisible: (visible) => act(() => renderer.update(<Probe visible={visible} />)),
    unmount: () => act(() => renderer.unmount()),
  };
}

const lastTiming = (id) =>
  [...mockAnimLog].reverse().find((entry) => entry.kind === "timing" && entry.id === id);

beforeEach(() => {
  mockAnimLog.length = 0;
  mockSetLog.length = 0;
  mockFinishers.length = 0;
  Object.keys(mockHandlers).forEach((key) => delete mockHandlers[key]);
  mockSeq.n = 0;
});

function openWithKeyboard() {
  const ctx = renderSheet();
  ctx.setVisible(true);
  act(() => {
    ctx.state.sheet.onOverlayLayout(layout(800));
    ctx.state.sheet.onSheetLayout(layout(520));
  });
  showKeyboard();
  // Klavye açıkken `fit` sayfayı kısar; ölçü artık kısılmış boy.
  act(() => ctx.state.sheet.onSheetLayout(layout(406)));
  return ctx;
}

describe("useSheetTransition — klavye ile kapanış", () => {
  it("klavye açıkken sayfa yükselir ve bütçeye kısılır", () => {
    const ctx = openWithKeyboard();
    expect(lastTiming(SHIFT_ID).toValue).toBe(336);
    // 800 − 336 − (üst güvenli alan 50 + pay 8)
    const [, overrides] = ctx.state.sheet.fit({ maxHeight: "88%" });
    expect(overrides.maxHeight).toBe(406);
  });

  it("kapanış mesafesi sayfa boyu + klavye yükselmesidir (ekranda asılı kalmaz)", () => {
    const ctx = openWithKeyboard();
    ctx.setVisible(false);
    // Doğal boy 520 (klavye açıkken ölçülen 406 onu küçültmez) + yükselme 336.
    expect(lastTiming(SHEET_ID).toValue).toBe(856);
  });

  it("klavye kapanışla birlikte inse bile sayfa çıkışta yeniden büyümez/oynamaz", () => {
    const ctx = openWithKeyboard();
    const shiftTimingsBefore = mockAnimLog.filter((e) => e.id === SHIFT_ID).length;
    ctx.setVisible(false);
    const exitTarget = lastTiming(SHEET_ID).toValue;

    hideKeyboard();
    emit("keyboardDidHide", {});

    // Yükseklik sınırı donuk: sayfa klavyesiz doğal boyuna açılmaz.
    const [, overrides] = ctx.state.sheet.fit({ maxHeight: "88%" });
    expect(overrides.maxHeight).toBe(406);
    // Yükselme çıkış sırasında yeniden animasyonlanmaz.
    expect(mockAnimLog.filter((e) => e.id === SHIFT_ID).length).toBe(shiftTimingsBefore);
    // Çıkış hedefi değişmez.
    expect(lastTiming(SHEET_ID).toValue).toBe(exitTarget);
  });

  it("kapanırken gelen ölçüm doğal boyu küçültmez", () => {
    const ctx = openWithKeyboard();
    ctx.setVisible(false);
    hideKeyboard();
    act(() => ctx.state.sheet.onSheetLayout(layout(406)));

    // Sonraki açılışın başlangıç mesafesi de doğal boy olmalı.
    act(() => mockFinishers.pop()({ finished: true }));
    ctx.setVisible(true);
    const entrance = mockSetLog.filter((e) => e.id === SHEET_ID).pop();
    expect(entrance.value).toBe(520);
  });

  it("pencere kalkınca klavye durumu, sınır ve yükselme sıfırlanır", () => {
    const ctx = openWithKeyboard();
    ctx.setVisible(false);
    act(() => mockFinishers.pop()({ finished: true }));

    expect(ctx.state.sheet.mounted).toBe(false);
    // Yükselme animasyonsuz 0'a çekilir.
    expect(mockSetLog.filter((e) => e.id === SHIFT_ID).pop().value).toBe(0);
    // Klavye olayları artık dinlenmiyor.
    expect((mockHandlers.keyboardWillChangeFrame || []).length).toBe(0);
    // Sınır yok: stil aynen döner.
    const style = { maxHeight: "88%" };
    expect(ctx.state.sheet.fit(style)).toBe(style);
  });

  it("yeniden açılış önceki oturumun klavyesiyle başlamaz", () => {
    const ctx = openWithKeyboard();
    ctx.setVisible(false);
    act(() => mockFinishers.pop()({ finished: true }));

    ctx.setVisible(true);
    const style = { maxHeight: "88%" };
    expect(ctx.state.sheet.fit(style)).toBe(style);
    expect(lastTiming(SHIFT_ID).toValue).toBe(0);
  });

  it("klavye açılmadan kapanan sayfa yalnız kendi boyu kadar iner", () => {
    const ctx = renderSheet();
    ctx.setVisible(true);
    act(() => ctx.state.sheet.onSheetLayout(layout(520)));
    ctx.setVisible(false);
    expect(lastTiming(SHEET_ID).toValue).toBe(520);
  });

  it("klavye açıkken kapanıştan vazgeçilirse yükselme güncel klavyeye döner", () => {
    const ctx = openWithKeyboard();
    ctx.setVisible(false);
    hideKeyboard();
    ctx.setVisible(true);
    expect(lastTiming(SHIFT_ID).toValue).toBe(0);
  });

  it("klavye boyu açıkken değişirse (emoji paneli) sayfa yeni boya uyar", () => {
    const ctx = openWithKeyboard();
    showKeyboard(420);
    expect(lastTiming(SHIFT_ID).toValue).toBe(420);
    const [, overrides] = ctx.state.sheet.fit({ maxHeight: "88%" });
    expect(overrides.maxHeight).toBe(800 - 420 - 58);
  });

  it("klavye ekranın altına inerse (hide olayı kaçsa bile) yükselme sıfırlanır", () => {
    const ctx = openWithKeyboard();
    // Yalnız çerçeve olayı: ekran dışına inen klavye = örtüşme yok.
    emit("keyboardWillChangeFrame", { endCoordinates: { screenY: 800, height: 336 } });
    expect(lastTiming(SHIFT_ID).toValue).toBe(0);
    const style = { maxHeight: "88%" };
    expect(ctx.state.sheet.fit(style)).toBe(style);
  });

  it("liftWithKeyboard=false klavye olaylarını dinlemez", () => {
    const ctx = renderSheet({ liftWithKeyboard: false });
    ctx.setVisible(true);
    expect((mockHandlers.keyboardWillChangeFrame || []).length).toBe(0);
    showKeyboard();
    const style = { maxHeight: "88%" };
    expect(ctx.state.sheet.fit(style)).toBe(style);
  });
});

describe("useKeyboardMetrics — kaplayıcı tabanı", () => {
  function renderMetrics(initialActive = true) {
    const state = { metrics: null };
    const Probe = ({ active }) => {
      state.metrics = useKeyboardMetrics(active);
      return null;
    };
    let renderer;
    act(() => {
      renderer = create(<Probe active={initialActive} />);
    });
    return { state, setActive: (active) => act(() => renderer.update(<Probe active={active} />)) };
  }

  it("daralmış ölçü, klavye olayından ÖNCE gelse de tabanı küçültmez", () => {
    const ctx = renderMetrics();
    act(() => ctx.state.metrics.onOverlayLayout(layout(800)));
    // Android'de pencere daraldı, olay henüz gelmedi (klavye "kapalı" görünüyor).
    act(() => ctx.state.metrics.onOverlayLayout(layout(500)));
    expect(ctx.state.metrics.baseOverlayHeight).toBe(800);
  });

  it("pasifleşince ölçüm ve klavye sıfırlanır", () => {
    const ctx = renderMetrics();
    act(() => ctx.state.metrics.onOverlayLayout(layout(800)));
    showKeyboard();
    expect(ctx.state.metrics.keyboardHeight).toBe(336);

    ctx.setActive(false);
    expect(ctx.state.metrics.keyboardHeight).toBe(0);
    expect(ctx.state.metrics.overlayHeight).toBe(0);
    expect(ctx.state.metrics.baseOverlayHeight).toBe(0);
  });
});
