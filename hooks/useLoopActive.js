// hooks/useLoopActive.js
//
// Sonsuz döngü animasyonları (nabız halkası, "canlı" noktası…) yalnız ekran
// odaktayken ve uygulama ön plandayken dönsün.
//
// NEDEN: sekme dondurma (enableFreeze) React render'ını durdurur, ama Reanimated
// `withRepeat` UI thread'de çalışır ve donmuş/üstü kapalı ekranda da her karede
// hesaplanmaya devam eder. Üstüne başka ekran açılan ya da arka plana atılan
// uygulamada bu boşa UI thread işi ve pil demek.
//
// Kullanım:
//   const active = useLoopActive();
//   useEffect(() => {
//     if (!active) { cancelAnimation(p); p.value = 0; return undefined; }
//     p.value = withRepeat(...);
//     return () => cancelAnimation(p);
//   }, [active, p]);

import useAppActive from "./useAppActive";
import useScreenFocused from "./useScreenFocused";

export default function useLoopActive() {
  const focused = useScreenFocused();
  const appActive = useAppActive();
  return focused && appActive;
}
