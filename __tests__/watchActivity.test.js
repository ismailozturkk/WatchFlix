// __tests__/watchActivity.test.js
// Aktiflik serisi: "art arda kac hafta uygulamada bir sey isaretledin".
// Olcut cihaz saatiyle GERCEK isaretleme ani; kullanicinin sectigi izleme
// tarihi DEGIL (o geriye donuk tamir edilebiliyor, seri gerilimini oldururdu).

const {
  GUN_TUT, gunIndexi, haftaIndexi, haftaninGunu,
  bugunAnahtari, aktifGunEkle, serileriHesapla,
} = require("../utils/watchActivity");

// Sabit "su an": 15 Temmuz 2026, Carsamba.
const CARSAMBA = new Date(2026, 6, 15, 12).getTime();
const gun = (y, a, g) => `${y}-${String(a).padStart(2, "0")}-${String(g).padStart(2, "0")}`;
// n gun once/sonra
const kaydir = (anahtar, n) => {
  const [y, a, g] = anahtar.split("-").map(Number);
  const d = new Date(Date.UTC(y, a - 1, g + n));
  return gun(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
};

describe("hafta indeksi PAZARTESI baslangicli", () => {
  test("1 Ocak 1970 Persembe, indeks 0", () => {
    expect(gunIndexi("1970-01-01")).toBe(0);
    expect(haftaninGunu(0)).toBe(3);            // Pazartesi=0 → Persembe=3
  });

  test("Pazar ile Pazartesi FARKLI haftalarda", () => {
    const pazar = gunIndexi("2026-07-12");
    const pazartesi = gunIndexi("2026-07-13");
    expect(haftaninGunu(pazar)).toBe(6);
    expect(haftaninGunu(pazartesi)).toBe(0);
    expect(haftaIndexi(pazartesi)).toBe(haftaIndexi(pazar) + 1);
  });

  test("ayni haftanin Pazartesi-Pazar araligi tek indeks", () => {
    const pzt = gunIndexi("2026-07-13");
    for (let i = 0; i < 7; i++) expect(haftaIndexi(pzt + i)).toBe(haftaIndexi(pzt));
    expect(haftaIndexi(pzt + 7)).toBe(haftaIndexi(pzt) + 1);
  });

  test("yil siniri hafta serisini KIRMAZ (ISO hafta NUMARASI kullanilmiyor)", () => {
    // 52. hafta -> 1. hafta gecisi numara bazli hesapta ardisikligi bozardi.
    const a = haftaIndexi(gunIndexi("2026-12-28"));   // Pazartesi
    const b = haftaIndexi(gunIndexi("2027-01-04"));   // Pazartesi
    expect(b).toBe(a + 1);
  });

  test("bozuk anahtar NaN doner, hesaba girmez", () => {
    expect(Number.isNaN(gunIndexi("cop"))).toBe(true);
    expect(Number.isNaN(gunIndexi(""))).toBe(true);
    expect(Number.isNaN(gunIndexi("2026-7-1"))).toBe(true);   // sifir dolgusuz
  });
});

describe("bugunAnahtari cihaz saatinden LOKAL gun uretir", () => {
  test("beklenen bicim", () => {
    expect(bugunAnahtari(CARSAMBA)).toBe("2026-07-15");
    expect(bugunAnahtari(new Date(2026, 0, 5, 23, 59).getTime())).toBe("2026-01-05");
  });
});

describe("aktifGunEkle", () => {
  test("tekillestirir ve siralar", () => {
    expect(aktifGunEkle(["2026-07-15", "2026-07-13"], "2026-07-15"))
      .toEqual(["2026-07-13", "2026-07-15"]);
  });

  test("bozuk girdileri ayiklar", () => {
    expect(aktifGunEkle(["cop", null, 5, "2026-07-13"], "2026-07-14"))
      .toEqual(["2026-07-13", "2026-07-14"]);
  });

  test("pencereyi budar, EN YENILERI tutar", () => {
    const cok = Array.from({ length: 10 }, (_, i) => kaydir("2026-01-01", i));
    const r = aktifGunEkle(cok, "2026-01-11", 5);
    expect(r).toHaveLength(5);
    expect(r[r.length - 1]).toBe("2026-01-11");
    expect(r[0]).toBe("2026-01-07");
  });

  test("varsayilan pencere 400 gun", () => {
    expect(GUN_TUT).toBe(400);
  });
});

describe("mevcut seri — TOLERANSLI ama tamir edilemez", () => {
  test("bugun isaretlenmisse gun serisi sayar", () => {
    const gunler = ["2026-07-13", "2026-07-14", "2026-07-15"];
    const s = serileriHesapla(gunler, { simdi: CARSAMBA });
    expect(s.gunSerisi).toBe(3);
    expect(s.bugunAktif).toBe(true);
  });

  test("bugun HENUZ isaretlenmediyse seri BOZULMAZ (1 birim tolerans)", () => {
    // Tolerans olmadan seri her sabah sifirlanmis gorunurdu.
    const s = serileriHesapla(["2026-07-13", "2026-07-14"], { simdi: CARSAMBA });
    expect(s.gunSerisi).toBe(2);
    expect(s.bugunAktif).toBe(false);
  });

  test("iki gun bosluk seriyi BITIRIR", () => {
    const s = serileriHesapla(["2026-07-11", "2026-07-12"], { simdi: CARSAMBA });
    expect(s.gunSerisi).toBe(0);
  });

  test("hafta serisi gun bosluklarini AFFEDER", () => {
    // Her haftada tek bir isaretleme yeter — insanlar her gun film izlemez.
    const gunler = ["2026-06-30", "2026-07-07", "2026-07-14"];   // 3 ardisik hafta
    const s = serileriHesapla(gunler, { simdi: CARSAMBA });
    expect(s.haftaSerisi).toBe(3);
    // Ayni veri gunluk olcutte neredeyse hicbir sey: son isaretleme dun
    // oldugu icin 1, ondan oncesi 7 gun uzakta. Haftalik tabani secmemizin
    // sebebi tam olarak bu fark — bu kullanici duzenli, gunluk olcut onu
    // "serisi yok" diye cezalandirirdi.
    expect(s.gunSerisi).toBe(1);
    expect(s.rekorGun).toBe(1);
  });

  test("bir hafta tamamen atlanirsa hafta serisi kirilir", () => {
    const gunler = ["2026-06-29", "2026-07-13"];   // aradaki hafta bos
    const s = serileriHesapla(gunler, { simdi: CARSAMBA });
    expect(s.haftaSerisi).toBe(1);
  });

  test("gecen hafta isaretleyip bu hafta henuz yapmamak seriyi BOZMAZ", () => {
    const s = serileriHesapla(["2026-07-06"], { simdi: CARSAMBA });
    expect(s.haftaSerisi).toBe(1);
  });

  test("iki hafta once kalan kayit seriyi bitirir", () => {
    const s = serileriHesapla(["2026-06-29"], { simdi: CARSAMBA });
    expect(s.haftaSerisi).toBe(0);
  });

  test("bos liste sifir doner, atmaz", () => {
    const s = serileriHesapla([], { simdi: CARSAMBA });
    expect(s).toEqual(expect.objectContaining({
      gunSerisi: 0, haftaSerisi: 0, rekorGun: 0, rekorHafta: 0, aktifGunSayisi: 0,
    }));
    expect(serileriHesapla(null, { simdi: CARSAMBA }).gunSerisi).toBe(0);
    expect(serileriHesapla(["cop", null], { simdi: CARSAMBA }).gunSerisi).toBe(0);
  });
});

describe("rekor MONOTON — mevcut seri duser, rekor dusmez", () => {
  test("defterdeki gecmis rekor pencere disinda kalsa da korunur", () => {
    // 400 gunluk pencere budandiginda eski rekor listede yoktur; defterden
    // gelen sayi olmasa sessizce silinirdi.
    const s = serileriHesapla(["2026-07-14"], { simdi: CARSAMBA, rekorGun: 47, rekorHafta: 31 });
    expect(s.rekorGun).toBe(47);
    expect(s.rekorHafta).toBe(31);
    expect(s.gunSerisi).toBe(1);          // ...ama MEVCUT seri gercegi soyler
  });

  test("pencere ici hesap gecmis rekoru asarsa yukselir", () => {
    const gunler = Array.from({ length: 9 }, (_, i) => kaydir("2026-07-07", i));
    const s = serileriHesapla(gunler, { simdi: CARSAMBA, rekorGun: 4, rekorHafta: 1 });
    expect(s.rekorGun).toBe(9);
    expect(s.rekorHafta).toBe(2);
  });

  test("bozuk rekor degerleri 0'a duser, negatif olmaz", () => {
    const s = serileriHesapla([], { simdi: CARSAMBA, rekorGun: -9, rekorHafta: "cop" });
    expect(s.rekorGun).toBe(0);
    expect(s.rekorHafta).toBe(0);
  });
});

describe("haftanin 7 kutucugu (gunluk gorsel)", () => {
  test("Pazartesi'den Pazar'a dizilir, aktif gunler isaretli", () => {
    // 2026-07-15 Carsamba; o haftanin Pazartesisi 13 Temmuz.
    const s = serileriHesapla(["2026-07-13", "2026-07-15"], { simdi: CARSAMBA });
    expect(s.haftaKutulari).toEqual([true, false, true, false, false, false, false]);
  });

  test("gecen haftanin gunleri BU haftanin kutucuklarini doldurmaz", () => {
    const s = serileriHesapla(["2026-07-08"], { simdi: CARSAMBA });
    expect(s.haftaKutulari).toEqual([false, false, false, false, false, false, false]);
  });

  test("Pazar gunu son kutucuktur", () => {
    const pazar = new Date(2026, 6, 19, 12).getTime();
    const s = serileriHesapla(["2026-07-19"], { simdi: pazar });
    expect(s.haftaKutulari[6]).toBe(true);
    expect(s.haftaKutulari.slice(0, 6).some(Boolean)).toBe(false);
  });
});

describe("gercekci senaryo: haftada bir isaretleyen kullanici", () => {
  test("52 hafta boyunca haftada bir isaretlemek 52 hafta seri verir", () => {
    const gunler = Array.from({ length: 52 }, (_, i) => kaydir("2025-07-16", i * 7));
    const s = serileriHesapla(gunler, { simdi: new Date(2026, 6, 15, 12).getTime() });
    expect(s.rekorHafta).toBe(52);
    expect(s.haftaSerisi).toBe(52);
    expect(s.rekorGun).toBe(1);          // ...ama gunluk olcutte hicbir sey yok
  });
});
