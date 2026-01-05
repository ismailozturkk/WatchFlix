import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

/**
 * Bir medya öğesinin (film veya dizi) kullanıcının listelerindeki durumunu kontrol eden custom hook.
 * @param {number | string} mediaId - Kontrol edilecek film veya dizi ID'si.
 * @param {'movie' | 'tv'} mediaType - Medya türü ('movie' veya 'tv').
 * @returns {{ inWatchList: boolean, inFavorites: boolean, isWatched: boolean, loading: boolean }}
 *          Listenin durumunu ve yüklenme durumunu içeren bir nesne.
 */
export const useListStatus = (mediaId, mediaType) => {
  const { user } = useAuth();
  const [listStates, setListStates] = useState({
    inWatchList: false,
    inFavorites: false,
    isWatched: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid || !mediaId) {
      setLoading(false);
      return;
    }

    const docRef = doc(db, "Lists", user.uid);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const watchedListKey =
          mediaType === "tv" ? "watchedTv" : "watchedMovies";

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
        });
      } else {
        setListStates({
          inWatchList: false,
          inFavorites: false,
          isWatched: false,
        });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid, mediaId, mediaType]);

  return { ...listStates, loading };
};
