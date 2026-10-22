// hooks/useCinemaBingo.js
//
// Sinema Bingosu'nun veri bağı: aylık kart ve haftalık küçük hedefler + ProfileStatsContext'in
// ZATEN açık olan izleme verisi + cihaz-yerel geçmiş (Keys.cinemaBingo). Karar mantığının tamamı saf
// çekirdekte; burada yalnız depoya ve veriye bağlama (hooks/useYearlyGoal.js ile aynı sözleşme).
//
// YENİ FIRESTORE LISTENER AÇMAZ. Hesap, `useProfileStats`ın verdiği listelerden türer.
//
// GEÇMİŞ YAZIMI: sonuç değiştikçe (yalnız YÜKSELİRSE) ayın kaydı güncellenir; listeler gelmeden
// yazılmaz (açılışta sayı 0 görünür ve bu bir "düşüş" gibi okunmasın — yine de değerler yalnız artar,
// ama gereksiz yazım olmasın). Kaydı Eğlence'deki kart da tutar: kullanıcı bingoyu hiç açmasa bile
// seri ve tam kart sayısı işlenir.
//
// "BUGÜN" yalnız açılışta ve ön plana dönüşte okunur: ay veya hafta sınırını aşan oturumda yeni dönem,
// bir sonraki ön plana dönüşte gelir.

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useListStatusContext } from "../context/ListStatusContext";
import { useProfileStats } from "../context/ProfileStatsContext";
import { Keys, get, set, remove, useStored } from "../services/storage";
import {
  bingoMonthStreak,
  bingoTotals,
  buildBingoCard,
  daysLeftInMonth,
  daysLeftInWeek,
  evaluateBingo,
  evaluateWeeklyGoals,
  markBingoSeen,
  monthEndOf,
  monthIdOf,
  normalizeBingoHistory,
  previousMonthId,
  recordBingoWeek,
  toStoredBingoHistory,
  weekEndOf,
  weekIdOf,
} from "../utils/cinemaBingo";

/** Depoya yazar; hiçbir şey kalmadıysa anahtarı SİLER. Son kayıttan okur (hızlı art arda yazım ezilmesin). */
function write(uid, update) {
  const options = { uid };
  const current = normalizeBingoHistory(get(Keys.cinemaBingoMonthly, options));
  const stored = toStoredBingoHistory(update(current));
  return stored === null ? remove(Keys.cinemaBingoMonthly, options) : set(Keys.cinemaBingoMonthly, stored, options);
}

/** Cihaz saatine bağlı "şimdi"; uygulama ön plana dönünce tazelenir. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(new Date());
    });
    return () => sub?.remove?.();
  }, []);
  return now;
}

/**
 * @returns {{
 *   monthId: string, monthEnd: string, daysLeft: number,
 *   weekId: string, weekEnd: string, weekDaysLeft: number, weekly: ReturnType<typeof evaluateWeeklyGoals>, now: Date,
 *   result: ReturnType<typeof evaluateBingo>,
 *   previous: {lines: number, full: boolean} | null,
 *   streak: number, totals: ReturnType<typeof bingoTotals>,
 *   unseenLines: number,
 *   loading: boolean,
 *   markSeen: (lines: number) => void,
 * }}
 */
export default function useCinemaBingo() {
  const { user } = useAuth() || {};
  const uid = user?.uid || null;
  const now = useNow();
  const weekId = weekIdOf(now);
  const monthId = monthIdOf(now);

  const { movieHistoryItems, flatEpisodesTv } = useProfileStats() || {};
  // Listeler gelmeden sayı 0 görünür (açılışta birkaç sn): hazır sinyali useYearlyGoal ile aynı.
  const { loading: listsLoading, watchedTvLoaded } = useListStatusContext() || {};
  const loading = !!listsLoading || !watchedTvLoaded;

  const card = useMemo(() => buildBingoCard(monthId), [monthId]);
  const result = useMemo(
    () => evaluateBingo({ card, weekId: monthId, endDay: monthEndOf(monthId), movieEntries: movieHistoryItems || [], episodes: flatEpisodesTv || [] }),
    [card, monthId, movieHistoryItems, flatEpisodesTv],
  );
  const weekly = useMemo(
    () => evaluateWeeklyGoals({ weekId, movieEntries: movieHistoryItems || [], episodes: flatEpisodesTv || [] }),
    [weekId, movieHistoryItems, flatEpisodesTv],
  );

  // `uid` null iken (çıkış anı) kullanıcı kapsamlı okuma `guest` kovasına düşer; boş döner.
  const raw = useStored(Keys.cinemaBingoMonthly, { uid });
  const history = useMemo(() => normalizeBingoHistory(raw), [raw]);

  // Sonuç yükseldiyse ayın kaydını yaz. Yazım yalnız uid varken ve listeler hazırken; hiçbir
  // kare dolmadıysa yazılacak bir şey yok (sıfır kayıtlar 26 aylık pencereyi boşuna doldururdu).
  useEffect(() => {
    if (!uid || loading || result.doneCount === 0) return;
    write(uid, (current) => recordBingoWeek(current, monthId, result));
  }, [uid, loading, monthId, result.lineCount, result.doneCount, result.full]);

  const markSeen = useCallback(
    (lines) => {
      if (!uid) return;
      write(uid, (current) => markBingoSeen(current, monthId, lines));
    },
    [uid, monthId],
  );

  const stored = history[monthId];
  // Gerçek çizgi sayısı = kaydın en iyisi ile anlık değerlendirmenin büyüğü (silinen izleme çizgiyi geri almaz).
  const bestLines = Math.max(stored?.lines || 0, result.lineCount);
  const lastMonth = history[previousMonthId(monthId)];

  const streak = useMemo(
    () => bingoMonthStreak(recordBingoWeek(history, monthId, result), monthId),
    [history, monthId, result],
  );
  const totals = useMemo(() => bingoTotals(recordBingoWeek(history, monthId, result)), [history, monthId, result]);

  return {
    weekId,
    weekEnd: weekEndOf(weekId),
    monthId,
    monthEnd: monthEndOf(monthId),
    daysLeft: daysLeftInMonth(now),
    weekDaysLeft: daysLeftInWeek(now),
    weekly,
    now,
    result,
    bestLines,
    previous: lastMonth ? { lines: lastMonth.lines, full: lastMonth.full } : null,
    streak,
    totals,
    unseenLines: loading ? 0 : Math.max(0, bestLines - (stored?.seen || 0)),
    loading,
    markSeen,
  };
}
