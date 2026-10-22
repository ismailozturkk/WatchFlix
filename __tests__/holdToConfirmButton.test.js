// HoldToConfirmButton (components/profile/HoldToConfirmButton.js): geri alınamaz
// işlemlerin basılı-tut onayı.
//   • basış başlayınca dolum `holdMs` sürede 1'e gider; dolunca onConfirm BİR kez çalışır
//   • süre dolmadan bırakılırsa onay YOK, çubuk geri çekilir
//   • kısa dokunuş (onPress) onay sayılmaz; basış ön koşulu (canStart) false ise dolum açılmaz
//   • disabled / busy iken basış etkisiz; ekran okuyucu "activate" eylemi doğrudan onaylar
//   • bir kez onaylandıktan sonra ikinci basış yeniden onaylamaz; hata dönüp busy kapanınca yeniden açılır

const mockTimings = [];
jest.mock("react-native", () => {
  class Value {
    constructor(v) { this.v = v; }
    setValue(v) { this.v = v; }
    stopAnimation(cb) { if (cb) cb(this.v); }
    interpolate(config) { return { interpolated: config }; }
  }
  return {
    ActivityIndicator: "ActivityIndicator",
    Pressable: "Pressable",
    Text: "Text",
    View: "View",
    StyleSheet: { create: (s) => s, absoluteFillObject: {} },
    Easing: { linear: () => 0, out: () => () => 0, cubic: () => 0 },
    Animated: {
      Value,
      View: "AnimatedView",
      timing: (value, config) => ({
        start: (cb) => { mockTimings.push({ value, config, cb }); },
      }),
    },
  };
});
const mockHaptic = jest.fn(() => Promise.resolve());
jest.mock("../services/hapticsService", () => ({
  impactAsync: (...args) => mockHaptic(...args),
  ImpactFeedbackStyle: { Heavy: "heavy" },
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("../theme/colors", () => ({ alpha: (c, a) => `${c}@${a}` }));

const React = require("react");
const { act, create } = require("react-test-renderer");
const HoldToConfirmButton = require("../components/profile/HoldToConfirmButton").default;

global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer;
const press = () => renderer.root.findByType("Pressable");
const mount = (props) => {
  act(() => {
    renderer = create(
      React.createElement(HoldToConfirmButton, { label: "Sil", holdLabel: "Tut…", color: "#e11", holdMs: 2000, ...props }),
    );
  });
};
const lastTiming = () => mockTimings[mockTimings.length - 1];
const finish = (finished) => act(() => { lastTiming().cb({ finished }); });

beforeEach(() => {
  jest.useFakeTimers();
  mockTimings.length = 0;
  mockHaptic.mockClear();
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  jest.useRealTimers();
  console.error.mockRestore();
});

describe("basılı tutma", () => {
  it("basış dolumu holdMs sürede 1'e götürür; dolunca onConfirm tam BİR kez çalışır", () => {
    const onConfirm = jest.fn();
    mount({ onConfirm });
    act(() => press().props.onPressIn());
    expect(lastTiming().config).toMatchObject({ toValue: 1, duration: 2000 });
    expect(onConfirm).not.toHaveBeenCalled();
    finish(true);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(mockHaptic).toHaveBeenCalledWith("heavy");
    // Onaydan sonra ikinci basış yeniden onaylamaz.
    const before = mockTimings.length;
    act(() => press().props.onPressIn());
    expect(mockTimings.length).toBe(before);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("süre dolmadan bırakılırsa onay YOK ve çubuk geri çekilir", () => {
    const onConfirm = jest.fn();
    mount({ onConfirm });
    act(() => press().props.onPressIn());
    act(() => press().props.onPressOut());
    // Dolum animasyonu iptal edildi (finished: false) ve geri çekme başladı.
    expect(lastTiming().config.toValue).toBe(0);
    act(() => { mockTimings[0].cb({ finished: false }); });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("bırakıldıktan sonra gelen 'bitti' geri bildirimi bile onaylamaz (yarış)", () => {
    const onConfirm = jest.fn();
    mount({ onConfirm });
    act(() => press().props.onPressIn());
    act(() => press().props.onPressOut());
    act(() => { mockTimings[0].cb({ finished: true }); });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("kısa dokunuş onay sayılmaz: bileşen onPress kullanmaz", () => {
    mount({ onConfirm: jest.fn() });
    expect(press().props.onPress).toBeUndefined();
  });

  it("yarıda bırakıp yeniden basınca kalan orandan devam eder (sıfırdan başlamaz)", () => {
    mount({ onConfirm: jest.fn() });
    act(() => press().props.onPressIn());
    // Parmak kalktığında çubuk 0.5'teydi.
    mockTimings[0].value.v = 0.5;
    act(() => press().props.onPressOut());
    mockTimings[1].value.v = 0.5;
    act(() => press().props.onPressIn());
    expect(lastTiming().config).toMatchObject({ toValue: 1, duration: 1000 });
  });
});

describe("ön koşullar", () => {
  it("canStart false → dolum başlamaz", () => {
    const canStart = jest.fn(() => false);
    mount({ onConfirm: jest.fn(), canStart });
    act(() => press().props.onPressIn());
    expect(canStart).toHaveBeenCalled();
    expect(mockTimings).toHaveLength(0);
  });

  it.each([{ disabled: true }, { busy: true }])("%o iken basış etkisiz", (props) => {
    mount({ onConfirm: jest.fn(), ...props });
    act(() => press().props.onPressIn());
    expect(mockTimings).toHaveLength(0);
  });

  it("busy iken erişilebilirlik durumu meşgul görünür", () => {
    mount({ onConfirm: jest.fn(), busy: true });
    expect(press().props.accessibilityState).toEqual({ disabled: true, busy: true });
  });
});

describe("erişilebilirlik", () => {
  it("'activate' eylemi basılı tutmadan doğrudan onaylar (ekran okuyucu)", () => {
    const onConfirm = jest.fn();
    mount({ onConfirm });
    expect(press().props.accessibilityActions).toEqual([{ name: "activate", label: "Sil" }]);
    act(() => press().props.onAccessibilityAction({ nativeEvent: { actionName: "activate" } }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("'activate' da ön koşuldan geçer", () => {
    const onConfirm = jest.fn();
    mount({ onConfirm, canStart: () => false });
    act(() => press().props.onAccessibilityAction({ nativeEvent: { actionName: "activate" } }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("başka eylem adı yok sayılır", () => {
    const onConfirm = jest.fn();
    mount({ onConfirm });
    act(() => press().props.onAccessibilityAction({ nativeEvent: { actionName: "longpress" } }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe("işlem bitince yeniden açılma", () => {
  it("onConfirm hiç busy açmazsa çubuk dolu kalmaz (700 ms sonra geri çekilir)", () => {
    mount({ onConfirm: jest.fn() });
    act(() => press().props.onPressIn());
    finish(true);
    const before = mockTimings.length;
    act(() => { jest.advanceTimersByTime(800); });
    expect(mockTimings.length).toBe(before + 1);
    expect(lastTiming().config.toValue).toBe(0);
    // Yeniden basılabilir.
    act(() => press().props.onPressIn());
    expect(lastTiming().config.toValue).toBe(1);
  });

  it("busy açılıp kapanırsa (hata ile döndü) düğme yeniden basılabilir olur", () => {
    const onConfirm = jest.fn();
    const render = (busy) => (
      React.createElement(HoldToConfirmButton, { label: "Sil", color: "#e11", holdMs: 2000, onConfirm, busy })
    );
    act(() => { renderer = create(render(false)); });
    act(() => press().props.onPressIn());
    finish(true);
    act(() => renderer.update(render(true)));
    act(() => { jest.advanceTimersByTime(800); });
    const before = mockTimings.length;
    expect(before).toBeGreaterThan(0);
    act(() => renderer.update(render(false)));
    expect(lastTiming().config.toValue).toBe(0); // geri çekildi
    act(() => press().props.onPressIn());
    expect(lastTiming().config.toValue).toBe(1);
  });
});
