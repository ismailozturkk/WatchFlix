// services/premiumUpsell.js
//
// Limit dolduğunda ya da Premium'a özel bir özelliğe dokunulduğunda gösterilen
// TEK yükseltme akışı ve ödeme ekranına geçiş. Kapılar (hooks/usePremiumGate.js)
// bunu çağırır.
//
// Eskiden burası genel bir uyarı kutusu (appAlert: "Limite ulaştın" + paragraf)
// açıyordu. Artık özelliğe özel bir yükseltme sayfası açılır
// (components/premium/PremiumUpsellSheet.js): ne doldu, planlar arasındaki fark,
// başka ne kazanırsın, gerçek mağaza fiyatı. İçerik modeli
// utils/premiumUpsellContent.js'te, imperatif köprü services/premiumUpsellHost.js'te.
import { nextPlanFor, normalizePlan } from "../utils/premiumFeatures";
import { ANALYTICS_EVENTS, trackEvent } from "./analytics";
import { presentUpsell } from "./premiumUpsellHost";
import { navigateRoot } from "./rootNavigation";

/**
 * PremiumScreen'i açar. `source` hangi kapının ödeme ekranına getirdiğini
 * analytics'e taşır (PremiumScreen PAYWALL_VIEW olayına yazar).
 */
export function openPremiumScreen(source = "unknown") {
  return navigateRoot("PremiumScreen", { source });
}

/**
 * Yükseltme sayfasını gösterir. Üst plan yoksa (Premium Max'te dolan limit)
 * sayfa yalnız bilgi verir ve tek "Tamam" düğmesi sunar.
 *
 * @param {string} featureId
 * @param {string} plan
 * @param {{ used?: number, onUpgrade?: () => void, onDismiss?: () => void,
 *   preview?: { kind: "poster"|"backdrop", fromUri?: string|null, toUri: string } }} [options]
 *   used: sayılı özellikte sahip olunan adet / günlük kullanım (gösterge için)
 *   preview: özel afiş/arka plan — seçilmeye çalışılan görsel (sayfa "Şimdi → Seçtiğin" çizer)
 */
export function showPremiumLimitAlert(featureId, plan, { used, onUpgrade, onDismiss, preview } = {}) {
  trackEvent(ANALYTICS_EVENTS.PREMIUM_GATE_HIT, {
    feature: featureId,
    plan,
    can_upgrade: Boolean(nextPlanFor(featureId, normalizePlan(plan))),
  });

  presentUpsell({ featureId, plan, used, onUpgrade, onDismiss, preview });
}
