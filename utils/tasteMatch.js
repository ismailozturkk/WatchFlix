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
export const WEIGHTS = Object.freeze({ genres: 0.4, overlap: 0.3, ratings: 0.3, favorites: 0.2 });
const CORE_COMPONENTS = ["genres", "overlap", "ratings"];
export const MAX_CANDIDATES = 20;

const asArray = (value) => (Array.isArray(value) ? value : []);
const keyOf = (type, id) => `${type === "tv" ? "tv" : "movie"}_${id}`;
const validId = (id) => Number.isInteger(Number(id)) && Number(id) > 0;
const clamp01 = (n) => Math.max(0, Math.min(1, n));

/** Liste → Map<anahtar, öğe>. `forcedType` verilirse öğenin kendi türü yok sayılır (izlenen film/dizi listeleri). */
function indexList(list, forcedType = null) {
  const map = new Map();
  for (const item of asArray(list)) {
    if (!item || !validId(item.id)) continue;
    const type = forcedType || (item.type === "tv" || item.media_type === "tv" ? "tv" : "movie");
    const key = keyOf(type, Number(item.id));
    if (map.has(key)) continue;
    map.set(key, {
      key,
      id: Number(item.id),
      type,
      name: item.name || item.title || "",
      imagePath: item.imagePath || item.poster_path || null,
      genres: asArray(item.genres).filter((g) => typeof g === "string" && g.trim()),
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

function genreCounts(items) {
  const counts = new Map();
  let withGenres = 0;
  for (const item of items.values()) {
    if (item.genres.length === 0) continue;
    withGenres += 1;
    for (const genre of new Set(item.genres)) counts.set(genre, (counts.get(genre) || 0) + 1);
  }
  return { counts, withGenres };
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
        .slice(0, 3)
        .map((entry) => entry.genre),
    );

    // Kim hangi türe daha çok yatıyor: pay (türü olan izlenenlerdeki oran) farkı en büyük olanlar.
    let mineGap = 0;
    let theirGap = 0;
    for (const genre of new Set([...ga.counts.keys(), ...gb.counts.keys()])) {
      const gap = (ga.counts.get(genre) || 0) / ga.withGenres - (gb.counts.get(genre) || 0) / gb.withGenres;
      if (gap >= GENRE_LEAN_GAP && gap > mineGap) {
        mineGap = gap;
        lean.mine = genre;
      } else if (-gap >= GENRE_LEAN_GAP && -gap > theirGap) {
        theirGap = -gap;
        lean.theirs = genre;
      }
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
  ].filter(([, value]) => value !== null);
  let score = null;
  if (parts.length > 0) {
    const totalWeight = parts.reduce((sum, [name]) => sum + WEIGHTS[name], 0);
    score = Math.round((parts.reduce((sum, [name, value]) => sum + WEIGHTS[name] * value, 0) / totalWeight) * 100);
  }

  return {
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
    genres: { similarity, shared, comparable: sameVocabulary, lean },
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
    const sub = compareSides(a, { ...b, [otherCategory]: null, favorites: null });
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
