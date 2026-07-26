// utils/watchBadgeLedger.js
//
// İzleme rozeti defterinin DEPOLAMA katmanı. Mantığın tamamı saf çekirdekte
// (utils/watchLedgerCore.js); burası yalnızca AsyncStorage I/O'su.
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

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  bosLedger, normalizeLedger, tohumla, birlestir,
  kutlanacaklar, isaretleGorulmus, tohumlandiMi,
  aktifligiGuncelle, rekorYukselt,
} from "./watchLedgerCore";
import { bugunAnahtari, GUN_TUT, serileriHesapla } from "./watchActivity";

const PREFIX = "watch_progress:ledger:";
const MISAFIR = "guest";

const anahtar = (uid) => `${PREFIX}${uid || MISAFIR}`;

// Üç ayrı anahtar yerine TEK doküman: baseline/earned/seen aynı anda tutarlı
// olmalı. Ayrı anahtarlarda kısmi bir yazma (uygulama öldürülmesi, dolu disk)
// "rozet kazanılmış ama görülmüş sayılmış" gibi onarılamaz bir hal bırakırdı.
export async function loadLedger(uid) {
  try {
    const raw = await AsyncStorage.getItem(anahtar(uid));
    if (!raw) return bosLedger();
    return normalizeLedger(JSON.parse(raw));
  } catch {
    return bosLedger();
  }
}

export async function saveLedger(uid, ledger) {
  try {
    await AsyncStorage.setItem(anahtar(uid), JSON.stringify(normalizeLedger(ledger)));
    return true;
  } catch {
    return false;   // disk dolu / kota — puan yine hesaplanır, sadece hafıza yok
  }
}

export async function clearLedger(uid) {
  try {
    await AsyncStorage.removeItem(anahtar(uid));
    return true;
  } catch {
    return false;
  }
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
  const mevcut = await loadLedger(uid);
  const bugun = bugunAnahtari();

  if (!tohumlandiMi(mevcut)) {
    const tohumlu = tohumla(mevcut, {
      badgeIds, tumIds, perde, makara, kare, icerikSayisi, seenAt: new Date().toISOString(),
    });
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
  const a = aktifligiGuncelle(mevcut, { icerikSayisi, bugun, tut: GUN_TUT });
  const seriler = serileriHesapla(a.ledger.aktiflik.gunler, a.ledger.aktiflik);
  const r = rekorYukselt(a.ledger, seriler);

  const sonuc = birlestir(r.ledger, { badgeIds, tumIds, perde, makara });
  if (sonuc.degisti || a.degisti || r.degisti) await saveLedger(uid, sonuc.ledger);
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
  const guncel = await loadLedger(uid);
  const sonraki = isaretleGorulmus(guncel, ids);
  await saveLedger(uid, sonraki);
  return sonraki;
}

export { kutlanacaklar, tohumlandiMi };
