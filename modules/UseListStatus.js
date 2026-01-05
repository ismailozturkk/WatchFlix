import { useState, useEffect } from "react";
import { useListStatusContext } from "../context/ListStatusContext";

//! burası değiştirildi çalışıyormu kontrol et
/**
 * Bir medya öğesinin (film veya dizi) kullanıcının listelerindeki durumunu kontrol eden custom hook.
 * @param {number | string} mediaId - Kontrol edilecek film veya dizi ID'si.
 * @param {'movie' | 'tv'} mediaType - Medya türü ('movie' veya 'tv').
 * @returns {{ inWatchList: boolean, inFavorites: boolean, isWatched: boolean, isInOtherLists: boolean, loading: boolean }}
 *          Listenin durumunu ve yüklenme durumunu içeren bir nesne.
 */
export const useListStatus = (mediaId, mediaType) => {
  const { allLists, loading: contextLoading } = useListStatusContext();
  const [listStates, setListStates] = useState({
    inWatchList: false,
    inFavorites: false,
    isWatched: false,
    isInOtherLists: false,
  });

  useEffect(() => {
    if (contextLoading || !mediaId) {
      return;
    }

    if (allLists) {
      const data = allLists;
      const watchedListKey = mediaType === "tv" ? "watchedTv" : "watchedMovies";

      // Standart dışındaki diğer listeleri bul
      const predefinedLists = [
        "watchedTv",
        "favorites",
        "watchList",
        "watchedMovies",
      ];
      const otherListKeys = Object.keys(data).filter(
        (key) => !predefinedLists.includes(key)
      );

      // Diğer listelerden herhangi birinde medya var mı diye kontrol et
      const isInOtherLists = otherListKeys.some((listKey) =>
        (data[listKey] || []).some(
          (item) => item.id === mediaId && item.type === mediaType
        )
      );

      setListStates({
        inWatchList: (data.watchList || []).some(
          (item) => item.id === mediaId && item.type === mediaType
        ),
        inFavorites: (data.favorites || []).some(
          (item) => item.id === mediaId && item.type === mediaType
        ),
        isWatched: (data[watchedListKey] || []).some(
          (item) =>
            item.id === mediaId && (item.type === mediaType || !item.type)
        ), // Eski verilerle uyumluluk için type kontrolü
        isInOtherLists: isInOtherLists,
      });
    } else {
      // No lists data, so nothing is in any list
      setListStates({
        inWatchList: false,
        inFavorites: false,
        isWatched: false,
        isInOtherLists: false,
      });
    }
  }, [allLists, contextLoading, mediaId, mediaType]);

  return { ...listStates, loading: contextLoading };
};
