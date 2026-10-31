// services/dailyPollService.js
//
// Günün Sorusu'nun sunucu tarafı: iki seçeneğin SAYACI ve kullanıcı başına TEK oy dokümanı
// (DailyPolls/{gün}/votes/{uid} → { choice, shard }). Soru metni sunucuda DEĞİL, paketli
// (data/dailyPollQuestions.js).
//
// SAYAÇ PARÇALI: herkes aynı gün aynı belgeye yazınca belge kilitleniyordu (2026-10-31 denetimi; emülatörde
// 100 eşzamanlı oyda 3/100 başarı). Oy, rastgele seçilen bir parçaya (DailyPolls/{gün}/shards/{0-9}) yazılır;
// toplam = gün belgesi (eski istemcilerin sayacı) + parçalar (utils/dailyPoll.sumPollCounts).
//
// OY = tek toplu yazım (transaction DEĞİL): oy dokümanı + parçada increment(1). Okuma gerekmediği için yoğun anda
// iyimser transaction'ın yeniden deneme döngüsüne girmez. firestore.rules eşleşmeyi zorunlu kılar (parça ancak
// aynı yazımda oy oluşturulursa, tam +1 ve yalnız seçilen yana artar; oy tek, değiştirilemez, gün "bugün" olmalı).
// Kurallar henüz yayında değilse yazım reddedilir; çağıran bunu "bekliyor" sayar.

import { collection, doc, getDoc, getDocs, increment, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { pickPollShard, sumPollCounts } from "../utils/dailyPoll";

const counterRef = (dayKey) => doc(db, "DailyPolls", dayKey);
const shardsRef = (dayKey) => collection(db, "DailyPolls", dayKey, "shards");
const shardRef = (dayKey, shard) => doc(db, "DailyPolls", dayKey, "shards", String(shard));
const voteRef = (dayKey, uid) => doc(db, "DailyPolls", dayKey, "votes", uid);

const asChoice = (data) => (data?.choice === "b" ? "b" : "a");

/** Gün belgesi + parçaların toplamı; henüz kimse oy vermediyse null. Hata fırlatır. */
export async function fetchPollCounts(dayKey) {
  const [legacy, shards] = await Promise.all([getDoc(counterRef(dayKey)), getDocs(shardsRef(dayKey))]);
  if (!legacy.exists() && shards.empty) return null;
  return sumPollCounts([legacy.exists() ? legacy.data() : null, ...shards.docs.map((entry) => entry.data())]);
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
export async function castPollVote({ uid, dayKey, choice }) {
  if (!uid) throw new Error("poll_no_user");
  if (choice !== "a" && choice !== "b") throw new Error("poll_bad_choice");

  const [vote, before] = await Promise.all([
    getDoc(voteRef(dayKey, uid)),
    fetchPollCounts(dayKey).catch(() => null),
  ]);
  const counts = before || { a: 0, b: 0 };
  if (vote.exists()) return { choice: asChoice(vote.data()), counts, alreadyVoted: true };

  const shard = pickPollShard();
  const batch = writeBatch(db);
  batch.set(voteRef(dayKey, uid), { choice, shard });
  // increment(0) eksik alanı 0 kurar: ilk oyda parça { a, b } şekliyle doğar (kural iki alanı da ister).
  batch.set(
    shardRef(dayKey, shard),
    { a: increment(choice === "a" ? 1 : 0), b: increment(choice === "b" ? 1 : 0) },
    { merge: true },
  );
  try {
    await batch.commit();
  } catch (error) {
    // Başka cihaz aynı anda oy verdiyse kural bu ikinci oyu reddeder: sunucudaki oy geçerlidir.
    const again = await getDoc(voteRef(dayKey, uid)).catch(() => null);
    if (again?.exists()) return { choice: asChoice(again.data()), counts, alreadyVoted: true };
    throw error;
  }
  return { choice, counts: { ...counts, [choice]: counts[choice] + 1 }, alreadyVoted: false };
}
