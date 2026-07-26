// hooks/useWatchedShow.js
//
// Bir dizinin izlenme durumunu TEK doküman aboneliğiyle okur. Sezonlar/bölümler
// show doküman'ına gömülü olduğundan tek `onSnapshot` yeterli (ayrı sezon okuması
// yok). Show detay / sezon detay ekranları bunu kullanır; bölüm/sezon kartları
// türetilen haritadan O(1) okur.

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import {
  materializeTvWatchState,
  tvWatchEvents,
} from "../utils/watchHistory";

export function useWatchedShow(showId) {
  const { user } = useAuth();
  const [showDoc, setShowDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid || showId == null) {
      setShowDoc(null);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const ref = doc(db, "Lists", user.uid, "watchedTv", `tv_${showId}`);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setShowDoc(snap.exists() ? snap.data() : null);
        setLoading(false);
      },
      () => {
        setShowDoc(null);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [user?.uid, showId]);

  return useMemo(() => {
    const historyState = materializeTvWatchState({
      ...(showDoc || {}),
      id: showDoc?.id ?? showId,
    });
    const materializedDoc = showDoc
      ? { ...showDoc, seasons: historyState.seasons, watchEvents: historyState.watchEvents }
      : null;
    const seasonsMap = {};
    let watchedEpisodeCount = 0;
    let totalMinutes = 0;

    (materializedDoc?.seasons || []).forEach((s) => {
      const eps = s.episodes || [];
      seasonsMap[s.seasonNumber] = {
        episodeNums: new Set(eps.map((e) => e.episodeNumber)),
        count: eps.length,
        seasonEpisodes: s.seasonEpisodes || 0,
      };
      watchedEpisodeCount += eps.length;
      totalMinutes += eps.reduce((a, e) => a + (e.episodeMinutes || 0), 0);
    });

    const aggregates = {
      watchedSeasonCount: Object.keys(seasonsMap).length,
      watchedEpisodeCount,
      totalMinutes,
    };

    return {
      loading,
      showDoc: materializedDoc,
      watchEvents: historyState.watchEvents,
      seasonsMap,
      aggregates,
      isEpisodeWatched: (seasonNumber, episodeNumber) =>
        !!seasonsMap[seasonNumber]?.episodeNums.has(episodeNumber),
      seasonWatchedCount: (seasonNumber) => seasonsMap[seasonNumber]?.count || 0,
      showWatchEvents: () => historyState.watchEvents,
      seasonWatchEvents: (seasonNumber) =>
        tvWatchEvents(materializedDoc, { seasonNumber }),
      episodeWatchEvents: (seasonNumber, episodeNumber) =>
        tvWatchEvents(materializedDoc, { seasonNumber, episodeNumber }),
    };
  }, [showDoc, loading, showId]);
}
