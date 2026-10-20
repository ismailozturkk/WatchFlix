// utils/premiumShowcase.js
//
// Ayarlar ana ekranındaki Free vitrininin (components/settings/PremiumSettingsCard.js) SAF
// içerik modeli: "Free'de şu, Premium'da şu" karşılaştırma karoları, ek avantaj çipleri ve
// düğmenin altındaki GERÇEK fiyat satırı.
//
// Vitrin kendi başına bir sayı ya da vaat ÜRETMEZ (utils/premiumFeatures.js'in "burada
// olmayan bir şey satılamaz" kuralı): karolardaki rakamlar kayıttan okunur, yani limit
// değişince kart kendiliğinden güncellenir; ödeme ekranındaki tabloyla çelişemez. Burada
// yalnız HANGİ özelliklerin vitrine çıkacağı ve kısa etiketleri seçilir. Fiyat da mağazanın
// imzalı ürün fiyatıdır (PremiumScreen ile aynı yardımcılar); mağaza cevap vermediyse fiyat
// satırı çizilmez, uydurma bir tutar yazılmaz.

import { pickByLanguage, normalizeAppLanguage } from "./appLanguages";
import {
  PREMIUM_PLAN,
  getPackageDisplayProduct,
  getPackageIntroOffer,
  getPackagePeriodKey,
  getPackageRegularPrice,
  getPackagesForTier,
} from "./premium";
import {
  formatFeatureValue,
  getFeature,
  getFeatureLimit,
  isLockedFor,
} from "./premiumFeatures";

const { FREE, PREMIUM } = PREMIUM_PLAN;

/**
 * Karşılaştırma karoları: kullanıcının ilk sınırı en çok hissettiği üç sayı. `pick`, kayıtta
 * sayının nerede durduğunu söyler (AI kotasında günlük tavan, diğerlerinde limitin kendisi).
 */
const HIGHLIGHTS = Object.freeze([
  {
    id: "ai_messages",
    icon: "sparkles",
    tint: "accent",
    pick: (limit) => limit.daily,
    label: { tr: "AI mesajı / gün", en: "AI chats / day", es: "Chats IA/día", pt: "Conversas de IA/dia", de: "KI-Chats / Tag" },
  },
  {
    id: "friends",
    icon: "people",
    tint: "green",
    pick: (limit) => limit,
    label: { tr: "Arkadaş", en: "Friends", es: "Amigos", pt: "Amigos", de: "Freunde" },
  },
  {
    id: "custom_lists",
    icon: "albums",
    tint: "orange",
    pick: (limit) => limit,
    label: { tr: "Özel liste", en: "Custom lists", es: "Mis listas", pt: "Minhas listas", de: "Eigene Listen" },
  },
]);

const formatCount = (value) => (Number.isFinite(value) ? String(value) : "∞");

/**
 * Üç karşılaştırma karosu: `{ id, icon, tint, label, from, to }`. `from` Free'deki, `to`
 * Premium'daki değer (metin). Kayıtta bir özellik silinirse o karo düşer (boş kart yerine).
 */
export function buildShowcaseHighlights(language = "en") {
  const lang = normalizeAppLanguage(language);
  return HIGHLIGHTS.map((item) => {
    if (!getFeature(item.id)) return null;
    const free = getFeatureLimit(item.id, FREE);
    const premium = getFeatureLimit(item.id, PREMIUM);
    return {
      id: item.id,
      icon: item.icon,
      tint: item.tint,
      label: pickByLanguage(lang, item.label),
      from: formatCount(item.pick(free)),
      to: formatCount(item.pick(premium)),
    };
  }).filter(Boolean);
}

/**
 * "Ayrıca" çipleri: Free'de KAPALI/KISITLI olup Premium'da açılan, tek kelimeyle okunan şeyler.
 * Çip yalnız kayıt gerçekten öyle diyorsa çıkar (oyun Free'de kapalıysa "Oyun ve CineSwipe"
 * yazılır; bir gün Free'ye açılırsa kendiliğinden düşer).
 */
export function buildShowcasePerks(language = "en") {
  const lang = normalizeAppLanguage(language);
  const perks = [];
  if (isLockedFor("games", FREE) && !isLockedFor("games", PREMIUM)) {
    perks.push({
      id: "play",
      icon: "game-controller",
      label: pickByLanguage(lang, {
        tr: "Oyun ve CineSwipe",
        en: "Games & CineSwipe",
        es: "Juegos y CineSwipe",
        pt: "Jogos e CineSwipe",
        de: "Spiele & CineSwipe",
      }),
    });
  }
  if (isLockedFor("identity_badge", FREE) && !isLockedFor("identity_badge", PREMIUM)) {
    perks.push({ id: "badge", icon: "diamond", label: formatFeatureValue("identity_badge", PREMIUM, lang) });
  }
  if (getFeatureLimit("font_catalog", PREMIUM) && !getFeatureLimit("font_catalog", FREE)) {
    // font_catalog ACCESS: Free'de de bir alt küme açık; çip "56 yazı tipi" sayısını söyler.
    perks.push({ id: "fonts", icon: "text", label: formatFeatureValue("font_catalog", PREMIUM, lang) });
  }
  return perks;
}

// ── Fiyat satırı ─────────────────────────────────────────────────────────────

const PERIOD_SUFFIX = Object.freeze({
  monthly: { tr: "/ ay", en: "/ month", es: "/ mes", pt: "/ mês", de: "/ month" },
  annual: { tr: "/ yıl", en: "/ year", es: "/ año", pt: "/ ano", de: "/ year" },
});

/** "İlk 3 ay" / "First 3 months" (PremiumScreen.offerDurationLabel'in kısa kardeşi). */
function offerDuration(offer, lang) {
  const count = (offer.cycles || 1) * (offer.unitCount || 1);
  const one = count === 1;
  const units = {
    day: pickByLanguage(lang, { tr: "gün", en: one ? "day" : "days", es: one ? "día" : "días", pt: one ? "dia" : "dias", de: one ? "Tag" : "Tage" }),
    week: pickByLanguage(lang, { tr: "hafta", en: one ? "week" : "weeks", es: one ? "semana" : "semanas", pt: one ? "semana" : "semanas", de: one ? "Woche" : "Wochen" }),
    month: pickByLanguage(lang, { tr: "ay", en: one ? "month" : "months", es: one ? "mes" : "meses", pt: one ? "mês" : "meses", de: one ? "Monat" : "Monate" }),
    year: pickByLanguage(lang, { tr: "yıl", en: one ? "year" : "years", es: one ? "año" : "años", pt: one ? "ano" : "anos", de: one ? "Jahr" : "Jahre" }),
  };
  const unit = units[offer.unit];
  if (!unit) return pickByLanguage(lang, { tr: "İlk dönem", en: "Intro", es: "Inicial", pt: "Inicial", de: "Einführung" });
  if (lang === "es") return one ? `${unit} inicial` : `${count} ${unit} iniciales`;
  if (lang === "tr") return one ? `İlk ${unit}` : `İlk ${count} ${unit}`;
  return one ? `First ${unit}` : `First ${count} ${unit}`;
}

/**
 * Düğmenin altındaki fiyat bilgisi: Premium'un en ucuz GERÇEK paketi (aylık, yoksa yıllık)
 * ve varsa kullanıcının yararlanabileceği giriş teklifi. Mağaza henüz cevap vermediyse /
 * paket yoksa `null` (çağıran genel metni gösterir).
 *
 * @returns {null | { price: string, period: string, offer: null | { free: boolean, percent: number, duration: string } }}
 */
export function buildShowcasePricing({
  packages,
  introEligibleIds = [],
  usingTestStore = false,
  language = "en",
} = {}) {
  const lang = normalizeAppLanguage(language);
  const tier = getPackagesForTier(Array.isArray(packages) ? packages : [], PREMIUM)
    .map((item) => ({ ...item, product: getPackageDisplayProduct(item, { usingTestStore, language: lang }) }))
    .filter((item) => ["monthly", "annual"].includes(getPackagePeriodKey(item)));
  const chosen =
    tier.find((item) => getPackagePeriodKey(item) === "monthly") ||
    tier.find((item) => getPackagePeriodKey(item) === "annual") ||
    null;
  if (!chosen) return null;

  const regular = getPackageRegularPrice(chosen);
  if (!regular.priceString) return null;
  const offer = getPackageIntroOffer(chosen, {
    iosIntroEligible: (introEligibleIds || []).includes(chosen?.product?.identifier),
  });

  return {
    price: regular.priceString,
    period: PERIOD_SUFFIX[getPackagePeriodKey(chosen)][lang] || PERIOD_SUFFIX[getPackagePeriodKey(chosen)].en,
    offer: offer
      ? { free: Boolean(offer.free), percent: offer.percent, duration: offerDuration(offer, lang) }
      : null,
  };
}

/** Teklifin düz yazı hâli: "İlk 3 ay %50 indirim" / "First 3 months 50% off" / "İlk ay ücretsiz". */
export function showcaseOfferText(offer, language = "en") {
  if (!offer) return "";
  const lang = normalizeAppLanguage(language);
  if (offer.free) {
    return pickByLanguage(lang, {
      tr: `${offer.duration} ücretsiz`,
      en: `${offer.duration} free`,
      es: `${offer.duration} gratis`,
      pt: `${offer.duration} grátis`,
      de: `${offer.duration} kostenlos`,
    });
  }
  return pickByLanguage(lang, {
    tr: `${offer.duration} %${offer.percent} indirim`,
    en: `${offer.duration} ${offer.percent}% off`,
    es: `${offer.duration} -${offer.percent} %`,
    pt: `${offer.duration} -${offer.percent}%`,
    de: `${offer.duration} ${offer.percent} % Rabatt`,
  });
}

/**
 * Düğmenin ikinci satırı: gerçek fiyat varsa "₺59,99 / ay · İstediğin an iptal", yoksa genel.
 * `inlineOffer`: dar ekranda rozet sığmaz; teklif bu satırın içine yazılır ("₺59,99 / ay ·
 * İlk 3 ay %50 indirim") ve "iptal" cümlesi düşer.
 */
export function showcaseCtaSubtitle(pricing, language = "en", { inlineOffer = false } = {}) {
  const lang = normalizeAppLanguage(language);
  const cancel = pickByLanguage(lang, {
    tr: "İstediğin an iptal",
    en: "Cancel anytime",
    es: "Cancela cuando quieras",
    pt: "Cancele quando quiser",
    de: "Jederzeit kündbar",
  });
  if (!pricing) {
    return pickByLanguage(lang, {
      tr: "Doğrudan fiyatlandırma · Dilediğin an iptal",
      en: "Direct pricing · Cancel anytime",
      es: "Precios claros · Cancela cuando quieras",
      pt: "Preços claros · Cancele quando quiser",
      de: "Direkter Preis · Jederzeit kündbar",
    });
  }
  const tail = inlineOffer && pricing.offer ? showcaseOfferText(pricing.offer, lang) : cancel;
  return `${pricing.price} ${pricing.period} · ${tail}`;
}

/** Teklif rozetinin iki satırı: büyük ("-%50" / "Ücretsiz") ve küçük ("İlk 3 ay"). */
export function showcaseOfferBadge(offer, language = "en") {
  if (!offer) return null;
  const lang = normalizeAppLanguage(language);
  const big = offer.free
    ? pickByLanguage(lang, { tr: "Ücretsiz", en: "Free", es: "Gratis", pt: "Grátis", de: "Kostenlos" })
    : lang === "tr"
      ? `%${offer.percent}`
      : lang === "es"
        ? `-${offer.percent} %`
        : lang === "pt" ? `-${offer.percent}%` : lang === "de" ? `${offer.percent} % Rabatt` : `${offer.percent}% off`;
  return { big, small: offer.duration };
}
