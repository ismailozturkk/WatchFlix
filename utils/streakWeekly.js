// utils/streakWeekly.js
//
// HAFTALIK SERİ ALEVİ — profildeki 🔥 sayacının çekirdeği (11 Kas yeniden tasarımı).
//
// NEDEN HAFTALIK: günlük seri her gün izleme şartı koyuyordu; bu bir takip uygulaması
// ve kimse her gün film izlemez. Günlük ceza kullanıcıyı sahte işaretlemeye itiyordu.
// Yeni kural:
//   • BAŞARILI HAFTA = o hafta (Pazartesi→Pazar) en az HAFTA_ESIGI (2) FARKLI günde
//     bir şey işaretlemek. Seri art arda başarılı hafta sayısıdır.
//   • ESNEK HAFTA (telafi): bir hafta başarısız biterse seri HEMEN kopmaz; ertesi hafta
//     TELAFI_GUN_ESIGI (4) farklı gün işaretlersen kaçan hafta dolar. Ertesi hafta da
//     telafisiz biterse elde kalkan varsa kalkan korur, yoksa seri kopar.
//   • KALKAN: her KALKAN_HAFTA (4) başarılı haftada 1, en fazla KALKAN_TAVANI (3).
//   • MOLA: her takvim ayında 1 hafta. Sınav/iş dönemi için: mola haftası seriyi ne
//     artırır ne bozar (dondurur). Mola aktifken alev griye döner; o hafta yeniden bir
//     şey işaretlenince renk geri gelir (hafta yine korunur, 2 güne ulaşırsa sayılır).
//     Geçen hafta başarısız bitmiş ve karar bekliyorsa mola GERİYE DÖNÜK o haftaya da
//     verilebilir ("geçen hafta sınavdaydım").
//
// Gün listesi (`gunler`) sunucu saatiyle ve "ev saat dilimiyle" damgalanmış GERÇEK
// işaretleme günleridir (utils/watchBadgeLedger.js reconcileLedger). Tekrar izleme de
// sayılır (içerik sayımı izleme OLAYLARINI sayar, bkz. watchScoring filmIzlemeSayisi).
//
// KARARLAR KESİNLEŞİR: `islenen` imleci kararı verilmiş son haftadır; aynı girdi aynı
// çıktıyı verir (idempotent). Defter sonucu diske yazar, ekran aynı hesabı yazmadan yapar.
//
// SAF MODÜL: React, depolama, Firestore importu YOKTUR.

import { gunIndexi, haftaIndexi, indekstenGun } from "./watchActivity";

/** Başarılı hafta için gereken farklı gün sayısı. */
export const HAFTA_ESIGI = 2;
/** Kaçan haftayı ertesi hafta dolduran farklı gün sayısı. */
export const TELAFI_GUN_ESIGI = 4;
/** Kaç başarılı haftada bir kalkan kazanılır. */
export const KALKAN_HAFTA = 4;
/** Elde tutulabilecek en fazla kalkan. */
export const KALKAN_TAVANI_HAFTA = 3;
/** Yamalar ve molalar kaç hafta saklanır (gün penceresi ≈ 57 hafta). */
export const HAFTA_TUT = 60;

const MOLA_AY = /^\d{4}-\d{2}$/;
const nesneMi = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const tam = (v, alt = 0) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.max(alt, n) : alt;
};
const haftaNo = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
};

export const bosAlev = () => ({ yamalar: {}, kalkan: 0, sayac: 0, islenen: null, molalar: {}, rekor: 0 });

/** Bilinmeyen/bozuk girdiyi güvenli biçime indirger. Asla atmaz. */
export function alevOku(v) {
  if (!nesneMi(v)) return bosAlev();
  const yamalar = {};
  if (nesneMi(v.yamalar)) {
    for (const [h, tur] of Object.entries(v.yamalar)) {
      if (Number.isInteger(haftaNo(h)) && (tur === "telafi" || tur === "kalkan")) yamalar[String(haftaNo(h))] = tur;
    }
  }
  const molalar = {};
  if (nesneMi(v.molalar)) {
    for (const [ay, m] of Object.entries(v.molalar)) {
      if (!MOLA_AY.test(ay) || !nesneMi(m) || !Number.isInteger(haftaNo(m.hafta))) continue;
      molalar[ay] = {
        hafta: haftaNo(m.hafta),
        gun: typeof m.gun === "string" && Number.isFinite(gunIndexi(m.gun)) ? m.gun : null,
        kazanim: tam(m.kazanim),
      };
    }
  }
  return {
    yamalar,
    kalkan: Math.min(KALKAN_TAVANI_HAFTA, tam(v.kalkan)),
    sayac: Math.min(KALKAN_HAFTA - 1, tam(v.sayac)),
    islenen: Number.isInteger(haftaNo(v.islenen)) && v.islenen !== null ? haftaNo(v.islenen) : null,
    molalar,
    rekor: tam(v.rekor),
  };
}

/** Haftaya göre farklı aktif gün sayısı: Map<haftaIdx, number>. */
function haftaSayilari(gunler) {
  const gunSet = new Set((Array.isArray(gunler) ? gunler : []).map(gunIndexi).filter(Number.isFinite));
  const sayilar = new Map();
  for (const gi of gunSet) {
    const h = haftaIndexi(gi);
    sayilar.set(h, (sayilar.get(h) || 0) + 1);
  }
  return { sayilar, gunSet };
}

function yardimcilar(gunler, alev) {
  const { sayilar, gunSet } = haftaSayilari(gunler);
  const yamalar = new Map(Object.entries(alev.yamalar).map(([h, t]) => [Number(h), t]));
  const molaHaftalari = new Set(Object.values(alev.molalar).map((m) => m.hafta));
  const sayi = (w) => sayilar.get(w) || 0;
  const basarili = (w) => sayi(w) >= HAFTA_ESIGI;
  const mola = (w) => molaHaftalari.has(w);
  const kapali = (w) => basarili(w) || yamalar.has(w) || mola(w);
  // Seri: `son` haftasından geriye kapalı haftalar. Mola haftası sayılmaz ama seriyi
  // bölmez (dondurur). Sınır: pencere dışına taşan sonsuz döngü olmasın.
  const kosu = (son) => {
    let n = 0;
    for (let w = son, adim = 0; kapali(w) && adim < 520; w--, adim++) {
      if (basarili(w) || yamalar.has(w)) n++;
    }
    return n;
  };
  return { sayi, basarili, mola, kapali, kosu, yamalar, gunSet };
}

/**
 * Haftalık seri korumasını BUGÜNE kadar ilerletir. SAF ve İDEMPOTENT.
 *
 * Bitmiş her hafta w için (imleçten sonra):
 *   başarılı (≥2 gün)          → seri sürer, kalkan sayacı +1 (4'te bir kalkan)
 *   mola                        → donar (ne artar ne kopar)
 *   başarısız ve korunacak seri:
 *     w+1'de ≥4 gün             → "telafi" (w+1 sürüyor olsa da hemen)
 *     w+1 bitti, kalkan var     → "kalkan" (kalkan −1)
 *     w+1 bitti, kalkan yok     → seri kopar, sayaç sıfırlanır
 *     w+1 = bu hafta            → karar BEKLER (`bekleyenHafta`)
 * Süren hafta 2 güne ulaştıysa hemen kesinleşir (gün listesi yalnız büyür).
 *
 * İLK ETKİNLEŞME (imleç yok): geçmişe dokunulmaz; süren serinin tamamlanmış
 * 4'lükleri kadar kalkan verilir (tavanla).
 */
export function alevIlerlet({ gunler = [], alev } = {}, bugun) {
  const D = gunIndexi(bugun);
  const k = alevOku(alev);
  if (!Number.isFinite(D)) return { alev: k, yeniYamalar: [], kazanilanKalkan: 0, bekleyenHafta: null };
  const W = haftaIndexi(D);
  const h = yardimcilar(gunler, k);
  const yamalar = { ...k.yamalar };
  const yeniYamalar = [];
  let { kalkan, sayac } = k;
  let kazanilanKalkan = 0;

  const yamala = (w, tur) => {
    yamalar[String(w)] = tur;
    h.yamalar.set(w, tur);
    yeniYamalar.push({ hafta: w, tur });
  };
  const sayacArtir = () => {
    sayac += 1;
    if (sayac >= KALKAN_HAFTA) {
      sayac = 0;
      if (kalkan < KALKAN_TAVANI_HAFTA) {
        kalkan += 1;
        kazanilanKalkan += 1;
      }
    }
  };

  let islenen = k.islenen;
  if (islenen === null) {
    // Geçen hafta ve bu hafta döngüde normal işlenir (geçen hafta başarısızsa esnek hafta
    // hakkı korunur); ondan öncesi olduğu gibi kabul edilir.
    const run = h.kosu(W - 2);
    kalkan = Math.min(KALKAN_TAVANI_HAFTA, Math.floor(run / KALKAN_HAFTA));
    sayac = run % KALKAN_HAFTA;
    islenen = W - 2;
  }

  let bekleyenHafta = null;
  for (let w = islenen + 1; w <= W; w++) {
    if (w === W) {
      if (h.basarili(W)) {
        sayacArtir();
        islenen = W;
      }
      break;
    }
    if (h.basarili(w)) {
      sayacArtir();
      islenen = w;
      continue;
    }
    if (h.yamalar.has(w) || h.mola(w)) {
      islenen = w;
      continue;
    }
    if (h.kosu(w - 1) < 1) {
      // Korunacak seri yok: sıradan boş hafta.
      sayac = 0;
      islenen = w;
      continue;
    }
    if (h.sayi(w + 1) >= TELAFI_GUN_ESIGI) {
      yamala(w, "telafi");
      islenen = w;
      continue;
    }
    if (w + 1 < W) {
      if (kalkan > 0) {
        kalkan -= 1;
        yamala(w, "kalkan");
      } else {
        sayac = 0; // seri koptu; kalkan sayacı yeni seriyle sıfırdan
      }
      islenen = w;
      continue;
    }
    bekleyenHafta = w; // ertesi = bu hafta: karar hafta sonunda
    break;
  }

  // Pencere: eski yamalar ve molalar budanır.
  for (const key of Object.keys(yamalar)) if (!(Number(key) > W - HAFTA_TUT)) delete yamalar[key];
  const molalar = {};
  for (const [ay, m] of Object.entries(k.molalar)) if (m.hafta > W - HAFTA_TUT) molalar[ay] = m;

  return {
    alev: { yamalar, kalkan, sayac, islenen, molalar, rekor: k.rekor },
    yeniYamalar,
    kazanilanKalkan,
    bekleyenHafta,
    _h: h,
    _W: W,
    _D: D,
  };
}

/** Mola bu hafta HÂLÂ aktif mi (gri alev)? Mola verildikten sonra yeni işaretleme yoksa. */
function molaAktifMi(m, gunSet, gunluk) {
  if (!m || !m.gun) return Boolean(m);
  const molaGunu = gunIndexi(m.gun);
  for (const gi of gunSet) if (gi > molaGunu && haftaIndexi(gi) === m.hafta) return false;
  const bugunKazanim = tam(gunluk?.[m.gun]?.kazanim);
  return bugunKazanim <= m.kazanim;
}

/**
 * Ekranın ihtiyaç duyduğu haftalık seri durumu. Defteri DEĞİŞTİRMEZ.
 * @returns {{ seri, rekor, buHaftaGun, buHaftaKutulari, buHaftaBasarili, bekleyen,
 *             kalkan, kalkanTavani, kalkanaKalan, mola, sonYama, gunDurumu }}
 */
export function alevHesapla({ gunler = [], alev, gunluk } = {}, bugun) {
  const islem = alevIlerlet({ gunler, alev }, bugun);
  const { _h: h, _W: W, _D: D } = islem;
  if (!h) {
    return {
      seri: 0, rekor: alevOku(alev).rekor, buHaftaGun: 0, buHaftaKutulari: Array(7).fill(false),
      buHaftaBasarili: false, bekleyen: null, kalkan: 0, kalkanTavani: KALKAN_TAVANI_HAFTA,
      kalkanaKalan: KALKAN_HAFTA, mola: { aktif: false, buHafta: false, hakVar: true, gecenHafta: false },
      sonYama: null, esik: HAFTA_ESIGI, telafiEsigi: TELAFI_GUN_ESIGI,
    };
  }
  const k = islem.alev;
  const buHaftaGun = h.sayi(W);
  const buHaftaBasarili = h.basarili(W);
  const seri = h.kosu(buHaftaBasarili ? W : W - 1);

  let bekleyen = null;
  if (islem.bekleyenHafta === W - 1) {
    const korunan = h.kosu(W - 2);
    if (korunan >= 1) {
      bekleyen = {
        hafta: W - 1,
        gerekli: TELAFI_GUN_ESIGI,
        mevcut: Math.min(TELAFI_GUN_ESIGI, buHaftaGun),
        kalkan: k.kalkan > 0,
        korunanSeri: korunan,
      };
    }
  }

  const haftaBasi = W * 7 - 3;
  const buHaftaKutulari = Array.from({ length: 7 }, (_, i) => h.gunSet.has(haftaBasi + i));
  const ay = String(bugun).slice(0, 7);
  const buAyMola = k.molalar[ay] || null;
  const molaKaydi = Object.values(k.molalar).find((m) => m.hafta === W) || null;
  const gecenHaftaMola = Object.values(k.molalar).some((m) => m.hafta === W - 1);
  const mola = {
    buHafta: Boolean(molaKaydi),
    aktif: Boolean(molaKaydi) && molaAktifMi(molaKaydi, h.gunSet, gunluk),
    gecenHafta: gecenHaftaMola,
    hakVar: !buAyMola,
  };

  // Görünen seri (bekleyen varsa kurtarılacak kısım) — rekor da ondan beslenir.
  const yamaHaftalari = Object.keys(k.yamalar).map(Number).sort((a, b) => a - b);
  const sonYamaHafta = yamaHaftalari[yamaHaftalari.length - 1];
  const sonYama = Number.isInteger(sonYamaHafta) && seri > 0 && sonYamaHafta >= W - 1 - seri
    ? { hafta: sonYamaHafta, gun: indekstenGun(sonYamaHafta * 7 - 3), tur: k.yamalar[String(sonYamaHafta)] }
    : null;

  return {
    seri,
    rekor: Math.max(k.rekor, seri, bekleyen ? bekleyen.korunanSeri : 0),
    buHaftaGun,
    buHaftaKutulari,
    buHaftaBasarili,
    bugunAktif: h.gunSet.has(D),
    bekleyen,
    kalkan: k.kalkan,
    kalkanTavani: KALKAN_TAVANI_HAFTA,
    kalkanaKalan: KALKAN_HAFTA - k.sayac,
    mola,
    sonYama,
    esik: HAFTA_ESIGI,
    telafiEsigi: TELAFI_GUN_ESIGI,
  };
}

/**
 * Mola ver. Hedef: geçen hafta başarısız bitip karar bekliyorsa O hafta (geriye dönük),
 * yoksa bu hafta. Ayda bir; seri yoksa verilemez.
 * @returns {{ ok: boolean, alev, hedef?: "bu"|"gecen", sebep?: string }}
 */
export function molaVer({ gunler = [], alev, gunluk } = {}, bugun) {
  const islem = alevIlerlet({ gunler, alev }, bugun);
  const k = islem.alev;
  if (!islem._h) return { ok: false, alev: k, sebep: "gecersiz" };
  const durum = alevHesapla({ gunler, alev, gunluk }, bugun);
  const W = islem._W;
  const ay = String(bugun).slice(0, 7);
  if (!durum.mola.hakVar) return { ok: false, alev: k, sebep: "hak" };
  const hedefGecen = Boolean(durum.bekleyen);
  const hedef = hedefGecen ? W - 1 : W;
  if (Object.values(k.molalar).some((m) => m.hafta === hedef)) return { ok: false, alev: k, sebep: "zaten" };
  if (!hedefGecen && durum.seri < 1) return { ok: false, alev: k, sebep: "seri" };
  const mola = hedefGecen
    ? { hafta: hedef, gun: null, kazanim: 0 }
    : { hafta: hedef, gun: bugun, kazanim: tam(gunluk?.[bugun]?.kazanim) };
  return {
    ok: true,
    hedef: hedefGecen ? "gecen" : "bu",
    alev: { ...k, molalar: { ...k.molalar, [ay]: mola } },
  };
}

/** Rekoru monoton yükseltir (görünen seri ve kurtarılacak seri dahil). */
export function alevRekorYukselt(alev, durum) {
  const k = alevOku(alev);
  const rekor = Math.max(k.rekor, tam(durum?.rekor));
  return rekor === k.rekor ? k : { ...k, rekor };
}

/**
 * İki cihazın (ya da cihaz + bulutun) koruma durumunu birleştirir. Gün listesi ayrıca
 * birleşir; burada yalnız kararlar. Kural: daha ileri işlenmiş imleç kazanır; eşitse
 * yamalar birleşir ve kalkan/sayaç İHTİYATLA küçük olan alınır (iki cihaz aynı kalkanı
 * iki kez harcamış/kazanmış olabilir). Molalar ay bazında birleşir (erken hafta kalır).
 */
export function alevBirlestir(a, b) {
  const x = alevOku(a);
  const y = alevOku(b);
  const xi = x.islenen === null ? -Infinity : x.islenen;
  const yi = y.islenen === null ? -Infinity : y.islenen;
  const ileri = xi >= yi ? x : y;
  const molalar = { ...y.molalar };
  for (const [ay, m] of Object.entries(x.molalar)) {
    if (!molalar[ay] || m.hafta < molalar[ay].hafta) molalar[ay] = m;
  }
  const yamalar = { ...x.yamalar, ...y.yamalar, ...ileri.yamalar };
  const esit = xi === yi;
  return {
    yamalar,
    kalkan: esit ? Math.min(x.kalkan, y.kalkan) : ileri.kalkan,
    sayac: esit ? Math.min(x.sayac, y.sayac) : ileri.sayac,
    islenen: ileri.islenen,
    molalar,
    rekor: Math.max(x.rekor, y.rekor),
  };
}
