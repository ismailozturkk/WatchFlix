// "Kullanım ve haklar" ekranının modeli (utils/premiumUsageModel.js).
// Model hiçbir limit üretmez; her sayı kayıttan (utils/premiumFeatures.js) gelir.
// Burada kırılan şey, kullanıcıya gösterilen kalan hakkın yanlış olması demektir.

import { PREMIUM_PLAN } from "../utils/premium";
import {
  FEATURE_CATEGORIES,
  FEATURE_IDS,
  PREMIUM_FEATURES,
  getFeatureLimit,
} from "../utils/premiumFeatures";
import {
  LOW_RATIO,
  buildUsageModel,
  buildUsageRow,
  formatCountdown,
  formatResetLabel,
  nextLocalMidnight,
  nextUtcMidnight,
  nextUtcMonthStart,
  readAiUsageDoc,
} from "../utils/premiumUsageModel";

const { readAiUsage } = require("../functions/aiQuota");

const { FREE, PREMIUM, UNLIMITED: MAX } = PREMIUM_PLAN;

// 10 Ekim 2026 15:30 yerel. Yerel/UTC farkı test ortamına göre değişir; UTC'ye
// bağlı beklentiler `now` üzerinden hesaplanır, sabit saat yazılmaz.
const NOW = new Date(2026, 9, 10, 15, 30);

const row = (id, plan, usage, lang = "tr") => buildUsageRow(id, plan, usage, NOW, lang);

describe("sayılı özellik satırı", () => {
  test("kalan hak = limit − kullanılan; durum doluluk oranına göre", () => {
    expect(row("notes", FREE, { notes: 2 })).toMatchObject({
      state: "ok",
      limit: 5,
      used: 2,
      remaining: 3,
    });
    expect(row("notes", FREE, { notes: 4 }).state).toBe("low"); // 4/5 = %80
    expect(row("notes", FREE, { notes: 5 })).toMatchObject({ state: "full", remaining: 0 });
  });

  test("eşik: tam LOW_RATIO 'azalıyor' sayılır, altı değil", () => {
    // todos: Free 5 → 4/5 = 0.8
    expect(LOW_RATIO).toBe(0.8);
    expect(row("todos", FREE, { todos: 3 }).state).toBe("ok");
    expect(row("todos", FREE, { todos: 4 }).state).toBe("low");
  });

  test("limit aşılmışsa (plan düşürülmüş hesap) kalan 0, çubuk taşmaz", () => {
    const r = row("custom_lists", FREE, { custom_lists: 12 });
    expect(r.state).toBe("full");
    expect(r.remaining).toBe(0);
    expect(r.meters[0].ratio).toBe(1);
  });

  test("kullanım bilinmiyorsa 'unknown' (0 göstermek yanıltıcı olur)", () => {
    const r = row("friends", FREE, {});
    expect(r.state).toBe("unknown");
    expect(r.used).toBeNull();
    expect(r.remaining).toBeNull();
    expect(r.meters[0].ratio).toBe(0);
  });

  test("bozuk kullanım değeri bilinmiyor sayılır", () => {
    for (const bad of [NaN, -2, "x", null, undefined]) {
      expect(row("friends", FREE, { friends: bad }).state).toBe("unknown");
    }
  });

  test("sınırsız planda limit sonsuz, çubuk yok", () => {
    const r = row("custom_lists", MAX, { custom_lists: 40 });
    expect(r.state).toBe("unlimited");
    expect(r.remaining).toBe(Infinity);
    expect(r.meters).toEqual([]);
    expect(r.used).toBe(40);
  });

  test("limit her zaman kayıttan gelir", () => {
    for (const plan of [FREE, PREMIUM, MAX]) {
      for (const id of ["friends", "chat_groups", "notes", "movie_reminders", "tv_notes"]) {
        expect(row(id, plan, {}).limit).toBe(getFeatureLimit(id, plan));
      }
    }
  });
});

describe("kilitli ve erişim satırları", () => {
  test("Free'de oyun/CineSwipe kilitli: sayaç ve yenilenme yok", () => {
    for (const id of ["games", "cineswipe_rooms", "cineswipe_swipes"]) {
      const r = row(id, FREE, { [id]: 3 });
      expect(r.state).toBe("locked");
      expect(r.meters).toEqual([]);
      expect(r.reset).toBeNull();
      expect(r.nextPlan).toBe(PREMIUM);
    }
  });

  test("Premium'da aynı özellik günlük sayaçlı ve gece yarısı yenilenir", () => {
    const r = row("games", PREMIUM, { games: 5 });
    expect(r).toMatchObject({ state: "ok", limit: 20, used: 5, remaining: 15 });
    expect(r.reset.at.getTime()).toBe(nextLocalMidnight(NOW).getTime());
  });

  test("erişim özellikleri Free'de kilitli, Premium'da dahil", () => {
    for (const id of ["tournament_vote", "app_icon", "snow_effect", "icon_background", "pet_companion"]) {
      expect(row(id, FREE, {}).state).toBe("locked");
      expect(row(id, PREMIUM, {}).state).toBe("included");
      expect(row(id, FREE, {}).nextPlan).toBe(PREMIUM);
      expect(row(id, PREMIUM, {}).nextPlan).toBeNull();
    }
  });

  test("plan değeri etiketi kayıttaki karşılaştırma metniyle aynı", () => {
    expect(row("tournament_vote", FREE, {}).valueLabel).toBe("Yalnız izleyici");
    expect(row("games", FREE, {}).valueLabel).toBe("—");
  });
});

describe("AI satırı", () => {
  const ai = (dailyUsed, monthlyUsed) => ({ ai: { dailyUsed, monthlyUsed } });

  test("iki sayaç; kalan = iki tavandan DARI", () => {
    // Free: günde 3, ayda 30. Gün 1/3 → 2 kaldı; ay 29/30 → 1 kaldı → şu an 1.
    const r = row("ai_messages", FREE, ai(1, 29));
    expect(r.meters).toHaveLength(2);
    expect(r.meters[0]).toMatchObject({ used: 1, limit: 3, remaining: 2 });
    expect(r.meters[1]).toMatchObject({ used: 29, limit: 30, remaining: 1 });
    expect(r.remaining).toBe(1);
  });

  test("günlük tavan dolunca 'full'; yenilenme UTC gece yarısı", () => {
    const r = row("ai_messages", FREE, ai(3, 10));
    expect(r.state).toBe("full");
    expect(r.remaining).toBe(0);
    expect(r.reset.at.getTime()).toBe(nextUtcMidnight(NOW).getTime());
  });

  test("aylık tavan engelliyorsa yenilenme ay başıdır", () => {
    const r = row("ai_messages", FREE, ai(0, 30));
    expect(r.state).toBe("full");
    expect(r.reset.at.getTime()).toBe(nextUtcMonthStart(NOW).getTime());
  });

  test("sayaç henüz okunmadıysa bilinmiyor", () => {
    const r = row("ai_messages", FREE, { ai: null });
    expect(r.state).toBe("unknown");
    expect(r.remaining).toBeNull();
  });

  test("planın limitleri kayıttan: Premium 20/300", () => {
    const r = row("ai_messages", PREMIUM, ai(0, 0));
    expect(r.meters.map((m) => m.limit)).toEqual([20, 300]);
    expect(r.remaining).toBe(20);
  });
});

describe("bilgi satırı (platform bildirimi)", () => {
  test("izleme listesi tavanı aşarsa 'kullanılan' tavanda kalır, taşan ayrı söylenir", () => {
    const r = row("streaming_alerts", FREE, { streaming_alerts: 40 });
    expect(r.used).toBe(10);
    expect(r.overflow).toBe(30);
    // Tavana varmak alarm değil: dolu görünmez.
    expect(r.state).toBe("ok");
  });

  test("tavanın altındaysa taşma yok", () => {
    const r = row("streaming_alerts", FREE, { streaming_alerts: 4 });
    expect(r).toMatchObject({ used: 4, overflow: 0, state: "ok" });
  });
});

describe("tüm ekran", () => {
  test("her özellik tam bir satır; kategoriler kayıt sırasında", () => {
    const model = buildUsageModel({ plan: FREE, usage: {}, now: NOW, language: "tr" });
    const ids = model.sections.flatMap((s) => s.rows.map((r) => r.id));
    expect(ids.sort()).toEqual([...FEATURE_IDS].sort());
    const order = FEATURE_CATEGORIES.map((c) => c.id);
    const seen = model.sections.map((s) => s.id);
    expect(seen).toEqual(order.filter((id) => seen.includes(id)));
  });

  test("Free'de yükseltme önerilir, Premium Max'te önerilmez", () => {
    expect(buildUsageModel({ plan: FREE, now: NOW }).canUpgrade).toBe(true);
    expect(buildUsageModel({ plan: PREMIUM, now: NOW }).canUpgrade).toBe(true);
    expect(buildUsageModel({ plan: MAX, now: NOW }).canUpgrade).toBe(false);
  });

  test("özet sayıları satır durumlarıyla tutarlı", () => {
    const model = buildUsageModel({
      plan: FREE,
      usage: { notes: 5, todos: 4, friends: 0, ai: { dailyUsed: 0, monthlyUsed: 0 } },
      now: NOW,
    });
    const rows = model.sections.flatMap((s) => s.rows);
    const total = Object.values(model.summary.counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(rows.length);
    expect(model.summary.total).toBe(FEATURE_IDS.length);
    expect(model.summary.counts.full).toBeGreaterThanOrEqual(1); // notes 5/5
    expect(model.summary.counts.low).toBeGreaterThanOrEqual(1); // todos 4/5
    expect(model.summary.counts.locked).toBeGreaterThanOrEqual(8);
  });

  test("her plan × dil için çökmez ve her satırın başlığı dolu", () => {
    for (const plan of [FREE, PREMIUM, MAX, "garip"]) {
      for (const language of ["tr", "en"]) {
        const model = buildUsageModel({ plan, usage: {}, now: NOW, language });
        for (const section of model.sections) {
          expect(section.title).toBeTruthy();
          for (const r of section.rows) {
            expect(r.title).toBeTruthy();
            expect(r.valueLabel).toBeTruthy();
          }
        }
      }
    }
  });

  test("plan adı gösterim adıdır", () => {
    expect(buildUsageModel({ plan: MAX, now: NOW }).planName).toBe("Premium Max");
    expect(buildUsageModel({ plan: "garip", now: NOW }).planName).toBe("Free");
  });

  test("bilinmeyen özellik satırı null", () => {
    expect(buildUsageRow("yok", FREE, {}, NOW, "tr")).toBeNull();
  });

  test("kayıttaki her özellik bir sayaç kaynağı olmadan da çizilebilir", () => {
    for (const id of FEATURE_IDS) {
      expect(() => buildUsageRow(id, FREE, {}, NOW, "en")).not.toThrow();
    }
    expect(PREMIUM_FEATURES.notes).toBeTruthy();
  });
});

describe("AiUsage belgesi okuma", () => {
  const cases = [
    [{ dailyKey: "2026-10-10", dailyCount: 2, monthKey: "2026-10", monthlyCount: 12 }],
    [{ date: "2026-10-10", count: 4, monthKey: "2026-10", monthlyCount: 7 }],
    [{ dailyKey: "2026-10-09", dailyCount: 3, monthKey: "2026-09", monthlyCount: 30 }],
    [{}],
    [{ dailyKey: "2026-10-10", dailyCount: -5, monthKey: "2026-10", monthlyCount: -1 }],
  ];

  test.each(cases)("sunucudaki readAiUsage ile birebir aynı: %j", (data) => {
    const now = new Date(Date.UTC(2026, 9, 10, 12, 0));
    expect(readAiUsageDoc(data, now)).toEqual(readAiUsage(data, "2026-10-10", "2026-10"));
  });

  test("belge yoksa ya da bozuksa sıfır", () => {
    expect(readAiUsageDoc(null, NOW)).toEqual({ dailyUsed: 0, monthlyUsed: 0 });
    expect(readAiUsageDoc("x", NOW)).toEqual({ dailyUsed: 0, monthlyUsed: 0 });
  });
});

describe("zaman yardımcıları", () => {
  test("bir sonraki yerel gece yarısı", () => {
    const next = nextLocalMidnight(NOW);
    expect(next.getHours()).toBe(0);
    expect(next.getMinutes()).toBe(0);
    expect(next.getTime()).toBeGreaterThan(NOW.getTime());
    expect(next.getTime() - NOW.getTime()).toBeLessThanOrEqual(25 * 3600 * 1000);
  });

  test("UTC gece yarısı ve ay başı", () => {
    const now = new Date(Date.UTC(2026, 9, 10, 22, 15));
    expect(nextUtcMidnight(now).toISOString()).toBe("2026-10-11T00:00:00.000Z");
    expect(nextUtcMonthStart(now).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    // Yıl sonu taşması.
    expect(nextUtcMonthStart(new Date(Date.UTC(2026, 11, 31, 23, 0))).toISOString()).toBe(
      "2027-01-01T00:00:00.000Z",
    );
  });

  test("geri sayım biçimi", () => {
    expect(formatCountdown(5 * 3600000 + 12 * 60000, "tr")).toBe("5 sa 12 dk");
    expect(formatCountdown(12 * 60000, "en")).toBe("12m");
    expect(formatCountdown(1000, "tr")).toBe("1 dk"); // 0 dk yazılmaz
    expect(formatCountdown(26 * 3600000 + 40 * 60000, "tr")).toBe("1 gün 2 sa"); // gün varken dakika yok
  });

  test("yenilenme etiketi: yakın süre geri sayım, uzak süre tarih", () => {
    const soon = new Date(NOW.getTime() + 3 * 3600000);
    expect(formatResetLabel(soon, NOW, "tr")).toBe("3 sa sonra yenilenir");
    expect(formatResetLabel(soon, NOW, "en")).toBe("Resets in 3h");
    const far = new Date(NOW.getTime() + 20 * 86400000);
    expect(formatResetLabel(far, NOW, "en")).toMatch(/^Resets on /);
    expect(formatResetLabel(far, NOW, "tr")).toMatch(/ tarihinde yenilenir$/);
  });
});

describe("Wrapped arşivi satırı (yıl penceresi)", () => {
  const wrapped = (plan, usage = {}) => buildUsageRow("wrapped_archive", plan, usage, NOW, "tr");

  test("harcama sayacı çizilmez; plan penceresini söyler", () => {
    for (const [plan, label] of [
      [FREE, "Yalnız bu yıl"],
      [PREMIUM, "Son 5 yıl"],
      [MAX, "Tüm yıllar"],
    ]) {
      const r = wrapped(plan);
      expect(r).toMatchObject({ state: "included", used: null, overflow: 0, valueLabel: label });
      expect(r.meters).toEqual([]);
      expect(r.reset).toBeNull();
    }
  });

  test("bir sayaç kaynağı verilse bile 'dolu/azalıyor' olmaz", () => {
    expect(wrapped(FREE, { wrapped_archive: 99 }).state).toBe("included");
  });

  test("yükseltme önerisi: Free → Premium, Premium → Max, Max → yok", () => {
    expect(wrapped(FREE).nextPlan).toBe(PREMIUM);
    expect(wrapped(PREMIUM).nextPlan).toBe(MAX);
    expect(wrapped(MAX).nextPlan).toBeNull();
  });
});
