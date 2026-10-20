// Toast arayüzü: kartlar (ToastCards), kabuk (ToastItem) ve host (ToastHost).
//
// Gerçek hareket / yerleşim cihazda doğrulanır; burada kilitlenen DAVRANIŞ:
//   • eylem düğmesi ("Geri Al") varken kapat çarpısının yerini alır; basınca toast kapanır
//     ve eylem çalışır; karta dokunmak yalnız kapatır (eylemi çalıştırmaz)
//   • yalnız etkin host çizer; modal host'u kayıt bırakınca toast köke devredilir
//   • parmak kartın üstündeyken süre durur, bırakınca sürer; yukarı/yana kaydırınca kapanır
//   • rozet kartı rozeti, ipucunu ve +N'yi çizer
//   • "Hareketi Azalt" açıkken yaylanma/titreme/kıvılcım animasyonu başlamaz
import React from "react";
import { act, create } from "react-test-renderer";

global.IS_REACT_ACT_ENVIRONMENT = true;

let mockReduceMotion = false;
const mockTheme = {
  primary: "#000000",
  secondary: "#15171C",
  accent: "#3B82F6",
  bold: "#2563EB",
  border: "#262A31",
  text: { primary: "#F5F6F8", secondary: "#C9CDD4" },
};

jest.mock("react-native", () => {
  const React = require("react");
  const resolve = (style, state) => (typeof style === "function" ? style(state) : style);
  return {
    View: "View",
    Text: "Text",
    Pressable: ({ style, children, ...rest }) =>
      React.createElement("Pressable", { ...rest, style: resolve(style, { pressed: false }) }, children),
    StyleSheet: {
      create: (styles) => styles,
      flatten: (style) => style,
      absoluteFill: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
      absoluteFillObject: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
    },
  };
});
// Derleme eklentisi (scripts/babel-transform-app-text.js) `Text`'i AppText'e çevirir.
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));

jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const AnimatedView = React.forwardRef(({ children, ...rest }, ref) =>
    React.createElement("AnimatedView", { ...rest, ref }, children),
  );
  const chain = () => {
    const builder = { duration: () => builder, springify: () => builder, damping: () => builder, stiffness: () => builder };
    return builder;
  };
  const wrap = (v) => v;
  // Bitiş geri çağrısı verilmişse animasyon anında 'bitti' sayılır (kapanış JS'e döner).
  const timing = (value, _config, callback) => {
    if (typeof callback === 'function') callback(true);
    return value;
  };
  return {
    __esModule: true,
    default: { View: AnimatedView, createAnimatedComponent: (c) => c },
    Easing: {
      linear: "linear",
      quad: "quad",
      cubic: "cubic",
      in: (e) => e,
      out: (e) => e,
      inOut: (e) => e,
    },
    Extrapolation: { CLAMP: "clamp" },
    FadeIn: chain(),
    FadeOut: chain(),
    ZoomIn: chain(),
    interpolate: (value, input, output) => output[0],
    useAnimatedStyle: (updater) => updater(),
    useAnimatedProps: (updater) => updater(),
    useSharedValue: (value) => ({ value }),
    withTiming: timing,
    withSpring: wrap,
    withDelay: (_d, v) => v,
    withRepeat: wrap,
    withSequence: (...values) => values[values.length - 1],
    cancelAnimation: jest.fn(),
    runOnJS: (fn) => fn,
  };
});

// Tutamaç kayıtlı: test, Pan'ın geri çağrılarını doğrudan çağırır.
jest.mock("react-native-gesture-handler", () => {
  const React = require("react");
  const makePan = () => {
    const pan = { handlers: {}, enabledValue: true };
    ["activeOffsetX", "activeOffsetY"].forEach((name) => {
      pan[name] = () => pan;
    });
    pan.enabled = (value) => {
      pan.enabledValue = value;
      return pan;
    };
    ["onBegin", "onUpdate", "onEnd", "onFinalize"].forEach((name) => {
      pan[name] = (fn) => {
        pan.handlers[name] = fn;
        return pan;
      };
    });
    return pan;
  };
  return {
    Gesture: { Pan: makePan },
    GestureDetector: ({ gesture, children }) => React.createElement("Detector", { gesture }, children),
    GestureHandlerRootView: ({ children, ...rest }) => React.createElement("GHRoot", rest, children),
  };
});

jest.mock("react-native-svg", () => ({
  __esModule: true,
  default: "Svg",
  Svg: "Svg",
  Circle: "Circle",
  Path: "Path",
}));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Ionicons" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock("../hooks/useReduceMotion", () => ({ __esModule: true, default: () => mockReduceMotion }));
jest.mock("../utils/i18nText", () => ({ i18nText: (_key, fallback) => fallback }));
jest.mock("../components/badges/AppBadge", () => ({ __esModule: true, default: "AppBadge" }));
jest.mock("../theme/badgeTokens", () => ({
  kademeRengi: () => "#C0A060",
  kademeSekli: () => ({ kademe: 3, kenar: 6, ornate: false }),
  rarityStyle: () => ({ color: "#A855F7" }),
}));

const { toastStore } = require("../utils/toastStore");
const ToastHost = require("../components/toast/ToastHost").default;
const { StatusCard, BadgeCard } = require("../components/toast/ToastCards");
const { paletteFor, paletteFromAccent } = require("../components/toast/toastPalette");

const mount = (element) => {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
};
// Sahte Pressable bileşeni testID'yi alt ana-eleman "Pressable"a da geçirir: yalnız ana eleman sayılır.
const cardsOf = (tree) =>
  tree.root.findAllByType("Pressable").filter((n) => n.props.testID === "toast-card");
const names = (tree) => tree.root.findAllByType("Ionicons").map((n) => n.props.name);
const texts = (tree) =>
  tree.root
    .findAllByType("Text")
    .map((n) => [].concat(n.props.children).join(""));

// react-test-renderer'ın kullanımdan kalkma uyarısı çıktıyı boğmasın.
const realConsoleError = console.error;
beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation((...args) => {
    if (String(args[0]).includes("react-test-renderer is deprecated")) return;
    realConsoleError(...args);
  });
});
afterAll(() => console.error.mockRestore());

beforeEach(() => {
  jest.useFakeTimers();
  mockReduceMotion = false;
  act(() => toastStore.clear());
});
afterEach(() => {
  act(() => toastStore.clear());
  jest.useRealTimers();
});

const baseToast = (extra = {}) => ({
  id: "t1",
  kind: "success",
  title: "Kaydedildi",
  message: "",
  action: null,
  data: {},
  count: 1,
  durationMs: 3000,
  totalMs: 3000,
  resumeFrom: 3000,
  ...extra,
});

describe("StatusCard", () => {
  const card = (toast, extra = {}) =>
    mount(
      <StatusCard
        toast={toast}
        theme={mockTheme}
        reduceMotion={false}
        progress={{ value: 1 }}
        onAction={jest.fn()}
        {...extra}
      />,
    );

  it("eylem yokken kapat çarpısı var, düğme yok", () => {
    const tree = card(baseToast());
    expect(names(tree)).toContain("close");
    expect(tree.root.findAllByType("Pressable")).toHaveLength(0);
  });

  it("eylem varken etiketli düğme çarpının yerini alır; basınca onAction çalışır", () => {
    const onAction = jest.fn();
    const tree = card(
      baseToast({ action: { label: "Geri Al", icon: "arrow-undo", onPress: jest.fn() } }),
      { onAction },
    );
    expect(names(tree)).toContain("arrow-undo");
    expect(names(tree)).not.toContain("close");
    const button = tree.root.findByProps({ accessibilityLabel: "Geri Al" });
    act(() => button.props.onPress());
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("ikonsuz eylemde ikon çizilmez (yalnız etiket)", () => {
    const tree = card(baseToast({ action: { label: "Aç", icon: null, onPress: jest.fn() } }));
    expect(names(tree)).not.toContain("arrow-undo");
    expect(texts(tree)).toContain("Aç");
  });

  it("başlık ve mesaj çizilir; mesaj boşsa yer tutmaz", () => {
    expect(texts(card(baseToast({ message: "Değişiklikler uygulandı" })))).toEqual(
      expect.arrayContaining(["Kaydedildi", "Değişiklikler uygulandı"]),
    );
    expect(texts(card(baseToast()))).toEqual(["Kaydedildi"]);
  });

  it("yineleme sayacı ×N olarak görünür; tek seferde görünmez", () => {
    expect(texts(card(baseToast({ count: 3 })))).toContain("×3");
    expect(texts(card(baseToast({ count: 14 })))).toContain("×9+");
    expect(texts(card(baseToast({ count: 1 })))).not.toContain("×1");
  });

  it("türe göre doğru glif: premium yıldız + kıvılcım, yükleniyor dönen halka", () => {
    const premium = card(baseToast({ kind: "premium", title: "Premium aktif" }));
    expect(premium.root.findAllByType("Path").length).toBeGreaterThan(0);
    const loading = card(baseToast({ kind: "loading", title: "Yükleniyor", totalMs: null, resumeFrom: null }));
    expect(loading.root.findAllByType("Circle").length).toBe(2); // zemin halkası + yay
  });
});

describe("BadgeCard", () => {
  const badge = baseToast({
    kind: "badge",
    title: "Yeni rozet",
    message: "Kâşif",
    data: { gorunum: { rarity: "epic", tier: 2, aileToplam: 5, icon: "film", iconSolid: true }, ek: 4, ipucu: "Görmek için dokun" },
  });

  it("rozeti, başlığı, ipucunu ve +N'yi çizer", () => {
    const tree = mount(<BadgeCard toast={badge} theme={mockTheme} reduceMotion={false} progress={{ value: 1 }} />);
    expect(tree.root.findAllByType("AppBadge")).toHaveLength(1);
    expect(texts(tree)).toEqual(expect.arrayContaining(["Yeni rozet", "Kâşif", "Görmek için dokun", "+4"]));
  });

  it("ek yoksa +N çizilmez", () => {
    const tree = mount(
      <BadgeCard
        toast={{ ...badge, data: { ...badge.data, ek: 0 } }}
        theme={mockTheme}
        reduceMotion={false}
        progress={{ value: 1 }}
      />,
    );
    expect(texts(tree).some((t) => t.startsWith("+"))).toBe(false);
  });
});

describe("ToastHost", () => {
  const cards = (tree) => cardsOf(tree);

  it("boştayken yalnız şeffaf kap çizer", () => {
    const tree = mount(<ToastHost />);
    expect(cards(tree)).toHaveLength(0);
    expect(tree.root.findAllByType("View")).toHaveLength(1);
  });

  it("gösterilen toast çizilir ve süresi dolunca kalkar", () => {
    const tree = mount(<ToastHost />);
    act(() => {
      toastStore.show({ type: "success", text1: "Kaydedildi" });
    });
    expect(cards(tree)).toHaveLength(1);
    expect(texts(tree)).toContain("Kaydedildi");

    act(() => jest.advanceTimersByTime(3000));
    expect(cards(tree)).toHaveLength(0);
  });

  it("üst boşluk güvenli alandan gelir; elle verilebilir", () => {
    const tree = mount(<ToastHost />);
    act(() => {
      toastStore.show({ type: "info", text1: "x" });
    });
    const slot = tree.root.findAllByType("AnimatedView")[0];
    expect([].concat(slot.props.style).some((s) => s && s.top === 47 + 8)).toBe(true);

    const manual = mount(<ToastHost scoped topInset={0} />);
    const slot2 = manual.root.findAllByType("AnimatedView")[0];
    expect([].concat(slot2.props.style).some((s) => s && s.top === 8)).toBe(true);
  });

  it("modal host'u etkin olunca toast ONDA çizilir, kökte çizilmez; kayıt bırakınca köke döner", () => {
    const root = mount(<ToastHost />);
    const modal = mount(<ToastHost scoped enabled />);
    act(() => {
      toastStore.show({ type: "success", text1: "Kaydedildi" });
    });
    expect(cards(modal)).toHaveLength(1);
    expect(cards(root)).toHaveLength(0);

    act(() => modal.update(<ToastHost scoped enabled={false} />));
    expect(cards(modal)).toHaveLength(0);
    expect(cards(root)).toHaveLength(1);
  });

  it("yalnız modal host'u kapalıyken (enabled=false) kayıt olmaz", () => {
    const root = mount(<ToastHost />);
    mount(<ToastHost scoped enabled={false} />);
    act(() => {
      toastStore.show({ type: "info", text1: "Bilgi" });
    });
    expect(cards(root)).toHaveLength(1);
  });

  it("modal host'u kaldırılınca (unmount) kayıt silinir", () => {
    const root = mount(<ToastHost />);
    const modal = mount(<ToastHost scoped enabled />);
    act(() => {
      toastStore.show({ type: "info", text1: "Bilgi" });
    });
    expect(cards(root)).toHaveLength(0);
    act(() => modal.unmount());
    expect(cards(root)).toHaveLength(1);
  });

  it("modal içindeki toast RNGH kökü ile sarılır; kökteki sarılmaz", () => {
    const root = mount(<ToastHost />);
    act(() => {
      toastStore.show({ type: "info", text1: "Bilgi" });
    });
    expect(root.root.findAllByType("GHRoot")).toHaveLength(0);

    act(() => toastStore.clear());
    const modal = mount(<ToastHost scoped />);
    act(() => {
      toastStore.show({ type: "info", text1: "Bilgi 2" });
    });
    expect(modal.root.findAllByType("GHRoot")).toHaveLength(1);
  });
});

describe("ToastItem etkileşimi", () => {
  const setup = (input) => {
    const tree = mount(<ToastHost />);
    let id;
    act(() => {
      id = toastStore.show(input);
    });
    const pressable = () => cardsOf(tree)[0];
    const pan = () => tree.root.findByType("Detector").props.gesture;
    return { tree, id, pressable, pan };
  };

  it("karta dokunmak kapatır ve onPress'i çalıştırır", () => {
    const onPress = jest.fn();
    const { tree, pressable } = setup({ type: "info", text1: "Rozet", onPress });
    act(() => pressable().props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(toastStore.getSnapshot().toast).toBeNull();
    expect(cardsOf(tree)).toHaveLength(0);
  });

  it("eylem düğmesi toast'ı kapatır ve eylemi çalıştırır; kartın onPress'i çalışmaz", () => {
    const undo = jest.fn();
    const onPress = jest.fn();
    const { tree } = setup({
      type: "info",
      text1: "Kaldırıldı",
      onPress,
      props: { action: { label: "Geri Al", icon: "arrow-undo", onPress: undo } },
    });
    act(() => tree.root.findByProps({ accessibilityLabel: "Geri Al" }).props.onPress());
    expect(undo).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
    expect(toastStore.getSnapshot().toast).toBeNull();
  });

  it("onPress içinde hata olsa da toast kapanır (uygulama çökmez)", () => {
    const { pressable } = setup({
      type: "info",
      text1: "x",
      onPress: () => {
        throw new Error("boom");
      },
    });
    expect(() => act(() => pressable().props.onPress())).not.toThrow();
    expect(toastStore.getSnapshot().toast).toBeNull();
  });

  it("erişilebilirlik: uyarı rolü, canlı bölge, etiket ve özel eylemler", () => {
    const { pressable } = setup({
      type: "success",
      text1: "Kaydedildi",
      text2: "Not eklendi",
      props: { action: { label: "Geri Al", onPress: jest.fn() } },
    });
    const props = pressable().props;
    expect(props.accessibilityRole).toBe("alert");
    expect(props.accessibilityLiveRegion).toBe("polite");
    expect(props.accessibilityLabel).toBe("Kaydedildi. Not eklendi");
    expect(props.accessibilityActions.map((a) => a.name)).toEqual(["toast-action", "toast-dismiss"]);

    act(() => props.onAccessibilityAction({ nativeEvent: { actionName: "toast-dismiss" } }));
    expect(toastStore.getSnapshot().toast).toBeNull();
  });

  it("parmak kartın üstündeyken süre durur, bırakınca sürer", () => {
    const { pan } = setup({ type: "success", text1: "Kaydedildi" }); // ~2,4 sn
    act(() => pan().handlers.onBegin());
    act(() => jest.advanceTimersByTime(10000));
    expect(toastStore.getSnapshot().toast).not.toBeNull();

    act(() => pan().handlers.onFinalize());
    act(() => jest.advanceTimersByTime(3000));
    expect(toastStore.getSnapshot().toast).toBeNull();
  });

  const release = (pan, event) =>
    act(() =>
      pan().handlers.onEnd({ translationX: 0, translationY: 0, velocityX: 0, velocityY: 0, ...event }),
    );

  it("yukarı kaydırma eşiği aşılınca toast kapanır", () => {
    const { pan } = setup({ type: "info", text1: "Bilgi" });
    release(pan, { translationY: -60 });
    expect(toastStore.getSnapshot().toast).toBeNull();
  });

  it("hızlı yukarı fırlatma kısa mesafede de kapatır", () => {
    const { pan } = setup({ type: "info", text1: "Bilgi" });
    release(pan, { translationY: -8, velocityY: -900 });
    expect(toastStore.getSnapshot().toast).toBeNull();
  });

  it("yana kaydırma kapatır", () => {
    const { pan } = setup({ type: "info", text1: "Bilgi" });
    release(pan, { translationX: 140 });
    expect(toastStore.getSnapshot().toast).toBeNull();
  });

  it("eşik altı kaydırma kapatmaz: kart yerine döner", () => {
    const { pan } = setup({ type: "info", text1: "Bilgi" });
    release(pan, { translationY: -10, velocityY: -100 });
    release(pan, { translationX: 30, velocityX: 100 });
    expect(toastStore.getSnapshot().toast).not.toBeNull();
  });

  it("aşağı çekmek (lastik) kapatmaz", () => {
    const { pan } = setup({ type: "info", text1: "Bilgi" });
    release(pan, { translationY: 120, velocityY: 400 });
    expect(toastStore.getSnapshot().toast).not.toBeNull();
  });

  it("swipeable=false ise sürükleme kapalıdır", () => {
    const { pan } = setup({ type: "info", text1: "Bilgi", swipeable: false });
    expect(pan().enabledValue).toBe(false);
  });

  it("'Hareketi Azalt' açıkken kart solarak girer (yaylanma yok)", () => {
    mockReduceMotion = true;
    const tree = mount(<ToastHost />);
    act(() => {
      toastStore.show({ type: "success", text1: "Kaydedildi" });
    });
    const slot = tree.root.findAllByType("AnimatedView")[0];
    expect(typeof slot.props.entering).toBe("object"); // FadeIn kurucusu
    mockReduceMotion = false;
  });
});

describe("toastPalette", () => {
  it("her tür için tutarlı alanlar üretir; yükleniyor temanın vurgusunu kullanır", () => {
    ["success", "error", "warning", "info", "premium"].forEach((kind) => {
      const p = paletteFor(kind, mockTheme);
      expect(p.orb).toHaveLength(2);
      expect(p.main).toMatch(/^#/);
      expect(p.border).toMatch(/^rgba/);
    });
    expect(paletteFor("loading", mockTheme).main).toBe(mockTheme.accent);
    // Bilinmeyen tür çökmez.
    expect(paletteFor("???", {}).main).toMatch(/^#/);
  });

  it("premium altın→mor, hata kırmızı, başarı yeşil", () => {
    expect(paletteFor("premium", mockTheme).alt).toBe("#8B5CF6");
    expect(paletteFor("error", mockTheme).main).toBe("#EF4444");
    expect(paletteFor("success", mockTheme).main).toBe("#22C55E");
  });

  it("rozet paleti tek vurgu renginden türer", () => {
    const p = paletteFromAccent("#C0A060");
    expect(p.main).toBe("#C0A060");
    expect(p.orb).toEqual(["#C0A060", "#C0A060"]);
  });
});
