// utils/watchScoring.js
//
// Seelogd izleme puanı — "Kare" birimi, "Perde" seviyesi.
// Tasarım gerekçesi: docs/PUANLAMA_ROZET_SISTEMI.md
//
// SAF MODÜL. React, Firestore, `@` alias importu YOKTUR ve eklenmemelidir.
// Sebep: billing açılıp Cloud Functions deploy edilebildiğinde bu dosya
// DEĞİŞTİRİLMEDEN functions/ altına kopyalanacak ve aynı formül sunucuda
// çalışacak (docs §8.4). Formül aynı kaldığı için geçiş günü hiçbir
// kullanıcının puanı oynamaz. Bir React importu bu yolu kapatır.
//
// TÜRETİLMİŞLİK SÖZLEŞMESİ: puan hiçbir yerde saklanmaz, hiçbir yerde
// increment edilmez. Her açılışta ham izleme verisinden sıfırdan hesaplanır.
// Bu üç şeyi birden çözer:
//   • çift sayım imkânsızdır,
//   • offline'da kaybolan yazımlar puanı kalıcı bozamaz,
//   • hesap/liste temizliği sonrası tutarsızlık kalmaz.
//
// `toDate` bilinçli olarak utils/wrapped.js'ten import EDİLMEZ; saflık şartı
// için burada yeniden yazılmıştır.

export const K = Object.freeze({
  FILM_TABAN: 40, FILM_DK_KATSAYI: 1.0, FILM_DK_MIN: 5, FILM_DK_MAX: 240, FILM_DK_VARSAYILAN: 100,
  BOLUM_TABAN: 10, BOLUM_DK_KATSAYI: 0.6, BOLUM_DK_MIN: 3, BOLUM_DK_MAX: 90, BOLUM_DK_VARSAYILAN: 42,
  GUNLUK_TAVAN: 1100,
  GUN_BONUSU: 12,
  RITIM_TAVAN: 9000,
  SERI_KILOMETRE: [[3, 60], [7, 150], [14, 300], [30, 600], [60, 1000], [100, 1500]],
  TUR_ILK: 75, TUR_TAVAN: 14,
  // Dizi bitirme bonusu ÜÇ katmanlı sınırlıdır. Düz "her dizi 500 Kare" ilk
  // sürümde ölçüldü ve sistemin en büyük açığıydı: TMDB'de binlerce 2 bölümlük
  // mini dizi var ve hepsini bugüne işaretlemek tek dokunuşluk bir iş. Gerçek
  // motorda 520 mini dizi = 261.187 Kare = PERDE 20; buna karşılık 9 aya
  // yayılmış, gerçekten izlenmiş 40 film = 7.155 Kare = Perde 7. Yani sistem
  // sahteciliği dürüstlükten 36 kat fazla ödüllendiriyordu.
  DIZI_BONUS: 500,            // tam bonus tavanı
  DIZI_BONUS_BOLUM_BASI: 25,  // 20 bölümde tam bonusa ulaşır; 2 bölümlük "dizi" 50 eder
  DIZI_GUN_TAVANI: 600,       // TEK BİR GÜNE düşen dizi bonusu toplamı bunu aşamaz
  DIZI_MIN_BOLUM: 2,
  // Bayatlık kırpması: izlenen bölüm, kayıtlı hedefin bu katından fazlaysa
  // `showEpisodeCount` güvenilmez sayılır. 3 fazla sıkıydı — o alan ilk
  // işaretlemeden sonra hiç tazelenmiyor, dolayısıyla devam eden bir diziyi
  // yıllarca sadık biçimde izleyen kullanıcı (hedef 20'de donmuş, izlenen 70)
  // bitirme kredisini KALICI kaybediyordu. 5, üç katına çıkan gerçek dizileri
  // kapsar ama saçma veriyi (hedef 3, izlenen 100) elemeye devam eder.
  DIZI_BAYATLIK_KATI: 5,
});

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Uygulamada izleme tarihi DÖRT ayrı biçimde saklanıyor (hepsi canlı veride var):
 * Date | Firestore Timestamp {seconds}|{toDate} | "YYYY-MM-DD" ya da ISO | epoch ms.
 */
export function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "object") {
    if (typeof v.toDate === "function") { try { return v.toDate(); } catch { return null; } }
    if (typeof v.seconds === "number") return new Date(v.seconds * 1000);
    return null;
  }
  if (typeof v === "number") return new Date(v);
  if (typeof v === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
    // KRİTİK: "YYYY-MM-DD" LOKAL gün olarak kurulur. new Date("2026-03-14") bunu
    // UTC gece yarısı yorumlar; UTC-negatif dilimlerde (Amerika) yerel tarih 13
    // Mart'a kayar. Bu, ardışık gün serisini sessizce kırar.
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// MAKULLÜK PENCERESİ. Bozuk bir tarih (epoch 0 → 1970, TMDB'nin boş air_date'i,
// yanlış birim yüzünden 1970'e düşen saniye/milisaniye karışıklığı, ileri
// tarihli test kaydı) sessizce gerçek bir güne dönüşürse iki şeyi birden bozar:
// "en uzun ara" ölçütü on yıllara fırlar ve `gizli_geri_donus` rozeti KALICI
// olarak yanlış açılır (defter geri alınamaz). Sinemanın başlangıcından önceki
// ve bugünden sonraki tarihler tarihsiz sayılır — tür ve dizi bonusuna girmeye
// devam eder, yalnızca gün/ritim hesabından düşer.
// Alt sınır BİLİNÇLİ olarak dar tutuldu: kullanıcı 1975'te izlediği bir filmi
// gerçekten o tarihe işaretleyebilir (DatePickerModal minDate = yayın tarihi),
// dolayısıyla "eski" tek başına şüpheli değildir. Elenen şey EPOCH SENTİNEL'idir:
// `new Date(0).toISOString()` → "1970-01-01T00:00:00.000Z". Bu gün, gerçek bir
// izleme kaydı olmaktan çok bir "tarih yok" sinyalidir.
const EN_ERKEN_YIL = 1930;
const EPOCH_GUNU = "1970-01-01";
const GELECEK_PAYI_MS = 36 * 60 * 60 * 1000;   // saat dilimi farkı için 36 saat

export const gunKey = (v, simdi = Date.now()) => {
  const d = toDate(v);
  if (!d) return null;
  if (d.getFullYear() < EN_ERKEN_YIL) return null;
  if (d.getTime() > simdi + GELECEK_PAYI_MS) return null;
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return key === EPOCH_GUNU ? null : key;
};

// DST-güvenli gün indeksi: saat farkı değil TAKVİM GÜNÜ sayar. (ms/86400000 ile
// hesaplamak yaz saati geçişinde 23 ya da 25 saatlik gün üretip seriyi kırardı.)
const gunIndex = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

/**
 * Hesabın kaç TAM yılını doldurduğu.
 *
 * Girdi `user.metadata.creationTime` (Firebase Auth, RFC-1123 dizesi).
 * Bu, sistemdeki TEK SAHTELENEMEZ ölçüttür: değeri sunucu yazar, istemci
 * dokunamaz. Puanın geri kalanı kullanıcının kendi girdiği izleme tarihlerinden
 * türediği için katalogda "tarih türevi rozet tavanı = rare" kuralı var; kıdem
 * rozetleri o kuralın dışındadır, çünkü uydurulamazlar.
 *
 * Gün/ay karşılaştırmalı: yıl farkını almak yetmez, yıl dönümü henüz gelmediyse
 * bir eksiltilir. Aksi halde 31 Aralık'ta açılan hesap ertesi gün "1 yıl" olurdu.
 */
export function hesapYasiYil(v, simdi = Date.now()) {
  const d = toDate(v);
  if (!d) return 0;
  const n = new Date(simdi);
  if (d.getTime() > n.getTime()) return 0;      // ileri tarihli/bozuk kayıt
  let yil = n.getFullYear() - d.getFullYear();
  const ayFarki = n.getMonth() - d.getMonth();
  if (ayFarki < 0 || (ayFarki === 0 && n.getDate() < d.getDate())) yil--;
  return Math.max(0, yil);
}

export const etkinFilmDk = (m) =>
  (num(m?.minutes) > 0 ? clamp(num(m.minutes), K.FILM_DK_MIN, K.FILM_DK_MAX) : K.FILM_DK_VARSAYILAN);
export const etkinBolumDk = (e) =>
  (num(e?.episodeMinutes) > 0 ? clamp(num(e.episodeMinutes), K.BOLUM_DK_MIN, K.BOLUM_DK_MAX) : K.BOLUM_DK_VARSAYILAN);

// Öğe başına kırpma anti-hilenin KENDİSİdir: ayrı bir "şüpheli mi" katmanı yok,
// aritmetiğin içinde. minutes: 600000 yazan kullanıcı film başına en fazla 280
// Kare alır. Yanlış pozitif üretmez — dürüst kullanıcı sınırı hiç görmez.
export const filmPuani = (m) => K.FILM_TABAN + Math.round(etkinFilmDk(m) * K.FILM_DK_KATSAYI);
export const bolumPuani = (e) => K.BOLUM_TABAN + Math.round(etkinBolumDk(e) * K.BOLUM_DK_KATSAYI);

export function enUzunArdisik(sortedGunler) {
  let best = 0, cur = 0, prev = null;
  for (const g of sortedGunler) {
    const i = gunIndex(g);
    cur = prev !== null && i - prev === 1 ? cur + 1 : 1;
    if (cur > best) best = cur;
    prev = i;
  }
  return best;
}

/**
 * Tüm izleme verisini TEK GEÇİŞTE puana ve rozet ölçütlerine çevirir.
 * Rozetlerin hiçbiri listeyi ayrıca taramaz; hepsi buradan çıkan `stats`i okur.
 *
 * @param {object[]} movies  Lists/{uid}/watchedMovies dokümanları
 * @param {object[]} shows   dedupeWatchedTvEntries'ten GEÇMİŞ watchedTv dokümanları
 * @param {(name:string)=>string} kanonikTur  utils/genreCanon.js
 * @param {number} simdi  "şu an" (ms). Yalnızca tarih makullük penceresi için;
 *   dışarıdan verilebilmesi modülün saatten bağımsız test edilmesini sağlar.
 */
export function computeWatchScore({
  movies = [], shows = [],
  kanonikTur = (x) => String(x || "").toLowerCase(),
  simdi = Date.now(),
} = {}) {
  const gk = (v) => gunKey(v, simdi);
  const gunler = new Map();       // gunKey -> { icerik, film, bolum }
  const turSayaci = new Map();    // kanonik tür -> içerik adedi
  const yilAy = new Map();        // yıl -> Set(ay)
  const diziGunleri = new Map();  // showKey -> Set(gunKey)
  const sezonGun = new Map();     // showKey|sezon|gun -> adet
  const harfler = new Set();

  let filmSayisi = 0, bolumSayisi = 0;
  let etkinDakikaToplam = 0, tahminiEser = 0;
  let uzunMetraj = 0, yuksekPuanliBolum = 0;
  let tamamlananDizi = 0;
  const diziGunBonusu = new Map();   // bitiş günü (ya da null) -> o güne düşen ham bonus
  let cadilar = 0, yilDevri = 0, sevgililer = 0;

  const gunKaydi = (g) => {
    let r = gunler.get(g);
    if (!r) { r = { icerik: 0, film: 0, bolum: 0 }; gunler.set(g, r); }
    return r;
  };
  const turEkle = (liste, adet) => {
    if (adet <= 0) return;
    for (const g of Array.isArray(liste) ? liste : []) {
      const id = kanonikTur(g);
      if (!id) continue;
      turSayaci.set(id, (turSayaci.get(id) || 0) + adet);
    }
  };
  const takvimEkle = (g) => {
    const [y, m] = g.split("-").map(Number);
    if (!yilAy.has(y)) yilAy.set(y, new Set());
    yilAy.get(y).add(m);
    return m;
  };
  const ilkHarf = (ad) => {
    const s = String(ad || "").trim();
    if (!s) return;
    const c = s.toLocaleUpperCase("tr-TR")[0];
    if (/\p{L}/u.test(c)) harfler.add(c);
  };

  // ── Filmler ───────────────────────────────────────────────────────────────
  for (const m of movies) {
    // watchedMovies alt koleksiyonunda kural olarak yalnız film var, ama eski
    // kök-array göçünden artakalan tv kaydı bölümlerle çift sayılmasın.
    if (m?.type && m.type !== "movie") continue;
    filmSayisi++;
    ilkHarf(m?.name);
    const dk = etkinFilmDk(m);
    etkinDakikaToplam += dk;
    if (!(num(m?.minutes) > 0)) tahminiEser++;
    if (num(m?.minutes) >= 150) uzunMetraj++;

    const turIds = (Array.isArray(m?.genres) ? m.genres : []).map(kanonikTur);
    turEkle(m?.genres, 1);

    const g = gk(m?.dateAdded);
    if (!g) continue;   // tarihsiz kayıt içerik/ritim puanı vermez ama tür puanına girdi
    const r = gunKaydi(g); r.icerik += filmPuani(m); r.film++;
    takvimEkle(g);
    const md = g.slice(5);
    if (md === "10-31" && turIds.includes("horror")) cadilar = 1;
    if (md === "12-31" || md === "01-01") yilDevri = 1;
    if (md === "02-14" && turIds.includes("romance")) sevgililer = 1;
  }

  // ── Diziler ───────────────────────────────────────────────────────────────
  shows.forEach((s, showIdx) => {
    // Math.random() fallback KULLANILMAZ: aynı veri her hesapta aynı sonucu
    // vermeli (türetilmişlik sözleşmesi). Kimliksiz dizide indeks anahtardır.
    const showKey = String(s?.id ?? s?._docId ?? s?.name ?? `#${showIdx}`);
    ilkHarf(s?.name);
    const turIds = (Array.isArray(s?.genres) ? s.genres : []).map(kanonikTur);
    let izlenenBolum = 0;
    let sonIzlemeGunu = null;   // dizinin en geç izleme günü — bonus buraya yazılır

    for (const sez of Array.isArray(s?.seasons) ? s.seasons : []) {
      const eps = Array.isArray(sez?.episodes) ? sez.episodes : [];
      izlenenBolum += eps.length;
      for (const e of eps) {
        bolumSayisi++;
        etkinDakikaToplam += etkinBolumDk(e);
        if (!(num(e?.episodeMinutes) > 0)) tahminiEser++;
        // episodeRatings = TMDB vote_average. İki yazma yolu string, ikisi
        // number yazıyor (EpisodeDetails.js:319 vs SeasonItem.js:342) → Number().
        if (num(e?.episodeRatings) >= 9) yuksekPuanliBolum++;

        const g = gk(e?.episodeWatchTime ?? sez?.addedSeasonDate ?? s?.addedShowDate);
        if (!g) continue;
        const r = gunKaydi(g); r.icerik += bolumPuani(e); r.bolum++;
        takvimEkle(g);
        const md = g.slice(5);
        if (md === "10-31" && turIds.includes("horror")) cadilar = 1;
        if (md === "12-31" || md === "01-01") yilDevri = 1;
        if (md === "02-14" && turIds.includes("romance")) sevgililer = 1;

        if (sonIzlemeGunu === null || g > sonIzlemeGunu) sonIzlemeGunu = g;
        if (!diziGunleri.has(showKey)) diziGunleri.set(showKey, new Set());
        diziGunleri.get(showKey).add(g);
        const sk = `${showKey}|${sez?.seasonNumber}|${g}`;
        sezonGun.set(sk, (sezonGun.get(sk) || 0) + 1);
      }
    }
    // Tür sayacı dizide BİR eser sayar, bölüm adedi kadar DEĞİL. Bölümle
    // beslemek, "Korku türünde 25 içerik izle" yazan rozeti tek bir 26 bölümlük
    // diziyle açıyordu — rozetin metniyle davranışı çelişiyordu.
    if (izlenenBolum > 0) turEkle(s?.genres, 1);

    // Dizi bitirme. `showEpisodeCount` bayat olabilir ama HİÇBİR yazma yolunda
    // izlenen sayıya eşitlenmez (yoksa 0 kalır, >= 2 koşulu eler). `seasonEpisodes`
    // ise üç yolda izlenen sayıya eşitleniyor — bu yüzden SEZON tamamlama
    // ölçülemez ve bilerek puanlanmaz (docs §2.2, §10.1).
    const hedef = num(s?.showEpisodeCount);
    const izlenen = num(s?.watchedEpisodeCount) || izlenenBolum;
    if (hedef >= K.DIZI_MIN_BOLUM && izlenen >= hedef && izlenen <= hedef * K.DIZI_BAYATLIK_KATI) {
      tamamlananDizi++;
      // Bonus dizinin UZUNLUĞUYLA ölçeklenir: 2 bölümlük bir "mini dizi" 50,
      // 20+ bölümlük gerçek bir dizi 500 eder. Düz 500, mini dizi çiftliğini
      // sistemin en ucuz Kare kaynağı yapıyordu.
      const ham = Math.min(K.DIZI_BONUS, hedef * K.DIZI_BONUS_BOLUM_BASI);
      // Bonus BİTİŞ GÜNÜNE yazılır; tavan aşağıda GÜN BAŞINA uygulanır.
      // Tarihsiz kayıtlar tek bir kovada toplanır (eski göç verisi) — böylece
      // ne sıfır alırlar ne de sınırsız birikirler.
      const gun = sonIzlemeGunu;
      diziGunBonusu.set(gun, (diziGunBonusu.get(gun) || 0) + ham);
    }
  });

  // ── Toplama ───────────────────────────────────────────────────────────────
  const gunListesi = [...gunler.keys()].sort();
  let icerikPuani = 0, tavanaTakilanGun = 0, maxGunFilm = 0;
  for (const g of gunListesi) {
    const r = gunler.get(g);
    if (r.icerik > K.GUNLUK_TAVAN) tavanaTakilanGun++;
    icerikPuani += Math.min(K.GUNLUK_TAVAN, r.icerik);
    if (r.film > maxGunFilm) maxGunFilm = r.film;
  }
  const enUzunSeri = enUzunArdisik(gunListesi);
  const seriPuani = K.SERI_KILOMETRE.reduce((a, [esik, p]) => a + (enUzunSeri >= esik ? p : 0), 0);
  const gunPuani = gunListesi.length * K.GUN_BONUSU;
  // Ritim tavanı, tarih uydurarak kazanılabilecek MAKSİMUM Kare'yi 9.000'de
  // kilitler (≈ Perde 7). Tarih istemci girdisi olduğu için doğrulanamaz;
  // savunma tespit değil SINIRLAMAdır (docs §8.3).
  const ritimPuani = Math.min(K.RITIM_TAVAN, gunPuani + seriPuani);
  const turPuani = Math.min(turSayaci.size, K.TUR_TAVAN) * K.TUR_ILK;

  // Dizi bonusu tavanı GÜN BAŞINA uygulanır — toplama değil.
  //
  // İki yanlış deneme kaydedilsin, çünkü ikisi de mantıklı görünüyordu:
  //   1. Tavanı İÇERİK PUANINA bağlamak. Bir bölüm içeriğe yalnızca ~37 Kare
  //      kattığı için çoğunlukla dizi izleyen dürüst kullanıcıda sürekli
  //      bağlıyordu (30 bölümlük tek dizi: 500 yerine 277).
  //   2. Tavanı TOPLAM GÜN SAYISINA bağlamak (`gunSayisi × 100`). Bu daha da
  //      kötüydü ve iki yönden birden yanlıştı:
  //      • `markShow` bir dizinin TÜM bölümlerine TEK tarih yazıyor
  //        (watchedTvService.js:268). Yani bir diziyi kanonik yoldan bitirmek
  //        yalnızca 1 gün üretiyor → 40 bölümlük dizi 500 yerine 100 alıyordu.
  //        Tavan tam da dürüst yolu cezalandırıyordu.
  //      • Tavan GLOBAL olduğu ve `gunListesi` FİLM günlerini de içerdiği için,
  //        100 filmi 100 güne yayan biri tavanını 10.100'e çıkarıp mini dizi
  //        çiftliğini yeniden açabiliyordu.
  //
  // Doğru çapa BİTİŞ GÜNÜdür: istismarın imzası "yüzlerce diziyi AYNI güne
  // işaretlemek", dürüst kullanımın imzası ise "her diziyi kendi gününde
  // bitirmek". Tavanı güne koymak ikisini kaynağında ayırır ve film günleriyle
  // finanse edilemez.
  let diziPuani = 0;
  for (const gunToplami of diziGunBonusu.values()) {
    diziPuani += Math.min(K.DIZI_GUN_TAVANI, gunToplami);
  }

  // ── Rozet ölçütleri (hepsi bu tek geçişten türer) ─────────────────────────
  // MEVSİMSEL ÖLÇÜTLER GÜN SAYAR, BÖLÜM DEĞİL. Bölüm saymak farmlanabilirdi:
  // watchedTvService.markShow tüm bölümlere TEK bir tarih yazıyor, yani 120
  // bölümlük bir diziyi 15 Temmuz'a işaretlemek "yaz sezonu" rozetini tek
  // dokunuşla açıyordu. Farklı gün sayısı bu istismara kapalıdır.
  let yazGun = 0, kisGun = 0;
  for (const g of gunListesi) {
    const ay = Number(g.slice(5, 7));
    if (ay >= 6 && ay <= 8) yazGun++;
    else if (ay === 12 || ay === 1 || ay === 2) kisGun++;
  }

  let enUzunAra = 0;
  for (let i = 1; i < gunListesi.length; i++) {
    enUzunAra = Math.max(enUzunAra, gunIndex(gunListesi[i]) - gunIndex(gunListesi[i - 1]));
  }
  let enCokAyliYil = 0;
  for (const set of yilAy.values()) enCokAyliYil = Math.max(enCokAyliYil, set.size);
  let sadikDiziGun = 0;
  for (const set of diziGunleri.values()) sadikDiziGun = Math.max(sadikDiziGun, set.size);
  let tekOturusta = 0;
  for (const v of sezonGun.values()) tekOturusta = Math.max(tekOturusta, v);
  let ciftPerde = 0;
  for (const r of gunler.values()) if (r.film >= 1 && r.bolum >= 5) { ciftPerde = 1; break; }

  const toplam = icerikPuani + ritimPuani + turPuani + diziPuani;

  return {
    toplam,
    kirilim: { icerikPuani, ritimPuani, turPuani, diziPuani, seriPuani, gunPuani },
    stats: {
      toplamKare: toplam,
      filmSayisi, bolumSayisi, diziSayisi: shows.length, tamamlananDizi,
      etkinDakikaToplam, tahminiEser,          // tahminiEser > 0 ⇒ UI'da "≈"
      gunSayisi: gunListesi.length, enUzunSeri, enUzunAra, tavanaTakilanGun,
      turSayisi: turSayaci.size, turSayaci,
      uzunMetraj, yuksekPuanliBolum, harfSayisi: harfler.size,
      enCokAyliYil, sadikDiziGun, tekOturusta, maxGunFilm, ciftPerde,
      cadilar, yilDevri, sevgililer, yazGun, kisGun,
    },
  };
}

// ── Perde merdiveni ─────────────────────────────────────────────────────────
// 20 perde, 30 değil: 30'luk bir merdivende üst 12 isim kullanıcıların %1'i
// dışında kimsenin görmeyeceği ölü içerik olurdu. Zirve sonrası sınırsız
// "Makara" prestiji devreye girer.
//
// ÜST YARI ÖLÇÜLEREK KALİBRE EDİLDİ (__tests__/watchScoring.test.js "kalibrasyon"):
// ilk taslakta 5 yıllık ağır kullanıcı (512 film + 3.400 bölüm, 900 güne
// yayılmış) 175.000'lik tavanı AŞIYOR ve sistemi ilk açtığı gün Perde 20'ye
// oturuyordu — yani mevcut ağır kullanıcıya ilerleyecek hiçbir şey kalmıyordu.
// Gerçek değeri 230.830 Kare. Eşikler P16'dan itibaren genişletildi; artık aynı
// kullanıcı Perde 19'da ve zirveye ~29.000 Kare (≈10 ay, kendi temposuyla) var.
// Alt yarı (P1–P15) DEĞİŞMEDİ: orada ölçülen değerler zaten hedefe oturuyordu.
export const PERDE_ESIK = [
  0, 130, 500, 1200, 2400, 4200, 6800, 10000, 14000, 19000,
  25000, 32000, 40000, 50000, 62000, 80000, 104000, 136000, 185000, 260000,
];
export const MAKARA_ADIMI = 40000;

// Tüm isimler İZLEYİCİYİ tarif eder — "Yönetmen" türü unvanlar bilinçle
// elenmiştir (kullanıcı film çekmiyor). Yay: seyirci → takipçi → uzman → miras.
export const PERDE_ADLARI = [
  "Bilet Sahibi", "Salon Müdavimi", "Seans Takipçisi", "Gece Kuşağı", "Maraton Koşucusu",
  "Sezon Takipçisi", "Jenerik Bekçisi", "Kanepe Eleştirmeni", "Sinefil", "Kült Avcısı",
  "Arşivci", "Koleksiyoncu", "Festival Gezgini", "Sinematek Üyesi", "Küratör",
  "Arşiv Ustası", "Kuşak Tanığı", "Sinema Hafızası", "Efsane Seyirci", "Beyazperde Efsanesi",
];
export const PERDE_ADLARI_EN = [
  "Ticket Holder", "Regular", "Showtime Follower", "Night Shift", "Marathon Runner",
  "Season Follower", "Credits Watcher", "Couch Critic", "Cinephile", "Cult Hunter",
  "Archivist", "Collector", "Festival Goer", "Cinematheque Member", "Curator",
  "Master Archivist", "Era Witness", "Cinema Memory", "Legendary Viewer", "Silver Screen Legend",
];

/**
 * @param {number} kare
 * @param {number} tabanPerde  ledger'daki perdeFloor — Perde ASLA bunun altına düşmez.
 *   Sebep: MovieDetail.js:413 bir filme ikinci kez basmayı `removeFromList`
 *   olarak yorumluyor. Yanlışlıkla iki kez basan kullanıcı, taban olmadan
 *   seviyesini kaybeder ve hiçbir açıklama görmez. Kural: puan düşebilir,
 *   Perde ve rozet düşmez.
 */
export function computePerde(kare, tabanPerde = 1, tabanMakara = 0) {
  const p = Math.max(0, num(kare));
  let perde = 1;
  while (perde < PERDE_ESIK.length && PERDE_ESIK[perde] <= p) perde++;
  const zirve = perde >= PERDE_ESIK.length;
  const sonEsik = PERDE_ESIK[PERDE_ESIK.length - 1];
  // Makara da tabanla korunur. Kartta "Perde 20 · 3. Makara" diye GÖRÜNEN bir
  // sayının, kullanıcı yanlışlıkla bir işareti geri aldığında 2'ye düşmesi
  // "Perde düşmez" sözünü tam olarak ihlal ederdi — kullanıcı için Makara,
  // Perde etiketinin bir parçasıdır, ayrı bir kavram değil.
  const makara = Math.max(
    zirve ? Math.floor((p - sonEsik) / MAKARA_ADIMI) : 0,
    Math.max(0, Math.floor(num(tabanMakara))),
  );
  const taban = PERDE_ESIK[perde - 1];
  const tavan = zirve ? null : PERDE_ESIK[perde];
  const hamIlerleme = zirve
    ? ((p - sonEsik) % MAKARA_ADIMI) / MAKARA_ADIMI
    : (p - taban) / (tavan - taban);

  const goruntulenen = clamp(Math.max(perde, num(tabanPerde) || 1), 1, PERDE_ESIK.length);
  // Taban devredeyse (puan düşmüş ama Perde/Makara korunuyor) barı dolu göster
  // ve "kalan"ı sıfırla — yoksa kart "Perde 11'desin, Perde 11'e 4.000 Kare
  // kaldı" gibi kendisiyle çelişen bir cümle kurar.
  //
  // MAKARA TABANI DA SAYILIR: yalnızca `goruntulenen > perde`ye bakmak, zirvedeki
  // bir kullanıcı için eksikti. Puanı düşüp Makara'sı tabanla korunduğunda Perde
  // hâlâ 20 olduğu için taban "devrede değil" sanılıyor ve kart "Sonraki
  // Makara'ya ≈ 12 film" diyordu — oysa o Makara zaten kazanılmıştı ve o filmler
  // izlense bile sayı değişmeyecekti. Tutulamayacak bir söz.
  const tabanDevrede = goruntulenen > perde
    || makara > (zirve ? Math.floor((p - sonEsik) / MAKARA_ADIMI) : 0);

  return {
    perde: goruntulenen,
    ad: PERDE_ADLARI[goruntulenen - 1],
    adEn: PERDE_ADLARI_EN[goruntulenen - 1],
    makara,
    zirve,
    tabanDevrede,
    ilerleme: tabanDevrede ? 1 : clamp(hamIlerleme, 0, 1),
    kalanKare: tabanDevrede ? 0 : (tavan == null ? MAKARA_ADIMI - ((p - sonEsik) % MAKARA_ADIMI) : tavan - p),
    banded: Math.ceil(goruntulenen / 4),   // 5 renk bandı, 4 perdede bir değişir
  };
}

/**
 * Kaba bozukluk elemesi — hile TESPİTİ DEĞİLDİR.
 * Tarih dağıtma saldırısını YAKALAMAZ: kayıtlar mükemmel dağılmış görünür ve
 * imza dürüst bir arşivciden ayırt edilemez. Bu açıkça kabul edilmiştir; asıl
 * savunma öğe-başı kırpma + günlük tavan + ritim tavanıdır.
 */
export function detectAnomalies(stats, shows = []) {
  const bayraklar = [];
  if (stats.tavanaTakilanGun > 0 && stats.gunSayisi === 1 && stats.filmSayisi + stats.bolumSayisi > 50) {
    bayraklar.push("tek_gune_yigilma");
  }
  if (stats.maxGunFilm > 150) bayraklar.push("gunluk_asiri_film");
  for (const s of shows) {
    const izlenen = (s?.seasons || []).reduce((a, x) => a + (x?.episodes?.length || 0), 0);
    if (izlenen > 5000) { bayraklar.push("dizi_bolum_patlamasi"); break; }
  }
  return bayraklar;
}
