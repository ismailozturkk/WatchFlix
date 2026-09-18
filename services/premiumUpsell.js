// services/premiumUpsell.js
//
// Limit dolduğunda ya da Premium'a özel bir özelliğe dokunulduğunda gösterilen
// TEK uyarı ve ödeme ekranına geçiş. Kapılar (hooks/usePremiumGate.js) bunu
// çağırır; metin utils/premiumFeatures.js'ten üretilir.
import i18n from "../translations";
import { appAlert } from "../components/AppAlert";
import { buildLimitCopy } from "../utils/premiumFeatures";
import { ANALYTICS_EVENTS, trackEvent } from "./analytics";
import { navigateRoot } from "./rootNavigation";

const currentLanguage = () =>
  String(i18n.language || "tr").startsWith("tr") ? "tr" : "en";

/**
 * PremiumScreen'i açar. `source` hangi kapının ödeme ekranına getirdiğini
 * analytics'e taşır (bkz. revenueCatService.presentRevenueCatPaywall).
 */
export function openPremiumScreen(source = "unknown") {
  return navigateRoot("PremiumScreen", { source });
}

/**
 * Limit uyarısı: plan limitini ve üst planların değerini söyler, "Planları gör"
 * ile ödeme ekranına geçer. Üst plan yoksa (Premium Max'te dolan limit) yalnız
 * bilgi verir.
 */
export function showPremiumLimitAlert(featureId, plan, { onUpgrade, onDismiss } = {}) {
  const language = currentLanguage();
  const tr = language === "tr";
  const { title, message, canUpgrade } = buildLimitCopy(featureId, plan, language);

  trackEvent(ANALYTICS_EVENTS.PREMIUM_GATE_HIT, {
    feature: featureId,
    plan,
    can_upgrade: canUpgrade,
  });

  if (!canUpgrade) {
    appAlert(title, message, [
      { text: tr ? "Tamam" : "OK", onPress: onDismiss },
    ]);
    return;
  }

  appAlert(
    title,
    message,
    [
      { text: tr ? "Şimdi değil" : "Not now", style: "cancel", onPress: onDismiss },
      {
        text: tr ? "Planları gör" : "See plans",
        onPress: () => {
          onUpgrade?.();
          openPremiumScreen(featureId);
        },
      },
    ],
    { type: "info" },
  );
}
