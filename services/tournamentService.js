// services/tournamentService.js
//
// Turnuvanın Firebase + TMDB tarafı. Saf mantık tournamentEngine.js'te; burada
// sadece I/O var:
//   • fetchNominees      → TMDB discover ile o türün top-32'si
//   • ensureTournament   → aday listesini ay başına BİR KEZ Firestore'a yazar
//   • getTournamentDoc   → hafif okuma (widget; create YOK)
//   • subscribeTournamentDoc / subscribeTournamentVotes → canlı dinleme
//   • castVote           → kullanıcının kendi oy dokümanına merge yazar
//
// Güven modeli: Ratings/userRatings ve gruplardaki anket oyuyla aynı — istemci
// taraflı (bu fazda backend yok). Kullanıcı yalnız KENDİ oy dokümanını yazar.

import { db } from "../firebase";
import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import axios from "axios";
import {
  getScheduleEntry,
  parsePeriodId,
  getPeriodStartMs,
  themeLabel,
} from "./tournamentEngine";

const RAW_KEY = process.env.EXPO_PUBLIC_API_KEY || "";
const API_KEY = RAW_KEY && !RAW_KEY.startsWith("Bearer ") ? `Bearer ${RAW_KEY}` : RAW_KEY;

const NOMINEE_COUNT = 32;

const tmdbLang = (lang) => (lang === "tr" ? "tr-TR" : "en-US");

// ─── TMDB: bir türün en popüler 32 yapımı ─────────────────────────────────────
// discover/{movie|tv}?with_genres=..&sort_by=.. — poster'ı olanları sıraya göre
// alır, 32'ye ulaşana dek sayfalar (sayfa başına 20). seed = 1..32.
export async function fetchNominees({ mediaType, genreId, sortBy = "popularity.desc", language = "tr" }) {
  if (!API_KEY) throw new Error("TMDB API anahtarı yok (EXPO_PUBLIC_API_KEY)");
  const path = mediaType === "tv" ? "discover/tv" : "discover/movie";
  const collected = [];
  const seen = new Set();

  for (let page = 1; page <= 6 && collected.length < NOMINEE_COUNT; page++) {
    const params = {
      language: tmdbLang(language),
      sort_by: sortBy,
      with_genres: String(genreId),
      include_adult: false,
      page,
      "vote_count.gte": sortBy.startsWith("vote_count") ? 50 : 100, // çöp/duplikasyon ele
    };
    if (mediaType === "movie") params.include_video = false;

    let results = [];
    try {
      const res = await axios.get(`https://api.themoviedb.org/3/${path}`, {
        params,
        headers: { accept: "application/json", Authorization: API_KEY },
      });
      results = res?.data?.results || [];
    } catch (err) {
      if (__DEV__) console.warn("fetchNominees page", page, err?.message);
      break;
    }
    if (results.length === 0) break;

    for (const r of results) {
      if (!r || seen.has(r.id) || !r.poster_path) continue;
      seen.add(r.id);
      collected.push({
        seed: collected.length + 1,
        id: r.id,
        title: (mediaType === "tv" ? r.name : r.title) || r.original_name || r.original_title || "—",
        posterPath: r.poster_path,
        mediaType,
        popularity: r.popularity || 0,
        voteAverage: r.vote_average || 0,
      });
      if (collected.length >= NOMINEE_COUNT) break;
    }
  }

  return collected.slice(0, NOMINEE_COUNT);
}

// ─── Aday listesini ay başına bir kez oluştur (deterministik snapshot) ─────────
// İlk açan istemci TMDB'den çeker ve runTransaction ile create-if-absent yazar
// (yarış durumunda tek yazar kazanır). Sonradan açanlar var olanı döner.
export async function ensureTournament({ periodId, uid, language = "tr" }) {
  const ref = doc(db, "tournaments", periodId);
  const existing = await getDoc(ref);
  if (existing.exists()) return { id: periodId, ...existing.data() };

  const { year, monthIndex } = parsePeriodId(periodId);
  const entry = getScheduleEntry(monthIndex);
  const nominees = await fetchNominees({
    mediaType: entry.mediaType,
    genreId: entry.genreId,
    sortBy: entry.sortBy,
    language,
  });
  if (nominees.length < NOMINEE_COUNT) {
    // 32'ye ulaşılamadıysa yine de yaz (eksik slotlar bracket'te bye gibi davranır),
    // ama en az 2 olmalı ki anlamlı olsun.
    if (nominees.length < 2) throw new Error("Aday bulunamadı");
  }

  const payload = {
    periodId,
    monthIndex,
    year,
    theme: entry.tr,              // sabit etiket (gösterimde dile göre çevrilir)
    themeEn: entry.en,
    mediaType: entry.mediaType,
    genreId: entry.genreId,
    startAtMs: getPeriodStartMs(periodId),
    nominees,
    createdBy: uid,
    createdAt: serverTimestamp(),
  };

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists()) return;          // başka istemci yazmış
      tx.set(ref, payload);
    });
  } catch (err) {
    if (__DEV__) console.warn("ensureTournament tx:", err?.message);
  }

  const after = await getDoc(ref);
  return after.exists() ? { id: periodId, ...after.data() } : { id: periodId, ...payload };
}

// ─── Hafif okuma (widget) — yoksa null, ASLA oluşturmaz ───────────────────────
export async function getTournamentDoc(periodId) {
  try {
    const snap = await getDoc(doc(db, "tournaments", periodId));
    return snap.exists() ? { id: periodId, ...snap.data() } : null;
  } catch (err) {
    if (__DEV__) console.warn("getTournamentDoc:", err?.message);
    return null;
  }
}

// ─── Canlı: turnuva meta dokümanı ─────────────────────────────────────────────
export function subscribeTournamentDoc(periodId, callback) {
  if (!periodId) return () => {};
  return onSnapshot(
    doc(db, "tournaments", periodId),
    (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    (err) => __DEV__ && console.warn("subscribeTournamentDoc:", err.message),
  );
}

// ─── Canlı: tüm oy dokümanları (tally için) ───────────────────────────────────
export function subscribeTournamentVotes(periodId, callback) {
  if (!periodId) return () => {};
  return onSnapshot(
    collection(db, "tournaments", periodId, "votes"),
    (snap) => callback(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))),
    (err) => __DEV__ && console.warn("subscribeTournamentVotes:", err.message),
  );
}

// ─── Oy ver — kullanıcının kendi dokümanına merge (diğer maç oyları korunur) ──
export async function castVote({ periodId, uid, matchId, side }) {
  if (!periodId || !uid || !matchId || (side !== "a" && side !== "b")) return;
  await setDoc(
    doc(db, "tournaments", periodId, "votes", uid),
    { uid, picks: { [matchId]: side }, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

// ─── Tek seferlik oy dokümanı okuma (önceki ay şampiyonunu türetmek için) ─────
export async function fetchVotesOnce(periodId) {
  try {
    const snap = await getDocs(collection(db, "tournaments", periodId, "votes"));
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  } catch (err) {
    if (__DEV__) console.warn("fetchVotesOnce:", err?.message);
    return [];
  }
}

export { themeLabel };
