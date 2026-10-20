// hooks/useTabBarScrollSync.js
//
// Plain (non-Reanimated) ScrollView/FlatList screens feed their vertical
// offset into the tab bar's scroll-driven grow/shrink through this hook, so
// every tab behaves the same way — usePullToRefresh does the equivalent for
// screens already on Animated.FlatList + a worklet scroll handler.

import { useCallback } from "react";
import { useTabBarLayout } from "../context/TabBarLayoutContext";

export default function useTabBarScrollSync() {
  const { onTabBarScroll } = useTabBarLayout();
  return useCallback(
    (event) => {
      onTabBarScroll?.(event?.nativeEvent?.contentOffset?.y);
    },
    [onTabBarScroll],
  );
}
