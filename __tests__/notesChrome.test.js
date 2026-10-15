// Notlar ekranının sekme çubuğu + açılıp kapanan kabuk (RevealBox).
//
// RevealBox'ta yakalanan hata: kapanışta çocuğun "kapanış animasyonu bitene kadar
// sökülmemesi" efektte `setLingering(true)` ile yapılınca ilk render'da bileşen
// null dönüyor, kapanış animasyonu hiç görünmüyordu. Kapanışta çocuk HEMEN
// sökülmemeli, animasyon süresi dolunca sökülmeli.
import React from "react";
import { act, create } from "react-test-renderer";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("react-native", () => {
  const React = require("react");
  const host = (tag) => ({ children, style }) => React.createElement(tag, { style }, children);
  return {
    View: host("div"),
    Pressable: ({ children, onPress, accessibilityLabel, accessibilityState }) =>
      React.createElement(
        "button",
        {
          onClick: onPress,
          "aria-label": accessibilityLabel,
          "aria-selected": accessibilityState?.selected,
        },
        children,
      ),
    StyleSheet: {
      create: (styles) => styles,
      absoluteFill: {},
      hairlineWidth: 1,
    },
  };
});

jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const host = (tag) => ({ children, style }) => React.createElement(tag, { style }, children);
  return {
    __esModule: true,
    default: { View: host("div"), Text: host("span") },
    useSharedValue: (initial) => {
      const ref = React.useRef(null);
      if (!ref.current) ref.current = { value: initial };
      return ref.current;
    },
    useAnimatedStyle: (fn) => fn(),
    withSpring: (value) => value,
    withTiming: (value) => value,
    interpolate: (_value, _input, output) => output[output.length - 1],
    interpolateColor: (_value, _input, output) => output[0],
    Easing: { out: (fn) => fn, in: (fn) => fn, cubic: (t) => t },
  };
});

// Derleme eklentisi `Animated.Text`i ReanimatedAppText'e çevirir (uygulama fontu).
jest.mock("../components/typography/AppText", () => {
  const React = require("react");
  const host = ({ children, style }) => React.createElement("span", { style }, children);
  return {
    __esModule: true,
    AppText: host,
    AppTextInput: host,
    AnimatedAppText: host,
    ReanimatedAppText: host,
  };
});

jest.mock("expo-linear-gradient", () => ({
  LinearGradient: () => null,
}));
jest.mock("@expo/vector-icons/Ionicons", () => ({
  __esModule: true,
  default: () => null,
}));

const mockSelection = jest.fn(() => Promise.resolve());
jest.mock("../services/hapticsService", () => ({
  selectionAsync: (...args) => mockSelection(...args),
}));
jest.mock("../hooks/useReduceMotion", () => ({
  __esModule: true,
  default: () => false,
}));

const { NotesTabBar, RevealBox } = require("../screens/tabs/profile/notes/NotesChrome");

const THEME = {
  secondary: "#222222",
  border: "#333333",
  text: { primary: "#ffffff", secondary: "#cccccc", muted: "#888888" },
};
const TABS = [
  { key: "note", label: "Notlar", icon: "document-text" },
  { key: "todo", label: "Yapılacaklar", icon: "checkbox" },
  { key: "media", label: "Film/Dizi", icon: "film" },
];

const textOf = (node) => JSON.stringify(node.toJSON());

describe("RevealBox", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const render = (open) =>
    create(
      <RevealBox open={open} height={46}>
        <span>içerik</span>
      </RevealBox>,
    );

  test("kapalıyken hiçbir şey çizmez", () => {
    let tree;
    act(() => {
      tree = render(false);
    });
    expect(tree.toJSON()).toBeNull();
  });

  test("açılınca çocuğu hemen çizer", () => {
    let tree;
    act(() => {
      tree = render(false);
    });
    act(() => tree.update(<RevealBox open height={46}><span>içerik</span></RevealBox>));
    expect(textOf(tree)).toContain("içerik");
  });

  test("kapanırken çocuk animasyon süresince durur, sonra sökülür", () => {
    let tree;
    act(() => {
      tree = render(true);
    });
    expect(textOf(tree)).toContain("içerik");

    act(() => tree.update(<RevealBox open={false} height={46}><span>içerik</span></RevealBox>));
    // Kapanış animasyonu henüz bitmedi: çocuk yerinde olmalı.
    expect(textOf(tree)).toContain("içerik");

    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(tree.toJSON()).toBeNull();
  });

  test("kapanış bitmeden yeniden açılırsa çocuk sökülmez", () => {
    let tree;
    act(() => {
      tree = render(true);
    });
    act(() => tree.update(<RevealBox open={false} height={46}><span>içerik</span></RevealBox>));
    act(() => {
      jest.advanceTimersByTime(100);
    });
    act(() => tree.update(<RevealBox open height={46}><span>içerik</span></RevealBox>));
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(textOf(tree)).toContain("içerik");
  });
});

describe("NotesTabBar", () => {
  const setup = (props = {}) => {
    const onChange = jest.fn();
    let tree;
    act(() => {
      tree = create(
        <NotesTabBar
          tabs={TABS}
          value="note"
          counts={{ note: 2, todo: 0, media: 150 }}
          onChange={onChange}
          theme={THEME}
          accent="#3b82f6"
          {...props}
        />,
      );
    });
    const button = (label) =>
      tree.root.findAll(
        (n) => n.type === "button" && String(n.props["aria-label"] || "").startsWith(label),
      )[0];
    return { tree, onChange, button };
  };

  beforeEach(() => mockSelection.mockClear());

  test("üç sekmeyi çizer; seçili olan işaretlenir", () => {
    const { button } = setup();
    expect(button("Notlar").props["aria-selected"]).toBe(true);
    expect(button("Yapılacaklar").props["aria-selected"]).toBe(false);
    expect(button("Film/Dizi").props["aria-selected"]).toBe(false);
  });

  test("sayı rozeti: 0 çizilmez, 99'dan büyük 99+ olur", () => {
    const { tree } = setup();
    const json = textOf(tree);
    expect(json).toContain('"2"');
    expect(json).toContain('"99+"');
    // Yapılacaklar sayısı 0: erişilebilirlik etiketinde de sayı yok.
    expect(json).not.toContain('"0"');
  });

  test("başka sekmeye basınca onChange + dokunsal geri bildirim", () => {
    const { button, onChange } = setup();
    act(() => button("Yapılacaklar").props.onClick());
    expect(onChange).toHaveBeenCalledWith("todo");
    expect(mockSelection).toHaveBeenCalledTimes(1);
  });

  test("zaten seçili sekmeye basmak hiçbir şey yapmaz", () => {
    const { button, onChange } = setup();
    act(() => button("Notlar").props.onClick());
    expect(onChange).not.toHaveBeenCalled();
    expect(mockSelection).not.toHaveBeenCalled();
  });
});
