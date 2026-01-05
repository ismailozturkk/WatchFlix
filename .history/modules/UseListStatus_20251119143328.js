import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

//! burası değiştirildi çalışıyormu kontrol et
/**
 * Bir medya öğesinin (film veya dizi) kullanıcının listelerindeki durumunu kontrol eden custom hook.
 * @param {number | string} mediaId - Kontrol edilecek film veya dizi ID'si.
 * @param {'movie' | 'tv'} mediaType - Medya türü ('movie' veya 'tv').
 * @returns {{ inWatchList: boolean, inFavorites: boolean, isWatched: boolean, isInOtherLists: boolean, loading: boolean }}
 *          Listenin durumunu ve yüklenme durumunu içeren bir nesne.
 */
export const useListStatus = (mediaId, mediaType) => {
  const { user } = useAuth();
  const [listStates, setListStates] = useState({
    inWatchList: false,
    inFavorites: false,
    isWatched: false,
    isInOtherLists: false, // Diğer listeler için yeni state
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log(
      "Checking list status for mediaId:",
      mediaId,
      "mediaType:",
      mediaType
    );
    if (!user?.uid || !mediaId) {
      setLoading(false);
      return;
    }

    const docRef = doc(db, "Lists", user.uid);
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      try {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const watchedListKey =
            mediaType === "tv" ? "watchedTv" : "watchedMovies";

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
          setListStates({
            inWatchList: false,
            inFavorites: false,
            isWatched: false,
            isInOtherLists: false,
          });
        }
      } catch (error) {
        console.error("Error processing list status:", error);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid, mediaId, mediaType]);

  return { ...listStates, loading };
};
