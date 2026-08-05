// __tests__/watchBadgeCatalog.test.js
// Rozet katalogunun SOZLESMESI: nadirlik kotalari, ikon ciftleri, tek-gecis
// performans kurali ve kademeli aile mantigi.

const {
  WATCH_BADGES, WATCH_BADGE_BY_ID, WATCH_BADGE_IDS, BOLUM, BOLUM_BASLIK,
  evaluateWatchBadges, gruplaAileler, badgeAd, badgeAciklama, formatBadgeDeger,
  formatBadgeAralik, sureBirimiBul, SURE_BIRIMLERI, SURE_BIRIM_VARSAYILAN,
} = require("../components/badges/watchBadgeCatalog");
const { RARITY_ORDER } = require("../theme/badgeTokens");
// SDK 57'de expo artik @expo/vector-icons'i kendi bagimliligi olarak tasimiyor;
// paket dogrudan bagimlilik oldu ve kokte duruyor (eskiden expo/node_modules
// altinda ic ice cozuluyordu).
const IONICONS = require("@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json");

const sayimlar = () => WATCH_BADGES.reduce((acc, b) => {
  acc[b.rarity] = (acc[b.rarity] || 0) + 1; return acc;
}, {});

describe("katalog butunlugu", () => {
  test("81 rozet ve benzersiz id", () => {
    expect(WATCH_BADGES).toHaveLength(81);
    expect(new Set(WATCH_BADGES.map((b) => b.id)).size).toBe(81);
    expect(Object.keys(WATCH_BADGE_BY_ID)).toHaveLength(81);
  });

  test("AILE TAVANI 5 KADEME ve tier'lar 1'den ARDISIK", () => {
    // Tavan 5: altinci kademe `kademeSekli`nin bes sekil/renk basamagina
    // sigmaz, iki kademe ayni silueti paylasir ve merdiven okunamaz olur.
    // Ardisiklik sart: bir tier atlanirsa `gruplaAileler` siralamasi ve
    // `kademeSekli` oran hesabi sessizce kayar.
    const aileler = WATCH_BADGES.reduce((acc, b) => {
      if (b.family) (acc[b.family] = acc[b.family] || []).push(b.tier);
      return acc;
    }, {});
    expect(Object.keys(aileler)).toHaveLength(13);
    for (const [ad, tierler] of Object.entries(aileler)) {
      const sirali = [...tierler].sort((a, b) => a - b);
      expect([ad, sirali.length]).toEqual([ad, expect.any(Number)]);
      expect(sirali.length).toBeGreaterThanOrEqual(3);
      expect(sirali.length).toBeLessThanOrEqual(5);          // TAVAN
      // 1..n ardisik, tekrarsiz
      expect([ad, sirali]).toEqual([ad, sirali.map((_, i) => i + 1)]);
    }
  });

  test("kademe sayisi olcutun cozunurluguyle uyumlu (aile uzunluklari)", () => {
    const uzunluk = (fam) => WATCH_BADGES.filter((b) => b.family === fam).length;
    // Tek gunun icinde gecen olcutler kisa: 8 filmin/22 bolumun ustu izleme
    // degil isaretleme davranisi olurdu.
    expect(uzunluk("maraton")).toBe(3);
    expect(uzunluk("tekOturus")).toBe(3);
    // Yil ici ay sayisi 12'de doyar, uzun metraj ikiye katlanarak 100'e gider.
    expect(uzunluk("ay")).toBe(4);
    expect(uzunluk("uzunMetraj")).toBe(4);
    // Genis araliktaki olcutler tam merdiven kullanir.
    for (const fam of ["film", "bolum", "final", "sure", "seri", "gun", "tur", "yil", "perde"]) {
      expect([fam, uzunluk(fam)]).toEqual([fam, 5]);
    }
  });

  test("WATCH_BADGE_IDS katalogun TAMAMINI verir (defter korumasi buna dayanir)", () => {
    // Defterin katalog genisleme korumasi bu listeyi okur; eksik kalirsa
    // eksik kalan id'ler mevcut kullanicida kutlama seli uretir.
    expect(WATCH_BADGE_IDS).toHaveLength(WATCH_BADGES.length);
    expect([...WATCH_BADGE_IDS].sort()).toEqual(WATCH_BADGES.map((b) => b.id).sort());
  });

  test("her rozetin zorunlu alanlari dolu", () => {
    for (const b of WATCH_BADGES) {
      expect(typeof b.id).toBe("string");
      expect(b.tr && b.en && b.descTr && b.descEn).toBeTruthy();
      expect(typeof b.getProgress).toBe("function");
      expect(typeof b.isUnlocked).toBe("function");
      expect(b.target).toBeGreaterThan(0);
      expect(RARITY_ORDER).toContain(b.rarity);
      expect(Object.values(BOLUM)).toContain(b.section);
    }
  });

  test("her bolumun basligi var ve bos bolum kalmiyor", () => {
    // `muhur` ve `set` bolumlerini KATALOG doldurmaz — kartlari calisma aninda
    // uretiliyor (seasonSeals / badgeSets). Ikisi de __tests__/badgeMeta.test.js
    // tarafindan ayrica kilitleniyor; burada yalnizca baslik butunlugu aranir.
    const CALISMA_ANI = new Set([BOLUM.MUHUR, BOLUM.SET]);
    const kullanilan = new Set(WATCH_BADGES.map((b) => b.section));
    for (const s of Object.values(BOLUM)) {
      expect(BOLUM_BASLIK[s]).toBeDefined();
      expect(BOLUM_BASLIK[s].tr && BOLUM_BASLIK[s].en).toBeTruthy();
      expect([s, kullanilan.has(s) || CALISMA_ANI.has(s)]).toEqual([s, true]);
    }
    // Katalogdaki her rozetin bolumu BOLUM icinde olmali (yazim hatasi bir
    // rozeti isimsiz bir bolume dusurmesin).
    for (const s of kullanilan) expect(Object.values(BOLUM)).toContain(s);
  });
});

describe("nadirlik kotalari (rozet enflasyonuna karsi)", () => {
  test("dagilim 12 common / 31 uncommon / 27 rare / 8 epic / 3 legendary", () => {
    // Dort tekil rozet aileye cevrilip (uzun metraj, ay, maraton, tek oturus)
    // alti "seni taniyoruz" rozeti eklenince kaydi. Medyan uncommon KALDI —
    // profil mor duvara donmuyor (asagidaki test kilitliyor).
    expect(sayimlar()).toEqual({ common: 12, uncommon: 31, rare: 27, epic: 8, legendary: 3 });
  });

  test("LEGENDARY KOTASI = 3 ve ucu de gercekten ZIRVE hedefi", () => {
    // Kota 2'den 3'e bilerek cikti: film/bolum aileleri 5 kademeye uzayinca
    // zirve 500 filmden 2.000 filme tasindi ve film_500 epic'e indi. Yeni iki
    // zirve kabaca ESIT emek istiyor (2.000 × 165 ≈ 330k Kare, 10.000 × 37 ≈
    // 370k Kare); birini legendary yapip otekini epic birakmak bir izleme
    // bicimini odullendirip digerini cezalandirmak olurdu.
    const efsane = WATCH_BADGES.filter((b) => b.rarity === "legendary");
    expect(efsane.map((b) => b.id).sort()).toEqual(["bolum_10000", "film_2000", "perde_20"]);
    // Ucu de kendi ailesinin SON kademesi olmali — legendary "zirve" demek.
    for (const b of efsane) {
      if (!b.family) continue;
      const aile = WATCH_BADGES.filter((x) => x.family === b.family);
      expect(b.tier).toBe(Math.max(...aile.map((x) => x.tier)));
    }
    // Eski zirve artik zirve degil.
    expect(WATCH_BADGE_BY_ID.film_500.rarity).toBe("epic");
  });

  test("film ve bolum aileleri 5 kademeli ve id'ler hedeflerini DOGRU soyluyor", () => {
    // Esikler USTE eklendi, aradakiler degistirilmedi: film_150 gercekten 150.
    // Boylece ne id yalan soyluyor ne de kazanilmis rozet kayiyor.
    const hedefler = (fam) => WATCH_BADGES.filter((b) => b.family === fam)
      .sort((a, b) => a.tier - b.tier).map((b) => b.target);
    expect(hedefler("film")).toEqual([10, 50, 150, 500, 2000]);
    expect(hedefler("bolum")).toEqual([25, 100, 500, 2000, 10000]);
    for (const b of WATCH_BADGES) {
      const m = /^(film|bolum)_(\d+)$/.exec(b.id);
      if (m) expect(b.target).toBe(Number(m[2]));
    }
  });

  test("FINAL ailesi 1→100 dizi, zirve 'Arsiv Kapatici'", () => {
    const final = WATCH_BADGES.filter((b) => b.family === "final").sort((a, b) => a.tier - b.tier);
    expect(final.map((b) => b.target)).toEqual([1, 10, 25, 50, 100]);
    expect(final.map((b) => b.id)).toEqual(["final_1", "final_10", "final_25", "final_50", "final_100"]);
    const zirve = final[final.length - 1];
    expect(zirve.target).toBe(100);
    expect(zirve.tr).toBe("Arşiv Kapatıcı");
    expect(final.every((b) => b.getProgress({ tamamlananDizi: 999 }) === 999)).toBe(true);
  });

  test("TUR ailesi 3-6-9-12-20, zirve 'Butun Raflar' (5 kademe)", () => {
    const tur = WATCH_BADGES.filter((b) => b.family === "tur").sort((a, b) => a.tier - b.tier);
    expect(tur.map((b) => b.target)).toEqual([3, 6, 9, 12, 20]);
    // Ilk dort adim 3'er, zirve sicramasi en buyuk (katalogun genel deseni).
    const adimlar = tur.slice(1).map((b, i) => b.target - tur[i].target);
    expect(adimlar).toEqual([3, 3, 3, 8]);
    expect(adimlar[adimlar.length - 1]).toBe(Math.max(...adimlar));
    expect(tur[tur.length - 1].tr).toBe("Bütün Raflar");
    expect(tur[tur.length - 1].id).toBe("tur_20");
    // Zirve 20 ULASILABILIR: turSayaci en fazla 21 anahtar tutar (20 kanonik
    // id + taninmayan adlarin dustugu tek "other" kovasi).
    const { GENRE_IDS } = require("../utils/genreCanon");
    expect(GENRE_IDS.length).toBe(20);
    // 5 kademeye sigmak icin tur_15 kaldirildi — ustteki id artik katalogda yok.
    expect(WATCH_BADGE_BY_ID.tur_15).toBeUndefined();
  });

  test("GUN ailesi 25-50-100-200-500, zirve 500 (5 kademe)", () => {
    const gun = WATCH_BADGES.filter((b) => b.family === "gun").sort((a, b) => a.tier - b.tier);
    expect(gun.map((b) => b.target)).toEqual([25, 50, 100, 200, 500]);
    expect(gun.map((b) => b.id)).toEqual(["gun_25", "gun_50", "gun_100", "gun_200", "gun_500"]);
    // gun_400 kaldirildi (500'e cok yakindi, merdiveni en az bozan esikti).
    expect(WATCH_BADGE_BY_ID.gun_400).toBeUndefined();
    // Hepsi ayni ham alani okur.
    for (const b of gun) expect(b.getProgress({ gunSayisi: 777 })).toBe(777);
  });

  test("UZUN METRAJ ailesi 10-25-50-100 (ikiye katlanan merdiven)", () => {
    const um = WATCH_BADGES.filter((b) => b.family === "uzunMetraj").sort((a, b) => a.tier - b.tier);
    expect(um.map((b) => b.target)).toEqual([10, 25, 50, 100]);
    expect(um[0].id).toBe("uzun_metraj");     // eski tekil id ZIRVEDE degil TABANDA kaldi
    for (const b of um) expect(b.getProgress({ uzunMetraj: 42 })).toBe(42);
    // Sure turevi, tarih turevi DEGIL -> zirve epic olabilir.
    expect(um[um.length - 1].rarity).toBe("epic");
  });

  test("AY ailesi 3-6-9-12, zirve eski 'ay_12' id'siyle AYNI", () => {
    const ay = WATCH_BADGES.filter((b) => b.family === "ay").sort((a, b) => a.tier - b.tier);
    expect(ay.map((b) => b.target)).toEqual([3, 6, 9, 12]);
    expect(ay[ay.length - 1].id).toBe("ay_12");   // kazanilmis rozet kaymaz
    for (const b of ay) expect(b.getProgress({ enCokAyliYil: 7 })).toBe(7);
  });

  test("MARATON ve TEK OTURUS aileleri tek gunun icinde kalir", () => {
    const mar = WATCH_BADGES.filter((b) => b.family === "maraton").sort((a, b) => a.tier - b.tier);
    expect(mar.map((b) => b.target)).toEqual([3, 5, 8]);
    expect(mar[0].id).toBe("maraton_3film");
    for (const b of mar) expect(b.getProgress({ maxGunFilm: 4 })).toBe(4);

    const tek = WATCH_BADGES.filter((b) => b.family === "tekOturus").sort((a, b) => a.tier - b.tier);
    // Gercek sezon uzunluklari: kisa streaming (8) -> yarim network (13) -> tam (22)
    expect(tek.map((b) => b.target)).toEqual([8, 13, 22]);
    expect(tek[0].id).toBe("tek_oturusta");
    for (const b of tek) expect(b.getProgress({ tekOturusta: 9 })).toBe(9);
  });

  test("SURE ailesi toplam ekran suresini DAKIKA olarak olcer, kademe = takvim birimi", () => {
    // Hedef ham dakika: 1 gun = 1.440 dk. Kademeler 1 hafta → 1 yil.
    const sure = WATCH_BADGES.filter((b) => b.family === "sure").sort((a, b) => a.tier - b.tier);
    expect(sure.map((b) => b.id)).toEqual(["sure_hafta", "sure_ay", "sure_3ay", "sure_6ay", "sure_yil"]);
    expect(sure.map((b) => b.target)).toEqual([10080, 43200, 129600, 259200, 525600]);
    // Hepsi ayni ham alani okur (etkinDakikaToplam) — puanla ayni birim.
    for (const b of sure) expect(b.getProgress({ etkinDakikaToplam: 999999 })).toBe(999999);
    // Zirve = 1 yil = 365 gun ekran suresi (kullanici istegi).
    expect(WATCH_BADGE_BY_ID.sure_yil.target).toBe(365 * 24 * 60);
  });

  test("SURE zirvesi film/bolum zirvesiyle ayni OLCEKTE (ne ucuz ne imkansiz)", () => {
    // etkinDakikaToplam hem film hem bolum dakikasini toplar. 1 yil ekran suresi,
    // ~5.256 film ya da ~12.500 bolume denk — film_2000/bolum_10000 komsulugu.
    const yil = WATCH_BADGE_BY_ID.sure_yil.target;                 // dakika
    const filmDk = WATCH_BADGE_BY_ID.film_2000.target * 100;       // ort etkin dk
    const bolumDk = WATCH_BADGE_BY_ID.bolum_10000.target * 42;
    expect(yil).toBeGreaterThan(Math.min(filmDk, bolumDk));        // en az biri kadar zor
    expect(yil).toBeLessThan(filmDk + bolumDk);                    // ama ikisinin toplami kadar degil
  });

  test("iki zirve kabaca ESIT emek istiyor (bir izleme bicimi kayrilmiyor)", () => {
    // Ortalama deger: 1 film ≈ 165 Kare, 1 bolum ≈ 37 Kare (WatchLevelCard).
    const film = WATCH_BADGE_BY_ID.film_2000.target * 165;
    const bolum = WATCH_BADGE_BY_ID.bolum_10000.target * 37;
    expect(Math.max(film, bolum) / Math.min(film, bolum)).toBeLessThan(1.25);
  });

  test("medyan uncommon (profil mor duvara donmez)", () => {
    const sirali = WATCH_BADGES.map((b) => RARITY_ORDER.indexOf(b.rarity)).sort((a, b) => a - b);
    expect(RARITY_ORDER[sirali[Math.floor(sirali.length / 2)]]).toBe("uncommon");
  });

  test("KIDEM ailesi tarih tavaninin DISINDA — cunku sahtelenemez", () => {
    // `hesapYili` Firebase Auth'un metadata.creationTime'indan gelir ve onu
    // SUNUCU yazar. Katalogdaki tarih tavani, kullanicinin kendi girdigi izleme
    // tarihinin uydurulabilir olmasindan dogar; kidem o gerekceye tabi degildir.
    const kidem = WATCH_BADGES.filter((b) => b.section === BOLUM.KIDEM);
    expect(kidem.map((b) => b.id)).toEqual(["yil_1", "yil_2", "yil_3", "yil_5", "yil_10"]);
    expect(kidem.every((b) => b.family === "yil")).toBe(true);
    // Ust kademeler rare'i ASIYOR — testin varlik sebebi bu.
    expect(kidem.find((b) => b.id === "yil_5").rarity).toBe("epic");
    expect(kidem.find((b) => b.id === "yil_10").rarity).toBe("epic");
    // ...ama legendary kotasina dokunmuyor.
    expect(kidem.some((b) => b.rarity === "legendary")).toBe(false);
  });

  test("TARIH TUREVI ROZET TAVANI = rare", () => {
    // Kullanicinin kendi girdigi tarihten turer -> uydurulabilir -> epic/legendary olamaz.
    const tarihTuremli = new Set([
      "seri_3", "seri_7", "seri_21", "seri_30", "seri_60",
      "gun_25", "gun_50", "gun_100", "gun_200", "gun_500",
      "ay_3", "ay_6", "ay_9", "ay_12",
      "maraton_3film", "maraton_5film", "maraton_8film",
      "tek_oturusta", "tek_oturusta_13", "tek_oturusta_22", "sadik_izleyici",
      "cadilar_gecesi", "yil_devrilirken", "kirmizi_perde", "yaz_sezonu", "kis_kampi",
      "gizli_cift_perde", "gizli_geri_donus",
      // Yeni "seni taniyoruz" rozetlerinin tarih bileseni olanlari
      "gizli_uc_gece", "gizli_dort_mevsim", "gizli_yol_arkadasi",
    ]);
    for (const b of WATCH_BADGES) {
      if (!tarihTuremli.has(b.id)) continue;
      expect(RARITY_ORDER.indexOf(b.rarity)).toBeLessThanOrEqual(RARITY_ORDER.indexOf("rare"));
    }
  });
});

describe("ikon cifleri gercekten var", () => {
  test("her icon ve iconSolid Ionicons glyphmap'inde mevcut", () => {
    // AppIcon taninmayan isimde kirmizi uyari ucgeni basiyor; hatali bir isim
    // sessizce kullaniciya gider. Bu test o yolu kapatir.
    const eksik = [];
    for (const b of WATCH_BADGES) {
      if (!(b.icon in IONICONS)) eksik.push(`${b.id}.icon=${b.icon}`);
      if (!(b.iconSolid in IONICONS)) eksik.push(`${b.id}.iconSolid=${b.iconSolid}`);
    }
    expect(eksik).toEqual([]);
  });

  test("iconSolid otomatik turetilmiyor, elle yazilmis", () => {
    for (const b of WATCH_BADGES) {
      expect(b.icon.endsWith("-outline")).toBe(true);
      expect(b.iconSolid.endsWith("-outline")).toBe(false);
    }
  });
});

describe("performans sozlesmesi", () => {
  test("hicbir getProgress liste taramaz — yalniz stats okur", () => {
    // stats'i Proxy ile sarip HANGI alanlarin okundugunu izliyoruz. Bir rozet
    // movies/shows gibi bir koleksiyon isterse burada yakalanir.
    const okunan = new Set();
    const sahteStats = new Proxy({ turSayaci: new Map() }, {
      get(t, k) {
        if (typeof k === "string") okunan.add(k);
        if (k === "turSayaci") return t.turSayaci;
        return 0;
      },
    });
    for (const b of WATCH_BADGES) expect(() => b.getProgress(sahteStats)).not.toThrow();
    for (const yasak of ["movies", "shows", "listItems", "listItemsTv", "seasons"]) {
      expect(okunan.has(yasak)).toBe(false);
    }
    expect(okunan.size).toBeGreaterThan(10);
  });

  test("52 rozetin tamami 1 ms altinda degerlendirilir", () => {
    const stats = { filmSayisi: 300, bolumSayisi: 1500, perde: 12, turSayaci: new Map([["horror", 30]]) };
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < 100; i++) evaluateWatchBadges(stats, []);
    const msPerCall = Number(process.hrtime.bigint() - t0) / 1e6 / 100;
    expect(msPerCall).toBeLessThan(1);
  });
});

describe("degerlendirme", () => {
  const bosStats = { turSayaci: new Map() };

  test("bos veride sadece hicbir rozet acik degil", () => {
    const r = evaluateWatchBadges(bosStats, []);
    expect(r.filter((b) => b.acik)).toHaveLength(0);
    expect(r.every((b) => b.oran === 0)).toBe(true);
  });

  test("ilerleme hedefte kirpilir, oran 0..1", () => {
    const r = evaluateWatchBadges({ ...bosStats, filmSayisi: 99999 }, []);
    const f10 = r.find((b) => b.id === "film_10");
    expect(f10.ilerleme).toBe(10);
    expect(f10.oran).toBe(1);
    expect(r.every((b) => b.oran >= 0 && b.oran <= 1)).toBe(true);
  });

  test("ledger uyeligi rozeti HER ZAMAN acik tutar (geri alinamazlik)", () => {
    const r = evaluateWatchBadges(bosStats, ["film_500"]);
    expect(r.find((b) => b.id === "film_500").acik).toBe(true);
    // ...ama ilerleme gercek veriyi gosterir, sahte doldurulmaz
    expect(r.find((b) => b.id === "film_500").ilerleme).toBe(0);
  });

  test("cift_kariyer iki kosulu birden ister", () => {
    const sadecePerde = evaluateWatchBadges({ ...bosStats, perde: 12, oyunSeviye: 3 }, []);
    expect(sadecePerde.find((b) => b.id === "cift_kariyer").acik).toBe(false);
    const ikisi = evaluateWatchBadges({ ...bosStats, perde: 12, oyunSeviye: 10 }, []);
    expect(ikisi.find((b) => b.id === "cift_kariyer").acik).toBe(true);
  });

  test("tur rozetleri turSayaci Map'inden okur", () => {
    const r = evaluateWatchBadges({ ...bosStats, turSayaci: new Map([["horror", 25]]) }, []);
    expect(r.find((b) => b.id === "korku_25").acik).toBe(true);
    expect(r.find((b) => b.id === "animasyon_40").acik).toBe(false);
  });
});

describe("kesisim rozetleri: TEK sayac buyuterek alinamaz", () => {
  const bos = { turSayaci: new Map() };
  const acik = (id, stats) =>
    evaluateWatchBadges({ ...bos, ...stats }, []).find((b) => b.id === id).acik;

  test("cift_dunya iki izleme bicimini BIRDEN ister", () => {
    expect(acik("gizli_cift_dunya", { filmSayisi: 5000 })).toBe(false);
    expect(acik("gizli_cift_dunya", { bolumSayisi: 50000 })).toBe(false);
    expect(acik("gizli_cift_dunya", { filmSayisi: 249, bolumSayisi: 999 })).toBe(false);
    expect(acik("gizli_cift_dunya", { filmSayisi: 250, bolumSayisi: 1000 })).toBe(true);
  });

  test("uc_gece ucunu de sayar, tekrarlar sayilmaz", () => {
    // Her mevsimsel sayac 1'e KIRPILIR: 40 cadilar gecesi isareti tek basina
    // rozeti acamaz, ucunun de ayri ayri olmasi gerekir.
    expect(acik("gizli_uc_gece", { cadilar: 40 })).toBe(false);
    expect(acik("gizli_uc_gece", { cadilar: 1, yilDevri: 1 })).toBe(false);
    expect(acik("gizli_uc_gece", { cadilar: 1, yilDevri: 1, sevgililer: 1 })).toBe(true);
  });

  test("dort_mevsim yaz VE kis ister", () => {
    expect(acik("gizli_dort_mevsim", { yazGun: 99 })).toBe(false);
    expect(acik("gizli_dort_mevsim", { yazGun: 10, kisGun: 9 })).toBe(false);
    expect(acik("gizli_dort_mevsim", { yazGun: 10, kisGun: 10 })).toBe(true);
  });

  test("yol_arkadasi kidem VE gercek kullanim ister", () => {
    expect(acik("gizli_yol_arkadasi", { hesapYili: 9 })).toBe(false);      // sadece beklemek yetmez
    expect(acik("gizli_yol_arkadasi", { gunSayisi: 900 })).toBe(false);    // sadece yogunluk yetmez
    expect(acik("gizli_yol_arkadasi", { hesapYili: 2, gunSayisi: 200 })).toBe(true);
  });

  test("alfabe_tam mevcut gizli_alfabe'nin USTUNDE bir esik", () => {
    expect(WATCH_BADGE_BY_ID.gizli_alfabe_tam.target).toBeGreaterThan(
      WATCH_BADGE_BY_ID.gizli_alfabe.target,
    );
    expect(acik("gizli_alfabe_tam", { harfSayisi: 23 })).toBe(false);
    expect(acik("gizli_alfabe_tam", { harfSayisi: 24 })).toBe(true);
  });

  test("dizi_100 katalogda diziSayisi okuyan TEK rozet", () => {
    const okuyan = WATCH_BADGES.filter((b) => {
      let gordu = false;
      const proxy = new Proxy({ turSayaci: new Map() }, {
        get(t, k) {
          if (k === "diziSayisi") gordu = true;
          if (k === "turSayaci") return t.turSayaci;
          return 0;
        },
      });
      b.getProgress(proxy);
      return gordu;
    });
    expect(okuyan.map((b) => b.id)).toEqual(["dizi_100"]);
    expect(acik("dizi_100", { diziSayisi: 100 })).toBe(true);
  });
});

describe("kademeli aileler tek karta iner", () => {
  const grupla = (stats) => gruplaAileler(evaluateWatchBadges({ turSayaci: new Map(), ...stats }, []));

  test("13 aile karti + 22 ailesiz rozet = 35 kart", () => {
    const kartlar = grupla({});
    expect(kartlar.length).toBeLessThan(WATCH_BADGES.length);
    // 13 aile 59 uyeyi 13 karta indirir. 16 yeni rozet eklendi ama ekran
    // yalnizca 6 kart uzadi: 10'u mevcut/yeni aile kartlarinin ICINE indi.
    const uye = WATCH_BADGES.filter((b) => b.family).length;
    const aile = new Set(WATCH_BADGES.filter((b) => b.family).map((b) => b.family)).size;
    expect([uye, aile]).toEqual([59, 13]);
    expect(kartlar.length).toBe(WATCH_BADGES.length - uye + aile);
    expect(kartlar.length).toBe(35);
  });

  test("kidem ailesi de tek karta iner ve sonraki hedefi tasir", () => {
    const yil = grupla({ hesapYili: 2 }).find((k) => k.family === "yil");
    expect(yil.aileKademe).toBe(2);        // yil_1 + yil_2 acik
    expect(yil.id).toBe("yil_2");
    expect(yil.sonrakiHedef).toEqual(expect.objectContaining({ id: "yil_3", target: 3, ilerleme: 2 }));
  });

  test("aile kartinin KIMLIGI ulasilan kademedir, kilitli olan DEGIL", () => {
    // Onceki surumde kart kimligini bir SONRAKI (kilitli) kademeden aliyor ve
    // acik:true damgaliyordu: 60 filmi olan kullanici "Salon Sakini — 150 film
    // izle" kartini YESIL TIKLI goruyordu, yani kazanilmamis bir rozet
    // kazanilmis ilan ediliyordu.
    const film = grupla({ filmSayisi: 60 }).find((k) => k.family === "film");
    expect(film.aileKademe).toBe(2);          // film_10 + film_50 acik
    expect(film.id).toBe("film_50");          // KIMLIK = ulasilan kademe
    expect(film.target).toBe(50);
    expect(film.acik).toBe(true);             // ...ve bu gercekten kazanildi
  });

  test("aile karti bir sonraki hedefi AYRI alanda tasir", () => {
    const film = grupla({ filmSayisi: 60 }).find((k) => k.family === "film");
    expect(film.sonrakiHedef).toEqual(expect.objectContaining({
      id: "film_150", target: 150, ilerleme: 60,
    }));
    expect(film.sonrakiHedef.oran).toBeCloseTo(60 / 150, 5);
  });

  test("aile tamamlaninca sonraki hedef kalmaz", () => {
    const film = grupla({ filmSayisi: 3000 }).find((k) => k.family === "film");
    expect(film.sonrakiHedef).toBeNull();
    expect(film.id).toBe("film_2000");
  });

  test("500 filmde aile HENUZ bitmedi — 5. kademe hedef olarak durur", () => {
    const film = grupla({ filmSayisi: 500 }).find((k) => k.family === "film");
    expect(film.id).toBe("film_500");
    expect(film.aileKademe).toBe(4);
    expect(film.sonrakiHedef).toEqual(expect.objectContaining({ id: "film_2000", target: 2000 }));
  });

  test("hic acilmamis ailede en dusuk kademe hedeftir, legendary PARLAMAZ", () => {
    const film = grupla({ filmSayisi: 0 }).find((k) => k.family === "film");
    expect(film.acik).toBe(false);
    expect(film.target).toBe(10);
    expect(film.rarity).toBe("common");     // film_500'un legendary'si degil
  });

  test("aile tamamlaninca en yuksek kademe gosterilir", () => {
    const film = grupla({ filmSayisi: 3000 }).find((k) => k.family === "film");
    expect(film.aileKademe).toBe(5);
    expect(film.acik).toBe(true);
    expect(film.rarity).toBe("legendary");
    // 5. kademe = sekizgen + altin + tamamlanma konturu
    const { kademeSekli, kademeRengi } = require("../theme/badgeTokens");
    const s = kademeSekli(film.tier, film.aileToplam);
    expect(s).toEqual({ kenar: 8, ornate: true, kademe: 5 });
    expect(kademeRengi(s.kademe, { primary: "#101014" })).toBe("#F5C518");
  });
});

describe("formatBadgeDeger — dk/sa/gun cevirisi", () => {
  const yil = WATCH_BADGE_BY_ID.sure_yil;
  const film = WATCH_BADGE_BY_ID.film_2000;
  const sa = sureBirimiBul("sa");
  const gun = sureBirimiBul("gun");

  test("birimsiz rozet ham sayiyi yerellestirir", () => {
    expect(formatBadgeDeger(film, 2000, "en")).toBe("2,000");
    expect(formatBadgeDeger(film, 2000, "tr")).toBe("2.000");
    expect(formatBadgeDeger(film, 0, "tr")).toBe("0");
  });

  test("VARSAYILAN birim dakika (cevirici olmadan dk gosterir)", () => {
    expect(SURE_BIRIM_VARSAYILAN).toBe("dk");
    expect(formatBadgeDeger(yil, 525600, "tr")).toBe("525.600 dk");
    expect(formatBadgeDeger(yil, 525600, "en")).toBe("525,600 min");
    expect(formatBadgeDeger(yil, 10080, "tr")).toBe("10.080 dk");   // 1 hafta
  });

  test("cevirici SAAT/GUN secince ayni ham deger bolunur", () => {
    // 525.600 dk = 8.760 saat = 365 gun.
    expect(formatBadgeDeger(yil, 525600, "tr", sa)).toBe("8.760 sa");
    expect(formatBadgeDeger(yil, 525600, "en", sa)).toBe("8,760 h");
    expect(formatBadgeDeger(yil, 525600, "tr", gun)).toBe("365 gün");
    expect(formatBadgeDeger(yil, 525600, "en", gun)).toBe("365 d");
    expect(formatBadgeDeger(yil, 10080, "tr", sa)).toBe("168 sa");   // 1 hafta
    expect(formatBadgeDeger(yil, 43200, "en", sa)).toBe("720 h");    // 1 ay
  });

  test("buyuk birime dusen kucuk deger '0' olmaz, ondalik gosterir", () => {
    // 500 dk gun cinsinden 0,347 — yuvarlansa "0 gun" cikar ve ilerleme hic
    // yokmus gibi gorunurdu. 1'in altinda iki, 10'un altinda tek ondalik.
    expect(formatBadgeDeger(yil, 500, "tr", gun)).toBe("0,34 gün");
    expect(formatBadgeDeger(yil, 500, "en", sa)).toBe("8.3 h");
    // 10'un ustu tam sayiya iner.
    expect(formatBadgeDeger(yil, 720, "tr", sa)).toBe("12 sa");
    // Dakikada ondalik hic olmaz (bol = 1).
    expect(formatBadgeDeger(yil, 500, "tr")).toBe("500 dk");
  });

  test("TAM SAYI sonuca sahte ondalik eklenmez", () => {
    // 10.080 dk tam olarak 7 gun; "7,0 gün" olmayan bir hassasiyet iddia eder.
    expect(formatBadgeDeger(yil, 10080, "tr", gun)).toBe("7 gün");
    expect(formatBadgeDeger(yil, 10080, "tr", sa)).toBe("168 sa");
    expect(formatBadgeDeger(yil, 120, "en", sa)).toBe("2 h");
  });

  test("deger ASAGI kirpilir: kilitli rozet 'tamamlanmis' gorunmez", () => {
    // 10.079 dk yuvarlansa 168 sa olur ve kilitli rozette "168/168 sa" yazardi.
    expect(formatBadgeDeger(yil, 10079, "tr", sa)).toBe("167 sa");
    expect(formatBadgeAralik(yil, 10079, 10080, "tr", sa)).toBe("167/168 sa");
    // 43.199 dk (1 ay hedefinin bir dakika altı) gun cinsinden 29 gun kalir.
    expect(formatBadgeDeger(yil, 43199, "tr", gun)).toBe("29 gün");
    // Kirpma ondalikli araliga da uygulanir: 8,99 sa -> 8,9 sa.
    expect(formatBadgeDeger(yil, 539, "tr", sa)).toBe("8,9 sa");
  });

  test("cevirici BIRIMSIZ rozette yok sayilir (film adedi bolunmez)", () => {
    expect(formatBadgeDeger(film, 2000, "tr", gun)).toBe("2.000");
    expect(formatBadgeDeger(film, 2000, "en", sa)).toBe("2,000");
  });

  test("bozuk/eksik girdide atmaz, 0 doner", () => {
    expect(formatBadgeDeger(yil, undefined, "tr")).toBe("0 dk");
    expect(formatBadgeDeger(yil, undefined, "tr", gun)).toBe("0 gün");
    expect(formatBadgeDeger(null, 60, "tr")).toBe("60");
    expect(formatBadgeDeger({}, 1500, "en")).toBe("1,500");
  });

  test("formatBadgeAralik birim ekini TEK KEZ, sonda yazar", () => {
    // Kompakt kartta iki kez ek yazmak (525.600 dk/525.600 dk) satiri tasiriyordu.
    expect(formatBadgeAralik(yil, 74040, 525600, "tr")).toBe("74.040/525.600 dk");
    expect(formatBadgeAralik(yil, 74040, 525600, "tr", sa)).toBe("1.234/8.760 sa");
    expect(formatBadgeAralik(yil, 74040, 525600, "en", gun)).toBe("51/365 d");
    // Birimsiz rozette ek yok, sayilar oldugu gibi.
    expect(formatBadgeAralik(film, 250, 2000, "tr")).toBe("250/2.000");
    expect(formatBadgeAralik(film, 250, 2000, "en")).toBe("250/2,000");
  });

  test("sureBirimiBul bilinmeyen id'de dakikaya duser", () => {
    expect(sureBirimiBul("yok").id).toBe("dk");
    expect(sureBirimiBul(undefined).id).toBe("dk");
    expect(SURE_BIRIMLERI.map((b) => b.id)).toEqual(["dk", "sa", "gun"]);
  });

  test("sure aile kartinda SONRAKI kademe de birim tasir", () => {
    // 1 haftalik kullanici: hafta acik, sonraki hedef 1 ay = 43.200 dk = 720 sa.
    const kart = gruplaAileler(
      evaluateWatchBadges({ turSayaci: new Map(), etkinDakikaToplam: 10080 }, []),
    ).find((k) => k.family === "sure");
    expect(kart.sonrakiHedef.birim).toBeTruthy();
    expect(formatBadgeDeger(kart.sonrakiHedef, kart.sonrakiHedef.target, "tr")).toBe("43.200 dk");
    expect(formatBadgeDeger(kart.sonrakiHedef, kart.sonrakiHedef.target, "tr", sa)).toBe("720 sa");
  });
});

describe("metinler", () => {
  test("tr ve en ayrimi calisir, bos donmez", () => {
    for (const b of WATCH_BADGES) {
      expect(badgeAd(b, "tr")).toBe(b.tr);
      expect(badgeAd(b, "en")).toBe(b.en);
      expect(badgeAciklama(b, "tr")).toBe(b.descTr);
      expect(badgeAciklama(b, "en")).toBe(b.descEn);
    }
    expect(badgeAd(undefined, "tr")).toBe("");
  });

  test("baslik 1-4 kelime, aciklama noktasiz", () => {
    for (const b of WATCH_BADGES) {
      expect(b.tr.split(/\s+/).length).toBeLessThanOrEqual(4);
      expect(b.descTr.endsWith(".")).toBe(false);
      expect(b.descEn.endsWith(".")).toBe(false);
    }
  });

  test("gizli rozetler isaretli", () => {
    const gizli = WATCH_BADGES.filter((b) => b.hidden);
    expect(gizli).toHaveLength(9);
    expect(gizli.every((b) => b.section === BOLUM.GIZLI)).toBe(true);
    // GIZLI bolumundeki HER rozet gizli olmali; yarisi acik bir bolum
    // kullaniciya "burada surpriz var" sozunu tutmaz.
    const bolum = WATCH_BADGES.filter((b) => b.section === BOLUM.GIZLI);
    expect(bolum.every((b) => b.hidden)).toBe(true);
  });
});

describe("kademe merdiveni: kenar sayisi + renk", () => {
  const { kademeSekli, kademeRengi, KENAR_GEO } = require("../theme/badgeTokens");
  const KOYU = { primary: "#101014", accent: "#5B8DEF" };
  const ACIK = { primary: "#EDF0F5", accent: "#5B8DEF" };

  test("ailesiz rozet BUGUNKU altigen + NADIRLIK rengi goruntusunde kalir", () => {
    // 50 rozetin ~21'i ailesiz. Kare bir "Cadilar Gecesi" hicbir ilerleme
    // ifade etmezdi; merdiven yalnizca merdiveni olan yerde anlamli.
    expect(kademeSekli(0, 0)).toEqual({ kenar: 6, ornate: false, kademe: 0 });
    expect(kademeSekli(undefined, undefined)).toEqual({ kenar: 6, ornate: false, kademe: 0 });
    // kademe 0 -> null: AppBadge nadirlik rengine duser.
    expect(kademeRengi(0, KOYU)).toBeNull();
  });

  test("kademe 1..5 -> 4..8 kenar", () => {
    for (let t = 1; t <= 5; t++) expect(kademeSekli(t, 5).kenar).toBe(3 + t);
  });

  test("UCGEN YOK — hicbir kademe 3 kenar uretmez", () => {
    for (let t = 0; t <= 9; t++) expect(kademeSekli(t, 5).kenar).toBeGreaterThanOrEqual(4);
  });

  test("kademe AILE ICINDEKI KONUMDAN turer, mutlak tier'dan DEGIL", () => {
    // REGRESYON: mutlak eslemede 3 kademeli `perde` ailesinin zirvesi
    // (perde_20, legendary, sistemin en tepe rozeti) kademe 3'e dusuyor ve MOR
    // altigen ciziliyordu; altini hic gorunmuyordu.
    expect(kademeSekli(3, 3).kademe).toBe(5);     // 3 kademeli ailenin sonu
    expect(kademeSekli(2, 2).kademe).toBe(5);     // 2 kademeli ailenin sonu
    expect(kademeSekli(1, 3).kademe).toBe(1);     // ...basi hep 1
    expect(kademeSekli(2, 3).kademe).toBe(3);     // ortasi ortada
    // 5 kademeli ailede esleme BIREBIR olur (film/bolum hic degismez)
    for (let t = 1; t <= 5; t++) expect(kademeSekli(t, 5).kademe).toBe(t);
  });

  test("HER ailenin zirvesi ALTIN sekizgene oturur", () => {
    // Bulgunun dogrudan bekcisi: yeni bir aile eklenip zirvesi altin cikmazsa
    // burada patlar.
    const aileler = WATCH_BADGES.reduce((acc, b) => {
      if (b.family) (acc[b.family] = acc[b.family] || []).push(b);
      return acc;
    }, {});
    for (const [ad, uyeler] of Object.entries(aileler)) {
      const zirve = uyeler.reduce((a, b) => (b.tier > a.tier ? b : a));
      const s = kademeSekli(zirve.tier, uyeler.length);
      expect([ad, s.kademe, s.kenar, s.ornate]).toEqual([ad, 5, 8, true]);
      expect(kademeRengi(s.kademe, KOYU)).toBe("#F5C518");
    }
  });

  test("5'ten buyuk kademe sekizgende DOYAR (tanimsiz geometri uretmez)", () => {
    expect(kademeSekli(9, 9).kenar).toBe(8);
    expect(kademeSekli(12, 12).kenar).toBe(8);
    // Ailesiz/bozuk girdide de gecerli geometri
    expect(kademeSekli(99, 0).kenar).toBeLessThanOrEqual(8);
  });

  test("ornate artik KADEMEYI degil TAMAMLANMAYI isaretler", () => {
    // Bes ayri sekil+renk kademeyi zaten soyluyor; "ailenin sonuna geldin"
    // bilgisi baska hicbir kanalda yoktu.
    expect(kademeSekli(4, 4).ornate).toBe(true);
    expect(kademeSekli(3, 3).ornate).toBe(true);    // 3 kademeli ailenin sonu
    expect(kademeSekli(2, 2).ornate).toBe(true);
    expect(kademeSekli(3, 4).ornate).toBe(false);   // ortada
    expect(kademeSekli(1, 4).ornate).toBe(false);
  });

  test("her kademenin AYRI rengi var ve hicbiri cakismaz", () => {
    const renkler = [1, 2, 3, 4, 5].map((k) => kademeRengi(k, KOYU));
    expect(renkler.every(Boolean)).toBe(true);
    expect(new Set(renkler).size).toBe(5);
    // gri · mavi · mor · zumrut · altin
    expect(renkler).toEqual(["#9CA3AF", "#38BDF8", "#C084FC", "#34D399", "#F5C518"]);
  });

  test("ALTIN yalnizca ZIRVE kademede — alt kademelere yayilmaz", () => {
    // Altin bu uygulamada sampiyon/final demek (BracketTree, PodiumModal).
    const GOLD = "#F5C518";
    for (const k of [1, 2, 3, 4]) expect(kademeRengi(k, KOYU)).not.toBe(GOLD);
    expect(kademeRengi(5, KOYU)).toBe(GOLD);
  });

  test("acik zeminli temada koyu tonlar kullanilir (kontrast)", () => {
    // light ve green temalari acik zeminli; tek parlak ton beyaz ustunde
    // okunmuyordu.
    for (const k of [1, 2, 3, 4, 5]) {
      expect(kademeRengi(k, ACIK)).not.toBe(kademeRengi(k, KOYU));
    }
    expect(kademeRengi(4, ACIK)).toBe("#047857");
  });

  test("her katalog rozeti gecerli bir siluete ve renge cozulur", () => {
    const aileToplam = WATCH_BADGES.reduce((acc, b) => {
      if (b.family) acc[b.family] = (acc[b.family] || 0) + 1;
      return acc;
    }, {});
    for (const b of WATCH_BADGES) {
      const s = kademeSekli(b.tier, aileToplam[b.family] || 0);
      expect(KENAR_GEO[s.kenar]).toBeDefined();
      expect(typeof s.ornate).toBe("boolean");
      // Ailesizde null (nadirlige duser), ailelide gercek bir hex.
      const renk = kademeRengi(s.kademe, KOYU);
      if (b.family) expect(renk).toMatch(/^#[0-9A-F]{6}$/i);
      else expect(renk).toBeNull();
    }
  });

  test("gecersiz kenar sayisi KENAR_GEO'da yok (AppBadge altigene duser)", () => {
    expect(KENAR_GEO[3]).toBeUndefined();
    expect(KENAR_GEO[9]).toBeUndefined();
    expect(KENAR_GEO[6]).toEqual({ r: 46, corner: 9.0 });   // varsayilan DEGISMEDI
  });

  test("altigen disindaki hepsi alan telafisi icin 47 yaricapli", () => {
    for (const n of [4, 5, 7, 8]) expect(KENAR_GEO[n].r).toBe(47);
    // ...ama viewBox merkezi 50; yay + kontur icin pay kalmali
    for (const n of [4, 5, 6, 7, 8]) expect(KENAR_GEO[n].r).toBeLessThanOrEqual(47);
  });

  test("kose yaricapi kenar uzunluguyla olcekli (ayni gorsel doku)", () => {
    // n-gen kenari = 2·r·sin(π/n). Oran altigene gore sabit kalmali.
    const oran = (n) => {
      const { r, corner } = KENAR_GEO[n];
      return corner / (2 * r * Math.sin(Math.PI / n));
    };
    for (const n of [4, 5, 7, 8]) expect(oran(n)).toBeCloseTo(oran(6), 2);
  });

  test("7 ve 8 kenar TEK BASINA ayirt edilemez — rengin varlik sebebi bu", () => {
    // Sagitta = R(1 - cos(π/n)); 52px rozette R = 47 × 0.52.
    const sag = (n) => KENAR_GEO[n].r * 0.52 * (1 - Math.cos(Math.PI / n));
    const fark = (a, b) => Math.abs(sag(a) - sag(b));
    expect(fark(4, 5)).toBeGreaterThan(2);      // kare/besgen: gozle secilir
    expect(fark(6, 7)).toBeLessThan(1);         // altigen/yedigen: 1 px ALTI
    expect(fark(7, 8)).toBeLessThan(1);
    // Dolayisiyla bu iki kademe RENKSIZ eklenemezdi.
    expect(kademeRengi(4, KOYU)).not.toBe(kademeRengi(3, KOYU));
    expect(kademeRengi(5, KOYU)).not.toBe(kademeRengi(4, KOYU));
  });
});
