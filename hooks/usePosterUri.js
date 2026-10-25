// hooks/usePosterUri.js
//
// Afiş adresini tek adımda kurar: özel afiş seçimini uygular (context/PosterChoicesContext)
// ve boyutu kullanıcının görsel kalitesine göre seçer (AppSettingsContext.getTmdbUrl).
//
//   const posterUri = usePosterUri();
//   <Image source={{ uri: posterUri("movie", item.id, item.poster_path, 120) }} />
//
// Yol yoksa (ve seçim de yoksa) null döner — çağıran yer tutucusunu çizer.

import { useCallback } from "react";
import { useImageQualitySettings } from "../context/AppSettingsContext";
import { usePosterResolver } from "../context/PosterChoicesContext";

export default function usePosterUri() {
  const resolvePoster = usePosterResolver();
  const { getTmdbUrl } = useImageQualitySettings();
  return useCallback(
    (type, id, path, width = 200) => {
      const resolved = resolvePoster(type, id, path);
      return resolved ? getTmdbUrl(resolved, "poster", width) : null;
    },
    [getTmdbUrl, resolvePoster],
  );
}
