// utils/watchActivity.js
//
// AKTİFLİK SERİSİ — "art arda kaç hafta uygulamada bir şey işaretledin".
//
// NEDEN AYRI BİR ÖLÇÜT: `computeWatchScore().enUzunSeri` kullanıcının SEÇTİĞİ
// izleme tarihinden hesaplanıyor ve DatePickerModal geçmişe onlarca yıl açık.
// Yani üç gün ara veren kullanıcı geri dönüp o günlere içerik işaretleyerek
// serisini TAMİR EDEBİLİYOR. Tamir edilebilen bir seri gerilim üretmez; "500
// serimi bozmayayım" hissinin tamamı serinin KAYBEDİLEBİLİR olmasından gelir.
//
// Bu modülün beslendiği gün listesi kullanıcının seçtiği tarihten değil, cihaz
// saatiyle GERÇEK İŞARETLEME ANINDAN üretilir (utils/watchLedgerCore.js →
// aktifligiGuncelle). Geriye dönük düzeltilemez.
//
// HAFTALIK TABAN, GÜNLÜK GÖRSEL: seri hafta sayar, çünkü bu bir izleme değil
// TAKİP uygulaması ve kimse her gün film izlemez. Günlük ceza, kullanıcıyı
// seriyi korumak için sahte işaretlemeye iter — yani sistemi kendi elimizle
// bozarız. Kartta haftanın 7 kutucuğu ayrıca gösterilir; canlılık hissi günlük
// kalır, ceza haftalık olur.
//
// SAF MODÜL: React, AsyncStorage, Firestore importu YOKTUR.

// Kaç günlük pencere saklanır. 400 gün ≈ 4,4 KB. Rekorlar bu pencereden
// BAĞIMSIZ olarak defterde ayrıca (monoton) tutulur, yoksa budama eski bir
// rekoru sessizce silerdi — "rozet düşmez" sözleşmesinin ihlali.
export const GUN_TUT = 400;

// Gün anahtarı → epoch'tan itibaren TAKVİM GÜNÜ indeksi.
// (watchScoring.js'teki eşiyle bilerek ayrı: o dosya billing açılınca
// functions/ altına DEĞİŞTİRİLMEDEN kopyalanacak, bu modül ise cihaza özgü.)
export const gunIndexi = (key) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ""));
  if (!m) return NaN;
  return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000);
};

// PAZARTESİ BAŞLANGIÇLI hafta indeksi.
// 1 Ocak 1970 Perşembe'ydi, yani gün indeksi 0 = Perşembe. +3 kaydırmak
// Pazartesi'yi 0'a oturtur. ISO hafta NUMARASI yerine indeks kullanmak yıl
// sınırındaki "52. hafta → 1. hafta" kırılmasını tamamen ortadan kaldırır:
// ardışık hafta = ardışık indeks, yıl kavramı hiç girmez.
export const haftaIndexi = (gi) => Math.floor((gi + 3) / 7);
// 0 = Pazartesi … 6 = Pazar
export const haftaninGunu = (gi) => ((gi + 3) % 7 + 7) % 7;

/** Cihaz saatiyle bugünün anahtarı (LOKAL gün). */
export const bugunAnahtari = (simdi = Date.now()) => {
  const d = new Date(simdi);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Gün listesine yeni bir aktif gün ekler; tekilleştirir, sıralar, budar. */
export function aktifGunEkle(gunler, gun, tut = GUN_TUT) {
  const set = new Set((Array.isArray(gunler) ? gunler : []).filter((g) => Number.isFinite(gunIndexi(g))));
  if (Number.isFinite(gunIndexi(gun))) set.add(gun);
  const sirali = [...set].sort();
  return sirali.length > tut ? sirali.slice(sirali.length - tut) : sirali;
}

// Bir indeks dizisinde (artan, tekil) en uzun ardışık koşu.
function enUzunKosu(idx) {
  let best = 0, cur = 0, prev = null;
  for (const i of idx) {
    cur = prev !== null && i - prev === 1 ? cur + 1 : 1;
    if (cur > best) best = cur;
    prev = i;
  }
  return best;
}

// Sondan geriye doğru ardışık koşu — ancak son eleman "canlı" ise.
// canliMi: seri hâlâ sürüyor mu (bugün/bu hafta ya da bir öncesi).
function mevcutKosu(idx, simdikiIdx) {
  if (!idx.length) return 0;
  const son = idx[idx.length - 1];
  // 1 birimlik tolerans: bugün henüz işaretleme yapmamış olmak seriyi BOZMAZ,
  // dün (ya da geçen hafta) yapılmışsa seri hâlâ canlıdır. Tolerans olmadan
  // her sabah sıfırlanmış görünürdü.
  if (son < simdikiIdx - 1) return 0;
  let n = 1;
  for (let i = idx.length - 2; i >= 0; i--) {
    if (idx[i] === idx[i + 1] - 1) n++;
    else break;
  }
  return n;
}

/**
 * @param {string[]} gunler  aktif gün anahtarları ("YYYY-MM-DD")
 * @param {object}   opts    { simdi, rekorGun, rekorHafta } — rekorlar defterden
 *   gelir ve MONOTONdur; budanmış pencere eski bir rekoru düşüremez.
 */
export function serileriHesapla(gunler = [], { simdi = Date.now(), rekorGun = 0, rekorHafta = 0 } = {}) {
  const gunIdx = [...new Set(
    (Array.isArray(gunler) ? gunler : []).map(gunIndexi).filter(Number.isFinite),
  )].sort((a, b) => a - b);

  const bugunIdx = gunIndexi(bugunAnahtari(simdi));
  const buHaftaIdx = haftaIndexi(bugunIdx);

  const haftaIdx = [...new Set(gunIdx.map(haftaIndexi))].sort((a, b) => a - b);

  const gunSerisi = mevcutKosu(gunIdx, bugunIdx);
  const haftaSerisi = mevcutKosu(haftaIdx, buHaftaIdx);

  // Bu haftanın 7 kutucuğu (Pazartesi→Pazar). Gelecek günler false kalır.
  const haftaBasi = buHaftaIdx * 7 - 3;
  const aktifSet = new Set(gunIdx);
  const haftaKutulari = Array.from({ length: 7 }, (_, i) => aktifSet.has(haftaBasi + i));

  return {
    gunSerisi,
    haftaSerisi,
    // Rekorlar YALNIZ yükselir: pencere içi hesap ile defterdeki geçmiş rekorun
    // büyüğü. Rozetler bu iki sayıdan beslenir, mevcut seriden DEĞİL — mevcut
    // seri bozulabilir, rozet bozulamaz.
    rekorGun: Math.max(Math.max(0, Math.floor(Number(rekorGun) || 0)), enUzunKosu(gunIdx)),
    rekorHafta: Math.max(Math.max(0, Math.floor(Number(rekorHafta) || 0)), enUzunKosu(haftaIdx)),
    haftaKutulari,
    bugunAktif: aktifSet.has(bugunIdx),
    aktifGunSayisi: gunIdx.length,
  };
}
