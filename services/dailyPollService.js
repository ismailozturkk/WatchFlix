// services/dailyPollService.js
//
// Günün Sorusu'nun sunucu tarafı: iki seçeneğin SAYAÇ dokümanı (DailyPolls/{gün} → { a, b }) ve kullanıcı başına
// TEK oy dokümanı (DailyPolls/{gün}/votes/{uid} → { choice }). Soru metni sunucuda DEĞİL, paketli
// (data/dailyPollQuestions.js).
//
// OY = tek transaction: oy dokümanı + sayaç artışı BİRLİKTE yazılır. firestore.rules bu eşleşmeyi zorunlu kılar
// (sayaç ancak aynı yazımda oy dokümanı oluşturulursa, tam +1 ve yalnız seçilen yana artar; oy tek, değiştirilemez,
// gün "bugün" olmalı). Kurallar henüz yayında değilse yazım reddedilir; çağıran bunu "bekliyor" sayar.

import { doc, getDoc, increment, runTransaction } from "firebase/firestore";
import { db } from "../firebase";

const counterRef = (dayKey) => doc(db, "DailyPolls", dayKey);
const voteRef = (dayKey, uid) => doc(db, "DailyPolls", dayKey, "votes", uid);

const asCounts = (data) => ({
  a: Math.max(0, Math.trunc(Number(data?.a)) || 0),
  b: Math.max(0, Math.trunc(Number(data?.b)) || 0),
});

/** Sayaç dokümanı; henüz kimse oy vermediyse null. Hata fırlatır. */
export async function fetchPollCounts(dayKey) {
  const snap = await getDoc(counterRef(dayKey));
  return snap.exists() ? asCounts(snap.data()) : null;
}

/** Bu kullanıcının o gün oyu ("a" | "b") ya da null. Başka cihazdan oy verilmişse onu geri getirir. */
export async function fetchMyPollVote(uid, dayKey) {
  if (!uid) return null;
  const snap = await getDoc(voteRef(dayKey, uid));
  const choice = snap.exists() ? snap.data()?.choice : null;
  return choice === "a" || choice === "b" ? choice : null;
}

/**
 * Oyu yazar. Zaten oy varsa (başka cihaz / önceki deneme) YAZMAZ ve mevcut oyu döner.
 * @returns {Promise<{ choice: "a"|"b", counts: {a:number,b:number}, alreadyVoted: boolean }>}
 */
export function castPollVote({ uid, dayKey, choice }) {
  if (!uid) return Promise.reject(new Error("poll_no_user"));
  if (choice !== "a" && choice !== "b") return Promise.reject(new Error("poll_bad_choice"));
  return runTransaction(db, async (tx) => {
    const [counter, vote] = [await tx.get(counterRef(dayKey)), await tx.get(voteRef(dayKey, uid))];
    const counts = counter.exists() ? asCounts(counter.data()) : { a: 0, b: 0 };
    if (vote.exists()) {
      const existing = vote.data()?.choice === "b" ? "b" : "a";
      return { choice: existing, counts, alreadyVoted: true };
    }
    tx.set(voteRef(dayKey, uid), { choice });
    if (counter.exists()) tx.update(counterRef(dayKey), { [choice]: increment(1) });
    else tx.set(counterRef(dayKey), { a: choice === "a" ? 1 : 0, b: choice === "b" ? 1 : 0 });
    return { choice, counts: { ...counts, [choice]: counts[choice] + 1 }, alreadyVoted: false };
  });
}
