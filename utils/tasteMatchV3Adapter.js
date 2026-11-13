// utils/tasteMatchV3Adapter.js
//
// Zevk eşleşmesi v3 — istemci liste verisini çekirdeğin (utils/tasteMatchV3.js) girdisine çeviren SAF
// köprü + Faz 2 "gölge mod" karşılaştırması (docs/planlama/ZEVK_ESLESMESI_UYGULAMA_REHBERI.md §4).
//
// GİRDİ: utils/tasteMatch.js ile AYNI "taraf" şekli (FriendProfileScreen `mySide` / `friendSide`):
//   { watchedMovies, watchedShows, watchList, favorites, ratings }
// `null` liste = GÖRÜNMÜYOR (arkadaş paylaşmamış) → hiç okunmaz. Puan yalnız GÖRÜNÜR izlenen/favori
// kayıtlar için okunur; gizli bir listedeki yapımın puanı dolaylı yoldan hesaba girmez.
//
// İstemcide OLMAYANLAR (algoritma §2, rehber §2.1): TMDB oy ortalaması/sayısı, köken dili, anahtar kelime,
// dizinin yayın durumu. Bu yüzden:
//   • K3 "lite" kipte (tür + süre kovası; liste kaydında yıl yok),
//   • anime kendi kulvarına ayrılamaz (köken dili yok) → film/dizi kulvarında kalır,
//   • "diziyi yarıda bıraktı" sinyali ÇIKARILMAZ (yayın durumu yok; devam eden dizi bırakılmış sayılmasın),
//   • nadirlik ve şans dağılımı varsayılanlarla çalışır (nüfus yok; bağlam `{}`).
// Sonuç yalnız GELİŞTİRİCİ gözlemi içindir; kullanıcıya gösterilmez.

import { buildProfile, scorePair, verdictOf } from "./tasteMatchV3";

const asArray = (v) => (Array.isArray(v) ? v : []);
const validId = (id) => Number.isInteger(Number(id)) && Number(id) > 0;
const keyOf = (type, id) => `${type === "tv" ? "tv" : "movie"}_${Number(id)}`;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

export const SHADOW_LANES = Object.freeze(["movie", "tv", "all"]);

/** Tarih → ms. Sayı (ms/sn), ISO metni, Firestore Timestamp ({seconds} / toMillis). */
export function toMillis(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? (value > 1e12 ? value : value * 1000) : null;
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : null;
  }
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (isNum(value.seconds)) return value.seconds * 1000;
  return null;
}

const ratingOf = (ratings, key) => {
  const n = Number(ratings?.[key]);
  return Number.isFinite(n) && n > 0 ? Math.min(10, n) : null;
};

const genresOf = (item) =>
  asArray(item?.genres)
    .map((g) => (typeof g === "string" ? g : g?.name))
    .filter((g) => typeof g === "string" && g.trim());

/** Dizi kaydından örtük sinyal: bitirdi / sonraki sezona geçti. Bırakma çıkarılmaz (yukarıya bak). */
function tvSignal(show) {
  const total = Number(show?.showEpisodeCount);
  const watched = Number(show?.watchedEpisodeCount);
  const seasons = Number(show?.watchedSeasonCount);
  const finished = isNum(total) && total > 0 && isNum(watched) && watched >= total;
  const nextSeason = isNum(seasons) && seasons >= 2;
  if (!finished && !nextSeason) return null;
  return { finished, nextSeason };
}

/** Bölüm başına ortalama dakika (süre kovası için); bilinmiyorsa null. */
function episodeMinutes(show) {
  const total = Number(show?.totalMinutes);
  const count = Number(show?.watchedEpisodeCount);
  return isNum(total) && total > 0 && isNum(count) && count > 0 ? total / count : null;
}

/**
 * Bir tarafı çekirdek girdisine çevirir: `{ items }`. Görünmeyen (null) listeler atlanır.
 * @returns {{ items: Array<object> }}
 */
export function sideToTasteUser(side) {
  const s = side || {};
  const ratings = s.ratings && typeof s.ratings === "object" ? s.ratings : {};
  const favoriteKeys = new Set();
  for (const f of asArray(s.favorites)) {
    if (!f || !validId(f.id)) continue;
    favoriteKeys.add(keyOf(f.type === "tv" || f.media_type === "tv" ? "tv" : "movie", f.id));
  }
  const byKey = new Map();
  const put = (item) => {
    if (!byKey.has(item.key)) byKey.set(item.key, item);
  };

  for (const m of asArray(s.watchedMovies)) {
    if (!m || !validId(m.id)) continue;
    const key = keyOf("movie", m.id);
    const events = asArray(m.watchEvents).length;
    const minutes = Number(m.minutes);
    put({
      key,
      type: "movie",
      genres: genresOf(m),
      minutes: isNum(minutes) && minutes > 0 ? minutes : undefined,
      addedAt: toMillis(m.dateAdded) ?? undefined,
      watchCount: events || undefined,
      favorite: favoriteKeys.has(key) || undefined,
      rating: ratingOf(ratings, key) ?? undefined,
    });
  }
  for (const t of asArray(s.watchedShows)) {
    if (!t || !validId(t.id)) continue;
    const key = keyOf("tv", t.id);
    put({
      key,
      type: "tv",
      genres: genresOf(t),
      minutes: episodeMinutes(t) ?? undefined,
      addedAt: toMillis(t.addedShowDate ?? t.dateAdded) ?? undefined,
      tv: tvSignal(t) ?? undefined,
      favorite: favoriteKeys.has(key) || undefined,
      rating: ratingOf(ratings, key) ?? undefined,
    });
  }
  // Favori ama izlenenlerde yok (ya da izlenen listesi gizli): beğeni yine de bir izleme kanıtıdır.
  for (const f of asArray(s.favorites)) {
    if (!f || !validId(f.id)) continue;
    const type = f.type === "tv" || f.media_type === "tv" ? "tv" : "movie";
    const key = keyOf(type, f.id);
    put({
      key,
      type,
      genres: genresOf(f),
      addedAt: toMillis(f.dateAdded) ?? undefined,
      favorite: true,
      rating: ratingOf(ratings, key) ?? undefined,
    });
  }
  // undefined alanları at: profil düz JSON kalsın.
  const items = [...byKey.values()].map((it) => {
    const out = {};
    for (const [k, v] of Object.entries(it)) if (v !== undefined) out[k] = v;
    return out;
  });
  return { items };
}

/** Kulvar süzgeci. "all" = film + dizi birlikte (yalnız eski kartla kıyas için; tasarımda kulvarlar ayrı). */
export function laneItems(user, lane) {
  const items = asArray(user?.items);
  if (lane === "all") return { items };
  return { items: items.filter((it) => (lane === "tv" ? it.type === "tv" : it.type !== "tv")) };
}

const r3 = (v) => (isNum(v) ? Math.round(v * 1000) / 1000 : null);

/** Tek kulvar sonucunun gölge özeti (ham liste ya da yapım anahtarı İÇERMEZ). */
export function summarizeResult(result, nA, nB) {
  if (!result) return { nA, nB, score: null };
  return {
    nA,
    nB,
    score: result.score,
    display: result.display,
    verdict: verdictOf(result),
    K1: r3(result.K1),
    K2: r3(result.K2),
    K3: r3(result.K3),
    E1: r3(result.E1),
    common: result.common,
    binding: result.flags.binding,
    opinionGate: !!result.flags.opinionGate,
    immature: !!result.flags.immature,
    guide: !!result.flags.guide,
    implicitHeavy: !!result.flags.implicitHeavy,
  };
}

/**
 * Arkadaşın görmediğimiz kategorisini BENİM tarafımda da kapatır: o kategoride benim izlediklerim
 * "onun izlemediği" sayılırsa seçim benzerliği haksızca düşer (bilinmeyen ≠ izlemedi).
 */
export function mirrorVisibility(mine, theirs) {
  const m = mine || {};
  const t = theirs || {};
  return {
    ...m,
    watchedMovies: t.watchedMovies == null ? null : m.watchedMovies,
    watchedShows: t.watchedShows == null ? null : m.watchedShows,
    favorites: t.favorites == null ? null : m.favorites,
  };
}

/**
 * Faz 2 gölge karşılaştırması: iki taraf için kulvar başına v3 skoru.
 * @param {object} mySide   tasteMatch.js taraf şekli
 * @param {object} theirSide tasteMatch.js taraf şekli (görünmeyen listeler null)
 * @param {{ ctx?: object, now?: number }} [options] bağlam yoksa varsayılanlar (küçük havuz)
 * @returns {{ lanes: Record<string, object> }}
 */
export function shadowCompare(mySide, theirSide, { ctx = {}, now = Date.now() } = {}) {
  const a = sideToTasteUser(mirrorVisibility(mySide, theirSide));
  const b = sideToTasteUser(theirSide);
  const lanes = {};
  for (const lane of SHADOW_LANES) {
    const la = laneItems(a, lane);
    const lb = laneItems(b, lane);
    const pa = buildProfile(la, ctx, { now });
    const pb = buildProfile(lb, ctx, { now });
    lanes[lane] = summarizeResult(scorePair(pa, pb, ctx), pa.n, pb.n);
  }
  return { lanes };
}
