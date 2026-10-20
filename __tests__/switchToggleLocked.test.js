// SwitchToggle `locked` kipi: Premium'a özel ayarlar (kar, ikon arka planı, pet)
// Free'de anahtarı oynatmamalı. ESKİ HATA: anahtar iyimser animasyonu hemen
// başlatıp sonra onValueChange çağırıyordu; ebeveyn değeri değiştirmeyip
// yükseltme sayfasını açınca `value` aynı kaldığı için efekt tetiklenmiyor ve
// anahtar görsel olarak "açık"ta takılı kalıyordu.
import React from "react";
import { act, create } from "react-test-renderer";
import { withSpring } from "react-native-reanimated";
import SwitchToggle from "../components/SwitchToggle";

global.IS_REACT_ACT_ENVIRONMENT = true;

const mockSharedValues = [];

jest.mock("react-native", () => ({
  Pressable: ({ children, onPress, disabled, accessibilityRole, accessibilityState }) => (
    <button
      onClick={onPress}
      disabled={disabled}
      role={accessibilityRole}
      aria-checked={accessibilityState?.checked}
    >
      {children}
    </button>
  ),
  StyleSheet: { create: (styles) => styles },
}));

jest.mock("react-native-reanimated", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: {
      View: ({ children, style }) => <div style={style}>{children}</div>,
    },
    // Render'lar arası kalıcı olmalı: gerçek useSharedValue da öyle.
    useSharedValue: (initial) => {
      const ref = React.useRef(null);
      if (!ref.current) {
        ref.current = { value: initial };
        mockSharedValues.push(ref.current);
      }
      return ref.current;
    },
    useAnimatedStyle: (fn) => fn(),
    withSpring: jest.fn((value) => value),
    interpolateColor: (_progress, _range, colors) => colors[0],
  };
});

function setup(props) {
  mockSharedValues.length = 0;
  withSpring.mockClear();
  let tree;
  act(() => {
    tree = create(<SwitchToggle {...props} />);
  });
  // İlk paylaşılan değer = `progress` (ikincisi `pressed`).
  const [progress] = mockSharedValues;
  const press = () => act(() => tree.root.findByType("button").props.onClick());
  return { progress, press };
}

describe("SwitchToggle locked", () => {
  test("kilitli değilken dokunmak iyimser animasyonu başlatıp değeri bildirir", () => {
    const onValueChange = jest.fn();
    const { progress, press } = setup({ value: false, onValueChange });
    press();
    expect(onValueChange).toHaveBeenCalledWith(true);
    expect(progress.value).toBe(1);
  });

  test("kilitliyken dokunmak anahtarı OYNATMAZ ve yalnız onLockedPress'i çağırır", () => {
    const onValueChange = jest.fn();
    const onLockedPress = jest.fn();
    const { progress, press } = setup({
      value: false,
      onValueChange,
      locked: true,
      onLockedPress,
    });
    press();
    expect(onLockedPress).toHaveBeenCalledTimes(1);
    expect(onValueChange).not.toHaveBeenCalled();
    // Düğme kapalı konumda kalır; açılışta yalnız mevcut değere (0) yaylanmıştır.
    expect(progress.value).toBe(0);
    expect(withSpring).not.toHaveBeenCalledWith(1, expect.anything());
  });

  test("kilitliyken tekrar tekrar dokunmak da anahtarı açık göstermez", () => {
    const onLockedPress = jest.fn();
    const { progress, press } = setup({ value: false, locked: true, onLockedPress });
    press();
    press();
    press();
    expect(onLockedPress).toHaveBeenCalledTimes(3);
    expect(progress.value).toBe(0);
  });

  test("onLockedPress verilmese de kilitli dokunuş hata atmaz", () => {
    const onValueChange = jest.fn();
    const { press } = setup({ value: false, onValueChange, locked: true });
    expect(() => press()).not.toThrow();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("disabled anahtar kilitli olsa bile hiçbir şey çağırmaz", () => {
    const onValueChange = jest.fn();
    const onLockedPress = jest.fn();
    const { press } = setup({
      value: false,
      onValueChange,
      locked: true,
      onLockedPress,
      disabled: true,
    });
    press();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onLockedPress).not.toHaveBeenCalled();
  });
});
