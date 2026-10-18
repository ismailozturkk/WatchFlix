// utils/mediaLinks.js
//
// Film / dizi BAĞLANTISI tanıma — SAF (RN/ağ importu yok). Arama ekranına yapıştırılan (ya da panodaki)
// TMDB / IMDb bağlantısını yakalar; IMDb kimliğini TMDB kimliğine çevirmek services/mediaLinkResolver.js'te.
//
// Desteklenen biçimler:
//   • https://www.themoviedb.org/movie/603-the-matrix      (yerel önek de olur: /en/, /tr-TR/)
//   • https://www.themoviedb.org/tv/1399-game-of-thrones
//   • https://www.imdb.com/title/tt0133093/?ref_=nv_sr_1   (m.imdb.com ve /en/ öneki dahil)
// Bağlantı METNİN İÇİNDE de olabilir ("Şuna bak! https://… harika"): ilk eşleşen alınır.
// IMDb bölüm (tt…) bağlantısı dizi bölümünü gösterebilir; TMDB'ye çevrilirken dizi ya da bölüm sonucuna bakılır.
// Başka siteler (Letterboxd, Netflix…) tanınmaz: kimlikleri TMDB'ye çevrilemez.

const TMDB = /themoviedb\.org\/(?:[a-z]{2}(?:-[A-Za-z]{2})?\/)?(movie|tv)\/(\d{1,9})(?![\d])/i;
const IMDB = /imdb\.com\/(?:[a-z]{2}\/)?title\/(tt\d{6,10})(?![\d])/i;

/**
 * @param {string} text
 * @returns {{ source: "tmdb", type: "movie"|"tv", id: number } | { source: "imdb", imdbId: string } | null}
 */
export function parseMediaLink(text) {
  if (typeof text !== "string") return null;
  const value = text.trim();
  if (value.length < 10 || value.length > 600) return null;
  const tmdb = TMDB.exec(value);
  const imdb = IMDB.exec(value);
  // İkisi birden varsa METİNDE önce geçen kazanır.
  if (tmdb && (!imdb || tmdb.index <= imdb.index)) {
    const id = Number(tmdb[2]);
    return id > 0 ? { source: "tmdb", type: tmdb[1].toLowerCase(), id } : null;
  }
  if (imdb) return { source: "imdb", imdbId: imdb[1].toLowerCase() };
  return null;
}

/** Metin bir film/dizi bağlantısı içeriyor mu? (yazarken ucuz ön süzgeç) */
export const looksLikeMediaLink = (text) => typeof text === "string" && /themoviedb\.org|imdb\.com/i.test(text) && parseMediaLink(text) !== null;
