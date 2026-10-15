// hooks/useHomeContentSettings.js
//
// Ana ekran (Film / Dizi) yapılarının ayarlara bağlanma noktası. Mantık
// utils/homeContentSettings.js'te; burada yalnız bağlamlar okunup türetiliyor.
//
// İKİ HOOK, bilerek ayrı:
//   useHomeDataSettings()  → VERİYİ değiştiren ayarlar (yetişkin içerik, platform
//                            üyelikleri). Film/Dizi bağlamları ve keşif rayı bunu
//                            kullanır: efekt bağımlılığı + önbellek kapsamı.
//   useHomeRenderKey()     → yalnız ÇİZİMİ değiştiren ayarlar (poster kalitesi,
//                            ray boyutu/köşesi, rozetler). Ortak yatay ray
//                            (PaginatedRail) bunu `extraData` yapar.
//
// Ayrı olmalarının nedeni: veri bağlamları (MovieProvider/TvShowProvider) tüm
// uygulamanın yaşadığı sağlayıcılar; liste yerleşimi ayarı değişince
// yeniden çalışmaları gereksiz olurdu.

import { useMemo } from "react";
import {
  useContentSettings,
  useImageQualitySettings,
  useListLayoutSettings,
  useStreamingProviderSettings,
} from "../context/AppSettingsContext";
import { buildHomeContentSettings } from "../utils/homeContentSettings";

/** @returns {{ adultContent: boolean, adultScope: string, providersKey: string }} */
export function useHomeDataSettings() {
  // `adultContent` ETKİN değerdir: ayar açık VE hesap yaş kısıtlı değil
  // (bkz. AppSettingsContext, utils/ageGate.js).
  const { adultContent } = useContentSettings();
  const { streamingProviderIds } = useStreamingProviderSettings();
  return useMemo(
    () => {
      const { adultScope, providersKey } = buildHomeContentSettings({
        adultContent,
        streamingProviderIds,
      });
      return { adultContent: adultContent === true, adultScope, providersKey };
    },
    [adultContent, streamingProviderIds],
  );
}

/** @returns {string} Çizimi etkileyen ayarlardan biri değişince değişen anahtar. */
export function useHomeRenderKey() {
  const { imageQualityLevel } = useImageQualitySettings();
  const { railPosterSize, railPosterRadius, posterBadges } = useListLayoutSettings();
  return useMemo(
    () =>
      buildHomeContentSettings({
        imageQualityLevel,
        railPosterSize,
        railPosterRadius,
        posterBadges,
      }).renderKey,
    [imageQualityLevel, railPosterSize, railPosterRadius, posterBadges],
  );
}
