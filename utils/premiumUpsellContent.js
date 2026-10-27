// utils/premiumUpsellContent.js
//
// Premium yükseltme sayfasının (components/premium/PremiumUpsellSheet.js)
// İÇERİK MODELİ. Saf modül: React/RN importu yok, jest doğrudan test eder.
//
// Neden ayrı: eskiden kapıya takılan kullanıcıya genel bir uyarı kutusu
// ("Limite ulaştın" + üç cümlelik paragraf) gösteriliyordu. Şimdi sayfa
// özelliğe özel konuşur — ne doldu (gösterge), planlar arasında bu özellikte ne
// fark var (sütunlar), başka ne kazanırsın (2 satır), ne kadar (gerçek mağaza
// fiyatı). Hepsi utils/premiumFeatures.js kaydından ve mağaza paketlerinden
// üretilir; "burada olmayan bir şey satılamaz" kuralı korunur: elle yazılmış
// vaat yok, her değer bir kapının arkasındaki gerçek limit.

import { copyLanguage, normalizeAppLanguage, pickByLanguage } from "./appLanguages";
import {
  getPackageDisplayProduct,
  getPackageIntroOffer,
  getPackagePeriodKey,
  getPackageRegularPrice,
  getPackagesForTier,
  getPremiumPlanDisplayName,
  PREMIUM_PLAN,
  selectPreferredPackage,
} from "./premium";
import {
  FEATURE_CATEGORIES,
  FEATURE_KIND,
  PLANS,
  buildLimitCopy,
  describeCurrentLimit,
  formatFeatureValue,
  getFeature,
  getFeatureLimit,
  isLockedFor,
  nextPlanFor,
  normalizePlan,
  planRank,
  unitLabel,
  upsellBundleFor,
} from "./premiumFeatures";

const { ACCESS, COUNT, DAILY, AI_QUOTA } = FEATURE_KIND;

const DEFAULT_COLOR = "#8B5CF6";

/**
 * "Premium ile ayrıca" satırlarının aday sırası. Hepsi kayıtta gerçek bir kapısı
 * olan özellikler; sıra, kullanıcıya en somut gelen faydaları öne alır.
 */
export const PERK_CANDIDATES = Object.freeze([
  "ai_messages",
  "custom_lists",
  "friends",
  "games",
  "font_catalog",
  "custom_themes",
  "wrapped_archive",
  "identity_badge",
]);

// 2: sayfa tipik bir telefonda (≈800 dp) kaydırma gerektirmeden sığsın; üçüncü
// satır düğmeyi katlama çizgisinin altına itiyordu.
export const MAX_PERKS = 2;

const pick = (copy, language) =>
  copy?.[copyLanguage(language, ["tr", "en", "es", "pt", "de"])] ?? copy?.en ?? copy?.tr ?? "";

const categoryOf = (definition) =>
  FEATURE_CATEGORIES.find((category) => category.id === definition?.category) || null;

/** Sayısal tavan: AI kotasında günlük hak, diğerlerinde limitin kendisi. */
function capFor(definition, plan) {
  const limit = getFeatureLimit(definition.id, plan);
  return definition.kind === AI_QUOTA ? limit.daily : limit;
}

/** "Premium'a geç" / "Premium Max'e geç" — Türkçe ek, planın okunuşuna göre. */
function ctaLabel(targetPlan, language) {
  const name = getPremiumPlanDisplayName(targetPlan);
  const lang = normalizeAppLanguage(language);
  if (lang === "tr") {
    return `${name}'${targetPlan === PREMIUM_PLAN.UNLIMITED ? "e" : "a"} geç`;
  }
  if (lang === "es") return `Pasar a ${name}`;
  return `Upgrade to ${name}`;
}

function eyebrowFor(kind, language) {
  const tr = language === "tr";
  const es = normalizeAppLanguage(language) === "es";
  const pt = normalizeAppLanguage(language) === "pt";
  const de = normalizeAppLanguage(language) === "de";
  if (kind === ACCESS) return tr ? "PREMİUM ÖZELLİK" : es ? "FUNCIÓN PREMIUM" : pt ? "RECURSO PREMIUM" : de ? "PREMIUM-FUNKTION" : "PREMIUM FEATURE";
  if (kind === COUNT) return tr ? "LİMİT DOLDU" : es ? "LÍMITE ALCANZADO" : pt ? "LIMITE ATINGIDO" : de ? "LIMIT ERREICHT" : "LIMIT REACHED";
  return tr ? "GÜNLÜK HAK BİTTİ" : es ? "LÍMITE DIARIO ALCANZADO" : pt ? "LIMITE DIÁRIO ATINGIDO" : de ? "TAGESLIMIT ERREICHT" : "DAILY LIMIT REACHED";
}

/**
 * Kullanım göstergesi. Yalnız sayısal özelliklerde (liste/arkadaş/grup/günlük
 * hak). `used` bilinmiyorsa (kapı yalnız "doldu" diyorsa) tavana eşit sayılır:
 * sayfa zaten limit dolduğu için açılıyor.
 */
function buildMeter(definition, plan, used, language) {
  // Pencere özelliğinde (Wrapped yılları) doluluk yok: "2 / 1 yıl" anlamsız olur.
  if (definition.kind === ACCESS || definition.window) return null;
  const cap = capFor(definition, plan);
  if (!Number.isFinite(cap) || cap <= 0) return null;
  // `Number(null)` 0 döner: "bilinmiyor" ile "hiç kullanmadı" ayrı şeyler.
  const numeric = used == null || used === "" ? NaN : Number(used);
  const usedValue = Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : cap;
  return {
    used: usedValue,
    cap,
    ratio: Math.min(1, usedValue / cap),
    daily: definition.kind !== COUNT,
    unit: definition.unit ? unitLabel(definition, cap, language) : null,
  };
}

/**
 * Plan kartındaki değeri sayfanın çizdiği iki parçaya böler: iri FİGÜR + küçük
 * birim satırı. Üç dar sütunda "20/gün · 300/ay" ya da "150 arkadaş" tek satırda
 * ya taşıyor ya da kötü yerden kırılıyordu; figür ve birim ayrı satırda her
 * puntoda okunur kalır.
 *
 *   "150 arkadaş"        → { main: "150", sub: "arkadaş", figure: true }
 *   "20/gün · 300/ay"    → { main: "20/gün", sub: "300/ay", figure: true }
 *   Sınırsız (sayılı)    → { main: "Sınırsız", sub: <birim>, figure: true }
 *   "—"                  → { main: "—", sub: null, figure: true }
 *   "Sınırsız özel tema" → { main: "Sınırsız özel tema", sub: null, figure: false }
 *
 * `figure: false` olan değerler cümle gibidir: sayfa onları sarar, küçültmez.
 * `value` (tam metin) erişilebilirlik etiketi ve karşılaştırma için aynen kalır.
 */
export function splitTierValue(featureId, plan, language = "en") {
  const value = formatFeatureValue(featureId, plan, language);
  const definition = getFeature(featureId);
  if (value === "—") return { main: value, sub: null, figure: true };

  if (definition?.kind === AI_QUOTA) {
    const [main, sub] = value.split(" · ");
    return { main, sub: sub || null, figure: true };
  }

  // "N birim" — hem sayılı limitler hem de "8 hazır tema" gibi ACCESS değerleri.
  const counted = /^(\d[\d.,]*)\s+(\S.*)$/.exec(value);
  if (counted) return { main: counted[1], sub: counted[2], figure: true };

  // Sınırsız: sayılı özellikte figürün altına birimi yaz ("Sınırsız / arkadaş").
  const countable = definition && (definition.kind === COUNT || definition.kind === DAILY);
  if (countable && !definition.planValue?.[plan] && !Number.isFinite(getFeatureLimit(featureId, plan))) {
    const unit = unitLabel(definition, Infinity, language);
    const sub = definition.kind === DAILY ? `${unit}/${pickByLanguage(language, { tr: "gün", en: "day", es: "día", pt: "dia", de: "Tag" })}` : unit;
    return { main: value, sub: sub || null, figure: true };
  }

  return { main: value, sub: null, figure: false };
}

/**
 * Plan satırının tek bir çizim kipi vardır: hepsi "figür" (iri rakam + birim) ya da
 * hepsi "cümle" (tam metin, sarılır). Karışık satırda (ör. Free "8 hazır tema",
 * Premium "Sınırsız özel tema") yan yana biri iri rakam, diğeri küçük cümle çıkıp
 * kartları farklı punto/yükseklikte gösteriyordu; bu yüzden herhangi bir sütun
 * cümleyse TÜM sütunlar cümle olur.
 */
export function pickTierMode(tiers) {
  return tiers.every((tier) => tier.figure) ? "figure" : "phrase";
}

// Kalın ağırlıkta karakter başına ortalama genişlik (em). Rakam/eğik çizgi/büyük
// harf ağırlıklı figürlerde geniş, küçük harfli sözcüklerde dar.
export const TIER_EM = Object.freeze({ figure: 0.62, word: 0.55, name: 0.58 });

export const TIER_TYPE = Object.freeze({
  figure: { max: 22, min: 15 },
  phrase: { max: 14, min: 11.5 },
  name: { max: 12.5, min: 10 },
  sub: 11.5,
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Punto: sütunun kullanılabilir genişliğine ve satırdaki EN UZUN parçaya göre
 * hesaplanır; böylece üç kart hep aynı puntoda durur ve hiçbir metin cihazın
 * kendi "sığana dek küçült" davranışına (iOS/Android'de farklı, çok satırlıda
 * güvenilmez) kalmaz. Ölçüm gerekmez: saf ve testlidir.
 *
 * @param {number} longest   satırdaki en uzun parçanın karakter sayısı
 * @param {number} width     kart içinde metne kalan genişlik (dp)
 */
export function fitTierFontSize(longest, width, em, { max, min }) {
  if (!(longest > 0) || !(width > 0)) return max;
  return Math.round(clamp(width / (longest * em), min, max) * 10) / 10;
}

/**
 * Plan satırının tipografisi. `columnWidth` = bir sütunun (kart) dış genişliği.
 * Kart içinde 3 dp çerçeve + 8 dp yan dolgu düşülür.
 *
 * @returns {{ mode: "figure"|"phrase", name: number, text: number, sub: number }}
 */
export function planTierTypography(tiers, columnWidth) {
  const mode = pickTierMode(tiers);
  const inner = Math.max(0, columnWidth - 11);
  const longestName = Math.max(0, ...tiers.map((tier) => tier.name.length));
  const name = fitTierFontSize(longestName, inner, TIER_EM.name, TIER_TYPE.name);
  if (mode === "figure") {
    const longest = Math.max(
      0,
      ...tiers.flatMap((tier) => (tier.lines || [tier]).map((line) => line.main.length)),
    );
    return {
      mode,
      name,
      text: fitTierFontSize(longest, inner, TIER_EM.figure, TIER_TYPE.figure),
      sub: TIER_TYPE.sub,
    };
  }
  // Cümle: sarılır, bu yüzden yalnız en uzun TEK SÖZCÜK sığmalı.
  const longestWord = Math.max(
    0,
    ...tiers.flatMap((tier) => String(tier.value).split(/\s+/).map((word) => word.length)),
  );
  return {
    mode,
    name,
    text: fitTierFontSize(longestWord, inner, TIER_EM.word, TIER_TYPE.phrase),
    sub: TIER_TYPE.sub,
  };
}

/**
 * Planlar arası bu özellikteki fark: mevcut plandan yukarıya doğru sütunlar.
 * Paket sayfasında (`members` birden çoksa) her sütun üyelerin değerlerini
 * `lines` olarak alt alta taşır; `value`/`main`/`sub` önder üyeninkidir.
 */
function buildTiers(featureId, current, targetPlan, language, members = [featureId]) {
  return PLANS.filter((plan) => planRank(plan) >= planRank(current)).map((plan) => {
    const lines =
      members.length > 1
        ? members.map((id) => {
            const split = splitTierValue(id, plan, language);
            return {
              featureId: id,
              value: formatFeatureValue(id, plan, language),
              ...split,
              // Kapalı "—" birimsizdir; pakette satırlar sütunlar arasında hizalı ve
              // okunur kalsın diye birimi hedef plandan alır ("— / kart/gün").
              sub: split.sub ?? (targetPlan ? splitTierValue(id, targetPlan, language).sub : null),
            };
          })
        : null;
    return {
      plan,
      name: getPremiumPlanDisplayName(plan),
      value: lines ? lines.map((line) => line.value).join(" · ") : formatFeatureValue(featureId, plan, language),
      ...splitTierValue(featureId, plan, language),
      // Paket satırı cümle değil figürdür: her üyenin değeri kendi "N birim"i.
      ...(lines ? { lines, figure: lines.every((line) => line.figure) } : null),
      isCurrent: plan === current,
      isTarget: plan === targetPlan,
    };
  });
}

/**
 * Host'un birleştirme anahtarı: paket geçerliyse paketin kimliği (iki üyenin
 * isteği aynı sayfadır), değilse özelliğin kendisi.
 */
export function upsellKeyFor(featureId, plan) {
  const bundle = upsellBundleFor(featureId, normalizePlan(plan));
  return bundle ? `bundle:${bundle.id}` : featureId;
}

/**
 * "Premium ile ayrıca" satırları: bu özellik dışında, hedef planda mevcut plana
 * göre GERÇEKTEN daha iyi olan en fazla 2 kapı.
 */
export function pickPerks(featureId, current, targetPlan, language = "en") {
  if (!targetPlan) return [];
  const perks = [];
  for (const id of PERK_CANDIDATES) {
    if (id === featureId) continue;
    const definition = getFeature(id);
    if (!definition) continue;
    const next = formatFeatureValue(id, targetPlan, language);
    if (next === formatFeatureValue(id, current, language)) continue;
    perks.push({
      id,
      icon: definition.icon,
      color: categoryOf(definition)?.color || DEFAULT_COLOR,
      title: pick(definition.title, language),
      value: next,
    });
    if (perks.length >= MAX_PERKS) break;
  }
  return perks;
}

// ── Seçim önizlemesi (özel afiş / arka plan) ────────────────────────────────

const PREVIEW_LABELS = Object.freeze({
  from: { tr: "Şimdi", en: "Now", es: "Ahora", pt: "Agora", de: "Jetzt" },
  to: { tr: "Seçtiğin", en: "Your pick", es: "Tu elección", pt: "Sua escolha", de: "Deine Wahl" },
});
const PREVIEW_URI = /^https:\/\/image\.tmdb\.org\//;

/**
 * Galeriden gelen önizleme: sayfa "Şimdi → Seçtiğin" kartını çizer. Yalnız TMDB
 * adresleri kabul edilir; seçilen görsel (`toUri`) yoksa kart hiç çizilmez.
 *
 * @param {{ kind?: string, fromUri?: string|null, toUri?: string }} [preview]
 * @returns {{ kind: "poster"|"backdrop", fromUri: string|null, toUri: string,
 *   fromLabel: string, toLabel: string } | null}
 */
export function buildChoicePreview(preview, language = "en") {
  if (!preview || typeof preview !== "object") return null;
  const kind = preview.kind === "backdrop" ? "backdrop" : preview.kind === "poster" ? "poster" : null;
  const toUri = typeof preview.toUri === "string" && PREVIEW_URI.test(preview.toUri) ? preview.toUri : null;
  if (!kind || !toUri) return null;
  const fromUri =
    typeof preview.fromUri === "string" && PREVIEW_URI.test(preview.fromUri) && preview.fromUri !== toUri
      ? preview.fromUri
      : null;
  return {
    kind,
    fromUri,
    toUri,
    fromLabel: pick(PREVIEW_LABELS.from, language),
    toLabel: pick(PREVIEW_LABELS.to, language),
  };
}

/**
 * @param {string} featureId
 * @param {string} plan             kullanıcının mevcut planı
 * @param {"tr"|"en"} language
 * @param {{ used?: number, preview?: object }} [options]  COUNT: sahip olunan adet; DAILY:
 *   bugünkü kullanım; preview: seçilmeye çalışılan görsel (buildChoicePreview)
 */
export function buildUpsellContent(featureId, plan, language = "en", { used, preview } = {}) {
  const lang = normalizeAppLanguage(language);
  const tr = lang === "tr";
  const es = normalizeAppLanguage(lang) === "es";
  const pt = normalizeAppLanguage(lang) === "pt";
  const de = normalizeAppLanguage(lang) === "de";
  const current = normalizePlan(plan);
  // Paket (Free'de CineSwipe kart + oda): hangi üyeden gelinirse gelinsin aynı
  // sayfa — önder üyenin rengi/simgesi, paketin başlığı/mesajı, sütunlarda tüm üyeler.
  const bundle = upsellBundleFor(featureId, current);
  if (bundle) featureId = bundle.features[0];
  const definition = getFeature(featureId);

  if (!definition) {
    return {
      featureId,
      state: "locked",
      color: DEFAULT_COLOR,
      icon: "diamond",
      eyebrow: eyebrowFor(ACCESS, lang),
      featureTitle: "",
      title: tr ? "Premium özelliği" : es ? "Función Premium" : pt ? "Recurso Premium" : de ? "Premium-Funktion" : "Premium feature",
      message: "",
      meter: null,
      preview: null,
      note: null,
      renew: null,
      tiers: [],
      tierMode: "figure",
      perks: [],
      targetPlan: null,
      targetName: null,
      canUpgrade: false,
      cta: { primary: tr ? "Tamam" : es ? "Entendido" : pt ? "Entendi" : de ? "Verstanden" : "Got it", secondary: null },
    };
  }

  const targetPlan = nextPlanFor(featureId, current);
  const canUpgrade = Boolean(targetPlan);
  const tiers = canUpgrade ? buildTiers(featureId, current, targetPlan, lang, bundle?.features) : [];
  const legacy = buildLimitCopy(featureId, current, lang);
  // "Kilitli": erişim özelliği ya da bu planda limiti 0 olan sayılı özellik
  // (Free'de oyun). İkisi de sayaç/yenilenme değil, "hangi plan açar" anlatır.
  const isAccess = definition.kind === ACCESS || isLockedFor(featureId, current);

  // Sayılı özellik bu planda KAPALIYSA (Free'de oyun) "limit doldu" başlığı yalan
  // olur; varsa kapalı durumun kendi başlığı (`upsell.lockedTitle`) kullanılır.
  const lockedCountable = isAccess && definition.kind !== ACCESS;
  // Pencere özelliği (Wrapped yılları) sayaç değil kilittir: "limit doldu" değil,
  // "bu yıl kilitli" konuşur; mesajı yine planın mevcut penceresini söyler.
  const windowed = definition.window === true;
  const locked = isAccess || windowed;
  const choicePreview = buildChoicePreview(preview, lang);
  const title =
    (bundle ? pick(bundle.title, lang) : "") ||
    (lockedCountable ? pick(definition.upsell?.lockedTitle, lang) : "") ||
    (choicePreview ? pick(definition.upsell?.titleByPreview?.[choicePreview.kind], lang) : "") ||
    (targetPlan ? pick(definition.upsell?.titleByTarget?.[targetPlan], lang) : "") ||
    pick(definition.upsell?.title, lang) ||
    legacy.title;
  const message = bundle
    ? pick(bundle.message, lang)
    : isAccess
    ? pick(definition.upsell?.message, lang) || legacy.message
    : describeCurrentLimit(featureId, current, lang);

  return {
    featureId,
    state: locked ? "locked" : definition.kind === COUNT ? "limit" : "daily",
    color: categoryOf(definition)?.color || DEFAULT_COLOR,
    icon: definition.icon,
    eyebrow: eyebrowFor(locked ? ACCESS : definition.kind, lang),
    title,
    message,
    featureTitle: pick(definition.title, lang),
    meter: buildMeter(definition, current, used, lang),
    preview: choicePreview,
    note: definition.note ? pick(definition.note, lang) : null,
    renew:
      definition.kind === COUNT || isAccess
        ? null
        : tr ? "Hakların yarın yenilenir" : es ? "Tu límite se restablece mañana" : pt ? "Seu limite é redefinido amanhã" : de ? "Dein Limit wird morgen zurückgesetzt" : "Your limit resets tomorrow",
    // Üst plan yoksa karşılaştırma ve fayda satırı anlamsız: yalnız bilgi.
    tiers,
    tierMode: pickTierMode(tiers),
    // Önizleme kartı (≈ iki kazanç satırı yüksekliği) varken kazanç satırları çizilmez:
    // sayfa yine kaydırmasız sığsın (MAX_PERKS ile aynı gerekçe); yeri "Seçtiğin" görsel alır.
    perks: canUpgrade && !choicePreview ? pickPerks(featureId, current, targetPlan, lang) : [],
    targetPlan: targetPlan || null,
    targetName: targetPlan ? getPremiumPlanDisplayName(targetPlan) : null,
    canUpgrade,
    cta: canUpgrade
      ? {
          primary: ctaLabel(targetPlan, lang),
          secondary: tr ? "Şimdi değil" : es ? "Ahora no" : pt ? "Agora não" : de ? "Nicht jetzt" : "Not now",
        }
      : { primary: tr ? "Tamam" : es ? "Entendido" : pt ? "Entendi" : de ? "Verstanden" : "Got it", secondary: null },
  };
}

// ── Fiyat ────────────────────────────────────────────────────────────────────

/** Giriş teklifinin süresi: "İlk 3 ay", "İlk yıl", "First 3 months". */
const DE_FIRST = { day: "Erster", week: "Erste", month: "Erster", year: "Erstes" };
function offerDuration(offer, language) {
  const count = (offer.cycles || 1) * (offer.unitCount || 1);
  const one = count === 1;
  const tr = language === "tr";
  const es = normalizeAppLanguage(language) === "es";
  const pt = normalizeAppLanguage(language) === "pt";
  const de = normalizeAppLanguage(language) === "de";
  const units = {
    day: tr ? "gün" : es ? (one ? "día" : "días") : pt ? one ? "dia" : "dias" : de ? (one ? "Tag" : "Tage") : one ? "day" : "days",
    week: tr ? "hafta" : es ? (one ? "semana" : "semanas") : pt ? one ? "semana" : "semanas" : de ? (one ? "Woche" : "Wochen") : one ? "week" : "weeks",
    month: tr ? "ay" : es ? (one ? "mes" : "meses") : pt ? one ? "mês" : "meses" : de ? (one ? "Monat" : "Monate") : one ? "month" : "months",
    year: tr ? "yıl" : es ? (one ? "año" : "años") : pt ? one ? "ano" : "anos" : de ? (one ? "Jahr" : "Jahre") : one ? "year" : "years",
  };
  const unit = units[offer.unit];
  if (!unit) return null;
  if (tr) return one ? `İlk ${unit}` : `İlk ${count} ${unit}`;
  if (es) return one ? `${unit} inicial` : `${count} ${unit} iniciales`;
  if (pt) return one ? `${unit} inicial` : `${count} ${unit} iniciais`;
  if (de) return one ? `${DE_FIRST[offer.unit]} ${unit}` : `Erste ${count} ${unit}`;
  return one ? `First ${unit}` : `First ${count} ${unit}`;
}

function offerLabel(offer, language) {
  if (!offer) return null;
  const duration = offerDuration(offer, language);
  if (!duration) return null;
  const tr = language === "tr";
  const es = normalizeAppLanguage(language) === "es";
  const pt = normalizeAppLanguage(language) === "pt";
  const de = normalizeAppLanguage(language) === "de";
  if (offer.free) return tr ? `${duration} ücretsiz` : es ? `${duration} gratis` : pt ? `${duration} grátis` : de ? `${duration} kostenlos` : `${duration} free`;
  if (!Number.isFinite(offer.percent) || offer.percent <= 0) return null;
  return tr ? `${duration} %${offer.percent} indirim` : es ? `${duration} ${offer.percent}% de descuento` : pt ? `${duration} com ${offer.percent}% de desconto` : de ? `${duration} ${offer.percent} % Rabatt` : `${duration} ${offer.percent}% off`;
}

function periodLabel(aPackage, language) {
  const key = getPackagePeriodKey(aPackage);
  const tr = language === "tr";
  const es = normalizeAppLanguage(language) === "es";
  const pt = normalizeAppLanguage(language) === "pt";
  const de = normalizeAppLanguage(language) === "de";
  if (key === "annual") return tr ? "/ yıl" : es ? "/ año" : pt ? "/ ano" : de ? "/ year" : "/ year";
  if (key === "monthly") return tr ? "/ ay" : es ? "/ mes" : pt ? "/ mês" : de ? "/ month" : "/ month";
  if (key === "weekly") return tr ? "/ hafta" : es ? "/ semana" : pt ? "/ semana" : de ? "/ week" : "/ week";
  return "";
}

/**
 * Hedef planın başlangıç fiyatı (mağazadan) ve varsa giriş teklifi. Paketler
 * henüz yüklenmediyse / fiyat okunamıyorsa null: sayfa fiyat satırını hiç
 * göstermez, uydurma fiyat ASLA basılmaz.
 *
 * Aylık paket tercih edilir ("başlangıç" fiyatı); yoksa planın tercih edilen
 * paketi.
 *
 * @returns {{ name: string, price: string, period: string, offer: string|null } | null}
 */
export function buildPriceHint({
  packages,
  tier,
  language = "en",
  usingTestStore = false,
  introEligibleIds = [],
} = {}) {
  if (!tier || !Array.isArray(packages) || packages.length === 0) return null;
  const lang = normalizeAppLanguage(language);
  const tierPackages = getPackagesForTier(packages, tier);
  const aPackage =
    tierPackages.find((item) => getPackagePeriodKey(item) === "monthly") ||
    selectPreferredPackage(tierPackages);
  if (!aPackage) return null;

  const product = getPackageDisplayProduct(aPackage, { usingTestStore, language: lang });
  const regular = getPackageRegularPrice({ ...aPackage, product });
  const price = regular?.priceString;
  if (!price) return null;

  const offer = getPackageIntroOffer(
    { ...aPackage, product },
    { iosIntroEligible: (introEligibleIds || []).includes(product?.identifier) },
  );

  return {
    name: getPremiumPlanDisplayName(tier),
    price,
    period: periodLabel(aPackage, lang),
    offer: offerLabel(offer, lang),
  };
}
