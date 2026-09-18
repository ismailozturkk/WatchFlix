// hooks/usePremiumGate.js
//
// Premium kapıları. Limitler utils/premiumFeatures.js'ten, plan
// PremiumContext'ten (RevenueCat + sunucu) gelir; limit dolunca uyarıyı ve
// ödeme ekranına geçişi services/premiumUpsell.js gösterir.
//
// KURAL — işi BAŞLATAN sayılır, karşı taraf değil: arkadaşlık isteğini kabul
// etmek, odaya/gruba/ortak listeye katılmak, mesaj almak hiçbir kapıdan
// geçmez. Böylece premium kullanıcı Free arkadaşlarıyla engelsiz etkileşir.
//
//   const gate = usePremiumGate("custom_lists");
//   if (!gate.check(otherListKeys.length)) return;   // doluysa uyarır
//
//   const games = usePremiumDailyGate("games");
//   if (!games.check()) return;   // bugünkü hak bittiyse uyarır
//   games.consume();              // oyun gerçekten başlayınca
import { useCallback, useMemo } from "react";
import { usePremium } from "../context/PremiumContext";
import {
  canUseFeature,
  getFeatureLimit,
  isUnlimitedFor,
  remainingUses,
} from "../utils/premiumFeatures";
import { showPremiumLimitAlert, openPremiumScreen } from "../services/premiumUpsell";
import { addDailyUse, getDailyUsed, useDailyUsed } from "../services/premiumUsage";

export function usePremiumGate(featureId) {
  const { plan } = usePremium();

  const allows = useCallback(
    (used = 0) => canUseFeature(featureId, plan, used),
    [featureId, plan],
  );

  /** İzin varsa true; yoksa limit uyarısını gösterip false döner. */
  const check = useCallback(
    (used = 0, options) => {
      if (canUseFeature(featureId, plan, used)) return true;
      showPremiumLimitAlert(featureId, plan, options);
      return false;
    },
    [featureId, plan],
  );

  const showUpsell = useCallback(
    (options) => showPremiumLimitAlert(featureId, plan, options),
    [featureId, plan],
  );

  const openPlans = useCallback(() => openPremiumScreen(featureId), [featureId]);

  return useMemo(
    () => ({
      featureId,
      plan,
      limit: getFeatureLimit(featureId, plan),
      unlimited: isUnlimitedFor(featureId, plan),
      allows,
      check,
      showUpsell,
      openPlans,
    }),
    [allows, check, featureId, openPlans, plan, showUpsell],
  );
}

/**
 * Günlük haklar (oyun, CineSwipe). Sayaç cihazda; `used`/`remaining`
 * sayaç değişince yeniden çizer.
 */
export function usePremiumDailyGate(featureId) {
  const gate = usePremiumGate(featureId);
  const used = useDailyUsed(featureId);
  const { plan } = gate;

  // Render anındaki değer yerine depodan taze okunur: aynı karede art arda
  // gelen iki dokunuş eski `used` ile ikisi de geçmesin.
  const check = useCallback(
    (options) => gate.check(getDailyUsed(featureId), options),
    [featureId, gate],
  );

  const consume = useCallback((delta = 1) => addDailyUse(featureId, delta), [featureId]);
  const refund = useCallback(() => addDailyUse(featureId, -1), [featureId]);

  /** Kontrol + harcama tek adımda; izin yoksa uyarır ve false döner. */
  const tryConsume = useCallback(
    (options) => {
      if (!check(options)) return false;
      addDailyUse(featureId, 1);
      return true;
    },
    [check, featureId],
  );

  return useMemo(
    () => ({
      ...gate,
      used,
      remaining: remainingUses(featureId, plan, used),
      check,
      consume,
      refund,
      tryConsume,
    }),
    [check, consume, featureId, gate, plan, refund, tryConsume, used],
  );
}
