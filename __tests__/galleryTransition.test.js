import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => {
  class Value {
    constructor(value) { this.value = value; }
    setValue(value) { this.value = value; }
    stopAnimation() {}
  }
  return {
    Animated: {
      Value,
      timing: (value, { toValue }) => ({
        start: (done) => { value.setValue(toValue); done?.({ finished: true }); },
      }),
    },
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
    Easing: { out: () => null, in: () => null, quad: null },
    Platform: { OS: "ios" },
  };
});

jest.mock("react-native-reanimated", () => ({
  cancelAnimation: jest.fn(),
  Easing: { inOut: () => null, cubic: null },
  runOnJS: (fn) => fn,
  useSharedValue: (value) => ({ value }),
  withSpring: (value, _config, done) => { done?.(true); return value; },
  withTiming: (value, _config, done) => { done?.(true); return value; },
}));

import useGalleryTransition from "../components/modals/gallery/useGalleryTransition";

describe("gallery transition without another onLayout event", () => {
  let current;
  let renderer;
  const options = {
    origin: { x: 20, y: 300, width: 110, height: 165 },
    originUri: "https://example.com/poster.jpg",
    originOpacity: { setValue: jest.fn() },
    shouldReturnToSlot: () => true,
  };

  function Harness({ visible }) {
    current = useGalleryTransition({ ...options, visible });
    return null;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
    jest.useRealTimers();
  });

  test("modal show measures the root and starts the poster flight", () => {
    act(() => { renderer = create(<Harness visible={false} />); });
    act(() => { renderer.update(<Harness visible />); });
    current.rootRef.current = {
      measureInWindow: (done) => done(0, 0, 390, 844),
    };

    act(() => { current.onModalShow(); jest.advanceTimersByTime(20); });
    expect(current.flight).toMatchObject({ mode: "open", uri: options.originUri });
    expect(current.interactive).toBe(false);

    act(() => current.onFlierReady(current.flight.id));
    expect(current.interactive).toBe(true);
  });

  test("a missing native measurement still opens through the fade fallback", () => {
    act(() => { renderer = create(<Harness visible={false} />); });
    act(() => { renderer.update(<Harness visible />); });
    act(() => { current.onModalShow(); jest.advanceTimersByTime(400); });

    expect(current.flight).toBeNull();
    expect(current.interactive).toBe(true);
    expect(current.mounted).toBe(true);
  });

  test("a root that becomes measurable after onShow still animates", () => {
    act(() => { renderer = create(<Harness visible={false} />); });
    act(() => { renderer.update(<Harness visible />); });
    let calls = 0;
    current.rootRef.current = {
      measureInWindow: (done) => {
        calls += 1;
        if (calls === 1) done(0, 0, 0, 0);
        else done(0, 0, 390, 844);
      },
    };

    act(() => { current.onModalShow(); jest.advanceTimersByTime(60); });
    expect(calls).toBeGreaterThan(1);
    expect(current.flight).toMatchObject({ mode: "open" });
  });

  test("reopening without a new layout event starts another flight", () => {
    act(() => { renderer = create(<Harness visible={false} />); });
    act(() => { renderer.update(<Harness visible />); });
    current.rootRef.current = { measureInWindow: (done) => done(0, 0, 390, 844) };
    act(() => { current.onModalShow(); jest.advanceTimersByTime(20); });
    const firstId = current.flight.id;
    act(() => current.onFlierReady(firstId));

    act(() => { renderer.update(<Harness visible={false} />); });
    expect(current.flight).toMatchObject({ mode: "close" });
    act(() => current.onFlierReady(current.flight.id));
    act(() => jest.advanceTimersByTime(20));
    expect(current.mounted).toBe(false);

    act(() => { renderer.update(<Harness visible />); });
    act(() => { current.onModalShow(); jest.advanceTimersByTime(20); });
    expect(current.flight).toMatchObject({ mode: "open" });
    expect(current.flight.id).toBeGreaterThan(firstId);
  });

  test("a backdrop that decodes after 600 ms still flies from its source", () => {
    act(() => { renderer = create(<Harness visible={false} />); });
    act(() => { renderer.update(<Harness visible />); });
    current.rootRef.current = { measureInWindow: (done) => done(0, 0, 390, 844) };
    act(() => { current.onModalShow(); jest.advanceTimersByTime(20); });
    const flightId = current.flight.id;
    act(() => current.onFlierMounted(flightId));

    act(() => jest.advanceTimersByTime(1100));
    expect(current.flight?.id).toBe(flightId);
    expect(current.interactive).toBe(false);

    act(() => current.onFlierReady(flightId));
    expect(current.interactive).toBe(true);
  });

  test("an image load error falls back immediately", () => {
    act(() => { renderer = create(<Harness visible={false} />); });
    act(() => { renderer.update(<Harness visible />); });
    current.rootRef.current = { measureInWindow: (done) => done(0, 0, 390, 844) };
    act(() => { current.onModalShow(); jest.advanceTimersByTime(20); });
    act(() => current.onFlierFailed(current.flight.id));

    expect(current.flight).toBeNull();
    expect(current.interactive).toBe(true);
  });

  test("an image that never reports load still releases the modal", () => {
    act(() => { renderer = create(<Harness visible={false} />); });
    act(() => { renderer.update(<Harness visible />); });
    current.rootRef.current = { measureInWindow: (done) => done(0, 0, 390, 844) };
    act(() => { current.onModalShow(); jest.advanceTimersByTime(20); });
    act(() => current.onFlierMounted(current.flight.id));
    act(() => jest.advanceTimersByTime(3100));

    expect(current.flight).toBeNull();
    expect(current.interactive).toBe(true);
  });
});
