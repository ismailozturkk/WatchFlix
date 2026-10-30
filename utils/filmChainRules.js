// utils/filmChainRules.js
//
// Film Zinciri'nin KENAR KURALI: bir oyuncunun hangi filmleri ve bir filmin hangi oyuncuları zincirde kullanılabilir.
// Oyun (services/filmChainService → ekran listeleri) ile bulmaca üreticisi (scripts/build-film-chain-puzzles.mjs)
// AYNI kuralı kullanmalı; yoksa önceden hesaplanan "en kısa" (par) oyunda ulaşılamaz olur. Bu yüzden bu dosya
// HİÇBİR ŞEY içe aktarmaz (Node script'i alias'sız, doğrudan okur).
//
// Kural değişirse data/filmChainPuzzles.js yeniden üretilmeli (bkz. docs/ozellikler/FILM_ZINCIRI.md).

export const CHAIN_MIN_FILM_VOTES = 100;
export const CHAIN_CAST_LIMIT = 25;
const DOCUMENTARY = 99;
// "Kendisi" rolleri ve arşiv görüntüsü (eski bir filmden kesit — oyuncu o filmde gerçekten oynamadı).
const SELF_ROLE = /\b(himself|herself|themselves|self|archive footage|archival footage)\b/i;

const todayIso = (now) => new Date(now).toISOString().slice(0, 10);

/** Rol "kendisi" mi (talk show, belgesel, kamera arkası)? */
export function isSelfRole(character) {
  return SELF_ROLE.test(String(character || ""));
}

/** Kadro kaydı zincir rolü sayılır mı (ilk 25 isim, kendisi değil, yetişkin değil). */
export function isChainRole(credit) {
  if (!credit || credit.adult) return false;
  const order = Number(credit.order);
  if (!Number.isFinite(order) || order >= CHAIN_CAST_LIMIT) return false;
  return !isSelfRole(credit.character);
}

/** Oyuncunun film kaydı (person movie_credits.cast öğesi) zincir filmi sayılır mı. */
export function isChainFilm(credit, now = Date.now()) {
  if (!isChainRole(credit)) return false;
  if (!credit.id || !credit.release_date || credit.release_date > todayIso(now)) return false;
  if (Array.isArray(credit.genre_ids) && credit.genre_ids.includes(DOCUMENTARY)) return false;
  return Number(credit.vote_count) >= CHAIN_MIN_FILM_VOTES;
}

/** person/{id}/movie_credits → [{ id, title, year, posterPath, character, popularity }] (popülerden aza, tekil). */
export function chainFilmsOf(credits, now = Date.now()) {
  const cast = Array.isArray(credits?.cast) ? credits.cast : [];
  const seen = new Set();
  const films = [];
  cast.forEach((credit) => {
    if (!isChainFilm(credit, now) || seen.has(credit.id)) return;
    seen.add(credit.id);
    films.push({
      id: credit.id,
      title: credit.title || credit.original_title || "",
      year: Number(String(credit.release_date).slice(0, 4)) || null,
      posterPath: credit.poster_path || null,
      character: credit.character || "",
      popularity: Number(credit.popularity) || 0,
    });
  });
  return films.sort((a, b) => b.popularity - a.popularity || a.id - b.id);
}

/** movie/{id}/credits → [{ id, name, profilePath, character, order }] (TMDB sırasıyla, tekil). */
export function chainCastOf(credits) {
  const cast = Array.isArray(credits?.cast) ? credits.cast : [];
  const seen = new Set();
  const people = [];
  cast.forEach((credit) => {
    if (!isChainRole(credit) || !credit.id || seen.has(credit.id)) return;
    seen.add(credit.id);
    people.push({
      id: credit.id,
      name: credit.name || credit.original_name || "",
      profilePath: credit.profile_path || null,
      character: credit.character || "",
      order: Number(credit.order),
      popularity: Number(credit.popularity) || 0,
    });
  });
  return people.sort((a, b) => a.order - b.order);
}
