// services/premiumUsage.js
//
// Günlük premium haklarının (oyun, CineSwipe odası/kartı) cihazdaki sayacı.
// Saf mantık utils/dailyUsage.js'te; burası depolama + React köprüsü.
//
// Sayaç cihazda tutulur: uygulama verisini silen kullanıcı bugünkü hakkını
// sıfırlayabilir. Bu özelliklerin sunucu maliyeti düşük olduğu için bilinçli
// bir tercih; maliyetli olanlar (AI, platform bildirimleri) sunucuda sayılır.
import { useMemo } from "react";
import { Keys, get, set, useStored } from "./storage";
import { localDayKey, readDailyCount, withDailyDelta } from "../utils/dailyUsage";

export function getDailyUsed(featureId, options) {
  return readDailyCount(get(Keys.premiumDailyUsage, options), featureId, localDayKey());
}

/** Sayacı değiştirir (varsayılan +1; iade için -1). Yeni değeri döner. */
export function addDailyUse(featureId, delta = 1, options) {
  const next = withDailyDelta(
    get(Keys.premiumDailyUsage, options),
    featureId,
    delta,
    localDayKey(),
  );
  set(Keys.premiumDailyUsage, next, options);
  return readDailyCount(next, featureId, next.day);
}

/** Bugünkü kullanım; sayaç değişince yeniden çizer. */
export function useDailyUsed(featureId) {
  const state = useStored(Keys.premiumDailyUsage);
  // Gün değişimi render'ı tetiklemez; bir sonraki render yeni günü okur.
  const day = localDayKey();
  return useMemo(() => readDailyCount(state, featureId, day), [state, featureId, day]);
}
