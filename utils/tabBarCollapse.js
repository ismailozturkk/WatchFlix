// utils/tabBarCollapse.js
//
// Scroll-driven tab bar grow/shrink, expressed as a continuous 0..1
// "collapse progress" instead of a two-state (minimized/expanded) flag.
// Every pixel of scroll nudges the value, so the bar keeps resizing for as
// long as the scroll gesture continues — it never jumps between two fixed
// sizes once a threshold is crossed.
//
// Marked "worklet" so the same function can run directly on the UI thread
// inside a useAnimatedScrollHandler (fully bridge-free) and be called as a
// plain function from a regular JS onScroll callback for screens still on a
// plain ScrollView/FlatList.

// How much the bar shrinks at full collapse: 20% smaller, nothing else about
// it changes. ONE number for both bars — the JS bar (Android, iOS fallbacks;
// components/navigation/TabBar.js) and the real UIKit bar on iOS 26+ (scaled by
// modules/tab-bar-scale through services/tabBarScale.js).
export const TAB_BAR_COLLAPSE_SCALE_DELTA = 0.2;
export const TAB_BAR_MIN_SCALE = 1 - TAB_BAR_COLLAPSE_SCALE_DELTA;

// Rollback switch for the iOS 26 native scaling. `false` puts the system's own
// minimize-on-scroll back (`tabBarMinimizeBehavior: "onScrollDown"`) and stops
// touching the UITabBar entirely — no native rebuild needed, just JS.
export const TAB_BAR_NATIVE_SCALE_ENABLED = true;

// The native bridge is fed every ~1% of collapse progress, not every frame:
// each push is a UI→JS hop, and a 20% shrink has nothing finer to show.
export const TAB_BAR_NATIVE_STEP = 0.01;

// Scroll distance (px) needed to fully collapse or fully expand the bar.
export const TAB_BAR_COLLAPSE_DISTANCE = 70;
// Below this offset the bar is always fully expanded — collapsing right at
// the top of a list, where there's nothing left to scroll past, reads as
// broken rather than responsive.
export const TAB_BAR_COLLAPSE_FLOOR = 24;

// Sentinel for `lastScrollY`: "no baseline recorded yet — the next sample
// should just establish one, not compute a delta from it." Used both for
// the very first scroll event ever, and after a tab switch (see
// AdaptiveTabShell, which resets to this instead of 0).
//
// Resetting to a real 0 instead of this sentinel was the actual bug: a
// screen frozen (not unmounted) while scrolled deep down keeps its real
// native scroll position — switching away and back to it, then scrolling
// even 1px, produced a `delta` of "current position minus 0", i.e. the
// screen's entire scroll depth in one tick, which instantly snapped the bar
// to fully collapsed instead of resuming a smooth, incremental response.
export const TAB_BAR_SCROLL_UNSET = -1;

// Should the native bridge hear about `next`, given the `last` value it was sent
// (-1 = nothing sent yet)? Always at the two rest positions so the bar can never
// be left a hair short of full size or full shrink.
export function shouldForwardCollapse(last, next) {
  "worklet";
  if (last < 0) return true;
  if (next === last) return false;
  if (next === 0 || next === 1) return true;
  return Math.abs(next - last) >= TAB_BAR_NATIVE_STEP;
}

export function advanceTabBarCollapse(collapseProgress, lastScrollY, offsetY) {
  "worklet";
  if (typeof offsetY !== "number" || Number.isNaN(offsetY)) return;
  const y = offsetY > 0 ? offsetY : 0;

  if (lastScrollY.value < 0) {
    // First sample since a reset — record the baseline only.
    lastScrollY.value = y;
    if (y <= TAB_BAR_COLLAPSE_FLOOR) collapseProgress.value = 0;
    return;
  }

  const delta = y - lastScrollY.value;
  lastScrollY.value = y;

  if (y <= TAB_BAR_COLLAPSE_FLOOR) {
    collapseProgress.value = 0;
    return;
  }

  const next = collapseProgress.value + delta / TAB_BAR_COLLAPSE_DISTANCE;
  collapseProgress.value = next < 0 ? 0 : next > 1 ? 1 : next;
}
