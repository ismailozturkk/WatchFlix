// utils/premiumFeatures.js
//
// PREMIUM YETKİLERİNİN TEK KAYNAĞI.
//
// Neden tek dosya: 12 Ağustos'ta (P0.2) ödeme ekranı, uygulamada karşılığı
// olmayan vaatler ("reklamsız", "tüm Wrapped yılları", "sınırsız liste")
// gösterdiği için temizlenmişti; bir sonraki tasarım turunda aynı vaatler geri
// geldi. Kök neden vaat metni ile yetki kapısının ayrı yerlerde yaşamasıydı.
// Artık:
//   • Her ücretli fark burada BİR girdi: plan başına limit + ekranda görünen metin.
//   • Kapılar (hooks/usePremiumGate.js) limiti buradan okur.
//   • Ödeme ekranı, Ayarlar kartı ve Hakkında SSS'i metni buradan üretir.
// Burada olmayan bir şey satılamaz; burada olan her şeyin bir kapısı vardır.
//
// Sunucuda zorlanan limitlerin (AI kotası, platform bildirimleri) aynası
// functions/ altındadır; eşitliği __tests__/premiumFeatures.test.js doğrular.
//
// Bu modül SAF: React, depolama veya ağ import etmez (testlerde doğrudan
// çalışır, typographySettings gibi React dışı store'lar da kullanabilir).

import {
  AI_PLAN_LIMITS,
  PREMIUM_PLAN,
  getPremiumPlanDisplayName,
} from "./premium";

export const UNLIMITED = Infinity;

const PLAN_ORDER = Object.freeze([
  PREMIUM_PLAN.FREE,
  PREMIUM_PLAN.PREMIUM,
  PREMIUM_PLAN.UNLIMITED,
]);

export const PLANS = PLAN_ORDER;

export function normalizePlan(plan) {
  return PLAN_ORDER.includes(plan) ? plan : PREMIUM_PLAN.FREE;
}

export function planRank(plan) {
  return PLAN_ORDER.indexOf(normalizePlan(plan));
}

/** İki plandan yüksek olanı döner (bilinmeyen değer free sayılır). */
export function higherPlan(left, right) {
  return planRank(left) >= planRank(right)
    ? normalizePlan(left)
    : normalizePlan(right);
}

export const FEATURE_KIND = Object.freeze({
  /** Aç/kapa: minPlan ve üstü kullanır. */
  ACCESS: "access",
  /** Toplam adet: sahip olunan liste/arkadaş/grup sayısı. */
  COUNT: "count",
  /** Günlük hak: yerel gün değişince sıfırlanır. */
  DAILY: "daily",
  /** Günlük + aylık mesaj kotası; sunucuda (functions/aiQuota.js) zorlanır. */
  AI_QUOTA: "ai_quota",
});

const { ACCESS, COUNT, DAILY, AI_QUOTA } = FEATURE_KIND;

export const FEATURE_CATEGORIES = Object.freeze([
  {
    id: "ai",
    icon: "sparkles",
    color: "#8B5CF6",
    title: { tr: "CineMatch AI", en: "CineMatch AI" },
  },
  {
    id: "social",
    icon: "people",
    color: "#EC4899",
    title: { tr: "Sosyal", en: "Social" },
  },
  {
    id: "library",
    icon: "albums",
    color: "#10B981",
    title: { tr: "Kütüphane", en: "Library" },
  },
  {
    id: "play",
    icon: "game-controller",
    color: "#3B82F6",
    title: { tr: "Oyun & CineSwipe", en: "Games & CineSwipe" },
  },
  {
    id: "personal",
    icon: "color-palette",
    color: "#F59E0B",
    title: { tr: "Kişiselleştirme", en: "Personalization" },
  },
  {
    id: "alerts",
    icon: "notifications",
    color: "#06B6D4",
    title: { tr: "Bildirim & Arşiv", en: "Alerts & Archive" },
  },
]);

/**
 * Ücretsiz yazı tipleri: her rol (başlık / gövde / rakam) için en az iki
 * okunaklı seçenek. Geri kalan katalog Premium'dadır.
 */
export const FREE_FONT_PRESET_IDS = Object.freeze([
  "system",
  "barlow",
  "lexend",
  "bitter",
  "spaceMono",
  "oswald",
  "playfairDisplay",
]);

/** Katalogdaki toplam yazı tipi sayısı (utils/typographyRoles.js FONT_PRESETS). */
export const FONT_CATALOG_SIZE = 56;

/** Hazır tema sayısı (theme/colors.js `themes`). */
export const PRESET_THEME_COUNT = 8;

/** Wrapped'ta ücretsiz görülen geriye dönük yıl sayısı (bu yıl + geçen yıl). */
export const FREE_WRAPPED_YEARS_BACK = 1;

const feature = (definition) =>
  Object.freeze({
    note: null,
    detail: null,
    enforcedBy: "client",
    ...definition,
  });

export const PREMIUM_FEATURES = Object.freeze({
  ai_messages: feature({
    id: "ai_messages",
    kind: AI_QUOTA,
    category: "ai",
    icon: "sparkles",
    enforcedBy: "server",
    limits: AI_PLAN_LIMITS,
    title: { tr: "CineMatch AI mesajı", en: "CineMatch AI messages" },
    detail: {
      tr: "Ruh haline ve izleme geçmişine göre film/dizi önerileri",
      en: "Movie and TV picks based on your mood and watch history",
    },
    phrase: {
      tr: (n) => `günde ${n} CineMatch AI mesajı gönderebilirsin`,
      en: (n) => `you can send ${n} CineMatch AI messages per day`,
    },
  }),
  identity_badge: feature({
    id: "identity_badge",
    kind: ACCESS,
    category: "social",
    icon: "diamond",
    enforcedBy: "server",
    minPlan: PREMIUM_PLAN.PREMIUM,
    title: { tr: "Profil kimlik rozeti", en: "Profile identity badge" },
    detail: {
      tr: "Profilinde ve arkadaşlarının gördüğü profil sayfanda",
      en: "On your profile and on the profile your friends see",
    },
    planValue: {
      [PREMIUM_PLAN.PREMIUM]: { tr: "Epik rozet", en: "Epic badge" },
      [PREMIUM_PLAN.UNLIMITED]: { tr: "Efsanevi rozet", en: "Legendary badge" },
    },
  }),
  friends: feature({
    id: "friends",
    kind: COUNT,
    category: "social",
    icon: "person-add",
    limits: { free: 30, premium: 150, unlimited: UNLIMITED },
    title: { tr: "Arkadaş", en: "Friends" },
    unit: { tr: "arkadaş", en: "friends" },
    note: {
      tr: "Gelen istekleri kabul etmek her zaman serbest",
      en: "Accepting incoming requests is always free",
    },
    phrase: {
      tr: (n) => `en fazla ${n} arkadaş ekleyebilirsin`,
      en: (n) => `you can add up to ${n} friends`,
    },
  }),
  chat_groups: feature({
    id: "chat_groups",
    kind: COUNT,
    category: "social",
    icon: "chatbubbles",
    limits: { free: 2, premium: 10, unlimited: UNLIMITED },
    title: { tr: "Kurduğun sohbet grubu", en: "Group chats you create" },
    unit: { tr: "grup", en: "groups" },
    note: {
      tr: "Birebir mesajlaşmak ve gruplara katılmak serbest",
      en: "Direct messages and joining groups are free",
    },
    phrase: {
      tr: (n) => `en fazla ${n} sohbet grubu kurabilirsin`,
      en: (n) => `you can create up to ${n} group chats`,
    },
  }),
  custom_lists: feature({
    id: "custom_lists",
    kind: COUNT,
    category: "library",
    icon: "list",
    limits: { free: 5, premium: 25, unlimited: UNLIMITED },
    title: { tr: "Özel liste", en: "Custom lists" },
    unit: { tr: "liste", en: "lists" },
    note: {
      tr: "İzleme listesi, izlenenler ve favoriler her planda sınırsız",
      en: "Watchlist, watched and favorites are unlimited on every plan",
    },
    phrase: {
      tr: (n) => `en fazla ${n} özel liste oluşturabilirsin`,
      en: (n) => `you can create up to ${n} custom lists`,
    },
  }),
  shared_lists: feature({
    id: "shared_lists",
    kind: COUNT,
    category: "library",
    icon: "people-circle",
    limits: { free: 2, premium: 10, unlimited: UNLIMITED },
    title: { tr: "Kurduğun ortak liste", en: "Shared lists you create" },
    unit: { tr: "liste", en: "lists" },
    note: {
      tr: "Davet edildiğin listelere katılmak serbest",
      en: "Joining lists you're invited to is free",
    },
    phrase: {
      tr: (n) => `en fazla ${n} ortak liste kurabilirsin`,
      en: (n) => `you can create up to ${n} shared lists`,
    },
  }),
  games: feature({
    id: "games",
    kind: DAILY,
    category: "play",
    icon: "game-controller",
    limits: { free: 5, premium: 20, unlimited: UNLIMITED },
    title: { tr: "Sahne tahmin oyunu", en: "Scene guess games" },
    unit: { tr: "oyun", en: "games" },
    phrase: {
      tr: (n) => `günde ${n} oyun oynayabilirsin`,
      en: (n) => `you can play ${n} games per day`,
    },
  }),
  cineswipe_rooms: feature({
    id: "cineswipe_rooms",
    kind: DAILY,
    category: "play",
    icon: "people",
    limits: { free: 2, premium: 10, unlimited: UNLIMITED },
    title: { tr: "CineSwipe odası kurma", en: "CineSwipe rooms you host" },
    unit: { tr: "oda", en: "rooms" },
    note: { tr: "Odalara katılmak serbest", en: "Joining rooms is free" },
    phrase: {
      tr: (n) => `günde ${n} CineSwipe odası kurabilirsin`,
      en: (n) => `you can host ${n} CineSwipe rooms per day`,
    },
  }),
  cineswipe_swipes: feature({
    id: "cineswipe_swipes",
    kind: DAILY,
    category: "play",
    icon: "swap-horizontal",
    limits: { free: 60, premium: 300, unlimited: UNLIMITED },
    title: { tr: "Tek başına CineSwipe", en: "Solo CineSwipe" },
    unit: { tr: "kart", en: "cards" },
    phrase: {
      tr: (n) => `günde ${n} kart kaydırabilirsin`,
      en: (n) => `you can swipe ${n} cards per day`,
    },
  }),
  custom_themes: feature({
    id: "custom_themes",
    kind: ACCESS,
    category: "personal",
    icon: "color-palette",
    minPlan: PREMIUM_PLAN.PREMIUM,
    title: { tr: "Kendi temanı oluştur", en: "Create your own themes" },
    freeValue: {
      tr: `${PRESET_THEME_COUNT} hazır tema`,
      en: `${PRESET_THEME_COUNT} preset themes`,
    },
    paidValue: { tr: "Sınırsız özel tema", en: "Unlimited custom themes" },
  }),
  font_catalog: feature({
    id: "font_catalog",
    kind: ACCESS,
    category: "personal",
    icon: "text",
    minPlan: PREMIUM_PLAN.PREMIUM,
    title: { tr: "Yazı tipi kataloğu", en: "Font catalog" },
    freeValue: {
      tr: `${FREE_FONT_PRESET_IDS.length} yazı tipi`,
      en: `${FREE_FONT_PRESET_IDS.length} fonts`,
    },
    paidValue: {
      tr: `${FONT_CATALOG_SIZE} yazı tipi`,
      en: `${FONT_CATALOG_SIZE} fonts`,
    },
  }),
  streaming_alerts: feature({
    id: "streaming_alerts",
    kind: COUNT,
    category: "alerts",
    icon: "notifications",
    enforcedBy: "server",
    limits: { free: 10, premium: 100, unlimited: 100 },
    title: { tr: "Platform bildirimi", en: "Streaming alerts" },
    unit: { tr: "başlık", en: "titles" },
    detail: {
      tr: "İzleme listene son eklediğin yapımlar bir platforma gelince haber verir",
      en: "Tells you when your latest watchlist titles start streaming",
    },
    phrase: {
      tr: (n) => `izleme listene son eklediğin ${n} başlık takip edilir`,
      en: (n) => `your ${n} most recent watchlist titles are tracked`,
    },
  }),
  wrapped_archive: feature({
    id: "wrapped_archive",
    kind: ACCESS,
    category: "alerts",
    icon: "albums",
    minPlan: PREMIUM_PLAN.PREMIUM,
    title: { tr: "Wrapped arşivi", en: "Wrapped archive" },
    freeValue: { tr: "Bu yıl + geçen yıl", en: "This year + last year" },
    paidValue: { tr: "Tüm yıllar", en: "Every year" },
  }),
});

export const FEATURE_IDS = Object.freeze(Object.keys(PREMIUM_FEATURES));

const pick = (copy, language) =>
  (language === "tr" ? copy?.tr : copy?.en) ?? copy?.en ?? copy?.tr ?? "";

/** Sayısal karşılaştırma için limit (AI kotasında günlük tavan). */
const numericLimit = (definition, limit) =>
  definition.kind === AI_QUOTA ? limit.daily : limit;

export function getFeature(featureId) {
  return PREMIUM_FEATURES[featureId] || null;
}

/**
 * Plan için limit:
 *   ACCESS   → boolean
 *   COUNT / DAILY → sayı (sınırsızsa Infinity)
 *   AI_QUOTA → { daily, monthly }
 * Bilinmeyen özellikte en kısıtlayıcı değer döner (kapı açık kalmasın).
 */
export function getFeatureLimit(featureId, plan) {
  const definition = getFeature(featureId);
  const normalized = normalizePlan(plan);
  if (!definition) return 0;
  if (definition.kind === ACCESS) {
    return planRank(normalized) >= planRank(definition.minPlan);
  }
  return definition.limits[normalized];
}

export function isUnlimitedFor(featureId, plan) {
  const limit = getFeatureLimit(featureId, plan);
  return typeof limit === "number" && !Number.isFinite(limit);
}

/**
 * Bir sonraki kullanım serbest mi? `used`, COUNT için sahip olunan adet,
 * DAILY için bugün harcanan hak. ACCESS'te yok sayılır.
 */
export function canUseFeature(featureId, plan, used = 0) {
  const definition = getFeature(featureId);
  if (!definition) return false;
  const limit = getFeatureLimit(featureId, plan);
  if (definition.kind === ACCESS) return limit === true;
  if (definition.kind === AI_QUOTA) {
    return Math.max(0, Number(used) || 0) < limit.daily;
  }
  return Math.max(0, Number(used) || 0) < limit;
}

/** Kalan hak (sınırsızsa Infinity). ACCESS için erişim varsa Infinity, yoksa 0. */
export function remainingUses(featureId, plan, used = 0) {
  const definition = getFeature(featureId);
  if (!definition) return 0;
  const limit = getFeatureLimit(featureId, plan);
  if (definition.kind === ACCESS) return limit ? UNLIMITED : 0;
  const cap = definition.kind === AI_QUOTA ? limit.daily : limit;
  return Math.max(0, cap - Math.max(0, Number(used) || 0));
}

/** Bu özelliğin limitini ARTIRAN ilk üst plan; yoksa null. */
export function nextPlanFor(featureId, plan) {
  const definition = getFeature(featureId);
  if (!definition) return null;
  const current = getFeatureLimit(featureId, plan);
  for (const candidate of PLAN_ORDER.slice(planRank(plan) + 1)) {
    const next = getFeatureLimit(featureId, candidate);
    if (definition.kind === ACCESS) {
      if (next && !current) return candidate;
    } else if (numericLimit(definition, next) > numericLimit(definition, current)) {
      return candidate;
    }
  }
  return null;
}

export function isFontPresetFree(presetId) {
  return FREE_FONT_PRESET_IDS.includes(presetId);
}

/** Yazı tipi bu planda seçilebilir mi? */
export function canUseFontPreset(presetId, plan) {
  return isFontPresetFree(presetId) || getFeatureLimit("font_catalog", plan);
}

/** Wrapped yılı ücretsiz mi (bu yıl ve geçen yıl)? */
export function isWrappedYearFree(year, now = new Date()) {
  const numeric = Number(year);
  if (!Number.isFinite(numeric)) return false;
  return numeric >= now.getFullYear() - FREE_WRAPPED_YEARS_BACK;
}

export function canViewWrappedYear(year, plan, now = new Date()) {
  return isWrappedYearFree(year, now) || getFeatureLimit("wrapped_archive", plan);
}

const unlimitedWord = (language) => (language === "tr" ? "Sınırsız" : "Unlimited");

/**
 * Karşılaştırma tablosundaki hücre metni: "5 liste", "20 oyun/gün",
 * "Sınırsız", "Epik rozet", "—".
 */
export function formatFeatureValue(featureId, plan, language = "en") {
  const definition = getFeature(featureId);
  if (!definition) return "—";
  const normalized = normalizePlan(plan);
  const limit = getFeatureLimit(featureId, normalized);
  const tr = language === "tr";

  if (definition.kind === AI_QUOTA) {
    return tr
      ? `${limit.daily}/gün · ${limit.monthly}/ay`
      : `${limit.daily}/day · ${limit.monthly}/mo`;
  }
  if (definition.kind === ACCESS) {
    if (!limit) return definition.freeValue ? pick(definition.freeValue, language) : "—";
    if (definition.planValue?.[normalized]) {
      return pick(definition.planValue[normalized], language);
    }
    return definition.paidValue ? pick(definition.paidValue, language) : "✓";
  }
  if (!Number.isFinite(limit)) return unlimitedWord(language);
  const unit = pick(definition.unit, language);
  if (definition.kind === DAILY) {
    return tr ? `${limit} ${unit}/gün` : `${limit} ${unit}/day`;
  }
  return `${limit} ${unit}`;
}

/** "Premium ile 25, Premium Max ile sınırsız." — üst planların bu özellikteki değeri. */
function upgradeSentence(featureId, plan, language) {
  const definition = getFeature(featureId);
  if (!definition || definition.kind === ACCESS) return "";
  const tr = language === "tr";
  const current = numericLimit(definition, getFeatureLimit(featureId, plan));
  const parts = [];
  for (const candidate of PLAN_ORDER.slice(planRank(plan) + 1)) {
    const limit = numericLimit(definition, getFeatureLimit(featureId, candidate));
    if (!(limit > current)) continue;
    const value = Number.isFinite(limit)
      ? String(limit)
      : tr
        ? "sınırsız"
        : "unlimited";
    const name = getPremiumPlanDisplayName(candidate);
    parts.push(tr ? `${name} ile ${value}` : `with ${name}: ${value}`);
  }
  if (!parts.length) return "";
  const sentence = `${parts.join(", ")}.`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/**
 * Limit dolduğunda gösterilecek uyarı metni.
 * @returns {{ title: string, message: string, canUpgrade: boolean }}
 */
export function buildLimitCopy(featureId, plan, language = "en") {
  const definition = getFeature(featureId);
  const tr = language === "tr";
  const normalized = normalizePlan(plan);
  const planName = getPremiumPlanDisplayName(normalized);
  const canUpgrade = Boolean(nextPlanFor(featureId, normalized));

  if (!definition) {
    return {
      title: tr ? "Premium özelliği" : "Premium feature",
      message: "",
      canUpgrade: false,
    };
  }

  if (definition.kind === ACCESS) {
    const title = pick(definition.title, language);
    return {
      title: tr ? "Premium özelliği" : "Premium feature",
      message: tr
        ? `${title} Premium ve Premium Max planlarında açık.`
        : `${title} is included in Premium and Premium Max.`,
      canUpgrade,
    };
  }

  const cap = numericLimit(definition, getFeatureLimit(featureId, normalized));
  const phrase = definition.phrase ? pick(definition.phrase, language) : null;
  const base =
    typeof phrase === "function"
      ? tr
        ? `${planName} planında ${phrase(cap)}.`
        : `On ${planName}, ${phrase(cap)}.`
      : "";
  const upgrade = canUpgrade ? upgradeSentence(featureId, normalized, language) : "";
  const renew =
    definition.kind === DAILY
      ? tr
        ? "Hakların yarın yenilenir."
        : "Your limit resets tomorrow."
      : "";

  return {
    title:
      definition.kind === DAILY
        ? tr
          ? "Bugünkü hakkın doldu"
          : "Today's limit reached"
        : tr
          ? "Limite ulaştın"
          : "Limit reached",
    message: [base, upgrade, renew].filter(Boolean).join(" "),
    canUpgrade,
  };
}

/**
 * Ödeme ekranı karşılaştırma tablosu: kategori → satırlar → plan değerleri.
 * Sıra FEATURE_CATEGORIES ve PREMIUM_FEATURES tanım sırasını izler.
 */
export function getComparisonSections(language = "en") {
  return FEATURE_CATEGORIES.map((category) => ({
    id: category.id,
    icon: category.icon,
    color: category.color,
    title: pick(category.title, language),
    rows: FEATURE_IDS.filter(
      (id) => PREMIUM_FEATURES[id].category === category.id,
    ).map((id) => {
      const definition = PREMIUM_FEATURES[id];
      return {
        id,
        icon: definition.icon,
        title: pick(definition.title, language),
        detail: definition.detail ? pick(definition.detail, language) : null,
        note: definition.note ? pick(definition.note, language) : null,
        values: Object.fromEntries(
          PLAN_ORDER.map((plan) => [plan, formatFeatureValue(id, plan, language)]),
        ),
      };
    }),
  })).filter((section) => section.rows.length > 0);
}
