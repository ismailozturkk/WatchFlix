// __tests__/badgeInsights.test.js
// Rozet ekraninin sorularini cevaplayan saf fonksiyonlar: "siradaki hedefim ne?",
// "son ne kazandim?", "hangi bolumde kacinci?". Gercek katalog + gercek gruplama
// uzerinden calisir; sahte kart uretmek, gruplaAileler'in kimlik/hedef ayrimini
// (kart kazanilmis kademenin kimligini tasir, hedef ayri alanda durur) test disi
// birakirdi.

const {
  WATCH_BADGES, evaluateWatchBadges, gruplaAileler,
} = require("../components/badges/watchBadgeCatalog");
const { evaluateBadgeSets } = require("../components/badges/badgeSets");
const {
  muhurleriHesapla, donemSonGunu, donemKalanGun, MUHUR_ESIK,
} = require("../components/badges/seasonSeals");
const { odulGorunumu, odulAdi, baslikOdulu } = require("../components/badges/badgeMeta");
const {
  gunNo, bugunAnahtar, kacGunOnce, hedefi, yaklasanlar, kalanMiktar,
  kartlariDekorle, sonKazanilanlar, bolumOzetleri, nadirlikDagilimi,
  setUyeleri, prestijBilgisi, kartBul, hedefUyesi, izgaraSatirlari, prestijEk,
} = require("../components/badges/badgeInsights");
const { RARITY_ORDER } = require("../theme/badgeTokens");

// Yerel ogle 12:00 — saat dilimi ne olursa olsun gun sinirina yakin degil.
const an = (yil, ay, gun) => new Date(yil, ay - 1, gun, 12, 0, 0).getTime();
const SIMDI = an(2026, 10, 15);

function kurKartlar(stats, kazanilmis = []) {
  const rozetler = evaluateWatchBadges(stats, kazanilmis);
  const aileKartlari = gruplaAileler(rozetler);
  const setler = evaluateBadgeSets(rozetler, kazanilmis);
  const muhurler = muhurleriHesapla([], { simdi: SIMDI, kazanilmis });
  return { rozetler, setler, muhurler, kartlar: [...aileKartlari, ...muhurler, ...setler] };
}

describe("gun aritmetigi", () => {
  test("gunNo takvim gunu sayar, DST'den etkilenmez", () => {
    expect(gunNo("2026-03-29") - gunNo("2026-03-28")).toBe(1);
    expect(gunNo("2026-10-25") - gunNo("2026-10-24")).toBe(1);
    expect(gunNo("2028-03-01") - gunNo("2028-02-28")).toBe(2);   // 2028 artik yil
    expect(gunNo("2026-13-01")).not.toBeNaN();                    // desen gecerli, ay dogrulamasi yok
    expect(gunNo("dun")).toBeNaN();
    expect(gunNo(null)).toBeNaN();
  });

  test("kacGunOnce: bugun 0, gelecek ve bozuk tarih null", () => {
    expect(kacGunOnce("2026-10-15", SIMDI)).toBe(0);
    expect(kacGunOnce("2026-10-12", SIMDI)).toBe(3);
    expect(kacGunOnce("2026-10-16", SIMDI)).toBeNull();           // saat geri alinmis olabilir
    expect(kacGunOnce("bozuk", SIMDI)).toBeNull();
    expect(bugunAnahtar(SIMDI)).toBe("2026-10-15");
  });
});

describe("hedefi + yaklasanlar", () => {
  const { kartlar } = kurKartlar({ filmSayisi: 60, bolumSayisi: 80, gunSayisi: 20, harfSayisi: 17 });
  const kart = (id) => kartlar.find((k) => k.id === id || k.aileUyeleri?.some((u) => u.id === id));

  test("kademeli ailede hedef SIRADAKI kademe, kartin kimligi ULASILAN kademe", () => {
    const film = kart("film_50");
    expect(film.id).toBe("film_50");                     // 60 film → film_50 acik
    expect(hedefi(film).id).toBe("film_150");
    expect(hedefi(film).ilerleme).toBe(60);
    expect(kalanMiktar(hedefi(film))).toBe(90);
  });

  test("kilitli tekil rozetin hedefi kendisidir, tamamlanmis kartin hedefi yoktur", () => {
    // Tekil (ailesiz) kilitli rozet: komedi uzmanligi. (sadik_izleyici v2'de aileye girdi.)
    const kilitli = kart("komedi_75");
    expect(hedefi(kilitli)).toBe(kilitli);
    const tam = kurKartlar({ filmSayisi: 5000 }).kartlar.find((k) => k.family === "film");
    expect(tam.sonrakiHedef).toBeNull();
    expect(hedefi(tam)).toBeNull();
    expect(hedefi(null)).toBeNull();
  });

  test("hedefUyesi: hedefin TAM nesnesi (tier/ikon/nadirlik), sonrakiHedef'in aksine", () => {
    const film = kart("film_50");
    expect(film.sonrakiHedef.tier).toBeUndefined();            // yalnizca ad/oran tasir
    const uye = hedefUyesi(film);
    expect(uye.id).toBe("film_150");
    expect(uye.tier).toBe(3);                                   // sekli/rengi cizmek icin
    expect(uye.rarity).toBe("rare");
    expect(uye.icon).toBe("film-outline");
    const tekil = kart("komedi_75");
    expect(hedefUyesi(tekil)).toBe(tekil);
    expect(hedefUyesi(null)).toBeNull();
  });

  test("en yakin hedef once; oran sirasi azalan", () => {
    const sonuc = yaklasanlar(kartlar, { limit: 50 });
    const oranlar = sonuc.map((x) => x.hedef.oran);
    expect([...oranlar].sort((a, b) => b - a)).toEqual(oranlar);
    // KOLEKSIYONLAR hedef siralamasina girer (v2: "Saglam Baslangic 6/7" gibi bir set
    // en yakin hedef olabilir — kullaniciya bilincli olarak gosterilir). Katalog
    // rozetleri arasindaki sirayi ayri kontrol ediyoruz.
    const katalog = sonuc.filter((x) => x.kart.section !== "set" && x.kart.section !== "muhur");
    // 80 bolum → bolum_100 %80; 20 gun → gun_25 de %80. Esitlikte kalan mesafesi
    // kucuk olan (5 gun < 20 bolum) once gelir.
    expect(katalog.find((x) => x.kart.family === "bolum").hedef.oran).toBeCloseTo(0.8, 5);
    expect(katalog[0].hedef.oran).toBeCloseTo(0.8, 5);
    expect(katalog[0].hedef.id).toBe("gun_25");
    expect(katalog[1].hedef.id).toBe("bolum_100");
  });

  test("v2: yaklasan koleksiyon da hedeftir (Baslangic seti 6/7)", () => {
    const sonuc = yaklasanlar(kartlar, { limit: 50 });
    const set = sonuc.find((x) => x.kart.id === "set_baslangic");
    expect(set).toBeTruthy();
    expect(set.hedef.ilerleme).toBe(6);     // yalniz ilk_destan (uzun metraj) eksik
    expect(set.hedef.target).toBe(7);
  });

  test("GIZLI kilitli rozet oraniyla bile listeye GIRMEZ (17/18 harf sizdirmaz)", () => {
    const hepsi = yaklasanlar(kartlar, { limit: 500 });
    expect(hepsi.some((x) => x.kart.hidden && !x.kart.acik)).toBe(false);
    expect(hepsi.some((x) => x.kart.id === "gizli_alfabe")).toBe(false);
  });

  test("limit ve minOran uygulanir, tamamlanmis hedef (oran 1) girmez", () => {
    expect(yaklasanlar(kartlar, { limit: 3 })).toHaveLength(3);
    expect(yaklasanlar(kartlar, { limit: 0 })).toEqual([]);
    for (const x of yaklasanlar(kartlar, { limit: 500, minOran: 0.5 })) {
      expect(x.hedef.oran).toBeGreaterThanOrEqual(0.5);
      expect(x.hedef.oran).toBeLessThan(1);
    }
  });

  test("bos/bozuk girdide atmaz", () => {
    expect(yaklasanlar(null)).toEqual([]);
    expect(yaklasanlar([])).toEqual([]);
    expect(yaklasanlar([{ id: "x" }])).toHaveLength(1);   // kilitli say: acik yok → hedef kendisi
  });

  test("esit oranda kalan mesafesi kucuk olan once, o da esitse giris sirasi", () => {
    const k = (id, ilerleme, target) => ({ id, acik: false, oran: ilerleme / target, ilerleme, target, hidden: false });
    const s = yaklasanlar([k("a", 5, 10), k("b", 50, 100), k("c", 1, 2)], { limit: 3 });
    // hepsi %50: kalan 5, 50, 1 → c, a, b
    expect(s.map((x) => x.kart.id)).toEqual(["c", "a", "b"]);
    const e = yaklasanlar([k("x", 5, 10), k("y", 5, 10)], { limit: 2 });
    expect(e.map((x) => x.kart.id)).toEqual(["x", "y"]);
  });
});

describe("kartlariDekorle + sonKazanilanlar", () => {
  const { kartlar } = kurKartlar({ filmSayisi: 60, bolumSayisi: 30 }, []);
  const acikIdler = kartlar.filter((k) => k.acik).map((k) => k.id);

  test("tarih yalniz ACIK karta islenir, girdi nesnesine dokunulmaz", () => {
    const kilitli = kartlar.find((k) => !k.acik);
    const dondu = kartlariDekorle(kartlar, { [acikIdler[0]]: "2026-10-14", [kilitli.id]: "2026-10-14" }, { simdi: SIMDI });
    const a = dondu.find((k) => k.id === acikIdler[0]);
    expect(a.kazanmaTarihi).toBe("2026-10-14");
    expect(dondu.find((k) => k.id === kilitli.id).kazanmaTarihi).toBeNull();
    expect(kartlar[0]).not.toHaveProperty("kazanmaTarihi");
  });

  test("YENI: 7 gunden yeni → true, 7. gun → false, tarihsiz asla yeni degil", () => {
    const id = acikIdler[0];
    const f = (tarih) => kartlariDekorle(kartlar, { [id]: tarih }, { simdi: SIMDI }).find((k) => k.id === id);
    expect(f("2026-10-15").yeni).toBe(true);
    expect(f("2026-10-09").yeni).toBe(true);     // 6 gun once
    expect(f("2026-10-08").yeni).toBe(false);    // 7 gun once
    expect(f("2026-10-20").yeni).toBe(false);    // gelecek
    const tarihsiz = kartlariDekorle(kartlar, {}, { simdi: SIMDI });
    expect(tarihsiz.some((k) => k.yeni)).toBe(false);
    expect(kartlariDekorle(kartlar, null, { simdi: SIMDI }).some((k) => k.kazanmaTarihi)).toBe(false);
  });

  test("sonKazanilanlar: en yeni once, ayni gunde nadir olan once, pencere disi elenir", () => {
    const [a, b, c] = acikIdler;
    const tarihler = { [a]: "2026-10-01", [b]: "2026-10-14", [c]: "2026-10-14" };
    const d = kartlariDekorle(kartlar, tarihler, { simdi: SIMDI });
    const s = sonKazanilanlar(d, { simdi: SIMDI, limit: 10 });
    expect(s.map((k) => k.id).slice(-1)).toEqual([a]);           // en eski sonda
    const nadir = (id) => RARITY_ORDER.indexOf(d.find((k) => k.id === id).rarity);
    const ilkIki = s.slice(0, 2).map((k) => k.id);
    expect(ilkIki.sort()).toEqual([b, c].sort());
    expect(nadir(s[0].id)).toBeGreaterThanOrEqual(nadir(s[1].id));
    expect(sonKazanilanlar(d, { simdi: SIMDI, gun: 5 }).map((k) => k.id).sort()).toEqual([b, c].sort());
    expect(sonKazanilanlar(d, { simdi: SIMDI, limit: 1 })).toHaveLength(1);
    expect(sonKazanilanlar(kartlariDekorle(kartlar, {}, { simdi: SIMDI }), { simdi: SIMDI })).toEqual([]);
  });
});

describe("bolumOzetleri + nadirlikDagilimi", () => {
  const { kartlar, rozetler } = kurKartlar({ filmSayisi: 60, bolumSayisi: 30, gunSayisi: 30 });

  test("sayim kademe duzeyinde: katalog rozetleri + koleksiyon + muhur", () => {
    const { BADGE_SETS } = require("../components/badges/badgeSets");
    const ozet = bolumOzetleri(kartlar);
    const toplam = ozet.reduce((n, o) => n + o.toplam, 0);
    expect(WATCH_BADGES).toHaveLength(158);
    expect(toplam).toBe(WATCH_BADGES.length + BADGE_SETS.length /* koleksiyon */ + 1 /* guncel muhur */);
    for (const o of ozet) {
      expect(o.acik).toBeLessThanOrEqual(o.toplam);
      expect(o.oran).toBeCloseTo(o.acik / o.toplam, 10);
    }
  });

  test("bolum sirasi katalogdaki BOLUM_SIRA, bos bolum yok", () => {
    const { BOLUM_SIRA } = require("../components/badges/watchBadgeCatalog");
    const bolumler = bolumOzetleri(kartlar).map((o) => o.bolum);
    expect(bolumler).toEqual(BOLUM_SIRA.filter((b) => bolumler.includes(b)));
    expect(bolumOzetleri(null)).toEqual([]);
  });

  test("kademeli ailenin ACIK kademeleri bolum sayacina tek tek girer", () => {
    const ozet = bolumOzetleri(kartlar).find((o) => o.bolum === "kilometre");
    // film 60 → ilk iki kademe, bolum 30 → ilk kademe = 3 (ilk_kare v2'de Baslangic bolumune tasindi)
    expect(ozet.acik).toBeGreaterThanOrEqual(3);
    // ...ve Baslangic bolumunde sayilir: 7 rozetin 6'si acik (yalniz ilk_destan eksik).
    const baslangic = bolumOzetleri(kartlar).find((o) => o.bolum === "baslangic");
    expect(baslangic.toplam).toBe(7);
    expect(baslangic.acik).toBe(6);
  });

  test("nadirlik dagilimi: bes kademe, toplam 158, acik <= toplam", () => {
    const d = nadirlikDagilimi(rozetler);
    expect(d.map((x) => x.rarity)).toEqual(RARITY_ORDER);
    expect(d.reduce((n, x) => n + x.toplam, 0)).toBe(158);
    for (const x of d) expect(x.acik).toBeLessThanOrEqual(x.toplam);
    expect(d.find((x) => x.rarity === "legendary").toplam).toBe(3);   // katalog kotasi
    expect(nadirlikDagilimi(null).every((x) => x.toplam === 0)).toBe(true);
  });
});

describe("koleksiyon uyeleri, prestij, kart arama", () => {
  test("setUyeleri uye id'lerini katalog rozetine cozer, sirayi korur", () => {
    const { rozetler, setler } = kurKartlar({ filmSayisi: 12 });
    const ilkAdim = setler.find((s) => s.id === "set_ilk_adim");
    const uyeler = setUyeleri(ilkAdim, rozetler);
    expect(uyeler.map((u) => u.id)).toEqual(ilkAdim.uyeIdleri);
    expect(uyeler.every((u) => u.tier === 1)).toBe(true);
    expect(uyeler.find((u) => u.id === "film_10").acik).toBe(true);
    expect(setUyeleri(null, rozetler)).toEqual([]);
    expect(setUyeleri({ uyeIdleri: ["yok"] }, rozetler)).toEqual([]);
  });

  test("prestijBilgisi yalniz TAMAMLANMIS ve prestij taşıyan ailede dolu", () => {
    const yarim = kurKartlar({ filmSayisi: 600 }).kartlar.find((k) => k.family === "film");
    expect(yarim.sonrakiHedef).not.toBeNull();
    expect(prestijBilgisi(yarim)).toBeNull();

    // 2000 hedef + 2 basamak (500 adim) + 120 artik
    const tam = kurKartlar({ filmSayisi: 2000 + 1000 + 120 }).kartlar.find((k) => k.family === "film");
    const p = prestijBilgisi(tam);
    expect(p.n).toBe(2);
    expect(p.adim).toBe(500);
    expect(p.kismi).toBe(120);
    expect(p.kalan).toBe(380);
    expect(p.oran).toBeCloseTo(120 / 500, 10);

    // Hedefe tam esit: prestij 0, basamak ilerlemesi 0
    const esit = kurKartlar({ filmSayisi: 2000 }).kartlar.find((k) => k.family === "film");
    expect(prestijBilgisi(esit)).toMatchObject({ n: 0, kismi: 0, kalan: 500 });

    // Prestij tanimsiz aile (tur) zirvede de null
    const tur = kurKartlar({ turSayisi: 30 }).kartlar.find((k) => k.family === "tur");
    expect(tur.sonrakiHedef).toBeNull();
    expect(prestijBilgisi(tur)).toBeNull();
    expect(prestijBilgisi(null)).toBeNull();
  });

  test("prestijBilgisi sure ailesinde birimi tasir (dakika gosterimi icin)", () => {
    const sure = kurKartlar({ etkinDakikaToplam: 525600 + 131400 + 100 }).kartlar.find((k) => k.family === "sure");
    const p = prestijBilgisi(sure);
    expect(p.n).toBe(1);
    expect(p.birim).toBeTruthy();
    expect(p.birim.id).toBe("dk");
  });

  test("kartBul: kartin kendi id'si ve ailenin HERHANGI uyesinin id'si", () => {
    const { kartlar } = kurKartlar({ filmSayisi: 160 });
    const film = kartlar.find((k) => k.family === "film");
    expect(film.id).toBe("film_150");
    expect(kartBul(kartlar, "film_150")).toBe(film);
    expect(kartBul(kartlar, "film_10")).toBe(film);     // alt kademe → ayni kart
    expect(kartBul(kartlar, "film_2000")).toBe(film);   // kilitli ust kademe → ayni kart
    expect(kartBul(kartlar, "yok_boyle_id")).toBeNull();
    expect(kartBul(kartlar, null)).toBeNull();
    expect(kartBul(null, "film_10")).toBeNull();
  });
});

describe("donem muhuru geri sayimi", () => {
  test("donemSonGunu: dort donemin son gunu, kis yil anahtarinin Subat'inda biter", () => {
    expect(donemSonGunu("2026-yaz")).toBe("2026-08-31");
    expect(donemSonGunu("2026-sonbahar")).toBe("2026-11-30");
    expect(donemSonGunu("2026-ilkbahar")).toBe("2026-05-31");
    expect(donemSonGunu("2027-kis")).toBe("2027-02-28");
    expect(donemSonGunu("2028-kis")).toBe("2028-02-29");        // artik yil
    expect(donemSonGunu("2026-yok")).toBeNull();
    expect(donemSonGunu("saçma")).toBeNull();
    expect(donemSonGunu(null)).toBeNull();
  });

  test("donemKalanGun: son gun 0, bugun dahil degil, bitmis donem negatif", () => {
    expect(donemKalanGun("2026-sonbahar", an(2026, 11, 30))).toBe(0);
    expect(donemKalanGun("2026-sonbahar", an(2026, 11, 29))).toBe(1);
    expect(donemKalanGun("2026-sonbahar", an(2026, 10, 15))).toBe(46);
    expect(donemKalanGun("2026-sonbahar", an(2026, 12, 1))).toBe(-1);
    expect(donemKalanGun("2027-kis", an(2026, 12, 1))).toBe(89);   // 31+31+27 gun
    expect(donemKalanGun("sacma", SIMDI)).toBeNull();
  });

  test("guncel muhur karti kalan/eksik gun ve 'yetisir' tasir", () => {
    const [guncel] = muhurleriHesapla(["2026-10-01", "2026-10-02", "2026-10-03"], { simdi: SIMDI });
    expect(guncel.guncelDonem).toBe(true);
    expect(guncel.ham).toBe(3);
    expect(guncel.kalanGun).toBe(46);
    expect(guncel.eksikGun).toBe(MUHUR_ESIK - 3);
    expect(guncel.yetisir).toBe(true);
  });

  test("yetisir: son gunde 1 eksik hala yetisir, 2 eksik yetismez", () => {
    const son = an(2026, 11, 30);
    const yedi = Array.from({ length: 7 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);
    const bir = muhurleriHesapla(yedi, { simdi: son })[0];
    expect(bir.kalanGun).toBe(0);
    expect(bir.eksikGun).toBe(1);
    expect(bir.yetisir).toBe(true);                     // bugun isaretleyebilir
    const alti = muhurleriHesapla(yedi.slice(0, 6), { simdi: son })[0];
    expect(alti.eksikGun).toBe(2);
    expect(alti.yetisir).toBe(false);                   // tek gun kaldi, iki gun lazim
  });

  test("kazanilmis muhur her zaman 'yetisir', eksik gun 0", () => {
    const sekiz = Array.from({ length: 8 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);
    const m = muhurleriHesapla(sekiz, { simdi: an(2026, 11, 30) })[0];
    expect(m.acik).toBe(true);
    expect(m.eksikGun).toBe(0);
    expect(m.yetisir).toBe(true);
  });
});

describe("odulGorunumu: her odul turu cizilebilir gorunum verir", () => {
  test("katalog rozeti: ikon, nadirlik, kademe ve aile uzunlugu", () => {
    const g = odulGorunumu("film_150", "tr");
    expect(g).toMatchObject({ tur: "rozet", ad: "Salon Sakini", icon: "film-outline", iconSolid: "film", rarity: "rare", tier: 3, aileToplam: 5 });
    expect(g.baslik).toBe("Rozet kazandın");
    expect(odulGorunumu("film_150", "en").ad).toBe("Theater Dweller");
  });

  test("ailesiz rozetin kademesi 0", () => {
    expect(odulGorunumu("ilk_kare")).toMatchObject({ tier: 0, aileToplam: 0, tur: "rozet" });
  });

  test("koleksiyon, donem muhuru ve prestij", () => {
    expect(odulGorunumu("set_panteon")).toMatchObject({ tur: "koleksiyon", rarity: "epic", baslik: "Koleksiyon tamamlandı" });
    expect(odulGorunumu("muhur_2026_sonbahar")).toMatchObject({ tur: "muhur", icon: "leaf-outline", rarity: "uncommon" });
    const p = odulGorunumu("prestij_film_2");
    expect(p).toMatchObject({ tur: "prestij", icon: "film-outline", tier: 5, aileToplam: 5 });
    expect(p.ad).toBe("Film · 2. prestij");
  });

  test("tanınmayan id null; odulAdi ile TUTARLI (ad varsa gorunum var)", () => {
    expect(odulGorunumu("yok")).toBeNull();
    expect(odulGorunumu("prestij_kurgu_1")).toBeNull();
    for (const b of WATCH_BADGES) {
      expect(odulGorunumu(b.id).ad).toBe(odulAdi(b.id));
    }
  });
});

describe("baslikOdulu: kutlama basligi en nadir odul", () => {
  test("tek odul: ek 0", () => {
    const b = baslikOdulu(["film_10"]);
    expect(b.gorunum.id).toBe("film_10");
    expect(b.ek).toBe(0);
  });

  test("birden cok odulde EN NADIR basliga cikar, kalanlar ek sayisi olur", () => {
    const b = baslikOdulu(["film_10", "perde_20", "film_150", "set_panteon"]);
    expect(b.gorunum.id).toBe("perde_20");          // legendary
    expect(b.ek).toBe(3);
  });

  test("esit nadirlikte listedeki ILK secilir", () => {
    expect(baslikOdulu(["film_150", "komedi_75"]).gorunum.id).toBe("film_150");   // ikisi de rare
  });

  test("taninmayan id'ler atlanir, hepsi taninmazsa null", () => {
    expect(baslikOdulu(["yok", "film_10"]).ek).toBe(0);
    expect(baslikOdulu(["yok", "yok2"])).toBeNull();
    expect(baslikOdulu([])).toBeNull();
    expect(baslikOdulu(null)).toBeNull();
  });

  test("dil EN ise ad ve baslik Ingilizce", () => {
    const b = baslikOdulu(["film_150"], "en");
    expect(b.gorunum.ad).toBe("Theater Dweller");
    expect(b.gorunum.baslik).toBe("Badge earned");
  });
});

const { NADIRLIK_AD, nadirlikAdi, formatTarih, yuzde, yuzdeMetni } = require("../components/badges/badgeFormat");

describe("badgeFormat: ortak metin bicimleyiciler", () => {
  test("nadirlik adlari bes kademe icin iki dilde dolu", () => {
    for (const r of RARITY_ORDER) {
      expect(NADIRLIK_AD[r].tr).toBeTruthy();
      expect(NADIRLIK_AD[r].en).toBeTruthy();
    }
    expect(nadirlikAdi("legendary", "tr")).toBe("Efsanevi");
    expect(nadirlikAdi("legendary", "en")).toBe("Legendary");
    expect(nadirlikAdi("yok", "tr")).toBe("yok");
    expect(nadirlikAdi(undefined, "tr")).toBe("");
  });

  test("formatTarih: elle bicimlenir, Intl'e bagimli degil", () => {
    expect(formatTarih("2026-10-15", "tr")).toBe("15 Ekim 2026");
    expect(formatTarih("2026-10-15", "en")).toBe("Oct 15, 2026");
    expect(formatTarih("2026-01-05", "tr")).toBe("5 Ocak 2026");      // bastaki sifir atilir
    expect(formatTarih("2026-12-31", "en")).toBe("Dec 31, 2026");
    // pt/de Türkçe ay adına düşmez (T3 B17).
    expect(formatTarih("2026-10-26", "de")).toBe("26. Oktober 2026");
    expect(formatTarih("2026-10-26", "pt")).toBe("26 de outubro de 2026");
  });

  test("formatTarih: gecersiz girdide null", () => {
    for (const bozuk of ["", null, undefined, "dun", "2026-13-01", "2026-00-10", "2026-10-00", "2026-10-32", 20261015]) {
      expect(formatTarih(bozuk, "tr")).toBeNull();
    }
  });

  test("yuzdeMetni: Turkce '%47', Ingilizce '47%'", () => {
    expect(yuzdeMetni(0.47, "tr")).toBe("%47");
    expect(yuzdeMetni(0.47, "en")).toBe("47%");
    expect(yuzdeMetni(0.004, "en")).toBe("1%");
    expect(yuzdeMetni(1, "tr")).toBe("%100");
    expect(yuzdeMetni(undefined)).toBe("%0");
  });

  test("yuzde uclari korur: %0,4 sifir degil, %99,6 yuz degil", () => {
    expect(yuzde(0)).toBe(0);
    expect(yuzde(-1)).toBe(0);
    expect(yuzde(NaN)).toBe(0);
    expect(yuzde(0.004)).toBe(1);
    expect(yuzde(0.996)).toBe(99);
    expect(yuzde(0.5)).toBe(50);
    expect(yuzde(1)).toBe(100);
    expect(yuzde(7)).toBe(100);
  });
});

describe("izgaraSatirlari: sureler, sira ve satirlama", () => {
  const { kartlar } = kurKartlar({ filmSayisi: 60, bolumSayisi: 30, gunSayisi: 30, harfSayisi: 17 });
  const kartSayisi = (satirlar) =>
    satirlar.filter((r) => r.tur === "rozetSatiri").reduce((n, r) => n + r.rozetler.length, 0);

  test("tumu: her kart tam bir kez, satirlar en cok 3 rozet", () => {
    const satirlar = izgaraSatirlari(kartlar, "tumu", null);
    expect(kartSayisi(satirlar)).toBe(kartlar.length);
    for (const r of satirlar.filter((x) => x.tur === "rozetSatiri")) {
      expect(r.rozetler.length).toBeGreaterThan(0);
      expect(r.rozetler.length).toBeLessThanOrEqual(3);
    }
    // id'ler benzersiz (FlatList keyExtractor)
    expect(new Set(satirlar.map((r) => r.id)).size).toBe(satirlar.length);
  });

  test("sutun sayisi ayarlanabilir", () => {
    const dort = izgaraSatirlari(kartlar, "tumu", null, 4);
    expect(Math.max(...dort.filter((x) => x.tur === "rozetSatiri").map((r) => r.rozetler.length))).toBe(4);
    expect(kartSayisi(dort)).toBe(kartlar.length);
  });

  test("bolum sirasi katalogdaki BOLUM_SIRA, her bolum basligiyla baslar", () => {
    const { BOLUM_SIRA } = require("../components/badges/watchBadgeCatalog");
    const satirlar = izgaraSatirlari(kartlar, "tumu", null);
    const basliklar = satirlar.filter((r) => r.tur === "baslik").map((r) => r.bolum);
    expect(basliklar).toEqual(BOLUM_SIRA.filter((b) => basliklar.includes(b)));
    expect(satirlar[0].tur).toBe("baslik");
  });

  test("bolum suzgeci yalniz o bolumu verir", () => {
    const satirlar = izgaraSatirlari(kartlar, "tumu", "tur");
    expect(satirlar.filter((r) => r.tur === "baslik").map((r) => r.bolum)).toEqual(["tur"]);
    const tumKartlar = satirlar.filter((r) => r.tur === "rozetSatiri").flatMap((r) => r.rozetler);
    expect(tumKartlar.every((k) => k.section === "tur")).toBe(true);
  });

  test("ACIK suzgeci yalniz acik kartlari verir", () => {
    const k = izgaraSatirlari(kartlar, "acik", null).filter((r) => r.tur === "rozetSatiri").flatMap((r) => r.rozetler);
    expect(k.length).toBeGreaterThan(0);
    expect(k.every((x) => x.acik)).toBe(true);
  });

  test("KILITLI suzgeci: kilitli kartlar VE sirada hedefi olan acik aile (hedef kaybolmaz)", () => {
    const k = izgaraSatirlari(kartlar, "kilitli", null).filter((r) => r.tur === "rozetSatiri").flatMap((r) => r.rozetler);
    expect(k.every((x) => !x.acik || !!x.sonrakiHedef)).toBe(true);
    // 60 film: film ailesi ACIK ama film_150 hedefi var → Kilitli'de de gorunur
    expect(k.some((x) => x.family === "film")).toBe(true);
    // Hic hedefi olmayan acik kart girmez
    const acikHedefsiz = kartlar.filter((x) => x.acik && !x.sonrakiHedef);
    for (const x of acikHedefsiz) expect(k.includes(x)).toBe(false);
  });

  test("bolum icinde TAMAMLANMAYA EN YAKIN once, gizli kilitli en sonda", () => {
    const rows = izgaraSatirlari(kartlar, "tumu", "ritim").filter((r) => r.tur === "rozetSatiri").flatMap((r) => r.rozetler);
    const hedefOrani = (x) => (x.sonrakiHedef || (!x.acik ? x : null))?.oran;
    const hedefliler = rows.filter((x) => hedefOrani(x) !== undefined);
    const oranlar = hedefliler.map(hedefOrani);
    expect([...oranlar].sort((a, b) => b - a)).toEqual(oranlar);
    // hedefi olanlar, hedefi olmayanlardan once
    const ilkHedefsiz = rows.findIndex((x) => hedefOrani(x) === undefined);
    if (ilkHedefsiz >= 0) expect(rows.slice(ilkHedefsiz).every((x) => hedefOrani(x) === undefined)).toBe(true);
  });

  test("gizli kilitli rozetler ORANLA siralanmaz: 17/18 harf listenin tepesine cikmaz", () => {
    // "Gizli" bolumu tamamen gizli rozetlerden olusur. Oranla siralamak, en tepedeki
    // gizli rozetin hedefe en yakin olani oldugunu ele verirdi.
    const rows = izgaraSatirlari(kartlar, "tumu", "gizli").filter((r) => r.tur === "rozetSatiri").flatMap((r) => r.rozetler);
    const kilitliGizliler = rows.filter((x) => x.hidden && !x.acik);
    expect(kilitliGizliler.length).toBeGreaterThan(2);
    const katalogSirasi = kartlar.filter((x) => x.section === "gizli" && !x.acik).map((x) => x.id);
    expect(kilitliGizliler.map((x) => x.id)).toEqual(katalogSirasi);
    // gizli_alfabe %94 ilerlemede ama ilk sirada degil
    expect(kilitliGizliler.find((x) => x.id === "gizli_alfabe").oran).toBeGreaterThan(0.9);
    expect(kilitliGizliler[0].id).not.toBe("gizli_alfabe");
  });

  test("bos/bozuk girdide atmaz", () => {
    expect(izgaraSatirlari(null, "tumu", null)).toEqual([]);
    expect(izgaraSatirlari([], "acik", "tur")).toEqual([]);
    expect(izgaraSatirlari(kartlar, "acik", "olmayan_bolum")).toEqual([]);
  });
});

describe("prestijEk: prestij adiminin birim adi", () => {
  test("AILE_PRESTIJ'deki her aile ya birim adi tasir ya da sure ailesidir (birimi cevirici verir)", () => {
    const { AILE_PRESTIJ } = require("../components/badges/watchBadgeCatalog");
    for (const fam of Object.keys(AILE_PRESTIJ)) {
      if (fam === "sure") expect(prestijEk(fam, "tr")).toBe("");
      else {
        expect([fam, prestijEk(fam, "tr").length > 0]).toEqual([fam, true]);
        expect([fam, prestijEk(fam, "en").length > 0]).toEqual([fam, true]);
      }
    }
  });
  test("dil ve bilinmeyen aile", () => {
    expect(prestijEk("film", "tr")).toBe("film");
    expect(prestijEk("bolum", "en")).toBe("episodes");
    expect(prestijEk("yok", "tr")).toBe("");
  });
});

// ── KATALOG v2/v3/v4: yeni etiketi, duyuru özeti ────────────────────────────
//
// "Yeni" HER ZAMAN son sürümdür (KATALOG_SURUMU). v4 gelince yalnız Bingo ailesi
// yeni sayılır; eski sürümler `surum` parametresiyle ayrıca kilitli kalır.

describe("v2: yeni eklenen rozetler (yeniEklendi / yeniRozetOzeti)", () => {
  const { yeniEklendi, yeniRozetOzeti } = require("../components/badges/badgeInsights");

  test("surum 2 verilince: kart, uyelerinden BIRI v2 ise yenidir; tamamen v1 olan aile ve v1 tekil degildir", () => {
    const { kartlar } = kurKartlar({});
    const kart = (id) => kartlar.find((k) => k.id === id || k.aileUyeleri?.some((u) => u.id === id));
    expect(yeniEklendi(kart("ilk_film"), 2)).toBe(true);          // v2 tekil
    expect(yeniEklendi(kart("film_10"), 2)).toBe(false);          // v1 ailesi
    expect(yeniEklendi(kart("korku_25"), 2)).toBe(false);         // v1 tekil
    expect(yeniEklendi(kart("dizi_5"), 2)).toBe(true);            // 4/5 uyesi yeni
    expect(yeniEklendi(kart("uzun_metraj"), 2)).toBe(true);       // 1/5 uyesi yeni (200)
    expect(yeniEklendi(kart("sadik_izleyici"), 2)).toBe(true);    // 3/4 uyesi yeni
    expect(yeniEklendi(null, 2)).toBe(false);
    expect(yeniEklendi({}, 2)).toBe(false);
  });

  test("varsayilan surum = v4: yalnız 4 Bingo kademesi yeni", () => {
    const { kartlar } = kurKartlar({});
    const kart = (id) => kartlar.find((k) => k.id === id || k.aileUyeleri?.some((u) => u.id === id));
    expect(yeniEklendi(kart("bingo_1"))).toBe(true);
    expect(yeniEklendi(kart("bingo_12"))).toBe(true);
    expect(yeniEklendi(kart("kesif_ilk_not"))).toBe(false);
    expect(yeniEklendi(kart("ilk_film"))).toBe(false);          // v2 artik eski
    expect(yeniEklendi(kart("dizi_5"))).toBe(false);
    expect(yeniEklendi(kart("film_10"))).toBe(false);
  });

  test("koleksiyon ve muhur kartlari YENI sayilmaz (rozet degiller, katalog surumleri yok)", () => {
    const { kartlar } = kurKartlar({});
    const dekore = kartlariDekorle(kartlar, {});
    for (const k of dekore.filter((x) => x.section === "set" || x.section === "muhur")) {
      expect([k.id, k.yeniKatalog]).toEqual([k.id, false]);
    }
  });

  test("kartlariDekorle yeniKatalog'u ekler ve `yeni` (kazanildi) ile KARISMAZ", () => {
    const { kartlar } = kurKartlar({ filmSayisi: 3, bingoFullCards: 1 }, ["bingo_1", "film_10"]);
    const dekore = kartlariDekorle(kartlar, { bingo_1: "2026-10-14" }, { simdi: SIMDI });
    const bingo = dekore.find((k) => k.family === "bingo");
    expect(bingo.yeniKatalog).toBe(true);       // kataloga yeni
    expect(bingo.yeni).toBe(true);              // ...VE bu hafta kazanildi
    const film10 = dekore.find((k) => k.family === "film");
    expect(film10.yeniKatalog).toBe(false);     // v1 ailesi
    const eskiKesif = dekore.find((k) => k.id === "kesif_arkadas");
    expect([eskiKesif.yeniKatalog, eskiKesif.yeni]).toEqual([false, false]);
    const eskiV2 = dekore.find((k) => k.id === "aksiyon_50");
    expect(eskiV2.yeniKatalog).toBe(false);     // v2 rozeti v3 geldikten sonra "yeni" degil
  });

  test("ozet: v4 ile 4 Bingo kademesi eklendi; önceki sürüm ayrıca okunabilir", () => {
    const bos = kurKartlar({}).rozetler;
    expect(yeniRozetOzeti(bos)).toEqual({ toplam: 4, acik: 0 });
    const { rozetler } = kurKartlar({
      filmSayisi: 30, bolumSayisi: 30, diziSayisi: 6,
      bingoFullCards: 3,
      kesif: { not: 1, favori: 2, dortFavori: 4, arkadas: 1 },
    });
    const o = yeniRozetOzeti(rozetler);
    expect(o.toplam).toBe(4);
    const beklenen = rozetler.filter((r) => r.since === 4 && r.acik).length;
    expect(o.acik).toBe(beklenen);
    expect(o.acik).toBe(2);   // bingo_1 + bingo_3
    expect(yeniRozetOzeti(rozetler, 3).toplam).toBe(13);
    expect(yeniRozetOzeti(null)).toEqual({ toplam: 0, acik: 0 });
    // Eski surumde (1) "yeni" diye bir sey yok.
    expect(yeniRozetOzeti(rozetler, 1)).toEqual({ toplam: 0, acik: 0 });
  });

  test("ozet surum 2 ile: v2'nin 60 rozeti (kilitli kayit)", () => {
    const bos = kurKartlar({}).rozetler;
    expect(yeniRozetOzeti(bos, 2)).toEqual({ toplam: 60, acik: 0 });
    const { rozetler } = kurKartlar({ filmSayisi: 30, bolumSayisi: 30, diziSayisi: 6 });
    const o = yeniRozetOzeti(rozetler, 2);
    expect(o.toplam).toBe(60);
    expect(o.acik).toBe(rozetler.filter((r) => r.since === 2 && r.acik).length);
    expect(o.acik).toBeGreaterThanOrEqual(5);
  });

  test("izgara 'yeni' suzgeci: yalniz kataloga yeni eklenen kartlar, bolum sirasiyla", () => {
    const { kartlar } = kurKartlar({ filmSayisi: 5 });
    const dekore = kartlariDekorle(kartlar, {});
    const satirlar = izgaraSatirlari(dekore, "yeni", null);
    const kartSayisi = satirlar.filter((s) => s.tur === "rozetSatiri").reduce((n, s) => n + s.rozetler.length, 0);
    // v4: 4 Bingo kademesi tek aile kartında, Kilometre bölümünde görünür.
    expect(kartSayisi).toBe(1);
    expect(satirlar.filter((s) => s.tur === "baslik").map((s) => s.bolum)).toEqual(["kilometre"]);
    for (const s of satirlar.filter((x) => x.tur === "rozetSatiri")) {
      for (const k of s.rozetler) expect([k.id, k.yeniKatalog]).toEqual([k.id, true]);
    }
    // film ailesi (tamamen v1) listede YOK
    const hepsi = satirlar.filter((s) => s.tur === "rozetSatiri").flatMap((s) => s.rozetler);
    expect(hepsi[0].family).toBe("bingo");
    expect(hepsi.some((k) => k.family === "film")).toBe(false);
    // Bolum basliklari BOLUM_SIRA'da
    const { BOLUM_SIRA } = require("../components/badges/watchBadgeCatalog");
    const basliklar = satirlar.filter((s) => s.tur === "baslik").map((s) => s.bolum);
    expect(basliklar).toEqual(BOLUM_SIRA.filter((b) => basliklar.includes(b)));
    // Bilinmeyen suzgec "tumu" gibi davranir (eski surumle uyum).
    expect(izgaraSatirlari(dekore, "bilinmeyen", null).length).toBeGreaterThan(satirlar.length);
  });
});

describe("v2: takvim firsatlari", () => {
  const { takvimFirsatlari } = require("../components/badges/badgeInsights");

  const firsat = (simdi, kazanilmis = [], opts = {}) => {
    const { rozetler, setler } = kurKartlar({}, kazanilmis);
    const aile = gruplaAileler(rozetler);
    const muhurler = muhurleriHesapla([], { simdi, kazanilmis });
    return takvimFirsatlari(kartlariDekorle([...aile, ...muhurler, ...setler], {}), { simdi, ...opts });
  };

  test("15 Ekim: Cadilar (16 gun) ve Cuma 13 (13 Kasim, 29 gun) yaklasiyor, sirali", () => {
    // 2026-10-15 Persembe. Sonraki Cuma 13 = 2026-11-13.
    const f = firsat(an(2026, 10, 15));
    expect(f.map((x) => x.kart.id)).toEqual(["cadilar_gecesi", "cuma_13"]);
    expect(f.map((x) => x.gunKaldi)).toEqual([16, 29]);
    expect(f.every((x) => x.tur === "olay")).toBe(true);
    // Pencere disindakiler yok: 14 Subat (122 gun), yilbasi (77 gun), 1 Nisan, 4 Mayis.
  });

  test("gun gelince 0, ertesi gun listeden duser (bir yil sonrasi 45 gunluk pencerede degil)", () => {
    expect(firsat(an(2026, 10, 31))[0]).toMatchObject({ gunKaldi: 0 });
    expect(firsat(an(2026, 10, 31))[0].kart.id).toBe("cadilar_gecesi");
    const ertesi = firsat(an(2026, 11, 1));
    expect(ertesi.some((x) => x.kart.id === "cadilar_gecesi")).toBe(false);
  });

  test("KAZANILMIS olay listede yok (bir sonraki yili beklemek firsat degil)", () => {
    const f = firsat(an(2026, 10, 15), ["cadilar_gecesi"]);
    expect(f.map((x) => x.kart.id)).toEqual(["cuma_13"]);
  });

  test("yilbasi iki gunluk pencere: 31 Aralik ve 1 Ocak ikisi de 0, 30 Aralik 1", () => {
    const id = (simdi) => firsat(simdi).find((x) => x.kart.id === "yil_devrilirken");
    expect(id(an(2026, 12, 31)).gunKaldi).toBe(0);
    expect(id(an(2027, 1, 1)).gunKaldi).toBe(0);
    expect(id(an(2026, 12, 30)).gunKaldi).toBe(1);
    expect(id(an(2027, 1, 2))).toBeUndefined();         // pencere disi
  });

  test("Cuma 13 bugunse 0; yil sinirini asar (Aralik'ta bir sonraki: Agustos 2027)", () => {
    // 2026-11-13 Cuma
    const bugun = firsat(an(2026, 11, 13)).find((x) => x.kart.id === "cuma_13");
    expect(bugun.gunKaldi).toBe(0);
    // 2026-12-01'den sonra 2027-08-13: pencere 400 gun olsun.
    const uzak = firsat(an(2026, 12, 1), [], { pencere: 400 }).find((x) => x.kart.id === "cuma_13");
    expect(uzak.gunKaldi).toBe(255);
  });

  test("pencere ve limit uygulanir", () => {
    expect(firsat(an(2026, 10, 15), [], { pencere: 20 }).map((x) => x.kart.id)).toEqual(["cadilar_gecesi"]);
    expect(firsat(an(2026, 10, 15), [], { limit: 1 })).toHaveLength(1);
    expect(firsat(an(2026, 10, 15), [], { limit: 0 })).toEqual([]);
    expect(takvimFirsatlari(null)).toEqual([]);
  });

  test("donem muhuru YALNIZ son 30 gunde ve hala yetisebiliyorsa firsattir", () => {
    // Sonbahar 2026 30 Kasim'da biter. 15 Ekim'de 46 gun var → listede degil.
    expect(firsat(an(2026, 10, 15)).some((x) => x.tur === "muhur")).toBe(false);
    // 20 Kasim: 10 gun kaldi, 8 gun eksik (hic isaretleme yok) → 10+1 >= 8: yetisir.
    const f = firsat(an(2026, 11, 20));
    const muhur = f.find((x) => x.tur === "muhur");
    expect(muhur).toBeTruthy();
    expect(muhur.gunKaldi).toBe(10);
    expect(muhur.eksikGun).toBe(8);
    // 28 Kasim: 2 gun kaldi, 8 eksik → YETISMEZ → firsat degil (umut degil hayal kirikligi olurdu).
    expect(firsat(an(2026, 11, 28)).some((x) => x.tur === "muhur")).toBe(false);
  });

  test("ilk gun olaylar donem mührüyle birlikte en yakin once siralanir", () => {
    const f = firsat(an(2026, 11, 20));
    const gunler = f.map((x) => x.gunKaldi);
    expect([...gunler].sort((a, b) => a - b)).toEqual(gunler);
  });

  test("takvim kurallari watchScoring ile AYNI tarihleri kullanir", () => {
    // 31 Ekim (korku), 31 Aralik/1 Ocak, 14 Subat (romantik), 1 Nisan (komedi),
    // 4 Mayis (bilim kurgu), Cuma 13 (korku): katalog aciklamalari tarihi soyluyor.
    const { WATCH_BADGE_BY_ID } = require("../components/badges/watchBadgeCatalog");
    expect(WATCH_BADGE_BY_ID.cadilar_gecesi.descTr).toMatch(/31 Ekim/);
    expect(WATCH_BADGE_BY_ID.kirmizi_perde.descTr).toMatch(/14 Şubat/);
    expect(WATCH_BADGE_BY_ID.nisan_1.descTr).toMatch(/1 Nisan/);
    expect(WATCH_BADGE_BY_ID.mayis_4.descTr).toMatch(/4 Mayıs/);
    expect(WATCH_BADGE_BY_ID.cuma_13.descTr).toMatch(/Cuma 13/);
    expect(WATCH_BADGE_BY_ID.yil_devrilirken.descTr).toMatch(/31 Aralık ya da 1 Ocak/);
  });
});
