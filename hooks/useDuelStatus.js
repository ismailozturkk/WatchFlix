// hooks/useDuelStatus.js
//
// Sohbetteki günlük düello kartının durumu: alıcı bu günü oynadı mı, iki skor ne, kim önde.
// Karar mantığı utils/dailyDuel.js'te (saf, testli); burada yalnız tablodan okuma ve ekrana dönüşte tazeleme.
//
// Ekrana her ODAKLANDIĞINDA yeniden okunur (kullanıcı kartı kabul edip oyunu bitirerek sohbete dönünce karşılaştırma
// kendiliğinden belirsin). Sohbete aynı günün düello SONUCU kartı düşünce de yeniden okunur
// (services/dailyDuelService.notifyDuelScores).
//
// Varsayılan bakış alıcınınki (`guestUid` = ben). Meydan okuyanın kendi kartı 1-1 sohbette `guestUid` olarak
// karşı tarafı verir: `mine` o zaman RAKİBİN skorudur (karar: utils/dailyDuel.challengeHostView).

import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { loadDuelScores, subscribeDuelScores } from "../services/dailyDuelService";
import { dayKeyOf } from "../utils/dailyChallenge";
import { duelOutcome } from "../utils/dailyDuel";

/**
 * @param {object}  p
 * @param {object}  p.share     sohbet gövdesi (type:"challenge")
 * @param {string}  [p.hostUid]  kartı gönderenin uid'i (mesajın senderId'si)
 * @param {string}  [p.guestUid] skoru `mine` olarak okunacak taraf; varsayılan oturumdaki kullanıcı
 * @param {boolean} [p.enabled]
 */
export default function useDuelStatus({ share, hostUid, guestUid, enabled = true }) {
  const { user } = useAuth() || {};
  const myUid = guestUid || user?.uid || null;
  const [state, setState] = useState({ status: "loading", mine: null, host: null });
  const [tick, setTick] = useState(0);
  const phaseRef = useRef(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const dayKey = share?.dayKey;
  const active = enabled && !!dayKey && !!myUid;

  useEffect(() => {
    if (!active) return undefined;
    return subscribeDuelScores((day) => {
      if (day === dayKey && alive.current) setTick((n) => n + 1);
    });
  }, [active, dayKey]);

  useFocusEffect(
    useCallback(() => {
      if (!active) return undefined;
      let cancelled = false;
      // Önceki okuma "henüz oynamadı" dediyse oyundan dönüş olabilir: önbelleği atla.
      const force = phaseRef.current === "open" || tick > 0;
      loadDuelScores({ dayKey, myUid, hostUid, force })
        .then((scores) => {
          if (cancelled || !alive.current) return;
          setState({ status: "ready", mine: scores.mine, host: scores.host });
        })
        .catch(() => {
          // Doğrulanamadı: kartın kendi skoru ve "kabul et" görünür kalır; oynama durumunu bilmiyoruz.
          if (cancelled || !alive.current) return;
          setState({ status: "unverified", mine: null, host: null });
        });
      return () => { cancelled = true; };
    }, [active, dayKey, myUid, hostUid, tick]),
  );

  const hostScore = Number.isFinite(state.host) ? state.host : Number(share?.score);
  const outcome = duelOutcome({
    dayKey,
    today: dayKeyOf(),
    mine: state.mine,
    host: Number.isFinite(hostScore) ? hostScore : null,
  });
  phaseRef.current = outcome.phase;

  return {
    loading: active && state.status === "loading",
    unverified: state.status === "unverified",
    verifiedHost: Number.isFinite(state.host),
    mine: state.mine,
    hostScore: Number.isFinite(hostScore) ? hostScore : null,
    outcome,
  };
}
