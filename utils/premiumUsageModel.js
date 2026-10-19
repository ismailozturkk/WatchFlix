// utils/premiumUsageModel.js
//
// "Kullanım ve haklar" ekranının (screens/tabs/settings/PremiumUsageScreen.js)
// İÇERİK MODELİ. Saf modül: React/Firestore importu yok, jest doğrudan test eder.
//
// Ekran kendi başına bir limit ya da vaat ÜRETMEZ: her satırın limiti
// utils/premiumFeatures.js kaydından, harcanan miktarı çağıranın verdiği
// `usage` haritasından gelir. Böylece ödeme ekranında vaat edilen ile burada
// gösterilen aynı kaynaktan çıkar ("burada olmayan bir şey satılamaz" kuralı).
//
// `usage` biçimi:
//   { [featureId]: number }       sayılı/günlük özellikler (bilinmiyorsa anahtar yok)
//   ai: { dailyUsed, monthlyUsed } | null     (bkz. readAiUsageDoc)

import { copyLanguage, intlLocaleOf, normalizeAppLanguage } from "./appLanguages";
import { getPremiumPlanDisplayName } from "./premium";
import {
  FEATURE_CATEGORIES,
  FEATURE_IDS,
  FEATURE_KIND,
  PREMIUM_FEATURES,
  getFeatureLimit,
  isLockedFor,
  nextPlanFor,
  normalizePlan,
  formatFeatureValue,
} from "./premiumFeatures";

const { ACCESS, DAILY, AI_QUOTA } = FEATURE_KIND;

/** Çubuğu "azalıyor" renginde gösteren eşik (kullanılan / limit). */
export const LOW_RATIO = 0.8;

/**
 * Dolu görünmesi bir alarm olmayan satırlar: sayı bir TAVAN, harcama değil.
 * (Platform bildirimi: izleme listesinin son N yapımı zaten otomatik takipte.)
 */
const INFORMATIONAL = Object.freeze(new Set(["streaming_alerts"]));

const pick = (copy, language) =>
  copy?.[copyLanguage(language, ["tr", "en", "es", "pt"])] ?? copy?.en ?? copy?.tr ?? "";

const toCount = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
};

// ── Zaman ────────────────────────────────────────────────────────────────────

/** Bir sonraki YEREL gece yarısı (günlük oyun/CineSwipe hakları burada yenilenir). */
export function nextLocalMidnight(now = new Date()) {
  const next = new Date(now.getTime());
  next.setHours(24, 0, 0, 0);
  return next;
}

/** Bir sonraki UTC gece yarısı (AI günlük kotası sunucuda UTC'ye göre sayılır). */
export function nextUtcMidnight(now = new Date()) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
}

/** Bir sonraki UTC ay başı (AI aylık kotası). */
export function nextUtcMonthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

export const utcDayKey = (now = new Date()) => now.toISOString().slice(0, 10);
export const utcMonthKey = (now = new Date()) => now.toISOString().slice(0, 7);

/**
 * AiUsage/{uid} belgesinden bugünkü/bu ayki kullanım. Kural functions/aiQuota.js
 * `readAiUsage` ile AYNI (eski `date`/`count` alanlarına da bakar); eşitliği
 * __tests__/premiumUsageModel.test.js doğrular.
 */
export function readAiUsageDoc(data, now = new Date()) {
  if (!data || typeof data !== "object") return { dailyUsed: 0, monthlyUsed: 0 };
  const dayKey = utcDayKey(now);
  const monthKey = utcMonthKey(now);
  const legacyDaily =
    data.date === dayKey && Number.isFinite(data.count) ? data.count : 0;
  const dailyUsed =
    data.dailyKey === dayKey && Number.isFinite(data.dailyCount)
      ? data.dailyCount
      : legacyDaily;
  const monthlyUsed =
    data.monthKey === monthKey && Number.isFinite(data.monthlyCount)
      ? data.monthlyCount
      : 0;
  return {
    dailyUsed: Math.max(0, dailyUsed),
    monthlyUsed: Math.max(0, monthlyUsed),
  };
}

/**
 * "5 sa 12 dk" / "12 dk" / "5h 12m". Bir dakikadan kısa süre "1 dk" yazılır
 * (sayaç 0 göstermesin).
 */
export function formatCountdown(ms, language = "en") {
  const tr = language === "tr";
  const es = normalizeAppLanguage(language) === "es";
  const pt = normalizeAppLanguage(language) === "pt";
  const totalMinutes = Math.max(1, Math.ceil((Number(ms) || 0) / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days > 0) parts.push(tr ? `${days} gün` : es ? `${days} d` : pt ? `${days} d` : `${days}d`);
  if (hours > 0) parts.push(tr ? `${hours} sa` : es ? `${hours} h` : pt ? `${hours} h` : `${hours}h`);
  // Gün gösteriliyorsa dakika gürültü olur.
  if (minutes > 0 && days === 0) parts.push(tr ? `${minutes} dk` : es ? `${minutes} min` : pt ? `${minutes} min` : `${minutes}m`);
  return parts.join(" ");
}

/** "Yenilenmesine 5 sa 12 dk" — 48 saati aşan sürelerde tarih verilir (ay başı). */
export function formatResetLabel(resetAt, now = new Date(), language = "en") {
  const tr = language === "tr";
  const es = normalizeAppLanguage(language) === "es";
  const pt = normalizeAppLanguage(language) === "pt";
  const ms = resetAt.getTime() - now.getTime();
  if (ms > 2 * 86400000) {
    let date;
    try {
      date = new Intl.DateTimeFormat(intlLocaleOf(language), {
        day: "numeric",
        month: "long",
      }).format(resetAt);
    } catch {
      date = resetAt.toISOString().slice(0, 10);
    }
    return tr ? `${date} tarihinde yenilenir` : es ? `Se restablece el ${date}` : pt ? `Redefine em ${date}` : `Resets on ${date}`;
  }
  const left = formatCountdown(ms, language);
  return tr ? `${left} sonra yenilenir` : es ? `Se restablece en ${left}` : pt ? `Redefine em ${left}` : `Resets in ${left}`;
}

// ── Satır üretimi ────────────────────────────────────────────────────────────

function stateFor({ limit, used, informational }) {
  if (!Number.isFinite(limit)) return "unlimited";
  if (limit <= 0) return "locked";
  if (used === null) return "unknown";
  if (used >= limit) return informational ? "ok" : "full";
  return used / limit >= LOW_RATIO && !informational ? "low" : "ok";
}

function meterFor({ label, used, limit }) {
  const usedCount = toCount(used);
  const finite = Number.isFinite(limit);
  return {
    label,
    used: usedCount,
    limit,
    remaining: finite && usedCount !== null ? Math.max(0, limit - usedCount) : null,
    ratio: finite && limit > 0 && usedCount !== null ? Math.min(1, usedCount / limit) : 0,
  };
}

/** Tek özellik için satır. Bilinmeyen özellikte null. */
export function buildUsageRow(featureId, plan, usage = {}, now = new Date(), language = "en") {
  const definition = PREMIUM_FEATURES[featureId];
  if (!definition) return null;
  const lang = normalizeAppLanguage(language);
  const tr = lang === "tr";
  const es = normalizeAppLanguage(lang) === "es";
  const pt = normalizeAppLanguage(lang) === "pt";
  const current = normalizePlan(plan);
  const category = FEATURE_CATEGORIES.find((c) => c.id === definition.category) || null;

  const base = {
    id: featureId,
    icon: definition.icon,
    color: category?.color || "#8B5CF6",
    kind: definition.kind,
    title: pick(definition.title, lang),
    note: definition.note ? pick(definition.note, lang) : null,
    // Plan değeri ("5 liste", "Yalnız izleyici", "Sınırsız") — tek bakışlık özet.
    valueLabel: formatFeatureValue(featureId, current, lang),
    nextPlan: nextPlanFor(featureId, current),
    unit: definition.unit ? pick(definition.unit, lang) : null,
    meters: [],
    reset: null,
  };

  // ── Aç/kapa özellikler ──
  if (definition.kind === ACCESS) {
    const locked = isLockedFor(featureId, current);
    return { ...base, state: locked ? "locked" : "included", limit: locked ? 0 : null, used: null, remaining: null };
  }

  // ── AI kotası: günlük + aylık tek satırda iki sayaç ──
  if (definition.kind === AI_QUOTA) {
    const limits = getFeatureLimit(featureId, current);
    const ai = usage.ai || null;
    const daily = meterFor({
      label: tr ? "Bugün" : es ? "Hoy" : pt ? "Hoje" : "Today",
      used: ai ? ai.dailyUsed : null,
      limit: limits.daily,
    });
    const monthly = meterFor({
      label: tr ? "Bu ay" : es ? "Este mes" : pt ? "Este mês" : "This month",
      used: ai ? ai.monthlyUsed : null,
      limit: limits.monthly,
    });
    const known = daily.remaining !== null && monthly.remaining !== null;
    // Şu an gönderilebilecek mesaj: iki tavandan DARI belirler (gün 3, ay 1 kaldıysa 1).
    const remaining = known ? Math.min(daily.remaining, monthly.remaining) : null;
    const state = !known
      ? "unknown"
      : remaining === 0
        ? "full"
        : Math.max(daily.ratio, monthly.ratio) >= LOW_RATIO
          ? "low"
          : "ok";
    // Hangi tavan şu an engelleyici? Yenilenme bilgisi onu söylemeli.
    const monthlyBlocks = known && monthly.remaining === 0;
    return {
      ...base,
      state,
      meters: [daily, monthly],
      used: daily.used,
      limit: limits.daily,
      remaining,
      reset: monthlyBlocks
        ? { at: nextUtcMonthStart(now), label: formatResetLabel(nextUtcMonthStart(now), now, lang) }
        : { at: nextUtcMidnight(now), label: formatResetLabel(nextUtcMidnight(now), now, lang) },
    };
  }

  // ── Pencere özellikleri (Wrapped arşivi): harcanan bir şey yok ──
  // "3 / 5" çizmek yanıltıcı olur (5 yıl bir tavan değil, görülebilen aralık);
  // satır planın penceresini söyler ("Yalnız bu yıl", "Son 5 yıl", "Tüm yıllar").
  if (definition.window) {
    return {
      ...base,
      state: "included",
      limit: getFeatureLimit(featureId, current),
      used: null,
      overflow: 0,
      remaining: null,
    };
  }

  // ── Sayılı (COUNT) ve günlük (DAILY) özellikler ──
  const limit = getFeatureLimit(featureId, current);
  const rawUsed = toCount(usage[featureId]);
  const informational = INFORMATIONAL.has(featureId);
  const finite = Number.isFinite(limit);
  // Bilgi satırında sayı bir tavan (ör. izleme listesi 40 yapım, 10'u takipte):
  // "kullanılan" tavanı aşamaz; taşan kısım `overflow` olarak ayrıca söylenir.
  const used = informational && finite && rawUsed !== null ? Math.min(rawUsed, limit) : rawUsed;
  const overflow = informational && finite && rawUsed !== null ? Math.max(0, rawUsed - limit) : 0;
  const state = stateFor({ limit, used, informational });
  const row = {
    ...base,
    state,
    limit,
    used,
    overflow,
    remaining: finite && used !== null ? Math.max(0, limit - used) : finite ? null : Infinity,
    meters: [],
    reset: null,
  };
  if (definition.kind === DAILY && state !== "locked") {
    const at = nextLocalMidnight(now);
    row.reset = { at, label: formatResetLabel(at, now, lang) };
  }
  if (finite && limit > 0) {
    row.meters = [meterFor({ label: "", used, limit })];
  }
  return row;
}

/**
 * Ekranın tamamı: kategori → satırlar + üst özet.
 * `summary.counts`: kilitli / dolu / azalan satır sayısı (üst şeritte gösterilir).
 */
export function buildUsageModel({ plan, usage = {}, now = new Date(), language = "en" } = {}) {
  const lang = normalizeAppLanguage(language);
  const current = normalizePlan(plan);
  const rows = FEATURE_IDS.map((id) => buildUsageRow(id, current, usage, now, lang)).filter(Boolean);

  const sections = FEATURE_CATEGORIES.map((category) => ({
    id: category.id,
    icon: category.icon,
    color: category.color,
    title: pick(category.title, lang),
    rows: rows.filter((row) => PREMIUM_FEATURES[row.id].category === category.id),
  })).filter((section) => section.rows.length > 0);

  const counts = { locked: 0, full: 0, low: 0, ok: 0, unlimited: 0, included: 0, unknown: 0 };
  for (const row of rows) counts[row.state] = (counts[row.state] || 0) + 1;

  return {
    plan: current,
    planName: getPremiumPlanDisplayName(current),
    canUpgrade: rows.some((row) => row.nextPlan),
    sections,
    summary: { total: rows.length, counts },
  };
}
