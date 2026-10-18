// hooks/usePullToRefresh.js
//
// Ana ekranlarda (Film, Dizi) aşağı çekerek içerikleri yenilemek için kanca. usePullToSearch'ün
// yerini alır: aşağı çekme artık arama açmaz, veri çeker.
//
// Eskiden çekme boyunca listenin başındaki arama çubuğu hafifçe büyürdü (`animatedSearchStyle`).
// Arama düğmesi Film/Dizi anahtarının yanına, listenin DIŞINDA yüzen satıra taşındığı için
// (screens/tabs/DiscoverScreen.js) o efekt kalktı; kanca artık yalnız yenileme durumunu ve
// alt sekme çubuğunun kaydırma bağlantısını sürer.

import { useCallback, useState } from "react";
import { useAnimatedScrollHandler } from "react-native-reanimated";
import { useTabBarLayout } from "../context/TabBarLayoutContext";
import { advanceTabBarCollapse } from "../utils/tabBarCollapse";

/**
 * @param {() => Promise<void>} onRefresh — Context'in refreshAll fonksiyonu.
 * @returns {{ refreshing, onScroll, handleRefresh }}
 */
export default function usePullToRefresh(onRefresh) {
  const [refreshing, setRefreshing] = useState(false);
  const { tabBarCollapse, tabBarLastScrollY } = useTabBarLayout();

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh?.();
    } catch {
      // Ağ hatası — sessizce geç, cache hâlâ gösterilecek.
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh, refreshing]);

  const onScroll = useAnimatedScrollHandler((event) => {
    // Runs entirely on the UI thread — no runOnJS/bridge hop — so the tab
    // bar's scroll-linked resize stays perfectly in sync with fast flicks.
    if (tabBarCollapse && tabBarLastScrollY) {
      advanceTabBarCollapse(tabBarCollapse, tabBarLastScrollY, event.contentOffset.y);
    }
  });

  return {
    refreshing,
    onScroll,
    handleRefresh,
  };
}
