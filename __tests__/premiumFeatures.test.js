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
  WRAPPED_YEARS_VISIBLE,
  buildLimitCopy,
  canUseFeature,
  canUseFontPreset,
  canViewWrappedYear,
  formatFeatureValue,
  getComparisonSections,
  getFeatureLimit,
  higherPlan,
  isLockedFor,
  nextPlanFor,
  normalizePlan,
  pickViewableWrappedYear,
  planRank,
  remainingUses,
  requiredPlanForWrappedYear,
} from "../utils/premiumFeatures";
import {
  FONT_PRESETS,
  TEXT_ROLES,
  isPresetRecommendedFor,
  isValidPresetId,
} from "../utils/typographyRoles";
import { FAMILY_THEME_KEYS } from "../theme/colors";

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
    expect(PRESET_THEME_COUNT).toBe(FAMILY_THEME_KEYS.length);
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
    expect(canUseFeature("custom_lists", FREE, 0)).toBe(true);
    expect(canUseFeature("custom_lists", FREE, 1)).toBe(false);
    expect(canUseFeature("custom_lists", PREMIUM, 5)).toBe(true);
    expect(canUseFeature("custom_lists", MAX, 10_000)).toBe(true);
    expect(remainingUses("custom_lists", FREE, 0)).toBe(1);
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

  test("yazı tipi kuralları", () => {
    expect(canUseFontPreset("system", FREE)).toBe(true);
    expect(canUseFontPreset("oswald", FREE)).toBe(true);
    expect(canUseFontPreset("monoton", FREE)).toBe(false);
    expect(canUseFontPreset("monoton", PREMIUM)).toBe(true);
  });
});

describe("Wrapped arşivi: Free bu yıl, Premium son 5 yıl, Max sınırsız", () => {
  const now = new Date(2026, 8, 18);

  test("Free yalnız bu yılı görür; geçen yıl bile kilitli", () => {
    expect(canViewWrappedYear(2026, FREE, now)).toBe(true);
    expect(canViewWrappedYear(2025, FREE, now)).toBe(false);
    expect(canViewWrappedYear(2020, FREE, now)).toBe(false);
  });

  test("Premium bu yıl dahil son 5 yılı görür, daha eskisi kilitli", () => {
    for (const year of [2026, 2025, 2024, 2023, 2022]) {
      expect(canViewWrappedYear(year, PREMIUM, now)).toBe(true);
    }
    expect(canViewWrappedYear(2021, PREMIUM, now)).toBe(false);
    expect(canViewWrappedYear(2000, PREMIUM, now)).toBe(false);
  });

  test("Premium Max'te yıl sınırı yok", () => {
    expect(canViewWrappedYear(2026, MAX, now)).toBe(true);
    expect(canViewWrappedYear(2021, MAX, now)).toBe(true);
    expect(canViewWrappedYear(1999, MAX, now)).toBe(true);
  });

  test("pencere yıl değişince kayar (aynı plan, ertesi yıl)", () => {
    const nextYear = new Date(2027, 0, 2);
    expect(canViewWrappedYear(2026, FREE, nextYear)).toBe(false);
    expect(canViewWrappedYear(2027, FREE, nextYear)).toBe(true);
    expect(canViewWrappedYear(2022, PREMIUM, nextYear)).toBe(false);
    expect(canViewWrappedYear(2023, PREMIUM, nextYear)).toBe(true);
  });

  test("geçersiz yıl kapalı; gelecek yıl (veri kayması) açık", () => {
    expect(canViewWrappedYear(undefined, MAX, now)).toBe(false);
    expect(canViewWrappedYear("abc", PREMIUM, now)).toBe(false);
    expect(canViewWrappedYear(2027, FREE, now)).toBe(true);
    // Yıl sayı olarak değil dize olarak gelse de (Object.keys) aynı sonuç.
    expect(canViewWrappedYear("2025", FREE, now)).toBe(false);
  });

  test("kilitli yılı açan en düşük plan", () => {
    expect(requiredPlanForWrappedYear(2026, now)).toBe(FREE);
    expect(requiredPlanForWrappedYear(2025, now)).toBe(PREMIUM);
    expect(requiredPlanForWrappedYear(2022, now)).toBe(PREMIUM);
    expect(requiredPlanForWrappedYear(2021, now)).toBe(MAX);
    expect(requiredPlanForWrappedYear("abc", now)).toBe(null);
  });

  test("Hub kartı için görülebilir en yeni yıl (Ocak senaryosu dahil)", () => {
    const years = [2026, 2025, 2024, 2021];
    expect(pickViewableWrappedYear(years, FREE, now)).toBe(2026);
    expect(pickViewableWrappedYear(years, PREMIUM, now)).toBe(2026);
    // Bu yıl henüz kayıt yoksa Free'nin görebileceği yıl da yoktur: kart çizilmez.
    expect(pickViewableWrappedYear([2025, 2024], FREE, now)).toBe(null);
    expect(pickViewableWrappedYear([2025, 2024], PREMIUM, now)).toBe(2025);
    // Yalnız 5 yıldan eski veri varsa Premium'a da gösterilecek yıl yok, Max'e var.
    expect(pickViewableWrappedYear([2020, 2019], PREMIUM, now)).toBe(null);
    expect(pickViewableWrappedYear([2020, 2019], MAX, now)).toBe(2020);
    expect(pickViewableWrappedYear([], MAX, now)).toBe(null);
    expect(pickViewableWrappedYear(undefined, MAX, now)).toBe(null);
  });

  test("limitler sabitle aynı; sonraki plan yalnız pencere genişliyorsa önerilir", () => {
    expect(getFeatureLimit("wrapped_archive", FREE)).toBe(WRAPPED_YEARS_VISIBLE.free);
    expect(getFeatureLimit("wrapped_archive", PREMIUM)).toBe(WRAPPED_YEARS_VISIBLE.premium);
    expect(getFeatureLimit("wrapped_archive", MAX)).toBe(UNLIMITED);
    expect(WRAPPED_YEARS_VISIBLE.free).toBe(1);
    expect(WRAPPED_YEARS_VISIBLE.premium).toBe(5);
    expect(nextPlanFor("wrapped_archive", FREE)).toBe(PREMIUM);
    expect(nextPlanFor("wrapped_archive", PREMIUM)).toBe(MAX);
    expect(nextPlanFor("wrapped_archive", MAX)).toBe(null);
  });

  test("Free'de bu özellik 'kapalı' değil (bu yıl açık)", () => {
    expect(isLockedFor("wrapped_archive", FREE)).toBe(false);
  });

  test("karşılaştırma hücreleri plan penceresini söyler", () => {
    expect(formatFeatureValue("wrapped_archive", FREE, "tr")).toBe("Yalnız bu yıl");
    expect(formatFeatureValue("wrapped_archive", PREMIUM, "tr")).toBe("Son 5 yıl");
    expect(formatFeatureValue("wrapped_archive", MAX, "tr")).toBe("Tüm yıllar");
    expect(formatFeatureValue("wrapped_archive", FREE, "en")).toBe("This year only");
    expect(formatFeatureValue("wrapped_archive", PREMIUM, "en")).toBe("Last 5 years");
    expect(formatFeatureValue("wrapped_archive", MAX, "en")).toBe("Every year");
  });

  test("limit cümlesi planın penceresini ve üst planları anlatır", () => {
    const free = buildLimitCopy("wrapped_archive", FREE, "tr");
    expect(free.canUpgrade).toBe(true);
    expect(free.message).toBe(
      "Free planında yalnızca bu yılın Wrapped özetini görebilirsin. " +
        "Premium ile son 5 yıl, Premium Max ile tüm yıllar.",
    );
    const premium = buildLimitCopy("wrapped_archive", PREMIUM, "en");
    expect(premium.message).toBe(
      "On Premium, you can view your Wrapped recaps from the last 5 years. " +
        "With Premium Max: every year.",
    );
  });
});

describe("metinler", () => {
  test("karşılaştırma hücreleri", () => {
    expect(formatFeatureValue("custom_lists", FREE, "tr")).toBe("1 liste");
    expect(formatFeatureValue("custom_lists", MAX, "tr")).toBe("Sınırsız");
    expect(formatFeatureValue("games", PREMIUM, "en")).toBe("20 games/day");
    expect(formatFeatureValue("ai_messages", FREE, "tr")).toBe("3/gün · 30/ay");
    expect(formatFeatureValue("identity_badge", FREE, "tr")).toBe("—");
    expect(formatFeatureValue("identity_badge", MAX, "tr")).toBe("Efsanevi rozet");
    expect(formatFeatureValue("custom_themes", FREE, "tr")).toBe("9 hazır tema");
    expect(formatFeatureValue("font_catalog", PREMIUM, "en")).toBe("56 fonts");
  });

  test("Portekizce karşılaştırma hücreleri ve uyarılar", () => {
    expect(formatFeatureValue("custom_lists", FREE, "pt")).toBe("1 lista");
    expect(formatFeatureValue("custom_lists", MAX, "pt")).toBe("Ilimitado");
    expect(formatFeatureValue("ai_messages", FREE, "pt")).toBe("3/dia · 30/mês");
    expect(formatFeatureValue("identity_badge", FREE, "pt")).toBe("—");
    const copy = buildLimitCopy("custom_lists", FREE, "pt");
    expect(copy.canUpgrade).toBe(true);
    expect(copy.message).toMatch(/Grátis/);
    expect(copy.message).toMatch(/Premium Max/);
    expect(copy.message).not.toMatch(/Gratis|Free/);
  });

  test("İspanyolca karşılaştırma hücreleri ve uyarılar", () => {
    expect(formatFeatureValue("custom_lists", FREE, "es")).toBe("1 lista");
    expect(formatFeatureValue("custom_lists", MAX, "es")).toBe("Ilimitado");
    expect(formatFeatureValue("ai_messages", FREE, "es")).toBe("3/día · 30/mes");
    expect(formatFeatureValue("identity_badge", FREE, "es")).toBe("—");
    const copy = buildLimitCopy("custom_lists", FREE, "es");
    expect(copy.canUpgrade).toBe(true);
    // Türkçeye ya da İngilizceye düşmediğini ve plan adlarının yerine oturduğunu kilitler.
    expect(copy.message).toMatch(/Gratis/);
    expect(copy.message).toMatch(/Premium Max/);
    expect(copy.message).not.toMatch(/Free planında|On Free|only/i);
  });

  test("bilinmeyen dil İngilizce metin alır, Türkçe değil", () => {
    expect(formatFeatureValue("games", PREMIUM, "fr")).toBe(formatFeatureValue("games", PREMIUM, "en"));
    expect(buildLimitCopy("custom_lists", FREE, "fr").message).toBe(
      buildLimitCopy("custom_lists", FREE, "en").message,
    );
  });

  test("karşılaştırma tablosu üç dilde de aynı satırlara sahip", () => {
    const kimlikler = (dil) =>
      getComparisonSections(dil).flatMap((section) => section.rows.map((row) => row.id)).sort();
    expect(kimlikler("es")).toEqual(kimlikler("tr"));
    expect(kimlikler("en")).toEqual(kimlikler("tr"));
  });

  test("sayılı limit uyarısı üst planların değerini söyler", () => {
    const copy = buildLimitCopy("custom_lists", FREE, "tr");
    expect(copy.canUpgrade).toBe(true);
    expect(copy.message).toBe(
      "Free planında en fazla 1 özel liste oluşturabilirsin. Premium ile 25, Premium Max ile sınırsız.",
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
      "Free planında günde 3 CineMatch AI mesajı gönderebilirsin. Premium ile 20, Premium Max ile 50.",
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

// ── Free planı: ürün kararları ────────────────────────────────────────────────
// 10 Ekim 2026 kararı. Tablo bilerek testte DÜZ yazıldı: kayıttaki bir sayı
// değişirse (ya da biri Free'ye bir hak eklerse) burası kırılır ve karar yeniden
// düşünülür. Premium/Max değerleri kullanıcı kararı değil, önerilen varsayılandır.
describe("Free planı kararları", () => {
  const freeLimit = (id) => getFeatureLimit(id, FREE);

  test("sosyal: iki arkadaş, bir grup", () => {
    expect(freeLimit("friends")).toBe(2);
    expect(freeLimit("chat_groups")).toBe(1);
  });

  test("AI: günde 3, ayda 30", () => {
    expect(freeLimit("ai_messages")).toEqual({ daily: 3, monthly: 30 });
  });

  test("listeler: dört hazır liste + bir özel liste", () => {
    expect(freeLimit("custom_lists")).toBe(1);
  });

  test("Hub: oyun ve CineSwipe Free'de YOK", () => {
    for (const id of ["games", "cineswipe_rooms", "cineswipe_swipes"]) {
      expect(freeLimit(id)).toBe(0);
      expect(isLockedFor(id, FREE)).toBe(true);
      expect(isLockedFor(id, PREMIUM)).toBe(false);
      expect(canUseFeature(id, FREE, 0)).toBe(false);
    }
  });

  test("turnuva: Free yalnız seyirci (oy yok)", () => {
    expect(freeLimit("tournament_vote")).toBe(false);
    expect(canUseFeature("tournament_vote", FREE)).toBe(false);
    expect(canUseFeature("tournament_vote", PREMIUM)).toBe(true);
  });

  test("kişiselleştirme: simge, kar, ambiyans, ikon arka planı, pet Free'de YOK", () => {
    for (const id of ["app_icon", "snow_effect", "ambient_background", "icon_background", "pet_companion"]) {
      expect(freeLimit(id)).toBe(false);
      expect(isLockedFor(id, FREE)).toBe(true);
      expect(canUseFeature(id, PREMIUM)).toBe(true);
    }
  });

  test("hatırlatma: 10 film, 20 dizi", () => {
    expect(freeLimit("movie_reminders")).toBe(10);
    expect(freeLimit("tv_reminders")).toBe(20);
  });

  test("notlar: 5 not, 5 yapılacak, 20 film notu, 20 dizi notu", () => {
    expect(freeLimit("notes")).toBe(5);
    expect(freeLimit("todos")).toBe(5);
    expect(freeLimit("movie_notes")).toBe(20);
    expect(freeLimit("tv_notes")).toBe(20);
  });

  test("hiçbir Free değeri Premium'dan büyük değil (yeni özelliklerde de)", () => {
    for (const id of FEATURE_IDS) {
      const feature = PREMIUM_FEATURES[id];
      if (feature.kind === FEATURE_KIND.ACCESS || feature.kind === FEATURE_KIND.AI_QUOTA) continue;
      expect(feature.limits.free).toBeLessThanOrEqual(feature.limits.premium);
    }
  });
});

describe("isLockedFor ve kapalı özellik metinleri", () => {
  test("erişim özelliği: planda yoksa kilitli", () => {
    expect(isLockedFor("custom_themes", FREE)).toBe(true);
    expect(isLockedFor("custom_themes", PREMIUM)).toBe(false);
  });

  test("sayılı özellik: limit 0 kilitli, dolu olmak kilitli değil", () => {
    expect(isLockedFor("games", FREE)).toBe(true);
    // Free'de 1 özel liste var: dolsa bile kapalı değil, LİMİT dolmuş olur.
    expect(isLockedFor("custom_lists", FREE)).toBe(false);
    expect(isLockedFor("ai_messages", FREE)).toBe(false);
  });

  test("bilinmeyen özellik kapalı sayılır (kapı açık kalmasın)", () => {
    expect(isLockedFor("yok_boyle", MAX)).toBe(true);
  });

  test("kapalı özellik hücresi '0 oyun/gün' değil '—' yazar", () => {
    expect(formatFeatureValue("games", FREE, "tr")).toBe("—");
    expect(formatFeatureValue("cineswipe_swipes", FREE, "en")).toBe("—");
    expect(formatFeatureValue("games", PREMIUM, "tr")).toBe("20 oyun/gün");
  });

  test("erişim hücreleri serbest/ücretli değeri söyler", () => {
    expect(formatFeatureValue("tournament_vote", FREE, "tr")).toBe("Yalnız izleyici");
    expect(formatFeatureValue("tournament_vote", PREMIUM, "tr")).toBe("Oy kullanabilir");
    expect(formatFeatureValue("snow_effect", FREE, "en")).toBe("Off");
    expect(formatFeatureValue("app_icon", PREMIUM, "en")).toBe("Icon picker");
  });

  test("kapalı sayılı özellik 'günlük hakkın doldu' demez", () => {
    const copy = buildLimitCopy("games", FREE, "tr");
    expect(copy.title).toBe("Premium özelliği");
    expect(copy.message).toBe("Sahne tahmin oyunu Premium ve Premium Max planlarında açık.");
    expect(copy.canUpgrade).toBe(true);
    expect(copy.message).not.toMatch(/yarın/);
  });
});

describe("yeni özelliklerin kayıt bütünlüğü", () => {
  test("her sayılı özelliğin notu ve cümlesi iki dilde dolu", () => {
    for (const id of ["notes", "todos", "movie_notes", "tv_notes", "movie_reminders", "tv_reminders"]) {
      const feature = PREMIUM_FEATURES[id];
      expect(feature.kind).toBe(FEATURE_KIND.COUNT);
      expect(feature.phrase.tr(3)).toContain("3");
      expect(feature.phrase.en(3)).toContain("3");
      expect(feature.note.tr).toBeTruthy();
      expect(feature.note.en).toBeTruthy();
    }
  });

  test("erişim özelliklerinin ücretsiz ve ücretli değeri tanımlı (karşılaştırma tablosu '—' basmasın)", () => {
    for (const id of ["tournament_vote", "app_icon", "snow_effect", "ambient_background", "icon_background", "pet_companion", "bug_report", "feature_request"]) {
      const feature = PREMIUM_FEATURES[id];
      expect(feature.freeValue.tr && feature.freeValue.en).toBeTruthy();
      expect(feature.paidValue.tr && feature.paidValue.en).toBeTruthy();
    }
  });

  test("kapalı olabilen sayılı özelliklerin kapalı durum başlığı ve mesajı var", () => {
    for (const id of FEATURE_IDS) {
      const feature = PREMIUM_FEATURES[id];
      if (feature.kind === FEATURE_KIND.ACCESS || feature.kind === FEATURE_KIND.AI_QUOTA) continue;
      if (feature.limits.free !== 0) continue;
      expect(feature.upsell.lockedTitle.tr && feature.upsell.lockedTitle.en).toBeTruthy();
      expect(feature.upsell.message.tr && feature.upsell.message.en).toBeTruthy();
    }
  });
});

// ── Geri bildirim kutusu: hata bildirimi Premium+, özellik isteği yalnız Max ──
// Plan kuralı sunucuda da zorlanır (firestore.rules → Feedback); emülatör testi
// __tests__/rules/firestore.rules.test.js'te, alan/sınır eşitliği
// __tests__/feedbackRulesParity.test.js'te.
describe("geri bildirim kapıları", () => {
  test("hata bildirimi: Free kapalı, Premium ve Max açık", () => {
    expect(canUseFeature("bug_report", FREE)).toBe(false);
    expect(canUseFeature("bug_report", PREMIUM)).toBe(true);
    expect(canUseFeature("bug_report", MAX)).toBe(true);
  });

  test("özellik isteği: yalnız Max açık (Premium'da KAPALI)", () => {
    expect(canUseFeature("feature_request", FREE)).toBe(false);
    expect(canUseFeature("feature_request", PREMIUM)).toBe(false);
    expect(canUseFeature("feature_request", MAX)).toBe(true);
  });

  test("kilitli planda hangi planın açtığı doğru önerilir", () => {
    expect(nextPlanFor("bug_report", FREE)).toBe(PREMIUM);
    expect(nextPlanFor("bug_report", PREMIUM)).toBeNull();
    expect(nextPlanFor("feature_request", FREE)).toBe(MAX);
    expect(nextPlanFor("feature_request", PREMIUM)).toBe(MAX);
    expect(nextPlanFor("feature_request", MAX)).toBeNull();
  });

  test("uyarı metni yalnız-Max özelliğini 'Premium ve Max'te açık' diye vaat etmez", () => {
    const bug = buildLimitCopy("bug_report", FREE, "tr");
    expect(bug.title).toBe("Premium özelliği");
    expect(bug.message).toContain("Premium ve Premium Max");

    const request = buildLimitCopy("feature_request", PREMIUM, "tr");
    expect(request.title).toBe("Premium Max özelliği");
    expect(request.message).toContain("yalnızca Premium Max");
    expect(request.message).not.toContain("Premium ve Premium Max");
    expect(request.canUpgrade).toBe(true);
    expect(buildLimitCopy("feature_request", PREMIUM, "en").message).toContain("Premium Max only");
    expect(buildLimitCopy("feature_request", PREMIUM, "es").message).toContain("solo en Premium Max");
  });

  test("karşılaştırma tablosunda 'Destek' kategorisinde, doğru hücrelerle", () => {
    const support = getComparisonSections("tr").find((section) => section.id === "support");
    expect(support.rows.map((row) => row.id)).toEqual(["bug_report", "feature_request"]);
    const [bug, request] = support.rows;
    expect(bug.values).toEqual({ free: "Yalnız e-posta", premium: "Uygulamadan bildir", unlimited: "Uygulamadan bildir" });
    expect(request.values).toEqual({ free: "Yalnız e-posta", premium: "Yalnız e-posta", unlimited: "Uygulamadan öner" });
  });

  test("sunucu planı ile aynı: kayıt 'unlimited' diye çözümlenen plan özellik isteğini açar", () => {
    expect(resolvePremiumPlan({ premiumUnlimited: true })).toBe(MAX);
    expect(canUseFeature("feature_request", resolvePremiumPlan({ premium: true, premiumPlan: "unlimited" }))).toBe(true);
    expect(canUseFeature("feature_request", resolvePremiumPlan({ premium: true, premiumPlan: "premium" }))).toBe(false);
  });
});
