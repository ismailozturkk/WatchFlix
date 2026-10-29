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
// GÜNLÜK SERİ VE KORUMASI: günlük seri (profildeki alev, utils/streakFlame.js)
// tam da bu günlük cezayı taşıdığı için iki affediciyle gelir (seriKorumasiniIlerlet):
//   • TELAFİ — bir günü kaçırırsan ertesi gün 2 içerik işaretle, kaçan gün dolar.
//     Emek ister (sahte işaretlemeye itmez, tersine iki kat izletir); 7 günde bir.
//   • KALKAN — her ay kademesinde (30 günde bir) 1 kalkan, en fazla 2. Telafi
//     edilemeyen günü kendiliğinden korur. "Kontrol noktası" budur: seri sayısı
//     asla yalan söylemez (kopan seri 30'a geri DÖNMEZ), ama 30. günü geçen seri
//     tek bir kötü günde de sönmez.
// Gün dönümü gece yarısı değil 04:00 (seriGunuAnahtari): 00:30'da biten bölüm
// "dün gece"dir. Yalnız seri günlerine uygulanır; rozet kazanma tarihi takvim günüdür.
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

/** Seri günü 04:00'te döner: gece yarısından sonraki izleme bir önceki güne sayılır. */
export const SERI_GUN_DONUMU_SAAT = 4;
export const seriGunuAnahtari = (simdi = Date.now()) =>
  bugunAnahtari(Number(simdi) - SERI_GUN_DONUMU_SAAT * 3600000);

/** Gün indeksi → "YYYY-MM-DD" (gunIndexi'nin tersi). */
export const indekstenGun = (gi) => {
  const d = new Date(gi * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
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

// ── SERİ KORUMASI ───────────────────────────────────────────────────────────

/** Korunan (alevi yanan) en kısa seri. Altındaki bir kopuşta telafi/kalkan yok. */
export const KORUMA_MIN_SERI = 3;
/** Kaçan günü dolduran ertesi gün kazanımı (net yeni içerik). */
export const TELAFI_ESIGI = 2;
/** İki telafi arasındaki en kısa mesafe (gün): haftada bir. */
export const TELAFI_ARALIGI = 7;
/** Kalkan kazanılan kontrol noktası: her ay kademesi. */
export const KALKAN_AY_GUN = 30;
/** Elde tutulabilecek en fazla kalkan. */
export const KALKAN_TAVANI = 2;

const idxListesi = (gunler) => [...new Set(
  (Array.isArray(gunler) ? gunler : []).map(gunIndexi).filter(Number.isFinite),
)].sort((a, b) => a - b);

const korumaGirdisi = (k) => {
  const yamalar = k && typeof k.yamalar === "object" && k.yamalar ? k.yamalar : {};
  const tam = (v) => Math.max(0, Math.floor(Number(v)) || 0);
  return {
    yamalar,
    kalkan: Math.min(KALKAN_TAVANI, tam(k?.kalkan)),
    kalkanAy: tam(k?.kalkanAy),
    islenen: typeof k?.islenen === "string" ? k.islenen : null,
  };
};

/**
 * Seri korumasını BUGÜNE kadar ilerletir. SAF ve İDEMPOTENT: aynı girdi aynı çıktıyı
 * verir, ikinci çağrı hiçbir şey değiştirmez. Defter (utils/watchBadgeLedger.js)
 * sonucu diske yazar; serileriHesapla aynı fonksiyonu YAZMADAN koşturur ki açılışta,
 * mutabakat gelmeden önce de ekran doğru olsun.
 *
 * İMLEÇ (`islenen`): kararı KESİNLEŞMİŞ son gün. Bir G günü boşsa kararı G+1'in
 * sonunda kesinleşir:
 *   1. G+1'de net ≥2 içerik + telafi hakkı → G "telafi" ile dolar (G+1 bugünse
 *      bile hemen: koşul sağlandıysa beklemeye gerek yok).
 *   2. G+1 bitti, telafi yok, kalkan var → G "kalkan" ile dolar (kalkan −1).
 *   3. Hiçbiri → seri kopar. Seri sayısı yalan söylemez: geri dönüş yok.
 * Dün (G = bugün−1) boşsa ve 1 sağlanmadıysa karar BEKLER (`bekleyenGun`).
 *
 * İLK ETKİNLEŞME (imleç yok): geçmişe dokunulmaz — eski kopuşlar sonradan
 * "iyileşmez". Süren serinin tamamlanmış ayları kadar kalkan verilir (tavanla).
 */
export function seriKorumasiniIlerlet({ gunler = [], gunluk = {}, koruma } = {}, bugun) {
  const D = gunIndexi(bugun);
  const k = korumaGirdisi(koruma);
  if (!Number.isFinite(D)) return { koruma: k, yeniYamalar: [], kazanilanKalkan: 0, bekleyenGun: null };

  const aktif = new Set(idxListesi(gunler));
  const yamalar = { ...k.yamalar };
  const yamaIdx = new Map();
  for (const [g, tur] of Object.entries(yamalar)) {
    const i = gunIndexi(g);
    if (Number.isFinite(i)) yamaIdx.set(i, tur);
  }
  const kapali = (i) => aktif.has(i) || yamaIdx.has(i);
  const kosu = (son) => {
    let n = 0;
    for (let i = son; kapali(i); i--) n++;
    return n;
  };
  const kazanim = (i) => Math.max(0, Math.floor(Number(gunluk?.[indekstenGun(i)]?.kazanim)) || 0);
  const telafiHakki = (g) => {
    for (const [i, tur] of yamaIdx) {
      if (tur === "telafi" && i < g && g - i < TELAFI_ARALIGI) return false;
    }
    return true;
  };

  let { kalkan, kalkanAy } = k;
  let kazanilanKalkan = 0;
  const yeniYamalar = [];
  const yamala = (g, tur) => {
    const gun = indekstenGun(g);
    yamalar[gun] = tur;
    yamaIdx.set(g, tur);
    yeniYamalar.push({ gun, tur });
  };
  // Kontrol noktası: süren seri yeni bir ay kademesine ulaştıysa kalkan.
  const kalkanKazan = (son) => {
    const ay = Math.floor(kosu(son) / KALKAN_AY_GUN);
    if (ay <= kalkanAy) return;
    const ek = Math.min(KALKAN_TAVANI - kalkan, ay - kalkanAy);
    if (ek > 0) {
      kalkan += ek;
      kazanilanKalkan += ek;
    }
    kalkanAy = ay;
  };

  let islenen = k.islenen ? gunIndexi(k.islenen) : NaN;
  if (!Number.isFinite(islenen)) {
    const son = kapali(D) ? D : kapali(D - 1) ? D - 1 : null;
    const ay = son === null ? 0 : Math.floor(kosu(son) / KALKAN_AY_GUN);
    kalkan = Math.min(KALKAN_TAVANI, ay);
    kalkanAy = ay;
    islenen = D - 2;
  }

  let bekleyenGun = null;
  for (let g = islenen + 1; g <= D - 1; g++) {
    if (kapali(g)) {
      kalkanKazan(g);
      islenen = g;
      continue;
    }
    if (kosu(g - 1) < KORUMA_MIN_SERI) {
      // Korunacak alev yok: sıradan boş gün.
      kalkanAy = 0;
      islenen = g;
      continue;
    }
    const ertesi = g + 1;
    if (aktif.has(ertesi) && kazanim(ertesi) >= TELAFI_ESIGI && telafiHakki(g)) {
      yamala(g, "telafi");
      islenen = g;
      continue;
    }
    if (ertesi < D) {
      if (kalkan > 0) {
        kalkan -= 1;
        yamala(g, "kalkan");
      } else {
        kalkanAy = 0; // seri koptu; yeni seri kontrol noktalarını sıfırdan sayar
      }
      islenen = g;
      continue;
    }
    bekleyenGun = g; // ertesi = bugün: karar gün sonunda
    break;
  }
  if (bekleyenGun === null && kapali(D)) kalkanKazan(D);

  // Pencere: yamalar da gün listesi gibi GUN_TUT günle sınırlı.
  for (const g of Object.keys(yamalar)) {
    if (!(gunIndexi(g) > D - GUN_TUT)) delete yamalar[g];
  }

  return {
    koruma: {
      yamalar,
      kalkan,
      kalkanAy,
      islenen: Number.isFinite(islenen) ? indekstenGun(islenen) : null,
    },
    yeniYamalar,
    kazanilanKalkan,
    bekleyenGun: bekleyenGun === null ? null : indekstenGun(bekleyenGun),
    _yardim: { kapali, kosu, kazanim, telafiHakki, D },
  };
}

/**
 * @param {string[]} gunler  aktif gün anahtarları ("YYYY-MM-DD")
 * @param {object}   opts    { simdi, rekorGun, rekorHafta, koruma?, gunluk? } — rekorlar
 *   defterden gelir ve MONOTONdur; budanmış pencere eski bir rekoru düşüremez.
 *   `koruma` VERİLİRSE (defter yolu) günlük seri telafi/kalkan günlerini de sayar ve
 *   koruma alanları döner; verilmezse davranış eskisiyle birebir aynıdır.
 */
export function serileriHesapla(gunler = [], { simdi = Date.now(), rekorGun = 0, rekorHafta = 0, koruma, gunluk } = {}) {
  const gunIdx = idxListesi(gunler);

  const bugunKey = seriGunuAnahtari(simdi);
  const bugunIdx = gunIndexi(bugunKey);
  const buHaftaIdx = haftaIndexi(bugunIdx);

  const haftaIdx = [...new Set(gunIdx.map(haftaIndexi))].sort((a, b) => a - b);

  // Günlük seri: gerçek günler + telafi/kalkan günleri. Haftalık seri ve hafta
  // kutucukları YALNIZ gerçek günlerden (yama bir haftayı "aktif" yapmaz).
  const islem = koruma !== undefined
    ? seriKorumasiniIlerlet({ gunler, gunluk, koruma }, bugunKey)
    : null;
  const kapsanan = islem
    ? [...new Set([...gunIdx, ...Object.keys(islem.koruma.yamalar).map(gunIndexi).filter(Number.isFinite)])]
      .sort((a, b) => a - b)
    : gunIdx;

  const gunSerisi = mevcutKosu(kapsanan, bugunIdx);
  const haftaSerisi = mevcutKosu(haftaIdx, buHaftaIdx);

  // Bu haftanın 7 kutucuğu (Pazartesi→Pazar). Gelecek günler false kalır.
  const haftaBasi = buHaftaIdx * 7 - 3;
  const aktifSet = new Set(gunIdx);
  const haftaKutulari = Array.from({ length: 7 }, (_, i) => aktifSet.has(haftaBasi + i));

  const sonuc = {
    gunSerisi,
    haftaSerisi,
    // Rekorlar YALNIZ yükselir: pencere içi hesap ile defterdeki geçmiş rekorun
    // büyüğü. Rozetler bu iki sayıdan beslenir, mevcut seriden DEĞİL — mevcut
    // seri bozulabilir, rozet bozulamaz.
    rekorGun: Math.max(Math.max(0, Math.floor(Number(rekorGun) || 0)), enUzunKosu(kapsanan)),
    rekorHafta: Math.max(Math.max(0, Math.floor(Number(rekorHafta) || 0)), enUzunKosu(haftaIdx)),
    haftaKutulari,
    bugunAktif: aktifSet.has(bugunIdx),
    aktifGunSayisi: gunIdx.length,
  };
  if (!islem) return sonuc;

  const { kosu, kazanim, telafiHakki, D } = islem._yardim;
  // Dün boş ve karar bekliyor: seri hâlâ kurtarılabilir mi?
  let bekleyen = null;
  if (islem.bekleyenGun) {
    const telafi = telafiHakki(D - 1);
    const kalkanVar = islem.koruma.kalkan > 0;
    if (telafi || kalkanVar) {
      bekleyen = {
        gun: islem.bekleyenGun,
        telafi,
        kalkan: kalkanVar,
        gerekli: TELAFI_ESIGI,
        mevcut: Math.min(TELAFI_ESIGI, kazanim(D)),
        // Kurtarılırsa geri gelecek seri (kaçan güne kadar olan kısım).
        korunanSeri: kosu(D - 2),
      };
    }
  }
  // Telafi hakkı ne zaman yenilenir: son telafiden 7 gün sonra.
  let telafiYenilenme = 0;
  for (const [g, tur] of Object.entries(islem.koruma.yamalar)) {
    if (tur !== "telafi") continue;
    const kalan = TELAFI_ARALIGI - (D - gunIndexi(g));
    if (kalan > telafiYenilenme) telafiYenilenme = kalan;
  }
  // En yeni yama (kutlama/uyarı için): yalnız süren serinin içindekiler.
  const yamaGunleri = Object.keys(islem.koruma.yamalar).sort();
  const sonYamaGunu = yamaGunleri[yamaGunleri.length - 1];
  const sonYama = sonYamaGunu && gunSerisi > 0 && gunIndexi(sonYamaGunu) > bugunIdx - 1 - gunSerisi
    ? { gun: sonYamaGunu, tur: islem.koruma.yamalar[sonYamaGunu] }
    : null;

  return {
    ...sonuc,
    bekleyen,
    kalkan: islem.koruma.kalkan,
    kalkanTavani: KALKAN_TAVANI,
    telafiHazir: telafiYenilenme <= 0,
    telafiYenilenme: Math.max(0, telafiYenilenme),
    bugunKazanim: kazanim(D),
    sonYama,
  };
}

/** İki `seriler` nesnesi ekranda AYNI mı? (useWatchProgress referans koruması) */
export function ayniSeriler(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const anahtarlar = [
    "gunSerisi", "haftaSerisi", "rekorGun", "rekorHafta", "bugunAktif", "aktifGunSayisi",
    "kalkan", "telafiHazir", "telafiYenilenme", "bugunKazanim",
  ];
  if (anahtarlar.some((ad) => a[ad] !== b[ad])) return false;
  const j = (v) => JSON.stringify(v ?? null);
  return j(a.bekleyen) === j(b.bekleyen) && j(a.sonYama) === j(b.sonYama)
    && j(a.haftaKutulari) === j(b.haftaKutulari);
}
