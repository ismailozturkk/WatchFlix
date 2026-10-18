// __tests__/kesifBadges.test.js
//
// KEŞİF rozetleri (katalog v3): izleme dışı özellikleri ilk kullanınca açılan 13 küçük
// rozet. Üç şeyi kilitler:
//   1. Sinyal modülü (utils/kesifSignals.js) — saf, kaynak hazır olmayınca sayı üretmez.
//   2. Katalog sözleşmesi — bölüm, sürüm, nadirlik, Free ulaşılabilirliği, izleme
//      verisinden BAĞIMSIZLIK.
//   3. YÜKLENME YARIŞI — defter koruması (watchLedgerCore.known) kaynak yüklenmeden
//      Keşif id'sini "bilinen" yazarsa kaynak gelince eski kullanıcıya kutlama yağar.
//      Hook (useWatchProgress) RN/Firebase import ettiği için jest'te çalışmaz; onun
//      kullandığı saf parçalar (bilinenRozetIdleri, bilinenSetIdleri, kesifHazirImzasi,
//      birlestir) burada gerçek senaryolarla birlikte sınanır.

const {
  KESIF_KAYNAK, KESIF_KAYNAKLARI, KESIF_TAVAN,
  bosKesif, kesifSinyalleriHesapla, kesifAyni, kesifHazirImzasi,
} = require("../utils/kesifSignals");
const {
  WATCH_BADGES, WATCH_BADGE_BY_ID, WATCH_BADGE_IDS, BOLUM, BOLUM_SIRA,
  evaluateWatchBadges, bilinenRozetIdleri,
} = require("../components/badges/watchBadgeCatalog");
const {
  BADGE_SETS, BADGE_SET_IDS, evaluateBadgeSets, bilinenSetIdleri,
} = require("../components/badges/badgeSets");
const { birlestir, normalizeLedger } = require("../utils/watchLedgerCore");

const KESIF = WATCH_BADGES.filter((b) => b.section === BOLUM.KESIF);
const KESIF_IDLERI = KESIF.map((b) => b.id);
const bosStats = { turSayaci: new Map() };

// Hepsi hazır, hiçbir şey yapılmamış kullanıcı.
const TUM_HAZIR = Object.fromEntries(KESIF_KAYNAKLARI.map((k) => [k, true]));
const HICBIRI_HAZIR_DEGIL = Object.fromEntries(KESIF_KAYNAKLARI.map((k) => [k, false]));

// ── 1. SİNYAL MODÜLÜ ────────────────────────────────────────────────────────

describe("kesifSinyalleriHesapla", () => {
  test("hazır olmayan kaynak sayı üretmez ve hazir=false bildirir", () => {
    const { sayilar, hazir } = kesifSinyalleriHesapla({
      notlar: { hazir: false, items: [{ id: 1 }] },
      arkadaslar: { hazir: false, adet: 3 },
    });
    expect(sayilar).toEqual({});
    expect(hazir.notlar).toBe(false);
    expect(hazir.arkadaslar).toBe(false);
    // Hiç verilmeyen kaynak da hazır DEĞİL (bağlam yoksa "hazır, 0" demek yanlış olurdu).
    expect(KESIF_KAYNAKLARI.every((k) => hazir[k] === false)).toBe(true);
  });

  test("bosKesif: hiçbir kaynak hazır değil", () => {
    expect(Object.keys(bosKesif().hazir).sort()).toEqual([...KESIF_KAYNAKLARI].sort());
    expect(Object.values(bosKesif().hazir).every((v) => v === false)).toBe(true);
    expect(bosKesif().sayilar).toEqual({});
  });

  test("not ve yapılacaklar ayrılır; `type` alanı olmayan eski kayıt not sayılır", () => {
    const { sayilar } = kesifSinyalleriHesapla({
      notlar: {
        hazir: true,
        items: [{ id: "a", type: "note" }, { id: "b" }, { id: "c", type: "todo" }, null],
      },
    });
    expect(sayilar.not).toBe(2);
    expect(sayilar.yapilacak).toBe(1);
  });

  test("hatırlatıcı = film + bölüm", () => {
    const { sayilar } = kesifSinyalleriHesapla({
      hatirlaticilar: { hazir: true, filmler: [{}], bolumler: [{}, {}] },
    });
    expect(sayilar.hatirlatici).toBe(3);
    expect(kesifSinyalleriHesapla({ hatirlaticilar: { hazir: true } }).sayilar.hatirlatici).toBe(0);
  });

  test("sayılar KESIF_TAVAN'a kırpılır (6. not rozet listesini boşuna yeniden kurmasın)", () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ id: i }));
    const { sayilar } = kesifSinyalleriHesapla({
      notlar: { hazir: true, items },
      listeler: { hazir: true, ozelListe: 99, favori: -3, izlemeListesi: "7" },
    });
    expect(sayilar.not).toBe(KESIF_TAVAN);
    expect(sayilar.ozelListe).toBe(KESIF_TAVAN);
    expect(sayilar.favori).toBe(0);              // negatif/bozuk → 0
    expect(sayilar.izlemeListesi).toBe(KESIF_TAVAN);
  });

  test("biyografi: boşluk-only yazı sayılmaz, gerçek yazı 1", () => {
    const bio = (v) => kesifSinyalleriHesapla({ profil: { hazir: true, bio: v } }).sayilar.biyografi;
    expect(bio("")).toBe(0);
    expect(bio("   \n ")).toBe(0);
    expect(bio(undefined)).toBe(0);
    expect(bio(42)).toBe(0);
    expect(bio("Sinema delisi")).toBe(1);
  });

  test("girdiyi DEĞİŞTİRMEZ ve bozuk girdide atmaz", () => {
    const girdi = Object.freeze({
      notlar: Object.freeze({ hazir: true, items: Object.freeze([{ id: 1 }]) }),
    });
    expect(() => kesifSinyalleriHesapla(girdi)).not.toThrow();
    expect(() => kesifSinyalleriHesapla(null)).not.toThrow();
    expect(() => kesifSinyalleriHesapla(undefined)).not.toThrow();
    expect(() => kesifSinyalleriHesapla({ notlar: "bozuk", arkadaslar: 5 })).not.toThrow();
  });
});

describe("kesifAyni / kesifHazirImzasi", () => {
  const a = () => kesifSinyalleriHesapla({ notlar: { hazir: true, items: [{ id: 1 }] } });

  test("içerik aynıysa farklı referans da aynıdır (eski referans korunur)", () => {
    expect(kesifAyni(a(), a())).toBe(true);
    const x = a();
    expect(kesifAyni(x, x)).toBe(true);
  });

  test("sayı ya da hazırlık değişince farklıdır", () => {
    const iki = kesifSinyalleriHesapla({ notlar: { hazir: true, items: [{}, {}] } });
    expect(kesifAyni(a(), iki)).toBe(false);
    const hazirDegil = kesifSinyalleriHesapla({ notlar: { hazir: false, items: [{ id: 1 }] } });
    expect(kesifAyni(a(), hazirDegil)).toBe(false);
    expect(kesifAyni(null, a())).toBe(false);
  });

  test("hazırlık imzası kaynak hazır oldukça değişir (mutabakat bunu görmek zorunda)", () => {
    expect(kesifHazirImzasi(HICBIRI_HAZIR_DEGIL)).toBe("0".repeat(KESIF_KAYNAKLARI.length));
    expect(kesifHazirImzasi(TUM_HAZIR)).toBe("1".repeat(KESIF_KAYNAKLARI.length));
    expect(kesifHazirImzasi({ ...HICBIRI_HAZIR_DEGIL, arkadaslar: true }))
      .not.toBe(kesifHazirImzasi(HICBIRI_HAZIR_DEGIL));
    expect(kesifHazirImzasi(undefined)).toBe("0".repeat(KESIF_KAYNAKLARI.length));
    // yalnızca TAM true hazır sayılır
    expect(kesifHazirImzasi({ notlar: "evet", profil: 1 })).toBe("0".repeat(KESIF_KAYNAKLARI.length));
  });
});

// ── 2. KATALOG SÖZLEŞMESİ ───────────────────────────────────────────────────

describe("Keşif bölümü (katalog v3)", () => {
  test("13 rozet, hepsi v3, tekil (aile yok), gizli değil", () => {
    expect(KESIF).toHaveLength(13);
    for (const b of KESIF) {
      expect([b.id, b.since]).toEqual([b.id, 3]);
      expect([b.id, b.family]).toEqual([b.id, null]);
      expect([b.id, b.hidden]).toEqual([b.id, false]);
      expect(b.id.startsWith("kesif_")).toBe(true);
    }
    // since:3 yalnızca Keşif'te (duyuru kartı/YENİ etiketi sürümden sayıyor)
    expect(WATCH_BADGES.filter((b) => b.since === 3).map((b) => b.id).sort()).toEqual([...KESIF_IDLERI].sort());
  });

  test("NADİRLİK: hepsi common/uncommon (10 + 3), epic/rare/legendary yok", () => {
    const say = KESIF.reduce((acc, b) => { acc[b.rarity] = (acc[b.rarity] || 0) + 1; return acc; }, {});
    expect(say).toEqual({ common: 10, uncommon: 3 });
    // Başkasının/topluluğun varlığını isteyen üçü uncommon.
    expect(["kesif_ortak_liste", "kesif_arkadas", "kesif_paylasim"].map((id) => WATCH_BADGE_BY_ID[id].rarity))
      .toEqual(["uncommon", "uncommon", "uncommon"]);
  });

  test("legendary kotası ve toplam dağılım Keşif'ten ETKİLENMEDİ", () => {
    const efsane = WATCH_BADGES.filter((b) => b.rarity === "legendary").map((b) => b.id).sort();
    expect(efsane).toEqual(["bolum_10000", "film_2000", "perde_20"]);
  });

  test("FREE ULAŞILABİLİRLİK: hedef 1 (dört favori hariç 4) — Free sınırının altında", () => {
    // Free: özel liste 1, arkadaş 2, not 5, yapılacak 5 (utils/premiumFeatures.js).
    // "5 not yaz" gibi bir hedef Free kullanıcıyı "limitin doldu" duvarına çarptırırdı.
    for (const b of KESIF) {
      expect([b.id, b.target]).toEqual([b.id, b.id === "kesif_dort_favori" ? 4 : 1]);
    }
  });

  test("her Keşif rozeti geçerli bir KAYNAK taşır; izleme rozetlerinde kaynak yok", () => {
    for (const b of KESIF) expect([b.id, KESIF_KAYNAKLARI.includes(b.kaynak)]).toEqual([b.id, true]);
    for (const b of WATCH_BADGES.filter((x) => x.section !== BOLUM.KESIF)) {
      expect([b.id, b.kaynak]).toEqual([b.id, null]);
    }
    // Her kaynağın en az bir rozeti var (ölü kaynak = boşuna dinleyici/okuma).
    for (const k of KESIF_KAYNAKLARI) {
      expect([k, KESIF.some((b) => b.kaynak === k)]).toEqual([k, true]);
    }
  });

  test("ekranda BAŞLANGIÇ'ın hemen arkasında; katalog dizisinde en SONDA", () => {
    expect(BOLUM_SIRA.indexOf(BOLUM.KESIF)).toBe(BOLUM_SIRA.indexOf(BOLUM.BASLANGIC) + 1);
    // "Sıradaki hedefler" rafı eşit oranlarda dizi sırasına bakar: izleme rozetleri öne geçsin.
    const ilk = WATCH_BADGES.findIndex((b) => b.section === BOLUM.KESIF);
    expect(WATCH_BADGES.slice(ilk).every((b) => b.section === BOLUM.KESIF)).toBe(true);
  });

  test("hepsi İZLEME VERİSİNDEN BAĞIMSIZ: ağır izleyici hiçbirini açmaz", () => {
    const agir = {
      ...bosStats, filmSayisi: 2000, bolumSayisi: 10000, diziSayisi: 200, gunSayisi: 900,
      uzunMetraj: 100, perde: 20, tekrarFilm: 40, hesapYili: 10,
    };
    const acik = evaluateWatchBadges(agir, []).filter((b) => b.section === BOLUM.KESIF && b.acik);
    expect(acik).toEqual([]);
  });

  test("sinyal yokken (eski çağrı biçimi) atmaz, hepsi kilitli", () => {
    const r = evaluateWatchBadges({ ...bosStats }, []).filter((b) => b.section === BOLUM.KESIF);
    expect(r).toHaveLength(13);
    expect(r.every((b) => !b.acik && b.ilerleme === 0)).toBe(true);
  });

  test("her rozet kendi sinyalini okur ve yalnız onu", () => {
    const BEKLENEN = {
      kesif_ilk_not: { not: 1 },
      kesif_yapilacaklar: { yapilacak: 1 },
      kesif_medya_notu: { medyaNotu: 1 },
      kesif_ozel_liste: { ozelListe: 1 },
      kesif_favori: { favori: 1 },
      kesif_izleme_listesi: { izlemeListesi: 1 },
      kesif_hatirlatici: { hatirlatici: 1 },
      kesif_ortak_liste: { ortakListe: 1 },
      kesif_arkadas: { arkadas: 1 },
      kesif_paylasim: { gonderi: 1 },
      kesif_dort_favori: { dortFavori: 4 },
      kesif_biyografi: { biyografi: 1 },
      kesif_cinematch: { cineMatch: 1 },
    };
    expect(Object.keys(BEKLENEN).sort()).toEqual([...KESIF_IDLERI].sort());
    for (const [id, kesif] of Object.entries(BEKLENEN)) {
      const acik = evaluateWatchBadges({ ...bosStats, kesif }, [])
        .filter((b) => b.section === BOLUM.KESIF && b.acik).map((b) => b.id);
      expect([id, acik]).toEqual([id, [id]]);
    }
  });

  test("dört favori kısmi ilerleme gösterir (2/4) ve 4'te açılır", () => {
    const r = (n) => evaluateWatchBadges({ ...bosStats, kesif: { dortFavori: n } }, [])
      .find((b) => b.id === "kesif_dort_favori");
    expect([r(2).acik, r(2).ilerleme, r(2).oran]).toEqual([false, 2, 0.5]);
    expect(r(3).acik).toBe(false);
    expect(r(4).acik).toBe(true);
  });

  test("kaynak hazır değilken defterde kazanılmış rozet YİNE açık kalır (rozet düşmez)", () => {
    const r = evaluateWatchBadges({ ...bosStats, kesif: {}, kesifHazir: HICBIRI_HAZIR_DEGIL }, ["kesif_arkadas"]);
    expect(r.find((b) => b.id === "kesif_arkadas").acik).toBe(true);
    expect(r.filter((b) => b.section === BOLUM.KESIF && b.acik)).toHaveLength(1);
  });
});

describe("set_kesif (Kâşif koleksiyonu)", () => {
  const set = BADGE_SETS.find((s) => s.id === "set_kesif");

  test("üyeleri tam olarak Keşif bölümü; uncommon; legendary değil", () => {
    expect(set).toBeDefined();
    expect(set.uyeler().sort()).toEqual([...KESIF_IDLERI].sort());
    expect(set.rarity).toBe("uncommon");
    expect(BADGE_SET_IDS).toContain("set_kesif");
  });

  test("13/13 olunca açılır, 12'de açılmaz", () => {
    const stats = (kesif) => ({ ...bosStats, kesif });
    const tam = {
      not: 1, yapilacak: 1, medyaNotu: 1, ozelListe: 1, favori: 1, izlemeListesi: 1,
      hatirlatici: 1, ortakListe: 1, arkadas: 1, gonderi: 1, dortFavori: 4, biyografi: 1, cineMatch: 1,
    };
    const ac = (kesif) => {
      const rozetler = evaluateWatchBadges(stats(kesif), []);
      return evaluateBadgeSets(rozetler, []).find((s) => s.id === "set_kesif");
    };
    expect(ac(tam).acik).toBe(true);
    expect([ac(tam).ilerleme, ac(tam).target]).toEqual([13, 13]);
    const eksik = ac({ ...tam, cineMatch: 0 });
    expect([eksik.acik, eksik.ilerleme]).toEqual([false, 12]);
  });
});

// ── 3. YÜKLENME YARIŞI ──────────────────────────────────────────────────────

describe("bilinenRozetIdleri / bilinenSetIdleri (defterin `known` listesi)", () => {
  test("hiçbir kaynak hazır değilken: katalog eksi 13 Keşif", () => {
    const ids = bilinenRozetIdleri(HICBIRI_HAZIR_DEGIL);
    expect(ids).toHaveLength(WATCH_BADGE_IDS.length - 13);
    expect(ids.some((id) => id.startsWith("kesif_"))).toBe(false);
    expect(bilinenRozetIdleri(undefined)).toHaveLength(WATCH_BADGE_IDS.length - 13);
    expect(bilinenRozetIdleri(null)).toHaveLength(WATCH_BADGE_IDS.length - 13);
  });

  test("hepsi hazırken katalogun TAMAMI (v2 davranışıyla aynı)", () => {
    expect([...bilinenRozetIdleri(TUM_HAZIR)].sort()).toEqual([...WATCH_BADGE_IDS].sort());
  });

  test("kaynak kaynak açılır: notlar hazır → ilk_not + yapilacaklar", () => {
    const ids = bilinenRozetIdleri({ ...HICBIRI_HAZIR_DEGIL, [KESIF_KAYNAK.NOTLAR]: true });
    expect(ids.filter((id) => id.startsWith("kesif_")).sort()).toEqual(["kesif_ilk_not", "kesif_yapilacaklar"]);
    const profil = bilinenRozetIdleri({ ...HICBIRI_HAZIR_DEGIL, [KESIF_KAYNAK.PROFIL]: true });
    expect(profil.filter((id) => id.startsWith("kesif_")).sort())
      .toEqual(["kesif_biyografi", "kesif_dort_favori", "kesif_paylasim"]);
  });

  test("yalnız TAM true hazır sayılır (truthy değil)", () => {
    const ids = bilinenRozetIdleri({ notlar: "evet", arkadaslar: 1 });
    expect(ids.some((id) => id.startsWith("kesif_"))).toBe(false);
  });

  test("koleksiyon: üyelerinden biri hazır değilse `set_kesif` bilinmez; eşikli setler hep bilinir", () => {
    const eksik = bilinenSetIdleri({ ...TUM_HAZIR, arkadaslar: false }, []);
    expect(eksik).not.toContain("set_kesif");
    // Eşikli ("herhangi N rozet") ve Keşif üyesi içermeyen setler etkilenmez.
    for (const s of BADGE_SETS.filter((x) => x.id !== "set_kesif")) expect(eksik).toContain(s.id);
    expect(bilinenSetIdleri(TUM_HAZIR, [])).toContain("set_kesif");
    expect(bilinenSetIdleri(TUM_HAZIR, [])).toHaveLength(BADGE_SET_IDS.length);
  });

  test("üyesi DEFTERDE kazanılmışsa kaynağın hazır olması aranmaz (gerçek tamamlama yutulmasın)", () => {
    const hepsiBirKaynakHaric = KESIF_IDLERI.filter((id) => WATCH_BADGE_BY_ID[id].kaynak === "arkadaslar");
    expect(hepsiBirKaynakHaric).toEqual(["kesif_arkadas"]);
    const kazanilmis = new Set(["kesif_arkadas"]);
    expect(bilinenSetIdleri({ ...TUM_HAZIR, arkadaslar: false }, kazanilmis)).toContain("set_kesif");
    expect(bilinenSetIdleri({ ...TUM_HAZIR, arkadaslar: false }, [...kazanilmis])).toContain("set_kesif");
  });
});

describe("YÜKLENME YARIŞI: kaynak geç yüklenince eski kullanıcıya kutlama yağmaz", () => {
  // v2 katalogu = since 1 + since 2 rozetler; v2 setleri = set_kesif dışındakiler.
  const V2_IDLER = WATCH_BADGES.filter((b) => b.since <= 2).map((b) => b.id);
  const V2_SETLER = BADGE_SET_IDS.filter((id) => id !== "set_kesif");

  // 3 yıldır her özelliği kullanan kullanıcı.
  const VETERAN = {
    filmSayisi: 600, bolumSayisi: 4000, diziSayisi: 80, gunSayisi: 400, uzunMetraj: 60, perde: 15,
  };
  const VETERAN_KESIF = {
    not: 4, yapilacak: 2, medyaNotu: 4, ozelListe: 1, favori: 4, izlemeListesi: 4,
    hatirlatici: 3, ortakListe: 1, arkadas: 2, gonderi: 4, dortFavori: 4, biyografi: 1, cineMatch: 4,
  };

  // Rozet SAYISI merdiveni (set_sayi_N) türetilmiş bir koleksiyondur: sessizce emilen Keşif
  // rozetleri sayıya GİRER, eşik gerçekten geçilirse o koleksiyon bir kez kutlanır. Bu
  // beklenen ve dürüst bir davranış (sahip olunan rozet sayısı gerçekten arttı); testler
  // "Keşif'in KENDİSİ kutlanmaz"ı bu ayrımla kilitler.
  const kutlanan = (sonuc) => sonuc.yeniRozetler.filter((id) => !id.startsWith("set_sayi_"));

  /** Hook'un yaptığını taklit eder: stats → rozetler/setler → açık id'ler + tumIds → birleştir. */
  function mutabakat(defter, stats, kesifHazir, { bugun = "2026-10-17" } = {}) {
    const kazanilmis = defter.earned.badgeIds;
    const rozetler = evaluateWatchBadges({ ...bosStats, ...stats }, kazanilmis);
    const setler = evaluateBadgeSets(rozetler, kazanilmis);
    const acikIds = [...rozetler.filter((b) => b.acik).map((b) => b.id), ...setler.filter((s) => s.acik).map((s) => s.id)];
    const tumIds = [...bilinenRozetIdleri(kesifHazir), ...bilinenSetIdleri(kesifHazir, kazanilmis)];
    return birlestir(defter, { badgeIds: acikIds, tumIds, perde: 15, bugun });
  }

  /**
   * Gerçekçi bir defter: kazanılmış rozetler + onların AÇTIĞI koleksiyonlar hem `earned`
   * hem `seen` (kutlaması gösterilmiş). Koleksiyonlar unutulursa (ör. set_sayi_10) test,
   * üretimde olmayan bir "yeni kazanım" görür.
   */
  function defterKur(kazanilmisRozetler, known) {
    const rozetler = evaluateWatchBadges({ ...bosStats }, kazanilmisRozetler);
    const setler = evaluateBadgeSets(rozetler, kazanilmisRozetler).filter((x) => x.acik).map((x) => x.id);
    const earned = [...kazanilmisRozetler, ...setler];
    return normalizeLedger({
      baseline: { kare: 1, perde: 15, badgeIds: earned, seenAt: "x" },
      earned: { badgeIds: earned, perdeFloor: 15, makaraFloor: 0 },
      seen: earned,
      known,
    });
  }

  function veteranV2Defteri() {
    const v2Acik = evaluateWatchBadges({ ...bosStats, ...VETERAN }, [])
      .filter((b) => b.acik && b.since <= 2).map((b) => b.id);
    // v2'nin KENDİ koleksiyon sayımı (Keşif rozeti yok): sayaç koleksiyonları dahil.
    const v2Setler = evaluateBadgeSets(evaluateWatchBadges({ ...bosStats, ...VETERAN }, v2Acik), v2Acik)
      .filter((x) => x.acik && x.id !== "set_kesif").map((x) => x.id);
    const earned = [...v2Acik, ...v2Setler];
    return normalizeLedger({
      baseline: { kare: 1, perde: 15, badgeIds: earned, seenAt: "x" },
      earned: { badgeIds: earned, perdeFloor: 15, makaraFloor: 0 },
      seen: earned,
      known: [...V2_IDLER, ...V2_SETLER],
    });
  }

  test("DOĞRU davranış: hazır olmayan kaynağın id'si deftere yazılmaz → geç gelen veri SESSİZ emilir", () => {
    let defter = veteranV2Defteri();

    // Açılış: kaynakların HİÇBİRİ henüz yüklenmedi. Keşif sinyali yok.
    const s1 = mutabakat(defter, VETERAN, HICBIRI_HAZIR_DEGIL);
    defter = s1.ledger;
    expect(s1.yeniRozetler).toEqual([]);                                      // henüz hiçbir şey eklenmedi
    for (const id of KESIF_IDLERI) expect(defter.known).not.toContain(id);
    expect(defter.known).not.toContain("set_kesif");

    // Not motoru yüklendi: yıllık notlar var.
    const s2 = mutabakat(
      defter,
      { ...VETERAN, kesif: { not: VETERAN_KESIF.not, yapilacak: VETERAN_KESIF.yapilacak } },
      { ...HICBIRI_HAZIR_DEGIL, notlar: true },
    );
    defter = s2.ledger;
    expect(kutlanan(s2)).toEqual([]);                                         // KUTLAMA YOK
    expect(defter.earned.badgeIds).toEqual(expect.arrayContaining(["kesif_ilk_not", "kesif_yapilacaklar"]));
    expect(defter.seen).toEqual(expect.arrayContaining(["kesif_ilk_not", "kesif_yapilacaklar"]));
    expect(defter.earnedAt.kesif_ilk_not).toBeUndefined();                    // tarih uydurulmaz

    // Geri kalan kaynaklar da yüklendi.
    const s3 = mutabakat(defter, { ...VETERAN, kesif: VETERAN_KESIF }, TUM_HAZIR);
    defter = s3.ledger;
    expect(kutlanan(s3)).toEqual([]);                                         // hâlâ kutlama yok
    for (const id of [...KESIF_IDLERI, "set_kesif"]) {
      expect(defter.earned.badgeIds).toContain(id);
      expect(defter.seen).toContain(id);
    }
    expect(defter.known).toEqual(expect.arrayContaining([...KESIF_IDLERI, "set_kesif"]));
  });

  test("emilen Keşif rozetleri SAYAÇ koleksiyonunun eşiğini geçirirse yalnız o koleksiyon kutlanır", () => {
    // Veteran v2'de 50'nin altındaydı; 13 emilen rozet onu 50'nin üstüne taşır.
    const defter = veteranV2Defteri();
    const onceki = defter.earned.badgeIds.filter((id) => WATCH_BADGE_BY_ID[id]).length;
    expect(onceki).toBeLessThan(50);
    expect(onceki + 13).toBeGreaterThanOrEqual(50);
    const sonuc = mutabakat(defter, { ...VETERAN, kesif: VETERAN_KESIF }, TUM_HAZIR);
    expect(sonuc.yeniRozetler).toEqual(["set_sayi_50"]);
    expect(kutlanan(sonuc)).toEqual([]);
    // Kâşif koleksiyonu ise SESSİZ: ilk kez görüldüğü turda kazanıldı.
    expect(sonuc.ledger.seen).toContain("set_kesif");
  });

  test("KONTRAST (hatanın kendisi): kaynak yüklenmeden id `known`a yazılırsa kutlama YAĞAR", () => {
    // Bu, `bilinenRozetIdleri` olmadan (tüm katalog her zaman bildirilseydi) olacak olan.
    let defter = veteranV2Defteri();
    const naif = (d, stats) => {
      const rozetler = evaluateWatchBadges({ ...bosStats, ...stats }, d.earned.badgeIds);
      const acikIds = rozetler.filter((b) => b.acik).map((b) => b.id);
      return birlestir(d, { badgeIds: acikIds, tumIds: [...WATCH_BADGE_IDS, ...BADGE_SET_IDS], perde: 15, bugun: "2026-10-17" });
    };
    defter = naif(defter, VETERAN).ledger;            // kaynak yok → "hak edilmedi" → known'a yazıldı
    const sonra = naif(defter, { ...VETERAN, kesif: VETERAN_KESIF });
    expect(sonra.yeniRozetler.length).toBeGreaterThanOrEqual(13);               // konfeti yağmuru
    expect(sonra.yeniRozetler).toEqual(expect.arrayContaining(KESIF_IDLERI));
  });

  test("YENİ kullanıcı: kaynaklar hazır ve boşken id'ler bilinir → ilk not NORMAL KUTLANIR", () => {
    const tumIds = [...bilinenRozetIdleri(TUM_HAZIR), ...bilinenSetIdleri(TUM_HAZIR, [])];
    let defter = normalizeLedger({
      baseline: { kare: 0, perde: 1, badgeIds: [], seenAt: "x" },
      earned: { badgeIds: [], perdeFloor: 1, makaraFloor: 0 },
      seen: [], known: tumIds,
    });
    const sonuc = birlestir(defter, { badgeIds: ["kesif_ilk_not"], tumIds, perde: 1, bugun: "2026-10-17" });
    expect(sonuc.yeniRozetler).toEqual(["kesif_ilk_not"]);
    expect(sonuc.ledger.earnedAt.kesif_ilk_not).toBe("2026-10-17");
    expect(sonuc.ledger.seen).not.toContain("kesif_ilk_not");                   // kutlaması bekliyor
  });

  test("yeni kullanıcı, ARKADAŞ kaynağı geç hazır: önce 0 arkadaşla hazır olur, sonra ilk arkadaş KUTLANIR", () => {
    // Hazırlık imzası değişince mutabakat koşar (hook'ta imzaya girer); kaynak hazır
    // olunca id `known`a yazılır. İmza bunu görmezse ilk arkadaş sessiz emilirdi.
    const hazir1 = { ...TUM_HAZIR, arkadaslar: false };
    const hazir2 = TUM_HAZIR;
    expect(kesifHazirImzasi(hazir1)).not.toBe(kesifHazirImzasi(hazir2));

    let defter = normalizeLedger({
      baseline: { kare: 0, perde: 1, badgeIds: [], seenAt: "x" },
      earned: { badgeIds: [], perdeFloor: 1, makaraFloor: 0 },
      seen: [],
      known: [...bilinenRozetIdleri(hazir1), ...bilinenSetIdleri(hazir1, [])],
    });
    expect(defter.known).not.toContain("kesif_arkadas");

    // Arkadaş dinleyicisi geldi, 0 arkadaş → hiçbir şey kazanılmadı ama id artık bilinir.
    const bos = birlestir(defter, {
      badgeIds: [], tumIds: [...bilinenRozetIdleri(hazir2), ...bilinenSetIdleri(hazir2, [])], perde: 1, bugun: "2026-10-17",
    });
    expect(bos.yeniRozetler).toEqual([]);
    expect(bos.ledger.known).toContain("kesif_arkadas");
    expect(bos.degisti).toBe(true);                                             // diske yazılmalı

    // İlk arkadaş eklendi → GERÇEK kazanım, kutlanır.
    const ilk = birlestir(bos.ledger, {
      badgeIds: ["kesif_arkadas"],
      tumIds: [...bilinenRozetIdleri(hazir2), ...bilinenSetIdleri(hazir2, [])], perde: 1, bugun: "2026-10-18",
    });
    expect(ilk.yeniRozetler).toEqual(["kesif_arkadas"]);
    expect(ilk.ledger.earnedAt.kesif_arkadas).toBe("2026-10-18");
  });

  test("Kâşif koleksiyonu: arkadaş kaynağı çevrimdışıyken bile son rozet gelince KUTLANIR", () => {
    // 12 rozet defterde (kesif_arkadas dahil), `set_kesif` henüz bilinmiyor. Arkadaş
    // kaynağı bu oturumda hazır DEĞİL ama üyesi defterde kazanılmış → koleksiyon
    // `known`a yazılır (bilinenSetIdleri 2. parametre). Son rozet gelince kutlanır.
    const hazir = { ...TUM_HAZIR, arkadaslar: false };
    const onDoki = KESIF_IDLERI.filter((id) => id !== "kesif_cinematch");
    const bilinen = [...bilinenRozetIdleri(hazir), ...BADGE_SET_IDS.filter((id) => id !== "set_kesif")];
    let defter = defterKur(onDoki, bilinen);
    expect(defter.known).not.toContain("set_kesif");

    // Tur 1: hiçbir şey kazanılmadı; koleksiyon artık bilinir.
    const t1 = mutabakat(defter, { kesif: {} }, hazir);
    expect(t1.yeniRozetler).toEqual([]);
    expect(t1.ledger.known).toContain("set_kesif");
    defter = t1.ledger;

    // Tur 2: CineMatch ile ilk sohbet → son üye. Hem rozet hem koleksiyon KUTLANIR.
    const t2 = mutabakat(defter, { kesif: { cineMatch: 1 } }, hazir);
    expect(t2.yeniRozetler.sort()).toEqual(["kesif_cinematch", "set_kesif"]);
  });

  test("KONTRAST: üyeleri kazanılmış olsa da koleksiyon hiç bilinmediyse tamamlanma sessiz emilir", () => {
    // `known`a yazılmamış bir id ilk kez görüldüğü turda kazanılırsa kutlanmaz — bu yüzden
    // koleksiyonun mümkün olan ilk turda `known`a girmesi gerekir (üstteki test).
    const onDoki = KESIF_IDLERI.filter((id) => id !== "kesif_cinematch");
    const defter = defterKur(onDoki, [...WATCH_BADGE_IDS, ...BADGE_SET_IDS.filter((id) => id !== "set_kesif")]);
    const t = mutabakat(defter, { kesif: { cineMatch: 1 } }, TUM_HAZIR);
    expect(t.yeniRozetler).toEqual(["kesif_cinematch"]);       // rozet kutlanır, koleksiyon sessiz
    expect(t.ledger.earned.badgeIds).toContain("set_kesif");
  });
});

// ── 4. KATALOG GENİŞLEMESİ KORUMASI KOŞULLARI ───────────────────────────────

describe("katalog genişleme koruması Keşif'le bozulmadı", () => {
  test("WATCH_BADGE_IDS Keşif'i de içerir (koruma buna dayanır)", () => {
    for (const id of KESIF_IDLERI) expect(WATCH_BADGE_IDS).toContain(id);
    expect(WATCH_BADGE_IDS).toHaveLength(154);
  });

  test("v2 defteri + Keşif hazır: yeni rozetler since:3, mevcut id'ler değişmedi", () => {
    const v2 = WATCH_BADGES.filter((b) => b.since <= 2);
    expect(v2).toHaveLength(141);
    for (const b of v2) expect(WATCH_BADGE_BY_ID[b.id].kaynak).toBeNull();
  });
});
