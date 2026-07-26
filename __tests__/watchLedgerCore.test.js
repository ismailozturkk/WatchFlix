// __tests__/watchLedgerCore.test.js
// Geri alinamazlik sozlesmesi: "puan dusebilir, Perde ve rozet dusmez."

const {
  bosLedger, normalizeLedger, tohumla, birlestir,
  kutlanacaklar, isaretleGorulmus, tohumlandiMi, LEDGER_SURUM,
  aktifligiGuncelle, rekorYukselt,
} = require("../utils/watchLedgerCore");

describe("normalizeLedger bozuk veriyi kurtarir", () => {
  test("bos/null/coplerde bos deftere duser", () => {
    for (const girdi of [null, undefined, 0, "", "metin", [], { v: 99 }]) {
      const l = normalizeLedger(girdi);
      expect(l.v).toBe(LEDGER_SURUM);
      expect(l.baseline).toBeNull();
      expect(l.earned.badgeIds).toEqual([]);
      expect(l.earned.perdeFloor).toBe(1);
      expect(l.seen).toEqual([]);
    }
  });

  test("string olmayan id'ler ayiklanir", () => {
    const l = normalizeLedger({ earned: { badgeIds: ["a", 5, null, { x: 1 }, "b"], perdeFloor: 7 }, seen: ["a", 3] });
    expect(l.earned.badgeIds).toEqual(["a", "b"]);
    expect(l.seen).toEqual(["a"]);
    expect(l.earned.perdeFloor).toBe(7);
  });

  test("gecersiz perdeFloor tabana cekilir, asla 0/negatif olmaz", () => {
    expect(normalizeLedger({ earned: { perdeFloor: 0 } }).earned.perdeFloor).toBe(1);
    expect(normalizeLedger({ earned: { perdeFloor: -9 } }).earned.perdeFloor).toBe(1);
    expect(normalizeLedger({ earned: { perdeFloor: "abc" } }).earned.perdeFloor).toBe(1);
    expect(normalizeLedger({ earned: { perdeFloor: 12.7 } }).earned.perdeFloor).toBe(12);
  });

  test("bozuk baseline null'a duser ama defteri comertmez", () => {
    expect(normalizeLedger({ baseline: "evet" }).baseline).toBeNull();
    const l = normalizeLedger({ baseline: { perde: "x", badgeIds: null, kare: -5 } });
    expect(l.baseline).toEqual({ kare: 0, perde: 1, badgeIds: [], seenAt: null });
  });
});

describe("sessiz tohumlama", () => {
  test("mevcut kullanici tum rozetlerini alir ama KUTLAMA tetiklenmez", () => {
    const acik = ["film_10", "film_50", "bolum_25", "tur_5"];
    const l = tohumla(bosLedger(), { badgeIds: acik, perde: 11, kare: 29765, seenAt: "2026-07-21T00:00:00Z" });
    expect(l.earned.badgeIds).toEqual(acik);
    expect(l.earned.perdeFloor).toBe(11);
    // Kritik: hepsi "gorulmus" sayilir -> 31 rozetlik konfeti yagmuru olmaz
    expect(kutlanacaklar(l)).toEqual([]);
    expect(l.baseline.badgeIds).toEqual(acik);
    expect(l.baseline.kare).toBe(29765);
  });

  test("bir kez tohumlanir, ikinci cagri defteri EZMEZ", () => {
    const ilk = tohumla(bosLedger(), { badgeIds: ["a"], perde: 5 });
    const ikinci = tohumla(ilk, { badgeIds: ["a", "b", "c"], perde: 20 });
    expect(ikinci).toEqual(ilk);
    expect(ikinci.earned.perdeFloor).toBe(5);
  });

  test("tohumlandiMi dogru raporlar", () => {
    expect(tohumlandiMi(bosLedger())).toBe(false);
    expect(tohumlandiMi(tohumla(bosLedger(), { badgeIds: [], perde: 1 }))).toBe(true);
  });

  test("hic verisi olmayan yeni kullanici da tohumlanir (bos baseline)", () => {
    const l = tohumla(bosLedger(), { badgeIds: [], perde: 1, kare: 0 });
    expect(tohumlandiMi(l)).toBe(true);
    expect(l.earned.badgeIds).toEqual([]);
  });
});

describe("geri alinamazlik: rozet dusmez", () => {
  const tohumlu = () => tohumla(bosLedger(), { badgeIds: ["film_10", "film_50"], perde: 6 });

  test("veri silinse bile kazanilmis rozet defterde kalir", () => {
    const { ledger } = birlestir(tohumlu(), { badgeIds: [], perde: 1 });
    expect(ledger.earned.badgeIds).toEqual(["film_10", "film_50"]);
  });

  test("yeni rozet kutlanacaklara girer", () => {
    const r = birlestir(tohumlu(), { badgeIds: ["film_10", "film_50", "bolum_25"], perde: 6 });
    expect(r.yeniRozetler).toEqual(["bolum_25"]);
    expect(kutlanacaklar(r.ledger)).toEqual(["bolum_25"]);
    expect(r.degisti).toBe(true);
  });

  test("ayni rozet iki kez kutlanmaz", () => {
    const bir = birlestir(tohumlu(), { badgeIds: ["bolum_25"], perde: 6 });
    const iki = birlestir(bir.ledger, { badgeIds: ["bolum_25"], perde: 6 });
    expect(iki.yeniRozetler).toEqual([]);
    expect(iki.degisti).toBe(false);
    expect(iki.ledger.earned.badgeIds.filter((x) => x === "bolum_25")).toHaveLength(1);
  });

  test("kutlama gosterilince seen'e yazilir ve tekrar cikmaz", () => {
    const r = birlestir(tohumlu(), { badgeIds: ["bolum_25"], perde: 6 });
    expect(kutlanacaklar(r.ledger)).toEqual(["bolum_25"]);
    const sonra = isaretleGorulmus(r.ledger, ["bolum_25"]);
    expect(kutlanacaklar(sonra)).toEqual([]);
    // Ikinci kez isaretlemek seen'i sismez
    expect(isaretleGorulmus(sonra, ["bolum_25"]).seen).toEqual(sonra.seen);
  });
});

describe("geri alinamazlik: Perde dusmez", () => {
  test("puan sifira dusse de perdeFloor korunur", () => {
    const l = tohumla(bosLedger(), { badgeIds: [], perde: 14, kare: 55000 });
    const r = birlestir(l, { badgeIds: [], perde: 1 });
    expect(r.ledger.earned.perdeFloor).toBe(14);
    expect(r.perdeAtladi).toBe(false);
    expect(r.degisti).toBe(false);
  });

  test("perde yukselince atlama bildirilir", () => {
    const l = tohumla(bosLedger(), { badgeIds: [], perde: 9 });
    const r = birlestir(l, { badgeIds: [], perde: 10 });
    expect(r.perdeAtladi).toBe(true);
    expect(r.oncekiPerde).toBe(9);
    expect(r.yeniPerde).toBe(10);
    expect(r.degisti).toBe(true);
  });

  test("art arda dusus-yukselis dogru raporlar", () => {
    let l = tohumla(bosLedger(), { badgeIds: [], perde: 5 });
    l = birlestir(l, { perde: 3 }).ledger;      // yanlislikla isaret geri alindi
    expect(l.earned.perdeFloor).toBe(5);
    const r = birlestir(l, { perde: 6 });        // gercek ilerleme
    expect(r.perdeAtladi).toBe(true);
    expect(r.oncekiPerde).toBe(5);               // 3'ten degil, tabandan
    expect(r.yeniPerde).toBe(6);
  });
});

describe("geri alinamazlik: Makara da dusmez", () => {
  // Makara kullanici icin ayri bir kavram degil, Perde etiketinin parcasi:
  // kart "Perde 20 · 3. Makara" yaziyor. O sayinin 2'ye dusmesi "Perde dusmez"
  // sozunu dogrudan ihlal ederdi.
  test("makaraFloor korunur", () => {
    const l = tohumla(bosLedger(), { badgeIds: [], perde: 20, makara: 3 });
    expect(l.earned.makaraFloor).toBe(3);
    const r = birlestir(l, { perde: 20, makara: 1 });
    expect(r.ledger.earned.makaraFloor).toBe(3);
    expect(r.degisti).toBe(false);
  });

  test("makara artisi AYRI bayrakla bildirilir, perdeAtladi ile karistirilmaz", () => {
    // Tek bayrak kullanmak tuketicide yanlis metin uretiyordu: zirvedeki
    // kullanicinin Perde'si degismedigi halde "Perde 20'e yukseldin" toast'i
    // basiliyordu.
    const l = tohumla(bosLedger(), { badgeIds: [], perde: 20, makara: 2 });
    const r = birlestir(l, { perde: 20, makara: 3 });
    expect(r.makaraAtladi).toBe(true);
    expect(r.perdeAtladi).toBe(false);
    expect(r.yeniMakara).toBe(3);
    expect(r.degisti).toBe(true);
    expect(r.ledger.earned.makaraFloor).toBe(3);
  });

  test("perde atlayinca makaraAtladi tetiklenmez", () => {
    const l = tohumla(bosLedger(), { badgeIds: [], perde: 9, makara: 0 });
    const r = birlestir(l, { perde: 10, makara: 0 });
    expect(r.perdeAtladi).toBe(true);
    expect(r.makaraAtladi).toBe(false);
  });

  test("eski defterde makaraFloor yoksa 0'a duser, bozulmaz", () => {
    const eski = { v: 1, baseline: { kare: 5, perde: 3, badgeIds: [], seenAt: null },
                   earned: { badgeIds: ["a"], perdeFloor: 3 }, seen: [] };
    const l = normalizeLedger(eski);
    expect(l.earned.makaraFloor).toBe(0);
    expect(l.earned.perdeFloor).toBe(3);
    expect(l.earned.badgeIds).toEqual(["a"]);
  });
});

describe("katalog genisleme korumasi (known)", () => {
  // Sessiz tohumlama defterin ILK kurulusunu koruyor. Katalog sonradan
  // buyudugunde ayni felaket ikinci kez oluyordu: 3 yillik kullaniciya 15 ara
  // kademe eklendiginde hepsi birden "yeni kazandin" diye patliyordu.

  test("tohumlama katalogun TAMAMINI bilir, sadece acik olanlari degil", () => {
    const l = tohumla(bosLedger(), { badgeIds: ["a"], tumIds: ["a", "b", "c"], perde: 3 });
    expect(l.known).toEqual(["a", "b", "c"]);
    expect(l.earned.badgeIds).toEqual(["a"]);
  });

  test("zaten hak edilen YENI rozet sessizce sahiplenilir, kutlanmaz", () => {
    const l = tohumla(bosLedger(), { badgeIds: ["a"], tumIds: ["a", "b"], perde: 3 });
    // Katalog "c" ile buyudu ve kullanici onu ZATEN hak ediyor.
    const r = birlestir(l, { badgeIds: ["a", "b", "c"], tumIds: ["a", "b", "c"], perde: 3 });
    expect(r.sessizler).toEqual(["c"]);
    expect(r.yeniRozetler).toEqual(["b"]);          // b katalogda zaten biliniyordu
    expect(r.ledger.earned.badgeIds).toContain("c"); // SAHIPLENILIR
    expect(kutlanacaklar(r.ledger)).toEqual(["b"]);  // ama kutlanmaz
    expect(r.ledger.known).toEqual(["a", "b", "c"]);
  });

  test("henuz hak edilmeyen yeni rozet, sonradan kazanilinca NORMAL kutlanir", () => {
    const l = tohumla(bosLedger(), { badgeIds: ["a"], tumIds: ["a", "b"], perde: 3 });
    // Katalog buyudu ama kullanici "c"yi hak etmiyor -> yalnizca known dolar.
    const bir = birlestir(l, { badgeIds: ["a"], tumIds: ["a", "b", "c"], perde: 3 });
    expect(bir.sessizler).toEqual([]);
    expect(bir.ledger.known).toEqual(["a", "b", "c"]);
    expect(bir.degisti).toBe(true);                 // known degisti -> diske yazilmali
    // Simdi gercekten kazaniyor.
    const iki = birlestir(bir.ledger, { badgeIds: ["a", "c"], tumIds: ["a", "b", "c"], perde: 3 });
    expect(iki.yeniRozetler).toEqual(["c"]);
    expect(kutlanacaklar(iki.ledger)).toEqual(["c"]);
  });

  test("v1 defteri (known yok) gocte HICBIR SEY emmez, sadece alani doldurur", () => {
    // Kritik: v1 defteri bugunku katalogla yazilmistir, dolayisiyla hicbiri
    // "yeni" degildir. Emseydik, kullanicinin o an gercekten kazandigi rozetin
    // kutlamasi goc aninda yutulurdu.
    const v1 = { v: 1, baseline: { kare: 100, perde: 3, badgeIds: ["a"], seenAt: null },
                 earned: { badgeIds: ["a"], perdeFloor: 3 }, seen: ["a"] };
    expect(normalizeLedger(v1).known).toBeNull();
    const r = birlestir(v1, { badgeIds: ["a", "b"], tumIds: ["a", "b"], perde: 3 });
    expect(r.sessizler).toEqual([]);
    expect(r.yeniRozetler).toEqual(["b"]);          // kutlamasi KORUNUR
    expect(kutlanacaklar(r.ledger)).toEqual(["b"]);
    expect(r.ledger.known).toEqual(["a", "b"]);
  });

  test("tumIds verilmezse davranis v1 ile birebir ayni kalir", () => {
    const l = tohumla(bosLedger(), { badgeIds: ["a"], tumIds: ["a", "b"], perde: 3 });
    const r = birlestir(l, { badgeIds: ["a", "z"], perde: 3 });
    expect(r.yeniRozetler).toEqual(["z"]);          // emilim yok
    expect(r.ledger.known).toEqual(["a", "b"]);     // known'a dokunulmaz
  });

  test("katalog degismediyse defter diske yazilmaz (bosuna I/O yok)", () => {
    const l = tohumla(bosLedger(), { badgeIds: ["a"], tumIds: ["a", "b"], perde: 3 });
    const r = birlestir(l, { badgeIds: ["a"], tumIds: ["a", "b"], perde: 3 });
    // `degisti === false` sarmalayicinin saveLedger'i atlamasini saglayan tek
    // sinyal; known'un icerik olarak ayni kalmasi da bunun gerekcesi.
    expect(r.degisti).toBe(false);
    expect(r.ledger.known).toEqual(["a", "b"]);
  });

  test("sessiz emilen rozet ikinci turda tekrar kutlanmaya calisilmaz", () => {
    const l = tohumla(bosLedger(), { badgeIds: ["a"], tumIds: ["a"], perde: 3 });
    const bir = birlestir(l, { badgeIds: ["a", "c"], tumIds: ["a", "c"], perde: 3 });
    const iki = birlestir(bir.ledger, { badgeIds: ["a", "c"], tumIds: ["a", "c"], perde: 3 });
    expect(iki.yeniRozetler).toEqual([]);
    expect(iki.sessizler).toEqual([]);
    expect(iki.degisti).toBe(false);
    expect(kutlanacaklar(iki.ledger)).toEqual([]);
    expect(iki.ledger.seen.filter((x) => x === "c")).toHaveLength(1);
  });
});

describe("aktiflik damgasi (gercek isaretleme ani)", () => {
  // Sinyal: toplam eser adedinin ARTMASI. Boylece hicbir yazma yoluna
  // dokunmadan (listItemsService / watchedTvService / toplu isaretleme)
  // "kullanici bugun bir sey isaretledi" tespit edilir.
  const tohumlu = (sayim) => tohumla(bosLedger(), { badgeIds: [], perde: 1, icerikSayisi: sayim });

  test("tohumlama GUN DAMGALAMAZ, yalnizca sayimi kurar", () => {
    // 500 filmi olan mevcut kullanicinin serisi sifirdan baslar: geriye donuk
    // aktiflik verisi YOK ve uydurmak tek durust olcutu kirletirdi.
    const l = tohumlu(500);
    expect(l.aktiflik.gunler).toEqual([]);
    expect(l.aktiflik.sonSayim).toBe(500);
  });

  test("sayim artinca bugun damgalanir", () => {
    const r = aktifligiGuncelle(tohumlu(500), { icerikSayisi: 501, bugun: "2026-07-15" });
    expect(r.yeniGun).toBe(true);
    expect(r.ledger.aktiflik.gunler).toEqual(["2026-07-15"]);
    expect(r.ledger.aktiflik.sonSayim).toBe(501);
  });

  test("ayni gun ikinci isaretleme yeni gun EKLEMEZ", () => {
    let l = aktifligiGuncelle(tohumlu(500), { icerikSayisi: 501, bugun: "2026-07-15" }).ledger;
    const r = aktifligiGuncelle(l, { icerikSayisi: 505, bugun: "2026-07-15" });
    expect(r.yeniGun).toBe(false);
    expect(r.ledger.aktiflik.gunler).toEqual(["2026-07-15"]);
    expect(r.ledger.aktiflik.sonSayim).toBe(505);
  });

  test("toplu isaretleme (20 bolum tek dokunus) TEK gun damgalar", () => {
    const r = aktifligiGuncelle(tohumlu(100), { icerikSayisi: 120, bugun: "2026-07-15" });
    expect(r.ledger.aktiflik.gunler).toEqual(["2026-07-15"]);
  });

  test("sayim DUSERSE damgalamaz ama sonSayim guncellenir", () => {
    // Guncellemezsek isaretini geri alip yeniden basan kullanici bir daha hic
    // artis uretemez ve serisi kalici olarak donar.
    const r = aktifligiGuncelle(tohumlu(500), { icerikSayisi: 499, bugun: "2026-07-15" });
    expect(r.yeniGun).toBe(false);
    expect(r.ledger.aktiflik.gunler).toEqual([]);
    expect(r.ledger.aktiflik.sonSayim).toBe(499);
    // ...ve sonraki gercek isaretleme yine yakalanir
    const r2 = aktifligiGuncelle(r.ledger, { icerikSayisi: 500, bugun: "2026-07-16" });
    expect(r2.yeniGun).toBe(true);
  });

  test("degisiklik yoksa defter DOKUNULMAZ (bosuna disk I/O yok)", () => {
    const r = aktifligiGuncelle(tohumlu(500), { icerikSayisi: 500, bugun: "2026-07-15" });
    expect(r.degisti).toBe(false);
    expect(r.yeniGun).toBe(false);
  });

  test("ilk olcum (-1) damgalamaz: o an ne yapildigi BILINMIYOR", () => {
    const r = aktifligiGuncelle(bosLedger(), { icerikSayisi: 40, bugun: "2026-07-15" });
    expect(r.yeniGun).toBe(false);
    expect(r.ledger.aktiflik.sonSayim).toBe(40);
  });

  test("sonSayim 0 ile -1 KARISTIRILMAZ", () => {
    // 0 gercek bir sayimdir (hic icerigi olmayan kullanici) ve ilk isaretlemesi
    // seriyi baslatmali; -1 ise "hic olculmedi".
    const l = tohumlu(0);
    expect(l.aktiflik.sonSayim).toBe(0);
    const r = aktifligiGuncelle(l, { icerikSayisi: 1, bugun: "2026-07-15" });
    expect(r.yeniGun).toBe(true);
  });

  test("eksik/bozuk girdide sessizce gecer, atmaz", () => {
    for (const girdi of [{}, { icerikSayisi: 5 }, { bugun: "2026-07-15" }, { icerikSayisi: "cop", bugun: "x" }]) {
      const r = aktifligiGuncelle(tohumlu(1), girdi);
      expect(r.yeniGun).toBe(false);
    }
  });

  test("pencere budanir ama sonSayim korunur", () => {
    let l = tohumlu(0);
    for (let i = 1; i <= 8; i++) {
      l = aktifligiGuncelle(l, { icerikSayisi: i, bugun: `2026-07-${String(i).padStart(2, "0")}`, tut: 5 }).ledger;
    }
    expect(l.aktiflik.gunler).toHaveLength(5);
    expect(l.aktiflik.gunler[0]).toBe("2026-07-04");
    expect(l.aktiflik.sonSayim).toBe(8);
  });

  test("birlestir aktifligi DUSURMEZ", () => {
    const l = aktifligiGuncelle(tohumlu(1), { icerikSayisi: 2, bugun: "2026-07-15" }).ledger;
    const r = birlestir(l, { badgeIds: ["a"], perde: 2 });
    expect(r.ledger.aktiflik.gunler).toEqual(["2026-07-15"]);
    expect(r.ledger.aktiflik.sonSayim).toBe(2);
  });

  test("v1 defterinde aktiflik alani yoksa bos kurulur, bozulmaz", () => {
    const v1 = { v: 1, baseline: { kare: 5, perde: 3, badgeIds: [], seenAt: null },
                 earned: { badgeIds: ["a"], perdeFloor: 3 }, seen: [] };
    const l = normalizeLedger(v1);
    expect(l.aktiflik).toEqual({ gunler: [], sonSayim: -1, rekorGun: 0, rekorHafta: 0 });
  });
});

describe("rekor MONOTON — mevcut seri duser, rekor dusmez", () => {
  test("rekor yalniz yukselir", () => {
    const l = tohumla(bosLedger(), { badgeIds: [], perde: 1, icerikSayisi: 0 });
    const bir = rekorYukselt(l, { rekorGun: 12, rekorHafta: 5 });
    expect(bir.degisti).toBe(true);
    expect(bir.ledger.aktiflik).toEqual(expect.objectContaining({ rekorGun: 12, rekorHafta: 5 }));
    // Seri bozuldu, mevcut degerler dustu -> rekor KORUNUR
    const iki = rekorYukselt(bir.ledger, { rekorGun: 1, rekorHafta: 1 });
    expect(iki.degisti).toBe(false);
    expect(iki.ledger.aktiflik.rekorGun).toBe(12);
    expect(iki.ledger.aktiflik.rekorHafta).toBe(5);
  });

  test("bozuk deger rekoru bozmaz", () => {
    const l = rekorYukselt(bosLedger(), { rekorGun: 9, rekorHafta: 4 }).ledger;
    const r = rekorYukselt(l, { rekorGun: "cop", rekorHafta: -5 });
    expect(r.ledger.aktiflik.rekorGun).toBe(9);
    expect(r.ledger.aktiflik.rekorHafta).toBe(4);
  });

  test("rekor yukseltmek defterin geri kalanina dokunmaz", () => {
    const l = tohumla(bosLedger(), { badgeIds: ["a"], tumIds: ["a", "b"], perde: 7, icerikSayisi: 3 });
    const r = rekorYukselt(l, { rekorGun: 4, rekorHafta: 2 });
    expect(r.ledger.earned).toEqual(l.earned);
    expect(r.ledger.seen).toEqual(l.seen);
    expect(r.ledger.known).toEqual(l.known);
    expect(r.ledger.aktiflik.sonSayim).toBe(3);
  });
});

describe("saflik", () => {
  test("girdi defteri MUTASYONA UGRAMAZ", () => {
    const l = tohumla(bosLedger(), { badgeIds: ["a"], perde: 4 });
    const kopya = JSON.parse(JSON.stringify(l));
    birlestir(l, { badgeIds: ["a", "b"], perde: 9 });
    isaretleGorulmus(l, ["a"]);
    expect(l).toEqual(kopya);
  });

  test("ayni girdi ayni cikti", () => {
    const l = tohumla(bosLedger(), { badgeIds: ["a"], perde: 4 });
    const bir = birlestir(l, { badgeIds: ["a", "b"], perde: 5 });
    const iki = birlestir(l, { badgeIds: ["a", "b"], perde: 5 });
    expect(bir.ledger).toEqual(iki.ledger);
  });

  test("tekrarli id'ler tekillestirilir", () => {
    const r = birlestir(bosLedger(), { badgeIds: ["a", "a", "b", "a"], perde: 1 });
    expect(r.ledger.earned.badgeIds).toEqual(["a", "b"]);
    expect(r.yeniRozetler).toEqual(["a", "b"]);
  });
});
