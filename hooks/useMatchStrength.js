// hooks/useMatchStrength.js
//
// Zevk Çemberleri — oturumdaki kullanıcının kulvar başına eşleşme gücü (utils/matchStrength.js).
// YENİ OKUMA YOK: ListStatusContext'in zaten yüklediği listeler + activityIndex (puanlar, yorumlar)
// ve profildeki fourFavorites kullanılır.

import { useMemo } from "react";
import { useListStatusContext } from "../context/ListStatusContext";
import { useUserProfile } from "../context/UserProfileContext";
import { computeMatchStrength } from "../utils/matchStrength";

export default function useMatchStrength({ enabled = true } = {}) {
  const lists = useListStatusContext() || {};
  const { profile } = useUserProfile() || {};
  const fourFavorites = profile?.fourFavorites || null;
  return useMemo(
    () =>
      enabled
        ? computeMatchStrength({
            side: {
              watchedMovies: lists.watchedMoviesItems || [],
              watchedShows: Object.values(lists.watchedTvMap || {}),
              ratings: lists.activityIndex?.ratings || {},
            },
            commentKeys: lists.activityIndex?.comments || [],
            fourFavorites,
          })
        : null,
    [enabled, lists.watchedMoviesItems, lists.watchedTvMap, lists.activityIndex, fourFavorites],
  );
}
