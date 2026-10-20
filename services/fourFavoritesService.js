// services/fourFavoritesService.js
//
// "Dört favori"nin RN/Firebase'e dokunan tarafı:
//
//   KAYIT    saveFourFavorites        Users/{uid}.fourFavorites
//   AKTARMA  adoptPendingFavorites    tanıtımda (hesap YOKKEN) cihaza yazılan seçimler
//                                     (services/pendingFavorites.js) kayıt/giriş
//                                     sonrası profile bir kez taşınır
//   ARAMA    searchFavorites          seçicideki TMDB araması
//   ÖNERİ    fetchPickerSuggestions   seçicinin boş hâli (sorgu yokken)
//
// Saf kararlar (sınır, normalizasyon, sıralama) utils/fourFavorites.js'te.

import { doc, runTransaction, serverTimestamp } from "firebase/firestore";

import { db } from "../firebase";
import { updateUserProfile } from "./userService";
import { clearPendingFavorites, readPendingFavorites } from "./pendingFavorites";
import { searchMediaWithFuzzyFallback } from "./fuzzyMediaSearch";
import { fetchFavoriteRecommendations, readTmdb } from "./favoriteRecommendations";
import { adultContentAllowed } from "../utils/ageGate";
import { langOf } from "../utils/mediaFacts";
import {
  normalizeFavorites,
  rankRecommendations,
  recommendationSources,
  toPickerRows,
  toProfilePayload,
} from "../utils/fourFavorites";

const KIND_TYPE = { movies: "movie", shows: "tv", people: "person" };
export const MIN_SEARCH_CHARS = 2;

/* ───────────────────────── Kayıt ───────────────────────── */

/** Profile yazar. Boş (0 favori) yazmak da geçerli: "hepsini kaldırdım" demek. */
export async function saveFourFavorites(uid, favorites) {
  if (!uid) throw new Error("saveFourFavorites: uid yok");
  await updateUserProfile(uid, { fourFavorites: toProfilePayload(favorites) });
}

/* ─────────── Tanıtımda seçilenler (kayıttan ÖNCE) ─────────── */
// Geçici kopyanın okuma/yazma/silmesi services/pendingFavorites.js'te (Firebase'siz).

/**
 * Tanıtımda seçilen favorileri hesaba taşır. Kayıt/giriş sonrası profil
 * yüklenince çağrılır (context/UserProfileContext.js).
 *
 * KURAL: hesapta `fourFavorites` alanı VARSA ona dokunulmaz (mevcut hesaba
 * giriş yapan kullanıcının eski seçimleri ezilmesin); bekleyen kopya yine de
 * silinir ki bir sonraki hesaba sızmasın. Alan YOKSA (yeni hesap) yazılır.
 *
 * TRANSACTION: karar sunucudaki gerçek belgeye göre verilir. Çevrimdışıyken
 * transaction düşer ve bekleyen kopya KALIR — sonraki profil yüklemesinde yine
 * denenir. Önbellekten okuyan düz bir getDoc, başka cihazda doldurulmuş alanı
 * görmeyip üzerine yazabilirdi.
 *
 * @returns {Promise<"none"|"adopted"|"kept"|"no-profile"|"offline">}
 */
export async function adoptPendingFavorites(uid) {
  const pending = readPendingFavorites();
  if (!uid || !pending) return "none";

  try {
    const ref = doc(db, "Users", uid);
    const outcome = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return "no-profile";
      if (snap.data().fourFavorites !== undefined) return "kept";
      tx.update(ref, {
        fourFavorites: toProfilePayload(pending),
        updatedAt: serverTimestamp(),
      });
      return "adopted";
    });
    if (outcome !== "no-profile") clearPendingFavorites();
    return outcome;
  } catch {
    return "offline";
  }
}

/* ───────────────────────── Arama ───────────────────────── */

/**
 * Seçici araması. Film/dizi/oyuncu için aynı fuzzy servis (yazım hatası
 * toleransı: "intersteller" → Interstellar) — uygulamanın diğer aramalarıyla
 * aynı davranış.
 *
 * Yetişkin içerik: `adultContentAllowed()` (ayar + yaş kapısı). Ham ayarı okuma —
 * 18 altı hesapta kapıyı atlar. Ağ katmanı da /search uçlarında ayrıca zorlar.
 *
 * @returns {Promise<Array<{key:string, entry:object, subtitle:string}>>}
 * @throws ağ hatasında (seçici "aranamadı" gösterir)
 */
export async function searchFavorites({ kind, query, apiKey, language, exclude = [] }) {
  const text = String(query || "").trim();
  if (!KIND_TYPE[kind] || text.length < MIN_SEARCH_CHARS || !apiKey) return [];
  const { results } = await searchMediaWithFuzzyFallback({
    mediaType: KIND_TYPE[kind],
    query: text,
    language: langOf(language),
    adultContent: adultContentAllowed(),
    API_KEY: apiKey,
  });
  return toPickerRows(kind, results, { exclude });
}

/* ───────────────────────── Seçici önerileri ───────────────────────── */

const POPULAR_PATH = { movies: "/movie/popular", shows: "/tv/popular", people: "/person/popular" };

/**
 * Seçilen filmlerin/dizilerin kadrosundan oyuncu önerisi: birden çok seçimde
 * oynayan öne çıkar. Oyuncu seçicisinin "sana göre" hâli.
 */
async function castOfPicks({ favorites, apiKey, language, exclude }) {
  const picks = [
    ...favorites.movies.map((item) => ({ ...item, type: "movie" })),
    ...favorites.shows.map((item) => ({ ...item, type: "tv" })),
  ];
  if (!picks.length) return [];
  const settled = await Promise.all(
    picks.map(async (pick) => {
      try {
        const data = await readTmdb(`/${pick.type}/${pick.id}/credits`, {
          apiKey,
          language,
          type: pick.type,
        });
        const cast = (Array.isArray(data?.cast) ? data.cast : [])
          .filter((person) => person.known_for_department === "Acting")
          .slice(0, 8)
          // rankRecommendations posterli öğe ister; kişide görsel `profile_path`.
          .map((person) => ({ ...person, poster_path: person.profile_path }));
        return { ok: true, source: { key: pick.id, title: pick.title }, items: cast };
      } catch {
        return { ok: false };
      }
    }),
  );
  const ok = settled.filter((entry) => entry.ok);
  if (!ok.length) return [];
  return rankRecommendations(ok, { exclude, limit: 30 });
}

/**
 * Seçicinin sorgu yokken gösterdiği liste.
 *
 * ÖNCELİK: seçimden gelen öneri → popüler. Seçim yokken ya da öneri boş/hatalı
 * kalınca popülere düşülür; kullanıcı asla boş bir panel görmez.
 *
 * @returns {Promise<{variant:"basedOnPicks"|"castOfPicks"|"popular", rows:Array}>}
 */
export async function fetchPickerSuggestions({ kind, favorites, apiKey, language }) {
  const picked = normalizeFavorites(favorites);
  const exclude = picked[kind].map((item) => item.id);
  if (!KIND_TYPE[kind] || !apiKey) return { variant: "popular", rows: [] };

  try {
    if (kind === "people") {
      const people = await castOfPicks({ favorites: picked, apiKey, language, exclude });
      if (people.length) {
        return {
          variant: "castOfPicks",
          rows: toPickerRows("people", people, { exclude }),
        };
      }
    } else {
      const type = KIND_TYPE[kind];
      if (recommendationSources(picked, type).length) {
        const { items } = await fetchFavoriteRecommendations({
          favorites: picked,
          mediaType: type,
          apiKey,
          language,
          limit: 30,
        });
        const rows = toPickerRows(kind, items, { exclude });
        if (rows.length) return { variant: "basedOnPicks", rows };
      }
    }
  } catch {
    // Popülere düşülecek.
  }

  const data = await readTmdb(POPULAR_PATH[kind], {
    apiKey,
    language,
    type: kind === "shows" ? "tv" : "movie",
  });
  const results =
    kind === "people"
      ? (data?.results || []).filter((person) => person.known_for_department === "Acting")
      : data?.results;
  return { variant: "popular", rows: toPickerRows(kind, results, { exclude }) };
}
