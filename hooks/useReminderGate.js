// hooks/useReminderGate.js
//
// Film/dizi hatırlatması KURMA kapısı (registry: movie_reminders, tv_reminders).
// Üç yerde hatırlatma kurulabiliyor (components/Reminder.js, MovieDetail,
// MediaQuickActionsSheet); hepsi aynı kapıdan geçer ki sayım kuralı ayrışmasın.
//
//   const reminderGate = useReminderGate();
//   if (!isReminderSet && !reminderGate.checkAdd({ type: "movie" })) return;
//   if (!isReminderSet && !reminderGate.checkAdd({ type: "tv", showId })) return;
//
// KURAL: kaldırmak ve mevcut diziye bölüm eklemek hiçbir zaman engellenmez;
// yalnız YENİ bir film ya da YENİ bir dizi hak harcar (bkz. utils/reminderCounts).
import { useCallback, useMemo } from "react";
import { useProfileReminders } from "../context/ProfileRemindersContext";
import { usePremiumGate } from "./usePremiumGate";
import { activeMovieReminders, activeTvShowIds } from "../utils/reminderCounts";

export default function useReminderGate() {
  const { reminders } = useProfileReminders() || {};
  const movieGate = usePremiumGate("movie_reminders");
  const tvGate = usePremiumGate("tv_reminders");

  const movieCount = useMemo(
    () => activeMovieReminders(reminders?.movieReminders).length,
    [reminders?.movieReminders],
  );
  const tvShowIds = useMemo(() => {
    const episodes = (reminders?.tvReminders || []).flatMap((show) =>
      (show.seasons || []).flatMap((season) => season.episodes || []),
    );
    return activeTvShowIds(episodes);
  }, [reminders?.tvReminders]);

  /** Sessiz soru: yeni hatırlatma serbest mi? (Uyarı göstermez.) */
  const canAdd = useCallback(
    ({ type, showId } = {}) => {
      if (type === "tv") {
        // Zaten hatırlatması süren bir dizinin yeni bölümü hak harcamaz.
        if (showId !== undefined && tvShowIds.has(String(showId))) return true;
        return tvGate.allows(tvShowIds.size);
      }
      return movieGate.allows(movieCount);
    },
    [movieCount, movieGate, tvGate, tvShowIds],
  );

  /** Serbestse true; doluysa yükseltme sayfasını açıp false döner. */
  const checkAdd = useCallback(
    (target = {}, options) => {
      if (canAdd(target)) return true;
      if (target.type === "tv") tvGate.check(tvShowIds.size, options);
      else movieGate.check(movieCount, options);
      return false;
    },
    [canAdd, movieCount, movieGate, tvGate, tvShowIds],
  );

  return useMemo(
    () => ({ canAdd, checkAdd, movieCount, tvCount: tvShowIds.size }),
    [canAdd, checkAdd, movieCount, tvShowIds],
  );
}
