// services/matchSuggestions.js
//
// Zevk Çemberleri Faz 6 — istemcinin sunucu hattıyla konuştuğu TEK yer:
//   fetchMatchSuggestions  MatchSuggestions/{uid} (yalnız sahibi okur; DİNLEYİCİ YOK, ekran açılınca bir okuma)
//   sendMatchHello         callable matchHello   { cid } → { status, friendUid?, friendName? }
//   matchCandidateAction   callable matchAction  { cid, action: hide|block|report, reason? }
//   joinMatchCircle        callable matchCircleJoin { lane, name }
//   fetchMatchPairScore    callable getMatchPairScore { friendUid } — 24 saat önbellek (arkadaş kartı)
// Sunucu: functions/matchServer.js. Görünüm modeli: utils/matchSuggestions.js.

import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, fns } from "../firebase";
import { getCachedValue, setCachedValue } from "../utils/apiCache";

const PAIR_TTL = 24 * 60 * 60 * 1000;

const call = async (name, payload) => {
  const { data } = await httpsCallable(fns, name)(payload);
  return data;
};

/** Öneri belgesi ya da null (gece işi henüz çalışmadı). Hata ATILIR (ekran "tekrar dene" gösterir). */
export async function fetchMatchSuggestions(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, "MatchSuggestions", uid));
  return snap.exists() ? snap.data() : null;
}

export const sendMatchHello = (cid) => call("matchHello", { cid });

export const matchCandidateAction = (cid, action, reason) =>
  call("matchAction", reason ? { cid, action, reason } : { cid, action });

export const joinMatchCircle = (lane, name) => call("matchCircleJoin", { lane, name });

/**
 * İki arkadaş da havuzdaysa sunucu skoru (`{ lanes: {} }` = biri havuzda değil). Cihazda 24 saat önbellek:
 * skor zaten gecede bir değişir. Hata → null (kart istemci hesabına düşer).
 */
export async function fetchMatchPairScore(uid, friendUid) {
  if (!uid || !friendUid) return null;
  const key = `match_pair_v1_${uid}_${friendUid}`;
  try {
    const cached = await getCachedValue(key, PAIR_TTL);
    if (cached && typeof cached === "object") return cached;
  } catch {
    // önbellek okunamadı → ağdan
  }
  try {
    const data = await call("getMatchPairScore", { friendUid });
    const value = data && typeof data === "object" ? { lanes: data.lanes || {} } : { lanes: {} };
    setCachedValue(key, value);
    return value;
  } catch {
    return null;
  }
}
