import { createContext, useContext } from "react";
import { TAB_BAR_SCROLL_UNSET } from "../utils/tabBarCollapse";

export const TabBarLayoutContext = createContext({
  contentBottom: 110,
  // Continuous 0..1 scroll-collapse progress (a Reanimated shared value in
  // the real provider). Plain object fallback keeps `.value` reads safe for
  // any consumer rendered outside AdaptiveTabShell (e.g. in tests).
  tabBarCollapse: { value: 0 },
  tabBarLastScrollY: { value: TAB_BAR_SCROLL_UNSET },
  onTabBarScroll: () => {},
});
export const useTabBarLayout = () => useContext(TabBarLayoutContext);
