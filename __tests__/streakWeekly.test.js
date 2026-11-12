// __tests__/streakWeekly.test.js
//
// Haftalık seri çekirdeği (utils/streakWeekly.js) + zaman (sunucu saati, ev saat
// dilimi) + bulut birleştirme + hatırlatma planı + defter mutabakatı.

import { __resetAllMMKV } from "react-native-mmkv";
import AsyncStorage from "@react-native-async-storage/async-storage";

const {
  alevIlerlet, alevHesapla, alevBirlestir, alevOku,
  HAFTA_ESIGI, TELAFI_GUN_ESIGI, KALKAN_HAFTA, KALKAN_TAVANI_HAFTA,
} = require("../utils/streakWeekly");
const {
  gunIndexi, indekstenGun, haftaIndexi, seriGunuAnahtari, saatDilimiGuncelle, SAAT_DILIMI_ARALIK_MS,
} = require("../utils/watchActivity");
const { planStreakReminder, REMINDER_HOUR } = require("../utils/streakReminder");
const { getStreakFlameCopy } = require("../utils/streakFlameCopy");
const { streakBridgeKaydet, streakBridgeSifirla } = require("../utils/streakBridge");
const { __resetStoreCaches } = require("../services/storage/store");
const { __resetStores } = require("../services/storage/instances");
const {
  loadLedger, reconcileLedger, saveLedger, bulutuBirlestir, bulutVerisi, resetWatchLedger,
} = require("../utils/watchBadgeLedger");

// 2026-11-09 Pazartesi. Hafta indeksi H0 = o hafta.
const PZT = gunIndexi("2026-11-09");
const H0 = haftaIndexi(PZT);
const g = (hafta, gunNo) => indekstenGun(PZT + (hafta - H0) * 7 + gunNo); // gunNo 0=Pzt
// Haftalar listesi → gün listesi: { [hafta]: gün sayısı }
const gunlerOf = (harita) => Object.entries(harita)
  .flatMap(([h, n]) => Array.from({ length: n }, (_, i) => g(Number(h), i)))
  .sort();

describe("başarılı hafta ve seri", () => {
  test("haftada 2 farklı gün = başarılı; 1 gün yetmez", () => {
    expect(HAFTA_ESIGI).toBe(2);
    const gunler = gunlerOf({ [H0 - 3]: 2, [H0 - 2]: 3, [H0 - 1]: 2 });
    const d = alevHesapla({ gunler }, g(H0, 0));
    expect(d).toMatchObject({ seri: 3, buHaftaGun: 0, buHaftaBasarili: false, bekleyen: null });
    const d2 = alevHesapla({ gunler: [...gunler, g(H0, 0), g(H0, 2)] }, g(H0, 2));
    expect(d2).toMatchObject({ seri: 4, buHaftaGun: 2, buHaftaBasarili: true });
  });

  test("süren hafta seriyi bozmaz (yalnız hafta bitince karar)", () => {
    const gunler = gunlerOf({ [H0 - 1]: 2, [H0]: 1 });
    expect(alevHesapla({ gunler }, g(H0, 6)).seri).toBe(1);
  });
});

describe("esnek hafta (telafi) ve kalkan", () => {
  // Kalıcı bir imleçle (önceden işlenmiş) ilerletmek için yardımcı.
  const ilerlet = (harita, bugun, alev) => alevIlerlet({ gunler: gunlerOf(harita), alev }, bugun);

  test("kaçan hafta hemen koparmaz: bu hafta karar bekler", () => {
    const harita = { [H0 - 4]: 2, [H0 - 3]: 2, [H0 - 2]: 2 };
    const ilk = ilerlet(harita, g(H0 - 2, 6)).alev; // imleç kur
    const d = alevHesapla({ gunler: gunlerOf({ ...harita, [H0]: 1 }), alev: ilk }, g(H0, 1));
    expect(d.seri).toBe(0);
    expect(d.bekleyen).toMatchObject({ korunanSeri: 3, gerekli: TELAFI_GUN_ESIGI, mevcut: 1, kalkan: false });
  });

  test("ertesi hafta 4 gün → telafi, seri sürer", () => {
    const harita = { [H0 - 4]: 2, [H0 - 3]: 2, [H0 - 2]: 2 };
    const ilk = ilerlet(harita, g(H0 - 2, 6)).alev;
    const r = ilerlet({ ...harita, [H0]: 4 }, g(H0, 3), ilk);
    expect(r.yeniYamalar).toEqual([{ hafta: H0 - 1, tur: "telafi" }]);
    expect(alevHesapla({ gunler: gunlerOf({ ...harita, [H0]: 4 }), alev: r.alev }, g(H0, 3)).seri).toBe(5);
  });

  test("telafisiz biten ertesi hafta: kalkan varsa korur, yoksa kopar", () => {
    const harita = { [H0 - 5]: 2, [H0 - 4]: 2, [H0 - 3]: 2, [H0 - 1]: 2 };
    const ilk = ilerlet(harita, g(H0 - 3, 6)).alev;
    const kalkanli = ilerlet(harita, g(H0, 0), { ...ilk, kalkan: 1 });
    expect(kalkanli.yeniYamalar).toEqual([{ hafta: H0 - 2, tur: "kalkan" }]);
    expect(kalkanli.alev.kalkan).toBe(kalkanli.kazanilanKalkan); // 1 harcandı (+ 4. haftada kazanılan)
    expect(alevHesapla({ gunler: gunlerOf(harita), alev: kalkanli.alev }, g(H0, 0)).seri).toBe(5);

    const kalkansiz = ilerlet(harita, g(H0, 0), { ...ilk, kalkan: 0 });
    expect(kalkansiz.yeniYamalar).toEqual([]);
    expect(alevHesapla({ gunler: gunlerOf(harita), alev: kalkansiz.alev }, g(H0, 0)).seri).toBe(1);
  });

  test("her 4 başarılı haftada 1 kalkan, tavan 3", () => {
    expect([KALKAN_HAFTA, KALKAN_TAVANI_HAFTA]).toEqual([4, 3]);
    const harita = {};
    for (let h = H0 - 20; h < H0; h++) harita[h] = 2;
    const ilk = ilerlet({}, g(H0 - 21, 0)).alev;
    const r = ilerlet(harita, g(H0, 0), ilk);
    expect(r.alev.kalkan).toBe(3);
    expect(r.kazanilanKalkan).toBe(3);
  });

  test("idempotent: ikinci çağrı hiçbir şey değiştirmez", () => {
    const harita = { [H0 - 3]: 2, [H0 - 1]: 4 };
    const bir = ilerlet(harita, g(H0, 2));
    const iki = ilerlet(harita, g(H0, 2), bir.alev);
    expect(iki.alev).toEqual(bir.alev);
    expect(iki.yeniYamalar).toEqual([]);
  });
});

describe("mola kaldırıldı", () => {
  test("eski kayıttaki molalar okunurken atılır; boş hafta seriyi dondurmaz", () => {
    const harita = { [H0 - 3]: 2, [H0 - 2]: 2 };
    const eski = { islenen: H0 - 2, kalkan: 0, sayac: 2, yamalar: {}, molalar: { "2026-11": { hafta: H0 - 1, gun: null, kazanim: 0 } }, rekor: 2 };
    expect(alevOku(eski).molalar).toBeUndefined();
    // H0-1 boş bitti, H0'da 4 gün yok ve karar bekliyor: mola sayılmaz, telafi bekler.
    const d = alevHesapla({ gunler: gunlerOf(harita), alev: eski }, g(H0, 0));
    expect(d.mola).toBeUndefined();
    expect(d.bekleyen).toMatchObject({ hafta: H0 - 1, korunanSeri: 2 });
  });
});

describe("cihaz birleştirme", () => {
  test("ileri işlenmiş kazanır; eşitse kalkan ihtiyatla küçük; rekor birleşir", () => {
    const a = { islenen: 10, kalkan: 2, sayac: 1, yamalar: { 9: "kalkan" }, rekor: 5 };
    const b = { islenen: 12, kalkan: 1, sayac: 3, yamalar: { 11: "telafi" }, rekor: 9 };
    expect(alevBirlestir(a, b)).toMatchObject({ islenen: 12, kalkan: 1, sayac: 3, rekor: 9 });
    expect(alevBirlestir(a, b).molalar).toBeUndefined();
    expect(alevBirlestir({ ...a, islenen: 12 }, b).kalkan).toBe(1);
    expect(alevOku("çöp")).toMatchObject({ islenen: null, kalkan: 0 });
  });

  test("bulut verisi deftere birleşir (günler, rekor, alev)", () => {
    const yerel = { aktiflik: { gunler: ["2026-11-03"], rekorGun: 4, rekorHafta: 2, alev: null } };
    const veri = bulutVerisi({ gunler: ["2026-11-01", "2026-11-03"], rekorGun: 9, alev: { islenen: 5, kalkan: 2 } });
    const l = bulutuBirlestir(yerel, veri);
    expect(l.aktiflik.gunler).toEqual(["2026-11-01", "2026-11-03"]);
    expect(l.aktiflik.rekorGun).toBe(9);
    expect(l.aktiflik.alev).toMatchObject({ islenen: 5, kalkan: 2 });
  });
});

describe("saat dilimi", () => {
  test("ev dilimine göre gün; cihaz dilimi değişimi haftada en fazla bir kez benimsenir", () => {
    const ms = Date.UTC(2026, 10, 9, 22, 30); // 22:30 UTC
    expect(seriGunuAnahtari(ms, 180)).toBe("2026-11-10"); // İstanbul 01:30
    expect(seriGunuAnahtari(ms, -300)).toBe("2026-11-09"); // New York 17:30
    const ev = saatDilimiGuncelle(null, 180, ms);
    expect(ev).toEqual({ dakika: 180, degisti: ms });
    expect(saatDilimiGuncelle(ev, -300, ms + 86400000)).toEqual(ev); // seyahat: ev kalır
    expect(saatDilimiGuncelle(ev, -300, ms + SAAT_DILIMI_ARALIK_MS).dakika).toBe(-300);
    expect(saatDilimiGuncelle(ev, 9999, ms + SAAT_DILIMI_ARALIK_MS)).toEqual(ev); // geçersiz
  });
});

describe("hatırlatma planı", () => {
  const copy = getStreakFlameCopy("tr");
  const seriler = (ek) => ({ alev: { seri: 3, buHaftaGun: 0, buHaftaBasarili: false, bugunAktif: false, esik: 2, ...ek } });
  const ms = (gun, saat) => gunIndexi(gun) * 86400000 + saat * 3600000;

  test("0/2 → Cumartesi 19:00; 1/2 (bugün yapıldı) → Pazar 19:00", () => {
    const p = planStreakReminder({ seriler: seriler(), bugun: g(H0, 0), dilim: 0, simdi: ms(g(H0, 0), 10), copy });
    expect(p.date.getTime()).toBe(ms(g(H0, 5), REMINDER_HOUR));
    const p2 = planStreakReminder({ seriler: seriler({ buHaftaGun: 1, bugunAktif: true }), bugun: g(H0, 2), dilim: 0, simdi: ms(g(H0, 2), 10), copy });
    expect(p2.date.getTime()).toBe(ms(g(H0, 6), REMINDER_HOUR));
    expect(p2.body).toContain("1/2");
  });

  test("kazanılmış hafta, kalkan ya da yetişmeyen hafta → bildirim yok", () => {
    const base = { bugun: g(H0, 0), dilim: 0, simdi: ms(g(H0, 0), 10), copy };
    expect(planStreakReminder({ ...base, seriler: seriler({ buHaftaGun: 2, buHaftaBasarili: true }) })).toBeNull();
    expect(planStreakReminder({ ...base, seriler: seriler({ seri: 0, bekleyen: { korunanSeri: 3, kalkan: true, gerekli: 4, mevcut: 0 } }) })).toBeNull();
    const pazar = { ...base, bugun: g(H0, 6), simdi: ms(g(H0, 6), 10) };
    expect(planStreakReminder({ ...pazar, seriler: seriler() })).toBeNull(); // 0/2, tek gün kaldı
  });

  test("ev dilimi ve cihaz-sunucu farkı düzeltilir", () => {
    const p = planStreakReminder({ seriler: seriler(), bugun: g(H0, 0), dilim: 180, simdi: ms(g(H0, 0), 5), cihazFark: 60000, copy });
    expect(p.date.getTime()).toBe(ms(g(H0, 5), REMINDER_HOUR) - 180 * 60000 + 60000);
  });
});

describe("defter mutabakatı (sunucu saati + bulut)", () => {
  const UID = "w1";
  let bulut;
  let yazilan;
  let saat;
  beforeEach(() => {
    AsyncStorage.__reset();
    __resetStores();
    __resetAllMMKV();
    __resetStoreCaches();
    resetWatchLedger(UID);
    bulut = null;
    yazilan = [];
    saat = Date.UTC(2026, 10, 11, 12, 0); // Çarşamba
    streakBridgeKaydet({
      simdi: () => saat,
      dogrulandi: () => true,
      bulutOku: async () => ({ veri: bulut }),
      bulutYaz: async (_u, v) => { yazilan.push(v); },
    });
  });
  afterEach(() => streakBridgeSifirla());

  const mutabakat = (icerikSayisi) => reconcileLedger(UID, { badgeIds: [], tumIds: [], icerikSayisi });

  test("yeni cihaz: seri buluttan gelir, sonra buluta yazılır", async () => {
    bulut = { gunler: ["2026-11-02", "2026-11-04"], alev: {}, rekorGun: 0, rekorHafta: 0 };
    const r = await mutabakat(5);
    expect(r.ilkTohum).toBe(true);
    expect(r.ledger.aktiflik.gunler).toEqual(["2026-11-02", "2026-11-04"]);
    expect(r.seriler.alev.seri).toBe(1);
    expect(yazilan.length).toBe(1);
  });

  test("saat doğrulandıysa gelecekteki (hileli) günler silinir; damga sunucu gününe", async () => {
    await mutabakat(5);
    const l = await loadLedger(UID);
    l.aktiflik.gunler = ["2026-11-10", "2026-12-25"];
    await saveLedger(UID, l);
    const r = await mutabakat(6);
    expect(r.ledger.aktiflik.gunler).toEqual(["2026-11-10", "2026-11-11"]);
    expect(r.seriler.alev.buHaftaGun).toBe(2);
  });

  test("eski sayım türü: ilk ölçüm damgalamaz (tekrar izleme göçü)", async () => {
    await mutabakat(5);
    const l = await loadLedger(UID);
    l.aktiflik.sayimTuru = 1;
    l.aktiflik.sonSayim = 3;
    await saveLedger(UID, l);
    const r = await mutabakat(40);
    expect(r.ledger.aktiflik.gunler).toEqual([]);
    expect(r.ledger.aktiflik.sayimTuru).toBe(2);
    const r2 = await mutabakat(41);
    expect(r2.ledger.aktiflik.gunler).toEqual(["2026-11-11"]);
  });

});
