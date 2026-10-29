// __tests__/streakProtection.test.js
//
// Günlük seri KORUMASI (utils/watchActivity.js seriKorumasiniIlerlet):
//   • TELAFİ — bir gün kaçarsa ertesi gün NET 2 içerik → kaçan gün dolar (7 günde bir)
//   • KALKAN — her ay kademesinde 1 (en fazla 2); telafi edilemeyen günü kendiliğinden korur
//   • seri sayısı yalan söylemez: korunmayan kopuş geri gelmez, geçmiş sonradan iyileşmez
//   • gün 04:00'te döner (gece yarısından sonraki izleme "dün gece")
// Ve uçtan uca: defter mutabakatı kararları diske yazar (utils/watchBadgeLedger.js).

import { __resetAllMMKV } from "react-native-mmkv";

const {
  KALKAN_TAVANI, TELAFI_ARALIGI,
  gunIndexi, indekstenGun, seriGunuAnahtari, seriKorumasiniIlerlet, serileriHesapla, ayniSeriler,
} = require("../utils/watchActivity");
const { bosKoruma } = require("../utils/watchLedgerCore");
const { loadLedger, reconcileLedger } = require("../utils/watchBadgeLedger");

const D = "2026-07-15";
const g = (n) => indekstenGun(gunIndexi(D) + n); // D'ye göre gün: g(-1) = dün
// `son` gününde biten `n` günlük ardışık liste.
const kosu = (son, n) => Array.from({ length: n }, (_, i) => g(son - n + 1 + i));
// D günü öğlen (seri günü = D).
const OGLEN = new Date(2026, 6, 15, 12).getTime();
const koruma = (ek = {}) => ({ ...bosKoruma(), ...ek });
const hesap = (gunler, k, gunluk = {}) => serileriHesapla(gunler, { simdi: OGLEN, koruma: k, gunluk });

describe("gün dönümü 04:00", () => {
  test("00:00–03:59 bir önceki seri gününe sayılır, 04:00'te yeni gün", () => {
    expect(seriGunuAnahtari(new Date(2026, 6, 16, 1, 30).getTime())).toBe("2026-07-15");
    expect(seriGunuAnahtari(new Date(2026, 6, 16, 3, 59).getTime())).toBe("2026-07-15");
    expect(seriGunuAnahtari(new Date(2026, 6, 16, 4, 0).getTime())).toBe("2026-07-16");
  });

  test("indekstenGun gunIndexi'nin tersi", () => {
    for (const k of ["1970-01-01", "2024-02-29", "2026-12-31"]) expect(indekstenGun(gunIndexi(k))).toBe(k);
  });
});

describe("koruma kapalıyken (koruma verilmezse) davranış eskisiyle aynı", () => {
  test("koruma alanları dönmez", () => {
    const s = serileriHesapla(kosu(-1, 5), { simdi: OGLEN });
    expect(s.gunSerisi).toBe(5);
    expect(s).not.toHaveProperty("bekleyen");
    expect(s).not.toHaveProperty("kalkan");
  });
});

describe("TELAFİ: dün kaçtı, bugün 2 içerik", () => {
  const gunler = [...kosu(-2, 10), g(0)];

  test("bugün 1 içerik → bekliyor (1/2), seri kurtarılabilir; gösterilecek seri 10", () => {
    const s = hesap(gunler, koruma({ islenen: g(-3) }), { [D]: { taban: 0, kazanim: 1 } });
    expect(s.bekleyen).toEqual({ gun: g(-1), telafi: true, kalkan: false, gerekli: 2, mevcut: 1, korunanSeri: 10 });
  });

  test("bugün 2 içerik → dün dolar, seri 12 (10 + telafi + bugün)", () => {
    const s = hesap(gunler, koruma({ islenen: g(-3) }), { [D]: { taban: 0, kazanim: 2 } });
    expect(s.bekleyen).toBeNull();
    expect(s.gunSerisi).toBe(12);
    expect(s.sonYama).toEqual({ gun: g(-1), tur: "telafi" });
    expect(s.telafiHazir).toBe(false);
    expect(s.telafiYenilenme).toBe(TELAFI_ARALIGI - 1);
  });

  test("haftada bir: 7 gün içinde ikinci telafi YOK", () => {
    const k = koruma({ islenen: g(-2), yamalar: { [g(-4)]: "telafi" } });
    const liste = [...kosu(-5, 10), g(-3), g(-2), g(0)];
    const s = hesap(liste, k, { [D]: { taban: 0, kazanim: 5 } });
    expect(s.bekleyen).toBeNull();      // ne telafi ne kalkan: kayıp
    expect(s.gunSerisi).toBe(1);        // yalnız bugün
    expect(s.telafiYenilenme).toBe(3);  // son telafiden 7 gün sonra
  });

  test("3 günden kısa seri korunmaz (alev yokken telafi yok)", () => {
    const s = hesap([g(-3), g(-2), g(0)], koruma({ islenen: g(-3) }), { [D]: { taban: 0, kazanim: 4 } });
    expect(s.gunSerisi).toBe(1);
    expect(s.bekleyen).toBeNull();
  });

  test("dün geçtiyse (2 gün önce kaçan gün) telafi artık mümkün değil", () => {
    const liste = [...kosu(-3, 10), g(-1), g(0)];
    const s = hesap(liste, koruma({ islenen: g(-3) }), {
      [g(-1)]: { taban: 0, kazanim: 1 },
      [D]: { taban: 1, kazanim: 3 },
    });
    expect(s.gunSerisi).toBe(2); // dün + bugün; 10 günlük seri koptu
  });
});

describe("KALKAN: kontrol noktası", () => {
  test("her ay kademesinde 1 kalkan, en fazla 2", () => {
    let k = koruma({ islenen: g(-1) });
    expect(seriKorumasiniIlerlet({ gunler: kosu(0, 29), koruma: k }, D).koruma.kalkan).toBe(0);
    const r30 = seriKorumasiniIlerlet({ gunler: kosu(0, 30), koruma: k }, D);
    expect(r30.koruma).toMatchObject({ kalkan: 1, kalkanAy: 1 });
    expect(r30.kazanilanKalkan).toBe(1);
    k = koruma({ islenen: g(-1), kalkan: 2, kalkanAy: 2 });
    const r90 = seriKorumasiniIlerlet({ gunler: kosu(0, 90), koruma: k }, D);
    expect(r90.koruma).toMatchObject({ kalkan: KALKAN_TAVANI, kalkanAy: 3 });
  });

  test("telafi edilemeyen gün kalkanla dolar; seri sürer", () => {
    // 35 gün → 3 gün önce bitti; dün 1 içerik (telafiye yetmez), bugün de aktif.
    const liste = [...kosu(-3, 35), g(-1), g(0)];
    const s = hesap(liste, koruma({ islenen: g(-3), kalkan: 1, kalkanAy: 1 }), {
      [g(-1)]: { taban: 0, kazanim: 1 },
    });
    expect(s.gunSerisi).toBe(38);
    expect(s.kalkan).toBe(0);
    expect(s.sonYama).toEqual({ gun: g(-2), tur: "kalkan" });
  });

  test("iki kalkan iki günlük yokluğu karşılar; ikinci gün bugün telafi bekler", () => {
    const liste = [...kosu(-3, 70), g(0)];
    const s = hesap(liste, koruma({ islenen: g(-3), kalkan: 2, kalkanAy: 2 }), { [D]: { taban: 0, kazanim: 1 } });
    expect(s.kalkan).toBe(1); // g(-2) kalkanla doldu
    expect(s.bekleyen).toMatchObject({ gun: g(-1), telafi: true, kalkan: true, korunanSeri: 71 });
  });

  test("kalkan yoksa kopuş kalıcı ve kontrol noktaları sıfırdan sayılır", () => {
    const r = seriKorumasiniIlerlet(
      { gunler: [...kosu(-4, 40)], koruma: koruma({ islenen: g(-4), kalkan: 0, kalkanAy: 1 }) },
      D,
    );
    expect(r.yeniYamalar).toEqual([]);
    expect(r.koruma.kalkanAy).toBe(0);
  });
});

describe("dürüstlük", () => {
  test("ilk etkinleşmede geçmiş iyileşmez; süren serinin ayları kadar kalkan verilir", () => {
    // Eski kopuş (5 gün önce) dokunulmadan kalır.
    const eski = seriKorumasiniIlerlet({ gunler: [...kosu(-6, 20), ...kosu(0, 4)], koruma: bosKoruma() }, D);
    expect(eski.yeniYamalar).toEqual([]);
    // 65 günlük süren seri → 2 kalkan (tavan).
    const suren = seriKorumasiniIlerlet({ gunler: kosu(0, 65), koruma: bosKoruma() }, D);
    expect(suren.koruma).toMatchObject({ kalkan: 2, kalkanAy: 2 });
    expect(suren.kazanilanKalkan).toBe(0); // hediye kutlanmaz, yalnız kurulur
  });

  test("idempotent: ikinci çağrı hiçbir şey değiştirmez", () => {
    const girdi = { gunler: [...kosu(-3, 35), g(-1), g(0)], gunluk: {}, koruma: koruma({ islenen: g(-3), kalkan: 1, kalkanAy: 1 }) };
    const bir = seriKorumasiniIlerlet(girdi, D);
    const iki = seriKorumasiniIlerlet({ ...girdi, koruma: bir.koruma }, D);
    expect(iki.koruma).toEqual(bir.koruma);
    expect(iki.yeniYamalar).toEqual([]);
  });

  test("ayniSeriler bekleyen ilerlemesini (1/2 → 2/2) fark eder", () => {
    const gunler = [...kosu(-2, 10), g(0)];
    const a = hesap(gunler, koruma({ islenen: g(-3) }), { [D]: { taban: 0, kazanim: 1 } });
    const b = hesap(gunler, koruma({ islenen: g(-3) }), { [D]: { taban: 0, kazanim: 1 } });
    const c = hesap(gunler, koruma({ islenen: g(-3) }), { [D]: { taban: 0, kazanim: 2 } });
    expect(ayniSeriler(a, b)).toBe(true);
    expect(ayniSeriler(a, c)).toBe(false);
  });
});

describe("uçtan uca: defter mutabakatı telafiyi diske yazar", () => {
  const UID = "seri-koruma";
  const tum = [];
  const mutabakat = (sayim) =>
    reconcileLedger(UID, { badgeIds: [], tumIds: tum, perde: 1, makara: 0, kare: 0, icerikSayisi: sayim });

  beforeEach(() => {
    __resetAllMMKV();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  test("4 gün izle, 1 gün atla, ertesi gün 2 içerik → seri 6, yama kalıcı", async () => {
    jest.setSystemTime(new Date(2026, 6, 1, 20));
    await mutabakat(0); // sessiz tohumlama
    for (let gun = 1; gun <= 4; gun++) {
      jest.setSystemTime(new Date(2026, 6, gun, 21));
      await mutabakat(gun);
    }
    // 5 Temmuz: hiçbir şey. 6 Temmuz: önce 1 içerik — bekliyor.
    jest.setSystemTime(new Date(2026, 6, 6, 20));
    let r = await mutabakat(5);
    expect(r.seriler.bekleyen).toMatchObject({ gun: "2026-07-05", mevcut: 1, korunanSeri: 4 });
    // İkinci içerik — kurtarıldı.
    jest.setSystemTime(new Date(2026, 6, 6, 22));
    r = await mutabakat(6);
    expect(r.seriler.bekleyen).toBeNull();
    expect(r.seriler.gunSerisi).toBe(6);
    expect(r.seriler.sonYama).toEqual({ gun: "2026-07-05", tur: "telafi" });
    const defter = await loadLedger(UID);
    expect(defter.aktiflik.koruma.yamalar).toEqual({ "2026-07-05": "telafi" });
    expect(defter.aktiflik.rekorGun).toBe(6);
    // 7 Temmuz 01:30 — hâlâ 6 Temmuz'un gecesi: yeni gün açılmaz.
    jest.setSystemTime(new Date(2026, 6, 7, 1, 30));
    r = await mutabakat(7);
    expect((await loadLedger(UID)).aktiflik.gunler).not.toContain("2026-07-07");
    expect(r.seriler.gunSerisi).toBe(6);
  });
});
