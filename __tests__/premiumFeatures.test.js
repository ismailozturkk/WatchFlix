// __tests__/premiumFeatures.test.js
//
// Premium yetki kaydının (utils/premiumFeatures.js) sözleşmesi. Bu kayıt hem
// kapıların limitini hem ödeme ekranının metnini üretir; burada kırılan bir
// şey ya kullanıcıya satılan ile verilen arasında fark ya da yanlış bir vaat
// demektir.

import {
  AI_PLAN_LIMITS,
  PREMIUM_PLAN,
} from "../utils/premium";
import {
  FEATURE_CATEGORIES,
  FEATURE_IDS,
  FEATURE_KIND,
  FONT_CATALOG_SIZE,
  FREE_FONT_PRESET_IDS,
  PLANS,
  PREMIUM_FEATURES,
  PRESET_THEME_COUNT,
  UNLIMITED,
  buildLimitCopy,
  canUseFeature,
  canUseFontPreset,
  canViewWrappedYear,
  formatFeatureValue,
  getComparisonSections,
  getFeatureLimit,
  higherPlan,
  isWrappedYearFree,
  nextPlanFor,
  normalizePlan,
  planRank,
  remainingUses,
} from "../utils/premiumFeatures";
import {
  FONT_PRESETS,
  TEXT_ROLES,
  isPresetRecommendedFor,
  isValidPresetId,
} from "../utils/typographyRoles";
import { THEME_NAMES } from "../theme/colors";

const { AI_PLAN_LIMITS: SERVER_AI_PLAN_LIMITS } = require("../functions/aiQuota");
const {
  STREAMING_ALERT_LIMITS,
  getStreamingAlertLimit,
  pickTrackedTitles,
  resolvePremiumPlan,
} = require("../functions/planCapabilities");

const { FREE, PREMIUM, UNLIMITED: MAX } = PREMIUM_PLAN;

describe("kayıt bütünlüğü", () => {
  test("her özelliğin kimliği, türü, kategorisi ve iki dilde başlığı var", () => {
    const categoryIds = new Set(FEATURE_CATEGORIES.map((c) => c.id));
    const kinds = new Set(Object.values(FEATURE_KIND));
    for (const id of FEATURE_IDS) {
      const feature = PREMIUM_FEATURES[id];
      expect(feature.id).toBe(id);
      expect(kinds.has(feature.kind)).toBe(true);
      expect(categoryIds.has(feature.category)).toBe(true);
      expect(feature.title.tr).toBeTruthy();
      expect(feature.title.en).toBeTruthy();
    }
  });

  test("sayılı ve günlük limitler planla birlikte artar, hiç azalmaz", () => {
    for (const id of FEATURE_IDS) {
      const feature = PREMIUM_FEATURES[id];
      if (feature.kind !== FEATURE_KIND.COUNT && feature.kind !== FEATURE_KIND.DAILY) continue;
      const [free, premium, max] = PLANS.map((plan) => feature.limits[plan]);
      expect(free).toBeGreaterThanOrEqual(0);
      expect(premium).toBeGreaterThanOrEqual(free);
      expect(max).toBeGreaterThanOrEqual(premium);
      // Uyarı metni için birim ve cümle kalıbı zorunlu.
      expect(feature.unit.tr && feature.unit.en).toBeTruthy();
      expect(typeof feature.phrase.tr).toBe("function");
      expect(typeof feature.phrase.en).toBe("function");
    }
  });

  test("erişim özellikleri geçerli bir asgari plana bağlı", () => {
    for (const id of FEATURE_IDS) {
      const feature = PREMIUM_FEATURES[id];
      if (feature.kind !== FEATURE_KIND.ACCESS) continue;
      expect(PLANS).toContain(feature.minPlan);
      expect(getFeatureLimit(id, FREE)).toBe(false);
    }
  });

  test("ücretsiz yazı tipleri katalogda var ve her rolü karşılıyor", () => {
    expect(FONT_CATALOG_SIZE).toBe(FONT_PRESETS.length);
    for (const id of FREE_FONT_PRESET_IDS) expect(isValidPresetId(id)).toBe(true);
    for (const role of TEXT_ROLES) {
      const freeForRole = FREE_FONT_PRESET_IDS.filter((id) =>
        isPresetRecommendedFor(id, role),
      );
      // Sistem fontunun yanında en az bir seçenek daha olmalı.
      expect(freeForRole.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("ödeme ekranındaki hazır tema sayısı gerçek tema sayısıyla aynı", () => {
    expect(PRESET_THEME_COUNT).toBe(THEME_NAMES.length);
  });
});

describe("sunucu aynası", () => {
  test("AI kotası istemci, kayıt ve sunucuda aynı", () => {
    expect(PREMIUM_FEATURES.ai_messages.limits).toEqual(AI_PLAN_LIMITS);
    expect(AI_PLAN_LIMITS).toEqual(SERVER_AI_PLAN_LIMITS);
  });

  test("platform bildirimi tavanı istemci ve sunucuda aynı", () => {
    expect(PREMIUM_FEATURES.streaming_alerts.limits).toEqual({ ...STREAMING_ALERT_LIMITS });
  });

  test("sunucu planı entitlements alanından çözer", () => {
    expect(resolvePremiumPlan(undefined)).toBe(FREE);
    expect(resolvePremiumPlan({ premium: true, premiumPlan: PREMIUM })).toBe(PREMIUM);
    expect(resolvePremiumPlan({ premium: true, premiumPlan: MAX })).toBe(MAX);
    expect(getStreamingAlertLimit(undefined)).toBe(10);
    expect(getStreamingAlertLimit({ premium: true, premiumPlan: PREMIUM })).toBe(100);
  });

  test("takip edilen başlıklar en son eklenenlerden seçilir", () => {
    const entries = [
      { id: "eski", updatedAtMs: 100 },
      { id: "tarihsiz" },
      { id: "yeni", updatedAtMs: 300 },
      { id: "orta", updatedAtMs: 200 },
    ];
    expect(pickTrackedTitles(entries, 2).map((e) => e.id)).toEqual(["yeni", "orta"]);
    expect(pickTrackedTitles(entries, 10).map((e) => e.id)).toEqual([
      "yeni",
      "orta",
      "eski",
      "tarihsiz",
    ]);
    expect(pickTrackedTitles(entries, 0)).toEqual([]);
    // Girdi dizisi yerinde sıralanmaz.
    expect(entries[0].id).toBe("eski");
  });
});

describe("plan yardımcıları", () => {
  test("bilinmeyen plan free sayılır, yüksek plan kazanır", () => {
    expect(normalizePlan("gold")).toBe(FREE);
    expect(planRank(MAX)).toBeGreaterThan(planRank(PREMIUM));
    expect(higherPlan(FREE, PREMIUM)).toBe(PREMIUM);
    expect(higherPlan(MAX, PREMIUM)).toBe(MAX);
    expect(higherPlan(undefined, null)).toBe(FREE);
  });

  test("sayılı kapı: limitte durur, üst planda açılır", () => {
    expect(canUseFeature("custom_lists", FREE, 4)).toBe(true);
    expect(canUseFeature("custom_lists", FREE, 5)).toBe(false);
    expect(canUseFeature("custom_lists", PREMIUM, 5)).toBe(true);
    expect(canUseFeature("custom_lists", MAX, 10_000)).toBe(true);
    expect(remainingUses("custom_lists", FREE, 3)).toBe(2);
    expect(remainingUses("custom_lists", FREE, 9)).toBe(0);
    expect(remainingUses("custom_lists", MAX, 9)).toBe(UNLIMITED);
  });

  test("erişim kapısı ve bilinmeyen özellik", () => {
    expect(canUseFeature("custom_themes", FREE)).toBe(false);
    expect(canUseFeature("custom_themes", PREMIUM)).toBe(true);
    // Bilinmeyen özellik kapıyı AÇIK bırakmamalı.
    expect(canUseFeature("yok_boyle", MAX)).toBe(false);
  });

  test("bir sonraki plan yalnız limiti artırıyorsa önerilir", () => {
    expect(nextPlanFor("games", FREE)).toBe(PREMIUM);
    expect(nextPlanFor("games", PREMIUM)).toBe(MAX);
    expect(nextPlanFor("games", MAX)).toBe(null);
    expect(nextPlanFor("custom_themes", FREE)).toBe(PREMIUM);
    expect(nextPlanFor("custom_themes", PREMIUM)).toBe(null);
    // Platform bildirimi Premium ve Max'te aynı: Max önerilmez.
    expect(nextPlanFor("streaming_alerts", PREMIUM)).toBe(null);
    expect(nextPlanFor("ai_messages", PREMIUM)).toBe(MAX);
  });

  test("yazı tipi ve Wrapped yılı kuralları", () => {
    expect(canUseFontPreset("system", FREE)).toBe(true);
    expect(canUseFontPreset("oswald", FREE)).toBe(true);
    expect(canUseFontPreset("monoton", FREE)).toBe(false);
    expect(canUseFontPreset("monoton", PREMIUM)).toBe(true);

    const now = new Date(2026, 8, 18);
    expect(isWrappedYearFree(2026, now)).toBe(true);
    expect(isWrappedYearFree(2025, now)).toBe(true);
    expect(isWrappedYearFree(2024, now)).toBe(false);
    expect(canViewWrappedYear(2020, FREE, now)).toBe(false);
    expect(canViewWrappedYear(2020, PREMIUM, now)).toBe(true);
  });
});

describe("metinler", () => {
  test("karşılaştırma hücreleri", () => {
    expect(formatFeatureValue("custom_lists", FREE, "tr")).toBe("5 liste");
    expect(formatFeatureValue("custom_lists", MAX, "tr")).toBe("Sınırsız");
    expect(formatFeatureValue("games", PREMIUM, "en")).toBe("20 games/day");
    expect(formatFeatureValue("ai_messages", FREE, "tr")).toBe("5/gün · 30/ay");
    expect(formatFeatureValue("identity_badge", FREE, "tr")).toBe("—");
    expect(formatFeatureValue("identity_badge", MAX, "tr")).toBe("Efsanevi rozet");
    expect(formatFeatureValue("custom_themes", FREE, "tr")).toBe("8 hazır tema");
    expect(formatFeatureValue("font_catalog", PREMIUM, "en")).toBe("56 fonts");
  });

  test("sayılı limit uyarısı üst planların değerini söyler", () => {
    const copy = buildLimitCopy("custom_lists", FREE, "tr");
    expect(copy.canUpgrade).toBe(true);
    expect(copy.message).toBe(
      "Free planında en fazla 5 özel liste oluşturabilirsin. Premium ile 25, Premium Max ile sınırsız.",
    );
  });

  test("günlük limit uyarısı yenilenme zamanını söyler", () => {
    const copy = buildLimitCopy("games", PREMIUM, "en");
    expect(copy.title).toBe("Today's limit reached");
    expect(copy.message).toBe(
      "On Premium, you can play 20 games per day. With Premium Max: unlimited. Your limit resets tomorrow.",
    );
  });

  test("AI kotası uyarısı", () => {
    const copy = buildLimitCopy("ai_messages", FREE, "tr");
    expect(copy.message).toBe(
      "Free planında günde 5 CineMatch AI mesajı gönderebilirsin. Premium ile 20, Premium Max ile 50.",
    );
  });

  test("üst plan yoksa yükseltme önerilmez", () => {
    const copy = buildLimitCopy("streaming_alerts", MAX, "tr");
    expect(copy.canUpgrade).toBe(false);
    expect(copy.message).not.toMatch(/ile/);
  });

  test("erişim özelliği uyarısı", () => {
    const copy = buildLimitCopy("custom_themes", FREE, "tr");
    expect(copy.canUpgrade).toBe(true);
    expect(copy.title).toBe("Premium özelliği");
  });

  test("karşılaştırma tablosunda her özellik tam bir kez", () => {
    const rows = getComparisonSections("tr").flatMap((section) => section.rows);
    expect(rows.map((row) => row.id).sort()).toEqual([...FEATURE_IDS].sort());
    for (const row of rows) {
      expect(Object.keys(row.values)).toEqual(PLANS);
    }
  });
});
