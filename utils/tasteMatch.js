// utils/tasteMatch.js
//
// Arkadaşla "zevk uyumu" ve "birlikte izleyelim" adayları — SAF çekirdek (RN/Firebase importu yok).
//
// GİZLİLİK ÖNCE: arkadaşın bir listesini yalnız o liste ona bakana AÇIKSA kullanırız
// (FriendProfileScreen `visibleLists`: listVisible + profil/liste gizliliği). Kapalı liste `null` gelir ve
// o bileşen hesaba HİÇ girmez; "elinde olmayan bilgiyi sıfır sanma" yoktur. Puanlar da yalnız ikimizin de
// GÖRÜNÜR izlenenlerinde ortak olan başlıklar için okunur (gizli bir listeden dolaylı bilgi sızmasın).
//
// UYUM PUANI dört bileşenin ağırlıklı ortalamasıdır; yeterli verisi olmayan bileşen DÜŞER (ağırlıklar
// kalanlara yeniden dağıtılır), hiçbiri yoksa puan yoktur (`null`) — uydurma % gösterilmez:
//   • tür benzerliği  (ağırlık 0.4)  izlenenlerin tür dağılımlarının kosinüs benzerliği, [0.5, 1] → [0, 1].
//                                    TÜR ADLARI düz metindir ve yazanın TMDB dilindedir ("Dram" / "Drama"):
//                                    iki tarafın tür sözlüğü yeterince ortak değilse (farklı dil) bu bileşen
//                                    HESAPTAN DÜŞER — yanlış "tamamen farklı zevk" sonucu üretilmez.
//   • ortak izlenen   (ağırlık 0.3)  ortak / küçük listenin boyutu, karekök ölçeği (küçük liste şişirmesin)
//   • puan uyumu      (ağırlık 0.3)  ortak puanlanan başlıklarda 1 − ortalama mutlak fark / 9
//   • ortak favori    (ağırlık 0.2)  İSTEĞE BAĞLI bonus: iki favori listesi de görünür ve ≥ 3 ise,
//                                    ortak / küçük listenin boyutu (karekök). Yokluğu puanı cezalandırmaz:
//                                    bileşen düşer, çekirdek üçlü eski göreli ağırlıklarıyla kalır.
// Puanın yanında NEDEN o puan olduğunu anlatan içgörüler üretilir (bileşen dökümü, birlikte sevilen / ayrışılan
// başlıklar, türlerde kimin neye yattığı). Hepsi yalnız ORTAK görünür izlenenlerden ve görünür izlenen
// türlerinden türetilir; yeni bir gizlilik yüzeyi açmaz.
// Bu bir HEURİSTİKTİR (bilimsel ölçü değil); eşikler ve ağırlıklar aşağıda sabit, testle kilitli.
//
// BİRLİKTE İZLEYELİM: ikisinin de izlemediği başlıklar. Önce her iki izleme listesindeki ortaklar, sonra
// yalnız birinin listesindekiler (dönüşümlü). "İzlemedi" bilgisi bilinmiyorsa (liste gizli) o yönden aday
// ÖNERİLMEZ — bilinmeyeni "izlenmemiş" saymak, arkadaşın izlediği filmi önermek demek olurdu.

// ── v2 (12 Kas) DERİN ANALİZ ──────────────────────────────────────────────
// Tür adları artık genreCanon.kanonikTur ile KANONİK id'ye indirgenir: "Dram"/"Drama" aynı tür sayılır,
// dil farkı tür bileşenini düşürmez (eski "sözlük örtüşmesi" kuralı yalnız tanınmayan adlar için kalır).
// Arayüze dönen tür adları kullanıcının KENDİ kayıtlarındaki ad (localizeGenreName ile çevrilir).
// Ek bileşenler (göreli ağırlık; eksikse düşer, çekirdek üçlü toplamı 1 kalır):
//   • genreRatings (0.2)  tür puan profili: iki tarafın da ≥3 puanladığı türlerde, herkesin KENDİ ortalamasına
//                         göre o türe verdiği fark (biri sert biri cömert olsa bile "neyi daha çok seviyor").
//                         Arkadaşın puanları yalnız onun GÖRÜNÜR izlenenlerinde okunur.
//   • ratingTrend  (0.15) ortak puanlanan ≥5 başlıkta Pearson korelasyonu: mutlak fark değil, SIRALAMA uyumu.
//   • format       (0.05) film/dizi dengesi (iki kategori de görünür, biri diziyi de izliyorsa).
// İZLEME LİSTESİ zevk uyumuna GİRMEZ (boş olabilir; niyet ≠ zevk) — yalnız "birlikte izleyelim" adaylarında kullanılır.
// TÜR AĞIRLIĞI (genreCanon.weightedGenres): her içerik toplam 1 oy verir, türler arasında sıraya göre azalarak
// paylaşılır (ana tür önde). 4 türlü bir film tek türlü bir filmin dört katı etki etmez; "Dram önde" ile
// "Dram sonda" ayrışır. Kosinüs, tür payı, eğilim ve tür puan profili bu ağırlıklarla hesaplanır.
// TÜR TABLOSU: iki tarafın birleşik tür ağırlığının en az %85'ini kapsayana kadar, EN AZ 5 (varsa) en çok 8 tür;
// her biri için iki tarafın payı ve (yeterli puan varsa) ortalama puanı.
// Güven + AZ VERİ: ortak izlenen, ortak puan ve liste büyüklüğünden `confidence` ve `lowData` çıkar;
// arayüz az veride "değerlerde yanılma olabilir" uyarısını gösterir.
export const MIN_GENRE_RATED_EACH = 3;
export const MIN_TREND_PAIRS = 5;
export const MIN_FORMAT_WATCHED = 10;
export const LOW_DATA_OVERLAP = 5;
export const LOW_DATA_PAIRS = 3;
export const LOW_DATA_WATCHED = 15;
/** Tür puan farkı (iki tarafın kendi ortalamasına göre, puan) bu eşik ve üstündeyse "türde ayrışıyorsunuz". */
export const GENRE_SPLIT_GAP = 1.5;
/** Ortak puanlarda ortalama fark bu eşik ve üstündeyse biri daha cömert puanlıyor denir. */
export const GENEROUS_GAP = 1;

export const MIN_WATCHED_FOR_GENRES = 5;
export const MIN_WATCHED_FOR_OVERLAP = 5;
export const MIN_RATED_PAIRS = 3;
export const MIN_FAVORITES = 3;
/** Bir puan çifti iki tarafta da bu eşik ve üstündeyse "ikinizin de sevdiği". */
export const LOVED_RATING = 8;
/** Puan farkı bu eşik ve üstündeyse "ayrıştığınız". */
export const SPLIT_GAP = 3;
/** Tür payı farkı (0–1) bu eşik ve üstündeyse "daha çok X izliyor" denir. */
export const GENRE_LEAN_GAP = 0.12;
export const MAX_HIGHLIGHTS = 8;
/** İki tarafın tür sözlüğünün (küçük olana göre) en az bu kadarı ortak olmalı; yoksa dil farkı varsayılır. */
export const MIN_VOCAB_OVERLAP = 0.5;
// Ağırlıklar GÖRECELİDİR: eksik bileşen düşünce kalanlara göre yeniden normalleştirilir (toplamın 1 olması gerekmez).
export const WEIGHTS = Object.freeze({
  genres: 0.4,
  overlap: 0.3,
  ratings: 0.3,
  favorites: 0.2,
  genreRatings: 0.2,
  ratingTrend: 0.15,
  format: 0.05,
});
/** Ana kartta ayrı satırda gösterilen derin analiz bileşenleri. */
export const DEEP_COMPONENTS = Object.freeze(["genreRatings", "ratingTrend", "format"]);
const CORE_COMPONENTS = ["genres", "overlap", "ratings"];
export const MAX_CANDIDATES = 20;
export const GENRE_TABLE_MIN = 5;
export const GENRE_TABLE_MAX = 8;
export const GENRE_TABLE_COVERAGE = 0.85;
/** Tür tablosunda ortalama puan için o türde gereken en az puanlı içerik (her taraf). */
export const GENRE_TABLE_MIN_RATED = 2;

import { genreParts, weightedGenres } from "./genreCanon";

const asArray = (value) => (Array.isArray(value) ? value : []);
const keyOf = (type, id) => `${type === "tv" ? "tv" : "movie"}_${id}`;
const validId = (id) => Number.isInteger(Number(id)) && Number(id) > 0;
const clamp01 = (n) => Math.max(0, Math.min(1, n));
const round1 = (n) => Math.round(n * 10) / 10;

/** Liste → Map<anahtar, öğe>. `forcedType` verilirse öğenin kendi türü yok sayılır (izlenen film/dizi listeleri). */
function indexList(list, forcedType = null) {
  const map = new Map();
  for (const item of asArray(list)) {
    if (!item || !validId(item.id)) continue;
    const type = forcedType || (item.type === "tv" || item.media_type === "tv" ? "tv" : "movie");
    const key = keyOf(type, Number(item.id));
    if (map.has(key)) continue;
    const genres = asArray(item.genres).filter((g) => typeof g === "string" && g.trim());
    // Kanonik id → gösterim adı. Tek parçalı türde kayıttaki ad; birleşik dizi türünün parçalarında
    // (Aksiyon & Macera → action + adventure) kanonik id (localizeGenreName id'yi de çevirir);
    // tanınmayan ad kendi adıyla `raw:` anahtarında kalır (eski davranış).
    const canon = new Map();
    for (const g of genres) {
      const parts = genreParts(g);
      for (const id of parts) {
        const cid = id !== "other" ? id : `raw:${g}`;
        if (!canon.has(cid)) canon.set(cid, parts.length > 1 ? id : g);
      }
    }
    map.set(key, {
      key,
      id: Number(item.id),
      type,
      name: item.name || item.title || "",
      imagePath: item.imagePath || item.poster_path || null,
      genres,
      canon,
      // Kanonik id → ağırlık (toplam 1, ana tür önde). Anahtarlar `canon` ile aynı.
      gw: weightedGenres(genres, { keepUnknown: true }),
    });
  }
  return map;
}

/**
 * Kullanıcının bir tarafı. `null` = bu liste GÖRÜNMÜYOR / bilinmiyor.
 * @typedef {{ watchedMovies: Array|null, watchedShows: Array|null, watchList: Array|null,
 *   favorites: Array|null, ratings?: Record<string, number> }} TasteSide
 */
function prepareSide(side) {
  const s = side || {};
  const watchedMovies = s.watchedMovies == null ? null : indexList(s.watchedMovies, "movie");
  const watchedShows = s.watchedShows == null ? null : indexList(s.watchedShows, "tv");
  return {
    watchedMovies,
    watchedShows,
    watchList: s.watchList == null ? null : indexList(s.watchList),
    favorites: s.favorites == null ? null : indexList(s.favorites),
    ratings: s.ratings && typeof s.ratings === "object" ? s.ratings : {},
  };
}

/** Yalnız verilen kategorilerdeki izlenenler (birleşik Map). */
function watchedIn(side, categories) {
  const out = new Map();
  for (const category of categories) {
    const map = side[category];
    if (map) for (const [key, item] of map) out.set(key, item);
  }
  return out;
}

/**
 * Kanonik türe göre AĞIRLIKLI sayım (her içerik toplam 1). `counts` ağırlık toplamı, `items` o türü içeren
 * içerik sayısı, `names` kanonik id → ilk görülen kayıt adı. Pay = counts / withGenres.
 */
function genreCounts(items) {
  const counts = new Map();
  const itemCounts = new Map();
  const names = new Map();
  let withGenres = 0;
  for (const item of items.values()) {
    if (item.canon.size === 0) continue;
    withGenres += 1;
    for (const [cid, raw] of item.canon) {
      counts.set(cid, (counts.get(cid) || 0) + (item.gw.get(cid) || 0));
      itemCounts.set(cid, (itemCounts.get(cid) || 0) + 1);
      if (!names.has(cid)) names.set(cid, raw);
    }
  }
  return { counts, items: itemCounts, withGenres, names };
}

const meanOf = (values) => values.reduce((a, b) => a + b, 0) / values.length;

function pearson(xs, ys) {
  const mx = meanOf(xs);
  const my = meanOf(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i += 1) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return { r: sxx && syy ? sxy / Math.sqrt(sxx * syy) : null, sdx: Math.sqrt(sxx / xs.length), sdy: Math.sqrt(syy / ys.length) };
}

/** Bir tarafın tür başına ortalama puanı (yalnız o tarafın verilen izlenenlerinde). */
function genreRatingProfile(items, ratings) {
  const sums = new Map();
  const all = [];
  for (const item of items.values()) {
    const r = ratingOf(ratings, item.key);
    if (r === null) continue;
    all.push(r);
    // Puan türlere ağırlığıyla dağılır: 4 türlü filmin puanı yan türünü ana türü kadar belirlemez.
    for (const [cid, w] of item.gw) {
      const s = sums.get(cid) || { sum: 0, w: 0, n: 0 };
      s.sum += r * w;
      s.w += w;
      s.n += 1;
      sums.set(cid, s);
    }
  }
  return { mean: all.length ? meanOf(all) : null, rated: all.length, genres: sums };
}

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [genre, value] of a) {
    na += value * value;
    dot += value * (b.get(genre) || 0);
  }
  for (const value of b.values()) nb += value * value;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

const ratingOf = (ratings, key) => {
  const n = Number(ratings?.[key]);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export const TIERS = Object.freeze([
  { id: "veryHigh", min: 75 },
  { id: "high", min: 55 },
  { id: "medium", min: 35 },
  { id: "low", min: 0 },
]);
export const tierOf = (score) => (score == null ? null : TIERS.find((tier) => score >= tier.min).id);

/**
 * Zevk uyumu.
 *
 * @param {TasteSide} mine
 * @param {TasteSide} theirs  görünmeyen listeler `null`
 * @returns {{
 *   state: "ok" | "limited" | "no-data",
 *   score: number | null, tier: string | null,
 *   watched: { overlap: Array, mine: number, theirs: number },
 *   favorites: Array | null,
 *   genres: { similarity: number | null, shared: string[], comparable: boolean,
 *     lean: { mine: string | null, theirs: string | null } },
 *   ratings: { pairs: number, agreement: number | null },
 *   highlights: Array<{ key, id, type, name, imagePath, mine: number | null, theirs: number | null }>,
 *   loved: Array<{ name, mine: number, theirs: number }>,
 *   split: { name: string, mine: number, theirs: number } | null,
 *   breakdown: Array<{ id: string, value: number, weight: number }>,
 *   components: string[]
 * }}
 */
function compareSides(a, b) {

  // Karşılaştırma yalnız ARKADAŞIN gördüğümüz kategorilerinde yapılır.
  const categories = ["watchedMovies", "watchedShows"].filter((c) => b[c] !== null);
  const watchedA = watchedIn(a, categories);
  const watchedB = watchedIn(b, categories);

  const overlap = [];
  for (const [key, item] of watchedA) if (watchedB.has(key)) overlap.push(item);

  // ── ortak izlenen ──
  const smaller = Math.min(watchedA.size, watchedB.size);
  const overlapScore =
    categories.length > 0 && watchedA.size >= MIN_WATCHED_FOR_OVERLAP && watchedB.size >= MIN_WATCHED_FOR_OVERLAP
      ? clamp01(Math.sqrt(overlap.length / smaller))
      : null;

  // ── tür benzerliği ──
  const ga = genreCounts(watchedA);
  const gb = genreCounts(watchedB);
  // Gösterim adı: önce benim kayıtlarımdaki ad (benim dilim), yoksa onunki.
  const nameOf = (cid) => ga.names.get(cid) || gb.names.get(cid) || cid;
  let genreScore = null;
  let similarity = null;
  const shared = [];
  const lean = { mine: null, theirs: null };
  const vocabShared = [...ga.counts.keys()].filter((genre) => gb.counts.has(genre)).length;
  const vocabSmaller = Math.min(ga.counts.size, gb.counts.size);
  const sameVocabulary = vocabSmaller > 0 && vocabShared / vocabSmaller >= MIN_VOCAB_OVERLAP;
  if (ga.withGenres >= MIN_WATCHED_FOR_GENRES && gb.withGenres >= MIN_WATCHED_FOR_GENRES && sameVocabulary) {
    similarity = cosine(ga.counts, gb.counts);
    genreScore = clamp01((similarity - 0.5) / 0.5);
    shared.push(
      ...[...ga.counts.keys()]
        .filter((genre) => gb.counts.has(genre))
        .map((genre) => ({ genre, weight: Math.min(ga.counts.get(genre) / ga.withGenres, gb.counts.get(genre) / gb.withGenres) }))
        .sort((x, y) => y.weight - x.weight || x.genre.localeCompare(y.genre))
        .slice(0, GENRE_TABLE_MIN)
        .map((entry) => nameOf(entry.genre)),
    );

    // Kim hangi türe daha çok yatıyor: pay (türü olan izlenenlerdeki oran) farkı en büyük olanlar.
    let mineGap = 0;
    let theirGap = 0;
    for (const genre of new Set([...ga.counts.keys(), ...gb.counts.keys()])) {
      const gap = (ga.counts.get(genre) || 0) / ga.withGenres - (gb.counts.get(genre) || 0) / gb.withGenres;
      if (gap >= GENRE_LEAN_GAP && gap > mineGap) {
        mineGap = gap;
        lean.mine = nameOf(genre);
      } else if (-gap >= GENRE_LEAN_GAP && -gap > theirGap) {
        theirGap = -gap;
        lean.theirs = nameOf(genre);
      }
    }
  }

  // ── tür puan profili (her taraf yalnız KENDİ görünür izlenenlerinde) ──
  const pa = genreRatingProfile(watchedA, a.ratings);
  const pb = genreRatingProfile(watchedB, b.ratings);
  let genreRatingsScore = null;
  let genreSplit = null;
  let genreAgree = null;
  if (pa.mean !== null && pb.mean !== null) {
    const rows = [];
    for (const [cid, sa] of pa.genres) {
      const sb = pb.genres.get(cid);
      if (!sb || sa.n < MIN_GENRE_RATED_EACH || sb.n < MIN_GENRE_RATED_EACH) continue;
      const avgA = sa.sum / sa.w;
      const avgB = sb.sum / sb.w;
      rows.push({ cid, avgA, avgB, devGap: Math.abs(avgA - pa.mean - (avgB - pb.mean)), n: Math.min(sa.n, sb.n) });
    }
    if (rows.length >= 2) {
      const wSum = rows.reduce((s, r) => s + r.n, 0);
      const gap = rows.reduce((s, r) => s + r.devGap * r.n, 0) / wSum;
      genreRatingsScore = clamp01(1 - gap / 2.5);
      const widestGenre = [...rows].sort((x, y) => Math.abs(y.avgA - y.avgB) - Math.abs(x.avgA - x.avgB))[0];
      if (Math.abs(widestGenre.avgA - widestGenre.avgB) >= GENRE_SPLIT_GAP) {
        genreSplit = { genre: nameOf(widestGenre.cid), mine: round1(widestGenre.avgA), theirs: round1(widestGenre.avgB) };
      }
      const bestShared = rows
        .filter((r) => r.avgA >= 7.5 && r.avgB >= 7.5)
        .sort((x, y) => y.avgA + y.avgB - (x.avgA + x.avgB))[0];
      if (bestShared) genreAgree = { genre: nameOf(bestShared.cid), mine: round1(bestShared.avgA), theirs: round1(bestShared.avgB) };
    }
  }

  // ── tür tablosu: en az 5 (varsa), birleşik ağırlığın %85'ine kadar, en çok 8 tür ──
  let genreTable = [];
  if (ga.withGenres >= MIN_WATCHED_FOR_GENRES && gb.withGenres >= MIN_WATCHED_FOR_GENRES) {
    const shareA = (cid) => (ga.counts.get(cid) || 0) / ga.withGenres;
    const shareB = (cid) => (gb.counts.get(cid) || 0) / gb.withGenres;
    const union = [...new Set([...ga.counts.keys(), ...gb.counts.keys()])]
      .map((cid) => ({ cid, combined: (shareA(cid) + shareB(cid)) / 2 }))
      .sort((x, y) => y.combined - x.combined || x.cid.localeCompare(y.cid));
    let covered = 0;
    for (const entry of union) {
      if (genreTable.length >= GENRE_TABLE_MAX) break;
      if (genreTable.length >= GENRE_TABLE_MIN && covered >= GENRE_TABLE_COVERAGE) break;
      covered += entry.combined;
      const ra = pa.genres.get(entry.cid);
      const rb = pb.genres.get(entry.cid);
      genreTable.push({
        genre: nameOf(entry.cid),
        mine: Math.round(shareA(entry.cid) * 100),
        theirs: Math.round(shareB(entry.cid) * 100),
        mineCount: ga.items.get(entry.cid) || 0,
        theirCount: gb.items.get(entry.cid) || 0,
        mineAvg: ra && ra.n >= GENRE_TABLE_MIN_RATED ? round1(ra.sum / ra.w) : null,
        theirAvg: rb && rb.n >= GENRE_TABLE_MIN_RATED ? round1(rb.sum / rb.w) : null,
      });
    }
  }

  // ── puan uyumu: yalnız ORTAK izlenen başlıklarda ──
  let diffSum = 0;
  let pairs = 0;
  const rated = []; // ikimizin de puanladığı ortak başlıklar
  const highlightsAll = [];
  for (const item of overlap) {
    const ra = ratingOf(a.ratings, item.key);
    const rb = ratingOf(b.ratings, item.key);
    highlightsAll.push({ item, mine: ra, theirs: rb });
    if (ra !== null && rb !== null) {
      diffSum += Math.abs(ra - rb);
      pairs += 1;
      rated.push({ item, mine: ra, theirs: rb });
    }
  }
  const agreement = pairs >= MIN_RATED_PAIRS ? clamp01(1 - diffSum / pairs / 9) : null;

  // ── puan eğilimi: sıralama uyumu (korelasyon) + kim daha cömert ──
  let ratingTrendScore = null;
  let correlation = null;
  let generous = null;
  if (pairs >= MIN_RATED_PAIRS) {
    const meanGap = meanOf(rated.map((p) => p.mine - p.theirs));
    if (Math.abs(meanGap) >= GENEROUS_GAP) generous = { who: meanGap > 0 ? "mine" : "theirs", gap: round1(Math.abs(meanGap)) };
  }
  if (pairs >= MIN_TREND_PAIRS) {
    const { r, sdx, sdy } = pearson(rated.map((p) => p.mine), rated.map((p) => p.theirs));
    // İki taraftan biri hep aynı puanı veriyorsa sıralama bilgisi yok → bileşen düşer.
    if (r !== null && sdx >= 0.5 && sdy >= 0.5) {
      correlation = Math.round(r * 100) / 100;
      // Az çiftte korelasyon oynaktır: çift sayısıyla nötre (0.5) çek.
      ratingTrendScore = clamp01(0.5 + ((r + 1) / 2 - 0.5) * (pairs / (pairs + 4)));
    }
  }

  // ── film/dizi dengesi ──
  let formatScore = null;
  if (categories.length === 2 && watchedA.size >= MIN_FORMAT_WATCHED && watchedB.size >= MIN_FORMAT_WATCHED) {
    const shows = (m) => [...m.values()].filter((i) => i.type === "tv").length;
    const sa = shows(watchedA);
    const sb = shows(watchedB);
    if (sa >= 3 || sb >= 3) formatScore = clamp01(1 - Math.abs(sa / watchedA.size - sb / watchedB.size));
  }

  // ── ortak favori (isteğe bağlı bonus bileşen) ──
  const favorites =
    a.favorites && b.favorites ? [...a.favorites.values()].filter((item) => b.favorites.has(item.key)) : null;
  const favoritesScore =
    favorites && a.favorites.size >= MIN_FAVORITES && b.favorites.size >= MIN_FAVORITES
      ? clamp01(Math.sqrt(favorites.length / Math.min(a.favorites.size, b.favorites.size)))
      : null;

  // ── içgörüler (yalnız ortak görünür izlenenlerden) ──
  const loved = rated
    .filter((pair) => pair.mine >= LOVED_RATING && pair.theirs >= LOVED_RATING)
    .sort((x, y) => y.mine + y.theirs - (x.mine + x.theirs) || x.item.name.localeCompare(y.item.name))
    .slice(0, 3)
    .map((pair) => ({ name: pair.item.name, mine: pair.mine, theirs: pair.theirs }));
  const widest = [...rated].sort((x, y) => Math.abs(y.mine - y.theirs) - Math.abs(x.mine - x.theirs))[0];
  const split =
    widest && Math.abs(widest.mine - widest.theirs) >= SPLIT_GAP
      ? { name: widest.item.name, mine: widest.mine, theirs: widest.theirs }
      : null;
  // Afiş şeridi: önce ikimizin de puanladığı (toplam puan yüksekten), sonra yalnız birinin, sonra puansızlar.
  const rank = (entry) => (entry.mine !== null && entry.theirs !== null ? 2 : entry.mine !== null || entry.theirs !== null ? 1 : 0);
  const highlights = highlightsAll
    .filter(({ item }) => item.imagePath)
    .sort(
      (x, y) =>
        rank(y) - rank(x) ||
        (y.mine || 0) + (y.theirs || 0) - ((x.mine || 0) + (x.theirs || 0)) ||
        x.item.name.localeCompare(y.item.name),
    )
    .slice(0, MAX_HIGHLIGHTS)
    .map(({ item, mine, theirs }) => ({
      key: item.key,
      id: item.id,
      type: item.type,
      name: item.name,
      imagePath: item.imagePath,
      mine,
      theirs,
    }));

  // ── birleşik puan ──
  const parts = [
    ["genres", genreScore],
    ["overlap", overlapScore],
    ["ratings", agreement],
    ["favorites", favoritesScore],
    ["genreRatings", genreRatingsScore],
    ["ratingTrend", ratingTrendScore],
    ["format", formatScore],
  ].filter(([, value]) => value !== null);
  let score = null;
  if (parts.length > 0) {
    const totalWeight = parts.reduce((sum, [name]) => sum + WEIGHTS[name], 0);
    score = Math.round((parts.reduce((sum, [name, value]) => sum + WEIGHTS[name] * value, 0) / totalWeight) * 100);
  }

  // ── güven + az veri ──
  const minWatched = Math.min(watchedA.size, watchedB.size);
  const evidence =
    0.35 * Math.min(1, overlap.length / 25) +
    0.3 * Math.min(1, pairs / 15) +
    0.2 * Math.min(1, minWatched / 50) +
    0.15 * (parts.length / 8);
  const confidence = parts.length === 0 ? null : evidence >= 0.65 ? "high" : evidence >= 0.35 ? "medium" : "low";
  const lowData =
    parts.length > 0 &&
    (overlap.length < LOW_DATA_OVERLAP || pairs < LOW_DATA_PAIRS || minWatched < LOW_DATA_WATCHED || confidence === "low");

  return {
    confidence,
    evidence: Math.round(evidence * 100),
    lowData,
    deep: {
      genreSplit,
      genreAgree,
      correlation,
      generous,
      ratedMine: pa.rated,
      ratedTheirs: pb.rated,
    },
    // "ok": çekirdek üçlünün hepsi var (ortak favori bonus olduğundan beklenmez).
    state:
      parts.length === 0
        ? "no-data"
        : CORE_COMPONENTS.every((name) => parts.some(([id]) => id === name))
          ? "ok"
          : "limited",
    score,
    tier: tierOf(score),
    watched: { overlap, mine: watchedA.size, theirs: watchedB.size },
    favorites,
    genres: { similarity, shared, comparable: sameVocabulary, lean, table: genreTable },
    ratings: { pairs, agreement },
    highlights,
    loved,
    split,
    breakdown: parts.map(([id, value]) => ({ id, value: Math.round(value * 100), weight: WEIGHTS[id] })),
    components: parts.map(([name]) => name),
  };
}

/**
 * Zevk uyumunun film / dizi kırılımı ile sarmalanmış hâli (asıl hesap `compareSides`).
 *
 * Ek alanlar:
 *   scope   "both" | "movies" | "shows" | "none"  arkadaşın bize AÇTIĞI izlenen kategorileri
 *   byType  { movie, tv }  her biri { shared, score | null, overlap, mine, theirs }
 *           shared=false: arkadaş o kategoriyi paylaşmıyor (puan YOK, "sıfır" değil);
 *           shared=true ama score=null: o kategoride karşılaştırmaya yetecek kayıt yok.
 * Kategori puanı ana puanla AYNI formüldür, yalnız o kategorinin izlenenleriyle (ortak favori hariç).
 */
export function computeTasteMatch(mine, theirs) {
  const a = prepareSide(mine);
  const b = prepareSide(theirs);
  const result = compareSides(a, b);

  const only = (category, otherCategory) => {
    const shared = b[category] !== null;
    if (!shared) return { shared: false, score: null, overlap: 0, mine: 0, theirs: 0 };
    // Kategori puanı yalnız o kategorinin izlenenleriyle: liste/favori gibi kategori dışı sinyaller girmez.
    const sub = compareSides({ ...a, watchList: null }, { ...b, [otherCategory]: null, favorites: null, watchList: null });
    return { shared: true, score: sub.score, overlap: sub.watched.overlap.length, mine: sub.watched.mine, theirs: sub.watched.theirs };
  };
  const movie = only("watchedMovies", "watchedShows");
  const tv = only("watchedShows", "watchedMovies");

  return {
    ...result,
    scope: movie.shared && tv.shared ? "both" : movie.shared ? "movies" : tv.shared ? "shows" : "none",
    byType: { movie, tv },
  };
}

/**
 * Birlikte izlenebilecek adaylar.
 *
 * @param {TasteSide} mine
 * @param {TasteSide} theirs
 * @param {{ limit?: number }} [options]
 * @returns {{ candidates: Array<{key,id,type,name,imagePath,source:"both"|"mine"|"theirs"}>,
 *   counts: { both: number, mine: number, theirs: number } }}
 */
export function findTogetherCandidates(mine, theirs, { limit = MAX_CANDIDATES } = {}) {
  const a = prepareSide(mine);
  const b = prepareSide(theirs);

  // "İzlendi mi?" bilgisi tür başına: bilinmeyen tür için o yönde öneri yapılmaz.
  const watchedBy = (side, type) => side[type === "tv" ? "watchedShows" : "watchedMovies"];
  const knownWatched = (side, item) => watchedBy(side, item.type) !== null;
  const hasWatched = (side, item) => !!watchedBy(side, item.type)?.has(item.key);

  const none = { candidates: [], counts: { both: 0, mine: 0, theirs: 0 } };
  if (!a.watchList && !b.watchList) return none;

  const both = [];
  const onlyMine = [];
  const onlyTheirs = [];

  if (a.watchList) {
    for (const item of a.watchList.values()) {
      if (hasWatched(a, item)) continue;
      const theirList = b.watchList;
      if (theirList && theirList.has(item.key)) {
        // İki listede de: arkadaşın izlediği biliniyorsa ele.
        if (knownWatched(b, item) && hasWatched(b, item)) continue;
        both.push({ ...item, source: "both" });
      } else if (knownWatched(b, item) && !hasWatched(b, item)) {
        onlyMine.push({ ...item, source: "mine" });
      }
    }
  }
  if (b.watchList) {
    for (const item of b.watchList.values()) {
      if (a.watchList?.has(item.key)) continue; // "both" tarafında işlendi
      if (knownWatched(b, item) && hasWatched(b, item)) continue;
      if (!hasWatched(a, item) && knownWatched(a, item)) onlyTheirs.push({ ...item, source: "theirs" });
    }
  }

  // Ortaklar önce; ardından iki yanın listesi dönüşümlü (biri diğerini bastırmasın).
  const merged = [...both];
  for (let i = 0; i < Math.max(onlyMine.length, onlyTheirs.length); i += 1) {
    if (onlyMine[i]) merged.push(onlyMine[i]);
    if (onlyTheirs[i]) merged.push(onlyTheirs[i]);
  }
  const candidates = merged.slice(0, Math.max(0, limit));
  return {
    candidates,
    counts: { both: both.length, mine: onlyMine.length, theirs: onlyTheirs.length },
  };
}

/** Aday listesinden CineSwipe odası destesi (kart biçimi: services/cineswipe/deckModel.normalizeWatchlistItem). */
export const candidatesToDeckSource = (candidates) =>
  asArray(candidates)
    .filter((item) => item && validId(item.id) && item.name && item.imagePath)
    .map((item) => ({ id: item.id, type: item.type, name: item.name, imagePath: item.imagePath }));
