// hooks/useMatchTitles.js
//
// Eşleşme kartlarındaki yapım anahtarlarının ("movie_550") adı + afişi. Öneri belgesi yalnız ANAHTAR taşır
// (sunucu ad/afiş saklamaz); burada TMDB ayrıntısı okunur. Disk önbelleği services/favoriteRecommendations
// readTmdb (URL başına, 30 gün) → aynı yapım ikinci kez ağdan istenmez.

import { useEffect, useState } from "react";
import { useApiSettings } from "../context/AppSettingsContext";
import { useLanguage } from "../context/LanguageContext";
import { readTmdb } from "../services/favoriteRecommendations";
import { parseTitleKey } from "../utils/matchSuggestions";

const MAX_AGE = 30 * 24 * 60 * 60 * 1000;

/** @returns {Record<string, { name: string, posterPath: string|null }>} */
export default function useMatchTitles(keys) {
  const { API_KEY } = useApiSettings() || {};
  const { language } = useLanguage();
  const [titles, setTitles] = useState({});
  const signature = (keys || []).join(",");

  useEffect(() => {
    const list = (keys || []).map(parseTitleKey).filter(Boolean);
    if (!API_KEY || !list.length) return undefined;
    let alive = true;
    Promise.all(
      list.map(({ key, type, id }) =>
        readTmdb(`/${type}/${id}`, { apiKey: API_KEY, language, type, maxAge: MAX_AGE })
          .then((d) => [key, { name: d?.title || d?.name || "", posterPath: d?.poster_path || null }])
          .catch(() => null),
      ),
    ).then((rows) => {
      if (alive) setTitles((prev) => ({ ...prev, ...Object.fromEntries(rows.filter(Boolean)) }));
    });
    return () => {
      alive = false;
    };
    // signature: aynı anahtar kümesi için yeniden okuma yok.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, API_KEY, language]);

  return titles;
}
