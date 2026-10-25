// hooks/useBackdropUri.js
//
// Arka plan adresini tek adımda kurar: özel arka plan seçimini uygular
// (context/PosterChoicesContext) ve boyutu kullanıcının görsel kalitesine göre seçer.
// Afiş karşılığı: hooks/usePosterUri.js.
//
//   const backdropUri = useBackdropUri();
//   <Image source={{ uri: backdropUri("movie", details.id, details.backdrop_path, 1000) }} />
//
// Yol yoksa (ve seçim de yoksa) null döner — çağıran yer tutucusunu çizer.

import { useCallback } from "react";
import { useImageQualitySettings } from "../context/AppSettingsContext";
import { useBackdropResolver } from "../context/PosterChoicesContext";

export default function useBackdropUri() {
  const resolveBackdrop = useBackdropResolver();
  const { getTmdbUrl } = useImageQualitySettings();
  return useCallback(
    (type, id, path, width = 1000) => {
      const resolved = resolveBackdrop(type, id, path);
      return resolved ? getTmdbUrl(resolved, "backdrop", width) : null;
    },
    [getTmdbUrl, resolveBackdrop],
  );
}
