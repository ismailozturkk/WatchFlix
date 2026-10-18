// services/mediaLinkResolver.js
//
// Çözümlenmiş bir film/dizi bağlantısını TMDB { type, id } çiftine çevirir (utils/mediaLinks.parseMediaLink çıktısı).
//   • TMDB bağlantısı → ağ gerekmez.
//   • IMDb bağlantısı → TMDB `/find/{imdb_id}?external_source=imdb_id`. Film ya da dizi sonucu alınır; bir BÖLÜM
//     bağlantısıysa o bölümün dizisi (`tv_episode_results[0].show_id`) açılır. Sonuç yoksa null.
// Çağrı URL başına önbelleklenir (services/favoriteRecommendations.readTmdb; kimlik eşlemesi değişmez → 30 gün).
// ASLA FIRLATMAZ: ağ / anahtar hatasında null döner, çağıran "bulunamadı" der.

import { readTmdb } from "./favoriteRecommendations";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

/** @returns {Promise<{type:"movie"|"tv", id:number}|null>} */
export async function resolveMediaLink(link, { apiKey, language } = {}) {
  if (!link) return null;
  if (link.source === "tmdb") return { type: link.type, id: link.id };
  if (link.source !== "imdb" || !apiKey) return null;
  try {
    const data = await readTmdb(`/find/${link.imdbId}`, {
      apiKey,
      language,
      type: "movie",
      maxAge: THIRTY_DAYS,
      query: "external_source=imdb_id",
    });
    const movie = data?.movie_results?.[0];
    if (movie?.id) return { type: "movie", id: movie.id };
    const show = data?.tv_results?.[0];
    if (show?.id) return { type: "tv", id: show.id };
    const episode = data?.tv_episode_results?.[0];
    if (episode?.show_id) return { type: "tv", id: episode.show_id };
    return null;
  } catch {
    return null;
  }
}
