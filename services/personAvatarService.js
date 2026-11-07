// services/personAvatarService.js
//
// Oyuncu / yönetmen fotoğrafını avatar yapma — TMDB'ye dokunan taraf.
// Kararlar (süzme, bölümler, seçim nesnesi) utils/personAvatars.js +
// utils/avatarPhotos.js'te; burada yalnız veri çekilir.
//
// ÖNBELLEK: readTmdb URL başına önbellekler (sorgu URL'in içinde). Popüler
// liste gün içinde pek oynamaz → 12 sa; arama 6 sa (aynı adı tekrar yazan
// kullanıcı ağa çıkmaz). Çevrimdışıyken eski kayıt döner.
//
// YETİŞKİN İÇERİK: avatar herkese görünür, bu yüzden kullanıcının ayarından
// bağımsız `include_adult=false` istenir; ağ katmanı (utils/tmdbAdultGuard)
// ayar açıkken bunu değiştirse bile satırlar `adult` işaretine göre ayrıca
// süzülür (personAvatarChoice).

import { readTmdb } from "./favoriteRecommendations";
import { PERSON_SEARCH_MIN_CHARS, toPersonAvatarRows } from "../utils/personAvatars";

const SEARCH_TTL = 6 * 60 * 60 * 1000;
const POPULAR_TTL = 12 * 60 * 60 * 1000;

/**
 * Kişi araması → seçici satırları (yalnız oyuncu ve yönetmen).
 * @throws ağ hatasında (seçici "aranamadı" gösterir)
 */
export async function searchPersonAvatars({ query, apiKey, language }) {
  const text = String(query || "").trim();
  if (text.length < PERSON_SEARCH_MIN_CHARS || !apiKey) return [];
  const data = await readTmdb("/search/person", {
    apiKey,
    language,
    maxAge: SEARCH_TTL,
    query: `query=${encodeURIComponent(text)}&include_adult=false&page=1`,
  });
  return toPersonAvatarRows(data?.results);
}

/**
 * Popüler kişiler (iki sayfa: oyuncuların arasından yönetmenler de çıksın).
 * Bir sayfa düşerse diğeriyle yetinilir; ikisi de düşerse hata fırlar.
 *
 * Ham kişi listesi döner — bölümlere ayırma (favori/takip ile tekrarı eleme)
 * utils/personAvatars.buildPersonAvatarSections'ta.
 */
export async function fetchPopularPeople({ apiKey, language }) {
  if (!apiKey) return [];
  const pages = await Promise.allSettled(
    [1, 2].map((page) =>
      readTmdb("/person/popular", { apiKey, language, maxAge: POPULAR_TTL, query: `page=${page}` }),
    ),
  );
  const ok = pages.filter((p) => p.status === "fulfilled");
  if (!ok.length) throw pages[0].reason || new Error("popular-people-failed");
  return ok.flatMap((p) => (Array.isArray(p.value?.results) ? p.value.results : []));
}
