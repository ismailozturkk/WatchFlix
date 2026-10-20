import {
  ENTRANCE_WINDOW_MS,
  createEntranceGate,
  gridEntranceIndex,
} from "../utils/entranceGate";

describe("createEntranceGate", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("is open before the window starts (nothing has mounted yet)", () => {
    const gate = createEntranceGate();
    expect(gate.isOpen()).toBe(true);
    jest.advanceTimersByTime(ENTRANCE_WINDOW_MS * 3);
    // start() hiç çağrılmadıysa zamanlayıcı yok → hâlâ açık.
    expect(gate.isOpen()).toBe(true);
  });

  test("closes once the window elapses after start()", () => {
    const gate = createEntranceGate(500);
    gate.start();
    jest.advanceTimersByTime(499);
    expect(gate.isOpen()).toBe(true);
    jest.advanceTimersByTime(1);
    expect(gate.isOpen()).toBe(false);
  });

  test("calling start() again does not extend the window", () => {
    const gate = createEntranceGate(500);
    gate.start();
    jest.advanceTimersByTime(400);
    gate.start();
    jest.advanceTimersByTime(100);
    expect(gate.isOpen()).toBe(false);
  });

  test("never reopens after it closed", () => {
    const gate = createEntranceGate(100);
    gate.start();
    jest.advanceTimersByTime(100);
    gate.start();
    expect(gate.isOpen()).toBe(false);
    jest.advanceTimersByTime(1000);
    expect(gate.isOpen()).toBe(false);
  });

  test("dispose() drops the timer without closing; start() can re-arm (dev double effect)", () => {
    const gate = createEntranceGate(300);
    gate.start();
    gate.dispose();
    jest.advanceTimersByTime(1000);
    expect(gate.isOpen()).toBe(true);
    gate.start();
    jest.advanceTimersByTime(300);
    expect(gate.isOpen()).toBe(false);
  });

  test("uses the default window when none is given", () => {
    const gate = createEntranceGate();
    gate.start();
    jest.advanceTimersByTime(ENTRANCE_WINDOW_MS - 1);
    expect(gate.isOpen()).toBe(true);
    jest.advanceTimersByTime(1);
    expect(gate.isOpen()).toBe(false);
  });
});

describe("gridEntranceIndex", () => {
  test("walks the grid left-to-right, top-to-bottom", () => {
    expect(gridEntranceIndex(0, 0, 3)).toBe(0);
    expect(gridEntranceIndex(0, 2, 3)).toBe(2);
    expect(gridEntranceIndex(1, 0, 3)).toBe(3);
    expect(gridEntranceIndex(2, 1, 4)).toBe(9);
  });

  test("tolerates missing or bad input", () => {
    expect(gridEntranceIndex(undefined, undefined, undefined)).toBe(0);
    expect(gridEntranceIndex(-1, -1, 3)).toBe(0);
    expect(gridEntranceIndex(2, 1, 0)).toBe(3);
  });
});
