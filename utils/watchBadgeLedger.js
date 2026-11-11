// utils/watchBadgeLedger.js
//
// İzleme rozeti defterinin DEPOLAMA katmanı. Mantığın tamamı saf çekirdekte
// (utils/watchLedgerCore.js); burası yalnızca tipli MMKV I/O'su.
//
// FIRESTORE'A HİÇBİR ŞEY YAZMAZ — bilinçli bir karar (docs §10.6):
//   • Users/{uid} `read: if isSignedIn()`; oraya yazılan bir puan, kullanıcı
//     "listelerim gizli" dese bile listelerinden türetilmiş bilgiyi herkese
//     sızdırırdı. Türetilmiş puan görünürlüğü otomatik miras alır.
//   • İstemciye açık her alan kalıcı olarak sahtelenebilir kalır; sahte bir
//     `level: 30` alanı, hesaplanan puandan daha inandırıcı görünür — yani
//     yazmak hile yüzeyini BÜYÜTÜR.
//
// Defter kaybolursa (uygulama silme / cihaz değişimi) yeniden tohumlanır ve
// `earned` kümesi veriden yeniden hesaplanan küme kadar geri gelir. Kayıp
// yalnızca "geçmişte kazanıp sonra veriyi sildiğin rozetler"dir; bedeli kozmetik.

import {
  bosLedger, normalizeLedger, tohumla, birlestir,
  kutlanacaklar, isaretleGorulmus, tohumlandiMi,
  aktifligiGuncelle, rekorYukselt,
} from "./watchLedgerCore";
import {
  aktifGunEkle, bugunAnahtari, cihazDilimi, GUN_TUT, saatDilimiGuncelle, seriGunuAnahtari,
  seriKorumasiniIlerlet,
} from "./watchActivity";
import { SAYIM_TURU } from "./watchLedgerCore";
import { alevBirlestir, alevIlerlet, alevOku, alevRekorYukselt, molaVer } from "./streakWeekly";
import { seriDurumu } from "./streakState";
import { streakBridge } from "./streakBridge";
import { Keys, get, remove, set } from "../services/storage";

// ── SIFIRLAMA ────────────────────────────────────────────────────────────────
// Defter yalnız diskte DEĞİL: useWatchProgress rozet kümesini, Perde tabanlarını ve
// serileri React state'inde de tutuyor ve her mutabakatta o state'ten yeni defter
// kuruyor. Yalnız anahtarları silmek rozetleri sıfırlamaz — bir sonraki mutabakat
// bellekteki eski kümeyle defteri yeniden tohumlar. Bu yüzden sıfırlama (hesabı
// sıfırla / hesabı sil) `resetWatchLedger` ile yapılır: anahtarları siler, dönemi
// (`epoch`) ilerletir ve canlı kancayı haberdar eder.
//
// DÖNEM: yolda olan bir mutabakat/kutlama (disk okundu, henüz yazılmadı) sıfırlamadan
// SONRA eski defteri geri yazamasın diye her yazma, başladığı dönemde olup olmadığını
// kontrol eder; değişmişse yazmaz.
let epoch = 0;
const resetListeners = new Set();

/** Kanca sıfırlamayı dinler: `listener(uid)`. Aboneliği bırakan fonksiyon döner. */
export function subscribeLedgerReset(listener) {
  resetListeners.add(listener);
  return () => resetListeners.delete(listener);
}

// Defter mutabakat DIŞINDA değişince (mola verildi) canlı kanca yeniden okur.
const changeListeners = new Set();
/** `listener(uid, ledger)`. Aboneliği bırakan fonksiyon döner. */
export function subscribeLedgerChange(listener) {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}
function degisimiDuyur(uid, ledger) {
  changeListeners.forEach((listener) => {
    try {
      listener(uid, ledger);
    } catch {
      // bir dinleyicinin hatası diğerlerini durdurmasın
    }
  });
}

// ── BULUT EŞİTLEMESİ ─────────────────────────────────────────────────────────
// Haftalık seri (gün listesi, alev koruması: kalkan/telafi/mola, rekorlar, ev saat
// dilimi) Users/{uid}/private/streak belgesine yazılır (yalnız sahibi okur;
// services/streakRuntime.js). Yeniden kurulumda / yeni cihazda seri geri gelir, iki
// cihaz aynı seriyi görür.
//
// ÖNCE ÇEK, SONRA YAZ: oturumda bulut bir kez başarıyla okunup birleştirilmeden HİÇBİR
// yazma yapılmaz. Aksi halde yeni cihazın boş defteri buluttaki seriyi ezerdi.
// Birleştirme monotondur: günler birleşir, rekorun büyüğü kalır, koruma kararlarında
// daha ileri işlenmiş olan kazanır (utils/streakWeekly alevBirlestir).
export const BULUT_GUN_TUT = 140; // ≈ 20 hafta: haftalık seri ve telafi için yeterli
const bulutCekildi = new Set();
const sonBulutImza = new Map();

/** Defterin buluta giden kısmı (saf). */
export function bulutVerisi(aktiflik) {
  const a = aktiflik || {};
  const gunler = Array.isArray(a.gunler) ? a.gunler : [];
  return {
    v: 1,
    gunler: gunler.slice(Math.max(0, gunler.length - BULUT_GUN_TUT)),
    alev: alevOku(a.alev),
    rekorGun: Math.max(0, Math.floor(Number(a.rekorGun) || 0)),
    rekorHafta: Math.max(0, Math.floor(Number(a.rekorHafta) || 0)),
    saatDilimi: a.saatDilimi || null,
  };
}

/** Bulut kopyasını yerel deftere birleştirir (saf). */
export function bulutuBirlestir(ledger, veri) {
  const l = normalizeLedger(ledger);
  if (!veri || typeof veri !== "object") return l;
  const a = l.aktiflik;
  let gunler = a.gunler;
  for (const g of Array.isArray(veri.gunler) ? veri.gunler : []) {
    if (typeof g === "string") gunler = aktifGunEkle(gunler, g, GUN_TUT);
  }
  const sayi = (v) => Math.max(0, Math.floor(Number(v) || 0));
  const bulutAlev = veri.alev && typeof veri.alev === "object" ? veri.alev : null;
  return normalizeLedger({
    ...l,
    aktiflik: {
      ...a,
      gunler,
      rekorGun: Math.max(a.rekorGun, sayi(veri.rekorGun)),
      rekorHafta: Math.max(a.rekorHafta, sayi(veri.rekorHafta)),
      alev: bulutAlev ? alevBirlestir(a.alev, bulutAlev) : a.alev,
      saatDilimi: a.saatDilimi || veri.saatDilimi || null,
    },
  });
}

/** Oturumda bir kez: bulutu çekip deftere birleştirir. Başarısızsa sonra yeniden dener. */
async function buluttanCek(uid, ledger) {
  if (!uid || bulutCekildi.has(uid)) return ledger;
  const sonuc = await streakBridge.bulutOku(uid);
  // null = okunamadı (ağ yok / köprü kayıtlı değil): bu oturumda yazma da yapılmaz.
  if (!sonuc || typeof sonuc !== "object") return ledger;
  bulutCekildi.add(uid);
  return sonuc.veri ? bulutuBirlestir(ledger, sonuc.veri) : ledger;
}

function bulutaGonder(uid, ledger) {
  if (!uid || !bulutCekildi.has(uid)) return;
  const veri = bulutVerisi(ledger.aktiflik);
  // Yalnız veri değişince yaz: imza zaman damgası içermez.
  const imza = JSON.stringify(veri);
  if (sonBulutImza.get(uid) === imza) return;
  sonBulutImza.set(uid, imza);
  streakBridge.bulutYaz(uid, veri);
}

/**
 * Sunucu saati + ev dilimi → seri günü ve güncellenmiş defter (saf adımlar).
 *   • saat doğrulandıysa GELECEKTEKİ günler (ileri alınmış saatle atılmış damgalar) silinir
 *   • damga en son günden geriye gitmez (saati geri alarak geçmiş gün doldurulamaz)
 *   • eski sayım türü → ilk ölçüm (tekrar izleme göçü)
 */
function zamanaHazirla(ledger, simdi, dogrulandi) {
  const a = ledger.aktiflik;
  const saatDilimi = saatDilimiGuncelle(a.saatDilimi, cihazDilimi(simdi), simdi);
  const gun = seriGunuAnahtari(simdi, saatDilimi?.dakika);
  let gunler = a.gunler;
  if (dogrulandi) gunler = gunler.filter((g) => g <= gun);
  const son = gunler[gunler.length - 1];
  const damgaGunu = son && son > gun ? son : gun;
  const gocu = a.sayimTuru !== SAYIM_TURU;
  const aktiflik = {
    ...a,
    gunler,
    saatDilimi,
    ...(gocu ? { sonSayim: -1, gunluk: {}, sayimTuru: SAYIM_TURU } : {}),
  };
  const degisti = gocu || gunler.length !== a.gunler.length
    || JSON.stringify(saatDilimi) !== JSON.stringify(a.saatDilimi);
  return { ledger: degisti ? { ...ledger, aktiflik } : ledger, gun, damgaGunu, degisti };
}

/** Haftalık alev kararlarını ilerletir ve rekoru yükseltir (saf). */
function alevIslet(ledger, gun, simdi) {
  const a = ledger.aktiflik;
  const islem = alevIlerlet({ gunler: a.gunler, alev: a.alev }, gun);
  const durum = seriDurumu({ ...a, alev: islem.alev }, simdi);
  const alev = alevRekorYukselt(islem.alev, durum.alev);
  const degisti = JSON.stringify(alev) !== JSON.stringify(a.alev ? alevOku(a.alev) : null);
  return {
    ledger: degisti ? { ...ledger, aktiflik: { ...a, alev } } : ledger,
    seriler: alev === islem.alev ? durum : seriDurumu({ ...a, alev }, simdi),
    degisti,
  };
}

/**
 * Bu haftaya (ya da karar bekleyen geçen haftaya) MOLA verir. Ayda bir.
 * @returns {Promise<{ ok:boolean, hedef?:"bu"|"gecen", sebep?:string, seriler?:object }>}
 */
export async function molaVerDefter(uid) {
  if (!uid) return { ok: false, sebep: "uid" };
  const donem = epoch;
  await streakBridge.hazir();
  const simdi = streakBridge.simdi();
  const mevcut = await buluttanCek(uid, await loadLedger(uid));
  if (!mevcut.baseline) return { ok: false, sebep: "seri" };
  const z = zamanaHazirla(mevcut, simdi, streakBridge.dogrulandi());
  const a = z.ledger.aktiflik;
  const ilk = alevIlerlet({ gunler: a.gunler, alev: a.alev }, z.gun).alev;
  const r = molaVer({ gunler: a.gunler, alev: ilk, gunluk: a.gunluk }, z.gun);
  if (!r.ok) return { ok: false, sebep: r.sebep };
  const islenmis = alevIslet({ ...z.ledger, aktiflik: { ...a, alev: r.alev } }, z.gun, simdi);
  if (donem !== epoch) return { ok: false, sebep: "sifirlandi" };
  await saveLedger(uid, islenmis.ledger);
  bulutaGonder(uid, islenmis.ledger);
  degisimiDuyur(uid, islenmis.ledger);
  return { ok: true, hedef: r.hedef, seriler: islenmis.seriler };
}

/**
 * Rozet defterini ve katalog duyurusu işaretini siler; yolda olan yazmaları geçersiz
 * kılar ve canlı kancaya state'ini boşaltmasını söyler. Tohumlama sonraki mutabakatta
 * boş veriden yeniden yapılır (kutlama yok).
 */
export function resetWatchLedger(uid) {
  epoch += 1;
  if (uid) {
    remove(Keys.watchLedger, { uid });
    remove(Keys.watchCatalogSeen, { uid });
    remove(Keys.showcaseBadges, { uid });
    remove(Keys.streakFlameSeen, { uid });
    // Seri buluta da yazılıyor: sıfırlanan hesap yeni cihazda eski seriyi geri çekmesin.
    bulutCekildi.delete(uid);
    sonBulutImza.delete(uid);
    streakBridge.bulutSil(uid);
  }
  resetListeners.forEach((listener) => {
    try {
      listener(uid);
    } catch {
      // bir dinleyicinin hatası sıfırlamayı durdurmasın
    }
  });
}

// Üç ayrı anahtar yerine TEK doküman: baseline/earned/seen aynı anda tutarlı
// olmalı. Ayrı anahtarlarda kısmi bir yazma (uygulama öldürülmesi, dolu disk)
// "rozet kazanılmış ama görülmüş sayılmış" gibi onarılamaz bir hal bırakırdı.
//
// Defter hesap çıkışında SİLİNMEZ (registry: watchLedger → keepOnLogout).
// Rozetler yeniden tohumlanabilir ama gün/seri geçmişi geri gelmez.
export async function loadLedger(uid) {
  const kayit = get(Keys.watchLedger, { uid });
  return kayit ? normalizeLedger(kayit) : bosLedger();
}

export async function saveLedger(uid, ledger) {
  // false → disk dolu / kota; puan yine hesaplanır, sadece hafıza yok.
  return set(Keys.watchLedger, normalizeLedger(ledger), { uid });
}

/**
 * Hesaplanan durumu deftere işler ve kutlanacakları döndürür.
 * İlk çağrıda SESSİZ tohumlama yapar (hiçbir kutlama tetiklenmez).
 *
 * @returns {{ ledger, ilkTohum:boolean, yeniRozetler:string[], perdeAtladi:boolean,
 *             oncekiPerde:number, yeniPerde:number, perdeFloor:number }}
 */
export async function reconcileLedger(uid, {
  badgeIds = [], tumIds = null, perde = 1, makara = 0, kare = 0, icerikSayisi = null,
} = {}) {
  const donem = epoch;
  // Sunucu saati (en fazla ~3 sn beklenir; ağ yoksa cihaz saati + son bilinen fark).
  await streakBridge.hazir();
  const simdi = streakBridge.simdi();
  const dogrulandi = streakBridge.dogrulandi();
  const yerel = await loadLedger(uid);
  const bugun = bugunAnahtari();

  if (!tohumlandiMi(yerel)) {
    const ilkDefter = tohumla(yerel, {
      badgeIds, tumIds, perde, makara, kare, icerikSayisi, seenAt: new Date().toISOString(),
    });
    // Yeni cihaz / yeniden kurulum: rozetler sessiz tohumlanır, seri BULUTTAN gelir.
    const birlesik = await buluttanCek(uid, ilkDefter);
    const z = zamanaHazirla(birlesik, simdi, dogrulandi);
    const islenmis = alevIslet(z.ledger, z.gun, simdi);
    const tohumlu = islenmis.ledger;
    if (donem !== epoch) return null; // araya sıfırlama girdi
    await saveLedger(uid, tohumlu);
    bulutaGonder(uid, tohumlu);
    return {
      ledger: tohumlu,
      ilkTohum: true,
      yeniRozetler: [],                  // tohumlamada KUTLAMA YOK
      perdeAtladi: false,
      oncekiPerde: tohumlu.earned.perdeFloor,
      yeniPerde: tohumlu.earned.perdeFloor,
      perdeFloor: tohumlu.earned.perdeFloor,
      makaraFloor: tohumlu.earned.makaraFloor,
      tohumRozetSayisi: tohumlu.baseline.badgeIds.length,
      seriler: islenmis.seriler,
    };
  }

  const mevcut = await buluttanCek(uid, yerel);
  const bulutBirlesti = mevcut !== yerel;

  // Damgala → hesapla → rekoru yükselt. Rekor, defterin geri kalanıyla AYNI
  // yazmada diske inmeli; ayrı bir tur beklerse uygulama o arada kapandığında
  // kaybolur.
  //
  // `badgeIds` bu turda hâlâ ESKİ rekorla değerlendirilmiş olarak gelir —
  // çağıran onu bu fonksiyondan önce hesaplıyor. Bu bir tur gecikme demektir ve
  // kabul edilmiştir: `perdeFloor` ve `kazanilmis` de tam olarak aynı yoldan
  // besleniyor. Yükselen rekor state'e yazılınca hesap yeniden koşar, imza
  // değişir ve rozet aynı oturumda açılır.
  //
  // İKİ AYRI GÜN: aktiflik SERİ GÜNÜYLE damgalanır (cihazın yerel gece yarısı;
  // eskiden 04:00'tü), rozet kazanma tarihi TAKVİM GÜNÜYLE.
  //
  // SAAT: seri günü SUNUCU saatinden ve defterdeki EV SAAT DİLİMİNDEN türer (cihaz
  // saatini ileri/geri almak ya da dilim değiştirmek seriyi oynatmaz; zamanaHazirla).
  const z = zamanaHazirla(mevcut, simdi, dogrulandi);
  const seriGunu = z.gun;
  const a = aktifligiGuncelle(z.ledger, { icerikSayisi, bugun: z.damgaGunu, tut: GUN_TUT });
  // Günlük seri koruması (telafi/kalkan) — günlük seri rozetlerini besler; idempotent.
  const islem = seriKorumasiniIlerlet(a.ledger.aktiflik, seriGunu);
  const korumaDegisti = JSON.stringify(islem.koruma) !== JSON.stringify(a.ledger.aktiflik.koruma);
  const korunmus = korumaDegisti
    ? { ...a.ledger, aktiflik: { ...a.ledger.aktiflik, koruma: islem.koruma } }
    : a.ledger;
  // Haftalık alev (profildeki 🔥): mola / telafi / kalkan kararları.
  const alevli = alevIslet(korunmus, seriGunu, simdi);
  const seriler = alevli.seriler;
  const r = rekorYukselt(alevli.ledger, seriler);

  // `bugun` yeni kazanılan rozetlere KAZANMA GÜNÜ olarak yazılır (defter v3).
  const sonuc = birlestir(r.ledger, { badgeIds, tumIds, perde, makara, bugun });
  if (donem !== epoch) return null; // araya sıfırlama girdi: eski defteri geri yazma
  if (sonuc.degisti || a.degisti || r.degisti || korumaDegisti || alevli.degisti || z.degisti || bulutBirlesti) {
    await saveLedger(uid, sonuc.ledger);
  }
  bulutaGonder(uid, sonuc.ledger);
  return {
    ledger: sonuc.ledger,
    seriler,
    yeniGun: a.yeniGun,
    ilkTohum: false,
    yeniRozetler: sonuc.yeniRozetler,
    sessizler: sonuc.sessizler,
    perdeAtladi: sonuc.perdeAtladi,
    makaraAtladi: sonuc.makaraAtladi,
    oncekiPerde: sonuc.oncekiPerde,
    yeniPerde: sonuc.yeniPerde,
    yeniMakara: sonuc.yeniMakara,
    perdeFloor: sonuc.ledger.earned.perdeFloor,
    makaraFloor: sonuc.ledger.earned.makaraFloor,
    tohumRozetSayisi: sonuc.ledger.baseline?.badgeIds.length || 0,
  };
}

/**
 * Kutlaması gösterilen rozetleri işaretler ki bir daha oynamasın.
 *
 * Defteri BELLEKTEKİ kopyadan değil DİSKTEN okur. Aksi halde, kullanıcı toast'ı
 * kapatana kadar geçen sürede işlenmiş bir mutabakat (yeni rozet, yükselmiş
 * perdeFloor) elde tutulan eski kopyanın üzerine yazılıp geri alınırdı — yani
 * "Perde ve rozet düşmez" sözleşmesi kutlamanın kendisi yüzünden bozulurdu.
 */
export async function markCelebrated(uid, _ledger, ids) {
  const donem = epoch;
  const guncel = await loadLedger(uid);
  const sonraki = isaretleGorulmus(guncel, ids);
  if (donem !== epoch) return guncel; // araya sıfırlama girdi
  await saveLedger(uid, sonraki);
  return sonraki;
}

export { kutlanacaklar, tohumlandiMi };
