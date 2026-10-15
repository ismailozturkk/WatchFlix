const {
  advanceTabBarCollapse,
  shouldForwardCollapse,
  TAB_BAR_COLLAPSE_DISTANCE,
  TAB_BAR_COLLAPSE_FLOOR,
  TAB_BAR_COLLAPSE_SCALE_DELTA,
  TAB_BAR_MIN_SCALE,
  TAB_BAR_NATIVE_SCALE_ENABLED,
  TAB_BAR_NATIVE_STEP,
  TAB_BAR_SCROLL_UNSET,
} = require("../utils/tabBarCollapse");

function shared(value) {
  return { value };
}

describe("shared shrink amount", () => {
  it("is exactly 20%, and the minimum scale is its complement", () => {
    expect(TAB_BAR_COLLAPSE_SCALE_DELTA).toBe(0.2);
    expect(TAB_BAR_MIN_SCALE).toBeCloseTo(0.8, 10);
    expect(TAB_BAR_MIN_SCALE + TAB_BAR_COLLAPSE_SCALE_DELTA).toBeCloseTo(1, 10);
  });

  it("keeps the native iOS 26 scaling switched on (flip to false to roll back to the system minimize)", () => {
    expect(TAB_BAR_NATIVE_SCALE_ENABLED).toBe(true);
  });
});

describe("shouldForwardCollapse (what the native bridge hears)", () => {
  it("always forwards the first value, whatever it is", () => {
    expect(shouldForwardCollapse(-1, 0)).toBe(true);
    expect(shouldForwardCollapse(-1, 0.4)).toBe(true);
  });

  it("ignores a repeat of the same value", () => {
    expect(shouldForwardCollapse(0.5, 0.5)).toBe(false);
    expect(shouldForwardCollapse(0, 0)).toBe(false);
    expect(shouldForwardCollapse(1, 1)).toBe(false);
  });

  it("skips changes finer than one step but forwards a full step in either direction", () => {
    expect(shouldForwardCollapse(0.5, 0.5 + TAB_BAR_NATIVE_STEP / 2)).toBe(false);
    expect(shouldForwardCollapse(0.5, 0.5 + TAB_BAR_NATIVE_STEP)).toBe(true);
    expect(shouldForwardCollapse(0.5, 0.5 - TAB_BAR_NATIVE_STEP)).toBe(true);
  });

  it("always forwards the two rest positions, so the bar is never left a hair short", () => {
    // 0.004 -> 0 is a sub-step change, but full size must be reached exactly.
    expect(shouldForwardCollapse(0.004, 0)).toBe(true);
    expect(shouldForwardCollapse(0.996, 1)).toBe(true);
  });
});

describe("advanceTabBarCollapse", () => {
  it("increases progress proportionally to downward scroll distance", () => {
    const progress = shared(0);
    const lastY = shared(0);
    advanceTabBarCollapse(progress, lastY, TAB_BAR_COLLAPSE_FLOOR + 10);
    expect(progress.value).toBeCloseTo((TAB_BAR_COLLAPSE_FLOOR + 10) / TAB_BAR_COLLAPSE_DISTANCE, 5);
    expect(lastY.value).toBe(TAB_BAR_COLLAPSE_FLOOR + 10);
  });

  it("decreases progress when scrolling back up", () => {
    const progress = shared(0.9);
    const lastY = shared(500);
    advanceTabBarCollapse(progress, lastY, 450);
    expect(progress.value).toBeCloseTo(0.9 - 50 / TAB_BAR_COLLAPSE_DISTANCE, 5);
  });

  it("clamps to fully expanded at/below the floor regardless of prior progress", () => {
    const progress = shared(0.9);
    const lastY = shared(500);
    advanceTabBarCollapse(progress, lastY, TAB_BAR_COLLAPSE_FLOOR);
    expect(progress.value).toBe(0);
  });

  it("clamps to [0, 1]", () => {
    const overshootUp = shared(0);
    const lastY1 = shared(0);
    advanceTabBarCollapse(overshootUp, lastY1, TAB_BAR_COLLAPSE_DISTANCE * 10);
    expect(overshootUp.value).toBe(1);

    const overshootDown = shared(0.1);
    const lastY2 = shared(1000);
    advanceTabBarCollapse(overshootDown, lastY2, 25);
    expect(overshootDown.value).toBe(0);
  });

  it("ignores non-numeric offsets without touching either shared value", () => {
    const progress = shared(0.4);
    const lastY = shared(300);
    advanceTabBarCollapse(progress, lastY, undefined);
    advanceTabBarCollapse(progress, lastY, NaN);
    advanceTabBarCollapse(progress, lastY, "120");
    expect(progress.value).toBe(0.4);
    expect(lastY.value).toBe(300);
  });

  // Regression: a tab screen frozen (not unmounted) while scrolled deep
  // down keeps its real native scroll position. Resetting lastScrollY to a
  // literal 0 on tab switch meant the next real scroll event computed a
  // delta against that false "0" — i.e. the screen's entire scroll depth
  // in one tick — instantly slamming the bar to fully collapsed instead of
  // resuming a smooth, incremental response. The "unset" sentinel fixes
  // this by treating the next sample as a fresh baseline, not a delta.
  describe("resync after a reset (TAB_BAR_SCROLL_UNSET)", () => {
    it("the first sample after a reset only records a baseline, producing no jump", () => {
      const progress = shared(0);
      const lastY = shared(TAB_BAR_SCROLL_UNSET);
      // Screen was frozen deep down (e.g. 500px) and is reporting that real
      // position again — this must NOT be read as a 500px scroll delta.
      advanceTabBarCollapse(progress, lastY, 500);
      expect(progress.value).toBe(0);
      expect(lastY.value).toBe(500);
    });

    it("resumes normal incremental delta tracking from the resynced baseline", () => {
      const progress = shared(0);
      const lastY = shared(TAB_BAR_SCROLL_UNSET);
      advanceTabBarCollapse(progress, lastY, 500); // resync, no jump
      advanceTabBarCollapse(progress, lastY, 520); // real 20px scroll down
      expect(progress.value).toBeCloseTo(20 / TAB_BAR_COLLAPSE_DISTANCE, 5);
    });

    it("still honors the floor on the resync sample itself", () => {
      const progress = shared(1);
      const lastY = shared(TAB_BAR_SCROLL_UNSET);
      advanceTabBarCollapse(progress, lastY, 10);
      expect(progress.value).toBe(0);
      expect(lastY.value).toBe(10);
    });

    it("this exact scenario used to snap the bar shut before the fix (documented for clarity)", () => {
      // Old buggy behavior, reproduced with a literal 0 reset instead of
      // the sentinel, to make the regression concrete:
      const buggyProgress = shared(0);
      const buggyLastY = shared(0); // the old, incorrect reset value
      advanceTabBarCollapse(buggyProgress, buggyLastY, 500);
      expect(buggyProgress.value).toBe(1); // instantly fully collapsed — the bug

      // Fixed behavior with the sentinel:
      const fixedProgress = shared(0);
      const fixedLastY = shared(TAB_BAR_SCROLL_UNSET);
      advanceTabBarCollapse(fixedProgress, fixedLastY, 500);
      expect(fixedProgress.value).toBe(0); // just resynced, no jump
    });
  });
});
