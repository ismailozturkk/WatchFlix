// hooks/useWeatherSettings.js
//
// Atmosferin TÜR, YOĞUNLUK ve "detaylarda türe göre" tercihi. Aç/kapa (ve
// Premium kapısı) `useSnowSettings().showSnow`'da kaldı; burası yalnız "ne
// çizilsin, ne kadar".
// Tepkisel depo okuması (useStored): ayar yedeği / sohbet paylaşımı depoya
// yazınca açık ekranlar da yeni efekti çizer, ayrı context state'i yok.

import { useCallback } from "react";
import { Keys, set, useStored } from "../services/storage";
import {
  normalizeWeatherChoice,
  normalizeWeatherDensity,
  resolveWeatherEffect,
} from "../utils/weatherParticles";

export default function useWeatherSettings() {
  const choice = normalizeWeatherChoice(useStored(Keys.weatherEffect));
  const density = normalizeWeatherDensity(useStored(Keys.weatherDensity));
  const byGenre = useStored(Keys.atmosphereByGenre) !== false;
  const changeChoice = useCallback((value) => {
    set(Keys.weatherEffect, normalizeWeatherChoice(value));
  }, []);
  const changeDensity = useCallback((value) => {
    set(Keys.weatherDensity, normalizeWeatherDensity(value));
  }, []);
  const changeByGenre = useCallback((value) => {
    set(Keys.atmosphereByGenre, value !== false);
  }, []);
  return {
    choice,
    effect: resolveWeatherEffect(choice),
    density,
    byGenre,
    changeChoice,
    changeDensity,
    changeByGenre,
  };
}
