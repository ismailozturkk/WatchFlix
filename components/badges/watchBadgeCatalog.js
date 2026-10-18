// components/badges/watchBadgeCatalog.js
//
// İZLEME rozetleri — 154 adet: 20 kademeli aile (89 üye) + 65 tekil. Kimlik
// rozetlerinden (badgeCatalog.js) ve oyun başarımlarından
// (screens/game/gameRegistry.js) ayrı bir aile, aynı render altyapısını
// (AppBadge) kullanır.
//
// KATALOG SÜRÜMLERİ (`since` alanı, `KATALOG_SURUMU`):
//   v1 — 81 rozet (Kilometre, Ritim, Türler, Mevsimsel, Kıdem, Perde, Gizli).
//   v2 — +60 rozet. İki yeni bölüm (BAŞLANGIÇ: ilk dakikada kazanılan küçükler;
//        BAĞLILIK: tekrar izleme + aynı diziye sadakat), yeni aileler (dizi, sezon,
//        eser, günlük seri, hafta sonu, tekrar), on iki tür uzmanlığı, beş
//        mevsimsel/takvim rozeti, altı gizli rozet, üç Perde ara basamağı.
//   v3 — +13 rozet, tek yeni bölüm: KEŞİF. İZLEME VERİSİNE BAĞLI DEĞİL: uygulamanın
//        diğer özelliklerini (not, yapılacaklar, film/dizi notu, özel liste, favori,
//        izleme listesi, hatırlatıcı, ortak liste, arkadaş, gönderi, dört favori,
//        biyografi, CineMatch) ilk kez kullanınca açılır. Girdileri computeWatchScore'dan
//        değil utils/kesifSignals.js'ten gelir (bkz. oradaki YÜKLENME YARIŞI notu).
//   Genişlemenin amacı "her aşamada elinin altında bir sonraki rozet olsun":
//   v1'de kilometre taşları arasında aylarca ödülsüz çöller vardı (ör. 150→500
//   film, Perde 8→14, yalnız dizi izleyenin tür sütunu). v2 bu çölleri doldurur,
//   yeni kullanıcıya ilk dakikada 3-4 rozet verir ve her izleme tarzına
//   (tekrar izleyen, hafta sonu izleyen, tek türe adanmış…) bir hedef koyar. v3
//   aynı şeyi izleme dışı özellikler için yapar: hiç hatırlatıcı kurmamış kullanıcı,
//   Keşif bölümünde kilitli bir "İlk hatırlatıcı"yı ve nasıl açılacağını görür.
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
// BEŞ KURAL — yeni rozet eklerken bunlara uy:
//
// 0. YENİ ROZET EKLEMEK MEVCUT KULLANICIDA SESSİZDİR. Defter (watchLedgerCore.js)
//    katalogda ilk kez gördüğü bir id'yi, kullanıcı onu zaten hak ediyorsa
//    `earned` VE `seen`e birlikte yazar. Bu koruma olmadan 3 yıllık bir
//    kullanıcıya güncelleme sonrası 15 rozetlik konfeti yağmuru patlıyordu.
//    Koruma `WATCH_BADGE_IDS`e dayanır; o listeyi bozma.
//
// 1. LEGENDARY KOTASI = 3 (`film_2000`, `bolum_10000`, `perde_20`). Dördüncü bir
//    legendary eklemek için mevcut birini düşürmek gerekir; nadirlik enflasyonu
//    rozet sisteminin bilinen ölüm biçimi. (v3 Keşif rozetleri legendary EKLEMEDİ.)
//
//    KOTA 2'DEN 3'E BİLEREK ÇIKARILDI. Eskiden `film_500` legendary'ydi ve
//    ailenin zirvesiydi. Film/bölüm aileleri 5 kademeye çıkınca zirve 2.000 film
//    ve 10.000 bölüme taşındı — yani film_500 artık zirve DEĞİL (epic'e indi) ve
//    yerine gelen iki hedef eskisinden dört kat zor. İkisi kabaca eşit emek
//    istiyor (2.000 × 165 ≈ 330.000 Kare, 10.000 × 37 ≈ 370.000 Kare), bu yüzden
//    birini legendary yapıp diğerini epic bırakmak bir izleme biçimini
//    ödüllendirip diğerini cezalandırmak olurdu. 154 rozette 3 legendary = %1,9
//    (v1'de 81 rozette %3,7 idi); hâlâ nadir ve v2/v3 legendary EKLEMEDİ.
//
// 2. TARİH TÜREVİ ROZET TAVANI = rare. Gün/seri/mevsim rozetleri kullanıcının
//    kendi girdiği izleme tarihinden türer (DatePickerModal geçmişe onlarca yıl
//    açık). Uydurulabilir hiçbir rozet epic ya da legendary olamaz.
//
// 3. RARITY ELLE YAZILIR — resolveRarity(target) KULLANILMAZ. Hedefin büyüklüğü
//    zorluğu ölçmez: 2000 bölüm otomatik legendary olurdu ama 12 farklı türde
//    içerik izlemek çok daha zordur. Dağılım kasıtlı: 35 common · 60 uncommon ·
//    46 rare · 10 epic · 3 legendary — medyan uncommon, yani profil mor bir
//    duvara dönüşmez. (v1: 12 · 31 · 27 · 8 · 3. v2'nin eklediği 60 rozetin
//    13'ü common, 26'sı uncommon, 18'i rare, 3'ü epic; ayrıca `uzun_metraj_100`
//    epic'ten rare'e indi, çünkü aile 5. kademeye uzadı: yeni kitle ağırlıkla
//    yaygın/az bulunur, nadir duvarı büyümüyor. v3'ün 13 Keşif rozetinin 10'u
//    common, 3'ü uncommon — ilk gün bloğu: hiçbiri rare'e çıkmaz.)
//
// 4. KEŞİF ROZETLERİ FREE PLANDA KAZANILABİLİR OLMALI ve hedefleri Free SINIRININ
//    ALTINDA kalmalı. Hepsi "ilk kez" (hedef 1): özel liste Free'de 1 tane, arkadaş 2,
//    not 5 — "5 not yaz" gibi bir kademe Free kullanıcıyı sınıra itip hemen ardından
//    "Not limitin doldu" duvarına çarptırırdı. Oyun/CineSwipe (Free'de kapalı) ve özel
//    tema (Premium) bu yüzden Keşif'e girmedi. Her Keşif rozeti bir `kaynak` taşır
//    (utils/kesifSignals.js KESIF_KAYNAK): kaynak yüklenmeden id deftere "bilinen"
//    yazılmaz, yoksa kaynak gelince eski kullanıcıya kutlama yağar (bkz.
//    `bilinenRozetIdleri`).
//
//    TEK İSTİSNA: KIDEM ailesi tarih tavanına tabi değildir (aşağıdaki uzun
//    gerekçe) — ölçütü sunucunun yazdığı hesap açılış tarihidir.
//
// GÖRSEL: `family` + `tier` alanları kartın SİLUETİNİ de belirler (kare →
// beşgen → altıgen, theme/badgeTokens.js `kademeSekli`). Renk nadirliği, kenar
// sayısı kademeyi kodlar; ikisi bağımsız iki eksendir.
//
// METİNLER İNLİNE: 154 rozet × 2 metin × 3 dil = 924 autoI18n anahtarı yazmak
// yerine tr/en/es + descTr/descEn/descEs burada durur (badgeCatalog.js emsali).
// i18n maliyeti yalnızca ekranın UI dizelerine iner.
//
// PERFORMANS SÖZLEŞMESİ: her getProgress YALNIZCA `stats` okur. Hiçbir rozet
// izleme listesini ayrıca taramaz — 154 rozet × 3.900 kayıt taraması JS
// thread'ini kilitlerdi. Tüm ölçütler computeWatchScore'un tek geçişinden çıkar.
// v2'nin yeni ölçütleri (tekrar, sezon, hafta sonu, takvim olayları, tür derinliği)
// da o geçişe eklendi — rozet başına ayrı tarama YOK, puan formülü DEĞİŞMEDİ.
// v3 Keşif rozetleri `stats.kesif` (küçük sayılar nesnesi) okur; o da hook'ta
// computeWatchScore'dan AYRI üretilir, hiçbir liste taranmaz.

import { copyLanguage, intlLocaleOf } from "../../utils/appLanguages";
import { RARITY } from "@theme/badgeTokens";
import { GENRE } from "@utils/genreCanon";
import { KESIF_KAYNAK } from "@utils/kesifSignals";

// Rozet ekranındaki bölümler.
export const BOLUM = Object.freeze({
  BASLANGIC: "baslangic",
  KESIF: "kesif",
  BAGLILIK: "baglilik",
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
  baslangic: { tr: "Başlangıç", en: "Getting Started", es: "Primeros pasos" },
  kesif: { tr: "Keşif", en: "Discover", es: "Descubre" },
  baglilik: { tr: "Bağlılık", en: "Devotion", es: "Fidelidad" },
  kilometre: { tr: "Kilometre Taşları", en: "Milestones", es: "Hitos" },
  ritim: { tr: "Ritim", en: "Rhythm", es: "Ritmo" },
  tur: { tr: "Türler", en: "Genres", es: "Géneros" },
  mevsim: { tr: "Mevsimsel", en: "Seasonal", es: "De temporada" },
  muhur: { tr: "Dönem Mühürleri", en: "Season Seals", es: "Sellos de temporada" },
  set: { tr: "Koleksiyonlar", en: "Collections", es: "Colecciones" },
  kidem: { tr: "Kıdem", en: "Tenure", es: "Antigüedad" },
  perde: { tr: "Perde", en: "Acts", es: "Actos" },
  gizli: { tr: "Gizli", en: "Hidden", es: "Ocultas" },
});

// Ekrandaki bölüm sırası. Kart listesinin dizilişinden BAĞIMSIZ olmalı: mühür
// ve koleksiyon kartları katalogda değil, çalışma anında üretiliyor ve listeye
// sonda ekleniyor — sıra karttan türeseydi ikisi de ekranın dibinde kalırdı.
// Mühür/koleksiyon ortada durur: yeni kullanıcı önce ulaşılabilir kilometre
// taşlarını görür, "0/6 koleksiyon" ilk izlenim olmaz.
//
// BAŞLANGIÇ EN ÜSTTE: ilk dakikada kazanılabilen, bir iki işaretlemelik rozetler.
// Yeni kullanıcının ekranı "0/…" duvarı değil, hemen dolacak küçük bir ilk
// satırla açılır; deneyimli kullanıcıda bölüm zaten tamamdır ve satırı kısadır.
// BAĞLILIK ritmin hemen arkasında: ritim "ne sıklıkla", bağlılık "aynı şeye ne
// kadar dönüyorsun" sorusunu cevaplar.
// KEŞİF BAŞLANGIÇ'IN HEMEN ARKASINDA: ilk gün bloğu iki küçük satırdan oluşur —
// "izlemeye başla" ve "uygulamanın geri kalanını dene". İkisi de birkaç dokunuşta
// dolar; deneyimli kullanıcıda bölüm zaten tamamdır ve Kilometre'yi yalnız birkaç
// satır aşağı iter. Sona almak isteyen tek satırı buradan taşır.
export const BOLUM_SIRA = Object.freeze([
  BOLUM.BASLANGIC,
  BOLUM.KESIF,
  BOLUM.KILOMETRE,
  BOLUM.RITIM,
  BOLUM.BAGLILIK,
  BOLUM.TUR,
  BOLUM.MEVSIM,
  BOLUM.MUHUR,
  BOLUM.SET,
  BOLUM.KIDEM,
  BOLUM.PERDE,
  BOLUM.GIZLI,
]);

// KATALOG SÜRÜMÜ. Kataloğa rozet eklendiği her güncellemede bir artar; yeni
// rozetler `since: <yeni sürüm>` ile damgalanır. Ekran bunu yalnızca "YENİ"
// etiketi ve "N yeni rozet eklendi" duyurusu için okur — defter/kazanma mantığı
// ona BAKMAZ (yeni rozetin sessiz emilmesi `WATCH_BADGE_IDS`e dayanır, bkz. 0.
// kural). Sürüm 1 = ilk 81 rozet; sürüm 2 = Başlangıç/Bağlılık genişlemesi;
// sürüm 3 = Keşif bölümü (izleme dışı özellikler).
export const KATALOG_SURUMU = 3;
const S2 = 2;
const S3 = 3;

// gameRegistry.defineAchievement ile AYNI sözleşme + beş ek alan:
// `family` (kademe ailesi), `tier` (aile içi sıra), `hidden` (gizli rozet),
// `since` (rozetin eklendiği katalog sürümü; verilmezse 1), `kaynak` (yalnız Keşif
// rozetleri: ilerlemesini okuduğu KESIF_KAYNAK — hazır olmadan `known`a yazılmaz).
const defineWatchBadge = (def) => ({
  ...def,
  since: def.since || 1,
  kaynak: def.kaynak || null,
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
// Keşif sinyali: `stats.kesif` hook'ta (computeWatchScore'dan AYRI) bindirilir;
// kaynak hazır değilse alan yoktur ve 0 okunur.
const kesifSay = (stats, alan) => Number(stats?.kesif?.[alan]) || 0;

// Süre ailesi ham DAKİKA toplar (etkinDakikaToplam) ve VARSAYILAN OLARAK da
// dakika gösterir (kullanıcı isteği). Tek bir sabit birim seçmek zorunda
// değiliz: rozet detay modalindeki çevirici aynı ham değeri dk/sa/gün olarak
// döndürür. Puanlama ve eşik karşılaştırması her hâlükârda dakikayla yapılır;
// burası yalnızca görüntü katmanıdır (WatchBadgeCard / Modal / WatchLevelCard).
const DAKIKA = { id: "dk", bol: 1, ekTr: "dk", ekEn: "min", ekEs: "min" };
const SAAT = { id: "sa", bol: 60, ekTr: "sa", ekEn: "h", ekEs: "h" };
const GUN = { id: "gun", bol: 1440, ekTr: "gün", ekEn: "d", ekEs: "d" };

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
    n.toLocaleString(intlLocaleOf(lang), {
      minimumFractionDigits: ondalik,
      maximumFractionDigits: ondalik,
    });
  const taban = badge?.birim;
  if (!taban) return yerel(Math.round(ham));
  const b = birimOverride || taban;
  const ek = b[`ek${cap(copyLanguage(lang, ["tr", "en", "es"]))}`] || b.ekEn;
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
  // ── Başlangıç ─────────────────────────────────────────────────────────────
  // İLK DAKİKADA KAZANILAN küçük rozetler. Amaç yeni kullanıcıya "ilk işaretleme
  // bile bir şey kazandırıyor" demek ve her adımın arkasında bir sonraki küçük
  // hedefi göstermek: ilk film → ilk bölüm → 10 eser → 25 eser. Hepsi common, hiçbiri
  // 30 işaretlemeden fazla istemez. Deneyimli kullanıcı için BEDAVA ve sessiz:
  // katalog genişleme koruması (0. kural) bunları kutlamasız emer.
  defineWatchBadge({
    id: "ilk_kare", section: BOLUM.BASLANGIC, icon: "footsteps-outline", iconSolid: "footsteps", rarity: RARITY.common,
    tr: "İlk Kare", en: "First Frame", es: "Primer fotograma",
    descTr: "İlk film ya da bölümünü işaretle", descEn: "Mark your first film or episode", descEs: "Marca tu primera película o episodio",
    target: 1, getProgress: (s) => say(s, "filmSayisi") + say(s, "bolumSayisi"),
  }),
  defineWatchBadge({
    id: "ilk_film", since: S2, section: BOLUM.BASLANGIC, icon: "ticket-outline", iconSolid: "ticket", rarity: RARITY.common,
    tr: "İlk Seans", en: "First Screening", es: "Primera sesión",
    descTr: "İlk filmini izle", descEn: "Watch your first film", descEs: "Ve tu primera película",
    target: 1, getProgress: (s) => say(s, "filmSayisi"),
  }),
  defineWatchBadge({
    id: "ilk_bolum", since: S2, section: BOLUM.BASLANGIC, icon: "play-circle-outline", iconSolid: "play-circle", rarity: RARITY.common,
    tr: "Pilot Bölüm", en: "Pilot Episode", es: "Episodio piloto",
    descTr: "İlk dizi bölümünü izle", descEn: "Watch your first episode", descEs: "Ve tu primer episodio",
    target: 1, getProgress: (s) => say(s, "bolumSayisi"),
  }),
  defineWatchBadge({
    id: "eser_10", since: S2, section: BOLUM.BASLANGIC, icon: "stopwatch-outline", iconSolid: "stopwatch", rarity: RARITY.common,
    tr: "Isınma Turu", en: "Warm-Up Lap", es: "Vuelta de calentamiento",
    descTr: "Toplam 10 film ya da bölüm işaretle", descEn: "Mark 10 films or episodes in total", descEs: "Marca 10 películas o episodios en total",
    target: 10, getProgress: (s) => say(s, "filmSayisi") + say(s, "bolumSayisi"),
  }),
  defineWatchBadge({
    id: "eser_25", since: S2, section: BOLUM.BASLANGIC, icon: "speedometer-outline", iconSolid: "speedometer", rarity: RARITY.common,
    tr: "Rayına Oturdu", en: "Hitting Stride", es: "Cogiendo ritmo",
    descTr: "Toplam 25 film ya da bölüm işaretle", descEn: "Mark 25 films or episodes in total", descEs: "Marca 25 películas o episodios en total",
    target: 25, getProgress: (s) => say(s, "filmSayisi") + say(s, "bolumSayisi"),
  }),
  defineWatchBadge({
    id: "gun_3", since: S2, section: BOLUM.BASLANGIC, icon: "calendar-clear-outline", iconSolid: "calendar-clear", rarity: RARITY.common,
    tr: "Üç Ayrı Gün", en: "Three Separate Days", es: "Tres días distintos",
    descTr: "3 farklı günde izleme işaretle", descEn: "Log a watch on 3 separate days", descEs: "Registra un visionado en 3 días distintos",
    target: 3, getProgress: (s) => say(s, "gunSayisi"),
  }),
  defineWatchBadge({
    id: "ilk_destan", since: S2, section: BOLUM.BASLANGIC, icon: "bookmarks-outline", iconSolid: "bookmarks", rarity: RARITY.common,
    tr: "İlk Destan", en: "First Epic", es: "Primera epopeya",
    descTr: "150 dakikadan uzun bir film izle", descEn: "Watch a film over 150 minutes", descEs: "Ve una película de más de 150 minutos",
    target: 1, getProgress: (s) => say(s, "uzunMetraj"),
  }),

  // ── Kilometre taşları ─────────────────────────────────────────────────────
  defineWatchBadge({
    id: "film_10", icon: "film-outline", iconSolid: "film", rarity: RARITY.common,
    family: "film", tier: 1, tr: "İlk Bilet", en: "First Ticket", es: "Primera entrada",
    descTr: "10 film izle", descEn: "Watch 10 films", descEs: "Ve 10 películas",
    target: 10, getProgress: (s) => say(s, "filmSayisi"),
  }),
  defineWatchBadge({
    id: "film_50", icon: "film-outline", iconSolid: "film", rarity: RARITY.uncommon,
    family: "film", tier: 2, tr: "Sürekli Müşteri", en: "Regular", es: "Cliente habitual",
    descTr: "50 film izle", descEn: "Watch 50 films", descEs: "Ve 50 películas",
    target: 50, getProgress: (s) => say(s, "filmSayisi"),
  }),
  defineWatchBadge({
    id: "film_150", icon: "film-outline", iconSolid: "film", rarity: RARITY.rare,
    family: "film", tier: 3, tr: "Salon Sakini", en: "Theater Dweller", es: "Vecino de la sala",
    descTr: "150 film izle", descEn: "Watch 150 films", descEs: "Ve 150 películas",
    target: 150, getProgress: (s) => say(s, "filmSayisi"),
  }),
  defineWatchBadge({
    id: "film_500", icon: "film-outline", iconSolid: "film", rarity: RARITY.epic,
    family: "film", tier: 4, tr: "Beş Yüz Film", en: "Five Hundred Films", es: "Quinientas películas",
    descTr: "500 film izle", descEn: "Watch 500 films", descEs: "Ve 500 películas",
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
    family: "film", tier: 5, tr: "İki Bin Film", en: "Two Thousand Films", es: "Dos mil películas",
    descTr: "2000 film izle", descEn: "Watch 2000 films", descEs: "Ve 2000 películas",
    target: 2000, getProgress: (s) => say(s, "filmSayisi"),
  }),
  defineWatchBadge({
    id: "bolum_25", icon: "tv-outline", iconSolid: "tv", rarity: RARITY.common,
    family: "bolum", tier: 1, tr: "Sezon Başı", en: "Season Opener", es: "Estreno de temporada",
    descTr: "25 bölüm izle", descEn: "Watch 25 episodes", descEs: "Ve 25 episodios",
    target: 25, getProgress: (s) => say(s, "bolumSayisi"),
  }),
  defineWatchBadge({
    id: "bolum_100", icon: "tv-outline", iconSolid: "tv", rarity: RARITY.uncommon,
    family: "bolum", tier: 2, tr: "Bölüm Avcısı", en: "Episode Hunter", es: "Cazaepisodios",
    descTr: "100 bölüm izle", descEn: "Watch 100 episodes", descEs: "Ve 100 episodios",
    target: 100, getProgress: (s) => say(s, "bolumSayisi"),
  }),
  defineWatchBadge({
    id: "bolum_500", icon: "tv-outline", iconSolid: "tv", rarity: RARITY.rare,
    family: "bolum", tier: 3, tr: "Bölüm Kurdu", en: "Episode Devourer", es: "Devoraepisodios",
    descTr: "500 bölüm izle", descEn: "Watch 500 episodes", descEs: "Ve 500 episodios",
    target: 500, getProgress: (s) => say(s, "bolumSayisi"),
  }),
  defineWatchBadge({
    id: "bolum_2000", icon: "tv-outline", iconSolid: "tv", rarity: RARITY.epic,
    family: "bolum", tier: 4, tr: "İki Bin Bölüm", en: "Two Thousand Episodes", es: "Dos mil episodios",
    descTr: "2000 bölüm izle", descEn: "Watch 2000 episodes", descEs: "Ve 2000 episodios",
    target: 2000, getProgress: (s) => say(s, "bolumSayisi"),
  }),
  // ZİRVE. Merdiven 4× · 5× · 4× · 5× — film ailesinden daha dik, çünkü bölüm
  // başına Kare de düşük (≈37'ye karşı ≈165). 10.000 bölüm ≈ 370.000 Kare,
  // yani 2.000 filmle KABACA AYNI emek. İki ailenin zirvesi eşit ağırlıkta
  // olmalı; biri diğerinden ucuz olsaydı sistem bir izleme biçimini
  // ödüllendirip diğerini cezalandırırdı.
  defineWatchBadge({
    id: "bolum_10000", icon: "tv-outline", iconSolid: "tv", rarity: RARITY.legendary,
    family: "bolum", tier: 5, tr: "On Bin Bölüm", en: "Ten Thousand Episodes", es: "Diez mil episodios",
    descTr: "10000 bölüm izle", descEn: "Watch 10000 episodes", descEs: "Ve 10000 episodios",
    target: 10000, getProgress: (s) => say(s, "bolumSayisi"),
  }),
  // TAKİP EDİLEN DİZİ SAYISI — katalogda `diziSayisi`yi okuyan tek rozet.
  // Film/bölüm aileleri "ne kadar" izlediğini sayar; bu rozet KAÇ FARKLI dizinin
  // peşine düştüğünü söyler. 100 farklı dizi, bitirmeyi değil KEŞFETMEYİ
  // ödüllendirir — final ailesinin (bitirilen dizi) tam karşı kutbu.
  //
  // v2'de TEK rozetten 5 kademeli aileye çevrildi: 100 diziye giden yolda hiçbir
  // şey yoktu, yani "kaç dizi takip ediyorum?" sorusu ilk 100'e kadar ödülsüzdü.
  // `dizi_100` id'si ve hedefi AYNI kaldı (zirve oldu) — kazanılmış rozet kaymaz.
  defineWatchBadge({
    id: "dizi_5", since: S2, icon: "grid-outline", iconSolid: "grid", rarity: RARITY.common,
    family: "dizi", tier: 1, tr: "Dizi Merakı", en: "Series Curiosity", es: "Curiosidad por las series",
    descTr: "5 farklı diziyi takip et", descEn: "Track 5 different series", descEs: "Sigue 5 series distintas",
    target: 5, getProgress: (s) => say(s, "diziSayisi"),
  }),
  defineWatchBadge({
    id: "dizi_15", since: S2, icon: "grid-outline", iconSolid: "grid", rarity: RARITY.uncommon,
    family: "dizi", tier: 2, tr: "Dizi Rafı", en: "Series Shelf", es: "Estantería de series",
    descTr: "15 farklı diziyi takip et", descEn: "Track 15 different series", descEs: "Sigue 15 series distintas",
    target: 15, getProgress: (s) => say(s, "diziSayisi"),
  }),
  defineWatchBadge({
    id: "dizi_30", since: S2, icon: "grid-outline", iconSolid: "grid", rarity: RARITY.uncommon,
    family: "dizi", tier: 3, tr: "Dizi Kütüphanesi", en: "Series Library", es: "Biblioteca de series",
    descTr: "30 farklı diziyi takip et", descEn: "Track 30 different series", descEs: "Sigue 30 series distintas",
    target: 30, getProgress: (s) => say(s, "diziSayisi"),
  }),
  defineWatchBadge({
    id: "dizi_60", since: S2, icon: "grid-outline", iconSolid: "grid", rarity: RARITY.rare,
    family: "dizi", tier: 4, tr: "Dizi Arşivi", en: "Series Archive", es: "Archivo de series",
    descTr: "60 farklı diziyi takip et", descEn: "Track 60 different series", descEs: "Sigue 60 series distintas",
    target: 60, getProgress: (s) => say(s, "diziSayisi"),
  }),
  defineWatchBadge({
    id: "dizi_100", icon: "grid-outline", iconSolid: "grid", rarity: RARITY.rare,
    family: "dizi", tier: 5, tr: "Yüz Dizi", en: "Hundred Series", es: "Cien series",
    descTr: "100 farklı diziyi takip et", descEn: "Track 100 different series", descEs: "Sigue 100 series distintas",
    target: 100, getProgress: (s) => say(s, "diziSayisi"),
  }),
  // SEZON AİLESİ — izlenen SEZON sayısı (en az bir bölümü işaretli sezonlar).
  // Dizi sayısı "kaç farklı dünya", bölüm sayısı "kaç saat" der; sezon bunların
  // arasındaki birimdir: 8 sezonluk tek bir dizi de, 8 farklı mini diziyle de
  // aynı ölçüde "sezon" sayılır. Puana girmez; toplu işaretlemeyle (markShow)
  // kolay şişirilebildiği için tavan rare.
  defineWatchBadge({
    id: "sezon_10", since: S2, icon: "file-tray-stacked-outline", iconSolid: "file-tray-stacked", rarity: RARITY.common,
    family: "sezon", tier: 1, tr: "Sezon Sepeti", en: "Season Basket", es: "Cesta de temporadas",
    descTr: "Toplam 10 sezon izle", descEn: "Watch 10 seasons in total", descEs: "Ve 10 temporadas en total",
    target: 10, getProgress: (s) => say(s, "izlenenSezon"),
  }),
  defineWatchBadge({
    id: "sezon_30", since: S2, icon: "file-tray-stacked-outline", iconSolid: "file-tray-stacked", rarity: RARITY.uncommon,
    family: "sezon", tier: 2, tr: "Sezon Koleksiyonu", en: "Season Collection", es: "Colección de temporadas",
    descTr: "Toplam 30 sezon izle", descEn: "Watch 30 seasons in total", descEs: "Ve 30 temporadas en total",
    target: 30, getProgress: (s) => say(s, "izlenenSezon"),
  }),
  defineWatchBadge({
    id: "sezon_75", since: S2, icon: "file-tray-stacked-outline", iconSolid: "file-tray-stacked", rarity: RARITY.rare,
    family: "sezon", tier: 3, tr: "Sezon Hazinesi", en: "Season Treasure", es: "Tesoro de temporadas",
    descTr: "Toplam 75 sezon izle", descEn: "Watch 75 seasons in total", descEs: "Ve 75 temporadas en total",
    target: 75, getProgress: (s) => say(s, "izlenenSezon"),
  }),
  defineWatchBadge({
    id: "sezon_200", since: S2, icon: "file-tray-stacked-outline", iconSolid: "file-tray-stacked", rarity: RARITY.rare,
    family: "sezon", tier: 4, tr: "Sezon Okyanusu", en: "Season Ocean", es: "Océano de temporadas",
    descTr: "Toplam 200 sezon izle", descEn: "Watch 200 seasons in total", descEs: "Ve 200 temporadas en total",
    target: 200, getProgress: (s) => say(s, "izlenenSezon"),
  }),
  // ESER AİLESİ — film + bölüm TOPLAMI. Film ve bölüm aileleri kendi eksenlerinde
  // uzun çöller taşıyor (film 150→500, bölüm 500→2000); yalnızca dizi izleyen ya da
  // yalnızca film izleyen kullanıcı o aralıkta aylarca rozet görmüyordu. Toplam
  // eser ölçütü iki izleme biçimini TEK merdivende buluşturur, çöllerin içine
  // 300 ve 1.000 basamaklarını koyar. İlk iki mikro basamak (10, 25) Başlangıç
  // bölümünde durur (eser_10, eser_25) — aile 100'den başlar.
  defineWatchBadge({
    id: "eser_100", since: S2, icon: "flag-outline", iconSolid: "flag", rarity: RARITY.uncommon,
    family: "eser", tier: 1, tr: "Yüzlük Kulüp", en: "Century Club", es: "Club de los cien",
    descTr: "Toplam 100 film ya da bölüm işaretle", descEn: "Mark 100 films or episodes in total", descEs: "Marca 100 películas o episodios en total",
    target: 100, getProgress: (s) => say(s, "filmSayisi") + say(s, "bolumSayisi"),
  }),
  defineWatchBadge({
    id: "eser_300", since: S2, icon: "flag-outline", iconSolid: "flag", rarity: RARITY.uncommon,
    family: "eser", tier: 2, tr: "Büyüyen Arşiv", en: "Growing Archive", es: "Archivo en crecimiento",
    descTr: "Toplam 300 film ya da bölüm işaretle", descEn: "Mark 300 films or episodes in total", descEs: "Marca 300 películas o episodios en total",
    target: 300, getProgress: (s) => say(s, "filmSayisi") + say(s, "bolumSayisi"),
  }),
  defineWatchBadge({
    id: "eser_1000", since: S2, icon: "flag-outline", iconSolid: "flag", rarity: RARITY.rare,
    family: "eser", tier: 3, tr: "Bin Eser", en: "A Thousand Titles", es: "Mil títulos",
    descTr: "Toplam 1000 film ya da bölüm işaretle", descEn: "Mark 1000 films or episodes in total", descEs: "Marca 1000 películas o episodios en total",
    target: 1000, getProgress: (s) => say(s, "filmSayisi") + say(s, "bolumSayisi"),
  }),
  defineWatchBadge({
    id: "eser_3000", since: S2, icon: "flag-outline", iconSolid: "flag", rarity: RARITY.epic,
    family: "eser", tier: 4, tr: "Devasa Arşiv", en: "Colossal Archive", es: "Archivo colosal",
    descTr: "Toplam 3000 film ya da bölüm işaretle", descEn: "Mark 3000 films or episodes in total", descEs: "Marca 3000 películas o episodios en total",
    target: 3000, getProgress: (s) => say(s, "filmSayisi") + say(s, "bolumSayisi"),
  }),
  defineWatchBadge({
    id: "final_1", icon: "checkmark-done-outline", iconSolid: "checkmark-done", rarity: RARITY.common,
    family: "final", tier: 1, tr: "Final Jeneriği", en: "End Credits", es: "Créditos finales",
    descTr: "İşaretlediğin bir diziyi sonuna getir", descEn: "Finish a series you track", descEs: "Termina una serie que sigues",
    target: 1, getProgress: (s) => say(s, "tamamlananDizi"),
  }),
  // Merdiven 1 → 100: zirve (100 dizi bitirmek) "Arşiv Kapatıcı", altın sekizgen.
  // Oranlar 10× · 2,5× · 2× · 2× — ilk sıçrama en büyük, sonra yumuşar. 100
  // tamamlanmış dizi film_2000 ölçeğinde bir ömürlük hedeftir.
  defineWatchBadge({
    id: "final_10", icon: "checkmark-done-outline", iconSolid: "checkmark-done", rarity: RARITY.uncommon,
    family: "final", tier: 2, tr: "Seri Tamamlayıcı", en: "Series Closer", es: "Cierraseries",
    descTr: "10 diziyi sonuna getir", descEn: "Finish 10 series", descEs: "Termina 10 series",
    target: 10, getProgress: (s) => say(s, "tamamlananDizi"),
  }),
  defineWatchBadge({
    id: "final_25", icon: "checkmark-done-outline", iconSolid: "checkmark-done", rarity: RARITY.uncommon,
    family: "final", tier: 3, tr: "Final Koleksiyoncusu", en: "Finale Collector", es: "Coleccionista de finales",
    descTr: "25 diziyi sonuna getir", descEn: "Finish 25 series", descEs: "Termina 25 series",
    target: 25, getProgress: (s) => say(s, "tamamlananDizi"),
  }),
  defineWatchBadge({
    id: "final_50", icon: "checkmark-done-outline", iconSolid: "checkmark-done", rarity: RARITY.rare,
    family: "final", tier: 4, tr: "Dizi Ustası", en: "Series Master", es: "Maestría en series",
    descTr: "50 diziyi sonuna getir", descEn: "Finish 50 series", descEs: "Termina 50 series",
    target: 50, getProgress: (s) => say(s, "tamamlananDizi"),
  }),
  defineWatchBadge({
    id: "final_100", icon: "checkmark-done-outline", iconSolid: "checkmark-done", rarity: RARITY.rare,
    family: "final", tier: 5, tr: "Arşiv Kapatıcı", en: "Archive Closer", es: "Cierre del archivo",
    descTr: "100 diziyi sonuna getir", descEn: "Finish 100 series", descEs: "Termina 100 series",
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
    family: "sure", tier: 1, birim: DAKIKA, tr: "Bir Hafta Perdede", en: "A Week on Screen", es: "Una semana de pantalla",
    descTr: "Toplam 1 hafta (168 saat) ekran süresine ulaş",
    descEn: "Reach 1 week (168 hours) of total screen time", descEs: "Alcanza 1 semana (168 horas) de tiempo total de pantalla",
    target: 10080, getProgress: (s) => say(s, "etkinDakikaToplam"),
  }),
  defineWatchBadge({
    id: "sure_ay", icon: "hourglass-outline", iconSolid: "hourglass", rarity: RARITY.uncommon,
    family: "sure", tier: 2, birim: DAKIKA, tr: "Bir Ay Perdede", en: "A Month on Screen", es: "Un mes de pantalla",
    descTr: "Toplam 1 ay (720 saat) ekran süresine ulaş",
    descEn: "Reach 1 month (720 hours) of total screen time", descEs: "Alcanza 1 mes (720 horas) de tiempo total de pantalla",
    target: 43200, getProgress: (s) => say(s, "etkinDakikaToplam"),
  }),
  defineWatchBadge({
    id: "sure_3ay", icon: "hourglass-outline", iconSolid: "hourglass", rarity: RARITY.rare,
    family: "sure", tier: 3, birim: DAKIKA, tr: "Üç Ay Perdede", en: "Three Months on Screen", es: "Tres meses de pantalla",
    descTr: "Toplam 3 ay (2.160 saat) ekran süresine ulaş",
    descEn: "Reach 3 months (2,160 hours) of total screen time", descEs: "Alcanza 3 meses (2160 horas) de tiempo total de pantalla",
    target: 129600, getProgress: (s) => say(s, "etkinDakikaToplam"),
  }),
  defineWatchBadge({
    id: "sure_6ay", icon: "time-outline", iconSolid: "time", rarity: RARITY.rare,
    family: "sure", tier: 4, birim: DAKIKA, tr: "Altı Ay Perdede", en: "Six Months on Screen", es: "Seis meses de pantalla",
    descTr: "Toplam 6 ay (4.320 saat) ekran süresine ulaş",
    descEn: "Reach 6 months (4,320 hours) of total screen time", descEs: "Alcanza 6 meses (4320 horas) de tiempo total de pantalla",
    target: 259200, getProgress: (s) => say(s, "etkinDakikaToplam"),
  }),
  defineWatchBadge({
    id: "sure_yil", icon: "time-outline", iconSolid: "time", rarity: RARITY.epic,
    family: "sure", tier: 5, birim: DAKIKA, tr: "Bir Yıl Perdede", en: "A Year on Screen", es: "Un año de pantalla",
    descTr: "Toplam 1 yıl (8.760 saat) ekran süresine ulaş",
    descEn: "Reach 1 year (8,760 hours) of total screen time", descEs: "Alcanza 1 año (8760 horas) de tiempo total de pantalla",
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
    family: "uzunMetraj", tier: 1, tr: "Uzun Metraj", en: "Feature Length", es: "Largometraje",
    descTr: "150 dakikadan uzun 10 film izle", descEn: "Watch 10 films over 150 minutes", descEs: "Ve 10 películas de más de 150 minutos",
    target: 10, getProgress: (s) => say(s, "uzunMetraj"),
  }),
  defineWatchBadge({
    id: "uzun_metraj_25", icon: "albums-outline", iconSolid: "albums", rarity: RARITY.uncommon,
    family: "uzunMetraj", tier: 2, tr: "Uzun Soluklu", en: "Long Haul", es: "Larga distancia",
    descTr: "150 dakikadan uzun 25 film izle", descEn: "Watch 25 films over 150 minutes", descEs: "Ve 25 películas de más de 150 minutos",
    target: 25, getProgress: (s) => say(s, "uzunMetraj"),
  }),
  defineWatchBadge({
    id: "uzun_metraj_50", icon: "layers-outline", iconSolid: "layers", rarity: RARITY.rare,
    family: "uzunMetraj", tier: 3, tr: "Destan Sever", en: "Epic Lover", es: "Amante de las epopeyas",
    descTr: "150 dakikadan uzun 50 film izle", descEn: "Watch 50 films over 150 minutes", descEs: "Ve 50 películas de más de 150 minutos",
    target: 50, getProgress: (s) => say(s, "uzunMetraj"),
  }),
  // v2: aile 5. kademeye (200) uzatıldı ve 100'lük kademe epic'ten rare'e indi —
  // zirve epic kalsın, merdiven monoton olsun (u → u → r → r → e). Nadirlik
  // kozmetiktir, defteri etkilemez; kazanılmış rozet kaymaz.
  defineWatchBadge({
    id: "uzun_metraj_100", icon: "layers-outline", iconSolid: "layers", rarity: RARITY.rare,
    family: "uzunMetraj", tier: 4, tr: "Yüz Destan", en: "Hundred Epics", es: "Cien epopeyas",
    descTr: "150 dakikadan uzun 100 film izle", descEn: "Watch 100 films over 150 minutes", descEs: "Ve 100 películas de más de 150 minutos",
    target: 100, getProgress: (s) => say(s, "uzunMetraj"),
  }),
  defineWatchBadge({
    id: "uzun_metraj_200", since: S2, icon: "layers-outline", iconSolid: "layers", rarity: RARITY.epic,
    family: "uzunMetraj", tier: 5, tr: "İki Yüz Destan", en: "Two Hundred Epics", es: "Doscientas epopeyas",
    descTr: "150 dakikadan uzun 200 film izle", descEn: "Watch 200 films over 150 minutes", descEs: "Ve 200 películas de más de 150 minutos",
    target: 200, getProgress: (s) => say(s, "uzunMetraj"),
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
    family: "seri", tier: 1, tr: "İlk Ritim", en: "First Rhythm", es: "Primer ritmo",
    descTr: "2 hafta üst üste işaretleme yap", descEn: "Mark something 2 weeks in a row", descEs: "Marca algo 2 semanas seguidas",
    target: 2, getProgress: (s) => say(s, "rekorHaftaSerisi"),
  }),
  defineWatchBadge({
    id: "seri_7", section: BOLUM.RITIM, icon: "flame-outline", iconSolid: "flame", rarity: RARITY.uncommon,
    family: "seri", tier: 2, tr: "Yerleşen Alışkanlık", en: "Settled Habit", es: "Hábito asentado",
    descTr: "6 hafta üst üste işaretleme yap", descEn: "Mark something 6 weeks in a row", descEs: "Marca algo 6 semanas seguidas",
    target: 6, getProgress: (s) => say(s, "rekorHaftaSerisi"),
  }),
  defineWatchBadge({
    id: "seri_21", section: BOLUM.RITIM, icon: "flame-outline", iconSolid: "flame", rarity: RARITY.rare,
    family: "seri", tier: 3, tr: "Dört Ay Kesintisiz", en: "Four Months Straight", es: "Cuatro meses seguidos",
    descTr: "16 hafta üst üste işaretleme yap", descEn: "Mark something 16 weeks in a row", descEs: "Marca algo 16 semanas seguidas",
    target: 16, getProgress: (s) => say(s, "rekorHaftaSerisi"),
  }),
  defineWatchBadge({
    id: "seri_30", section: BOLUM.RITIM, icon: "flame-outline", iconSolid: "flame", rarity: RARITY.rare,
    family: "seri", tier: 4, tr: "Yedi Ay Kesintisiz", en: "Seven Months Straight", es: "Siete meses seguidos",
    descTr: "30 hafta üst üste işaretleme yap", descEn: "Mark something 30 weeks in a row", descEs: "Marca algo 30 semanas seguidas",
    target: 30, getProgress: (s) => say(s, "rekorHaftaSerisi"),
  }),
  defineWatchBadge({
    id: "seri_60", section: BOLUM.RITIM, icon: "bonfire-outline", iconSolid: "bonfire", rarity: RARITY.rare,
    family: "seri", tier: 5, tr: "Bir Yıl Kesintisiz", en: "A Full Year", es: "Un año entero",
    descTr: "52 hafta üst üste işaretleme yap", descEn: "Mark something 52 weeks in a row", descEs: "Marca algo 52 semanas seguidas",
    target: 52, getProgress: (s) => say(s, "rekorHaftaSerisi"),
  }),
  defineWatchBadge({
    id: "gun_25", section: BOLUM.RITIM, icon: "today-outline", iconSolid: "today", rarity: RARITY.common,
    family: "gun", tier: 1, tr: "Yirmi Beş Gün", en: "Twenty-Five Days", es: "Veinticinco días",
    descTr: "25 farklı günde izleme işaretle", descEn: "Log a watch on 25 separate days", descEs: "Registra un visionado en 25 días distintos",
    target: 25, getProgress: (s) => say(s, "gunSayisi"),
  }),
  defineWatchBadge({
    id: "gun_50", section: BOLUM.RITIM, icon: "today-outline", iconSolid: "today", rarity: RARITY.uncommon,
    family: "gun", tier: 2, tr: "Elli Gün Kayıt", en: "Fifty Days Logged", es: "Cincuenta días registrados",
    descTr: "50 farklı günde izleme işaretle", descEn: "Log a watch on 50 separate days", descEs: "Registra un visionado en 50 días distintos",
    target: 50, getProgress: (s) => say(s, "gunSayisi"),
  }),
  defineWatchBadge({
    id: "gun_100", section: BOLUM.RITIM, icon: "today-outline", iconSolid: "today", rarity: RARITY.uncommon,
    family: "gun", tier: 3, tr: "Yüz Gün Kayıt", en: "Hundred Days Logged", es: "Cien días registrados",
    descTr: "100 farklı günde izleme işaretle", descEn: "Log a watch on 100 separate days", descEs: "Registra un visionado en 100 días distintos",
    target: 100, getProgress: (s) => say(s, "gunSayisi"),
  }),
  defineWatchBadge({
    id: "gun_200", section: BOLUM.RITIM, icon: "calendar-outline", iconSolid: "calendar", rarity: RARITY.rare,
    family: "gun", tier: 4, tr: "İki Yüz Gün Kayıt", en: "Two Hundred Days Logged", es: "Doscientos días registrados",
    descTr: "200 farklı günde izleme işaretle", descEn: "Log a watch on 200 separate days", descEs: "Registra un visionado en 200 días distintos",
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
    family: "gun", tier: 5, tr: "Beş Yüz Gün", en: "Five Hundred Days", es: "Quinientos días",
    descTr: "500 farklı günde izleme işaretle", descEn: "Log a watch on 500 separate days", descEs: "Registra un visionado en 500 días distintos",
    target: 500, getProgress: (s) => say(s, "gunSayisi"),
  }),
  // AY AİLESİ — bir TAKVİM YILI içinde kaç farklı ayda izleme yapıldığı
  // (`enCokAyliYil`). Kademeli hâle getirildi (kullanıcı isteği): tek başına
  // duran 12 aylık hedef, yılın ortasında bırakan kullanıcıya hiçbir şey
  // vermiyordu; 3/6/9 ara kademeleri yıl boyunca ilerleme hissi taşır.
  // ZİRVE eski `ay_12` id'siyle AYNI kalır — kazanılmış rozet kaymaz.
  defineWatchBadge({
    id: "ay_3", section: BOLUM.RITIM, icon: "calendar-number-outline", iconSolid: "calendar-number", rarity: RARITY.common,
    family: "ay", tier: 1, tr: "Çeyrek Takvim", en: "Quarter Calendar", es: "Cuarto de calendario",
    descTr: "Bir yılın 3 ayında izleme yap", descEn: "Watch in 3 months of one year", descEs: "Ve algo en 3 meses de un mismo año",
    target: 3, getProgress: (s) => say(s, "enCokAyliYil"),
  }),
  defineWatchBadge({
    id: "ay_6", section: BOLUM.RITIM, icon: "calendar-number-outline", iconSolid: "calendar-number", rarity: RARITY.common,
    family: "ay", tier: 2, tr: "Yarım Takvim", en: "Half Calendar", es: "Medio calendario",
    descTr: "Bir yılın 6 ayında izleme yap", descEn: "Watch in 6 months of one year", descEs: "Ve algo en 6 meses de un mismo año",
    target: 6, getProgress: (s) => say(s, "enCokAyliYil"),
  }),
  defineWatchBadge({
    id: "ay_9", section: BOLUM.RITIM, icon: "calendar-number-outline", iconSolid: "calendar-number", rarity: RARITY.uncommon,
    family: "ay", tier: 3, tr: "Dokuz Ay", en: "Nine Months", es: "Nueve meses",
    descTr: "Bir yılın 9 ayında izleme yap", descEn: "Watch in 9 months of one year", descEs: "Ve algo en 9 meses de un mismo año",
    target: 9, getProgress: (s) => say(s, "enCokAyliYil"),
  }),
  defineWatchBadge({
    id: "ay_12", section: BOLUM.RITIM, icon: "calendar-number-outline", iconSolid: "calendar-number", rarity: RARITY.uncommon,
    family: "ay", tier: 4, tr: "Takvim Doldu", en: "Full Calendar", es: "Calendario completo",
    descTr: "Bir yılın 12 ayında da izleme yap", descEn: "Watch in all 12 months of a year", descEs: "Ve algo en los 12 meses de un año",
    target: 12, getProgress: (s) => say(s, "enCokAyliYil"),
  }),
  // MARATON AİLESİ — aynı GÜNDE işaretlenen film adedi (`maxGunFilm`).
  // 3 → 5 → 8: üçü de tek bir günün içinde olur, yani merdiven "daha çok izle"
  // değil "daha uzun otur" der. 8 film ≈ 15 saat; üstüne kademe konmadı çünkü
  // bir günde daha fazlası izleme değil işaretleme davranışı olurdu.
  // Tarih türevi → rare tavanı.
  defineWatchBadge({
    id: "maraton_3film", section: BOLUM.RITIM, icon: "pizza-outline", iconSolid: "pizza", rarity: RARITY.uncommon,
    family: "maraton", tier: 1, tr: "Maraton", en: "Marathon", es: "Maratón",
    descTr: "Aynı gün 3 film işaretle", descEn: "Mark 3 films on the same day", descEs: "Marca 3 películas el mismo día",
    target: 3, getProgress: (s) => say(s, "maxGunFilm"),
  }),
  defineWatchBadge({
    id: "maraton_5film", section: BOLUM.RITIM, icon: "pizza-outline", iconSolid: "pizza", rarity: RARITY.uncommon,
    family: "maraton", tier: 2, tr: "Uzun Maraton", en: "Long Marathon", es: "Maratón largo",
    descTr: "Aynı gün 5 film işaretle", descEn: "Mark 5 films on the same day", descEs: "Marca 5 películas el mismo día",
    target: 5, getProgress: (s) => say(s, "maxGunFilm"),
  }),
  defineWatchBadge({
    id: "maraton_8film", section: BOLUM.RITIM, icon: "bonfire-outline", iconSolid: "bonfire", rarity: RARITY.rare,
    family: "maraton", tier: 3, tr: "Maraton Ustası", en: "Marathon Master", es: "Maestría en maratones",
    descTr: "Aynı gün 8 film işaretle", descEn: "Mark 8 films on the same day", descEs: "Marca 8 películas el mismo día",
    target: 8, getProgress: (s) => say(s, "maxGunFilm"),
  }),
  // TEK OTURUŞ AİLESİ — aynı SEZONdan aynı güne işaretlenen bölüm adedi
  // (`tekOturusta`). Kademeler gerçek sezon uzunluklarına oturur: 8 (kısa
  // streaming sezonu) → 13 (yarım network sezonu) → 22 (tam network sezonu).
  // Yani zirve "bir sezonu tek günde bitirdim" demektir. Tarih türevi → rare.
  defineWatchBadge({
    id: "tek_oturusta", section: BOLUM.RITIM, icon: "flash-outline", iconSolid: "flash", rarity: RARITY.common,
    family: "tekOturus", tier: 1, tr: "Tek Oturuşta", en: "One Sitting", es: "De una sentada",
    descTr: "Bir sezonun 8 bölümünü aynı güne işaretle", descEn: "Mark 8 episodes of one season on one day", descEs: "Marca 8 episodios de una temporada en un solo día",
    target: 8, getProgress: (s) => say(s, "tekOturusta"),
  }),
  defineWatchBadge({
    id: "tek_oturusta_13", section: BOLUM.RITIM, icon: "flash-outline", iconSolid: "flash", rarity: RARITY.uncommon,
    family: "tekOturus", tier: 2, tr: "Sezon Tek Oturuşta", en: "Season in One Sitting", es: "Temporada de una sentada",
    descTr: "Bir sezonun 13 bölümünü aynı güne işaretle", descEn: "Mark 13 episodes of one season on one day", descEs: "Marca 13 episodios de una temporada en un solo día",
    target: 13, getProgress: (s) => say(s, "tekOturusta"),
  }),
  defineWatchBadge({
    id: "tek_oturusta_22", section: BOLUM.RITIM, icon: "infinite-outline", iconSolid: "infinite", rarity: RARITY.rare,
    family: "tekOturus", tier: 3, tr: "Tam Sezon", en: "Full Season", es: "Temporada completa",
    descTr: "Bir sezonun 22 bölümünü aynı güne işaretle", descEn: "Mark 22 episodes of one season on one day", descEs: "Marca 22 episodios de una temporada en un solo día",
    target: 22, getProgress: (s) => say(s, "tekOturusta"),
  }),
  // GÜNLÜK SERİ — `rekorGunSerisi` (defterdeki gerçek işaretleme günleri).
  //
  // HAFTALIK seri ailesinin YANINA, kısa vadeli bir hedef olarak eklendi. Haftalık
  // ailenin gerekçesi (günlük CEZA kullanıcıyı sahte işaretlemeye iter) burada da
  // geçerli, ama bu aile ceza taşımıyor: REKOR okur, mevcut seri değil — bir gün
  // kaçıran kullanıcı hiçbir şey kaybetmez, sadece bir sonraki koşusuna yeniden
  // başlar. Eşikler bilerek kısa (3 → 30 gün): "bu akşam yine bir şey işaretlersem
  // 3 günü tamamlarım" hissi haftalık merdivenin veremediği günlük merak.
  // Tarih türevi (cihaz saati) → rare tavanı.
  defineWatchBadge({
    id: "ardisik_3", since: S2, section: BOLUM.RITIM, icon: "pulse-outline", iconSolid: "pulse", rarity: RARITY.common,
    family: "ardisik", tier: 1, tr: "Üç Gün Üst Üste", en: "Three-Day Streak", es: "Tres días seguidos",
    descTr: "3 gün art arda işaretleme yap", descEn: "Mark something 3 days in a row", descEs: "Marca algo 3 días seguidos",
    target: 3, getProgress: (s) => say(s, "rekorGunSerisi"),
  }),
  defineWatchBadge({
    id: "ardisik_7", since: S2, section: BOLUM.RITIM, icon: "pulse-outline", iconSolid: "pulse", rarity: RARITY.uncommon,
    family: "ardisik", tier: 2, tr: "Tam Bir Hafta", en: "A Full Week", es: "Una semana completa",
    descTr: "7 gün art arda işaretleme yap", descEn: "Mark something 7 days in a row", descEs: "Marca algo 7 días seguidos",
    target: 7, getProgress: (s) => say(s, "rekorGunSerisi"),
  }),
  defineWatchBadge({
    id: "ardisik_14", since: S2, section: BOLUM.RITIM, icon: "pulse-outline", iconSolid: "pulse", rarity: RARITY.rare,
    family: "ardisik", tier: 3, tr: "İki Hafta Kesintisiz", en: "Two Weeks Straight", es: "Dos semanas seguidas",
    descTr: "14 gün art arda işaretleme yap", descEn: "Mark something 14 days in a row", descEs: "Marca algo 14 días seguidos",
    target: 14, getProgress: (s) => say(s, "rekorGunSerisi"),
  }),
  defineWatchBadge({
    id: "ardisik_30", since: S2, section: BOLUM.RITIM, icon: "pulse-outline", iconSolid: "pulse", rarity: RARITY.rare,
    family: "ardisik", tier: 4, tr: "Otuz Gün Ateşi", en: "Thirty-Day Blaze", es: "Treinta días de fuego",
    descTr: "30 gün art arda işaretleme yap", descEn: "Mark something 30 days in a row", descEs: "Marca algo 30 días seguidos",
    target: 30, getProgress: (s) => say(s, "rekorGunSerisi"),
  }),
  // HAFTA SONU AİLESİ — Cumartesi/Pazar günlerinden kaçında izleme yapıldı.
  // `gunSayisi` gün sayar ama haftanın hangi günü olduğuna bakmaz; bu aile
  // "hafta içi sıkıştırdığım" ile "hafta sonu keyfine ayırdığım" izleyicisini
  // ayırır. Farklı GÜN sayar (aynı gün 5 film = 1) → toplu işaretlemeyle
  // şişirilemez. Tarih türevi → rare tavanı.
  defineWatchBadge({
    id: "hafta_sonu_5", since: S2, section: BOLUM.RITIM, icon: "home-outline", iconSolid: "home", rarity: RARITY.common,
    family: "haftaSonu", tier: 1, tr: "Hafta Sonu Keyfi", en: "Weekend Treat", es: "Capricho de fin de semana",
    descTr: "5 farklı hafta sonu gününde izleme işaretle", descEn: "Log a watch on 5 separate weekend days", descEs: "Registra un visionado en 5 días de fin de semana distintos",
    target: 5, getProgress: (s) => say(s, "haftaSonuGun"),
  }),
  defineWatchBadge({
    id: "hafta_sonu_20", since: S2, section: BOLUM.RITIM, icon: "home-outline", iconSolid: "home", rarity: RARITY.uncommon,
    family: "haftaSonu", tier: 2, tr: "Hafta Sonu Müdavimi", en: "Weekend Regular", es: "Habitual del finde",
    descTr: "20 farklı hafta sonu gününde izleme işaretle", descEn: "Log a watch on 20 separate weekend days", descEs: "Registra un visionado en 20 días de fin de semana distintos",
    target: 20, getProgress: (s) => say(s, "haftaSonuGun"),
  }),
  defineWatchBadge({
    id: "hafta_sonu_50", since: S2, section: BOLUM.RITIM, icon: "home-outline", iconSolid: "home", rarity: RARITY.rare,
    family: "haftaSonu", tier: 3, tr: "Kanepe Kampı", en: "Couch Camp", es: "Campamento de sofá",
    descTr: "50 farklı hafta sonu gününde izleme işaretle", descEn: "Log a watch on 50 separate weekend days", descEs: "Registra un visionado en 50 días de fin de semana distintos",
    target: 50, getProgress: (s) => say(s, "haftaSonuGun"),
  }),
  defineWatchBadge({
    id: "hafta_sonu_100", since: S2, section: BOLUM.RITIM, icon: "home-outline", iconSolid: "home", rarity: RARITY.rare,
    family: "haftaSonu", tier: 4, tr: "Hafta Sonu Efsanesi", en: "Weekend Legend", es: "Leyenda del finde",
    descTr: "100 farklı hafta sonu gününde izleme işaretle", descEn: "Log a watch on 100 separate weekend days", descEs: "Registra un visionado en 100 días de fin de semana distintos",
    target: 100, getProgress: (s) => say(s, "haftaSonuGun"),
  }),

  // ── Bağlılık ──────────────────────────────────────────────────────────────
  // "Aynı şeye ne kadar dönüyorsun?" Ritim bölümü ne SIKLIKLA izlediğini, Kilometre
  // ne KADAR izlediğini ölçer; bu bölüm üçüncü eksen: tekrar ve sadakat.
  //
  // TEKRAR İZLEME `watchEvents`ten gelir (puana girmez, bkz. watchScoring). Olay
  // kullanıcı girdisi olduğu için tavan rare.
  defineWatchBadge({
    id: "tekrar_1", since: S2, section: BOLUM.BAGLILIK, icon: "repeat-outline", iconSolid: "repeat", rarity: RARITY.common,
    family: "tekrar", tier: 1, tr: "İkinci Gösterim", en: "Encore", es: "Bis",
    descTr: "Bir filmi ikinci kez izle", descEn: "Watch a film a second time", descEs: "Ve una película por segunda vez",
    target: 1, getProgress: (s) => say(s, "tekrarFilm"),
  }),
  defineWatchBadge({
    id: "tekrar_5", since: S2, section: BOLUM.BAGLILIK, icon: "repeat-outline", iconSolid: "repeat", rarity: RARITY.uncommon,
    family: "tekrar", tier: 2, tr: "Konfor Filmleri", en: "Comfort Films", es: "Pelis de confort",
    descTr: "5 farklı filmi tekrar izle", descEn: "Rewatch 5 different films", descEs: "Vuelve a ver 5 películas distintas",
    target: 5, getProgress: (s) => say(s, "tekrarFilm"),
  }),
  defineWatchBadge({
    id: "tekrar_15", since: S2, section: BOLUM.BAGLILIK, icon: "repeat-outline", iconSolid: "repeat", rarity: RARITY.rare,
    family: "tekrar", tier: 3, tr: "Eski Dostlar", en: "Old Friends", es: "Viejos amigos",
    descTr: "15 farklı filmi tekrar izle", descEn: "Rewatch 15 different films", descEs: "Vuelve a ver 15 películas distintas",
    target: 15, getProgress: (s) => say(s, "tekrarFilm"),
  }),
  defineWatchBadge({
    id: "tekrar_40", since: S2, section: BOLUM.BAGLILIK, icon: "repeat-outline", iconSolid: "repeat", rarity: RARITY.rare,
    family: "tekrar", tier: 4, tr: "Sonsuz Döngü", en: "Endless Loop", es: "Bucle infinito",
    descTr: "40 farklı filmi tekrar izle", descEn: "Rewatch 40 different films", descEs: "Vuelve a ver 40 películas distintas",
    target: 40, getProgress: (s) => say(s, "tekrarFilm"),
  }),
  // SADAKAT AİLESİ — AYNI dizi için farklı izleme günü. Eskiden tek rozetti
  // (`sadik_izleyici`, 30 gün); id ve hedef AYNI kaldı, 2. kademe oldu.
  // Tek dizinin günlerini saymak toplu işaretlemeyle şişirilemez (markShow tüm
  // bölümlere TEK tarih yazar) — gerçek, gün gün takip ister. Tarih türevi → rare.
  defineWatchBadge({
    id: "sadik_10", since: S2, section: BOLUM.BAGLILIK, icon: "heart-outline", iconSolid: "heart", rarity: RARITY.common,
    family: "sadik", tier: 1, tr: "Sıkı Takipçi", en: "Keen Follower", es: "Seguidor entusiasta",
    descTr: "Aynı diziyi 10 farklı günde izle", descEn: "Watch one series on 10 separate days", descEs: "Ve una misma serie en 10 días distintos",
    target: 10, getProgress: (s) => say(s, "sadikDiziGun"),
  }),
  defineWatchBadge({
    id: "sadik_izleyici", section: BOLUM.BAGLILIK, icon: "heart-outline", iconSolid: "heart", rarity: RARITY.uncommon,
    family: "sadik", tier: 2, tr: "Sadık İzleyici", en: "Loyal Viewer", es: "Espectador fiel",
    descTr: "Aynı diziyi 30 farklı günde izle", descEn: "Watch one series on 30 separate days", descEs: "Ve una misma serie en 30 días distintos",
    target: 30, getProgress: (s) => say(s, "sadikDiziGun"),
  }),
  defineWatchBadge({
    id: "sadik_60", since: S2, section: BOLUM.BAGLILIK, icon: "heart-outline", iconSolid: "heart", rarity: RARITY.rare,
    family: "sadik", tier: 3, tr: "Can Dost", en: "Dear Friend", es: "Amigo del alma",
    descTr: "Aynı diziyi 60 farklı günde izle", descEn: "Watch one series on 60 separate days", descEs: "Ve una misma serie en 60 días distintos",
    target: 60, getProgress: (s) => say(s, "sadikDiziGun"),
  }),
  defineWatchBadge({
    id: "sadik_100", since: S2, section: BOLUM.BAGLILIK, icon: "heart-outline", iconSolid: "heart", rarity: RARITY.rare,
    family: "sadik", tier: 4, tr: "Ömür Boyu Hayran", en: "Lifelong Fan", es: "Fan de por vida",
    descTr: "Aynı diziyi 100 farklı günde izle", descEn: "Watch one series on 100 separate days", descEs: "Ve una misma serie en 100 días distintos",
    target: 100, getProgress: (s) => say(s, "sadikDiziGun"),
  }),

  // ── Türler ────────────────────────────────────────────────────────────────
  defineWatchBadge({
    id: "tur_3", section: BOLUM.TUR, icon: "compass-outline", iconSolid: "compass", rarity: RARITY.common,
    family: "tur", tier: 1, tr: "Tür Denemesi", en: "Genre Sampler", es: "Cata de géneros",
    descTr: "3 farklı türde içerik izle", descEn: "Watch across 3 different genres", descEs: "Ve títulos de 3 géneros distintos",
    target: 3, getProgress: (s) => say(s, "turSayisi"),
  }),
  defineWatchBadge({
    id: "tur_6", section: BOLUM.TUR, icon: "compass-outline", iconSolid: "compass", rarity: RARITY.common,
    family: "tur", tier: 2, tr: "Tür Gezgini", en: "Genre Traveler", es: "Viaje entre géneros",
    descTr: "6 farklı türde içerik izle", descEn: "Watch across 6 different genres", descEs: "Ve títulos de 6 géneros distintos",
    target: 6, getProgress: (s) => say(s, "turSayisi"),
  }),
  defineWatchBadge({
    id: "tur_9", section: BOLUM.TUR, icon: "compass-outline", iconSolid: "compass", rarity: RARITY.uncommon,
    family: "tur", tier: 3, tr: "Tür Kaşifi", en: "Genre Explorer", es: "Exploración de géneros",
    descTr: "9 farklı türde içerik izle", descEn: "Watch across 9 different genres", descEs: "Ve títulos de 9 géneros distintos",
    target: 9, getProgress: (s) => say(s, "turSayisi"),
  }),
  defineWatchBadge({
    id: "tur_12", section: BOLUM.TUR, icon: "compass-outline", iconSolid: "compass", rarity: RARITY.uncommon,
    family: "tur", tier: 4, tr: "Tür Meraklısı", en: "Genre Enthusiast", es: "Pasión por los géneros",
    descTr: "12 farklı türde içerik izle", descEn: "Watch across 12 different genres", descEs: "Ve títulos de 12 géneros distintos",
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
    family: "tur", tier: 5, tr: "Bütün Raflar", en: "Every Shelf", es: "Todas las estanterías",
    descTr: "20 farklı türde içerik izle", descEn: "Watch across 20 different genres", descEs: "Ve títulos de 20 géneros distintos",
    target: 20, getProgress: (s) => say(s, "turSayisi"),
  }),
  defineWatchBadge({
    id: "korku_25", section: BOLUM.TUR, icon: "skull-outline", iconSolid: "skull", rarity: RARITY.uncommon,
    tr: "Karanlık Salon", en: "Dark Theater", es: "Sala a oscuras",
    descTr: "Korku türünde 25 içerik izle", descEn: "Watch 25 horror titles", descEs: "Ve 25 títulos de terror",
    target: 25, getProgress: (s) => turSayisi(s, GENRE.HORROR),
  }),
  defineWatchBadge({
    id: "animasyon_40", section: BOLUM.TUR, icon: "happy-outline", iconSolid: "happy", rarity: RARITY.uncommon,
    tr: "Çizgi Kuşağı", en: "Animation Block", es: "Bloque de animación",
    descTr: "Animasyon türünde 40 içerik izle", descEn: "Watch 40 animated titles", descEs: "Ve 40 títulos de animación",
    target: 40, getProgress: (s) => turSayisi(s, GENRE.ANIMATION),
  }),
  defineWatchBadge({
    id: "belgesel_20", section: BOLUM.TUR, icon: "school-outline", iconSolid: "school", rarity: RARITY.uncommon,
    tr: "Gerçek Payı", en: "Based on Truth", es: "Basado en hechos reales",
    descTr: "Belgesel türünde 20 içerik izle", descEn: "Watch 20 documentaries", descEs: "Ve 20 documentales",
    target: 20, getProgress: (s) => turSayisi(s, GENRE.DOCUMENTARY),
  }),
  defineWatchBadge({
    id: "komedi_75", section: BOLUM.TUR, icon: "cafe-outline", iconSolid: "cafe", rarity: RARITY.rare,
    tr: "Gülme Krizi", en: "Laughing Fit", es: "Ataque de risa",
    descTr: "Komedi türünde 75 içerik izle", descEn: "Watch 75 comedies", descEs: "Ve 75 comedias",
    target: 75, getProgress: (s) => turSayisi(s, GENRE.COMEDY),
  }),
  // ── Tür uzmanlıkları (v2) ──────────────────────────────────────────────────
  // Dört uzmanlık (korku, animasyon, belgesel, komedi) kataloğun yalnız dört zevk
  // grubuna rozet veriyordu; bir bilim kurgu ya da dram izleyicisinin tür
  // sütununda peşinden koşacağı hiçbir şey yoktu. Her biri `turSayaci`ndan okur
  // (yeni sayaç yok, tek-geçiş sözleşmesi korunur) ve eşik, türün gerçekçi
  // hacmine göre seçildi: geniş türler (dram, aksiyon) yüksek, dar türler (savaş,
  // tarih) düşük. Tür sayısı içerikten gelir, izleme tarihinden değil → rare
  // tavanına takılmaz; yine de hepsi uncommon/rare.
  //
  // `set_uzman` (dört tür) ayrı kalır; bu on iki rozet `set_tur_hakimi`nin
  // üyesidir (components/badges/badgeSets.js).
  defineWatchBadge({
    id: "aksiyon_50", since: S2, section: BOLUM.TUR, icon: "car-sport-outline", iconSolid: "car-sport", rarity: RARITY.uncommon,
    tr: "Adrenalin Bağımlısı", en: "Adrenaline Junkie", es: "Adicto a la adrenalina",
    descTr: "Aksiyon türünde 50 içerik izle", descEn: "Watch 50 action titles", descEs: "Ve 50 títulos de acción",
    target: 50, getProgress: (s) => turSayisi(s, GENRE.ACTION),
  }),
  defineWatchBadge({
    id: "macera_30", since: S2, section: BOLUM.TUR, icon: "map-outline", iconSolid: "map", rarity: RARITY.uncommon,
    tr: "Haritasız Yol", en: "Off the Map", es: "Fuera del mapa",
    descTr: "Macera türünde 30 içerik izle", descEn: "Watch 30 adventure titles", descEs: "Ve 30 títulos de aventura",
    target: 30, getProgress: (s) => turSayisi(s, GENRE.ADVENTURE),
  }),
  defineWatchBadge({
    id: "bilimkurgu_30", since: S2, section: BOLUM.TUR, icon: "rocket-outline", iconSolid: "rocket", rarity: RARITY.uncommon,
    tr: "Yıldız Gezgini", en: "Star Voyager", es: "Viajero estelar",
    descTr: "Bilim kurgu türünde 30 içerik izle", descEn: "Watch 30 sci-fi titles", descEs: "Ve 30 títulos de ciencia ficción",
    target: 30, getProgress: (s) => turSayisi(s, GENRE.SCIFI),
  }),
  defineWatchBadge({
    id: "dram_75", since: S2, section: BOLUM.TUR, icon: "water-outline", iconSolid: "water", rarity: RARITY.rare,
    tr: "Derin Duygular", en: "Deep Feelings", es: "Emociones profundas",
    descTr: "Dram türünde 75 içerik izle", descEn: "Watch 75 dramas", descEs: "Ve 75 dramas",
    target: 75, getProgress: (s) => turSayisi(s, GENRE.DRAMA),
  }),
  defineWatchBadge({
    id: "romantik_30", since: S2, section: BOLUM.TUR, icon: "heart-half-outline", iconSolid: "heart-half", rarity: RARITY.uncommon,
    tr: "Kalp Atışı", en: "Heartbeat", es: "Latido",
    descTr: "Romantik türünde 30 içerik izle", descEn: "Watch 30 romance titles", descEs: "Ve 30 títulos románticos",
    target: 30, getProgress: (s) => turSayisi(s, GENRE.ROMANCE),
  }),
  defineWatchBadge({
    id: "gerilim_40", since: S2, section: BOLUM.TUR, icon: "alert-circle-outline", iconSolid: "alert-circle", rarity: RARITY.uncommon,
    tr: "Tırnak Yeme Vakti", en: "Edge of Your Seat", es: "Al borde del asiento",
    descTr: "Gerilim türünde 40 içerik izle", descEn: "Watch 40 thrillers", descEs: "Ve 40 thrillers",
    target: 40, getProgress: (s) => turSayisi(s, GENRE.THRILLER),
  }),
  defineWatchBadge({
    id: "suc_30", since: S2, section: BOLUM.TUR, icon: "finger-print-outline", iconSolid: "finger-print", rarity: RARITY.uncommon,
    tr: "Suç Dosyası", en: "Case File", es: "Expediente criminal",
    descTr: "Suç türünde 30 içerik izle", descEn: "Watch 30 crime titles", descEs: "Ve 30 títulos de crimen",
    target: 30, getProgress: (s) => turSayisi(s, GENRE.CRIME),
  }),
  defineWatchBadge({
    id: "fantastik_30", since: S2, section: BOLUM.TUR, icon: "color-wand-outline", iconSolid: "color-wand", rarity: RARITY.uncommon,
    tr: "Büyülü Diyar", en: "Enchanted Realm", es: "Reino encantado",
    descTr: "Fantastik türünde 30 içerik izle", descEn: "Watch 30 fantasy titles", descEs: "Ve 30 títulos de fantasía",
    target: 30, getProgress: (s) => turSayisi(s, GENRE.FANTASY),
  }),
  defineWatchBadge({
    id: "gizem_20", since: S2, section: BOLUM.TUR, icon: "search-outline", iconSolid: "search", rarity: RARITY.uncommon,
    tr: "Katil Kim?", en: "Whodunit", es: "¿Quién fue?",
    descTr: "Gizem türünde 20 içerik izle", descEn: "Watch 20 mystery titles", descEs: "Ve 20 títulos de misterio",
    target: 20, getProgress: (s) => turSayisi(s, GENRE.MYSTERY),
  }),
  defineWatchBadge({
    id: "aile_30", since: S2, section: BOLUM.TUR, icon: "people-outline", iconSolid: "people", rarity: RARITY.uncommon,
    tr: "Aile Boyu", en: "Family Night", es: "Noche en familia",
    descTr: "Aile türünde 30 içerik izle", descEn: "Watch 30 family titles", descEs: "Ve 30 títulos familiares",
    target: 30, getProgress: (s) => turSayisi(s, GENRE.FAMILY),
  }),
  defineWatchBadge({
    id: "tarih_15", since: S2, section: BOLUM.TUR, icon: "newspaper-outline", iconSolid: "newspaper", rarity: RARITY.uncommon,
    tr: "Zaman Yolcusu", en: "Time Traveler", es: "Viajero del tiempo",
    descTr: "Tarih türünde 15 içerik izle", descEn: "Watch 15 history titles", descEs: "Ve 15 títulos de historia",
    target: 15, getProgress: (s) => turSayisi(s, GENRE.HISTORY),
  }),
  defineWatchBadge({
    id: "savas_12", since: S2, section: BOLUM.TUR, icon: "shield-outline", iconSolid: "shield", rarity: RARITY.uncommon,
    tr: "Cephe Hattı", en: "Front Line", es: "Primera línea",
    descTr: "Savaş türünde 12 içerik izle", descEn: "Watch 12 war titles", descEs: "Ve 12 títulos de guerra",
    target: 12, getProgress: (s) => turSayisi(s, GENRE.WAR),
  }),

  // ── Mevsimsel ─────────────────────────────────────────────────────────────
  defineWatchBadge({
    id: "cadilar_gecesi", section: BOLUM.MEVSIM, icon: "moon-outline", iconSolid: "moon", rarity: RARITY.uncommon,
    tr: "Kabuslar Gecesi", en: "Night of Nightmares", es: "Noche de pesadillas",
    descTr: "31 Ekim'de bir korku içeriği işaretle", descEn: "Mark a horror title on October 31", descEs: "Marca un título de terror el 31 de octubre",
    target: 1, getProgress: (s) => say(s, "cadilar"),
  }),
  defineWatchBadge({
    id: "yil_devrilirken", section: BOLUM.MEVSIM, icon: "gift-outline", iconSolid: "gift", rarity: RARITY.uncommon,
    tr: "Yıl Devrilirken", en: "Turn of the Year", es: "Cambio de año",
    descTr: "31 Aralık ya da 1 Ocak'ta izleme yap", descEn: "Watch on December 31 or January 1", descEs: "Ve algo el 31 de diciembre o el 1 de enero",
    target: 1, getProgress: (s) => say(s, "yilDevri"),
  }),
  defineWatchBadge({
    id: "kirmizi_perde", section: BOLUM.MEVSIM, icon: "rose-outline", iconSolid: "rose", rarity: RARITY.uncommon,
    tr: "Kırmızı Perde", en: "Red Curtain", es: "Telón rojo",
    descTr: "14 Şubat'ta bir romantik içerik işaretle", descEn: "Mark a romance title on February 14", descEs: "Marca un título romántico el 14 de febrero",
    target: 1, getProgress: (s) => say(s, "sevgililer"),
  }),
  // Mevsimsel hedefler GÜN sayar, bölüm değil (utils/watchScoring.js).
  // markShow tüm bölümlere tek tarih yazdığı için bölüm saymak bu rozetleri
  // tek dokunuşluk yapıyordu; metinler de ölçtükleri şeyi söylüyor artık.
  defineWatchBadge({
    id: "yaz_sezonu", section: BOLUM.MEVSIM, icon: "sunny-outline", iconSolid: "sunny", rarity: RARITY.rare,
    tr: "Yaz Sezonu", en: "Summer Season", es: "Temporada de verano",
    descTr: "Haziran-Ağustos arasında 40 farklı günde izle", descEn: "Watch on 40 separate days between June and August", descEs: "Ve algo en 40 días distintos entre junio y agosto",
    target: 40, getProgress: (s) => say(s, "yazGun"),
  }),
  defineWatchBadge({
    id: "kis_kampi", section: BOLUM.MEVSIM, icon: "snow-outline", iconSolid: "snow", rarity: RARITY.uncommon,
    tr: "Kış Kampı", en: "Winter Camp", es: "Campamento de invierno",
    descTr: "Aralık-Şubat arasında 20 farklı günde izle", descEn: "Watch on 20 separate days between December and February", descEs: "Ve algo en 20 días distintos entre diciembre y febrero",
    target: 20, getProgress: (s) => say(s, "kisGun"),
  }),
  // ── Mevsimsel (v2) ─────────────────────────────────────────────────────────
  // Yaz/kış sezonlarının eksik yarısı (ilkbahar, sonbahar) ve üç yeni TAKVİM
  // OLAYI. Takvim olayları kataloğun en "yaşayan" rozetleridir: yılda bir kez
  // gelen bir gün, kullanıcıya "o güne ne işaretleyeyim" diye plan yaptırır.
  // Ekran bunlara yaklaşırken geri sayım gösterir (badgeInsights.takvimFirsatlari).
  // Hepsi izleme tarihinden türer → rare tavanı.
  defineWatchBadge({
    id: "bahar_esintisi", since: S2, section: BOLUM.MEVSIM, icon: "flower-outline", iconSolid: "flower", rarity: RARITY.uncommon,
    tr: "Bahar Esintisi", en: "Spring Breeze", es: "Brisa primaveral",
    descTr: "Mart-Mayıs arasında 25 farklı günde izle", descEn: "Watch on 25 separate days between March and May", descEs: "Ve algo en 25 días distintos entre marzo y mayo",
    target: 25, getProgress: (s) => say(s, "ilkbaharGun"),
  }),
  defineWatchBadge({
    id: "sonbahar_yapragi", since: S2, section: BOLUM.MEVSIM, icon: "rainy-outline", iconSolid: "rainy", rarity: RARITY.uncommon,
    tr: "Sonbahar Yaprağı", en: "Autumn Leaf", es: "Hoja de otoño",
    descTr: "Eylül-Kasım arasında 25 farklı günde izle", descEn: "Watch on 25 separate days between September and November", descEs: "Ve algo en 25 días distintos entre septiembre y noviembre",
    target: 25, getProgress: (s) => say(s, "sonbaharGun"),
  }),
  defineWatchBadge({
    id: "cuma_13", since: S2, section: BOLUM.MEVSIM, icon: "warning-outline", iconSolid: "warning", rarity: RARITY.rare,
    tr: "Uğursuz Cuma", en: "Friday the 13th", es: "Viernes 13",
    descTr: "Cuma 13'ünde bir korku içeriği işaretle", descEn: "Mark a horror title on a Friday the 13th", descEs: "Marca un título de terror un viernes 13",
    target: 1, getProgress: (s) => say(s, "cuma13"),
  }),
  defineWatchBadge({
    id: "mayis_4", since: S2, section: BOLUM.MEVSIM, icon: "telescope-outline", iconSolid: "telescope", rarity: RARITY.uncommon,
    tr: "Güç Seninle Olsun", en: "May the Fourth", es: "Que la fuerza te acompañe",
    descTr: "4 Mayıs'ta bir bilim kurgu içeriği işaretle", descEn: "Mark a sci-fi title on May 4", descEs: "Marca un título de ciencia ficción el 4 de mayo",
    target: 1, getProgress: (s) => say(s, "mayis4"),
  }),
  defineWatchBadge({
    id: "nisan_1", since: S2, section: BOLUM.MEVSIM, icon: "balloon-outline", iconSolid: "balloon", rarity: RARITY.uncommon,
    tr: "Bir Nisan Şakası", en: "April Fools' Laugh", es: "Inocentada de abril",
    descTr: "1 Nisan'da bir komedi işaretle", descEn: "Mark a comedy on April 1", descEs: "Marca una comedia el 1 de abril",
    target: 1, getProgress: (s) => say(s, "nisan1"),
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
    family: "yil", tier: 1, tr: "İlk Yıl", en: "First Year", es: "Primer año",
    descTr: "Seelogd'da 1 yılını doldur", descEn: "Complete 1 year on Seelogd", descEs: "Cumple 1 año en Seelogd",
    target: 1, getProgress: (s) => say(s, "hesapYili"),
  }),
  defineWatchBadge({
    id: "yil_2", section: BOLUM.KIDEM, icon: "medal-outline", iconSolid: "medal", rarity: RARITY.rare,
    family: "yil", tier: 2, tr: "İkinci Sezon", en: "Second Season", es: "Segunda temporada",
    descTr: "Seelogd'da 2 yılını doldur", descEn: "Complete 2 years on Seelogd", descEs: "Cumple 2 años en Seelogd",
    target: 2, getProgress: (s) => say(s, "hesapYili"),
  }),
  defineWatchBadge({
    id: "yil_3", section: BOLUM.KIDEM, icon: "medal-outline", iconSolid: "medal", rarity: RARITY.rare,
    family: "yil", tier: 3, tr: "Eski Tüfek", en: "Old Timer", es: "De la vieja guardia",
    descTr: "Seelogd'da 3 yılını doldur", descEn: "Complete 3 years on Seelogd", descEs: "Cumple 3 años en Seelogd",
    target: 3, getProgress: (s) => say(s, "hesapYili"),
  }),
  defineWatchBadge({
    id: "yil_5", section: BOLUM.KIDEM, icon: "medal-outline", iconSolid: "medal", rarity: RARITY.epic,
    family: "yil", tier: 4, tr: "Demirbaş", en: "Fixture", es: "Imprescindible",
    descTr: "Seelogd'da 5 yılını doldur", descEn: "Complete 5 years on Seelogd", descEs: "Cumple 5 años en Seelogd",
    target: 5, getProgress: (s) => say(s, "hesapYili"),
  }),
  defineWatchBadge({
    id: "yil_10", section: BOLUM.KIDEM, icon: "medal-outline", iconSolid: "medal", rarity: RARITY.epic,
    family: "yil", tier: 5, tr: "Onuncu Yıl", en: "Tenth Year", es: "Décimo año",
    descTr: "Seelogd'da 10 yılını doldur", descEn: "Complete 10 years on Seelogd", descEs: "Cumple 10 años en Seelogd",
    target: 10, getProgress: (s) => say(s, "hesapYili"),
  }),

  // ── Perde ─────────────────────────────────────────────────────────────────
  // ARA BASAMAKLAR (v2). Aile 5 kademe tavanında (4-8-14-17-20); aradaki
  // çöller büyüktü: Perde 8 (10.000 Kare) ile Perde 14 (40.000) arasında altı
  // seviye boyunca hiçbir rozet yoktu. Üç tekil rozet bu boşlukları kapatır,
  // adları Perde'nin KENDİ adlarıdır (PERDE_ADLARI): rozet "Perde 11" demez,
  // "Arşivci" der — o seviyenin kimliğini. Ailenin kademe şeklini bozmamak için
  // aileye girmezler. Perde'ye bağlı olduğu için tarih tavanına tabi değil
  // (Kare'nin tarih bileşeni zaten RITIM_TAVAN ile sınırlı).
  defineWatchBadge({
    id: "perde_3", since: S2, section: BOLUM.PERDE, icon: "trending-up-outline", iconSolid: "trending-up", rarity: RARITY.common,
    tr: "Seans Takipçisi", en: "Showtime Follower", es: "Fan de las sesiones",
    descTr: "Perde 3'e ulaş", descEn: "Reach Act 3", descEs: "Llega al acto 3",
    target: 3, getProgress: (s) => say(s, "perde"),
  }),
  defineWatchBadge({
    id: "perde_6", since: S2, section: BOLUM.PERDE, icon: "trending-up-outline", iconSolid: "trending-up", rarity: RARITY.uncommon,
    tr: "Sezon Takipçisi", en: "Season Follower", es: "Fiel a las temporadas",
    descTr: "Perde 6'ya ulaş", descEn: "Reach Act 6", descEs: "Llega al acto 6",
    target: 6, getProgress: (s) => say(s, "perde"),
  }),
  defineWatchBadge({
    id: "perde_11", since: S2, section: BOLUM.PERDE, icon: "trending-up-outline", iconSolid: "trending-up", rarity: RARITY.rare,
    tr: "Arşivci", en: "Archivist", es: "Archivero",
    descTr: "Perde 11'e ulaş", descEn: "Reach Act 11", descEs: "Llega al acto 11",
    target: 11, getProgress: (s) => say(s, "perde"),
  }),
  defineWatchBadge({
    id: "perde_4", section: BOLUM.PERDE, icon: "trending-up-outline", iconSolid: "trending-up", rarity: RARITY.common,
    family: "perde", tier: 1, tr: "Perde 4", en: "Act 4", es: "Acto 4",
    descTr: "Perde 4'e ulaş", descEn: "Reach Act 4", descEs: "Llega al acto 4",
    target: 4, getProgress: (s) => say(s, "perde"),
  }),
  defineWatchBadge({
    id: "perde_8", section: BOLUM.PERDE, icon: "trending-up-outline", iconSolid: "trending-up", rarity: RARITY.uncommon,
    family: "perde", tier: 2, tr: "Perde 8", en: "Act 8", es: "Acto 8",
    descTr: "Perde 8'e ulaş", descEn: "Reach Act 8", descEs: "Llega al acto 8",
    target: 8, getProgress: (s) => say(s, "perde"),
  }),
  // perde_14 epic'ten rare'e indi: aile 5 kademeye çıkınca arasına perde_17
  // girdi ve merdivenin monoton kalması gerekiyor (c → u → r → e → l).
  // Nadirlik kozmetiktir, defteri etkilemez — kazanılmış rozet kaymaz.
  defineWatchBadge({
    id: "perde_14", section: BOLUM.PERDE, icon: "trending-up-outline", iconSolid: "trending-up", rarity: RARITY.rare,
    family: "perde", tier: 3, tr: "Perde 14", en: "Act 14", es: "Acto 14",
    descTr: "Perde 14'e ulaş", descEn: "Reach Act 14", descEs: "Llega al acto 14",
    target: 14, getProgress: (s) => say(s, "perde"),
  }),
  defineWatchBadge({
    id: "perde_17", section: BOLUM.PERDE, icon: "trending-up-outline", iconSolid: "trending-up", rarity: RARITY.epic,
    family: "perde", tier: 4, tr: "Perde 17", en: "Act 17", es: "Acto 17",
    descTr: "Perde 17'ye ulaş", descEn: "Reach Act 17", descEs: "Llega al acto 17",
    target: 17, getProgress: (s) => say(s, "perde"),
  }),
  defineWatchBadge({
    id: "perde_20", section: BOLUM.PERDE, icon: "trophy-outline", iconSolid: "trophy", rarity: RARITY.legendary,
    family: "perde", tier: 5, tr: "Beyazperde Efsanesi", en: "Silver Screen Legend", es: "Leyenda de la gran pantalla",
    descTr: "Perde 20'ye ulaş", descEn: "Reach Act 20", descEs: "Llega al acto 20",
    target: 20, getProgress: (s) => say(s, "perde"),
  }),
  defineWatchBadge({
    id: "cift_kariyer", section: BOLUM.PERDE, icon: "sparkles-outline", iconSolid: "sparkles", rarity: RARITY.rare,
    tr: "Çift Kariyer", en: "Double Career", es: "Doble carrera",
    descTr: "Perde 10 ve oyun Seviye 10'a birlikte ulaş", descEn: "Reach Act 10 and game Level 10 together", descEs: "Llega al acto 10 y al nivel 10 de juego a la vez",
    // Oyun XP'si ile izleme puanı arasındaki TEK köprü. Para birimleri arasında
    // dönüşüm yoktur; bu rozet yalnızca ikisinin birlikte yapıldığını işaretler.
    target: 1, getProgress: (s) => (say(s, "perde") >= 10 && say(s, "oyunSeviye") >= 10 ? 1 : 0),
  }),

  // ── Gizli ─────────────────────────────────────────────────────────────────
  defineWatchBadge({
    id: "gizli_cift_perde", section: BOLUM.GIZLI, hidden: true,
    icon: "aperture-outline", iconSolid: "aperture", rarity: RARITY.rare,
    tr: "Çift Perde", en: "Double Bill", es: "Sesión doble",
    descTr: "Aynı gün 1 film ve 5 bölüm işaretle", descEn: "Mark 1 film and 5 episodes on the same day", descEs: "Marca 1 película y 5 episodios el mismo día",
    target: 1, getProgress: (s) => say(s, "ciftPerde"),
  }),
  defineWatchBadge({
    id: "gizli_vitrin", section: BOLUM.GIZLI, hidden: true,
    icon: "star-outline", iconSolid: "star", rarity: RARITY.rare,
    tr: "Vitrin", en: "Showcase", es: "Escaparate",
    descTr: "TMDB puanı 9 üstü 25 bölüm izle", descEn: "Watch 25 episodes rated above 9 on TMDB", descEs: "Ve 25 episodios con una puntuación superior a 9 en TMDB",
    target: 25, getProgress: (s) => say(s, "yuksekPuanliBolum"),
  }),
  defineWatchBadge({
    id: "gizli_alfabe", section: BOLUM.GIZLI, hidden: true,
    icon: "library-outline", iconSolid: "library", rarity: RARITY.rare,
    tr: "A'dan Z'ye", en: "A to Z", es: "De la A a la Z",
    descTr: "18 farklı harfle başlayan içerik izle", descEn: "Watch titles starting with 18 different letters", descEs: "Ve títulos que empiecen por 18 letras distintas",
    target: 18, getProgress: (s) => say(s, "harfSayisi"),
  }),
  defineWatchBadge({
    id: "gizli_geri_donus", section: BOLUM.GIZLI, hidden: true,
    icon: "refresh-outline", iconSolid: "refresh", rarity: RARITY.uncommon,
    tr: "Geri Dönüş", en: "The Return", es: "El regreso",
    descTr: "60 gün ara verdikten sonra tekrar işaretle", descEn: "Come back after a 60-day break", descEs: "Vuelve tras una pausa de 60 días",
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
    tr: "Çift Dünya", en: "Both Worlds", es: "Los dos mundos",
    // Katalogdaki her zirve tek bir izleme biçimini ödüllendirir: film_2000'i
    // sadece-dizi izleyen, bolum_10000'i sadece-film izleyen asla alamaz. Bu
    // rozet tam tersini yapar — İKİSİNİ BİRDEN yapanı işaretler.
    descTr: "250 film ve 1000 bölümü birlikte tamamla",
    descEn: "Reach 250 films and 1000 episodes together", descEs: "Alcanza 250 películas y 1000 episodios a la vez",
    target: 1,
    getProgress: (s) => (say(s, "filmSayisi") >= 250 && say(s, "bolumSayisi") >= 1000 ? 1 : 0),
  }),
  defineWatchBadge({
    id: "gizli_uc_gece", section: BOLUM.GIZLI, hidden: true,
    icon: "sparkles-outline", iconSolid: "sparkles", rarity: RARITY.rare,
    tr: "Üç Özel Gece", en: "Three Special Nights", es: "Tres noches especiales",
    // Üç mevsimsel rozetin META'sı: 31 Ekim + yılbaşı + 14 Şubat. Üçü aynı yıla
    // sığmaz zorunlu değil ama en az bir tam yıl boyunca uygulamada olmayı
    // gerektirir — takvim uydurulabilir, sabır uydurulamaz.
    descTr: "Cadılar, yılbaşı ve Sevgililer gecelerinin üçünü de yakala",
    descEn: "Catch Halloween, New Year and Valentine's nights", descEs: "Ve algo en Halloween, Nochevieja y San Valentín",
    target: 3,
    getProgress: (s) =>
      Math.min(1, say(s, "cadilar")) +
      Math.min(1, say(s, "yilDevri")) +
      Math.min(1, say(s, "sevgililer")),
  }),
  defineWatchBadge({
    id: "gizli_dort_mevsim", section: BOLUM.GIZLI, hidden: true,
    icon: "leaf-outline", iconSolid: "leaf", rarity: RARITY.uncommon,
    tr: "Dört Mevsim", en: "Four Seasons", es: "Cuatro estaciones",
    // Yaz ve kış rozetlerinin ikisini birden ister ama eşikleri düşük tutar:
    // amaç zirve değil, "yılın her mevsiminde buradaydın" duygusu.
    descTr: "Hem yazın hem kışın 10'ar günde izleme yap",
    descEn: "Watch on 10 summer days and 10 winter days", descEs: "Ve algo en 10 días de verano y 10 de invierno",
    target: 1,
    getProgress: (s) => (say(s, "yazGun") >= 10 && say(s, "kisGun") >= 10 ? 1 : 0),
  }),
  defineWatchBadge({
    id: "gizli_alfabe_tam", section: BOLUM.GIZLI, hidden: true,
    icon: "text-outline", iconSolid: "text", rarity: RARITY.rare,
    tr: "Alfabe Tamam", en: "Full Alphabet", es: "Alfabeto completo",
    // gizli_alfabe'nin (18 harf) üstü. Son harfler tesadüfen gelmez: X, Q, W
    // ya da Ö/Ü ile başlayan bir yapım BİLEREK aranır. Rozetin tamamı bu
    // kasıtlı arama anını ödüllendirir.
    descTr: "24 farklı harfle başlayan içerik izle",
    descEn: "Watch titles starting with 24 different letters", descEs: "Ve títulos que empiecen por 24 letras distintas",
    target: 24, getProgress: (s) => say(s, "harfSayisi"),
  }),
  defineWatchBadge({
    id: "gizli_yol_arkadasi", section: BOLUM.GIZLI, hidden: true,
    icon: "walk-outline", iconSolid: "walk", rarity: RARITY.uncommon,
    tr: "Yol Arkadaşı", en: "Companion", es: "Compañía fiel",
    // Kıdem (sunucu tarihli) + gerçek kullanım (gün sayısı) birlikte: sadece
    // hesabı açık tutan da, bir hafta yoğun kullanıp bırakan da alamaz.
    // Tarih türevi bileşeni olduğu için rare tavanının altında kalır.
    descTr: "2 yılı doldur ve 200 farklı günde işaretle",
    descEn: "Complete 2 years and log on 200 separate days", descEs: "Cumple 2 años y registra visionados en 200 días distintos",
    target: 1,
    getProgress: (s) => (say(s, "hesapYili") >= 2 && say(s, "gunSayisi") >= 200 ? 1 : 0),
  }),

  // ── Gizli (v2): "tarzını" keşfeden rozetler ─────────────────────────────────
  // Altısı da mevcut ya da v2'de eklenen `stats` alanlarından okur. Ortak noktaları
  // ilk beşinkiyle aynı: hiçbiri tek bir sayaçla DEĞİL, bir izleme KİŞİLİĞİYLE
  // açılır (tek filmi beş kez, iki ekranı birden, tek türe adanmışlık…).
  defineWatchBadge({
    id: "gizli_basucu", since: S2, section: BOLUM.GIZLI, hidden: true,
    icon: "bookmark-outline", iconSolid: "bookmark", rarity: RARITY.uncommon,
    tr: "Başucu Filmi", en: "Bedside Film", es: "Peli de cabecera",
    descTr: "Aynı filmi 5 kez izle", descEn: "Watch the same film 5 times", descEs: "Ve la misma película 5 veces",
    target: 5, getProgress: (s) => say(s, "enCokTekrar"),
  }),
  defineWatchBadge({
    id: "gizli_iki_ekran", since: S2, section: BOLUM.GIZLI, hidden: true,
    icon: "contrast-outline", iconSolid: "contrast", rarity: RARITY.uncommon,
    tr: "İki Ekran", en: "Two Screens", es: "Dos pantallas",
    // "Çift Dünya"nın (250 film + 1.000 bölüm) erişilebilir ilk yarısı: iki izleme
    // biçimini birden yapan kullanıcı, ağır eşiğe varmadan da bir şey kazanır.
    descTr: "25 film ve 100 bölümü birlikte tamamla",
    descEn: "Reach 25 films and 100 episodes together", descEs: "Alcanza 25 películas y 100 episodios a la vez",
    target: 1,
    getProgress: (s) => (say(s, "filmSayisi") >= 25 && say(s, "bolumSayisi") >= 100 ? 1 : 0),
  }),
  defineWatchBadge({
    id: "gizli_cok_yonlu", since: S2, section: BOLUM.GIZLI, hidden: true,
    icon: "shapes-outline", iconSolid: "shapes", rarity: RARITY.rare,
    tr: "Çok Yönlü", en: "All-Rounder", es: "Todoterreno",
    // `tur_*` ailesi KAÇ farklı türe uğradığını sayar (1 içerik yeter); bu rozet
    // tersine derinliği ister: altı türde de en az 10'ar içerik.
    descTr: "6 farklı türde en az 10'ar içerik izle",
    descEn: "Watch at least 10 titles in each of 6 genres", descEs: "Ve al menos 10 títulos en cada uno de 6 géneros",
    target: 6, getProgress: (s) => say(s, "tur10"),
  }),
  defineWatchBadge({
    id: "gizli_tur_bagimlisi", since: S2, section: BOLUM.GIZLI, hidden: true,
    icon: "pricetag-outline", iconSolid: "pricetag", rarity: RARITY.rare,
    tr: "Tür Bağımlısı", en: "Genre Devotee", es: "Devoto del género",
    descTr: "Tek bir türde 100 içerik izle", descEn: "Watch 100 titles in a single genre", descEs: "Ve 100 títulos de un solo género",
    target: 100, getProgress: (s) => say(s, "enCokTur"),
  }),
  defineWatchBadge({
    id: "gizli_kis_uykusu", since: S2, section: BOLUM.GIZLI, hidden: true,
    icon: "bed-outline", iconSolid: "bed", rarity: RARITY.rare,
    tr: "Kış Uykusu", en: "Hibernation", es: "Hibernación",
    // `gizli_geri_donus`un (60 gün) büyük kardeşi. Tarih türevi → rare tavanı.
    descTr: "180 gün ara verdikten sonra geri dön", descEn: "Come back after a 180-day break", descEs: "Vuelve tras una pausa de 180 días",
    target: 180, getProgress: (s) => say(s, "enUzunAra"),
  }),
  defineWatchBadge({
    id: "gizli_altin_koleksiyon", since: S2, section: BOLUM.GIZLI, hidden: true,
    icon: "star-half-outline", iconSolid: "star-half", rarity: RARITY.epic,
    tr: "Altın Koleksiyon", en: "Gold Collection", es: "Colección dorada",
    // `gizli_vitrin`in (25 bölüm) dört katı. TMDB puanı içerikten gelir, izleme
    // tarihinden değil → epic olabilir; 100 bölüm 9 üstü puanlı yapım izlemek
    // gerçekten az bulunan bir zevk.
    descTr: "TMDB puanı 9 üstü 100 bölüm izle", descEn: "Watch 100 episodes rated above 9 on TMDB", descEs: "Ve 100 episodios con una puntuación superior a 9 en TMDB",
    target: 100, getProgress: (s) => say(s, "yuksekPuanliBolum"),
  }),

  // ── Keşif ─────────────────────────────────────────────────────────────────
  // İZLEME DIŞI ÖZELLİKLERİ ilk kez kullanınca açılır. Amaç ödül değil KEŞİF: hiç
  // hatırlatıcı kurmamış kullanıcı, kilitli "Aklında Olsun"u görür ve o özelliğin var
  // olduğunu öğrenir. Hepsi common/uncommon, hepsi hedef 1 (dört favori hariç: 4 yuva),
  // hepsi Free planda kazanılabilir ve Free sınırının altında (4. kural).
  //
  // KATALOG DİZİSİNDE SONDA: "Sıradaki hedefler" rafı eşit orandaki hedeflerde giriş
  // sırasına bakıyor — izleme rozetleri öne geçsin. Ekrandaki yeri BOLUM_SIRA belirler.
  //
  // Her rozetin `kaynak`ı, ilerlemesini okuduğu veri kaynağıdır. Kaynak yüklenmeden
  // id deftere "bilinen" yazılmaz (bilinenRozetIdleri), yoksa kaynak geldiğinde
  // yıllardır not tutan kullanıcıya "İlk Not" konfetisi yağardı.
  defineWatchBadge({
    id: "kesif_ilk_not", since: S3, section: BOLUM.KESIF, kaynak: KESIF_KAYNAK.NOTLAR,
    icon: "create-outline", iconSolid: "create", rarity: RARITY.common,
    tr: "Kenar Notu", en: "Margin Note", es: "Nota al margen",
    descTr: "İlk notunu yaz", descEn: "Write your first note", descEs: "Escribe tu primera nota",
    target: 1, getProgress: (s) => kesifSay(s, "not"),
  }),
  defineWatchBadge({
    id: "kesif_yapilacaklar", since: S3, section: BOLUM.KESIF, kaynak: KESIF_KAYNAK.NOTLAR,
    icon: "checkbox-outline", iconSolid: "checkbox", rarity: RARITY.common,
    tr: "Madde Madde", en: "Item by Item", es: "Punto por punto",
    descTr: "İlk yapılacaklar listeni oluştur", descEn: "Create your first to-do list", descEs: "Crea tu primera lista de tareas",
    target: 1, getProgress: (s) => kesifSay(s, "yapilacak"),
  }),
  defineWatchBadge({
    id: "kesif_medya_notu", since: S3, section: BOLUM.KESIF, kaynak: KESIF_KAYNAK.MEDYA_NOTLARI,
    icon: "chatbox-ellipses-outline", iconSolid: "chatbox-ellipses", rarity: RARITY.common,
    tr: "Eleştirmen Adayı", en: "Budding Critic", es: "Crítico en ciernes",
    descTr: "Bir film ya da dizi için not yaz", descEn: "Write a note about a film or show", descEs: "Escribe una nota sobre una película o serie",
    target: 1, getProgress: (s) => kesifSay(s, "medyaNotu"),
  }),
  defineWatchBadge({
    id: "kesif_ozel_liste", since: S3, section: BOLUM.KESIF, kaynak: KESIF_KAYNAK.LISTELER,
    icon: "albums-outline", iconSolid: "albums", rarity: RARITY.common,
    tr: "Kendi Rafın", en: "Your Own Shelf", es: "Tu propio estante",
    descTr: "İlk özel listeni oluştur", descEn: "Create your first custom list", descEs: "Crea tu primera lista personalizada",
    target: 1, getProgress: (s) => kesifSay(s, "ozelListe"),
  }),
  defineWatchBadge({
    id: "kesif_favori", since: S3, section: BOLUM.KESIF, kaynak: KESIF_KAYNAK.LISTELER,
    icon: "heart-outline", iconSolid: "heart", rarity: RARITY.common,
    tr: "İlk Göz Ağrısı", en: "First Crush", es: "Primer flechazo",
    descTr: "Bir yapımı favorilerine ekle", descEn: "Add a title to your favorites", descEs: "Añade un título a tus favoritos",
    target: 1, getProgress: (s) => kesifSay(s, "favori"),
  }),
  defineWatchBadge({
    id: "kesif_izleme_listesi", since: S3, section: BOLUM.KESIF, kaynak: KESIF_KAYNAK.LISTELER,
    icon: "list-outline", iconSolid: "list", rarity: RARITY.common,
    tr: "Kuyruğa Giren", en: "In the Queue", es: "En la cola",
    descTr: "Bir yapımı izleme listene ekle", descEn: "Add a title to your watchlist", descEs: "Añade un título a tu lista de seguimiento",
    target: 1, getProgress: (s) => kesifSay(s, "izlemeListesi"),
  }),
  defineWatchBadge({
    id: "kesif_hatirlatici", since: S3, section: BOLUM.KESIF, kaynak: KESIF_KAYNAK.HATIRLATICILAR,
    icon: "notifications-outline", iconSolid: "notifications", rarity: RARITY.common,
    tr: "Aklında Olsun", en: "Remind Me", es: "Avísame",
    descTr: "İlk hatırlatıcını kur", descEn: "Set your first reminder", descEs: "Crea tu primer recordatorio",
    target: 1, getProgress: (s) => kesifSay(s, "hatirlatici"),
  }),
  defineWatchBadge({
    id: "kesif_ortak_liste", since: S3, section: BOLUM.KESIF, kaynak: KESIF_KAYNAK.ORTAK_LISTELER,
    icon: "people-outline", iconSolid: "people", rarity: RARITY.uncommon,
    tr: "Birlikte Seçtik", en: "Picked Together", es: "Elegido juntos",
    // Kurmak ya da katılmak: katılmak Free'de de serbest, davet eden birinin olması gerekir.
    descTr: "Bir ortak liste kur ya da bir listeye katıl", descEn: "Create or join a shared list", descEs: "Crea una lista compartida o únete a una",
    target: 1, getProgress: (s) => kesifSay(s, "ortakListe"),
  }),
  defineWatchBadge({
    id: "kesif_arkadas", since: S3, section: BOLUM.KESIF, kaynak: KESIF_KAYNAK.ARKADASLAR,
    icon: "person-add-outline", iconSolid: "person-add", rarity: RARITY.uncommon,
    tr: "İlk Dost", en: "First Friend", es: "Primer amigo",
    descTr: "İlk arkadaşını ekle", descEn: "Add your first friend", descEs: "Añade a tu primer amigo",
    target: 1, getProgress: (s) => kesifSay(s, "arkadas"),
  }),
  defineWatchBadge({
    id: "kesif_paylasim", since: S3, section: BOLUM.KESIF, kaynak: KESIF_KAYNAK.PROFIL,
    icon: "megaphone-outline", iconSolid: "megaphone", rarity: RARITY.uncommon,
    tr: "Sesini Duyur", en: "Speak Up", es: "Alza la voz",
    descTr: "İlk gönderini paylaş", descEn: "Share your first post", descEs: "Comparte tu primera publicación",
    target: 1, getProgress: (s) => kesifSay(s, "gonderi"),
  }),
  defineWatchBadge({
    id: "kesif_dort_favori", since: S3, section: BOLUM.KESIF, kaynak: KESIF_KAYNAK.PROFIL,
    icon: "star-outline", iconSolid: "star", rarity: RARITY.common,
    tr: "Dörtlü Vitrin", en: "Fab Four", es: "Los cuatro fantásticos",
    // "Favoriler" listesi (kalp) ile KARIŞMASIN: bu, profilde sergilenen küratörlü
    // vitrin (utils/fourFavorites.js). Film + dizi + oyuncu toplamı sayılır.
    descTr: "Profiline dört favori ekle", descEn: "Add four favorites to your profile", descEs: "Añade cuatro favoritos a tu perfil",
    target: 4, getProgress: (s) => kesifSay(s, "dortFavori"),
  }),
  defineWatchBadge({
    id: "kesif_biyografi", since: S3, section: BOLUM.KESIF, kaynak: KESIF_KAYNAK.PROFIL,
    icon: "id-card-outline", iconSolid: "id-card", rarity: RARITY.common,
    tr: "Kendini Tanıt", en: "Introduce Yourself", es: "Preséntate",
    // Profil FOTOĞRAFI yerine: Google/Apple girişte fotoğraf kullanıcı bir şey yapmadan
    // dolar, kayıtta avatar rastgele atanır — "kullanıcı yaptı" sinyali güvenilmez.
    // Biyografi varsayılan boştur ve yalnız elle yazılır.
    descTr: "Profiline kısa bir tanıtım yaz", descEn: "Write a short bio on your profile", descEs: "Escribe una breve biografía en tu perfil",
    target: 1, getProgress: (s) => kesifSay(s, "biyografi"),
  }),
  defineWatchBadge({
    id: "kesif_cinematch", since: S3, section: BOLUM.KESIF, kaynak: KESIF_KAYNAK.YAPAY_ZEKA,
    icon: "sparkles-outline", iconSolid: "sparkles", rarity: RARITY.common,
    tr: "CineMatch ile Tanış", en: "Meet CineMatch", es: "Conoce a CineMatch",
    descTr: "CineMatch ile ilk sohbetini yap", descEn: "Have your first chat with CineMatch", descEs: "Ten tu primera conversación con CineMatch",
    target: 1, getProgress: (s) => kesifSay(s, "cineMatch"),
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

/**
 * Defterin `known` listesine YAZILACAK id'ler: katalogun tamamı, AMA kaynağı henüz
 * yüklenmemiş Keşif rozetleri hariç.
 *
 * Neden: defter "ilk kez gördüğü + o an hak ettiği" id'yi sessizce sahiplenir,
 * "gördüğü + hak etmediği" id'yi `known`a yazıp ileride kazanırsa KUTLAR. Not motoru,
 * arkadaş dinleyicisi ya da liste haritaları henüz yüklenmemişken Keşif rozeti
 * "hak edilmedi" görünür; id `known`a girerse kaynak yüklendiğinde 3 yıldır not tutan
 * kullanıcıya "İlk Not" konfetisi yağar. Hazır olmayan kaynağın id'leri hiç
 * bildirilmez; kaynak hazır olunca id ilk kez görülür ve hak ediliyorsa sessiz emilir.
 *
 * @param {Record<string, boolean>} [kesifHazir] stats.kesifHazir
 */
export function bilinenRozetIdleri(kesifHazir) {
  const hazir = kesifHazir || {};
  return WATCH_BADGES
    .filter((b) => !b.kaynak || hazir[b.kaynak] === true)
    .map((b) => b.id);
}

// Bilinmeyen dil İngilizce (utils/appLanguages kuralı). Alanlar: tr/en/es, descTr/descEn/descEs, ekTr/ekEn/ekEs.
const cap = (code) => code.charAt(0).toUpperCase() + code.slice(1);
export const badgeAd = (b, lang) => b?.[copyLanguage(lang, ["tr", "en", "es"])] || b?.en || "";
export const badgeAciklama = (b, lang) =>
  b?.[`desc${cap(copyLanguage(lang, ["tr", "en", "es"]))}`] || b?.descEn || "";

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
 * ilerleme bir sonraki kademeye göre çizilir. 154 rozet 85 aile/tekil karta iner
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
