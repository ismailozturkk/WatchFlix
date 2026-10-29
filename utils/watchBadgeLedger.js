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
  bugunAnahtari, GUN_TUT, serileriHesapla, seriGunuAnahtari, seriKorumasiniIlerlet,
} from "./watchActivity";
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
  const mevcut = await loadLedger(uid);
  const bugun = bugunAnahtari();

  if (!tohumlandiMi(mevcut)) {
    const tohumlu = tohumla(mevcut, {
      badgeIds, tumIds, perde, makara, kare, icerikSayisi, seenAt: new Date().toISOString(),
    });
    if (donem !== epoch) return null; // araya sıfırlama girdi
    await saveLedger(uid, tohumlu);
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
      seriler: serileriHesapla(tohumlu.aktiflik.gunler, tohumlu.aktiflik),
    };
  }

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
  // İKİ AYRI GÜN: aktiflik SERİ GÜNÜYLE damgalanır (04:00 dönümü — gece yarısından
  // sonra biten bölüm "dün gece"dir), rozet kazanma tarihi TAKVİM GÜNÜYLE.
  const seriGunu = seriGunuAnahtari();
  const a = aktifligiGuncelle(mevcut, { icerikSayisi, bugun: seriGunu, tut: GUN_TUT });
  // Seri koruması (telafi/kalkan) kesinleşen kararları deftere işler; idempotent.
  const islem = seriKorumasiniIlerlet(a.ledger.aktiflik, seriGunu);
  const korumaDegisti = JSON.stringify(islem.koruma) !== JSON.stringify(a.ledger.aktiflik.koruma);
  const korunmus = korumaDegisti
    ? { ...a.ledger, aktiflik: { ...a.ledger.aktiflik, koruma: islem.koruma } }
    : a.ledger;
  const seriler = serileriHesapla(korunmus.aktiflik.gunler, korunmus.aktiflik);
  const r = rekorYukselt(korunmus, seriler);

  // `bugun` yeni kazanılan rozetlere KAZANMA GÜNÜ olarak yazılır (defter v3).
  const sonuc = birlestir(r.ledger, { badgeIds, tumIds, perde, makara, bugun });
  if (donem !== epoch) return null; // araya sıfırlama girdi: eski defteri geri yazma
  if (sonuc.degisti || a.degisti || r.degisti || korumaDegisti) await saveLedger(uid, sonuc.ledger);
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
