import React from "react";
import { act, create } from "react-test-renderer";

const mockImpactAsync = jest.fn();

jest.mock("react-native", () => ({
  View: "View",
  Pressable: "Pressable",
  StyleSheet: { create: (styles) => styles },
  PanResponder: {
    create: (handlers) => ({ panHandlers: handlers }),
  },
  useWindowDimensions: () => ({ width: 400, height: 800 }),
}));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("../services/hapticsService", () => ({
  // Yarım puan başına bir desen (sliderTick; uçlarda sliderEdge).
  haptic: (...args) => mockImpactAsync(...args),
}));

const RatingInput = require("../components/RatingInput").default;
global.IS_REACT_ACT_ENVIRONMENT = true;

// 10 yıldız, yarım puan (0.5 … 10). Satır genişliği bileşenin kendi hesapladığı değerden okunur
// (genişliğe sığdırma yıldız boyunu değiştirebilir).
const findRow = (renderer) =>
  renderer.root.find((node) => node.type === "View" && node.props.accessibilityRole === "adjustable");
const rowWidthOf = (row) => [].concat(row.props.style).find((s) => s && s.width != null).width;
const starsOf = (renderer) => renderer.root.findAll((node) => node.type === "Ionicons");

describe("RatingInput kaydırma etkileşimi", () => {
  let consoleError;

  beforeAll(() => {
    const original = console.error;
    consoleError = jest.spyOn(console, "error").mockImplementation((message, ...rest) => {
      if (String(message).includes("react-test-renderer is deprecated")) return;
      original(message, ...rest);
    });
  });

  afterAll(() => consoleError.mockRestore());
  beforeEach(() => mockImpactAsync.mockClear());

  test("10 yıldız çizer; 8.5 → 8 dolu + 1 yarım + 1 boş", () => {
    let renderer;
    act(() => {
      renderer = create(<RatingInput value={8.5} onChange={jest.fn()} />);
    });
    const names = starsOf(renderer).map((n) => n.props.name);
    expect(names).toHaveLength(10);
    expect(names.filter((n) => n === "star")).toHaveLength(8);
    expect(names[8]).toBe("star-half");
    expect(names[9]).toBe("star-outline");
  });

  test("parmak yıldızların üzerinde ilerlerken yarım puan adımlarıyla puanı günceller", () => {
    const onChange = jest.fn();
    let renderer;
    act(() => {
      renderer = create(<RatingInput value={0} onChange={onChange} size={30} />);
    });
    const row = findRow(renderer);
    const width = rowWidthOf(row);

    act(() => {
      row.props.onPanResponderGrant({ nativeEvent: { locationX: width * 0.83 } });
      row.props.onPanResponderMove({ nativeEvent: {} }, { dx: width * 0.05 });
      row.props.onPanResponderMove({ nativeEvent: {} }, { dx: width * 0.5 });
    });

    expect(onChange.mock.calls.map(([value]) => value)).toEqual([8.5, 9, 10]);
    // Uçta (10) sliderEdge, aradakiler sliderTick.
    expect(mockImpactAsync.mock.calls.map(([kind]) => kind)).toEqual(["sliderTick", "sliderTick", "sliderEdge"]);
  });

  test("kaydırma parmağın indiği noktadan başlar; locationX zıplasa da yalnız dx sayılır", () => {
    const onChange = jest.fn();
    let renderer;
    act(() => {
      renderer = create(<RatingInput value={0} onChange={onChange} size={30} />);
    });
    const row = findRow(renderer);
    const width = rowWidthOf(row);

    expect(row.props.onStartShouldSetPanResponder()).toBe(true);
    act(() => {
      // Parmak 6. yıldızın sağ yarısına iner (6), sonra sola kayar.
      row.props.onPanResponderGrant({ nativeEvent: { locationX: width * 0.58 } });
      row.props.onPanResponderMove({ nativeEvent: { locationX: 3 } }, { dx: -width * 0.2 });
      row.props.onPanResponderMove({ nativeEvent: { locationX: 3 } }, { dx: -width * 0.9 });
    });

    // En düşük puan 0.5 (sıfıra inilmez; kaldırma ayrı düğme).
    expect(onChange.mock.calls.map(([value]) => value)).toEqual([6, 4, 0.5]);
  });

  test("dar kapsayıcıda yıldızlar küçülerek tek satıra sığar", () => {
    let renderer;
    act(() => {
      renderer = create(<RatingInput value={0} onChange={jest.fn()} size={34} />);
    });
    const fit = renderer.root.find((node) => node.type === "View" && typeof node.props.onLayout === "function");
    act(() => fit.props.onLayout({ nativeEvent: { layout: { width: 280 } } }));
    expect(rowWidthOf(findRow(renderer))).toBeLessThanOrEqual(280);
    expect(starsOf(renderer)[0].props.size).toBeLessThan(34);
  });

  test("belirgin dikey kaydırmada responder bırakılır, yatay puanlamada tutulur", () => {
    let renderer;
    act(() => {
      renderer = create(<RatingInput value={0} onChange={jest.fn()} />);
    });
    const request = findRow(renderer).props.onPanResponderTerminationRequest;
    expect(request({}, { dx: 1, dy: 20 })).toBe(true);
    expect(request({}, { dx: 30, dy: 40 })).toBe(false);
  });

  test("erişilebilirlik artır/azalt eylemleri 0.5 adım kullanır", () => {
    const onChange = jest.fn();
    let renderer;
    act(() => {
      renderer = create(<RatingInput value={8} onChange={onChange} />);
    });
    const row = findRow(renderer);
    expect(row.props.accessibilityValue).toEqual({ min: 0, max: 10, now: 8 });

    act(() => row.props.onAccessibilityAction({ nativeEvent: { actionName: "increment" } }));
    act(() => row.props.onAccessibilityAction({ nativeEvent: { actionName: "decrement" } }));

    expect(onChange.mock.calls.map(([value]) => value)).toEqual([8.5, 8]);
  });
});

describe("RatingInput 5 yıldız modu", () => {
  test("5 yıldız çizer; yarım yıldız = 1 puan, değer hâlâ 0-10", () => {
    const onChange = jest.fn();
    let renderer;
    act(() => {
      renderer = create(<RatingInput value={7} onChange={onChange} scale="five" />);
    });
    const names = starsOf(renderer).map((n) => n.props.name);
    expect(names).toEqual(["star", "star", "star", "star-half", "star-outline"]);

    const row = findRow(renderer);
    const width = rowWidthOf(row);
    act(() => {
      row.props.onPanResponderGrant({ nativeEvent: { locationX: width * 0.85 } });
    });
    expect(onChange).toHaveBeenLastCalledWith(9);

    act(() => row.props.onAccessibilityAction({ nativeEvent: { actionName: "increment" } }));
    expect(onChange).toHaveBeenLastCalledWith(10);
  });

  test("10'lu modda verilmiş 8.5, 5'li modda 4½ yıldız görünür", () => {
    let renderer;
    act(() => {
      renderer = create(<RatingInput value={8.5} onChange={jest.fn()} scale="five" />);
    });
    expect(starsOf(renderer).map((n) => n.props.name)).toEqual(["star", "star", "star", "star", "star-half"]);
  });
});
