// utils/genreCanon.js
//
// TMDB tür ADLARINI kanonik id'lere indirger.
//
// NEDEN GEREKLI: uygulama tür bilgisini id olarak DEGIL, ad olarak saklıyor —
// `details.genres?.map((g) => g.name)` (screens/movie/MovieDetail.js:431,
// screens/tv/TvShowsDetails.js:397 ve 6 yer daha). TMDB ise adı istemcinin
// diline göre döndürüyor. Sonuç: uygulamayı Türkçe kullanırken izlediği film
// "Bilim Kurgu", İngilizce'ye geçtikten sonra izlediği "Science Fiction" olarak
// yazılıyor ve aynı kullanıcının aynı türü İKİ AYRI tür sayılıyor.
//
// Bu dosya olmadan tür puanı ve tür rozetleri dil değiştiren kullanıcıyı
// ödüllendirir (her dil yeni tür açar), hiç değiştirmeyeni cezalandırır.
//
// SAF MODÜL: React/Firestore/alias importu yok — utils/watchScoring.js ile
// birlikte olduğu gibi functions/ altına kopyalanabilir.

// Katlama: büyük/küçük harf, Türkçe i/ı/İ, aksan, "&" ve tire farklarını siler.
// `İIı → i` eşlemesi ÖNCE yapılır: toLocaleLowerCase("tr-TR") "Science Fiction"
// gibi ASCII adlarda sorun çıkarmaz ama "Batı" → "batı" bırakır ve NFD dotless
// ı'yı ayrıştıramaz (birleşik işaret değil, ayrı bir taban karakterdir).
const fold = (value) =>
  String(value || "")
    .replace(/[İIı]/g, "i")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Kanonik küme: 20 id. TMDB'nin 19 film + 16 dizi türü buraya düşer.
// Bileşik dizi türleri (Action & Adventure, Sci-Fi & Fantasy, War & Politics)
// tek bir string olarak geldiği için tek id'ye iner — bir dizi izleyicisi
// "adventure"ı ayrıca açamaz, bu kabul edilmiştir.
// Birleştirmeler: Kids→family, Soap→drama, Talk→reality, News→documentary,
// Politics→war. Bunlar tür sayısını gerçekçi tutar (TUR_TAVAN = 14).
export const GENRE_IDS = Object.freeze([
  "action", "adventure", "animation", "comedy", "crime",
  "documentary", "drama", "family", "fantasy", "history",
  "horror", "music", "mystery", "romance", "scifi",
  "thriller", "war", "western", "reality", "tvmovie",
]);

// id → katlanmış ad varyantları (TR + EN). Aynı id'ye birden çok ad düşebilir.
const ALIASES = {
  action: ["action", "aksiyon", "action adventure", "aksiyon macera"],
  adventure: ["adventure", "macera"],
  animation: ["animation", "animasyon"],
  comedy: ["comedy", "komedi"],
  crime: ["crime", "suc"],
  documentary: ["documentary", "belgesel", "news", "haber"],
  drama: ["drama", "dram", "soap", "pembe dizi"],
  family: ["family", "aile", "kids", "cocuk"],
  fantasy: ["fantasy", "fantastik", "fantezi"],
  history: ["history", "tarih"],
  horror: ["horror", "korku"],
  music: ["music", "muzik"],
  mystery: ["mystery", "gizem"],
  romance: ["romance", "romantik", "romantizm"],
  scifi: ["science fiction", "bilim kurgu", "sci fi fantasy", "bilim kurgu fantazi", "bilim kurgu fantezi", "scifi", "sci fi"],
  thriller: ["thriller", "gerilim"],
  war: ["war", "savas", "war politics", "savas politika"],
  western: ["western", "vahsi bati", "kovboy"],
  reality: ["reality", "realite", "talk", "program", "talk show"],
  tvmovie: ["tv movie", "tv film", "tv filmi"],
};

const LOOKUP = new Map();
for (const id of Object.keys(ALIASES)) {
  for (const alias of ALIASES[id]) LOOKUP.set(alias, id);
}

/**
 * Tür adını kanonik id'ye çevirir.
 * Tanınmayan her string TEK bir "other" kovasında toplanır — böylece bozuk ya
 * da yerelleştirilmemiş adlar tür sayısını suni olarak şişiremez.
 * @param {string} name
 * @returns {string} kanonik id | "other" | "" (boş girdi)
 */
export function kanonikTur(name) {
  const key = fold(name);
  if (!key) return "";
  return LOOKUP.get(key) || "other";
}

// Rozet kataloğunun tür sayaçlarını okurken kullandığı id'ler — yazım hatası
// bir rozeti sessizce ulaşılamaz kılmasın diye tek yerden ihraç edilir.
export const GENRE = Object.freeze(
  GENRE_IDS.reduce((acc, id) => { acc[id.toUpperCase()] = id; return acc; }, { OTHER: "other" }),
);

export default kanonikTur;
