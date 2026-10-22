// hooks/useDailyPoll.js
//
// Günün Sorusu kartının veri bağı: günün sorusu (paketli, tohumsuz — gün numarasından), cihaz-yerel oy kaydı
// (Keys.dailyPoll) ve sunucu sayaçları (services/dailyPollService). Karar mantığı utils/dailyPoll.js'te (saf, testli).
//
// AKIŞ
//   • Oy verilmemişken sayaç OKUNMAZ: sonuç görmeden oy vermek herkesin oyunu etkilemez (önyargı yok) ve gereksiz okuma yok.
//   • Oy: önce YEREL kayıt (anında "oy verdin" görünümü), sonra transaction. Başarılıysa kayıt "senkron" olur ve sonuçlar
//     gelir; başarısızsa (çevrimdışı / kurallar yayında değil) kart "beklemede" kalır ve sonraki açılışta TEK KEZ yeniden denenir.
//   • Yerelde kayıt yoksa sunucudan kendi oyum sorulur (başka cihazdan verilmiş olabilir).
//   • Gün, ön plana dönüşte tazelenir (gece yarısı sonrası yeni soru).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { Keys, get, set, remove, useStored } from "../services/storage";
import { ANALYTICS_EVENTS, trackEvent } from "../services/analytics";
import { castPollVote, fetchMyPollVote, fetchPollCounts } from "../services/dailyPollService";
import { dayKeyOf } from "../utils/dailyChallenge";
import {
  localizeQuestion,
  normalizePollHistory,
  pollShares,
  pollStreak,
  questionForDay,
  recordPollVote,
  toStoredPollHistory,
  withMyVote,
} from "../utils/dailyPoll";

function writeHistory(uid, update) {
  const options = { uid };
  const next = update(normalizePollHistory(get(Keys.dailyPoll, options)));
  const stored = toStoredPollHistory(next);
  if (stored === null) remove(Keys.dailyPoll, options);
  else set(Keys.dailyPoll, stored, options);
}

function useTodayKey() {
  const [key, setKey] = useState(() => dayKeyOf());
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setKey(dayKeyOf());
    });
    return () => sub?.remove?.();
  }, []);
  return key;
}

/**
 * @param {{ source?: string }} [p]
 * @returns {{
 *   dayKey: string, question: {id:string,prompt:string,a:string,b:string}|null,
 *   myChoice: "a"|"b"|null, shares: ReturnType<typeof pollShares>, synced: boolean,
 *   status: "idle" (oy yok ya da sonuçlar bekleniyor) | "saving" | "pending" (yerelde, sunucuya yazılamadı) | "ready",
 *   streak: number, vote: (choice: "a"|"b") => void,
 * }}
 */
export default function useDailyPoll({ source = "hub" } = {}) {
  const { user } = useAuth() || {};
  const uid = user?.uid || null;
  const { language } = useLanguage();
  const dayKey = useTodayKey();

  const question = useMemo(() => localizeQuestion(questionForDay(dayKey), language), [dayKey, language]);

  const raw = useStored(Keys.dailyPoll, { uid });
  const history = useMemo(() => normalizePollHistory(raw), [raw]);
  const mine = history[dayKey] || null;

  const [counts, setCounts] = useState(null); // { a, b } | null (henüz okunmadı / hiç oy yok)
  const [status, setStatus] = useState("idle");
  const alive = useRef(true);
  const retried = useRef(null); // hangi gün için yeniden deneme yapıldı
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // Gün değişince önceki günün sayaçları taşınmasın.
  useEffect(() => {
    setCounts(null);
    setStatus("idle");
  }, [dayKey, uid]);

  const submit = useCallback(
    async (choice) => {
      if (!uid) return;
      setStatus("saving");
      try {
        const result = await castPollVote({ uid, dayKey, choice });
        // Başka cihazdaki oy kazanır (sunucudaki tek oy); yerel kayıt ona hizalanır.
        writeHistory(uid, (current) => {
          const synced = recordPollVote(current, dayKey, result.choice, true);
          return synced[dayKey]?.choice === result.choice
            ? synced
            : { ...synced, [dayKey]: { choice: result.choice, synced: true } };
        });
        if (!alive.current) return;
        setCounts(result.counts);
        setStatus("ready");
        return { synced: true };
      } catch {
        if (alive.current) setStatus("pending");
        return { synced: false };
      }
    },
    [dayKey, uid],
  );

  const vote = useCallback(
    async (choice) => {
      if (!uid || !question || mine) return;
      writeHistory(uid, (current) => recordPollVote(current, dayKey, choice, false));
      const outcome = await submit(choice);
      trackEvent(ANALYTICS_EVENTS.DAILY_POLL_VOTED, { question_id: question.id, synced: !!outcome?.synced, source });
    },
    [dayKey, mine, question, source, submit, uid],
  );

  // AÇILIŞ eşitlemesi — yalnız kullanıcı/gün değişince (oy verirken `vote` kendi akışını yürütür; bu efekt
  // oyun yarattığı yerel kaydı görüp ikinci kez yazmaya/okumaya kalkmasın). Yerel kayıt varsa sonuçları getir ya da
  // yazılamamış oyu bir kez yeniden dene; yoksa başka cihazdaki oyu sor.
  const mineRef = useRef(mine);
  mineRef.current = mine;
  useEffect(() => {
    if (!uid) return undefined;
    let cancelled = false;
    const current = mineRef.current;
    (async () => {
      try {
        if (current?.synced) {
          const result = await fetchPollCounts(dayKey);
          if (!cancelled && alive.current) {
            setCounts(result);
            setStatus("ready");
          }
        } else if (current) {
          // Yazılamamış oy: gün başına bir kez yeniden dene.
          if (retried.current !== dayKey) {
            retried.current = dayKey;
            await submit(current.choice);
          }
        } else {
          const remote = await fetchMyPollVote(uid, dayKey);
          if (cancelled || !remote) return;
          // Başka cihazdaki oy: yerele işle ve sonuçları getir.
          writeHistory(uid, (history) => recordPollVote(history, dayKey, remote, true));
          const result = await fetchPollCounts(dayKey);
          if (!cancelled && alive.current) {
            setCounts(result);
            setStatus("ready");
          }
        }
      } catch {
        if (!cancelled && alive.current && mineRef.current) setStatus("pending");
      }
    })();
    return () => { cancelled = true; };
  }, [uid, dayKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sunucu henüz benim oyumu yansıtmadıysa (okuma geriden geldi) iyimser olarak ekle.
  const shown = useMemo(() => {
    if (!mine) return null;
    const base = counts || { a: 0, b: 0 };
    const total = base.a + base.b;
    return pollShares(total === 0 && mine.synced ? withMyVote(base, mine.choice) : base);
  }, [counts, mine]);

  const streak = useMemo(() => pollStreak(history, dayKey), [history, dayKey]);

  return {
    dayKey,
    question,
    myChoice: mine?.choice || null,
    shares: shown,
    synced: !!mine?.synced,
    status: mine ? status : "idle",
    streak,
    vote,
  };
}
