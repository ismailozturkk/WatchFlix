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
}));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("../services/hapticsService", () => ({
  impactAsync: (...args) => mockImpactAsync(...args),
  ImpactFeedbackStyle: { Light: "light" },
}));

const RatingInput = require("../components/RatingInput").default;
global.IS_REACT_ACT_ENVIRONMENT = true;

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

  test("parmak yıldızların üzerinde ilerlerken yarım yıldız adımlarıyla puanı günceller", () => {
    const onChange = jest.fn();
    let renderer;
    act(() => {
      renderer = create(<RatingInput value={0} onChange={onChange} size={30} />);
    });

    const adjustable = renderer.root.find(
      (node) => node.type === "View" && node.props.accessibilityRole === "adjustable",
    );
    const width = 5 * 30 + 4 * 4;

    act(() => {
      adjustable.props.onPanResponderGrant({ nativeEvent: { locationX: width * 0.52 } });
      adjustable.props.onPanResponderMove({ nativeEvent: {} }, { dx: width * 0.39 });
    });

    expect(onChange.mock.calls.map(([value]) => value)).toEqual([6, 10]);
    expect(mockImpactAsync).toHaveBeenCalledTimes(2);
  });

  test("kaydırma parmağın indiği noktadan başlar; locationX zıplasa da yalnız dx sayılır", () => {
    const onChange = jest.fn();
    let renderer;
    act(() => {
      renderer = create(<RatingInput value={0} onChange={onChange} size={30} />);
    });
    const adjustable = renderer.root.find(
      (node) => node.type === "View" && node.props.accessibilityRole === "adjustable",
    );
    const width = 5 * 30 + 4 * 4;

    expect(adjustable.props.onStartShouldSetPanResponder()).toBe(true);
    act(() => {
      // Parmak 3. yıldızın sağ yarısına iner (6), sonra sola kayar.
      adjustable.props.onPanResponderGrant({ nativeEvent: { locationX: width * 0.55 } });
      // Hareket sırasında locationX çocuk görünüme göre küçük gelse bile yok sayılır.
      adjustable.props.onPanResponderMove({ nativeEvent: { locationX: 3 } }, { dx: -width * 0.2 });
      adjustable.props.onPanResponderMove({ nativeEvent: { locationX: 3 } }, { dx: -width * 0.6 });
    });

    expect(onChange.mock.calls.map(([value]) => value)).toEqual([6, 4, 1]);
  });

  test("belirgin dikey kaydırmada responder bırakılır, yatay puanlamada tutulur", () => {
    let renderer;
    act(() => {
      renderer = create(<RatingInput value={0} onChange={jest.fn()} />);
    });
    const adjustable = renderer.root.find(
      (node) => node.type === "View" && node.props.accessibilityRole === "adjustable",
    );
    const request = adjustable.props.onPanResponderTerminationRequest;
    expect(request({}, { dx: 1, dy: 20 })).toBe(true);
    expect(request({}, { dx: 30, dy: 40 })).toBe(false);
  });

  test("erişilebilirlik artır/azalt eylemleri de aynı 0-10 ölçeğini kullanır", () => {
    const onChange = jest.fn();
    let renderer;
    act(() => {
      renderer = create(<RatingInput value={5} onChange={onChange} />);
    });
    const adjustable = renderer.root.find(
      (node) => node.type === "View" && node.props.accessibilityRole === "adjustable",
    );

    act(() => adjustable.props.onAccessibilityAction({ nativeEvent: { actionName: "increment" } }));
    act(() => adjustable.props.onAccessibilityAction({ nativeEvent: { actionName: "decrement" } }));

    expect(onChange.mock.calls.map(([value]) => value)).toEqual([6, 5]);
  });
});
