// context/PosterChoicesContext.js
//
// ÖZEL AFİŞ VE ARKA PLANLAR — çizim anında uygulanan seçim katmanı (HAFİF çekirdek:
// yalnız React + saf kurallar; afiş çizen onlarca bileşen bunu içe aktarır).
//
//   const resolvePoster = usePosterResolver();
//   <Image source={{ uri: getTmdbUrl(resolvePoster("movie", id, item.poster_path), "poster", 120) }} />
//   <PosterImage path={item.poster_path} type="movie" mediaId={id} />   // aynısını kendisi yapar
//   const resolveBackdrop = useBackdropResolver();                      // arka plan için aynısı
//
// Kök sağlayıcı (context/PosterChoicesProvider.js) KENDİ seçimlerini verir. Başka
// birinin içeriği çizilirken (arkadaş profili, onun listeleri)
// `<PosterChoicesScope choices={{ posters, backdrops }}>` o kişinin seçimlerini ÜSTE
// koyar: onun seçtiği görsel, seçmediği yapımda izleyenin kendi seçimi, o da yoksa
// TMDB varsayılanı.
//
// Sağlayıcının dışında (ör. açılış ekranı) değer düz geçiştir: çağıranın yolu döner.
// Saf kurallar: utils/posterChoices.js

import React, { createContext, useContext, useMemo } from "react";
import { EMPTY_CHOICE_SET, resolvePosterPath } from "../utils/posterChoices";

/** choose/reset sonucu — galeri geri bildirimini buna göre seçer. */
export const POSTER_CHOICE_RESULT = Object.freeze({
  OK: "ok",
  UNCHANGED: "unchanged",
  LOCKED: "locked",
  FULL: "full",
  SIGNED_OUT: "signedOut",
  INVALID: "invalid",
});

const passThrough = (type, id, fallback = null) => fallback;
const unavailable = () => POSTER_CHOICE_RESULT.SIGNED_OUT;

export const DEFAULT_POSTER_CHOICES_VALUE = Object.freeze({
  resolve: passThrough,
  resolveBackdrop: passThrough,
  // (type, id, kind = "poster") → seçili yol | null
  chosenFor: () => null,
  // (type, id, path, kind = "poster") → POSTER_CHOICE_RESULT
  choose: unavailable,
  // (type, id, kind = "poster") → POSTER_CHOICE_RESULT
  reset: unavailable,
  allowed: false,
  choices: EMPTY_CHOICE_SET,
  uid: null,
});

export const PosterChoicesContext = createContext(DEFAULT_POSTER_CHOICES_VALUE);

/**
 * Başka birinin seçimlerini alt ağaçta üste koyar. `choices` = { posters, backdrops }
 * (useUserPosterChoices sonucu); boşsa üst değer olduğu gibi geçer (fazladan render yok).
 */
export function PosterChoicesScope({ choices, children }) {
  const parent = useContext(PosterChoicesContext);
  const value = useMemo(() => {
    if (!choices || choices === EMPTY_CHOICE_SET) return parent;
    const posters = choices.posters;
    const backdrops = choices.backdrops;
    return {
      ...parent,
      resolve: (type, id, fallback = null) =>
        resolvePosterPath(posters, type, id, parent.resolve(type, id, fallback)),
      resolveBackdrop: (type, id, fallback = null) =>
        resolvePosterPath(backdrops, type, id, parent.resolveBackdrop(type, id, fallback)),
    };
  }, [choices, parent]);
  return <PosterChoicesContext.Provider value={value}>{children}</PosterChoicesContext.Provider>;
}

export function usePosterChoices() {
  return useContext(PosterChoicesContext);
}

/** (type, id, fallbackPath) → çizilecek TMDB afiş yolu. */
export function usePosterResolver() {
  return useContext(PosterChoicesContext).resolve;
}

/** (type, id, fallbackPath) → çizilecek TMDB arka plan yolu. */
export function useBackdropResolver() {
  return useContext(PosterChoicesContext).resolveBackdrop;
}
