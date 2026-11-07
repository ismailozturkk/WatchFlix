// hooks/useLeague.js
//
// Haftalık Lig'in veri bağı (Eğlence kartı + lig ekranı): services/leagueService önbelleğinden okur, ekran
// odaklanınca tazeler (60 sn bellek önbelleği: karttan ekrana geçmek yeniden okutmaz), XP kazanınca servis
// haber verir ve kanca yeniden çizer.

import { useCallback, useEffect, useReducer, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { fetchLeague, peekLeague, subscribeLeague } from "../services/leagueService";
import { prevWeekId, weekIdOf } from "../utils/leagueRules";

/**
 * @returns {{
 *   status: "loading"|"ready"|"error", user: object|null, members: object[], uid: string|null,
 *   rank: number|null, size: number, lastResult: object|null, refresh: () => void,
 * }}
 *   lastResult: yalnız GEÇEN haftanın sonucu (daha eskisi gösterilmez)
 */
export default function useLeague() {
  const { user: authUser } = useAuth() || {};
  const uid = authUser?.uid || null;
  const [, rerender] = useReducer((n) => n + 1, 0);
  const [status, setStatus] = useState(() => (peekLeague(uid) ? "ready" : "loading"));

  useEffect(() => subscribeLeague(rerender), []);

  const load = useCallback(
    (fresh) => {
      if (!uid) return;
      if (!peekLeague(uid)) setStatus("loading");
      fetchLeague(uid, { fresh })
        .then(() => setStatus("ready"))
        .catch(() => setStatus(peekLeague(uid) ? "ready" : "error"));
    },
    [uid],
  );

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  const data = peekLeague(uid);
  const members = data?.members || [];
  const index = uid ? members.findIndex((row) => row.uid === uid) : -1;
  const previous = prevWeekId(weekIdOf(Date.now()));
  const lastResult = data?.user?.lastResult?.week === previous ? data.user.lastResult : null;

  return {
    status: uid ? status : "error",
    user: data?.user || null,
    members,
    uid,
    rank: index >= 0 ? index + 1 : null,
    size: members.length,
    lastResult,
    refresh: () => load(true),
  };
}
