// hooks/usePullToRefresh.js
//
// Ana ekranlarda (Film, Dizi) aşağı çekerek içerikleri yenilemek için özel
// animasyonlu RefreshControl hook'u. usePullToSearch'ün yerini alır:
// aşağı çekme artık arama açmaz, veri çeker.
//
// Animasyon: Arama çubuğu çekme boyunca hafifçe büyüyüp geri döner (eski
// usePullToSearch efekti), ardından veri yenileme tetiklenir.
//
// `animatedSearchStyle` DİNLENMEDE KİMLİKTİR (scale 1, opaklık yok): Reanimated 4.5
// her React render'ında animasyonlu stilin İLK değerini görünümün JS stiline geri
// yazar ve gerçek değeri yerel kayıttan geri uygular; kayıt geç kalırsa/boşalırsa
// ekranda kalan şey ilk değerdir. İlk değer kimlik olunca bu yarış zararsızdır
// (bkz. components/home/DiscoverSearchButton.js).
//
// Ölçek EŞİT yönlü: eski scaleX 1.06 / scaleY 1.22 çiftindeki orantısızlık hapın
// içindeki metni ve ikonları dikeyde eziyordu.

import { useCallback, useState } from "react";
import {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useTabBarLayout } from "../context/TabBarLayoutContext";
import { advanceTabBarCollapse } from "../utils/tabBarCollapse";

const PULL_THRESHOLD = 90;
/** Tam çekilmiş arama çubuğunun ölçeği. */
export const PULL_MAX_SCALE = 1.035;

/**
 * @param {() => Promise<void>} onRefresh — Context'in refreshAll fonksiyonu.
 * @returns {{ refreshing, animatedSearchStyle, onScroll, handleRefresh }}
 */
export default function usePullToRefresh(onRefresh) {
  const [refreshing, setRefreshing] = useState(false);
  const progress = useSharedValue(0);
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
    const pullDistance = Math.max(0, -event.contentOffset.y);
    if (pullDistance > 0) {
      progress.value = Math.min(pullDistance / PULL_THRESHOLD, 1);
    } else if (progress.value > 0) {
      progress.value = withSpring(0, { damping: 16, stiffness: 180 });
    }
    // Runs entirely on the UI thread — no runOnJS/bridge hop — so the tab
    // bar's scroll-linked resize stays perfectly in sync with fast flicks.
    if (tabBarCollapse && tabBarLastScrollY) {
      advanceTabBarCollapse(tabBarCollapse, tabBarLastScrollY, event.contentOffset.y);
    }
  });

  const animatedSearchStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0, 1],
          [1, PULL_MAX_SCALE],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return {
    refreshing,
    animatedSearchStyle,
    onScroll,
    handleRefresh,
  };
}
