// hooks/useDailyView.js
//
// Günlük Meydan Okuma görünümünü (müsait/tamamlandı, kalan süre, seri) saatle
// birlikte güncel tutar. Firestore'dan gelen `stats` günlük değildir; "bugün
// oynandı mı" ve "kalan süre" saate bağlı olduğu için ekran açıkken gece
// yarısı geçince de doğru duruma döner.

import { useEffect, useMemo, useState } from "react";
import { buildDailyView } from "@utils/dailyChallenge";

const TICK_MS = 30000;

export default function useDailyView(stats) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  return useMemo(() => ({ ...buildDailyView(stats, now), now }), [stats, now]);
}
