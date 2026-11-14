// OTOMATİK ÜRETİLDİ — ELLE DÜZENLEME.
// Kaynak: utils/genreCanon.js. Yeniden üret: node functions/scripts/syncTasteCore.js

"use strict";
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
const foldGenreName = (value) =>
  String(value || "")
    .replace(/[İIı]/g, "i")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    // Japonca: kana + ayrışmış (han)dakuten işaretleri + kanji korunur; yoksa "ドラマ" boş string olur.
    .replace(/[^a-z0-9\u3040-\u30ff\u3099\u309a\u4e00-\u9fff]+/g, " ")
    .trim();

// Kanonik küme: 20 id. TMDB'nin 19 film + 16 dizi türü buraya düşer.
// Bileşik dizi türleri (Action & Adventure, Sci-Fi & Fantasy, War & Politics)
// tek bir string olarak geldiği için tek id'ye iner — bir dizi izleyicisi
// "adventure"ı ayrıca açamaz, bu kabul edilmiştir.
// Birleştirmeler: Kids→family, Soap→drama, Talk→reality, News→documentary,
// Politics→war. Bunlar tür sayısını gerçekçi tutar (TUR_TAVAN = 14).
const GENRE_IDS = Object.freeze([
  "action", "adventure", "animation", "comedy", "crime",
  "documentary", "drama", "family", "fantasy", "history",
  "horror", "music", "mystery", "romance", "scifi",
  "thriller", "war", "western", "reality", "tvmovie",
]);

// id → ad varyantları (TR + EN + ES + PT + DE + IT + FR + JA); tablo kurulurken foldGenreName ile katlanır. Aynı id'ye birden çok ad düşebilir.
// YENİ DİL: o dilin TMDB tür adlarını (film + dizi, bölgesel varyantlar dahil) buraya
// ekle — yoksa tür "other" kovasına düşer ve tür puanı/rozetleri sessizce bozulur.
const ALIASES = {
  action: ["action", "aksiyon", "action adventure", "aksiyon macera", "accion", "accion y aventura", "acao", "acao e aventura", "azione", "azione e avventura", "action et aventure", "アクション", "アクション&アドベンチャー"],
  adventure: ["adventure", "macera", "aventura", "abenteuer", "aventure", "アドベンチャー", "冒険"],
  animation: ["animation", "animasyon", "animacion", "animacao", "アニメーション", "アニメ"],
  comedy: ["comedy", "komedi", "comedia", "komodie", "commedia", "comedie", "コメディ", "コメディー"],
  crime: ["crime", "suc", "crimen", "krimi", "crimine", "犯罪"],
  documentary: ["documentary", "belgesel", "news", "haber", "documental", "noticias", "documentario", "dokumentarfilm", "nachrichten", "documentaire", "ドキュメンタリー", "ニュース"],
  drama: ["drama", "dram", "soap", "pembe dizi", "telenovela", "novela", "seifenoper", "dramma", "drame", "ドラマ", "ソープ", "メロドラマ"],
  family: ["family", "aile", "kids", "cocuk", "familia", "infantil", "familie", "kinder", "famiglia", "bambini", "familial", "ファミリー", "家族", "キッズ", "子供向け"],
  fantasy: ["fantasy", "fantastik", "fantezi", "fantasia", "fantastique", "ファンタジー"],
  history: ["history", "tarih", "historia", "historie", "geschichte", "storia", "histoire", "歴史", "履歴"],
  horror: ["horror", "korku", "terror", "orrore", "horreur", "ホラー"],
  music: ["music", "muzik", "musica", "musik", "musique", "音楽", "ミュージック"],
  mystery: ["mystery", "gizem", "misterio", "mistero", "mystere", "ミステリー", "ミステリ", "謎"],
  romance: ["romance", "romantik", "romantizm", "liebesfilm", "romanze", "ロマンス", "恋愛"],
  scifi: [
    "science fiction", "bilim kurgu", "sci fi fantasy", "bilim kurgu fantazi", "bilim kurgu fantezi", "scifi", "sci fi",
    "ciencia ficcion", "ciencia ficcion y fantasia", "ficcao cientifica", "ficcao cientifica e fantasia",
    "fantascienza", "fantascienza e fantasy", "science fiction fantastique",
      "SF", "サイエンスフィクション", "サイエンス・フィクション", "空想科学", "SF&ファンタジー",
  ],
  thriller: ["thriller", "gerilim", "suspense", "suspenso", "スリラー", "サスペンス"],
  war: ["war", "savas", "war politics", "savas politika", "belica", "belica y politica", "guerra", "guerra e politica", "kriegsfilm", "krieg", "guerre", "guerre politique", "guerre et politique", "戦争", "戦争&政治"],
  western: ["western", "vahsi bati", "kovboy", "faroeste", "西部劇", "西洋", "ウエスタン"],
  reality: ["reality", "realite", "talk", "program", "talk show", "programa de entrevistas", "リアリティ", "リアリティー", "トーク", "トークショー"],
  tvmovie: ["tv movie", "tv film", "tv filmi", "pelicula de tv", "cine tv", "cinema tv", "filme para tv", "telefilme", "film tv", "telefilm", "テレビ映画", "TV映画", "テレビムービー"],
};

const LOOKUP = new Map();
for (const id of Object.keys(ALIASES)) {
  for (const alias of ALIASES[id]) LOOKUP.set(foldGenreName(alias), id);
}

/**
 * Tür adını kanonik id'ye çevirir.
 * Tanınmayan her string TEK bir "other" kovasında toplanır — böylece bozuk ya
 * da yerelleştirilmemiş adlar tür sayısını suni olarak şişiremez.
 * @param {string} name
 * @returns {string} kanonik id | "other" | "" (boş girdi)
 */
function kanonikTur(name) {
  const key = foldGenreName(name);
  if (!key) return "";
  return LOOKUP.get(key) || "other";
}

// TMDB DİZİ türleri film türlerinden FARKLI: dizide "Action & Adventure", "Sci-Fi & Fantasy" birleşik tek
// türdür; "Thriller", "Horror", "Romance", "History", "Music" dizide YOKTUR. kanonikTur birleşik adı tek id'ye
// indirir (sayaç/rozet uyumu için böyle kalır); AĞIRLIKLI analizde ise birleşik tür iki parçaya bölünür ki
// dizideki "Aksiyon & Macera" filmdeki "Macera" ile de eşleşsin.
const COMPOSITE_PARTS = new Map();
for (const [aliases, parts] of [
  [["action adventure", "aksiyon macera", "accion y aventura", "acao e aventura", "action abenteuer", "azione e avventura", "action et aventure", "アクション&アドベンチャー"], ["action", "adventure"]],
  [
    [
      "sci fi fantasy", "science fiction fantasy", "bilim kurgu fantazi", "bilim kurgu fantezi", "bilim kurgu fantastik",
      "ciencia ficcion y fantasia", "ficcao cientifica e fantasia", "fantascienza e fantasy", "science fiction fantastique",
      "SF&ファンタジー", "SF & ファンタジー", "サイエンスフィクション&ファンタジー",
    ],
    ["scifi", "fantasy"],
  ],
]) {
  for (const alias of aliases) COMPOSITE_PARTS.set(foldGenreName(alias), parts);
}

/**
 * Tür adının ağırlıklı analizdeki kanonik PARÇALARI: çoğu tür tek id, birleşik dizi türleri iki id.
 * Tanınmayan ad → ["other"], boş → [].
 * @param {string} name
 * @returns {string[]}
 */
function genreParts(name) {
  const parts = COMPOSITE_PARTS.get(foldGenreName(name));
  if (parts) return parts;
  const id = kanonikTur(name);
  return id ? [id] : [];
}

/**
 * Türler arası AKRABALIK (0–1). Dizi/film tür sözlükleri farklı olduğundan (dizide Gerilim/Korku/Romantik yok)
 * bir biçimdeki zevk diğerine bu köprüyle, KISMİ olarak taşınır. Simetrik; listede olmayan çift 0.
 */
const RELATED = new Map();
for (const [a, b, v] of [
  ["thriller", "crime", 0.55], ["thriller", "mystery", 0.55], ["thriller", "action", 0.3], ["thriller", "horror", 0.35],
  ["horror", "mystery", 0.35], ["horror", "fantasy", 0.2],
  ["crime", "mystery", 0.45], ["crime", "drama", 0.25],
  ["romance", "drama", 0.35], ["romance", "comedy", 0.25],
  ["history", "war", 0.5], ["history", "documentary", 0.3], ["history", "drama", 0.25],
  ["action", "adventure", 0.45], ["adventure", "fantasy", 0.35], ["scifi", "fantasy", 0.4], ["scifi", "adventure", 0.25],
  ["family", "animation", 0.5], ["family", "comedy", 0.25],
  ["music", "documentary", 0.2], ["music", "drama", 0.15],
  ["documentary", "reality", 0.3],
]) {
  RELATED.set(`${a}|${b}`, v);
  RELATED.set(`${b}|${a}`, v);
}
/** İki kanonik türün akrabalığı: aynı tür 1, akraba 0–1 arası, ilgisiz 0. */
const genreRelation = (a, b) => (a === b ? 1 : RELATED.get(`${a}|${b}`) || 0);

/** Sıradaki her türün bir öncekine göre ağırlık oranı (TMDB türü genelde ana tür önde listeler). */
const GENRE_POSITION_DECAY = 0.7;

/**
 * İçeriğin türlerini kanonik id → AĞIRLIK haritasına çevirir; ağırlıklar toplamı 1'dir.
 *
 * NEDEN: bir film 1 türle, başka biri 4 türle etiketlenebiliyor. Her türe tam 1 sayılırsa 4 türlü
 * içerik profili dört kat etkiler ve tek türlü içerik izleyen biriyle karşılaştırma bozulur
 * (ölçüldü: yalnız Dram izleyen ile ana türü Dram olan 4 türlü filmler izleyen → kosinüs 0.50, tür puanı 0).
 * Toplamı 1'e sabitlemek her içeriğe EŞİT oy verir; sıra azalımı ana türü yan türlerden ağır tutar
 * (1 tür: 1 · 2 tür: .59/.41 · 3 tür: .46/.32/.22 · 4 tür: .39/.28/.19/.14).
 * Aynı kanonik id'ye düşen adlar (Aksiyon & Macera → action) birleşir; tanınmayan adlar
 * `unknown` ile verilirse `raw:<ad>` anahtarıyla tutulur, verilmezse atlanır.
 * @param {Array<string|{name:string}>} names
 * @param {{ keepUnknown?: boolean }} [options]
 * @returns {Map<string, number>}
 */
function weightedGenres(names, { keepUnknown = false } = {}) {
  // Her SIRA bir yuvadır; birleşik dizi türü (Aksiyon & Macera) yuvasının ağırlığını parçalarına eşit böler.
  const slots = [];
  const seen = new Set();
  for (const raw of Array.isArray(names) ? names : []) {
    const name = typeof raw === "string" ? raw : raw?.name;
    const keys = genreParts(name)
      .map((id) => (id === "other" ? (keepUnknown ? `raw:${name}` : null) : id))
      .filter((key) => key && !seen.has(key));
    if (keys.length === 0) continue;
    keys.forEach((key) => seen.add(key));
    slots.push(keys);
  }
  const out = new Map();
  if (slots.length === 0) return out;
  let total = 0;
  slots.forEach((keys, i) => {
    const w = GENRE_POSITION_DECAY ** i;
    for (const key of keys) out.set(key, w / keys.length);
    total += w;
  });
  for (const [key, w] of out) out.set(key, w / total);
  return out;
}

// Rozet kataloğunun tür sayaçlarını okurken kullandığı id'ler — yazım hatası
// bir rozeti sessizce ulaşılamaz kılmasın diye tek yerden ihraç edilir.
const GENRE = Object.freeze(
  GENRE_IDS.reduce((acc, id) => { acc[id.toUpperCase()] = id; return acc; }, { OTHER: "other" }),
);

module.exports = { foldGenreName, GENRE_IDS, kanonikTur, genreParts, genreRelation, GENRE_POSITION_DECAY, weightedGenres, GENRE };
