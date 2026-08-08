// __tests__/watchScoring.test.js
// Izleme puani (Kare) + Perde merdiveni + tur normalizasyonu.
// Tasarim gerekcesi: docs/ozellikler/PUANLAMA_ROZET_SISTEMI.md

const {
  K, toDate, gunKey, enUzunArdisik,
  etkinFilmDk, etkinBolumDk, filmPuani, bolumPuani,
  computeWatchScore, computePerde, detectAnomalies, hesapYasiYil,
  PERDE_ESIK, PERDE_ADLARI, PERDE_ADLARI_EN, MAKARA_ADIMI,
} = require("../utils/watchScoring");
const { kanonikTur, GENRE_IDS } = require("../utils/genreCanon");

const film = (o = {}) => ({ type: "movie", name: "Film", minutes: 120, genres: ["Drama"], dateAdded: "2026-01-10", ...o });
const bolum = (o = {}) => ({ episodeMinutes: 45, episodeWatchTime: "2026-01-10", ...o });
const dizi = (o = {}) => ({
  id: 1, name: "Dizi", genres: ["Drama"], showEpisodeCount: 10, watchedEpisodeCount: 2,
  seasons: [{ seasonNumber: 1, episodes: [bolum(), bolum()] }], ...o,
});
// Testler 2021–2028 aralığında sabit tarihler kullanıyor. Motorun tarih
// makullük penceresi "gelecek" kayıtları eler, bu yüzden "şu an"ı pinliyoruz —
// aksi halde testler gerçek takvim ilerledikçe kendiliğinden bozulurdu.
const SIMDI = new Date(2029, 0, 1).getTime();
const puanla = (movies = [], shows = []) => computeWatchScore({ movies, shows, kanonikTur, simdi: SIMDI });

describe("tur normalizasyonu (genreCanon)", () => {
  test("TR ve EN ayni turu ayni id'ye indirir", () => {
    expect(kanonikTur("Bilim Kurgu")).toBe(kanonikTur("Science Fiction"));
    expect(kanonikTur("Korku")).toBe(kanonikTur("Horror"));
    expect(kanonikTur("Vahsi Bati")).toBe(kanonikTur("Western"));
    expect(kanonikTur("Vahşi Batı")).toBe(kanonikTur("Western"));
    expect(kanonikTur("Suç")).toBe(kanonikTur("Crime"));
    expect(kanonikTur("Müzik")).toBe(kanonikTur("Music"));
  });

  test("bilesik dizi turleri tek id'ye iner", () => {
    expect(kanonikTur("Aksiyon & Macera")).toBe("action");
    expect(kanonikTur("Action & Adventure")).toBe("action");
    expect(kanonikTur("Sci-Fi & Fantasy")).toBe("scifi");
    expect(kanonikTur("Bilim Kurgu & Fantazi")).toBe("scifi");
    expect(kanonikTur("War & Politics")).toBe("war");
  });

  test("taninmayan her ad TEK 'other' kovasinda toplanir", () => {
    expect(kanonikTur("Zurna Filmleri")).toBe("other");
    expect(kanonikTur("Bilinmeyen Tur")).toBe("other");
    // Iki farkli bilinmeyen ad tur sayisini SISIREMEZ
    expect(kanonikTur("Zurna Filmleri")).toBe(kanonikTur("Bilinmeyen Tur"));
  });

  test("harfsiz girdi hic tur SAYILMAZ ('other' bile degil)", () => {
    // "" donmesi kasitli: computeWatchScore bunu atlar, yani noktalama ya da
    // emoji iceren bozuk bir alan 75 Kare'lik tur puani kazandiramaz.
    expect(kanonikTur("!!!")).toBe("");
    expect(kanonikTur("   ")).toBe("");
    expect(kanonikTur("")).toBe("");
    expect(kanonikTur(null)).toBe("");
  });

  test("kanonik kume 20 id ve TUR_TAVAN ulasilabilir", () => {
    expect(GENRE_IDS).toHaveLength(20);
    expect(K.TUR_TAVAN).toBeLessThan(GENRE_IDS.length);
  });
});

describe("tarih ayristirma", () => {
  test("YYYY-MM-DD LOKAL gun olarak kurulur (UTC kaymasi yok)", () => {
    // new Date("2026-03-14") UTC gece yarisi yorumlanir ve UTC-negatif
    // dilimlerde yerel tarihi 13 Mart'a kaydirip gun serisini kirar.
    expect(gunKey("2026-03-14", SIMDI)).toBe("2026-03-14");
    expect(gunKey("2026-01-01", SIMDI)).toBe("2026-01-01");
    expect(gunKey("2026-12-31", SIMDI)).toBe("2026-12-31");
  });

  test("makul olmayan tarihler tarihsiz sayilir", () => {
    // Epoch 0, TMDB'nin bos air_date'i ve saniye/milisaniye karisikligi
    // kayitlari 1970'e dusuruyor; oradan turetilen "en uzun ara" on yillara
    // firlayip `gizli_geri_donus` rozetini KALICI olarak yanlis aciyordu.
    expect(gunKey("1970-01-01", SIMDI)).toBeNull();
    expect(gunKey("1970-01-01T00:00:00.000Z", SIMDI)).toBeNull();
    expect(gunKey(new Date(1900, 0, 1), SIMDI)).toBeNull();
    // ...ama gercekten eski bir izleme kaydi GECERLIDIR: kullanici 1975'te
    // izledigi bir filmi o tarihe isaretleyebilir.
    expect(gunKey("1975-06-20", SIMDI)).toBe("1975-06-20");
    // Gelecek de elenir (kullanici zaten gelecek tarih secemiyor).
    expect(gunKey("2030-05-05", SIMDI)).toBeNull();
    // ...ama saat dilimi payi icinde kalan "bugun" gecerlidir.
    expect(gunKey(new Date(SIMDI), SIMDI)).toBe("2029-01-01");
  });

  test("makul olmayan tarihli kayit tur ve dizi bonusunu KAYBETMEZ", () => {
    const { kirilim, stats } = puanla([film({ dateAdded: "1970-01-01", genres: ["Korku"] })]);
    expect(stats.gunSayisi).toBe(0);        // gun/ritim hesabina girmez
    expect(stats.filmSayisi).toBe(1);       // ...ama eser olarak sayilir
    expect(kirilim.turPuani).toBe(K.TUR_ILK);
    expect(stats.enUzunAra).toBe(0);        // sahte 50 yillik ara uretmez
  });

  test("dort formati da destekler", () => {
    const d = new Date(2026, 4, 9);
    expect(gunKey(d)).toBe("2026-05-09");
    expect(gunKey({ seconds: Math.floor(d.getTime() / 1000) })).toBe("2026-05-09");
    expect(gunKey({ toDate: () => d })).toBe("2026-05-09");
    expect(gunKey(d.getTime())).toBe("2026-05-09");
  });

  test("bozuk girdi null doner, atmaz", () => {
    expect(toDate(null)).toBeNull();
    expect(toDate("")).toBeNull();
    expect(toDate("hepsi bos")).toBeNull();
    expect(toDate({ toDate: () => { throw new Error("bozuk"); } })).toBeNull();
    expect(gunKey(undefined)).toBeNull();
  });
});

describe("seri hesabi", () => {
  test("ardisik gunler sayilir", () => {
    expect(enUzunArdisik(["2026-01-01", "2026-01-02", "2026-01-03"])).toBe(3);
    expect(enUzunArdisik(["2026-01-01", "2026-01-03"])).toBe(1);
    expect(enUzunArdisik([])).toBe(0);
  });

  test("DST gecisi seriyi kirmaz", () => {
    // ABD yaz saati 8 Mart 2026'da baslar; o gun 23 saattir. Gun indeksi
    // ms/86400000 ile hesaplansaydi seri burada kirilirdi.
    expect(enUzunArdisik(["2026-03-07", "2026-03-08", "2026-03-09"])).toBe(3);
    // Avrupa yaz saati 29 Mart 2026.
    expect(enUzunArdisik(["2026-03-28", "2026-03-29", "2026-03-30"])).toBe(3);
    // Kis saatine donus (1 Kasim 2026, 25 saatlik gun).
    expect(enUzunArdisik(["2026-10-31", "2026-11-01", "2026-11-02"])).toBe(3);
  });

  test("ay ve yil sinirini asar", () => {
    expect(enUzunArdisik(["2026-01-30", "2026-01-31", "2026-02-01"])).toBe(3);
    expect(enUzunArdisik(["2025-12-31", "2026-01-01"])).toBe(2);
    // 2028 arti yil: 28 Subat -> 29 Subat -> 1 Mart
    expect(enUzunArdisik(["2028-02-28", "2028-02-29", "2028-03-01"])).toBe(3);
  });
});

describe("oge puani ve kirpma (anti-hile aritmetigin kendisi)", () => {
  test("minutes yoksa medyan varsayilan", () => {
    expect(etkinFilmDk({})).toBe(K.FILM_DK_VARSAYILAN);
    expect(filmPuani({})).toBe(140);            // 40 + 100
  });

  test("sisirilmis minutes tavana kirpilir", () => {
    expect(filmPuani({ minutes: 600000 })).toBe(280);   // 40 + 240
    expect(filmPuani({ minutes: 240 })).toBe(280);
    expect(filmPuani({ minutes: 241 })).toBe(280);
  });

  test("gercekten kisa eser tabanla odullendirilir, farm edilemez", () => {
    expect(filmPuani({ minutes: 2 })).toBe(45);   // 40 + 5 (alt kirpma)
    expect(filmPuani({ minutes: 1 })).toBe(45);
    // Kisa film ortalama filmin dortte birinden az eder.
    expect(filmPuani({ minutes: 2 })).toBeLessThan(filmPuani({ minutes: 125 }) / 3);
  });

  test("bolum puani ve varsayilani", () => {
    expect(bolumPuani({ episodeMinutes: 0 })).toBe(35);    // 10 + round(42*0.6)
    expect(bolumPuani({ episodeMinutes: 45 })).toBe(37);   // 10 + 27
    expect(bolumPuani({ episodeMinutes: 999 })).toBe(64);  // 10 + round(90*0.6)
    expect(etkinBolumDk({ episodeMinutes: 1 })).toBe(K.BOLUM_DK_MIN);
  });

  test("ortalama eser degerleri Perde tablosunun dayandigi sayilar", () => {
    expect(filmPuani({ minutes: 125 })).toBe(165);
    expect(bolumPuani({ episodeMinutes: 45 })).toBe(37);
  });
});

describe("gunluk tavan", () => {
  test("500 kayit ayni gune yazilirsa icerik puani tavanda kilitlenir", () => {
    const movies = Array.from({ length: 500 }, () => film({ dateAdded: "2026-02-01" }));
    const { kirilim } = puanla(movies);
    expect(kirilim.icerikPuani).toBe(K.GUNLUK_TAVAN);
  });

  test("durust toplu isaretleyen tavana DEGMEZ", () => {
    // Haftada bir oturumda 1 film + 7 bolum = 165 + 7*37 = 424 < 1100
    const movies = [film({ dateAdded: "2026-02-01", minutes: 125 })];
    const shows = [dizi({
      showEpisodeCount: 100, watchedEpisodeCount: 7,
      seasons: [{ seasonNumber: 1, episodes: Array.from({ length: 7 }, () => bolum({ episodeWatchTime: "2026-02-01" })) }],
    })];
    const { stats, kirilim } = puanla(movies, shows);
    expect(stats.tavanaTakilanGun).toBe(0);
    expect(kirilim.icerikPuani).toBe(165 + 7 * 37);
  });

  test("ayni icerik gunlere yayilinca cok daha fazla eder", () => {
    const tekGun = Array.from({ length: 40 }, () => film({ dateAdded: "2026-02-01", minutes: 125 }));
    const yayilmis = Array.from({ length: 40 }, (_, i) =>
      film({ dateAdded: `2026-02-${String((i % 28) + 1).padStart(2, "0")}`, minutes: 125 }));
    expect(puanla(yayilmis).toplam).toBeGreaterThan(puanla(tekGun).toplam * 3);
  });
});

describe("ritim tavani (tarih uydurmanin ust siniri)", () => {
  const gunlereYay = (adet, baslangic = new Date(2021, 0, 1)) =>
    Array.from({ length: adet }, (_, i) =>
      film({ dateAdded: gunKey(new Date(baslangic.getFullYear(), 0, 1 + i)) }));

  test("kusursuz bir yil (365 gun kesintisiz) tavanin ALTINDA kalir", () => {
    // 365*12 + tum seri kilometre taslari (60+150+300+600+1000+1500) = 7.990.
    // Yani tavan bir yilda ulasilamaz; tarih uydurma bir yilda bile sinirlidir.
    const { kirilim, stats } = puanla(gunlereYay(365));
    expect(stats.gunSayisi).toBe(365);
    expect(stats.enUzunSeri).toBe(365);
    expect(kirilim.ritimPuani).toBe(365 * K.GUN_BONUSU + 3610);
    expect(kirilim.ritimPuani).toBeLessThan(K.RITIM_TAVAN);
  });

  test("tarih uydurarak kazanilabilecek MAKSIMUM Kare 9.000'dir", () => {
    // 900 gune yayan cok yillik kullanici tavana carpar ve orada kilitlenir.
    const { kirilim } = puanla(gunlereYay(900));
    expect(kirilim.ritimPuani).toBe(K.RITIM_TAVAN);
    // Tavan Perde 7 civaridir — uydurma tek basina zirveye tasimaz.
    expect(computePerde(K.RITIM_TAVAN).perde).toBeLessThanOrEqual(7);
  });

  test("ritim, toplamin kucuk bir dilimidir (docs §8.3: ~%5)", () => {
    const { kirilim, stats } = puanla(gunlereYay(900));
    expect(kirilim.ritimPuani / stats.toplamKare).toBeLessThan(0.1);
  });
});

describe("dizi bitirme bonusu", () => {
  test("showEpisodeCount 0 ise bonus verilmez", () => {
    const { kirilim } = puanla([], [dizi({ showEpisodeCount: 0, watchedEpisodeCount: 2 })]);
    expect(kirilim.diziPuani).toBe(0);
  });

  test("showEpisodeCount 1 ise (alt sinir) bonus verilmez", () => {
    const { kirilim } = puanla([], [dizi({ showEpisodeCount: 1, watchedEpisodeCount: 2 })]);
    expect(kirilim.diziPuani).toBe(0);
  });

  test("tamamlanan dizi bonus alir", () => {
    const { stats } = puanla([], [dizi({ showEpisodeCount: 2, watchedEpisodeCount: 2 })]);
    expect(stats.tamamlananDizi).toBe(1);
  });

  test("bonus dizinin UZUNLUGUYLA olceklenir", () => {
    // 2 bolumluk "mini dizi" tam bonusu HAK ETMEZ; 20+ bolumluk dizi eder.
    const uzunDizi = (bolum) => ({
      id: "u", name: "Uzun", genres: ["Dram"],
      showEpisodeCount: bolum, watchedEpisodeCount: bolum,
      seasons: [{ seasonNumber: 1, episodes: Array.from({ length: bolum }, (_, i) =>
        bolum({ episodeWatchTime: gunKey(new Date(2026, 0, 1 + i)) })) }],
    });
    // Icerik tavani baglamasin diye gunlere yayilmis 30 bolumluk dizi
    const otuz = puanla([], [{
      id: "u", name: "Uzun", genres: ["Dram"], showEpisodeCount: 30, watchedEpisodeCount: 30,
      seasons: [{ seasonNumber: 1, episodes: Array.from({ length: 30 }, (_, i) =>
        bolum({ episodeWatchTime: gunKey(new Date(2026, 0, 1 + i)) })) }],
    }]);
    expect(otuz.kirilim.diziPuani).toBe(K.DIZI_BONUS);   // 30 bolum -> tam bonus

    const iki = puanla([], [{
      id: "m", name: "Mini", genres: ["Dram"], showEpisodeCount: 2, watchedEpisodeCount: 2,
      seasons: [{ seasonNumber: 1, episodes: [bolum({ episodeWatchTime: "2026-01-01" }), bolum({ episodeWatchTime: "2026-01-02" })] }],
    }]);
    expect(iki.kirilim.diziPuani).toBe(2 * K.DIZI_BONUS_BOLUM_BASI);   // 50, 500 degil
  });

  test("ISTISMAR KAPALI: mini dizi ciftligi merdiveni tirmandiramaz", () => {
    // Gercek acik: TMDB'de binlerce 2 bolumluk mini dizi var ve hepsini bugune
    // isaretlemek tek dokunusluk is. Duz "her dizi 500 Kare" kuralinda 520 mini
    // dizi = 261.187 Kare = PERDE 20 ediyordu; ayni gun 9 aya yayilmis 40 gercek
    // film ise 7.155 Kare = Perde 7. Sistem sahtekarligi durustlukten 36 kat
    // fazla oduullendiriyordu.
    const GUN = "2026-07-21";
    const mini = (i) => ({
      id: `m${i}`, name: `Mini ${i}`, genres: ["Belgesel"],
      showEpisodeCount: 2, watchedEpisodeCount: 2,
      seasons: [{ seasonNumber: 1, episodes: [bolum({ episodeWatchTime: GUN }), bolum({ episodeWatchTime: GUN })] }],
    });
    const ciftlik = puanla([], Array.from({ length: 520 }, (_, i) => mini(i)));
    const durust = puanla(Array.from({ length: 40 }, (_, i) =>
      film({ name: `F${i}`, minutes: 125, dateAdded: gunKey(new Date(2026, 0, 1 + i * 7)) })), []);

    // Tek gunde 520 sahte dizi, 9 aya yayilmis 40 gercek filmi GECEMEZ.
    expect(ciftlik.toplam).toBeLessThan(durust.toplam);
    expect(computePerde(ciftlik.toplam).perde).toBeLessThanOrEqual(4);
  });

  // markShow'un GERCEKTEN urettigi sekil: TUM bolumlere TEK tarih
  // (services/watchedTvService.js:268 → normalizeEpisode(e, watchDate)).
  // Bir diziyi kanonik yoldan bitirmek yalnizca 1 GUN uretir.
  const markShowDizi = (id, bolumSayisi, tarih) => ({
    id, name: `Dizi ${id}`, genres: ["Dram"],
    showEpisodeCount: bolumSayisi, watchedEpisodeCount: bolumSayisi,
    seasons: [{ seasonNumber: 1, episodes: Array.from({ length: bolumSayisi }, () =>
      bolum({ episodeWatchTime: tarih })) }],
  });

  test("markShow ile bitirilen dizi TAM bonus alir", () => {
    // ONCEKI TASARIM BUNU KIRIYORDU. Tavan toplam gun sayisina bagliyken
    // (gunSayisi * 100), markShow tek gun urettigi icin 40 bolumluk bir dizi
    // 500 yerine 100 Kare aliyordu — yani tavan tam da DURUST yolu
    // cezalandiriyordu. Bu testin ilk hali bolumleri gun gun yayarak veri
    // uretiyordu; uygulamanin hicbir yazma yolu oyle bir sey uretmiyor.
    const { kirilim } = puanla([], [markShowDizi(1, 40, "2026-03-05")]);
    expect(kirilim.diziPuani).toBe(K.DIZI_BONUS);
  });

  test("DURUST kullanicida tavan HIC baglamaz (her dizi kendi gununde)", () => {
    const shows = Array.from({ length: 21 }, (_, d) =>
      markShowDizi(d, 40, gunKey(new Date(2021, 0, 1 + d * 12))));
    const { kirilim } = puanla([], shows);
    expect(kirilim.diziPuani).toBe(21 * K.DIZI_BONUS);
  });

  test("ISTISMAR KAPALI: tavan GUN BASINA, tek gune yigilan bonus kirpilir", () => {
    const shows = Array.from({ length: 100 }, (_, i) => markShowDizi(i, 20, "2026-07-21"));
    const { kirilim } = puanla([], shows);
    expect(kirilim.diziPuani).toBe(K.DIZI_GUN_TAVANI);   // ham 50.000 olurdu
  });

  test("ISTISMAR KAPALI: tavan FILM gunleriyle finanse EDILEMEZ", () => {
    // Onceki (global) tavanda 100 filmi 100 gune yayan kullanici tavanini
    // 10.100'e cikarip mini dizi ciftligini yeniden aciyordu.
    const movies = Array.from({ length: 100 }, (_, i) =>
      film({ name: `F${i}`, dateAdded: gunKey(new Date(2026, 0, 1 + i)) }));
    const shows = Array.from({ length: 520 }, (_, i) => markShowDizi(i, 2, "2026-07-21"));
    const filmli = puanla(movies, shows);
    const filmsiz = puanla([], shows);
    expect(filmli.kirilim.diziPuani).toBe(K.DIZI_GUN_TAVANI);
    expect(filmsiz.kirilim.diziPuani).toBe(K.DIZI_GUN_TAVANI);
  });

  test("tarihsiz eski goc verisi bonusu TAMAMEN kaybetmez", () => {
    // Onceki tavanda gunSayisi=0 oldugu icin 40 bitmis dizi SIFIR bonus
    // aliyordu. Tarihsiz kayitlar tek kovada toplanip bir gunluk tavan alir.
    const shows = Array.from({ length: 40 }, (_, i) => ({
      id: i, name: `Eski ${i}`, genres: ["Dram"], showEpisodeCount: 30, watchedEpisodeCount: 30,
      seasons: [{ seasonNumber: 1, episodes: Array.from({ length: 30 }, () => ({ episodeMinutes: 42 })) }],
    }));
    const { kirilim, stats } = puanla([], shows);
    expect(stats.gunSayisi).toBe(0);
    expect(kirilim.diziPuani).toBe(K.DIZI_GUN_TAVANI);
  });

  test("bonus dizinin BITIS gunune yazilir", () => {
    // Bolumleri gunlere yayilmis bir dizi + ayni son gune biten baska bir dizi
    // AYNI gun kovasina duser ve birlikte kirpilir.
    const yayilmis = {
      id: "a", name: "A", genres: ["Dram"], showEpisodeCount: 30, watchedEpisodeCount: 30,
      seasons: [{ seasonNumber: 1, episodes: Array.from({ length: 30 }, (_, e) =>
        bolum({ episodeWatchTime: gunKey(new Date(2026, 0, 1 + e)) })) }],
    };
    const sonGun = gunKey(new Date(2026, 0, 30));
    const { kirilim } = puanla([], [yayilmis, markShowDizi("b", 30, sonGun)]);
    expect(kirilim.diziPuani).toBe(K.DIZI_GUN_TAVANI);   // ikisi de 30 Ocak'ta bitti
  });

  test("bayat showEpisodeCount kirpmasi asiri iddiayi eler", () => {
    // izlenen 3x hedefi asarsa sayac guvenilmez sayilir
    const { kirilim } = puanla([], [dizi({ showEpisodeCount: 3, watchedEpisodeCount: 100 })]);
    expect(kirilim.diziPuani).toBe(0);
  });

  test("sezon tamamlama BILEREK puanlanmaz (seasonEpisodes olculemez)", () => {
    // seasonEpisodes uc yazma yolunda izlenen bolum sayisina esitleniyor;
    // olcut kendine referans verdigi icin bilesen tamamen cikarildi.
    const az = puanla([], [dizi({
      showEpisodeCount: 100, watchedEpisodeCount: 1,
      seasons: [{ seasonNumber: 1, seasonEpisodes: 1, episodes: [bolum()] }],
    })]);
    expect(az.kirilim.diziPuani).toBe(0);
  });
});

describe("veri kalitesi", () => {
  test("tarihsiz kayit icerik puani vermez ama tur puanina girer", () => {
    const { kirilim, stats } = puanla([film({ dateAdded: null, genres: ["Korku"] })]);
    expect(kirilim.icerikPuani).toBe(0);
    expect(kirilim.ritimPuani).toBe(0);
    expect(stats.filmSayisi).toBe(1);
    expect(stats.turSayisi).toBe(1);
    expect(kirilim.turPuani).toBe(K.TUR_ILK);
  });

  test("eksik sure sayilir ve ilan edilir", () => {
    const { stats } = puanla([film({ minutes: 0 }), film({ minutes: 120 })]);
    expect(stats.tahminiEser).toBe(1);
    expect(stats.etkinDakikaToplam).toBe(K.FILM_DK_VARSAYILAN + 120);
  });

  test("episodeRatings string de olsa sayiya cevrilir", () => {
    const { stats } = puanla([], [dizi({
      seasons: [{ seasonNumber: 1, episodes: [bolum({ episodeRatings: "9.4" }), bolum({ episodeRatings: 9.1 }), bolum({ episodeRatings: 7 })] }],
    })]);
    expect(stats.yuksekPuanliBolum).toBe(2);
  });

  test("film listesindeki tv artigi cift sayilmaz", () => {
    const { stats } = puanla([film(), { ...film(), type: "tv" }]);
    expect(stats.filmSayisi).toBe(1);
  });

  test("bos/bozuk girdide cokmez", () => {
    expect(() => computeWatchScore()).not.toThrow();
    expect(computeWatchScore().toplam).toBe(0);
    expect(() => puanla([{}, null], [{}, null])).not.toThrow();
    expect(() => puanla([], [{ seasons: [{ episodes: null }] }])).not.toThrow();
  });

  test("ayni veri ayni sonucu verir (turetilmislik sozlesmesi)", () => {
    const movies = [film(), film({ name: "B", dateAdded: "2026-01-11" })];
    const shows = [dizi(), { ...dizi(), id: undefined, name: undefined }];
    expect(puanla(movies, shows).toplam).toBe(puanla(movies, shows).toplam);
  });
});

describe("rozet olcutleri tek gecisten turer", () => {
  test("cift perde, tek oturusta, sadik dizi, maxGunFilm", () => {
    const movies = [film({ dateAdded: "2026-04-01" })];
    const shows = [dizi({
      showEpisodeCount: 50, watchedEpisodeCount: 8,
      seasons: [{ seasonNumber: 1, episodes: Array.from({ length: 8 }, () => bolum({ episodeWatchTime: "2026-04-01" })) }],
    })];
    const { stats } = puanla(movies, shows);
    expect(stats.ciftPerde).toBe(1);        // ayni gun 1 film + >=5 bolum
    expect(stats.tekOturusta).toBe(8);      // ayni sezonun 8 bolumu ayni gun
    expect(stats.sadikDiziGun).toBe(1);
    expect(stats.maxGunFilm).toBe(1);
  });

  test("mevsimsel ve tarihli olcutler", () => {
    const { stats } = puanla([
      film({ dateAdded: "2026-10-31", genres: ["Korku"] }),
      film({ dateAdded: "2026-02-14", genres: ["Romantik"] }),
      film({ dateAdded: "2026-01-01" }),
    ]);
    expect(stats.cadilar).toBe(1);
    expect(stats.sevgililer).toBe(1);
    expect(stats.yilDevri).toBe(1);
    expect(stats.kisGun).toBe(2);           // 14 Subat + 1 Ocak (GUN sayar)
  });

  test("ISTISMAR KAPALI: mevsimsel olcutler GUN sayar, bolum degil", () => {
    // watchedTvService.markShow tum bolumlere TEK tarih yaziyor. Bolum
    // saysaydik 120 bolumluk bir diziyi 15 Temmuz'a isaretlemek "Yaz Sezonu"
    // rozetini tek dokunusla acardi.
    const { stats } = puanla([], [{
      id: "y", name: "Yaz", genres: ["Dram"], showEpisodeCount: 120, watchedEpisodeCount: 120,
      seasons: [{ seasonNumber: 1, episodes: Array.from({ length: 120 }, () =>
        bolum({ episodeWatchTime: "2026-07-15" })) }],
    }]);
    expect(stats.bolumSayisi).toBe(120);
    expect(stats.yazGun).toBe(1);           // 120 degil
  });

  test("ISTISMAR KAPALI: tur sayaci dizide BIR eser sayar", () => {
    // "Korku turunde 25 icerik izle" yazan rozet, tek bir 26 bolumluk diziyle
    // aciliyordu; rozetin metniyle davranisi celisiyordu.
    const { stats } = puanla([], [{
      id: "k", name: "Korku Dizisi", genres: ["Korku"],
      showEpisodeCount: 26, watchedEpisodeCount: 26,
      seasons: [{ seasonNumber: 1, episodes: Array.from({ length: 26 }, () =>
        bolum({ episodeWatchTime: "2026-03-01" })) }],
    }]);
    expect(stats.turSayaci.get("horror")).toBe(1);
  });

  test("hic bolumu izlenmemis dizi tur sayacina girmez", () => {
    const { stats } = puanla([], [{ id: "z", name: "Z", genres: ["Korku"], seasons: [] }]);
    expect(stats.turSayaci.get("horror")).toBeUndefined();
  });

  test("sevgililer olcutu dizi bolumlerinde de calisir", () => {
    const { stats } = puanla([], [{
      id: "r", name: "Romantik Dizi", genres: ["Romantik"],
      showEpisodeCount: 10, watchedEpisodeCount: 1,
      seasons: [{ seasonNumber: 1, episodes: [bolum({ episodeWatchTime: "2026-02-14" })] }],
    }]);
    expect(stats.sevgililer).toBe(1);
  });

  test("cadilar rozeti KORKU turu sart", () => {
    const { stats } = puanla([film({ dateAdded: "2026-10-31", genres: ["Komedi"] })]);
    expect(stats.cadilar).toBe(0);
  });

  test("en uzun ara ve en cok ayli yil", () => {
    const { stats } = puanla([
      film({ dateAdded: "2026-01-01" }),
      film({ dateAdded: "2026-04-11" }),   // 100 gun ara
    ]);
    expect(stats.enUzunAra).toBe(100);
    expect(stats.enCokAyliYil).toBe(2);
  });

  test("harf cesitliligi Turkce buyuk harfle sayilir", () => {
    const { stats } = puanla([film({ name: "iyi Film" }), film({ name: "İyi Film" }), film({ name: "Zor" })]);
    expect(stats.harfSayisi).toBe(2);      // "İ" ve "Z"
  });
});

describe("Perde merdiveni", () => {
  test("esik ve isim tablolari hizali", () => {
    expect(PERDE_ESIK).toHaveLength(20);
    expect(PERDE_ADLARI).toHaveLength(20);
    expect(PERDE_ADLARI_EN).toHaveLength(20);
    for (let i = 1; i < PERDE_ESIK.length; i++) expect(PERDE_ESIK[i]).toBeGreaterThan(PERDE_ESIK[i - 1]);
  });

  test("sifir Kare Perde 1", () => {
    const p = computePerde(0);
    expect(p.perde).toBe(1);
    expect(p.ad).toBe("Bilet Sahibi");
    expect(p.ilerleme).toBe(0);
  });

  test("ilk film ilk seviye atlamayi GARANTI eder", () => {
    // 1 film (165) + ilk turun 75'i + gun bonusu 12 = 252 > 130
    const { toplam } = puanla([film({ minutes: 125 })]);
    expect(toplam).toBeGreaterThan(PERDE_ESIK[1]);
    expect(computePerde(toplam).perde).toBeGreaterThanOrEqual(2);
  });

  test("her esikte tam olarak o perdeye gecilir", () => {
    PERDE_ESIK.forEach((esik, i) => {
      expect(computePerde(esik).perde).toBe(i + 1);
      if (i > 0) expect(computePerde(esik - 1).perde).toBe(i);
    });
  });

  test("zirve ve Makara prestiji", () => {
    const zirve = computePerde(PERDE_ESIK[19]);
    expect(zirve.perde).toBe(20);
    expect(zirve.zirve).toBe(true);
    expect(zirve.makara).toBe(0);
    expect(computePerde(PERDE_ESIK[19] + MAKARA_ADIMI).makara).toBe(1);
    expect(computePerde(PERDE_ESIK[19] + MAKARA_ADIMI * 3 + 10).makara).toBe(3);
    expect(computePerde(PERDE_ESIK[19] + MAKARA_ADIMI * 2).ilerleme).toBe(0);
  });

  test("perdeFloor: puan dusse de Perde dusmez", () => {
    const dusuk = computePerde(500, 11);
    expect(dusuk.perde).toBe(11);
    expect(dusuk.ad).toBe("Arsivci".replace("s", "ş"));
    expect(dusuk.tabanDevrede).toBe(true);
    // Kendisiyle celisen "Perde 11'desin, Perde 11'e X kaldi" cumlesi kurulmamali
    expect(dusuk.ilerleme).toBe(1);
    expect(dusuk.kalanKare).toBe(0);
  });

  test("perdeFloor gercek perdeden kucukse etkisiz", () => {
    const p = computePerde(PERDE_ESIK[9], 3);
    expect(p.perde).toBe(10);
    expect(p.tabanDevrede).toBe(false);
  });

  test("renk bandi 5 kademe, 4 perdede bir", () => {
    expect(computePerde(0).banded).toBe(1);
    expect(computePerde(PERDE_ESIK[3]).banded).toBe(1);   // Perde 4
    expect(computePerde(PERDE_ESIK[4]).banded).toBe(2);   // Perde 5
    expect(computePerde(PERDE_ESIK[19]).banded).toBe(5);  // Perde 20
  });

  test("negatif ve bozuk girdi Perde 1", () => {
    expect(computePerde(-5000).perde).toBe(1);
    expect(computePerde(NaN).perde).toBe(1);
    expect(computePerde(undefined).perde).toBe(1);
  });
});

describe("anomali elemesi", () => {
  test("tek gune yigilma bayraklanir", () => {
    const movies = Array.from({ length: 200 }, () => film({ dateAdded: "2026-02-01" }));
    const { stats } = puanla(movies);
    expect(detectAnomalies(stats)).toContain("tek_gune_yigilma");
  });

  test("normal kullanicida bayrak yok", () => {
    const movies = Array.from({ length: 30 }, (_, i) => film({ dateAdded: gunKey(new Date(2026, 0, 1 + i)) }));
    const { stats } = puanla(movies);
    expect(detectAnomalies(stats)).toHaveLength(0);
  });
});

describe("kalibrasyon: gercek kullanici profilleri dogru Perde bandina dusuyor", () => {
  // Bu blok merdivenin ISLEVSEL sozlesmesidir. Katsayi ya da esik degistiginde
  // burasi kirilmali: "ilk film seviye atlatir" ve "agir kullanici zirveye
  // varmaz" iddialarini elle hesap degil, motorun kendisi dogrular.
  const TURLER = ["Dram", "Komedi", "Aksiyon", "Korku", "Bilim Kurgu", "Gerilim", "Suç",
    "Macera", "Animasyon", "Belgesel", "Romantik", "Fantastik", "Tarih", "Müzik",
    "Gizem", "Savaş", "Aile", "Vahşi Batı", "Realite", "TV Film"];
  const g = (yil, ofset) => gunKey(new Date(yil, 0, 1 + ofset));

  const kullanici = ({ filmler = 0, filmDk = 125, bolumler = 0, bolumDk = 45,
                       gunler = 100, seri = 1, turler = 5, bitenDizi = 0, yil = 2021 }) => {
    const havuz = Array.from({ length: gunler }, (_, i) => g(yil, i < seri ? i : seri + (i - seri) * 3));
    const movies = Array.from({ length: filmler }, (_, i) => film({
      name: `F${i}`, minutes: filmDk, genres: [TURLER[i % turler]], dateAdded: havuz[i % gunler],
    }));
    const shows = [];
    let kalan = bolumler;
    for (let d = 0; d < bitenDizi && kalan > 0; d++) {
      const adet = Math.min(kalan, Math.max(2, Math.floor(bolumler / bitenDizi / 2)));
      kalan -= adet;
      shows.push({
        id: `bitmis${d}`, name: `Bitmis ${d}`, genres: [TURLER[d % turler]],
        showEpisodeCount: adet, watchedEpisodeCount: adet,
        seasons: [{ seasonNumber: 1, episodes: Array.from({ length: adet }, (_, e) =>
          bolum({ episodeMinutes: bolumDk, episodeWatchTime: havuz[(d * 7 + e) % gunler] })) }],
      });
    }
    if (kalan > 0) {
      shows.push({
        id: "devam", name: "Devam", genres: [TURLER[0]],
        showEpisodeCount: kalan * 5, watchedEpisodeCount: kalan,
        seasons: [{ seasonNumber: 1, episodes: Array.from({ length: kalan }, (_, e) =>
          bolum({ episodeMinutes: bolumDk, episodeWatchTime: havuz[e % gunler] })) }],
      });
    }
    return puanla(movies, shows);
  };

  test("ilk oturum: tek film seviye atlatir", () => {
    const { toplam } = kullanici({ filmler: 1, filmDk: 139, gunler: 1, turler: 1 });
    expect(computePerde(toplam).perde).toBe(2);
  });

  test("kayitsiz kullanici (ayda 2 film, 1 yil) merdivenin alt yarisinda", () => {
    const { toplam } = kullanici({ filmler: 24, filmDk: 110, gunler: 24, turler: 6 });
    const p = computePerde(toplam).perde;
    expect(p).toBeGreaterThanOrEqual(5);
    expect(p).toBeLessThanOrEqual(7);
  });

  test("duzenli dizi izleyicisi (620 bolum, 6 ay) orta bantta", () => {
    const { toplam } = kullanici({ filmler: 12, bolumler: 620, gunler: 180, seri: 14, turler: 9, bitenDizi: 3 });
    const p = computePerde(toplam).perde;
    expect(p).toBeGreaterThanOrEqual(10);
    expect(p).toBeLessThanOrEqual(12);
  });

  test("sinefil (480 film, 3 yil) ust bantta ama zirvede degil", () => {
    const { toplam } = kullanici({ filmler: 480, filmDk: 118, gunler: 400, seri: 9, turler: 14 });
    const p = computePerde(toplam).perde;
    expect(p).toBeGreaterThanOrEqual(15);
    expect(p).toBeLessThanOrEqual(17);
  });

  test("MEVCUT agir kullanici (512 film + 3400 bolum, 5 yil) merdiveni BITIRMEZ", () => {
    // Sistemin en onemli kalibrasyon iddiasi: uygulamanin bugunku en agir
    // kullanicisi ozelligi ilk actigi gun Perde 20'ye oturmamali, yoksa
    // merdiven onun icin dogdugu gun olur.
    const { toplam } = kullanici({ filmler: 512, bolumler: 3400, gunler: 900, seri: 46, turler: 19, bitenDizi: 21 });
    const p = computePerde(toplam);
    expect(toplam).toBeGreaterThan(200000);
    expect(p.perde).toBe(19);
    expect(p.zirve).toBe(false);
    expect(p.kalanKare).toBeGreaterThan(20000);
  });

  test("esik farklari monoton buyur (geri gidis yok)", () => {
    const farklar = PERDE_ESIK.slice(1).map((e, i) => e - PERDE_ESIK[i]);
    for (let i = 1; i < farklar.length; i++) expect(farklar[i]).toBeGreaterThanOrEqual(farklar[i - 1]);
  });

  test("ust yarida ani duvar yok", () => {
    // Oran kisiti yalnizca mutlak olarak hissedilir adimlarda anlamli.
    // P2→P3 orani 2,85x'tir (130→370 Kare) ama iki adim da tek film mesafesinde
    // oldugu icin kullanici bunu "duvar" olarak yasamaz. Asil risk ust yarida
    // aylar suren bir adimin bir anda ikiye katlanmasidir.
    const farklar = PERDE_ESIK.slice(1).map((e, i) => e - PERDE_ESIK[i]);
    for (let i = 1; i < farklar.length; i++) {
      if (farklar[i - 1] < 1000) continue;
      expect(farklar[i] / farklar[i - 1]).toBeLessThanOrEqual(1.6);
    }
  });
});

describe("olcek ve performans", () => {
  test("512 film + 3400 bolum tek gecisi 150 ms altinda", () => {
    const movies = Array.from({ length: 512 }, (_, i) =>
      film({ name: `F${i}`, minutes: 90 + (i % 60), dateAdded: gunKey(new Date(2021, 0, 1 + (i % 900))) }));
    const shows = Array.from({ length: 40 }, (_, s) => ({
      id: s, name: `Dizi ${s}`, genres: ["Drama", "Suç"], showEpisodeCount: 85, watchedEpisodeCount: 85,
      seasons: Array.from({ length: 5 }, (_, sz) => ({
        seasonNumber: sz + 1,
        episodes: Array.from({ length: 17 }, (_, e) => bolum({
          episodeMinutes: e % 7 === 0 ? 0 : 45,
          episodeWatchTime: gunKey(new Date(2021, 0, 1 + ((s * 17 + e) % 900))),
        })),
      })),
    }));
    const t0 = process.hrtime.bigint();
    const { stats } = computeWatchScore({ movies, shows, kanonikTur });
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;

    expect(stats.filmSayisi).toBe(512);
    expect(stats.bolumSayisi).toBe(3400);
    expect(ms).toBeLessThan(150);
  });
});

describe("hesapYasiYil — kidem rozetlerinin sahtelenemez olcutu", () => {
  // Girdi Firebase Auth'un metadata.creationTime'i: RFC-1123 dizesi.
  const RFC = "Mon, 21 Jul 2025 10:00:00 GMT";

  test("RFC-1123 dizesini cozer", () => {
    expect(hesapYasiYil(RFC, new Date(2026, 6, 21).getTime())).toBe(1);
    expect(hesapYasiYil(RFC, new Date(2030, 6, 21).getTime())).toBe(5);
  });

  test("yil donumu GELMEDIYSE eksiltir — 31 Aralik hesabi ertesi gun 1 yil olmaz", () => {
    const yilbasi = new Date(2025, 11, 31, 12).toISOString();
    expect(hesapYasiYil(yilbasi, new Date(2026, 0, 1).getTime())).toBe(0);
    expect(hesapYasiYil(yilbasi, new Date(2026, 11, 30).getTime())).toBe(0);
    expect(hesapYasiYil(yilbasi, new Date(2026, 11, 31).getTime())).toBe(1);
  });

  test("ay siniri dogru: ayni ayin bir onceki gunu henuz doldurmaz", () => {
    const d = new Date(2024, 4, 15, 8).toISOString();          // 15 Mayis 2024
    expect(hesapYasiYil(d, new Date(2025, 4, 14).getTime())).toBe(0);
    expect(hesapYasiYil(d, new Date(2025, 4, 15).getTime())).toBe(1);
    expect(hesapYasiYil(d, new Date(2025, 3, 30).getTime())).toBe(0);   // onceki ay
  });

  test("29 Subat hesabi artik olmayan yilda da 1 Mart'a kadar beklemez", () => {
    // 29 Subat 2024 -> 28 Subat 2025'te henuz dolmamis, 1 Mart 2025'te dolmus.
    const artik = new Date(2024, 1, 29, 12).toISOString();
    expect(hesapYasiYil(artik, new Date(2025, 1, 28).getTime())).toBe(0);
    expect(hesapYasiYil(artik, new Date(2025, 2, 1).getTime())).toBe(1);
  });

  test("bozuk / eksik / ileri tarihli girdi 0 doner, ASLA negatif olmaz", () => {
    const simdi = new Date(2026, 6, 21).getTime();
    for (const girdi of [null, undefined, "", "cop", 0, {}, []]) {
      expect(hesapYasiYil(girdi, simdi)).toBe(0);
    }
    // Cihaz saati geri alinmis olabilir; gelecek tarihli hesap 0'dir.
    expect(hesapYasiYil(new Date(2030, 0, 1).toISOString(), simdi)).toBe(0);
  });

  test("Date, epoch ms ve Firestore Timestamp bicimlerini de kabul eder", () => {
    const simdi = new Date(2027, 0, 1).getTime();
    const d = new Date(2024, 0, 1, 12);
    expect(hesapYasiYil(d, simdi)).toBe(3);
    expect(hesapYasiYil(d.getTime(), simdi)).toBe(3);
    expect(hesapYasiYil({ seconds: Math.floor(d.getTime() / 1000) }, simdi)).toBe(3);
  });
});
