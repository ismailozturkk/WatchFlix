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
import { episodeKey, materializeTvWatchState } from "../utils/watchHistory";

const NO_EVENTS = Object.freeze([]);

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
    // Dizi değiştiğinde ÖNCEKİ dizinin belgesini hemen bırak. Aksi hâlde ilk
    // snapshot gelene kadar eski dizinin izlenme durumu (ilerleme, "İzlendi"
    // rozeti) yeni dizininmiş gibi çizilirdi — aynı bileşen örneği farklı bir
    // showId ile yeniden kullanıldığında görünür oluyordu.
    setShowDoc(null);
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

    // Sezon/bölüm → izleme olayları indeksi, ilk ihtiyaçta BİR KEZ kurulur.
    // Eskiden her bölüm satırı tvWatchEvents ile dizinin TÜM geçmişini yeniden
    // hazırlıyordu (yol haritası Y5; 1.000 bölümde ~87 ms → ~0,5 ms). Sıra,
    // historyState.watchEvents'in sırasıdır (tvWatchEvents'in filtresiyle aynı).
    let index = null;
    const eventIndex = () => {
      if (index) return index;
      const bySeason = new Map();
      const byEpisode = new Map();
      const push = (map, key, event) => {
        const list = map.get(key);
        if (list) list.push(event);
        else map.set(key, [event]);
      };
      for (const event of historyState.watchEvents) {
        for (const sn of new Set(event.seasonNumbers || [])) push(bySeason, Number(sn), event);
        for (const key of new Set(event.episodeKeys || [])) push(byEpisode, key, event);
      }
      index = { bySeason, byEpisode };
      return index;
    };

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
        eventIndex().bySeason.get(Number(seasonNumber)) || NO_EVENTS,
      episodeWatchEvents: (seasonNumber, episodeNumber) =>
        eventIndex().byEpisode.get(episodeKey(Number(seasonNumber), episodeNumber)) || NO_EVENTS,
    };
  }, [showDoc, loading, showId]);
}
