// Premium yükseltme sayfasının içerik modeli (utils/premiumUpsellContent.js).
//
// Sayfa kapıya takılan kullanıcıya özelliğe özel konuşur; modelin her alanı
// kayıttaki (utils/premiumFeatures.js) gerçek limitten türer. Burada kırılan bir
// şey, kullanıcıya gösterilen ile verilen arasında fark demektir.

import { PREMIUM_PLAN } from "../utils/premium";
import {
  FEATURE_IDS,
  FEATURE_KIND,
  FONT_CATALOG_SIZE,
  PREMIUM_FEATURES,
  UPSELL_BUNDLES,
  describeCurrentLimit,
  formatFeatureValue,
  upsellBundleFor,
} from "../utils/premiumFeatures";
import {
  MAX_PERKS,
  PERK_CANDIDATES,
  TIER_EM,
  buildChoicePreview,
  buildPriceHint,
  buildUpsellContent,
  fitTierFontSize,
  pickPerks,
  planTierTypography,
  splitTierValue,
  upsellKeyFor,
} from "../utils/premiumUpsellContent";

const { FREE, PREMIUM, UNLIMITED: MAX } = PREMIUM_PLAN;

describe("kayıt: her özelliğin yükseltme metni var", () => {
  test.each(FEATURE_IDS)("%s → iki dilde dolu başlık", (id) => {
    const upsell = PREMIUM_FEATURES[id].upsell;
    expect(upsell).toBeTruthy();
    expect(upsell.title.tr).toBeTruthy();
    expect(upsell.title.en).toBeTruthy();
  });

  test("ACCESS özellikleri iki dilde mesaj da taşır (ayrı bir sayı cümlesi yok)", () => {
    for (const id of FEATURE_IDS) {
      const feature = PREMIUM_FEATURES[id];
      if (feature.kind !== FEATURE_KIND.ACCESS) continue;
      expect(feature.upsell.message.tr).toBeTruthy();
      expect(feature.upsell.message.en).toBeTruthy();
    }
  });

  test("perk adaylarının hepsi kayıtta gerçek bir özellik", () => {
    for (const id of PERK_CANDIDATES) expect(PREMIUM_FEATURES[id]).toBeTruthy();
  });
});

describe("her özellik × plan × dil: sayfa boş kalmaz", () => {
  for (const id of FEATURE_IDS) {
    for (const plan of [FREE, PREMIUM, MAX]) {
      for (const lang of ["tr", "en"]) {
        test(`${id} / ${plan} / ${lang}`, () => {
          const c = buildUpsellContent(id, plan, lang);
          expect(c.title).toBeTruthy();
          expect(c.eyebrow).toBeTruthy();
          expect(c.cta.primary).toBeTruthy();
          expect(c.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
          expect(["limit", "daily", "locked"]).toContain(c.state);
          expect(c.perks.length).toBeLessThanOrEqual(MAX_PERKS);
          // Üst plan yoksa yalnız bilgi: karşılaştırma/fayda ve ikinci düğme yok.
          if (!c.canUpgrade) {
            expect(c.tiers).toEqual([]);
            expect(c.perks).toEqual([]);
            expect(c.cta.secondary).toBeNull();
            expect(c.targetPlan).toBeNull();
          } else {
            expect(c.cta.secondary).toBeTruthy();
            expect(c.tiers.length).toBeGreaterThanOrEqual(2);
            expect(c.tiers.filter((t) => t.isCurrent)).toHaveLength(1);
            expect(c.tiers.filter((t) => t.isTarget)).toHaveLength(1);
          }
        });
      }
    }
  }
});

describe("sayılı limit (özel liste, Free)", () => {
  const c = buildUpsellContent("custom_lists", FREE, "tr", { used: 1 });

  test("durum, başlık ve mevcut limit cümlesi", () => {
    expect(c.state).toBe("limit");
    expect(c.eyebrow).toBe("LİMİT DOLDU");
    expect(c.title).toBe("Liste limitin doldu");
    expect(c.message).toBe("Free planında en fazla 1 özel liste oluşturabilirsin.");
    expect(c.renew).toBeNull();
  });

  test("gösterge: kullanılan / tavan, dolu çubuk", () => {
    expect(c.meter).toEqual({ used: 1, cap: 1, ratio: 1, daily: false, unit: "liste" });
    expect(c.featureTitle).toBe("Özel liste");
  });

  test("plan sütunları: Free şu an, Premium önerilen, Max sınırsız", () => {
    expect(c.tiers.map((t) => [t.plan, t.value, t.isCurrent, t.isTarget])).toEqual([
      [FREE, "1 liste", true, false],
      [PREMIUM, "25 liste", false, true],
      [MAX, "Sınırsız", false, false],
    ]);
  });

  test("düğme metni hedef plana göre (Türkçe ek: 'a)", () => {
    expect(c.cta.primary).toBe("Premium'a geç");
    expect(c.targetPlan).toBe(PREMIUM);
  });

  test("güvence notu kayıttan gelir", () => {
    expect(c.note).toBe("İzleme listesi, izlenenler (film/dizi) ve favoriler her planda sınırsız");
  });
});

describe("gösterge değerleri", () => {
  test("kullanım bilinmiyorsa tavana eşit (sayfa zaten limit dolduğu için açılıyor)", () => {
    expect(buildUpsellContent("custom_lists", FREE, "en").meter).toMatchObject({
      used: 1,
      cap: 1,
      ratio: 1,
    });
  });

  test("tavanı aşan kullanım (plan düşürülmüş hesap) çubuğu taşırmaz", () => {
    expect(buildUpsellContent("custom_lists", FREE, "en", { used: 12 }).meter).toMatchObject({
      used: 12,
      cap: 1,
      ratio: 1,
    });
  });

  test("kısmi kullanım oranı", () => {
    // Free'de tavan 1 olduğundan kısmi oran Premium'da (25) sınanır.
    expect(buildUpsellContent("custom_lists", PREMIUM, "en", { used: 5 }).meter.ratio).toBeCloseTo(0.2);
  });

  test("bozuk kullanım değeri (NaN / negatif) tavana düşer", () => {
    for (const bad of [NaN, -3, "x", undefined, null]) {
      expect(buildUpsellContent("friends", FREE, "en", { used: bad }).meter.used).toBe(2);
    }
  });

  test("ACCESS özelliğinde gösterge yok", () => {
    expect(buildUpsellContent("custom_themes", FREE, "en").meter).toBeNull();
  });

  test("sınırsız planda gösterge yok (tavan sonsuz)", () => {
    expect(buildUpsellContent("custom_lists", MAX, "en").meter).toBeNull();
  });
});

describe("günlük hak (oyun, Premium)", () => {
  const c = buildUpsellContent("games", PREMIUM, "tr", { used: 20 });

  test("günlük durum: yenilenme bilgisi ve günlük gösterge", () => {
    expect(c.state).toBe("daily");
    expect(c.eyebrow).toBe("GÜNLÜK HAK BİTTİ");
    expect(c.title).toBe("Bugünkü oyun hakkın bitti");
    expect(c.renew).toBe("Hakların yarın yenilenir");
    expect(c.meter.daily).toBe(true);
    expect(c.message).toBe("Premium planında günde 20 oyun oynayabilirsin.");
  });

  test("İngilizce", () => {
    const en = buildUpsellContent("games", PREMIUM, "en", { used: 20 });
    expect(en.title).toBe("You're out of games for today");
    expect(en.renew).toBe("Your limit resets tomorrow");
    expect(en.cta.primary).toBe("Upgrade to Premium Max");
  });
});

describe("Premium kullanıcı bir limite takılırsa", () => {
  const c = buildUpsellContent("custom_lists", PREMIUM, "tr", { used: 25 });

  test("yalnız şu an + Max sütunu; hedef Max", () => {
    expect(c.tiers.map((t) => [t.plan, t.isCurrent, t.isTarget])).toEqual([
      [PREMIUM, true, false],
      [MAX, false, true],
    ]);
    expect(c.targetPlan).toBe(MAX);
    expect(c.cta.primary).toBe("Premium Max'e geç");
  });

  test("Premium Max için İngilizce düğme", () => {
    expect(buildUpsellContent("custom_lists", PREMIUM, "en").cta.primary).toBe(
      "Upgrade to Premium Max",
    );
  });
});

describe("Premium Max kullanıcı (yükseltecek plan yok)", () => {
  test("AI günlük kotasında bile yalnız bilgi + tek 'Tamam'", () => {
    const c = buildUpsellContent("ai_messages", MAX, "tr");
    expect(c.canUpgrade).toBe(false);
    expect(c.cta).toEqual({ primary: "Tamam", secondary: null });
    expect(c.message).toBeTruthy();
    expect(buildUpsellContent("ai_messages", MAX, "en").cta.primary).toBe("Got it");
  });

  test("Premium'da Max ile aynı olan limitte de yükseltme sunulmaz", () => {
    // streaming_alerts: Premium 100, Max 100 — Max'e geçmek bir şey kazandırmaz.
    expect(buildUpsellContent("streaming_alerts", PREMIUM, "tr").canUpgrade).toBe(false);
  });
});

describe("kilitli (ACCESS) özellik", () => {
  const c = buildUpsellContent("custom_themes", FREE, "tr");

  test("duruma özel metinler", () => {
    expect(c.state).toBe("locked");
    expect(c.eyebrow).toBe("PREMİUM ÖZELLİK");
    expect(c.title).toBe("Kendi temanı tasarla");
    expect(c.message).toBe("Renkleri sen seç, temanı kaydet ve istediğin an değiştir.");
    expect(c.renew).toBeNull();
    expect(c.note).toBeNull();
  });

  test("sütunlar kayıttaki serbest/ücretli değerleri gösterir", () => {
    expect(c.tiers[0].value).toBe(formatFeatureValue("custom_themes", FREE, "tr"));
    expect(c.tiers[1].value).toBe("Sınırsız özel tema");
  });

  test("yazı tipi başlığı katalog boyutunu kayıttan alır", () => {
    expect(buildUpsellContent("font_catalog", FREE, "tr").title).toBe(
      `${FONT_CATALOG_SIZE} yazı tipinin kilidini aç`,
    );
    expect(buildUpsellContent("font_catalog", FREE, "en").title).toBe(
      `Unlock all ${FONT_CATALOG_SIZE} fonts`,
    );
  });
});

describe("Free'de kapalı sayılı özellik (oyun, CineSwipe)", () => {
  // Limit 0 = "bu planda yok". Sayfa "hak bitti / yarın yenilenir" DEMEMELİ.
  test.each(["games", "cineswipe_rooms", "cineswipe_swipes"])("%s → kilitli, sayaçsız", (id) => {
    const c = buildUpsellContent(id, FREE, "tr");
    expect(c.state).toBe("locked");
    expect(c.eyebrow).toBe("PREMİUM ÖZELLİK");
    expect(c.meter).toBeNull();
    expect(c.renew).toBeNull();
    expect(c.canUpgrade).toBe(true);
    expect(c.targetPlan).toBe(PREMIUM);
    // Kapalı durumun kendi başlığı ve mesajı var; "bugünkü hakkın bitti" değil.
    // CineSwipe'ın iki kapısı Free'de TEK paket sayfasıdır (aşağıda).
    expect(c.title).not.toMatch(/hakkın bitti/);
    expect(c.message).toBe(
      id === "games" ? PREMIUM_FEATURES[id].upsell.message.tr : UPSELL_BUNDLES.cineswipe.message.tr,
    );
  });

  test("aynı özellik Premium'da günlük hak olarak konuşur", () => {
    const c = buildUpsellContent("games", PREMIUM, "tr", { used: 20 });
    expect(c.state).toBe("daily");
    expect(c.title).toBe("Bugünkü oyun hakkın bitti");
  });

  test("plan sütunları Free'de '—' gösterir ('0 oyun/gün' değil)", () => {
    const c = buildUpsellContent("games", FREE, "tr");
    expect(c.tiers[0]).toMatchObject({ plan: FREE, value: "—", isCurrent: true });
    expect(c.tiers[1].value).toBe("20 oyun/gün");
  });

  test("describeCurrentLimit kapalı özellikte cümle kurmaz", () => {
    expect(describeCurrentLimit("games", FREE, "tr")).toBe("");
    expect(describeCurrentLimit("games", PREMIUM, "tr")).toBe(
      "Premium planında günde 20 oyun oynayabilirsin.",
    );
  });
});

describe("paket sayfası: Free'de CineSwipe kart + oda tek sayfa", () => {
  test("iki kapı da AYNI içeriği üretir (hangi düğmeden gelinirse gelinsin)", () => {
    const swipes = buildUpsellContent("cineswipe_swipes", FREE, "tr");
    const rooms = buildUpsellContent("cineswipe_rooms", FREE, "tr");
    expect(rooms).toEqual(swipes);
    expect(swipes.title).toBe("CineSwipe Premium'da");
    expect(swipes.featureId).toBe("cineswipe_swipes");
  });

  test("plan kartları kart ve oda değerlerini alt alta taşır", () => {
    const c = buildUpsellContent("cineswipe_rooms", FREE, "tr");
    const premium = c.tiers.find((tier) => tier.plan === PREMIUM);
    expect(premium.lines.map((line) => line.featureId)).toEqual(["cineswipe_swipes", "cineswipe_rooms"]);
    expect(premium.lines.map((line) => [line.main, line.sub])).toEqual([
      ["300", "kart/gün"],
      ["10", "oda/gün"],
    ]);
    expect(premium.value).toBe("300 kart/gün · 10 oda/gün");
    // Free sütunu "—" ama birim satırı hizalı kalır.
    expect(c.tiers[0].lines.map((line) => [line.main, line.sub])).toEqual([
      ["—", "kart/gün"],
      ["—", "oda/gün"],
    ]);
    expect(c.tierMode).toBe("figure");
  });

  test("Premium'da hak bitince paket YOK: her kapı kendi sayfası", () => {
    const swipes = buildUpsellContent("cineswipe_swipes", PREMIUM, "tr", { used: 300 });
    const rooms = buildUpsellContent("cineswipe_rooms", PREMIUM, "tr", { used: 10 });
    expect(swipes.title).toBe("Bugünkü kaydırma hakkın bitti");
    expect(rooms.title).toBe("Bugünkü oda hakkın bitti");
    expect(swipes.tiers[0].lines).toBeUndefined();
    expect(upsellKeyFor("cineswipe_swipes", PREMIUM)).not.toBe(upsellKeyFor("cineswipe_rooms", PREMIUM));
  });

  test("birleştirme anahtarı Free'de iki üyede aynı, başka özellikte ayrı", () => {
    expect(upsellKeyFor("cineswipe_swipes", FREE)).toBe(upsellKeyFor("cineswipe_rooms", FREE));
    expect(upsellKeyFor("games", FREE)).toBe("games");
    expect(upsellBundleFor("games", FREE)).toBeNull();
  });

  test("paket metni her dilde dolu", () => {
    for (const bundle of Object.values(UPSELL_BUNDLES)) {
      for (const lang of ["tr", "en", "es", "pt", "de"]) {
        expect(bundle.title[lang]).toBeTruthy();
        expect(bundle.message[lang]).toBeTruthy();
      }
      for (const id of bundle.features) expect(FEATURE_IDS).toContain(id);
    }
  });
});

describe("bilinmeyen özellik", () => {
  test("çökmez, yalnız bilgi verir", () => {
    const c = buildUpsellContent("yok_boyle_bir_sey", FREE, "tr");
    expect(c.canUpgrade).toBe(false);
    expect(c.title).toBe("Premium özelliği");
    expect(c.cta.primary).toBe("Tamam");
  });

  test("bilinmeyen plan Free sayılır", () => {
    expect(buildUpsellContent("custom_lists", "garip", "en").tiers[0].plan).toBe(FREE);
  });
});

describe("plan sütunu değeri: figür + birim (splitTierValue)", () => {
  const split = (id, plan, lang = "tr") => splitTierValue(id, plan, lang);

  test("sayı + birim iki parçaya ayrılır", () => {
    expect(split("friends", PREMIUM)).toEqual({ main: "150", sub: "arkadaş", figure: true });
    expect(split("games", PREMIUM)).toEqual({ main: "20", sub: "oyun/gün", figure: true });
    expect(split("cineswipe_swipes", PREMIUM, "en")).toEqual({
      main: "300",
      sub: "cards/day",
      figure: true,
    });
    // ACCESS değeri de "N birim" biçimindeyse aynı ayrım (9 hazır tema).
    expect(split("custom_themes", FREE)).toEqual({ main: "9", sub: "hazır tema", figure: true });
  });

  test("AI kotası günlük/aylık diye ayrılır (nokta satır sonunda kalmaz)", () => {
    expect(split("ai_messages", FREE)).toEqual({ main: "3/gün", sub: "30/ay", figure: true });
    expect(split("ai_messages", MAX, "en")).toEqual({ main: "50/day", sub: "900/mo", figure: true });
  });

  test("sınırsızda figürün altına birim yazılır", () => {
    expect(split("friends", MAX)).toEqual({ main: "Sınırsız", sub: "arkadaş", figure: true });
    expect(split("games", MAX)).toEqual({ main: "Sınırsız", sub: "oyun/gün", figure: true });
    expect(split("friends", MAX, "en")).toEqual({ main: "Unlimited", sub: "friends", figure: true });
  });

  test("kapalı değer '—' figür sayılır, birimsiz", () => {
    expect(split("games", FREE)).toEqual({ main: "—", sub: null, figure: true });
  });

  test("cümle gibi değerler figür DEĞİL: tam metin, birimsiz", () => {
    expect(split("custom_themes", PREMIUM)).toEqual({
      main: "Sınırsız özel tema",
      sub: null,
      figure: false,
    });
    expect(split("wrapped_archive", FREE).figure).toBe(false);
    expect(split("wrapped_archive", PREMIUM)).toMatchObject({ main: "Son 5 yıl", figure: false });
    expect(split("tournament_vote", PREMIUM, "en")).toMatchObject({ main: "Can vote", figure: false });
  });

  test("buildUpsellContent her sütuna parçaları ekler, tam `value` aynen kalır", () => {
    const { tiers } = buildUpsellContent("friends", FREE, "tr");
    expect(tiers.map((t) => [t.value, t.main, t.sub])).toEqual([
      ["2 arkadaş", "2", "arkadaş"],
      ["150 arkadaş", "150", "arkadaş"],
      ["Sınırsız", "Sınırsız", "arkadaş"],
    ]);
  });

  test.each(FEATURE_IDS)("%s → her plan × dilde boş figür/ayrık metin yok", (id) => {
    for (const plan of [FREE, PREMIUM, MAX]) {
      for (const lang of ["tr", "en"]) {
        const full = formatFeatureValue(id, plan, lang);
        const parts = splitTierValue(id, plan, lang);
        expect(parts.main).toBeTruthy();
        // Parçalar birleşince (ayırıcı hariç) tam metnin içeriğini taşır: bilgi kaybı yok.
        const rebuilt = [parts.main, parts.sub].filter(Boolean).join(" ");
        const squash = (s) => s.replace(/[\s·]+/g, "");
        if (parts.figure && parts.sub && !/^Sınırsız$|^Unlimited$/.test(parts.main)) {
          expect(squash(rebuilt)).toBe(squash(full));
        } else if (!parts.figure) {
          expect(parts.main).toBe(full);
        }
      }
    }
  });
});

describe("plan satırı kipi (pickTierMode / tierMode)", () => {
  test("hepsi figür → figür; tek sütun bile cümleyse TÜM satır cümle", () => {
    expect(buildUpsellContent("friends", FREE, "tr").tierMode).toBe("figure");
    expect(buildUpsellContent("ai_messages", FREE, "en").tierMode).toBe("figure");
    // Free "—" + Premium/Max sayı: hepsi figür.
    expect(buildUpsellContent("games", FREE, "tr").tierMode).toBe("figure");
    // Free "9 hazır tema" figür, Premium "Sınırsız özel tema" cümle → karışık → cümle.
    expect(buildUpsellContent("custom_themes", FREE, "tr").tierMode).toBe("phrase");
    // "—" figür, "Epik rozet" cümle → karışık.
    expect(buildUpsellContent("identity_badge", FREE, "tr").tierMode).toBe("phrase");
    expect(buildUpsellContent("wrapped_archive", FREE, "tr").tierMode).toBe("phrase");
  });

  test("yükseltilecek plan yoksa sütun yok, kip figür (çizilmez)", () => {
    const c = buildUpsellContent("friends", MAX, "tr");
    expect(c.tiers).toEqual([]);
    expect(c.tierMode).toBe("figure");
    expect(buildUpsellContent("yok_boyle_bir_sey", FREE, "tr").tierMode).toBe("figure");
  });
});

describe("plan satırı tipografisi (planTierTypography)", () => {
  const WIDTHS = [320, 360, 375, 390, 412, 430];
  const columnWidth = (screen, count) => (screen - 40 - 8 * (count - 1)) / count;

  test("fitTierFontSize: sığdığında tavan, sığmadığında orantılı küçülür, taban altına inmez", () => {
    const range = { max: 22, min: 15 };
    expect(fitTierFontSize(3, 90, TIER_EM.figure, range)).toBe(22);
    expect(fitTierFontSize(8, 90, TIER_EM.figure, range)).toBeCloseTo(18.1, 1);
    expect(fitTierFontSize(40, 90, TIER_EM.figure, range)).toBe(15);
    // Bozuk girdi tavana düşer (çökmez).
    expect(fitTierFontSize(0, 90, TIER_EM.figure, range)).toBe(22);
    expect(fitTierFontSize(5, 0, TIER_EM.figure, range)).toBe(22);
  });

  test("uzun figür ('Unlimited') satırın TÜM kartlarını küçültür, kısa satır tavanda kalır", () => {
    const short = planTierTypography(buildUpsellContent("ai_messages", FREE, "tr").tiers, columnWidth(360, 3));
    const long = planTierTypography(buildUpsellContent("friends", FREE, "en").tiers, columnWidth(360, 3));
    expect(short.mode).toBe("figure");
    expect(short.text).toBe(22);
    expect(long.text).toBeLessThan(short.text);
    expect(long.text).toBeGreaterThanOrEqual(15);
  });

  test("dar ekran daha küçük, geniş ekran daha büyük punto verir", () => {
    const tiers = buildUpsellContent("friends", FREE, "en").tiers;
    const sizes = WIDTHS.map((w) => planTierTypography(tiers, columnWidth(w, 3)).text);
    for (let i = 1; i < sizes.length; i += 1) expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i - 1]);
  });

  test("cümle kipinde en uzun TEK SÖZCÜK belirler ve punto tabanın altına inmez", () => {
    const tiers = buildUpsellContent("tournament_vote", FREE, "tr").tiers; // "kullanabilir"
    const typo = planTierTypography(tiers, columnWidth(360, 3));
    expect(typo.mode).toBe("phrase");
    expect(typo.text).toBeLessThanOrEqual(14);
    expect(typo.text).toBeGreaterThanOrEqual(11.5);
  });

  test.each(FEATURE_IDS)("%s → her plan × dil × genişlikte puntolar aralıkta ve metin sığar", (id) => {
    for (const plan of [FREE, PREMIUM]) {
      for (const lang of ["tr", "en"]) {
        const { tiers } = buildUpsellContent(id, plan, lang);
        if (!tiers.length) continue;
        for (const screen of WIDTHS) {
          const col = columnWidth(screen, tiers.length);
          const typo = planTierTypography(tiers, col);
          const inner = col - 11;
          expect(typo.name).toBeGreaterThanOrEqual(10);
          expect(typo.name).toBeLessThanOrEqual(12.5);
          const range = typo.mode === "figure" ? { min: 15, max: 22 } : { min: 11.5, max: 14 };
          expect(typo.text).toBeGreaterThanOrEqual(range.min);
          expect(typo.text).toBeLessThanOrEqual(range.max);
          // Tahmini genişlik sığmıyorsa punto zaten tabanda olmalı (daha fazla küçülemez).
          const longest =
            typo.mode === "figure"
              ? Math.max(...tiers.map((t) => t.main.length))
              : Math.max(...tiers.flatMap((t) => String(t.value).split(/\s+/).map((w) => w.length)));
          const em = typo.mode === "figure" ? TIER_EM.figure : TIER_EM.word;
          if (longest * em * typo.text > inner + 0.5) expect(typo.text).toBe(range.min);
        }
      }
    }
  });
});

describe("İngilizce tekil/çoğul birim", () => {
  test("tek adette tekil: '1 list', '1 group'", () => {
    expect(formatFeatureValue("custom_lists", FREE, "en")).toBe("1 list");
    expect(formatFeatureValue("chat_groups", FREE, "en")).toBe("1 group");
    expect(formatFeatureValue("custom_lists", PREMIUM, "en")).toBe("25 lists");
  });

  test("göstergedeki birim de adede uyar ('1 / 1 group'), Türkçe değişmez", () => {
    expect(buildUpsellContent("chat_groups", FREE, "en").meter.unit).toBe("group");
    expect(buildUpsellContent("friends", FREE, "en").meter.unit).toBe("friends");
    expect(buildUpsellContent("chat_groups", FREE, "tr").meter.unit).toBe("grup");
  });

  test("limit cümlesi de tekil: 'up to 1 group chat'", () => {
    expect(describeCurrentLimit("chat_groups", FREE, "en")).toBe(
      "On Free, you can create up to 1 group chat.",
    );
    expect(describeCurrentLimit("custom_lists", FREE, "en")).toBe(
      "On Free, you can create up to 1 custom list.",
    );
    expect(describeCurrentLimit("custom_lists", PREMIUM, "en")).toBe(
      "On Premium, you can create up to 25 custom lists.",
    );
  });
});

describe("pickPerks", () => {
  test("mevcut özelliği tekrar etmez, en fazla 3 satır", () => {
    const perks = pickPerks("custom_lists", FREE, PREMIUM, "tr");
    expect(perks.length).toBe(MAX_PERKS);
    expect(perks.find((p) => p.id === "custom_lists")).toBeUndefined();
  });

  test("her satırın değeri hedef planda mevcut plandakinden FARKLI (gerçek kazanç)", () => {
    for (const perk of pickPerks("games", FREE, PREMIUM, "en")) {
      expect(perk.value).toBe(formatFeatureValue(perk.id, PREMIUM, "en"));
      expect(perk.value).not.toBe(formatFeatureValue(perk.id, FREE, "en"));
    }
  });

  test("hedef plan yoksa boş", () => {
    expect(pickPerks("custom_lists", MAX, null, "tr")).toEqual([]);
  });

  test("satırlar simge ve renk taşır", () => {
    for (const perk of pickPerks("friends", FREE, PREMIUM, "tr")) {
      expect(perk.icon).toBeTruthy();
      expect(perk.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(perk.title).toBeTruthy();
    }
  });
});

describe("describeCurrentLimit", () => {
  test("sayılı özellikte plan adıyla tek cümle", () => {
    expect(describeCurrentLimit("friends", FREE, "tr")).toBe(
      "Free planında en fazla 2 arkadaş ekleyebilirsin.",
    );
    expect(describeCurrentLimit("friends", PREMIUM, "en")).toBe(
      "On Premium, you can add up to 150 friends.",
    );
  });

  test("ACCESS ve bilinmeyen özellikte boş", () => {
    expect(describeCurrentLimit("custom_themes", FREE, "tr")).toBe("");
    expect(describeCurrentLimit("yok", FREE, "tr")).toBe("");
  });
});

// ── Fiyat ────────────────────────────────────────────────────────────────────

const MICROS = 1_000_000;

/** Play biçiminde (defaultOption) bir paket; `offer` verilirse giriş teklifli. */
const playPackage = ({ id, period = "P1M", regular, offer, currency = "TRY", symbol = "₺" }) => ({
  identifier: `$rc_${id}`,
  packageType: period === "P1Y" ? "ANNUAL" : "MONTHLY",
  product: {
    identifier: id,
    subscriptionPeriod: period,
    price: offer ? offer.price : regular,
    priceString: `${symbol}${(offer ? offer.price : regular).toFixed(2).replace(".", ",")}`,
    currencyCode: currency,
    defaultOption: {
      isBasePlan: !offer,
      fullPricePhase: {
        price: {
          amountMicros: regular * MICROS,
          formatted: `${symbol}${regular.toFixed(2).replace(".", ",")}`,
          currencyCode: currency,
        },
      },
      ...(offer
        ? {
            introPhase: {
              price: {
                amountMicros: offer.price * MICROS,
                formatted: `${symbol}${offer.price.toFixed(2).replace(".", ",")}`,
                currencyCode: currency,
              },
              billingCycleCount: offer.cycles,
              billingPeriod: { unit: "MONTH", value: 1 },
            },
          }
        : {}),
    },
  },
});

describe("buildPriceHint", () => {
  const monthly = playPackage({ id: "premium_monthly", regular: 59.99 });
  const withOffer = playPackage({
    id: "premium_monthly",
    regular: 59.99,
    offer: { price: 29.995, cycles: 3 },
  });
  const yearly = playPackage({ id: "premium_yearly", period: "P1Y", regular: 449.99 });
  const maxMonthly = playPackage({ id: "max_monthly", regular: 149.99 });

  test("paket yoksa / henüz yüklenmediyse null (uydurma fiyat basılmaz)", () => {
    expect(buildPriceHint({ packages: [], tier: PREMIUM, language: "tr" })).toBeNull();
    expect(buildPriceHint({ packages: null, tier: PREMIUM, language: "tr" })).toBeNull();
    expect(buildPriceHint({ packages: [monthly], tier: null, language: "tr" })).toBeNull();
    expect(buildPriceHint()).toBeNull();
  });

  test("aylık paket tercih edilir, normal fiyat gösterilir", () => {
    expect(buildPriceHint({ packages: [yearly, monthly], tier: PREMIUM, language: "tr" })).toEqual({
      name: "Premium",
      price: "₺59,99",
      period: "/ ay",
      offer: null,
    });
  });

  test("giriş teklifi varsa süre ve yüzde (Türkçe)", () => {
    const hint = buildPriceHint({ packages: [withOffer], tier: PREMIUM, language: "tr" });
    expect(hint.price).toBe("₺59,99"); // teklif fiyatı değil, NORMAL fiyat
    expect(hint.offer).toBe("İlk 3 ay %50 indirim");
  });

  test("giriş teklifi İngilizce", () => {
    expect(buildPriceHint({ packages: [withOffer], tier: PREMIUM, language: "en" }).offer).toBe(
      "First 3 months 50% off",
    );
  });

  test("yalnız yıllık paket varsa yıllık dönem etiketi", () => {
    expect(buildPriceHint({ packages: [yearly], tier: PREMIUM, language: "en" })).toMatchObject({
      price: "₺449,99",
      period: "/ year",
    });
  });

  test("hedef plan yalnız kendi paketlerinden fiyat alır", () => {
    const hint = buildPriceHint({ packages: [monthly, maxMonthly], tier: MAX, language: "tr" });
    expect(hint.name).toBe("Premium Max");
    expect(hint.price).toBe("₺149,99");
  });

  test("fiyatı okunamayan paket null döner", () => {
    const broken = { identifier: "x", product: { identifier: "premium_monthly", subscriptionPeriod: "P1M" } };
    expect(buildPriceHint({ packages: [broken], tier: PREMIUM, language: "tr" })).toBeNull();
  });

  test("iOS giriş teklifi YALNIZ uygun kullanıcıya gösterilir", () => {
    const iosPackage = {
      identifier: "$rc_monthly",
      packageType: "MONTHLY",
      product: {
        identifier: "premium_monthly",
        subscriptionPeriod: "P1M",
        price: 59.99,
        priceString: "₺59,99",
        currencyCode: "TRY",
        introPrice: {
          price: 29.99,
          priceString: "₺29,99",
          cycles: 3,
          periodUnit: "MONTH",
          periodNumberOfUnits: 1,
        },
      },
    };
    const eligible = buildPriceHint({
      packages: [iosPackage],
      tier: PREMIUM,
      language: "tr",
      introEligibleIds: ["premium_monthly"],
    });
    const notEligible = buildPriceHint({ packages: [iosPackage], tier: PREMIUM, language: "tr" });
    expect(eligible.offer).toBe("İlk 3 ay %50 indirim");
    expect(notEligible.offer).toBeNull();
  });

  test("ücretsiz deneme etiketi", () => {
    const trial = playPackage({
      id: "premium_monthly",
      regular: 59.99,
      offer: { price: 0, cycles: 1 },
    });
    expect(buildPriceHint({ packages: [trial], tier: PREMIUM, language: "tr" }).offer).toBe(
      "İlk ay ücretsiz",
    );
    expect(buildPriceHint({ packages: [trial], tier: PREMIUM, language: "en" }).offer).toBe(
      "First month free",
    );
  });
});

describe("Wrapped arşivi (yıl penceresi): sayaç değil kilit", () => {
  test("Free: bu yıl dışı kilitli, ölçersiz, 'limit doldu' demez; hedef Premium", () => {
    const c = buildUpsellContent("wrapped_archive", FREE, "tr");
    expect(c.state).toBe("locked");
    expect(c.eyebrow).toBe("PREMİUM ÖZELLİK");
    expect(c.meter).toBeNull();
    expect(c.renew).toBeNull();
    expect(c.targetPlan).toBe(PREMIUM);
    expect(c.title).toBe("Geçmiş yıllar Premium'da");
    expect(c.message).toBe("Free planında yalnızca bu yılın Wrapped özetini görebilirsin.");
    expect(c.tiers.map((t) => t.value)).toEqual(["Yalnız bu yıl", "Son 5 yıl", "Tüm yıllar"]);
  });

  test("kapıdan gelen 'used' bir ölçer çizdirmez (yıl farkı harcama değil)", () => {
    expect(buildUpsellContent("wrapped_archive", FREE, "tr", { used: 4 }).meter).toBeNull();
  });

  test("Premium: 5 yıldan eski yıl Max'e yönlendirir, başlık Max'i söyler", () => {
    const c = buildUpsellContent("wrapped_archive", PREMIUM, "tr");
    expect(c.state).toBe("locked");
    expect(c.targetPlan).toBe(MAX);
    expect(c.title).toBe("Tüm yıllar Premium Max'te");
    expect(c.message).toBe("Premium planında son 5 yılın Wrapped özetlerini görebilirsin.");
    expect(c.cta.primary).toBe("Premium Max'e geç");
    expect(buildUpsellContent("wrapped_archive", PREMIUM, "en").title).toBe(
      "Every year is a Premium Max perk",
    );
  });

  test("Max: yükseltilecek bir şey yok, yalnız bilgi", () => {
    const c = buildUpsellContent("wrapped_archive", MAX, "tr");
    expect(c.canUpgrade).toBe(false);
    expect(c.tiers).toEqual([]);
    expect(c.cta.primary).toBe("Tamam");
  });
});

describe("özel afiş / arka plan önizlemesi", () => {
  const TMDB = "https://image.tmdb.org/t/p/w185";
  const posterPreview = { kind: "poster", fromUri: `${TMDB}/now.jpg`, toUri: `${TMDB}/pick.jpg` };

  test("galeriden gelen önizleme sayfaya taşınır; etiketler dile göre", () => {
    const c = buildUpsellContent("custom_posters", FREE, "tr", { preview: posterPreview });
    expect(c.preview).toEqual({
      kind: "poster",
      fromUri: `${TMDB}/now.jpg`,
      toUri: `${TMDB}/pick.jpg`,
      fromLabel: "Şimdi",
      toLabel: "Seçtiğin",
    });
    expect(c.title).toBe("Afişi sen seç");
    expect(buildUpsellContent("custom_posters", FREE, "en", { preview: posterPreview }).preview.toLabel).toBe(
      "Your pick",
    );
  });

  test("arka plan galerisinden gelince başlık arka planı söyler", () => {
    const c = buildUpsellContent("custom_posters", FREE, "tr", {
      preview: { ...posterPreview, kind: "backdrop" },
    });
    expect(c.preview.kind).toBe("backdrop");
    expect(c.title).toBe("Arka planı sen seç");
  });

  test("önizlemesiz açılış (ör. karşılaştırma) eski başlıkla, kartsız", () => {
    const c = buildUpsellContent("custom_posters", FREE, "tr");
    expect(c.preview).toBeNull();
    expect(c.title).toBe("Afişi sen seç");
    expect(c.perks.length).toBeGreaterThan(0);
  });

  test("önizleme varken kazanç satırları çizilmez (sayfa kaydırmasız sığsın)", () => {
    const c = buildUpsellContent("custom_posters", FREE, "tr", { preview: posterPreview });
    expect(c.perks).toEqual([]);
    expect(c.tiers).toHaveLength(3);
  });

  test("yalnız TMDB adresleri; seçilen görsel yoksa kart yok; aynı görsel 'Şimdi'de tekrarlanmaz", () => {
    expect(buildChoicePreview({ kind: "poster", toUri: "https://evil.example/x.jpg" }, "tr")).toBeNull();
    expect(buildChoicePreview({ kind: "poster", fromUri: `${TMDB}/a.jpg` }, "tr")).toBeNull();
    expect(buildChoicePreview({ kind: "logo", toUri: `${TMDB}/a.jpg` }, "tr")).toBeNull();
    expect(buildChoicePreview(null, "tr")).toBeNull();
    const same = buildChoicePreview({ kind: "poster", fromUri: `${TMDB}/a.jpg`, toUri: `${TMDB}/a.jpg` }, "tr");
    expect(same.fromUri).toBeNull();
    const foreign = buildChoicePreview({ kind: "poster", fromUri: "http://x/y.jpg", toUri: `${TMDB}/a.jpg` }, "tr");
    expect(foreign.fromUri).toBeNull();
  });

  test("başka özellikler önizlemeyi yok saymaz ama başlıkları değişmez", () => {
    const c = buildUpsellContent("ambient_background", FREE, "tr", { preview: posterPreview });
    expect(c.title).toBe("Ambiyans Premium'da");
  });
});
