// screens/onboarding/useOnboardingData.js
//
// Tanıtım akışının TMDB verisi: en çok oy alan film + dizi (arka plan posterleri
// ve vitrin içerikleri) ile bölgeye uygun izleme platformları. Ağ başarısız olursa
// sessizce boş kalır; slaytlar veri olmadan da düzgün görünür.

import { tmdbLanguageOf, tmdbRegionOf } from "../../utils/appLanguages";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { STREAMING_PROVIDERS } from "../../context/AppSettingsContext";

const TMDB = "https://api.themoviedb.org/3";

const genreMap = (list) => {
  const out = {};
  (list || []).forEach((genre) => {
    out[genre.id] = genre.name;
  });
  return out;
};

const normalizeTitles = (list, type, genres) =>
  (list || [])
    .filter((item) => item.poster_path)
    .map((item) => {
      const date = type === "movie" ? item.release_date : item.first_air_date;
      return {
        id: item.id,
        media_type: type,
        title: type === "movie" ? item.title : item.name,
        poster_path: item.poster_path,
        vote_average: Math.round((item.vote_average || 0) * 10) / 10,
        release_date: date,
        year: String(date || "").slice(0, 4),
        overview: item.overview || "",
        genres: (item.genre_ids || []).map((id) => genres[id]).filter(Boolean).slice(0, 3),
      };
    });

// Fisher–Yates: ilk açılışta her kullanıcı aynı poster sırasını görmesin.
const shuffled = (list) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const baseProviderCatalog = () =>
  STREAMING_PROVIDERS.map((provider, priority) => ({
    ...provider,
    logoPath: null,
    priority,
    mediaTypes: ["movie", "tv"],
  }));

export default function useOnboardingData({ apiKey, language, getTmdbUrl, accent }) {
  const [posters, setPosters] = useState([]); // TMDB poster URI'leri (duvar için)
  const [posterPaths, setPosterPaths] = useState([]); // ham poster_path'ler
  const [mediaItems, setMediaItems] = useState([]); // tam film/dizi nesneleri
  const [providerCatalog, setProviderCatalog] = useState(baseProviderCatalog);

  // getTmdbUrl / accent her render'da yeni kimlik alabilir; efekt bunlara bağlı
  // kalırsa ağ isteği tekrar tekrar atılır. En günceli ref'ten okunur.
  const latest = useRef({ getTmdbUrl, accent });
  latest.current = { getTmdbUrl, accent };

  useEffect(() => {
    let alive = true;
    const tmdbLanguage = tmdbLanguageOf(language);
    const headers = { accept: "application/json", Authorization: apiKey };

    (async () => {
      try {
        const [movies, shows, movieGenres, tvGenres] = await Promise.all([
          axios.get(`${TMDB}/discover/movie`, {
            params: { sort_by: "vote_count.desc", language: tmdbLanguage, page: 1 },
            headers,
          }),
          axios.get(`${TMDB}/discover/tv`, {
            params: { sort_by: "vote_count.desc", language: tmdbLanguage, page: 1 },
            headers,
          }),
          axios.get(`${TMDB}/genre/movie/list`, { params: { language: tmdbLanguage }, headers }),
          axios.get(`${TMDB}/genre/tv/list`, { params: { language: tmdbLanguage }, headers }),
        ]);

        // Tanınırlık için popülerlik sırası korunur (film önce, dizi sonra).
        const items = [
          ...normalizeTitles(movies.data?.results, "movie", genreMap(movieGenres.data?.genres)),
          ...normalizeTitles(shows.data?.results, "tv", genreMap(tvGenres.data?.genres)),
        ];
        if (!items.length || !alive) return;

        const paths = shuffled(items.map((item) => item.poster_path));
        const uris = paths
          .map((path) => latest.current.getTmdbUrl(path, "poster", 200))
          .filter(Boolean);

        setMediaItems(items);
        setPosterPaths(paths);
        if (uris.length) setPosters(uris);
      } catch (error) {
        // Veri yoksa slaytlar yine de düzgün görünür.
      }
    })();

    return () => {
      alive = false;
    };
  }, [apiKey, language]);

  // Bölgeye uygun film ve dizi platformları; aynı sağlayıcının iki katalogdaki
  // varlığı birleştirilir ve gerçek logo_path korunur.
  useEffect(() => {
    let alive = true;
    const tmdbLanguage = tmdbLanguageOf(language);
    const region = tmdbRegionOf(language);
    const headers = { accept: "application/json", Authorization: apiKey };

    (async () => {
      try {
        const [movieResponse, tvResponse] = await Promise.all([
          axios.get(`${TMDB}/watch/providers/movie`, {
            params: { language: tmdbLanguage, watch_region: region },
            headers,
          }),
          axios.get(`${TMDB}/watch/providers/tv`, {
            params: { language: tmdbLanguage, watch_region: region },
            headers,
          }),
        ]);

        const merged = new Map();
        const add = (list, mediaType) => {
          (list || []).forEach((provider) => {
            if (!provider?.provider_id) return;
            const current = merged.get(provider.provider_id);
            merged.set(provider.provider_id, {
              id: provider.provider_id,
              name: provider.provider_name,
              color:
                STREAMING_PROVIDERS.find((item) => item.id === provider.provider_id)?.color ||
                latest.current.accent,
              logoPath: provider.logo_path || current?.logoPath || null,
              priority: Math.min(
                Number(provider.display_priority ?? 9999),
                Number(current?.priority ?? 9999),
              ),
              mediaTypes: [...new Set([...(current?.mediaTypes || []), mediaType])],
            });
          });
        };
        add(movieResponse.data?.results, "movie");
        add(tvResponse.data?.results, "tv");

        const next = [...merged.values()].sort(
          (a, b) => a.priority - b.priority || a.name.localeCompare(b.name),
        );
        if (alive && next.length) setProviderCatalog(next);
      } catch (error) {
        // Başlangıçtaki temel katalog çevrimdışıyken de seçimi kullanılabilir tutar.
      }
    })();

    return () => {
      alive = false;
    };
  }, [apiKey, language]);

  return { posters, posterPaths, mediaItems, providerCatalog };
}
