// components/badges/watchBadgeCatalog.js
//
// İZLEME rozetleri — 81 adet: 13 kademeli aile (59 üye) + 22 tekil. Kimlik
// rozetlerinden (badgeCatalog.js) ve oyun başarımlarından
// (screens/game/gameRegistry.js) ayrı bir aile, aynı render altyapısını
// (AppBadge) kullanır.
//
// AİLE UZUNLUĞU TAVANI = 5 KADEME. Aileler eşit uzunlukta değildir (3–5), ama
// hiçbiri 5'i aşmaz: altıncı kademe `kademeSekli`nin beş şekil/renk basamağına
// sığmaz, iki kademe aynı silueti paylaşmak zorunda kalır ve merdiven gözle
// okunamaz hâle gelir. Uzunluk ölçütün doğal çözünürlüğünden gelir — `maraton`
// tek bir günün içinde geçtiği için 3 kademeden fazlasını taşımaz (8 filmin
// üstü izleme değil işaretleme davranışıdır), `film` 10'dan 2.000'e beş kademe
// sürer. Konum orana çevrildiği için her ailenin zirvesi — kaç kademe olursa
// olsun — altın sekizgene oturur.
//
// DÖRT KURAL — yeni rozet eklerken bunlara uy:
//
// 0. YENİ ROZET EKLEMEK MEVCUT KULLANICIDA SESSİZDİR. Defter (watchLedgerCore.js)
//    katalogda ilk kez gördüğü bir id'yi, kullanıcı onu zaten hak ediyorsa
//    `earned` VE `seen`e birlikte yazar. Bu koruma olmadan 3 yıllık bir
//    kullanıcıya güncelleme sonrası 15 rozetlik konfeti yağmuru patlıyordu.
//    Koruma `WATCH_BADGE_IDS`e dayanır; o listeyi bozma.
//
// 1. LEGENDARY KOTASI = 3 (`film_2000`, `bolum_10000`, `perde_20`). Dördüncü bir
//    legendary eklemek için mevcut birini düşürmek gerekir; nadirlik enflasyonu
//    rozet sisteminin bilinen ölüm biçimi.
//
//    KOTA 2'DEN 3'E BİLEREK ÇIKARILDI. Eskiden `film_500` legendary'ydi ve
//    ailenin zirvesiydi. Film/bölüm aileleri 5 kademeye çıkınca zirve 2.000 film
//    ve 10.000 bölüme taşındı — yani film_500 artık zirve DEĞİL (epic'e indi) ve
//    yerine gelen iki hedef eskisinden dört kat zor. İkisi kabaca eşit emek
//    istiyor (2.000 × 165 ≈ 330.000 Kare, 10.000 × 37 ≈ 370.000 Kare), bu yüzden
//    birini legendary yapıp diğerini epic bırakmak bir izleme biçimini
//    ödüllendirip diğerini cezalandırmak olurdu. 81 rozette 3 legendary = %3,7;
//    hâlâ nadir.
//
// 2. TARİH TÜREVİ ROZET TAVANI = rare. Gün/seri/mevsim rozetleri kullanıcının
//    kendi girdiği izleme tarihinden türer (DatePickerModal geçmişe onlarca yıl
//    açık). Uydurulabilir hiçbir rozet epic ya da legendary olamaz.
//
// 3. RARITY ELLE YAZILIR — resolveRarity(target) KULLANILMAZ. Hedefin büyüklüğü
//    zorluğu ölçmez: 2000 bölüm otomatik legendary olurdu ama 12 farklı türde
//    içerik izlemek çok daha zordur. Dağılım kasıtlı: 12 common · 31 uncommon ·
//    27 rare · 8 epic · 3 legendary — medyan uncommon, yani profil mor bir
//    duvara dönüşmez.
//
//    TEK İSTİSNA: KIDEM ailesi tarih tavanına tabi değildir (aşağıdaki uzun
//    gerekçe) — ölçütü sunucunun yazdığı hesap açılış tarihidir.
//
// GÖRSEL: `family` + `tier` alanları kartın SİLUETİNİ de belirler (kare →
// beşgen → altıgen, theme/badgeTokens.js `kademeSekli`). Renk nadirliği, kenar
// sayısı kademeyi kodlar; ikisi bağımsız iki eksendir.
//
// METİNLER İNLİNE: 81 rozet × 2 metin × 2 dil = 324 autoI18n anahtarı yazmak
// yerine tr/en/descTr/descEn burada durur (badgeCatalog.js emsali). i18n
// maliyeti yalnızca ekranın ~24 UI dizesine iner.
//
// PERFORMANS SÖZLEŞMESİ: her getProgress YALNIZCA `stats` okur. Hiçbir rozet
// izleme listesini ayrıca taramaz — 81 rozet × 3.900 kayıt taraması JS
// thread'ini kilitlerdi. Tüm ölçütler computeWatchScore'un tek geçişinden çıkar.

import { RARITY } from "@theme/badgeTokens";
import { GENRE } from "@utils/genreCanon";

// Rozet ekranındaki bölümler.
export const BOLUM = Object.freeze({
  KILOMETRE: "kilometre",
  RITIM: "ritim",
  TUR: "tur",
  MEVSIM: "mevsim",
  MUHUR: "muhur",
  SET: "set",
  KIDEM: "kidem",
  PERDE: "perde",
  GIZLI: "gizli",
});

export const BOLUM_BASLIK = Object.freeze({
  kilometre: { tr: "Kilometre Taşları", en: "Milestones" },
  ritim: { tr: "Ritim", en: "Rhythm" },
  tur: { tr: "Türler", en: "Genres" },
  mevsim: { tr: "Mevsimsel", en: "Seasonal" },
  muhur: { tr: "Dönem Mühürleri", en: "Season Seals" },
  set: { tr: "Koleksiyonlar", en: "Collections" },
  kidem: { tr: "Kıdem", en: "Tenure" },
  perde: { tr: "Perde", en: "Acts" },
  gizli: { tr: "Gizli", en: "Hidden" },
});

// Ekrandaki bölüm sırası. Kart listesinin dizilişinden BAĞIMSIZ olmalı: mühür
// ve koleksiyon kartları katalogda değil, çalışma anında üretiliyor ve listeye
// sonda ekleniyor — sıra karttan türeseydi ikisi de ekranın dibinde kalırdı.
// Mühür/koleksiyon ortada durur: yeni kullanıcı önce ulaşılabilir kilometre
// taşlarını görür, "0/6 koleksiyon" ilk izlenim olmaz.
export const BOLUM_SIRA = Object.freeze([
  BOLUM.KILOMETRE,
  BOLUM.RITIM,
  BOLUM.TUR,
  BOLUM.MEVSIM,
  BOLUM.MUHUR,
  BOLUM.SET,
  BOLUM.KIDEM,
  BOLUM.PERDE,
  BOLUM.GIZLI,
]);

// gameRegistry.defineAchievement ile AYNI sözleşme + üç ek alan:
// `family` (kademe ailesi), `tier` (aile içi sıra), `hidden` (gizli rozet).
const defineWatchBadge = (def) => ({
  ...def,
  // iconSolid ELLE yazılır. Eskiden icon.replace("-outline","") ile türetiliyordu;
  // Ionicons'ta her outline ikonun dolu ikizi yok ve AppIcon tanınmayan isimde
  // kırmızı uyarı üçgeni basıyor — hata sessizce kullanıcıya gidiyordu.
  iconSolid: def.iconSolid || def.icon,
  section: def.section || BOLUM.KILOMETRE,
  family: def.family || null,
  tier: def.tier || 0,
  hidden: !!def.hidden,
  // `birim`: ilerleme/hedef sayısının GÖSTERİM birimi. getProgress ve target
  // ham değeri (dakika) taşımaya devam eder — puan/karşılaştırma dakikayla
  // yapılır — ama kullanıcıya "525.600" yerine "8.760 saat" gösterilir.
  // Yalnızca süre ailesi kullanır; verilmeyen her rozet ham sayıyı gösterir.
  birim: def.birim || null,
  isUnlocked: (stats) => def.getProgress(stats) >= def.target,
});

const turSayisi = (stats, id) => Number(stats?.turSayaci?.get?.(id)) || 0;
const say = (stats, alan) => Number(stats?.[alan]) || 0;

// Süre ailesi ham DAKİKA toplar (etkinDakikaToplam) ve VARSAYILAN OLARAK da
// dakika gösterir (kullanıcı isteği). Tek bir sabit birim seçmek zorunda
// değiliz: rozet detay modalindeki çevirici aynı ham değeri dk/sa/gün olarak
// döndürür. Puanlama ve eşik karşılaştırması her hâlükârda dakikayla yapılır;
// burası yalnızca görüntü katmanıdır (WatchBadgeCard / Modal / WatchLevelCard).
const DAKIKA = { id: "dk", bol: 1, ekTr: "dk", ekEn: "min" };
const SAAT = { id: "sa", bol: 60, ekTr: "sa", ekEn: "h" };
const GUN = { id: "gun", bol: 1440, ekTr: "gün", ekEn: "d" };

// Çeviricinin sırası; İLK eleman varsayılandır.
export const SURE_BIRIMLERI = [DAKIKA, SAAT, GUN];
export const SURE_BIRIM_VARSAYILAN = DAKIKA.id;

/** Çevirici id'sini ("dk" | "sa" | "gun") birim tanımına çevirir. */
export const sureBirimiBul = (id) =>
  SURE_BIRIMLERI.find((b) => b.id === id) || DAKIKA;

/**
 * Bir rozetin ilerleme/hedef sayısını GÖSTERİM için biçimler.
 * `birim` yoksa ham sayıyı yerelleştirir; varsa birime böler ve son ek ekler.
 * @param {object} badge          birim taşıyan rozet (ya da sonrakiHedef nesnesi)
 * @param {number} deger          ham değer (ör. dakika)
 * @param {string} lang           "tr" | "en"
 * @param {object} [birimOverride] çeviriciden gelen birim; YALNIZCA rozetin
 *   kendi birimi varsa dikkate alınır — birimsiz rozette (film adedi gibi)
 *   bölme yapmak sayıyı bozardı.
 */
export function formatBadgeDeger(badge, deger, lang, birimOverride) {
  const ham = Number(deger) || 0;
  const yerel = (n, ondalik = 0) =>
    n.toLocaleString(lang === "tr" ? "tr-TR" : "en-US", {
      minimumFractionDigits: ondalik,
      maximumFractionDigits: ondalik,
    });
  const taban = badge?.birim;
  if (!taban) return yerel(Math.round(ham));
  const b = birimOverride || taban;
  const ek = lang === "tr" ? b.ekTr : b.ekEn;
  const donusmus = ham / b.bol;
  // Ondalık YALNIZ gerçekten kesirli değerlerde: 10.080 dk tam olarak 7 gündür,
  // "7,0 gün" yazmak olmayan bir hassasiyet iddia eder. Kesirliyse büyük birime
  // çevrilen küçük değer yuvarlanınca "0 gün" olup ilerleme yokmuş gibi
  // görünüyordu; 1'in altında iki, 10'un altında bir ondalık gösterilir.
  let ondalik = 0;
  if (b.bol > 1 && donusmus > 0 && donusmus < 10 && !Number.isInteger(donusmus)) {
    ondalik = donusmus < 1 ? 2 : 1;
  }
  // AŞAĞI kırpılır, yuvarlanmaz: 10.079 dk saat cinsinden 168'e yuvarlanıp
  // kilitli bir rozette "168/168 sa" (tamamlanmış) gibi görünüyordu.
  const carpan = 10 ** ondalik;
  return `${yerel(Math.floor(donusmus * carpan) / carpan, ondalik)} ${ek}`;
}

/**
 * Yalnız SAYI kısmı — birim eki başka bir yerde (çevirici çipi, aralık sonu)
 * yazıldığında kullanılır. Dar hücrelerde "525.600 dk" kırpılıyordu.
 */
export function formatBadgeSayi(badge, deger, lang, birimOverride) {
  const metin = formatBadgeDeger(badge, deger, lang, birimOverride);
  const bosluk = metin.lastIndexOf(" ");
  return bosluk < 0 ? metin : metin.slice(0, bosluk);
}

/**
 * "ilerleme / hedef" ikilisini biçimler. Birim eki TEK KEZ, sonda yazılır:
 * dakika gösteriminde sayılar altı haneye çıkabiliyor ("525.600 dk/525.600 dk")
 * ve eki iki kez tekrarlamak kompakt rozet kartında satırı taşırıyordu.
 */
export function formatBadgeAralik(badge, ilerleme, target, lang, birimOverride) {
  // Sayı ile ekini ayır: birimsiz rozette yerelleştirilmiş sayı boşluk
  // içermez (tr "525.600", en "525,600"), o yüzden son boşluk güvenli sınır.
  const hedefMetin = formatBadgeDeger(badge, target, lang, birimOverride);
  const bosluk = hedefMetin.lastIndexOf(" ");
  const ilerlemeSayi = formatBadgeSayi(badge, ilerleme, lang, birimOverride);
  if (bosluk < 0) return `${ilerlemeSayi}/${hedefMetin}`;
  return `${ilerlemeSayi}/${hedefMetin.slice(0, bosluk)} ${hedefMetin.slice(bosluk + 1)}`;
}

export const WATCH_BADGES = [
  // ── Kilometre taşları ─────────────────────────────────────────────────────
  defineWatchBadge({
    id: "ilk_kare", icon: "footsteps-outline", iconSolid: "footsteps", rarity: RARITY.common,
    tr: "İlk Kare", en: "First Frame",
    descTr: "İlk film ya da bölümünü işaretle", descEn: "Mark your first film or episode",
    target: 1, getProgress: (s) => say(s, "filmSayisi") + say(s, "bolumSayisi"),
  }),
  defineWatchBadge({
    id: "film_10", icon: "film-outline", iconSolid: "film", rarity: RARITY.common,
    family: "film", tier: 1, tr: "İlk Bilet", en: "First Ticket",
    descTr: "10 film izle", descEn: "Watch 10 films",
    target: 10, getProgress: (s) => say(s, "filmSayisi"),
  }),
  defineWatchBadge({
    id: "film_50", icon: "film-outline", iconSolid: "film", rarity: RARITY.uncommon,
    family: "film", tier: 2, tr: "Sürekli Müşteri", en: "Regular",
    descTr: "50 film izle", descEn: "Watch 50 films",
    target: 50, getProgress: (s) => say(s, "filmSayisi"),
  }),
  defineWatchBadge({
    id: "film_150", icon: "film-outline", iconSolid: "film", rarity: RARITY.rare,
    family: "film", tier: 3, tr: "Salon Sakini", en: "Theater Dweller",
    descTr: "150 film izle", descEn: "Watch 150 films",
    target: 150, getProgress: (s) => say(s, "filmSayisi"),
  }),
  defineWatchBadge({
    id: "film_500", icon: "film-outline", iconSolid: "film", rarity: RARITY.epic,
    family: "film", tier: 4, tr: "Beş Yüz Film", en: "Five Hundred Films",
    descTr: "500 film izle", descEn: "Watch 500 films",
    target: 500, getProgress: (s) => say(s, "filmSayisi"),
  }),
  // ZİRVE. Eşikler ÜSTE eklendi, aradakiler DEĞİŞTİRİLMEDİ: hem her id kendi
  // hedefini doğru söylemeye devam ediyor (film_150 gerçekten 150) hem de
  // kimsenin kazanılmış rozeti kaymıyor. Merdiven 5× · 3× · 3,3× · 4× oranıyla
  // ilerliyor — son sıçramanın en büyük olması kasıtlı, altın kademe öyle olmalı.
  // 2.000 film ≈ 330.000 Kare: 5 yıllık ağır kullanıcının (512 film) dört katı,
  // yani ömürlük bir hedef. Ulaşılamaz değil, ama kısa yoldan alınamaz.
  defineWatchBadge({
    id: "film_2000", icon: "film-outline", iconSolid: "film", rarity: RARITY.legendary,
    family: "film", tier: 5, tr: "İki Bin Film", en: "Two Thousand Films",
    descTr: "2000 film izle", descEn: "Watch 2000 films",
    target: 2000, getProgress: (s) => say(s, "filmSayisi"),
  }),
  defineWatchBadge({
    id: "bolum_25", icon: "tv-outline", iconSolid: "tv", rarity: RARITY.common,
    family: "bolum", tier: 1, tr: "Sezon Başı", en: "Season Opener",
    descTr: "25 bölüm izle", descEn: "Watch 25 episodes",
    target: 25, getProgress: (s) => say(s, "bolumSayisi"),
  }),
  defineWatchBadge({
    id: "bolum_100", icon: "tv-outline", iconSolid: "tv", rarity: RARITY.uncommon,
    family: "bolum", tier: 2, tr: "Bölüm Avcısı", en: "Episode Hunter",
    descTr: "100 bölüm izle", descEn: "Watch 100 episodes",
    target: 100, getProgress: (s) => say(s, "bolumSayisi"),
  }),
  defineWatchBadge({
    id: "bolum_500", icon: "tv-outline", iconSolid: "tv", rarity: RARITY.rare,
    family: "bolum", tier: 3, tr: "Bölüm Kurdu", en: "Episode Devourer",
    descTr: "500 bölüm izle", descEn: "Watch 500 episodes",
    target: 500, getProgress: (s) => say(s, "bolumSayisi"),
  }),
  defineWatchBadge({
    id: "bolum_2000", icon: "tv-outline", iconSolid: "tv", rarity: RARITY.epic,
    family: "bolum", tier: 4, tr: "İki Bin Bölüm", en: "Two Thousand Episodes",
    descTr: "2000 bölüm izle", descEn: "Watch 2000 episodes",
    target: 2000, getProgress: (s) => say(s, "bolumSayisi"),
  }),
  // ZİRVE. Merdiven 4× · 5× · 4× · 5× — film ailesinden daha dik, çünkü bölüm
  // başına Kare de düşük (≈37'ye karşı ≈165). 10.000 bölüm ≈ 370.000 Kare,
  // yani 2.000 filmle KABACA AYNI emek. İki ailenin zirvesi eşit ağırlıkta
  // olmalı; biri diğerinden ucuz olsaydı sistem bir izleme biçimini
  // ödüllendirip diğerini cezalandırırdı.
  defineWatchBadge({
    id: "bolum_10000", icon: "tv-outline", iconSolid: "tv", rarity: RARITY.legendary,
    family: "bolum", tier: 5, tr: "On Bin Bölüm", en: "Ten Thousand Episodes",
    descTr: "10000 bölüm izle", descEn: "Watch 10000 episodes",
    target: 10000, getProgress: (s) => say(s, "bolumSayisi"),
  }),
  // TAKİP EDİLEN DİZİ SAYISI — katalogda `diziSayisi`yi okuyan tek rozet.
  // Film/bölüm aileleri "ne kadar" izlediğini sayar; bu rozet KAÇ FARKLI dizinin
  // peşine düştüğünü söyler. 100 farklı dizi, bitirmeyi değil KEŞFETMEYİ
  // ödüllendirir — final ailesinin (bitirilen dizi) tam karşı kutbu.
  defineWatchBadge({
    id: "dizi_100", icon: "grid-outline", iconSolid: "grid", rarity: RARITY.rare,
    tr: "Yüz Dizi", en: "Hundred Series",
    descTr: "100 farklı diziyi takip et", descEn: "Track 100 different series",
    target: 100, getProgress: (s) => say(s, "diziSayisi"),
  }),
  defineWatchBadge({
    id: "final_1", icon: "checkmark-done-outline", iconSolid: "checkmark-done", rarity: RARITY.common,
    family: "final", tier: 1, tr: "Final Jeneriği", en: "End Credits",
    descTr: "İşaretlediğin bir diziyi sonuna getir", descEn: "Finish a series you track",
    target: 1, getProgress: (s) => say(s, "tamamlananDizi"),
  }),
  // Merdiven 1 → 100: zirve (100 dizi bitirmek) "Arşiv Kapatıcı", altın sekizgen.
  // Oranlar 10× · 2,5× · 2× · 2× — ilk sıçrama en büyük, sonra yumuşar. 100
  // tamamlanmış dizi film_2000 ölçeğinde bir ömürlük hedeftir.
  defineWatchBadge({
    id: "final_10", icon: "checkmark-done-outline", iconSolid: "checkmark-done", rarity: RARITY.uncommon,
    family: "final", tier: 2, tr: "Seri Tamamlayıcı", en: "Series Closer",
    descTr: "10 diziyi sonuna getir", descEn: "Finish 10 series",
    target: 10, getProgress: (s) => say(s, "tamamlananDizi"),
  }),
  defineWatchBadge({
    id: "final_25", icon: "checkmark-done-outline", iconSolid: "checkmark-done", rarity: RARITY.uncommon,
    family: "final", tier: 3, tr: "Final Koleksiyoncusu", en: "Finale Collector",
    descTr: "25 diziyi sonuna getir", descEn: "Finish 25 series",
    target: 25, getProgress: (s) => say(s, "tamamlananDizi"),
  }),
  defineWatchBadge({
    id: "final_50", icon: "checkmark-done-outline", iconSolid: "checkmark-done", rarity: RARITY.rare,
    family: "final", tier: 4, tr: "Dizi Ustası", en: "Series Master",
    descTr: "50 diziyi sonuna getir", descEn: "Finish 50 series",
    target: 50, getProgress: (s) => say(s, "tamamlananDizi"),
  }),
  defineWatchBadge({
    id: "final_100", icon: "checkmark-done-outline", iconSolid: "checkmark-done", rarity: RARITY.rare,
    family: "final", tier: 5, tr: "Arşiv Kapatıcı", en: "Archive Closer",
    descTr: "100 diziyi sonuna getir", descEn: "Finish 100 series",
    target: 100, getProgress: (s) => say(s, "tamamlananDizi"),
  }),
  // SÜRE AİLESİ — toplam EKRAN SÜRESİ (etkinDakikaToplam) kademeleri.
  //
  // Kademeler takvim birimleriyle okunur (1 hafta → 1 yıl) ama ölçüt HAM
  // DAKİKAdır: hedef, o kadar sürenin dakika karşılığıdır (1 gün = 1.440 dk).
  //   1 hafta =  10.080 dk = 168 saat
  //   1 ay    =  43.200 dk = 720 saat   (30 gün)
  //   3 ay    = 129.600 dk = 2.160 saat (90 gün)
  //   6 ay    = 259.200 dk = 4.320 saat (180 gün)
  //   1 yıl   = 525.600 dk = 8.760 saat (365 gün) — ALTIN
  //
  // Zirve (1 yıl ekran süresi) bilerek film_2000/bolum_10000 ölçeğinde: karışık
  // izleyen ağır bir kullanıcının ömürlük hedefi. `birim: SAAT` ilerlemeyi dakika
  // yerine saat gösterir; descTr/descEn dönüşümü açıkça yazar (kullanıcı isteği).
  defineWatchBadge({
    id: "sure_hafta", icon: "hourglass-outline", iconSolid: "hourglass", rarity: RARITY.uncommon,
    family: "sure", tier: 1, birim: DAKIKA, tr: "Bir Hafta Perdede", en: "A Week on Screen",
    descTr: "Toplam 1 hafta (168 saat) ekran süresine ulaş",
    descEn: "Reach 1 week (168 hours) of total screen time",
    target: 10080, getProgress: (s) => say(s, "etkinDakikaToplam"),
  }),
  defineWatchBadge({
    id: "sure_ay", icon: "hourglass-outline", iconSolid: "hourglass", rarity: RARITY.uncommon,
    family: "sure", tier: 2, birim: DAKIKA, tr: "Bir Ay Perdede", en: "A Month on Screen",
    descTr: "Toplam 1 ay (720 saat) ekran süresine ulaş",
    descEn: "Reach 1 month (720 hours) of total screen time",
    target: 43200, getProgress: (s) => say(s, "etkinDakikaToplam"),
  }),
  defineWatchBadge({
    id: "sure_3ay", icon: "hourglass-outline", iconSolid: "hourglass", rarity: RARITY.rare,
    family: "sure", tier: 3, birim: DAKIKA, tr: "Üç Ay Perdede", en: "Three Months on Screen",
    descTr: "Toplam 3 ay (2.160 saat) ekran süresine ulaş",
    descEn: "Reach 3 months (2,160 hours) of total screen time",
    target: 129600, getProgress: (s) => say(s, "etkinDakikaToplam"),
  }),
  defineWatchBadge({
    id: "sure_6ay", icon: "time-outline", iconSolid: "time", rarity: RARITY.rare,
    family: "sure", tier: 4, birim: DAKIKA, tr: "Altı Ay Perdede", en: "Six Months on Screen",
    descTr: "Toplam 6 ay (4.320 saat) ekran süresine ulaş",
    descEn: "Reach 6 months (4,320 hours) of total screen time",
    target: 259200, getProgress: (s) => say(s, "etkinDakikaToplam"),
  }),
  defineWatchBadge({
    id: "sure_yil", icon: "time-outline", iconSolid: "time", rarity: RARITY.epic,
    family: "sure", tier: 5, birim: DAKIKA, tr: "Bir Yıl Perdede", en: "A Year on Screen",
    descTr: "Toplam 1 yıl (8.760 saat) ekran süresine ulaş",
    descEn: "Reach 1 year (8,760 hours) of total screen time",
    target: 525600, getProgress: (s) => say(s, "etkinDakikaToplam"),
  }),
  // UZUN METRAJ AİLESİ — 150 dakikayı aşan film adedi (`uzunMetraj`).
  // Tek başına duran 10'luk hedef kademelendirildi (kullanıcı isteği): 10 → 25
  // → 50 → 100, yani ikiye katlanan bir merdiven. Ölçüt SÜREden türer, izleme
  // TARİHİnden değil — uydurulamaz, bu yüzden zirve epic olabilir (2. kural
  // yalnız tarih türevi rozetleri rare'de tutar).
  //
  // 100 uzun film ≈ 250 saat yalnızca bu kategoride: film_500 ölçeğinde, ama
  // farklı bir izleyici tipini ödüllendirir — çok değil UZUN izleyeni.
  defineWatchBadge({
    id: "uzun_metraj", icon: "albums-outline", iconSolid: "albums", rarity: RARITY.uncommon,
    family: "uzunMetraj", tier: 1, tr: "Uzun Metraj", en: "Feature Length",
    descTr: "150 dakikadan uzun 10 film izle", descEn: "Watch 10 films over 150 minutes",
    target: 10, getProgress: (s) => say(s, "uzunMetraj"),
  }),
  defineWatchBadge({
    id: "uzun_metraj_25", icon: "albums-outline", iconSolid: "albums", rarity: RARITY.uncommon,
    family: "uzunMetraj", tier: 2, tr: "Uzun Soluklu", en: "Long Haul",
    descTr: "150 dakikadan uzun 25 film izle", descEn: "Watch 25 films over 150 minutes",
    target: 25, getProgress: (s) => say(s, "uzunMetraj"),
  }),
  defineWatchBadge({
    id: "uzun_metraj_50", icon: "layers-outline", iconSolid: "layers", rarity: RARITY.rare,
    family: "uzunMetraj", tier: 3, tr: "Destan Sever", en: "Epic Lover",
    descTr: "150 dakikadan uzun 50 film izle", descEn: "Watch 50 films over 150 minutes",
    target: 50, getProgress: (s) => say(s, "uzunMetraj"),
  }),
  defineWatchBadge({
    id: "uzun_metraj_100", icon: "layers-outline", iconSolid: "layers", rarity: RARITY.epic,
    family: "uzunMetraj", tier: 4, tr: "Yüz Destan", en: "Hundred Epics",
    descTr: "150 dakikadan uzun 100 film izle", descEn: "Watch 100 films over 150 minutes",
    target: 100, getProgress: (s) => say(s, "uzunMetraj"),
  }),

  // ── Ritim ─────────────────────────────────────────────────────────────────
  // SERİ AİLESİ `rekorHaftaSerisi`DEN BESLENİR — `enUzunSeri`den DEĞİL.
  //
  // Eski ölçüt kullanıcının SEÇTİĞİ izleme tarihinden hesaplanıyordu ve
  // DatePickerModal geçmişe onlarca yıl açık: üç gün ara veren kullanıcı geri
  // dönüp o günlere içerik işaretleyip serisini TAMİR EDEBİLİYORDU. Tamir
  // edilebilen bir seri gerilim üretmez; "serimi bozmayayım" hissinin tamamı
  // serinin kaybedilebilir olmasından gelir. Yeni ölçüt cihaz saatiyle gerçek
  // işaretleme anından türer ve geriye dönük düzeltilemez (utils/watchActivity.js).
  //
  // HAFTA SAYAR, GÜN DEĞİL: bu bir izleme değil TAKİP uygulaması, kimse her gün
  // film izlemez. Günlük ceza kullanıcıyı seriyi korumak için sahte işaretlemeye
  // iter — yani sistemi kendi elimizle bozardık.
  //
  // REKOR okur, mevcut seri DEĞİL: mevcut seri bozulabilir, rozet bozulamaz.
  //
  // ID'LER KASITLI OLARAK KORUNDU (seri_3 → 2 hafta gibi görünse de). Yeniden
  // adlandırsaydık `earned` kümesindeki eski id'ler katalogda karşılıksız kalır
  // ve kullanıcının kazandığı rozet ekrandan SİLİNİRDİ. Aynı id kalınca defter
  // üyeliği rozeti açık tutmaya devam eder; yalnızca ilerleme çubuğu yeni
  // ölçütten sıfırdan başlar.
  //
  // Tavan hâlâ rare: cihaz saati sunucu doğrulamalı değil, kullanıcı ileri
  // alabilir. İzleme tarihinden çok daha zor ama `hesapYili` kadar sağlam değil.
  defineWatchBadge({
    id: "seri_3", section: BOLUM.RITIM, icon: "flame-outline", iconSolid: "flame", rarity: RARITY.common,
    family: "seri", tier: 1, tr: "İlk Ritim", en: "First Rhythm",
    descTr: "2 hafta üst üste işaretleme yap", descEn: "Mark something 2 weeks in a row",
    target: 2, getProgress: (s) => say(s, "rekorHaftaSerisi"),
  }),
  defineWatchBadge({
    id: "seri_7", section: BOLUM.RITIM, icon: "flame-outline", iconSolid: "flame", rarity: RARITY.uncommon,
    family: "seri", tier: 2, tr: "Yerleşen Alışkanlık", en: "Settled Habit",
    descTr: "6 hafta üst üste işaretleme yap", descEn: "Mark something 6 weeks in a row",
    target: 6, getProgress: (s) => say(s, "rekorHaftaSerisi"),
  }),
  defineWatchBadge({
    id: "seri_21", section: BOLUM.RITIM, icon: "flame-outline", iconSolid: "flame", rarity: RARITY.rare,
    family: "seri", tier: 3, tr: "Dört Ay Kesintisiz", en: "Four Months Straight",
    descTr: "16 hafta üst üste işaretleme yap", descEn: "Mark something 16 weeks in a row",
    target: 16, getProgress: (s) => say(s, "rekorHaftaSerisi"),
  }),
  defineWatchBadge({
    id: "seri_30", section: BOLUM.RITIM, icon: "flame-outline", iconSolid: "flame", rarity: RARITY.rare,
    family: "seri", tier: 4, tr: "Yedi Ay Kesintisiz", en: "Seven Months Straight",
    descTr: "30 hafta üst üste işaretleme yap", descEn: "Mark something 30 weeks in a row",
    target: 30, getProgress: (s) => say(s, "rekorHaftaSerisi"),
  }),
  defineWatchBadge({
    id: "seri_60", section: BOLUM.RITIM, icon: "bonfire-outline", iconSolid: "bonfire", rarity: RARITY.rare,
    family: "seri", tier: 5, tr: "Bir Yıl Kesintisiz", en: "A Full Year",
    descTr: "52 hafta üst üste işaretleme yap", descEn: "Mark something 52 weeks in a row",
    target: 52, getProgress: (s) => say(s, "rekorHaftaSerisi"),
  }),
  defineWatchBadge({
    id: "gun_25", section: BOLUM.RITIM, icon: "today-outline", iconSolid: "today", rarity: RARITY.common,
    family: "gun", tier: 1, tr: "Yirmi Beş Gün", en: "Twenty-Five Days",
    descTr: "25 farklı günde izleme işaretle", descEn: "Log a watch on 25 separate days",
    target: 25, getProgress: (s) => say(s, "gunSayisi"),
  }),
  defineWatchBadge({
    id: "gun_50", section: BOLUM.RITIM, icon: "today-outline", iconSolid: "today", rarity: RARITY.uncommon,
    family: "gun", tier: 2, tr: "Elli Gün Kayıt", en: "Fifty Days Logged",
    descTr: "50 farklı günde izleme işaretle", descEn: "Log a watch on 50 separate days",
    target: 50, getProgress: (s) => say(s, "gunSayisi"),
  }),
  defineWatchBadge({
    id: "gun_100", section: BOLUM.RITIM, icon: "today-outline", iconSolid: "today", rarity: RARITY.uncommon,
    family: "gun", tier: 3, tr: "Yüz Gün Kayıt", en: "Hundred Days Logged",
    descTr: "100 farklı günde izleme işaretle", descEn: "Log a watch on 100 separate days",
    target: 100, getProgress: (s) => say(s, "gunSayisi"),
  }),
  defineWatchBadge({
    id: "gun_200", section: BOLUM.RITIM, icon: "calendar-outline", iconSolid: "calendar", rarity: RARITY.rare,
    family: "gun", tier: 4, tr: "İki Yüz Gün Kayıt", en: "Two Hundred Days Logged",
    descTr: "200 farklı günde izleme işaretle", descEn: "Log a watch on 200 separate days",
    target: 200, getProgress: (s) => say(s, "gunSayisi"),
  }),
  // ZİRVE 500, AİLE 5 KADEME (kullanıcı isteği). Merdiven 25-50-100-200-500:
  // dördü ikiye katlanır, son adım 2,5× — zirve sıçraması yine en büyük.
  //
  // `gun_400` KALDIRILDI: 5 kademeye sığmak için bir eşik gitmeliydi ve 400,
  // 500'e en yakın olduğu için merdiveni en az bozanıydı (25→50→100→200→400→500
  // dizisinde son iki adım birbirine çok yakındı, biri zaten gereksizdi).
  // Kaldırılan id `earned`de kalır, kimse çökmez (bkz. tur_15 notu).
  // Tarih türevi → rare tavanında kalır (2. kural).
  defineWatchBadge({
    id: "gun_500", section: BOLUM.RITIM, icon: "calendar-outline", iconSolid: "calendar", rarity: RARITY.rare,
    family: "gun", tier: 5, tr: "Beş Yüz Gün", en: "Five Hundred Days",
    descTr: "500 farklı günde izleme işaretle", descEn: "Log a watch on 500 separate days",
    target: 500, getProgress: (s) => say(s, "gunSayisi"),
  }),
  // AY AİLESİ — bir TAKVİM YILI içinde kaç farklı ayda izleme yapıldığı
  // (`enCokAyliYil`). Kademeli hâle getirildi (kullanıcı isteği): tek başına
  // duran 12 aylık hedef, yılın ortasında bırakan kullanıcıya hiçbir şey
  // vermiyordu; 3/6/9 ara kademeleri yıl boyunca ilerleme hissi taşır.
  // ZİRVE eski `ay_12` id'siyle AYNI kalır — kazanılmış rozet kaymaz.
  defineWatchBadge({
    id: "ay_3", section: BOLUM.RITIM, icon: "calendar-number-outline", iconSolid: "calendar-number", rarity: RARITY.common,
    family: "ay", tier: 1, tr: "Çeyrek Takvim", en: "Quarter Calendar",
    descTr: "Bir yılın 3 ayında izleme yap", descEn: "Watch in 3 months of one year",
    target: 3, getProgress: (s) => say(s, "enCokAyliYil"),
  }),
  defineWatchBadge({
    id: "ay_6", section: BOLUM.RITIM, icon: "calendar-number-outline", iconSolid: "calendar-number", rarity: RARITY.common,
    family: "ay", tier: 2, tr: "Yarım Takvim", en: "Half Calendar",
    descTr: "Bir yılın 6 ayında izleme yap", descEn: "Watch in 6 months of one year",
    target: 6, getProgress: (s) => say(s, "enCokAyliYil"),
  }),
  defineWatchBadge({
    id: "ay_9", section: BOLUM.RITIM, icon: "calendar-number-outline", iconSolid: "calendar-number", rarity: RARITY.uncommon,
    family: "ay", tier: 3, tr: "Dokuz Ay", en: "Nine Months",
    descTr: "Bir yılın 9 ayında izleme yap", descEn: "Watch in 9 months of one year",
    target: 9, getProgress: (s) => say(s, "enCokAyliYil"),
  }),
  defineWatchBadge({
    id: "ay_12", section: BOLUM.RITIM, icon: "calendar-number-outline", iconSolid: "calendar-number", rarity: RARITY.uncommon,
    family: "ay", tier: 4, tr: "Takvim Doldu", en: "Full Calendar",
    descTr: "Bir yılın 12 ayında da izleme yap", descEn: "Watch in all 12 months of a year",
    target: 12, getProgress: (s) => say(s, "enCokAyliYil"),
  }),
  // MARATON AİLESİ — aynı GÜNDE işaretlenen film adedi (`maxGunFilm`).
  // 3 → 5 → 8: üçü de tek bir günün içinde olur, yani merdiven "daha çok izle"
  // değil "daha uzun otur" der. 8 film ≈ 15 saat; üstüne kademe konmadı çünkü
  // bir günde daha fazlası izleme değil işaretleme davranışı olurdu.
  // Tarih türevi → rare tavanı.
  defineWatchBadge({
    id: "maraton_3film", section: BOLUM.RITIM, icon: "pizza-outline", iconSolid: "pizza", rarity: RARITY.uncommon,
    family: "maraton", tier: 1, tr: "Maraton", en: "Marathon",
    descTr: "Aynı gün 3 film işaretle", descEn: "Mark 3 films on the same day",
    target: 3, getProgress: (s) => say(s, "maxGunFilm"),
  }),
  defineWatchBadge({
    id: "maraton_5film", section: BOLUM.RITIM, icon: "pizza-outline", iconSolid: "pizza", rarity: RARITY.uncommon,
    family: "maraton", tier: 2, tr: "Uzun Maraton", en: "Long Marathon",
    descTr: "Aynı gün 5 film işaretle", descEn: "Mark 5 films on the same day",
    target: 5, getProgress: (s) => say(s, "maxGunFilm"),
  }),
  defineWatchBadge({
    id: "maraton_8film", section: BOLUM.RITIM, icon: "bonfire-outline", iconSolid: "bonfire", rarity: RARITY.rare,
    family: "maraton", tier: 3, tr: "Maraton Ustası", en: "Marathon Master",
    descTr: "Aynı gün 8 film işaretle", descEn: "Mark 8 films on the same day",
    target: 8, getProgress: (s) => say(s, "maxGunFilm"),
  }),
  // TEK OTURUŞ AİLESİ — aynı SEZONdan aynı güne işaretlenen bölüm adedi
  // (`tekOturusta`). Kademeler gerçek sezon uzunluklarına oturur: 8 (kısa
  // streaming sezonu) → 13 (yarım network sezonu) → 22 (tam network sezonu).
  // Yani zirve "bir sezonu tek günde bitirdim" demektir. Tarih türevi → rare.
  defineWatchBadge({
    id: "tek_oturusta", section: BOLUM.RITIM, icon: "flash-outline", iconSolid: "flash", rarity: RARITY.common,
    family: "tekOturus", tier: 1, tr: "Tek Oturuşta", en: "One Sitting",
    descTr: "Bir sezonun 8 bölümünü aynı güne işaretle", descEn: "Mark 8 episodes of one season on one day",
    target: 8, getProgress: (s) => say(s, "tekOturusta"),
  }),
  defineWatchBadge({
    id: "tek_oturusta_13", section: BOLUM.RITIM, icon: "flash-outline", iconSolid: "flash", rarity: RARITY.uncommon,
    family: "tekOturus", tier: 2, tr: "Sezon Tek Oturuşta", en: "Season in One Sitting",
    descTr: "Bir sezonun 13 bölümünü aynı güne işaretle", descEn: "Mark 13 episodes of one season on one day",
    target: 13, getProgress: (s) => say(s, "tekOturusta"),
  }),
  defineWatchBadge({
    id: "tek_oturusta_22", section: BOLUM.RITIM, icon: "infinite-outline", iconSolid: "infinite", rarity: RARITY.rare,
    family: "tekOturus", tier: 3, tr: "Tam Sezon", en: "Full Season",
    descTr: "Bir sezonun 22 bölümünü aynı güne işaretle", descEn: "Mark 22 episodes of one season on one day",
    target: 22, getProgress: (s) => say(s, "tekOturusta"),
  }),
  defineWatchBadge({
    id: "sadik_izleyici", section: BOLUM.RITIM, icon: "heart-outline", iconSolid: "heart", rarity: RARITY.uncommon,
    tr: "Sadık İzleyici", en: "Loyal Viewer",
    descTr: "Aynı diziyi 30 farklı günde izle", descEn: "Watch one series on 30 separate days",
    target: 30, getProgress: (s) => say(s, "sadikDiziGun"),
  }),

  // ── Türler ────────────────────────────────────────────────────────────────
  defineWatchBadge({
    id: "tur_3", section: BOLUM.TUR, icon: "compass-outline", iconSolid: "compass", rarity: RARITY.common,
    family: "tur", tier: 1, tr: "Tür Denemesi", en: "Genre Sampler",
    descTr: "3 farklı türde içerik izle", descEn: "Watch across 3 different genres",
    target: 3, getProgress: (s) => say(s, "turSayisi"),
  }),
  defineWatchBadge({
    id: "tur_6", section: BOLUM.TUR, icon: "compass-outline", iconSolid: "compass", rarity: RARITY.common,
    family: "tur", tier: 2, tr: "Tür Gezgini", en: "Genre Traveler",
    descTr: "6 farklı türde içerik izle", descEn: "Watch across 6 different genres",
    target: 6, getProgress: (s) => say(s, "turSayisi"),
  }),
  defineWatchBadge({
    id: "tur_9", section: BOLUM.TUR, icon: "compass-outline", iconSolid: "compass", rarity: RARITY.uncommon,
    family: "tur", tier: 3, tr: "Tür Kaşifi", en: "Genre Explorer",
    descTr: "9 farklı türde içerik izle", descEn: "Watch across 9 different genres",
    target: 9, getProgress: (s) => say(s, "turSayisi"),
  }),
  defineWatchBadge({
    id: "tur_12", section: BOLUM.TUR, icon: "compass-outline", iconSolid: "compass", rarity: RARITY.uncommon,
    family: "tur", tier: 4, tr: "Tür Meraklısı", en: "Genre Enthusiast",
    descTr: "12 farklı türde içerik izle", descEn: "Watch across 12 different genres",
    target: 12, getProgress: (s) => say(s, "turSayisi"),
  }),
  // ZİRVE 20, AİLE 5 KADEME (kullanıcı isteği). Merdiven 3-6-9-12-20: ilk dört
  // adım 3'er, son adım 8 — zirve sıçramasının en büyük olması katalogun genel
  // deseni (film ailesi de 5×·3×·3,3×·4× ile ilerler).
  //
  // `tur_15` KALDIRILDI. 5 kademeye sığmak için bir eşiğin gitmesi gerekiyordu
  // ve 15 en az kişiyi etkileyen seçimdi: tur_3 (common) neredeyse herkeste
  // açıktır, 15 tür ise rare. Kaldırılan id `earned` kümesinde kalır — defter
  // `known`ı yalnızca BİRLEŞTİRİR (watchLedgerCore), yani ne çökme ne kutlama
  // seli olur; tek etkisi 15+ türü olan kullanıcının aile kartının 5/5 yerine
  // 4/5 görünüp yeni zirve olarak 20'yi hedeflemesidir.
  //
  // 20 SAYAÇ KOVASININ TAMAMI DEMEK DEĞİL, ama ona çok yakın: `turSayaci` en
  // fazla 21 anahtar tutar (20 kanonik id + tanınmayan adların düştüğü tek
  // "other" kovası), yani 20'ye ulaşmak pratikte kanonik türlerin neredeyse
  // hepsini gerektirir. Batı, TV filmi, realite gibi kenar türler tek tek
  // aranmadan tamamlanmaz — "Bütün Raflar" adı bu yüzden burada durur.
  //
  // Tarih türevi olmadığı için (tür sayısı izleme tarihinden değil içerikten
  // gelir) rare tavanına takılmaz; epic film_500 ile aynı ligde.
  defineWatchBadge({
    id: "tur_20", section: BOLUM.TUR, icon: "planet-outline", iconSolid: "planet", rarity: RARITY.epic,
    family: "tur", tier: 5, tr: "Bütün Raflar", en: "Every Shelf",
    descTr: "20 farklı türde içerik izle", descEn: "Watch across 20 different genres",
    target: 20, getProgress: (s) => say(s, "turSayisi"),
  }),
  defineWatchBadge({
    id: "korku_25", section: BOLUM.TUR, icon: "skull-outline", iconSolid: "skull", rarity: RARITY.uncommon,
    tr: "Karanlık Salon", en: "Dark Theater",
    descTr: "Korku türünde 25 içerik izle", descEn: "Watch 25 horror titles",
    target: 25, getProgress: (s) => turSayisi(s, GENRE.HORROR),
  }),
  defineWatchBadge({
    id: "animasyon_40", section: BOLUM.TUR, icon: "happy-outline", iconSolid: "happy", rarity: RARITY.uncommon,
    tr: "Çizgi Kuşağı", en: "Animation Block",
    descTr: "Animasyon türünde 40 içerik izle", descEn: "Watch 40 animated titles",
    target: 40, getProgress: (s) => turSayisi(s, GENRE.ANIMATION),
  }),
  defineWatchBadge({
    id: "belgesel_20", section: BOLUM.TUR, icon: "school-outline", iconSolid: "school", rarity: RARITY.uncommon,
    tr: "Gerçek Payı", en: "Based on Truth",
    descTr: "Belgesel türünde 20 içerik izle", descEn: "Watch 20 documentaries",
    target: 20, getProgress: (s) => turSayisi(s, GENRE.DOCUMENTARY),
  }),
  defineWatchBadge({
    id: "komedi_75", section: BOLUM.TUR, icon: "cafe-outline", iconSolid: "cafe", rarity: RARITY.rare,
    tr: "Gülme Krizi", en: "Laughing Fit",
    descTr: "Komedi türünde 75 içerik izle", descEn: "Watch 75 comedies",
    target: 75, getProgress: (s) => turSayisi(s, GENRE.COMEDY),
  }),

  // ── Mevsimsel ─────────────────────────────────────────────────────────────
  defineWatchBadge({
    id: "cadilar_gecesi", section: BOLUM.MEVSIM, icon: "moon-outline", iconSolid: "moon", rarity: RARITY.uncommon,
    tr: "Kabuslar Gecesi", en: "Night of Nightmares",
    descTr: "31 Ekim'de bir korku içeriği işaretle", descEn: "Mark a horror title on October 31",
    target: 1, getProgress: (s) => say(s, "cadilar"),
  }),
  defineWatchBadge({
    id: "yil_devrilirken", section: BOLUM.MEVSIM, icon: "gift-outline", iconSolid: "gift", rarity: RARITY.uncommon,
    tr: "Yıl Devrilirken", en: "Turn of the Year",
    descTr: "31 Aralık ya da 1 Ocak'ta izleme yap", descEn: "Watch on December 31 or January 1",
    target: 1, getProgress: (s) => say(s, "yilDevri"),
  }),
  defineWatchBadge({
    id: "kirmizi_perde", section: BOLUM.MEVSIM, icon: "rose-outline", iconSolid: "rose", rarity: RARITY.uncommon,
    tr: "Kırmızı Perde", en: "Red Curtain",
    descTr: "14 Şubat'ta bir romantik içerik işaretle", descEn: "Mark a romance title on February 14",
    target: 1, getProgress: (s) => say(s, "sevgililer"),
  }),
  // Mevsimsel hedefler GÜN sayar, bölüm değil (utils/watchScoring.js).
  // markShow tüm bölümlere tek tarih yazdığı için bölüm saymak bu rozetleri
  // tek dokunuşluk yapıyordu; metinler de ölçtükleri şeyi söylüyor artık.
  defineWatchBadge({
    id: "yaz_sezonu", section: BOLUM.MEVSIM, icon: "sunny-outline", iconSolid: "sunny", rarity: RARITY.rare,
    tr: "Yaz Sezonu", en: "Summer Season",
    descTr: "Haziran-Ağustos arasında 40 farklı günde izle", descEn: "Watch on 40 separate days between June and August",
    target: 40, getProgress: (s) => say(s, "yazGun"),
  }),
  defineWatchBadge({
    id: "kis_kampi", section: BOLUM.MEVSIM, icon: "snow-outline", iconSolid: "snow", rarity: RARITY.uncommon,
    tr: "Kış Kampı", en: "Winter Camp",
    descTr: "Aralık-Şubat arasında 20 farklı günde izle", descEn: "Watch on 20 separate days between December and February",
    target: 20, getProgress: (s) => say(s, "kisGun"),
  }),

  // ── Kıdem ─────────────────────────────────────────────────────────────────
  // Bu ailenin ölçütü `hesapYili` — hesabın kaç tam yılını doldurduğu.
  //
  // İKİ ÖZELLİĞİ VAR ve ikisi de bu katalogda başka hiçbir rozette yok:
  //
  // 1. SAHTELENEMEZ. Değer Firebase Auth'un `metadata.creationTime`'ından gelir;
  //    onu SUNUCU yazar, istemci dokunamaz. Katalogun 2. kuralı ("tarih türevi
  //    rozet tavanı = rare") tam olarak uydurulabilirlik yüzünden var — kullanıcı
  //    izleme tarihini geçmişe onlarca yıl atabiliyor. Kıdem o kuralın DIŞINDADIR
  //    ve bu yüzden `yil_5` epic olabilir.
  //
  // 2. AKTİVİTE GEREKTİRMEZ. Rozet merdiveninin asıl sorunu, üst kademeler arası
  //    çöl: film ailesinde 150'den 500'e 350 film var. Kıdem ailesi o çölün
  //    ortasında bile işlemeye devam eden tek ailedir — kullanıcı ne yaparsa
  //    yapsın takvim ilerler. Ödülü "çok izlemek" değil "burada olmak"tır.
  //
  // Yeni kullanıcıya ilk 12 ay boyunca hiçbir şey vermemesi kasıtlıdır: o dönemde
  // zaten common/uncommon rozetler bol. Bu aile VETERAN kullanıcı için tasarlandı.
  defineWatchBadge({
    id: "yil_1", section: BOLUM.KIDEM, icon: "medal-outline", iconSolid: "medal", rarity: RARITY.uncommon,
    family: "yil", tier: 1, tr: "İlk Yıl", en: "First Year",
    descTr: "Seelogd'da 1 yılını doldur", descEn: "Complete 1 year on Seelogd",
    target: 1, getProgress: (s) => say(s, "hesapYili"),
  }),
  defineWatchBadge({
    id: "yil_2", section: BOLUM.KIDEM, icon: "medal-outline", iconSolid: "medal", rarity: RARITY.rare,
    family: "yil", tier: 2, tr: "İkinci Sezon", en: "Second Season",
    descTr: "Seelogd'da 2 yılını doldur", descEn: "Complete 2 years on Seelogd",
    target: 2, getProgress: (s) => say(s, "hesapYili"),
  }),
  defineWatchBadge({
    id: "yil_3", section: BOLUM.KIDEM, icon: "medal-outline", iconSolid: "medal", rarity: RARITY.rare,
    family: "yil", tier: 3, tr: "Eski Tüfek", en: "Old Timer",
    descTr: "Seelogd'da 3 yılını doldur", descEn: "Complete 3 years on Seelogd",
    target: 3, getProgress: (s) => say(s, "hesapYili"),
  }),
  defineWatchBadge({
    id: "yil_5", section: BOLUM.KIDEM, icon: "medal-outline", iconSolid: "medal", rarity: RARITY.epic,
    family: "yil", tier: 4, tr: "Demirbaş", en: "Fixture",
    descTr: "Seelogd'da 5 yılını doldur", descEn: "Complete 5 years on Seelogd",
    target: 5, getProgress: (s) => say(s, "hesapYili"),
  }),
  defineWatchBadge({
    id: "yil_10", section: BOLUM.KIDEM, icon: "medal-outline", iconSolid: "medal", rarity: RARITY.epic,
    family: "yil", tier: 5, tr: "Onuncu Yıl", en: "Tenth Year",
    descTr: "Seelogd'da 10 yılını doldur", descEn: "Complete 10 years on Seelogd",
    target: 10, getProgress: (s) => say(s, "hesapYili"),
  }),

  // ── Perde ─────────────────────────────────────────────────────────────────
  defineWatchBadge({
    id: "perde_4", section: BOLUM.PERDE, icon: "trending-up-outline", iconSolid: "trending-up", rarity: RARITY.common,
    family: "perde", tier: 1, tr: "Perde 4", en: "Act 4",
    descTr: "Perde 4'e ulaş", descEn: "Reach Act 4",
    target: 4, getProgress: (s) => say(s, "perde"),
  }),
  defineWatchBadge({
    id: "perde_8", section: BOLUM.PERDE, icon: "trending-up-outline", iconSolid: "trending-up", rarity: RARITY.uncommon,
    family: "perde", tier: 2, tr: "Perde 8", en: "Act 8",
    descTr: "Perde 8'e ulaş", descEn: "Reach Act 8",
    target: 8, getProgress: (s) => say(s, "perde"),
  }),
  // perde_14 epic'ten rare'e indi: aile 5 kademeye çıkınca arasına perde_17
  // girdi ve merdivenin monoton kalması gerekiyor (c → u → r → e → l).
  // Nadirlik kozmetiktir, defteri etkilemez — kazanılmış rozet kaymaz.
  defineWatchBadge({
    id: "perde_14", section: BOLUM.PERDE, icon: "trending-up-outline", iconSolid: "trending-up", rarity: RARITY.rare,
    family: "perde", tier: 3, tr: "Perde 14", en: "Act 14",
    descTr: "Perde 14'e ulaş", descEn: "Reach Act 14",
    target: 14, getProgress: (s) => say(s, "perde"),
  }),
  defineWatchBadge({
    id: "perde_17", section: BOLUM.PERDE, icon: "trending-up-outline", iconSolid: "trending-up", rarity: RARITY.epic,
    family: "perde", tier: 4, tr: "Perde 17", en: "Act 17",
    descTr: "Perde 17'ye ulaş", descEn: "Reach Act 17",
    target: 17, getProgress: (s) => say(s, "perde"),
  }),
  defineWatchBadge({
    id: "perde_20", section: BOLUM.PERDE, icon: "trophy-outline", iconSolid: "trophy", rarity: RARITY.legendary,
    family: "perde", tier: 5, tr: "Beyazperde Efsanesi", en: "Silver Screen Legend",
    descTr: "Perde 20'ye ulaş", descEn: "Reach Act 20",
    target: 20, getProgress: (s) => say(s, "perde"),
  }),
  defineWatchBadge({
    id: "cift_kariyer", section: BOLUM.PERDE, icon: "sparkles-outline", iconSolid: "sparkles", rarity: RARITY.rare,
    tr: "Çift Kariyer", en: "Double Career",
    descTr: "Perde 10 ve oyun Seviye 10'a birlikte ulaş", descEn: "Reach Act 10 and game Level 10 together",
    // Oyun XP'si ile izleme puanı arasındaki TEK köprü. Para birimleri arasında
    // dönüşüm yoktur; bu rozet yalnızca ikisinin birlikte yapıldığını işaretler.
    target: 1, getProgress: (s) => (say(s, "perde") >= 10 && say(s, "oyunSeviye") >= 10 ? 1 : 0),
  }),

  // ── Gizli ─────────────────────────────────────────────────────────────────
  defineWatchBadge({
    id: "gizli_cift_perde", section: BOLUM.GIZLI, hidden: true,
    icon: "aperture-outline", iconSolid: "aperture", rarity: RARITY.rare,
    tr: "Çift Perde", en: "Double Bill",
    descTr: "Aynı gün 1 film ve 5 bölüm işaretle", descEn: "Mark 1 film and 5 episodes on the same day",
    target: 1, getProgress: (s) => say(s, "ciftPerde"),
  }),
  defineWatchBadge({
    id: "gizli_vitrin", section: BOLUM.GIZLI, hidden: true,
    icon: "star-outline", iconSolid: "star", rarity: RARITY.rare,
    tr: "Vitrin", en: "Showcase",
    descTr: "TMDB puanı 9 üstü 25 bölüm izle", descEn: "Watch 25 episodes rated above 9 on TMDB",
    target: 25, getProgress: (s) => say(s, "yuksekPuanliBolum"),
  }),
  defineWatchBadge({
    id: "gizli_alfabe", section: BOLUM.GIZLI, hidden: true,
    icon: "library-outline", iconSolid: "library", rarity: RARITY.rare,
    tr: "A'dan Z'ye", en: "A to Z",
    descTr: "18 farklı harfle başlayan içerik izle", descEn: "Watch titles starting with 18 different letters",
    target: 18, getProgress: (s) => say(s, "harfSayisi"),
  }),
  defineWatchBadge({
    id: "gizli_geri_donus", section: BOLUM.GIZLI, hidden: true,
    icon: "refresh-outline", iconSolid: "refresh", rarity: RARITY.uncommon,
    tr: "Geri Dönüş", en: "The Return",
    descTr: "60 gün ara verdikten sonra tekrar işaretle", descEn: "Come back after a 60-day break",
    target: 60, getProgress: (s) => say(s, "enUzunAra"),
  }),

  // ── Gizli: "seni tanıyoruz" rozetleri ─────────────────────────────────────
  //
  // Bu beşinin ortak noktası: hiçbiri TEK bir sayacı büyütmekle alınmaz. Her
  // biri İKİ ayrı davranışın kesişimini ya da bir alışkanlığın uzun vadeli
  // izini ödüllendirir — yani "çok izledin" değil, "SEN böyle izliyorsun" der.
  // Gizli olmaları kasıtlı: hedefi görüp peşinden koşulan bir rozet artık
  // kişisel bir keşif değil, bir görev listesi maddesidir.
  //
  // Hepsi mevcut `stats` alanlarından okur — tek geçiş performans sözleşmesi
  // korunur, watchScoring'e yeni alan eklenmedi.
  defineWatchBadge({
    id: "gizli_cift_dunya", section: BOLUM.GIZLI, hidden: true,
    icon: "swap-horizontal-outline", iconSolid: "swap-horizontal", rarity: RARITY.rare,
    tr: "Çift Dünya", en: "Both Worlds",
    // Katalogdaki her zirve tek bir izleme biçimini ödüllendirir: film_2000'i
    // sadece-dizi izleyen, bolum_10000'i sadece-film izleyen asla alamaz. Bu
    // rozet tam tersini yapar — İKİSİNİ BİRDEN yapanı işaretler.
    descTr: "250 film ve 1000 bölümü birlikte tamamla",
    descEn: "Reach 250 films and 1000 episodes together",
    target: 1,
    getProgress: (s) => (say(s, "filmSayisi") >= 250 && say(s, "bolumSayisi") >= 1000 ? 1 : 0),
  }),
  defineWatchBadge({
    id: "gizli_uc_gece", section: BOLUM.GIZLI, hidden: true,
    icon: "sparkles-outline", iconSolid: "sparkles", rarity: RARITY.rare,
    tr: "Üç Özel Gece", en: "Three Special Nights",
    // Üç mevsimsel rozetin META'sı: 31 Ekim + yılbaşı + 14 Şubat. Üçü aynı yıla
    // sığmaz zorunlu değil ama en az bir tam yıl boyunca uygulamada olmayı
    // gerektirir — takvim uydurulabilir, sabır uydurulamaz.
    descTr: "Cadılar, yılbaşı ve Sevgililer gecelerinin üçünü de yakala",
    descEn: "Catch Halloween, New Year and Valentine's nights",
    target: 3,
    getProgress: (s) =>
      Math.min(1, say(s, "cadilar")) +
      Math.min(1, say(s, "yilDevri")) +
      Math.min(1, say(s, "sevgililer")),
  }),
  defineWatchBadge({
    id: "gizli_dort_mevsim", section: BOLUM.GIZLI, hidden: true,
    icon: "leaf-outline", iconSolid: "leaf", rarity: RARITY.uncommon,
    tr: "Dört Mevsim", en: "Four Seasons",
    // Yaz ve kış rozetlerinin ikisini birden ister ama eşikleri düşük tutar:
    // amaç zirve değil, "yılın her mevsiminde buradaydın" duygusu.
    descTr: "Hem yazın hem kışın 10'ar günde izleme yap",
    descEn: "Watch on 10 summer days and 10 winter days",
    target: 1,
    getProgress: (s) => (say(s, "yazGun") >= 10 && say(s, "kisGun") >= 10 ? 1 : 0),
  }),
  defineWatchBadge({
    id: "gizli_alfabe_tam", section: BOLUM.GIZLI, hidden: true,
    icon: "text-outline", iconSolid: "text", rarity: RARITY.rare,
    tr: "Alfabe Tamam", en: "Full Alphabet",
    // gizli_alfabe'nin (18 harf) üstü. Son harfler tesadüfen gelmez: X, Q, W
    // ya da Ö/Ü ile başlayan bir yapım BİLEREK aranır. Rozetin tamamı bu
    // kasıtlı arama anını ödüllendirir.
    descTr: "24 farklı harfle başlayan içerik izle",
    descEn: "Watch titles starting with 24 different letters",
    target: 24, getProgress: (s) => say(s, "harfSayisi"),
  }),
  defineWatchBadge({
    id: "gizli_yol_arkadasi", section: BOLUM.GIZLI, hidden: true,
    icon: "walk-outline", iconSolid: "walk", rarity: RARITY.uncommon,
    tr: "Yol Arkadaşı", en: "Companion",
    // Kıdem (sunucu tarihli) + gerçek kullanım (gün sayısı) birlikte: sadece
    // hesabı açık tutan da, bir hafta yoğun kullanıp bırakan da alamaz.
    // Tarih türevi bileşeni olduğu için rare tavanının altında kalır.
    descTr: "2 yılı doldur ve 200 farklı günde işaretle",
    descEn: "Complete 2 years and log on 200 separate days",
    target: 1,
    getProgress: (s) => (say(s, "hesapYili") >= 2 && say(s, "gunSayisi") >= 200 ? 1 : 0),
  }),
];

export const WATCH_BADGE_BY_ID = Object.freeze(
  WATCH_BADGES.reduce((acc, b) => { acc[b.id] = b; return acc; }, {}),
);

// Defterin KATALOG GENİŞLEME KORUMASI için gerekli (utils/watchLedgerCore.js).
// Açık olanlar değil, katalogun TAMAMI: defter bir id'yi "biliyor" olmalı ki
// kullanıcı onu ilk kez hak ettiğinde kutlaması normal biçimde oynasın. Bu liste
// olmadan, sonradan eklenen her rozet mevcut kullanıcıda kutlama seli üretir.
export const WATCH_BADGE_IDS = Object.freeze(WATCH_BADGES.map((b) => b.id));

export const badgeAd = (b, lang) => (lang === "tr" ? b?.tr : b?.en) || b?.en || "";
export const badgeAciklama = (b, lang) => (lang === "tr" ? b?.descTr : b?.descEn) || b?.descEn || "";

/**
 * Tüm rozetleri ilerlemesiyle birlikte döndürür.
 * @param {object} stats  computeWatchScore().stats + { perde, oyunSeviye }
 * @param {Set<string>|string[]} kazanilmis  ledger'daki monoton "earned" kümesi
 */
export function evaluateWatchBadges(stats, kazanilmis) {
  const set = kazanilmis instanceof Set ? kazanilmis : new Set(kazanilmis || []);
  return WATCH_BADGES.map((b) => {
    const ham = Number(b.getProgress(stats)) || 0;
    const ilerleme = Math.max(0, Math.min(ham, b.target));
    // Ledger üyeliği HER ZAMAN kazandırır: kullanıcı yanlışlıkla bir kaydı
    // silse bile kazanılmış rozet geri alınmaz (docs §6.2).
    const acik = set.has(b.id) || ilerleme >= b.target;
    // `ham` KIRPILMAMIŞ değerdir. `ilerleme` hedefte durur (çubuk 100'ü aşmasın),
    // ama prestij tam da hedefin ÖTESİNİ sayar — kırpılmış değerden üretilemez.
    return { ...b, ham, ilerleme, oran: b.target > 0 ? ilerleme / b.target : 0, acik };
  });
}

// ── PRESTİJ (aile zirvesinden sonrası) ──────────────────────────────────────
//
// Zirveye ulaşan kullanıcının önünde hiçbir şey kalmıyordu: film_2000'i alan
// için katalog bitiyor. Perde tarafında bu sorun MAKARA ile çözülmüş durumda
// (zirveden sonra dönen sayaç); rozet tarafında karşılığı yoktu.
//
// YENİ ROZET DEĞİL, SAYAÇ: prestij katalogu büyütmez, legendary kotasına
// dokunmaz, ekrana kart eklemez. Yalnızca tamamlanmış aile kartının üstünde
// "★2" olarak görünür. Böylece ağır kullanıcı ilerlemeye devam eder, hafif
// kullanıcının ekranı hiç değişmez.
//
// YALNIZCA SINIRSIZ ÖLÇÜTLER: tür (en fazla 21 kova), ay (12), perde (20), yıl,
// seri ve tek-gün aileleri doğal bir tavana çarpar — orada prestij "sonsuza dek
// 0" gösteren ölü bir alan olurdu. Adımlar zirvenin ~%20-50'si: yeni bir
// merdiven kurmayacak kadar büyük, ulaşılamayacak kadar da değil.
export const AILE_PRESTIJ = Object.freeze({
  film: 500,
  bolum: 2500,
  final: 25,
  sure: 131400,      // +3 ay ekran süresi (dakika)
  gun: 100,
  uzunMetraj: 50,
});

/** Aile tamamlandıktan sonra kaç adım daha gidildi? (tamamlanmamışsa 0) */
export const prestijHesapla = (family, ham, zirveHedef) => {
  const adim = AILE_PRESTIJ[family];
  if (!adim || !(ham > zirveHedef)) return 0;
  return Math.floor((ham - zirveHedef) / adim);
};

/**
 * Prestij basamaklarını defter id'lerine çevirir: `prestij_film_1`, `_2`…
 * Defterdeki `earned` kümesi monoton olduğu için sayaç KENDİLİĞİNDEN taban
 * kazanır — ayrı bir "prestijFloor" alanı ve şema göçü gerekmez.
 *
 * @param {number} sonraki Kaç basamak İLERİSİ de listeye eklensin (kutlama için:
 *   defter bir id'yi ancak ÖNCEDEN "biliyorsa" kazanıldığında kutlar).
 */
export function prestijIdleri(kartlar, { sonraki = 0 } = {}) {
  const out = [];
  for (const k of kartlar || []) {
    if (!k?.family || !AILE_PRESTIJ[k.family]) continue;
    // Aile TAMAMLANMAMIŞSA prestij yoktur; `sonraki` de yazılmaz. Aksi halde
    // 10 filmi olan kullanıcının defterine "prestij_film_1" bilinen id olarak
    // düşerdi — zararsız ama anlamsız, ve `known` kümesini her ailede bir
    // basamak şişirirdi.
    if (k.sonrakiHedef) continue;
    const n = (Number(k.prestij) || 0) + Math.max(0, sonraki);
    for (let i = 1; i <= n; i++) out.push(`prestij_${k.family}_${i}`);
  }
  return out;
}

/**
 * Kademeli aileleri TEK karta indirir: açık en yüksek kademe gösterilir,
 * ilerleme bir sonraki kademeye göre çizilir. 81 rozet 35 aile/tekil karta iner
 * (ekrana ayrıca mühür ve koleksiyon kartları eklenir — bkz. useWatchProgress).
 * Tamamlanmış ailelerde `prestij` sayacı da burada hesaplanır.
 */
export function gruplaAileler(degerlendirilmis) {
  const aileler = new Map();
  const kartlar = [];
  for (const b of degerlendirilmis) {
    if (!b.family) { kartlar.push({ ...b, aileUyeleri: null }); continue; }
    if (!aileler.has(b.family)) {
      const kart = { family: b.family, aileUyeleri: [] };
      aileler.set(b.family, kart);
      kartlar.push(kart);
    }
    aileler.get(b.family).aileUyeleri.push(b);
  }
  return kartlar.map((k) => {
    if (!k.aileUyeleri) return k;
    const uyeler = [...k.aileUyeleri].sort((a, b) => a.tier - b.tier);
    const acikOlanlar = uyeler.filter((u) => u.acik);
    const enYuksekAcik = acikOlanlar[acikOlanlar.length - 1] || null;
    const sonraki = uyeler.find((u) => !u.acik) || null;

    // KİMLİK = ULAŞILAN kademe (yoksa en düşük kademe). Kartın başlığı, açıklaması
    // ve nadirliği buradan gelir.
    //
    // Önceki sürüm KİMLİĞİ bir sonraki (kilitli) kademeden alıp `acik: true`
    // damgalıyordu: 60 filmi olan kullanıcı "Salon Sakini — 150 film izle"
    // yazan bir kartı YEŞİL TİKLİ ve ilerleme çubuksuz görüyordu. Yani kart,
    // kazanılmamış bir rozeti kazanılmış ilan ediyordu.
    const kimlik = enYuksekAcik || uyeler[0];
    const zirve = uyeler[uyeler.length - 1];
    // Prestij yalnız aile TAMAMLANMIŞSA anlamlı: `sonraki` doluysa kullanıcının
    // önünde zaten bir kademe var, ikinci bir sayaç göstermek gürültü olur.
    const prestij = sonraki ? 0 : prestijHesapla(k.family, zirve?.ham || 0, zirve?.target || 0);
    return {
      ...kimlik,
      aileUyeleri: uyeler,
      aileKademe: acikOlanlar.length,
      aileToplam: uyeler.length,
      prestij,
      prestijAdim: AILE_PRESTIJ[k.family] || 0,
      acik: !!enYuksekAcik,
      // Bir sonraki kademe AYRI bir alanda taşınır; kart ilerleme çubuğunu
      // buradan çizer. Aile tamamlandıysa null.
      sonrakiHedef: sonraki
        ? { id: sonraki.id, tr: sonraki.tr, en: sonraki.en, descTr: sonraki.descTr, descEn: sonraki.descEn,
            // `birim` TAŞINMALI: yoksa aile kartında sıradaki süre kademesinin
            // ilerlemesi "43.200 / 129.600" (dakika) diye çizilir, oysa rozetin
            // kendisi "720 / 2.160 saat" gösteriyor — ikisi çelişirdi.
            target: sonraki.target, ilerleme: sonraki.ilerleme, oran: sonraki.oran, birim: sonraki.birim }
        : null,
    };
  });
}

export default WATCH_BADGES;
