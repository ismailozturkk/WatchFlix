// utils/premiumTopBanner.js
//
// Free kullanıcının her ekranın en üstünde gördüğü ince "Premium'a geç" şeridinin saf
// kararları (çizim: components/premium/PremiumTopBanner.js, yerleşim:
// components/premium/PremiumTopBannerLayout.js — kök stack'in `screenLayout`'u).
//
// Kime: oturumu açık, profilini tamamlamış, planı Free olan kullanıcı. Mağaza cevabı
// beklenirken (`loading`) çizilmez: abone kullanıcıda açılışta bir an görünüp kaybolmasın.
// Premium / Premium Max olunca şerit kendiliğinden kalkar (plan değişince yeniden çizim).
//
// Nerede DEĞİL: aşağıdaki rotalar. Gerekçeler satır yanında; yeni tam ekran / kendi
// yerleşimini ölçen bir rota eklenirse buraya da eklenmeli.

import { PREMIUM_PLAN } from "./premium";

/** Ödeme ekranına giderken analytics `source` değeri. */
export const PREMIUM_TOP_BANNER_SOURCE = "top_banner";

/** Şeridin kendi yüksekliği (güvenli alan ve dış boşluklar hariç). */
export const PREMIUM_TOP_BANNER_HEIGHT = 36;
/**
 * Şeridin üst/alt dış boşluğu. Üstte durum çubuğundan net ayrılsın; altta küçük: ekran
 * kendi başlık boşluğunu (genelde 8–16) zaten ekliyor, ikisi üst üste şişmesin.
 */
export const PREMIUM_TOP_BANNER_GAP_TOP = 8;
export const PREMIUM_TOP_BANNER_GAP_BOTTOM = 2;

/**
 * Yüzen şeridin gerçek güvenli alanın ALTINA taştığı yükseklik: ekran gövdesinin üst
 * güvenli alanı bu kadar büyütülür, içerik şeridin altından başlar.
 * `statusTop`: durum çubuğunun alt kenarı (Android'de güvenli alandan büyük olabilir).
 */
export function premiumTopBannerOverlap(insetTop, statusTop = insetTop) {
  const inset = Math.max(0, Number(insetTop) || 0);
  const status = Math.max(inset, Number(statusTop) || 0);
  return (
    status +
    PREMIUM_TOP_BANNER_GAP_TOP +
    PREMIUM_TOP_BANNER_HEIGHT +
    PREMIUM_TOP_BANNER_GAP_BOTTOM -
    inset
  );
}

/** Alt başlık ("Sınırları kaldır") bu genişliğin altında sığmaz; gizlenir. */
export const PREMIUM_TOP_BANNER_SUBTITLE_MIN_WIDTH = 330;

/**
 * Akan degradenin renkleri. Hepsi beyaz yazıyla okunur kalacak kadar doygun/koyu (en
 * açığı pembe-600, beyaza ≈4.6:1). Sabit: şerit her temada aynı "Premium" kimliğini taşır.
 */
export const PREMIUM_TOP_BANNER_COLORS = Object.freeze(["#4F46E5", "#7C3AED", "#C026D3", "#DB2777"]);

/** Parıltı ikonunun altın rengi. */
export const PREMIUM_TOP_BANNER_GOLD = "#FCD34D";

export const PREMIUM_TOP_BANNER_HIDDEN_ROUTES = Object.freeze(
  new Set([
    // Oturum öncesi: kullanıcı yok, plan yok
    "OnboardingScreen",
    "LoginScreen",
    "RegisterScreen",
    "ForgotPasswordScreen",
    "GoogleProfileCompletionScreen",
    // Planın kendisi: zaten ödeme / plan ekranındayken "Premium'a geç" demek yinelemedir
    "PremiumScreen",
    "PremiumUsageScreen",
    // Saydam kaplama: arkadaki ekranın üstüne açılır (kendi şeridi yok)
    "UnifiedSearch",
    // Tam ekran deneyimler: tuval/hikâye pencereyi ölçer, şerit yerleşimi bozar
    "WrappedScreen",
    "StoryShareScreen",
    "StoryDraftsScreen",
    // Sohbet: klavye + yazma alanı ekranın tamamını kullanır; konuşmayı bölmesin
    "ChatScreen",
    // Oyun / kaydırma ekranları: sürükleme ve süre sayacı tam alan ister
    "CineSwipeScreen",
    "SceneGamePlayScreen",
    "QuickGameScreen",
    "OlderGameScreen",
    "FilmChainScreen",
    "CinemaBingoScreen",
    // Geliştirici ekranı
    "UsageDebugScreen",
  ]),
);

/**
 * @param {{ plan?: string, routeName?: string, signedIn?: boolean, loading?: boolean }} input
 */
export function shouldShowPremiumTopBanner({ plan, routeName, signedIn, loading } = {}) {
  if (!signedIn || loading) return false;
  if (plan !== PREMIUM_PLAN.FREE) return false;
  if (routeName && PREMIUM_TOP_BANNER_HIDDEN_ROUTES.has(routeName)) return false;
  return true;
}

/**
 * Degradenin tekrarlanan durakları: [a,b,c,d,a,b,c,d,a]. Şerit genişliğinin 3 katı bir
 * katmana yayılır; katman bir periyot (genişliğin 1,5 katı) sola kayınca desen başa
 * döner — döngü dikişsiz.
 */
export function premiumTopBannerFlowStops(colors = PREMIUM_TOP_BANNER_COLORS) {
  return [...colors, ...colors, colors[0]];
}

/** Akış katmanı genişliği ve döngünün kaydırma mesafesi (şerit genişliğine göre). */
export function premiumTopBannerFlowGeometry(width, colors = PREMIUM_TOP_BANNER_COLORS) {
  const w = Math.max(1, Number(width) || 0);
  const layerWidth = w * 3;
  const segments = colors.length * 2;
  return { layerWidth, period: (layerWidth * colors.length) / segments };
}

/** Şerit metinleri. `language`: tr | en | es | pt | de (bilinmeyen → en). */
export function premiumTopBannerCopy(language) {
  if (language === "tr") {
    return { title: "Premium'a geç", subtitle: "Sınırları kaldır", cta: "Yükselt" };
  }
  if (language === "es") {
    return { title: "Hazte Premium", subtitle: "Sin límites", cta: "Mejorar" };
  }
  if (language === "pt") {
    return { title: "Seja Premium", subtitle: "Sem limites", cta: "Assinar" };
  }
  if (language === "de") {
    return { title: "Premium holen", subtitle: "Ohne Limits", cta: "Upgrade" };
  }
  return { title: "Go Premium", subtitle: "Remove the limits", cta: "Upgrade" };
}

/** Ekran okuyucu etiketi: eylem + nereye gittiği. */
export function premiumTopBannerAccessibilityLabel(language) {
  const copy = premiumTopBannerCopy(language);
  const tail =
    language === "tr"
      ? "planları gör"
      : language === "es"
        ? "ver planes"
        : language === "pt"
          ? "ver planos"
          : language === "de"
            ? "Pläne ansehen"
            : "see plans";
  return `${copy.title}, ${copy.subtitle}, ${tail}`;
}
