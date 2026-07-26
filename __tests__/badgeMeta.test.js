// __tests__/badgeMeta.test.js
// Katalog USTU uc odul katmani: koleksiyonlar, donem muhurleri, prestij.

const {
  WATCH_BADGES, WATCH_BADGE_BY_ID, BOLUM, BOLUM_SIRA, BOLUM_BASLIK,
  AILE_PRESTIJ, prestijHesapla, prestijIdleri,
  evaluateWatchBadges, gruplaAileler,
} = require("../components/badges/watchBadgeCatalog");
const {
  BADGE_SETS, BADGE_SET_IDS, evaluateBadgeSets,
} = require("../components/badges/badgeSets");
const {
  MUHUR_ESIK, ILK_DONEM, donemAnahtari, muhurCoz, muhurId,
  muhurleriHesapla, muhurIdleri, bugunkuDonem,
} = require("../components/badges/seasonSeals");
const { odulAdi, odulBasligi, prestijCoz } = require("../components/badges/badgeMeta");
const { RARITY_ORDER } = require("../theme/badgeTokens");

const bosStats = { turSayaci: new Map() };
const grupla = (stats) => gruplaAileler(evaluateWatchBadges({ ...bosStats, ...stats }, []));

// ── KOLEKSIYONLAR ───────────────────────────────────────────────────────────

describe("koleksiyonlar", () => {
  test("her setin uyeleri KATALOGDA gercekten var", () => {
    for (const s of BADGE_SETS) {
      const uyeler = s.uyeler();
      expect([s.id, uyeler.length > 0]).toEqual([s.id, true]);
      for (const id of uyeler) {
        expect([s.id, id, !!WATCH_BADGE_BY_ID[id]]).toEqual([s.id, id, true]);
      }
      // Uye listesi tekrarsiz olmali; yoksa hedef sisirilir.
      expect(new Set(uyeler).size).toBe(uyeler.length);
    }
  });

  test("setler LEGENDARY olamaz (kota katalogun tek sigortasi)", () => {
    for (const s of BADGE_SETS) {
      expect(RARITY_ORDER.indexOf(s.rarity)).toBeLessThanOrEqual(RARITY_ORDER.indexOf("epic"));
    }
    expect(new Set(BADGE_SET_IDS).size).toBe(BADGE_SETS.length);
  });

  test("ilk adim = her ailenin 1. kademesi, panteon = her ailenin zirvesi", () => {
    const aileSayisi = new Set(WATCH_BADGES.filter((b) => b.family).map((b) => b.family)).size;
    const ilkAdim = BADGE_SETS.find((s) => s.id === "set_ilk_adim").uyeler();
    const panteon = BADGE_SETS.find((s) => s.id === "set_panteon").uyeler();
    expect(ilkAdim).toHaveLength(aileSayisi);
    expect(panteon).toHaveLength(aileSayisi);
    // Panteon sistemin en tepe hedefi: uc legendary'nin ucu de icinde.
    expect(panteon).toEqual(expect.arrayContaining(["film_2000", "bolum_10000", "perde_20"]));
    // Ilk adim ile panteon ayni rozeti PAYLASMAZ (aile uzunlugu >= 3).
    expect(ilkAdim.filter((id) => panteon.includes(id))).toEqual([]);
  });

  test("uzman seti tur AILESINI degil tekil tur rozetlerini ister", () => {
    const uzman = BADGE_SETS.find((s) => s.id === "set_uzman").uyeler();
    expect(uzman.sort()).toEqual(["animasyon_40", "belgesel_20", "komedi_75", "korku_25"]);
  });

  test("ilerleme ACIK uye sayisidir, hepsi acilinca set acilir", () => {
    const rozetler = evaluateWatchBadges(bosStats, []);
    const bos = evaluateBadgeSets(rozetler, []);
    for (const s of bos) {
      expect(s.ilerleme).toBe(0);
      expect(s.acik).toBe(false);
      expect(s.section).toBe(BOLUM.SET);
      expect(s.oran).toBe(0);
    }

    // Mevsimsel setin uyelerini defterden acik say → set tamamlanir.
    const mevsimUyeleri = BADGE_SETS.find((s) => s.id === "set_mevsim").uyeler();
    const acikRozetler = evaluateWatchBadges(bosStats, mevsimUyeleri);
    const setler = evaluateBadgeSets(acikRozetler, []);
    const mevsim = setler.find((s) => s.id === "set_mevsim");
    expect(mevsim.ilerleme).toBe(mevsimUyeleri.length);
    expect(mevsim.acik).toBe(true);
    expect(mevsim.oran).toBe(1);
  });

  test("defter uyeligi seti ACIK tutar (veri silinse bile)", () => {
    const rozetler = evaluateWatchBadges(bosStats, []);
    const setler = evaluateBadgeSets(rozetler, ["set_panteon"]);
    const panteon = setler.find((s) => s.id === "set_panteon");
    expect(panteon.acik).toBe(true);
    expect(panteon.ilerleme).toBe(0);      // ...ama ilerleme sahte doldurulmaz
  });

  test("kart sozlesmesi: WatchBadgeCard'in okudugu alanlarin hepsi dolu", () => {
    const setler = evaluateBadgeSets(evaluateWatchBadges(bosStats, []), []);
    for (const s of setler) {
      for (const alan of ["id", "icon", "iconSolid", "rarity", "tr", "en", "descTr", "descEn", "section"]) {
        expect([s.id, alan, s[alan] != null]).toEqual([s.id, alan, true]);
      }
      expect(s.icon.endsWith("-outline")).toBe(true);
      expect(s.iconSolid.endsWith("-outline")).toBe(false);
      expect(s.target).toBeGreaterThan(0);
      expect(s.family).toBeNull();          // aile kartina donusmemeli
      expect(s.hidden).toBe(false);
    }
  });
});

// ── DONEM MUHURLERI ─────────────────────────────────────────────────────────

describe("donem muhurleri", () => {
  test("aralik SONRAKI yilin kisina sayilir (kis tek parca kalsin)", () => {
    expect(donemAnahtari("2026-12-15")).toBe("2027-kis");
    expect(donemAnahtari("2027-01-05")).toBe("2027-kis");
    expect(donemAnahtari("2027-02-28")).toBe("2027-kis");
    expect(donemAnahtari("2026-06-01")).toBe("2026-yaz");
    expect(donemAnahtari("2026-09-30")).toBe("2026-sonbahar");
    expect(donemAnahtari("2026-03-01")).toBe("2026-ilkbahar");
    expect(donemAnahtari("bozuk")).toBeNull();
  });

  test("id uretimi ve cozumu geri donusumlu", () => {
    expect(muhurId("2026-yaz")).toBe("muhur_2026_yaz");
    expect(muhurCoz("muhur_2026_yaz")).toEqual({ yil: 2026, donem: "yaz", anahtar: "2026-yaz" });
    expect(muhurCoz("muhur_2026_bahar")).toBeNull();   // taninmayan donem
    expect(muhurCoz("film_10")).toBeNull();
  });

  test("guncel donem HER ZAMAN kart olarak durur, esik 8 farkli gun", () => {
    const simdi = new Date(2026, 6, 20).getTime();     // 20 Temmuz 2026 → yaz
    const gunler = ["2026-07-01", "2026-07-02", "2026-07-03"];
    const kartlar = muhurleriHesapla(gunler, { simdi, kazanilmis: [] });
    expect(kartlar).toHaveLength(1);
    const yaz = kartlar[0];
    expect(yaz.id).toBe("muhur_2026_yaz");
    expect(yaz.target).toBe(MUHUR_ESIK);
    expect(yaz.ilerleme).toBe(3);
    expect(yaz.acik).toBe(false);
    expect(yaz.guncelDonem).toBe(true);
    expect(yaz.section).toBe(BOLUM.MUHUR);
  });

  test("esige ulasinca acilir; fazla gun ilerlemeyi TASIRMAZ", () => {
    const simdi = new Date(2026, 6, 20).getTime();
    const gunler = Array.from({ length: 12 }, (_, i) => `2026-07-${String(i + 1).padStart(2, "0")}`);
    const yaz = muhurleriHesapla(gunler, { simdi })[0];
    expect(yaz.acik).toBe(true);
    expect(yaz.ilerleme).toBe(MUHUR_ESIK);
    expect(yaz.oran).toBe(1);
    expect(yaz.ham).toBe(12);
  });

  test("GERIYE DONUK muhur uretilmez (kapatilamayan bosluk olmasin)", () => {
    const simdi = new Date(2026, 6, 20).getTime();
    // Sistem oncesi bir donemde 40 gun isaretlense bile kart cikmaz.
    const eski = Array.from({ length: 40 }, (_, i) => `2025-07-${String((i % 28) + 1).padStart(2, "0")}`);
    const kartlar = muhurleriHesapla(eski, { simdi });
    expect(kartlar.map((k) => k.id)).toEqual(["muhur_2026_yaz"]);
    expect(kartlar[0].ilerleme).toBe(0);
    expect(ILK_DONEM).toBe("2026-yaz");
  });

  test("kazanilmis GECMIS muhur pencereden dusse bile kartta kalir", () => {
    // 400 gunluk pencere eski donemi unutur; defter onu ayakta tutar.
    const simdi = new Date(2027, 0, 10).getTime();     // Ocak 2027 → 2027-kis
    const kartlar = muhurleriHesapla([], { simdi, kazanilmis: ["muhur_2026_yaz"] });
    expect(kartlar.map((k) => k.id)).toEqual(["muhur_2027_kis", "muhur_2026_yaz"]);
    const yaz = kartlar.find((k) => k.id === "muhur_2026_yaz");
    expect(yaz.acik).toBe(true);
    expect(yaz.guncelDonem).toBe(false);
    // En yeni donem ustte
    expect(kartlar[0].guncelDonem).toBe(true);
  });

  test("muhurIdleri guncel donemi KAZANILMADAN once bildirir (kutlama sarti)", () => {
    const simdi = new Date(2026, 6, 20).getTime();
    const ids = muhurIdleri({ simdi, kazanilmis: [] });
    expect(ids).toContain("muhur_2026_yaz");
    // Defterdeki eski muhurler de listede kalir (known kumesinden dusmesin).
    const ids2 = muhurIdleri({ simdi, kazanilmis: ["muhur_2026_yaz", "film_10"] });
    expect(ids2.sort()).toEqual(["muhur_2026_yaz"]);
  });

  test("bugunkuDonem takvimden turer", () => {
    expect(bugunkuDonem(new Date(2026, 11, 1).getTime())).toBe("2027-kis");
    expect(bugunkuDonem(new Date(2026, 7, 31).getTime())).toBe("2026-yaz");
  });
});

// ── PRESTIJ ─────────────────────────────────────────────────────────────────

describe("prestij", () => {
  test("yalnizca SINIRSIZ olcutlerde tanimli", () => {
    // Dogal tavani olan aileler (tur 21 kova, ay 12, perde 20, yil, seri,
    // tek-gun aileleri) prestij ALMAZ: sonsuza dek 0 gosteren olu alan olurdu.
    for (const bagli of ["tur", "ay", "perde", "yil", "seri", "maraton", "tekOturus"]) {
      expect([bagli, AILE_PRESTIJ[bagli]]).toEqual([bagli, undefined]);
    }
    for (const acik of ["film", "bolum", "gun", "sure", "final", "uzunMetraj"]) {
      expect(AILE_PRESTIJ[acik]).toBeGreaterThan(0);
    }
  });

  test("zirveye ulasilmadan prestij 0", () => {
    expect(prestijHesapla("film", 1999, 2000)).toBe(0);
    expect(prestijHesapla("film", 2000, 2000)).toBe(0);
    expect(prestijHesapla("tur", 999, 20)).toBe(0);      // tanimsiz aile
  });

  test("zirveden sonra her adim bir basamak", () => {
    const adim = AILE_PRESTIJ.film;                       // 500
    expect(prestijHesapla("film", 2000 + adim - 1, 2000)).toBe(0);
    expect(prestijHesapla("film", 2000 + adim, 2000)).toBe(1);
    expect(prestijHesapla("film", 2000 + adim * 3 + 7, 2000)).toBe(3);
  });

  test("aile karti prestiji TASIR, tamamlanmamis ailede 0 kalir", () => {
    const yarim = grupla({ filmSayisi: 600 }).find((k) => k.family === "film");
    expect(yarim.prestij).toBe(0);                        // 5. kademe hala hedef

    const tam = grupla({ filmSayisi: 2000 + AILE_PRESTIJ.film * 2 }).find((k) => k.family === "film");
    expect(tam.sonrakiHedef).toBeNull();
    expect(tam.prestij).toBe(2);
    expect(tam.prestijAdim).toBe(AILE_PRESTIJ.film);
    // Kademe cipi degismedi: prestij AYRI bir eksen.
    expect(tam.aileKademe).toBe(5);
  });

  test("prestij defter id'lerine cevrilir; `sonraki` kutlama icin bir ileri yazar", () => {
    const kartlar = grupla({ filmSayisi: 2000 + AILE_PRESTIJ.film * 2 });
    expect(prestijIdleri(kartlar)).toEqual(["prestij_film_1", "prestij_film_2"]);
    expect(prestijIdleri(kartlar, { sonraki: 1 })).toEqual([
      "prestij_film_1", "prestij_film_2", "prestij_film_3",
    ]);
    // Prestiji olmayan ailelerden id uretilmez.
    expect(prestijIdleri(grupla({ turSayisi: 99 }))).toEqual([]);
  });

  test("ham deger KIRPILMAZ (prestij kirpilmis ilerlemeden uretilemez)", () => {
    const r = evaluateWatchBadges({ ...bosStats, filmSayisi: 9999 }, []);
    const f10 = r.find((b) => b.id === "film_10");
    expect(f10.ilerleme).toBe(10);        // cubuk hedefte durur
    expect(f10.ham).toBe(9999);           // ...ama ham deger korunur
  });
});

// ── COZUMLEYICI ─────────────────────────────────────────────────────────────

describe("odul cozumleyici (kutlama metni)", () => {
  test("katalog rozeti, koleksiyon, muhur ve prestij ADINI cozer", () => {
    expect(odulAdi("film_10", "tr")).toBe("İlk Bilet");
    expect(odulAdi("film_10", "en")).toBe("First Ticket");
    expect(odulAdi("set_panteon", "tr")).toBe("Panteon");
    expect(odulAdi("muhur_2026_yaz", "tr")).toBe("2026 Yazı");
    expect(odulAdi("muhur_2026_yaz", "en")).toBe("Summer 2026");
    expect(odulAdi("prestij_film_3", "tr")).toBe("Film · 3. prestij");
    expect(odulAdi("prestij_film_3", "en")).toBe("Film · prestige 3");
  });

  test("taninmayan id null doner (kutlama sessizce atlanir)", () => {
    expect(odulAdi("uydurma_id", "tr")).toBeNull();
    expect(odulAdi("prestij_tur_1", "tr")).toBeNull();   // prestiji olmayan aile
    expect(prestijCoz("prestij_bolum_4")).toEqual({ family: "bolum", n: 4 });
  });

  test("baslik odul TURUNE gore degisir", () => {
    expect(odulBasligi("film_10", "tr")).toBe("Rozet kazandın");
    expect(odulBasligi("set_mevsim", "tr")).toBe("Koleksiyon tamamlandı");
    expect(odulBasligi("muhur_2026_yaz", "tr")).toBe("Dönem mührü kazandın");
    expect(odulBasligi("prestij_gun_1", "tr")).toBe("Prestij yükseldi");
  });
});

// ── EKRAN SOZLESMESI ────────────────────────────────────────────────────────

describe("bolum sirasi", () => {
  test("BOLUM_SIRA her bolumu tam bir kez icerir ve basligi vardir", () => {
    const hepsi = Object.values(BOLUM);
    expect([...BOLUM_SIRA].sort()).toEqual([...hepsi].sort());
    for (const b of BOLUM_SIRA) {
      expect(BOLUM_BASLIK[b]?.tr && BOLUM_BASLIK[b]?.en).toBeTruthy();
    }
  });

  test("muhur ve koleksiyon ORTADA durur (ilk izlenim 0/6 olmasin)", () => {
    const i = (b) => BOLUM_SIRA.indexOf(b);
    expect(i(BOLUM.KILOMETRE)).toBeLessThan(i(BOLUM.MUHUR));
    expect(i(BOLUM.MUHUR)).toBeLessThan(i(BOLUM.SET));
    expect(i(BOLUM.SET)).toBeLessThan(i(BOLUM.GIZLI));
  });
});
