// services/profileBannerService.js
//
// Profil kapağı seçicisinin ağ tarafı: seçilen film/dizinin sahne görselleri
// (TMDB /images → backdrops). Saf sıralama utils/profileBanner.js'te.

import { readTmdb } from "./favoriteRecommendations";
import { langOf } from "../utils/mediaFacts";
import { pickBannerCandidates } from "../utils/profileBanner";

/**
 * @param {{ id:number, type:"movie"|"tv", apiKey:string, language:string }} p
 * @returns {Promise<Array<{path:string, textless:boolean}>>}
 * @throws ağ hatasında (seçici "yüklenemedi" gösterir)
 */
export async function fetchBannerCandidates({ id, type, apiKey, language }) {
  const kind = type === "tv" ? "tv" : "movie";
  if (!id || !apiKey) return [];
  const lang = langOf(language);
  const data = await readTmdb(`/${kind}/${id}/images`, {
    apiKey,
    language,
    type: kind,
    // Yazısız sahneler (null) + İngilizce + uygulama dili.
    query: `include_image_language=null,en${lang && lang !== "en" ? `,${lang}` : ""}`,
  });
  return pickBannerCandidates(data);
}
