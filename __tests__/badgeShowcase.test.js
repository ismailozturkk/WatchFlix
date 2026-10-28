// __tests__/badgeShowcase.test.js
//
// 4 rozetlik profil vitrini (utils/badgeShowcase.js) ve rozet ekranı arama/süzme
// mantığının (components/badges/badgeInsights.js) birim testleri.

const fs = require("fs");
const path = require("path");
const {
  MAX_SHOWCASE_BADGES,
  isValidShowcaseBadgeId,
  normalizeShowcaseBadges,
  readProfileShowcaseBadges,
  hasAnyShowcaseBadges,
  isBadgeInShowcase,
  toggleShowcaseBadge,
  removeShowcaseBadge,
  upgradeShowcaseIdsWithCards,
  resolveShowcaseBadgeCard,
  resolveShowcaseBadges,
  sortUnlockedWithShowcaseFirst,
} = require("../utils/badgeShowcase");
const {
  evaluateWatchBadges,
  gruplaAileler,
  badgeAd,
  badgeAciklama,
} = require("../components/badges/watchBadgeCatalog");
const { evaluateBadgeSets } = require("../components/badges/badgeSets");
const { muhurleriHesapla } = require("../components/badges/seasonSeals");
const {
  rozetMetniNormalize,
  rozetAramaEslesirMi,
  aramaSonucSayisi,
  izgaraSatirlari,
} = require("../components/badges/badgeInsights");
const { RARITY_ORDER } = require("../theme/badgeTokens");

function kurKartlar(stats = {}, kazanilmis = []) {
  const rozetler = evaluateWatchBadges({ turSayaci: new Map(), ...stats }, kazanilmis);
  const aileKartlari = gruplaAileler(rozetler);
  const setler = evaluateBadgeSets(rozetler, kazanilmis);
  const muhurler = muhurleriHesapla([], { kazanilmis });
  return [...aileKartlari, ...muhurler, ...setler];
}

describe("vitrin rozetleri (utils/badgeShowcase)", () => {
  test("geçerli katalog, koleksiyon ve dönem mührü id'lerini tanır; sahte id'leri reddeder", () => {
    expect(isValidShowcaseBadgeId("film_10")).toBe(true);
    expect(isValidShowcaseBadgeId("korku_25")).toBe(true);
    expect(isValidShowcaseBadgeId("set_uzman")).toBe(true);
    expect(isValidShowcaseBadgeId("muhur_2026_yaz")).toBe(true);

    expect(isValidShowcaseBadgeId("")).toBe(false);
    expect(isValidShowcaseBadgeId(null)).toBe(false);
    expect(isValidShowcaseBadgeId("olmayan_rozet_999")).toBe(false);
    expect(isValidShowcaseBadgeId("muhur_2026_bahar")).toBe(false);
    expect(isValidShowcaseBadgeId("prestij_film_1")).toBe(false);
  });

  test("normalizeShowcaseBadges: en fazla 4 rozet tutar, tekrarları ve geçersizleri eler", () => {
    const raw = [
      "film_10",
      "korku_25",
      "film_10",
      "gecersiz_id",
      "set_uzman",
      "muhur_2026_yaz",
      "komedi_75",
    ];
    expect(normalizeShowcaseBadges(raw)).toEqual([
      "film_10",
      "korku_25",
      "set_uzman",
      "muhur_2026_yaz",
    ]);
    expect(normalizeShowcaseBadges(raw)).toHaveLength(MAX_SHOWCASE_BADGES);
    expect(normalizeShowcaseBadges(null)).toEqual([]);
  });

  test("normalizeShowcaseBadges: aynı aileden iki kademe verilirse ilk yuvada yüksek kademeyi tutar", () => {
    const raw = ["film_10", "korku_25", "film_150"];
    expect(normalizeShowcaseBadges(raw)).toEqual(["film_150", "korku_25"]);
  });

  test("toggleShowcaseBadge: açık rozeti ekler, tekrar dokununca çıkarır, 4 doluyken 'full' döner, kilitliyi reddeder", () => {
    let current = [];

    // Kilitli rozet eklenemez
    const lockedRes = toggleShowcaseBadge(current, { id: "korku_25", acik: false });
    expect(lockedRes.action).toBe("locked");
    expect(lockedRes.next).toEqual([]);

    // 4 açık rozet sırayla eklenir
    for (const id of ["film_50", "korku_25", "set_uzman", "muhur_2026_yaz"]) {
      const r = toggleShowcaseBadge(current, { id, acik: true });
      expect(r.action).toBe("added");
      current = r.next;
    }
    expect(current).toEqual(["film_50", "korku_25", "set_uzman", "muhur_2026_yaz"]);

    // 5. rozet eklenmek istendiğinde 'full' döner ve liste değişmez
    const fullRes = toggleShowcaseBadge(current, { id: "komedi_75", acik: true });
    expect(fullRes.action).toBe("full");
    expect(fullRes.next).toEqual(current);

    // Aynı ailenin başka bir kademesiyle (film_150) toggle çağrılırsa aileyi vitrinden çıkarır
    const removeFamilyRes = toggleShowcaseBadge(current, { id: "film_150", family: "film", acik: true });
    expect(removeFamilyRes.action).toBe("removed");
    expect(removeFamilyRes.next).toEqual(["korku_25", "set_uzman", "muhur_2026_yaz"]);
  });

  test("isBadgeInShowcase ve removeShowcaseBadge aile düzeyinde de eşleşir", () => {
    const showcase = ["film_50", "korku_25"];
    expect(isBadgeInShowcase(showcase, "film_50")).toBe(true);
    expect(isBadgeInShowcase(showcase, { id: "film_150", family: "film" })).toBe(true);
    expect(isBadgeInShowcase(showcase, { id: "komedi_75" })).toBe(false);

    expect(removeShowcaseBadge(showcase, { id: "film_150", family: "film" })).toEqual(["korku_25"]);
  });

  test("upgradeShowcaseIdsWithCards: üst kademeye geçen aile rozetini yükseltir ve kilitlileri düşürür", () => {
    // 200 film → film_150 açık; korku_25 ise kilitli
    const kartlar = kurKartlar({ filmSayisi: 200 }, ["muhur_2026_yaz"]);
    const upgraded = upgradeShowcaseIdsWithCards(["film_10", "korku_25", "muhur_2026_yaz"], kartlar);
    expect(upgraded).toEqual(["film_150", "muhur_2026_yaz"]);
  });

  test("resolveShowcaseBadges: arkadaş profilinde yerel defter olmadan katalog, set ve mührü 5 dilde çözer", () => {
    const resolved = resolveShowcaseBadges(["film_150", "set_uzman", "muhur_2026_yaz"]);
    expect(resolved).toHaveLength(3);

    const [film, set, muhur] = resolved;
    expect(film.id).toBe("film_150");
    expect(film.acik).toBe(true);
    expect(film.tier).toBe(3);
    expect(film.aileToplam).toBe(5);
    expect(badgeAd(film, "tr")).toBeTruthy();
    expect(badgeAd(film, "en")).toBeTruthy();
    expect(badgeAciklama(film, "de")).toBeTruthy();

    expect(set.id).toBe("set_uzman");
    expect(set.section).toBe("set");
    expect(badgeAd(set, "tr")).toBe("Tür Uzmanı");
    expect(badgeAd(set, "en")).toBe("Genre Specialist");

    expect(muhur.id).toBe("muhur_2026_yaz");
    expect(muhur.section).toBe("muhur");
    expect(badgeAd(muhur, "tr")).toBe("2026 Yazı");
    expect(badgeAd(muhur, "en")).toBe("Summer 2026");
  });

  test("sortUnlockedWithShowcaseFirst: vitrin rozetlerini seçilen sırayla en başa alır", () => {
    const kartlar = kurKartlar({ filmSayisi: 60, bolumSayisi: 30 }, ["korku_25", "komedi_75"]);
    const aciklar = kartlar.filter((k) => k.acik);
    const sirali = sortUnlockedWithShowcaseFirst(aciklar, ["film_50", "korku_25"], RARITY_ORDER);
    expect(sirali.slice(0, 2).map((k) => k.id)).toEqual(["film_50", "korku_25"]);
    expect(sirali[0].vitrinde).toBe(true);
    expect(sirali[1].vitrinde).toBe(true);
  });

  test("readProfileShowcaseBadges ve hasAnyShowcaseBadges profil nesnesini güvenle okur", () => {
    expect(readProfileShowcaseBadges(null)).toEqual([]);
    expect(hasAnyShowcaseBadges([])).toBe(false);
    expect(readProfileShowcaseBadges({ showcaseBadges: ["film_10", "bozuk"] })).toEqual(["film_10"]);
    expect(hasAnyShowcaseBadges(["film_10"])).toBe(true);
  });
});

describe("rozet ekranı arama çubuğu ve süzme (badgeInsights)", () => {
  const kartlar = kurKartlar({ filmSayisi: 60, bolumSayisi: 30 }, ["korku_25"]);

  test("rozetMetniNormalize Türkçe harfleri ve aksanları katlar", () => {
    expect(rozetMetniNormalize("Sürekli Müşteri")).toBe("surekli musteri");
    expect(rozetMetniNormalize("İLK BİLET")).toBe("ilk bilet");
    expect(rozetMetniNormalize("Película & Otoño")).toBe("pelicula & otono");
  });

  test("rozetAramaEslesirMi: kart adını, alt kademe adını, açıklamasını ve bölüm başlığını bulur", () => {
    const filmKarti = kartlar.find((k) => k.family === "film");
    expect(filmKarti.id).toBe("film_50");
    // Güncel kademe adı ("Sürekli Müşteri")
    expect(rozetAramaEslesirMi(filmKarti, "sürekli müşteri", "tr")).toBe(true);
    // Geçilmiş 1. kademe adı ("İlk Bilet") ile arandığında da aynı aile kartı bulunur
    expect(rozetAramaEslesirMi(filmKarti, "ilk bilet", "tr")).toBe(true);
    // Sıradaki 3. kademe adı ("Salon Sakini") ile arandığında da bulunur
    expect(rozetAramaEslesirMi(filmKarti, "salon sakini", "tr")).toBe(true);
    // İngilizce arayüzde İngilizce adla bulunur
    expect(rozetAramaEslesirMi(filmKarti, "First Ticket", "en")).toBe(true);
  });

  test("GİZLİ KİLİTLİ rozetler aramada ASLA sızmaz (ad veya açıklama eşleşse bile false döner)", () => {
    const gizliKilitli = kartlar.find((k) => k.hidden && !k.acik);
    expect(gizliKilitli).toBeTruthy();
    // Gizli rozetin gerçek Türkçe/İngilizce adını doğrudan aratsak bile eşleşmemeli
    expect(rozetAramaEslesirMi(gizliKilitli, gizliKilitli.tr, "tr")).toBe(false);
    expect(rozetAramaEslesirMi(gizliKilitli, gizliKilitli.en, "en")).toBe(false);
    expect(rozetAramaEslesirMi(gizliKilitli, gizliKilitli.descTr, "tr")).toBe(false);
  });

  test("izgaraSatirlari ve aramaSonucSayisi arama sorgusuyla doğru süzülür", () => {
    const satirlar = izgaraSatirlari(kartlar, "tumu", null, 3, { arama: "korku", lang: "tr" });
    const bulunanRozetler = satirlar
      .filter((s) => s.tur === "rozetSatiri")
      .flatMap((s) => s.rozetler);
    expect(bulunanRozetler.length).toBeGreaterThan(0);
    expect(bulunanRozetler.some((b) => b.id === "korku_25")).toBe(true);
    expect(aramaSonucSayisi(kartlar, "tumu", null, "korku", "tr")).toBe(bulunanRozetler.length);

    const bos = izgaraSatirlari(kartlar, "tumu", null, 3, { arama: " hic_olmayan_rozet_xyz ", lang: "tr" });
    expect(bos).toEqual([]);
    expect(aramaSonucSayisi(kartlar, "tumu", null, " hic_olmayan_rozet_xyz ", "tr")).toBe(0);
  });
});

describe("firestore.rules showcaseBadges doğrulaması", () => {
  test("Users/{uid} kurallarında showcaseBadgesOk tanımlı ve create/update'e bağlı", () => {
    const rules = fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8");
    expect(rules).toContain("function showcaseBadgesOk()");
    expect(rules).toContain("request.resource.data.get('showcaseBadges', null)");
    expect(rules).toContain("b.size() <= 4");
    expect(rules).toMatch(/allow create:[\s\S]*?showcaseBadgesOk\(\)/);
    expect(rules).toMatch(/allow update:[\s\S]*?showcaseBadgesOk\(\)/);
  });
});
