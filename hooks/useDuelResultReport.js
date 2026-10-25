// hooks/useDuelResultReport.js
//
// Kabul edilen günlük düellonun sonucunu davetin geldiği sohbete BİR KEZ yazar (SceneGameResultScreen).
// Düello bağlamı oyuna davet kabul edilirken verilir (utils/importantInvites.duelContextOf): üst bardaki
// davet ya da sohbetteki "Meydan okumayı kabul et" kartı.
//
// Meydan okuyanın skoru günlük tablodan okunur (kart yalnız ilk görünüm; sohbetteki kart yeniden doğrular).
// Kendi skorum bu denemenin skoru; aynı gün daha önce daha iyisi yapıldıysa tablodaki en iyi skor geçer
// (karşılaştırma her yerde tablodaki EN İYİ skorla yapılıyor).
//
// Çift yazım: aynı oturum (sessionId) için modül düzeyinde kayıt tutulur — sonuç ekranı yeniden
// bağlansa da kart ikinci kez gitmez. Hata kalıcı değildir: `retry` aynı kartı yeniden dener.

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useUserProfile } from "../context/UserProfileContext";
import { loadDuelScores } from "../services/dailyDuelService";
import { buildDuelResultShare } from "../utils/chatShare";
import { chatTargetKey } from "../utils/importantInvites";
import useChatOutbox from "./useChatOutbox";

const reported = new Map(); // sessionId → "sending" | "sent"

/** Yalnız testler için. */
export const __resetDuelReports = () => reported.clear();

/**
 * @param {object}  p
 * @param {object}  [p.duel]       { dayKey, hostUid, hostName, chat } — yoksa kanca hiçbir şey yapmaz
 * @param {string}  [p.sessionId]
 * @param {object}  [p.result]     { score, correct, total, dailyKey }
 * @returns {{ status: "off"|"sending"|"sent"|"failed", retry: () => void }}
 */
export default function useDuelResultReport({ duel, sessionId, result }) {
  const { user } = useAuth() || {};
  const { displayName } = useUserProfile() || {};
  const post = useChatOutbox();
  const uid = user?.uid || null;

  const eligible =
    !!duel &&
    !!uid &&
    !!sessionId &&
    !!chatTargetKey(duel.chat) &&
    duel.hostUid !== uid &&
    result?.dailyKey === duel.dayKey &&
    Number(result?.total) > 0 &&
    Number.isFinite(Number(result?.score));

  const [status, setStatus] = useState(() => (eligible ? reported.get(sessionId) || "sending" : "off"));
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const send = useCallback(async () => {
    if (!eligible || reported.has(sessionId)) return;
    reported.set(sessionId, "sending");
    setStatus("sending");
    let scores = { mine: null, host: null };
    try {
      scores = await loadDuelScores({ dayKey: duel.dayKey, myUid: uid, hostUid: duel.hostUid, force: true });
    } catch {
      // Tablo okunamadı: meydan okuyanın skoru kartta "?" kalır, sohbetteki kart yeniden dener.
    }
    const own = Number(result.score);
    const share = buildDuelResultShare({
      dayKey: duel.dayKey,
      hostUid: duel.hostUid,
      host: duel.hostName,
      hostScore: scores.host,
      guest: displayName || user?.displayName || "",
      guestScore: Number.isFinite(scores.mine) ? Math.max(own, scores.mine) : own,
      correct: result.correct,
      total: result.total,
    });
    try {
      await post(duel.chat, share);
      reported.set(sessionId, "sent");
      if (alive.current) setStatus("sent");
    } catch (error) {
      if (__DEV__) console.warn("duelResultReport:", error?.message);
      reported.delete(sessionId);
      if (alive.current) setStatus("failed");
    }
  }, [eligible, sessionId, duel, uid, result, displayName, user?.displayName, post]);

  useEffect(() => {
    if (eligible && !reported.has(sessionId)) send();
  }, [eligible, sessionId, send]);

  return { status: eligible ? status : "off", retry: send };
}
