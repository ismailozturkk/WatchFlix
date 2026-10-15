import React from "react";
import { act, create } from "react-test-renderer";
import NativeTabBarScale from "../components/navigation/NativeTabBarScale";
import { setNativeTabBarProgress, resetNativeTabBarScale } from "../services/tabBarScale";
import { TAB_BAR_NATIVE_STEP } from "../utils/tabBarCollapse";

// Sürücü bileşen: paylaşılan kaydırma ilerlemesini yerel köprüye iletir.
// Reanimated taklidi: tepki fonksiyonları yakalanır, testte elle tetiklenir.

let mockReaction;
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  useSharedValue: (value) => require("react").useRef({ value }).current,
  useAnimatedReaction: (prepare, react) => { mockReaction = { prepare, react }; },
  runOnJS: (fn) => fn,
}));
jest.mock("../services/tabBarScale", () => ({
  setNativeTabBarProgress: jest.fn(),
  resetNativeTabBarScale: jest.fn(),
}));

global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer;
let consoleError;
beforeEach(() => {
  jest.clearAllMocks();
  mockReaction = null;
  const original = console.error;
  consoleError = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
});
afterEach(async () => {
  if (renderer) await act(() => renderer.unmount());
  renderer = null;
  consoleError.mockRestore();
});

async function mount(progress) {
  await act(() => { renderer = create(<NativeTabBarScale progress={progress} />); });
}
// Reanimated'ın yaptığı gibi: hazırlık değerini oku, tepkiye ver.
const tick = () => mockReaction.react(mockReaction.prepare());

describe("NativeTabBarScale", () => {
  it("renders nothing", async () => {
    await mount({ value: 0 });
    expect(renderer.toJSON()).toBeNull();
  });

  it("sends the starting position once", async () => {
    const progress = { value: 0 };
    await mount(progress);
    tick();
    expect(setNativeTabBarProgress).toHaveBeenCalledTimes(1);
    expect(setNativeTabBarProgress).toHaveBeenLastCalledWith(0);
    tick(); // aynı değer: gönderilmez
    expect(setNativeTabBarProgress).toHaveBeenCalledTimes(1);
  });

  it("follows the shared scroll progress down and back up", async () => {
    const progress = { value: 0 };
    await mount(progress);
    tick();
    for (const value of [0.25, 0.5, 0.75, 1, 0.6, 0]) {
      progress.value = value;
      tick();
      expect(setNativeTabBarProgress).toHaveBeenLastCalledWith(value);
    }
  });

  it("does not flood the bridge with sub-step changes", async () => {
    const progress = { value: 0 };
    await mount(progress);
    tick();
    setNativeTabBarProgress.mockClear();
    // 0 -> 0.2 in tiny increments of a quarter step: only whole steps go out.
    const increment = TAB_BAR_NATIVE_STEP / 4;
    for (let i = 1; i <= 80; i++) {
      progress.value = increment * i;
      tick();
    }
    expect(setNativeTabBarProgress.mock.calls.length).toBeLessThanOrEqual(21);
    expect(setNativeTabBarProgress.mock.calls.length).toBeGreaterThan(10);
  });

  it("still lands exactly on the rest positions after fine movement", async () => {
    const progress = { value: 0 };
    await mount(progress);
    tick();
    progress.value = 0.996;
    tick();
    progress.value = 1;
    tick();
    expect(setNativeTabBarProgress).toHaveBeenLastCalledWith(1);
    progress.value = 0.004;
    tick();
    progress.value = 0;
    tick();
    expect(setNativeTabBarProgress).toHaveBeenLastCalledWith(0);
  });

  it("puts the real bar back to full size when it unmounts (mode switch / shell closing)", async () => {
    await mount({ value: 0.5 });
    expect(resetNativeTabBarScale).not.toHaveBeenCalled();
    await act(() => renderer.unmount());
    renderer = null;
    expect(resetNativeTabBarScale).toHaveBeenCalledTimes(1);
  });
});
