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
  updateDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import axios from "axios";
import {
  getScheduleEntry,
  parsePeriodId,
  getPeriodStartMs,
  getPhase,
  themeLabel,
  FINALIST_COUNT,
} from "./tournamentEngine";

const RAW_KEY = process.env.EXPO_PUBLIC_API_KEY || "";
const API_KEY = RAW_KEY && !RAW_KEY.startsWith("Bearer ") ? `Bearer ${RAW_KEY}` : RAW_KEY;

// Seçim HAVUZU: TMDB'den 64 aday çekilir; SELECTION fazında kullanıcı oylarıyla
// en çok oyu alan 32'si (FINALIST_COUNT) turnuvaya katılır (engine.selectFinalists).
const POOL_COUNT = 64;

const tmdbLang = (lang) => (lang === "tr" ? "tr-TR" : "en-US");

// ─── TMDB: bir türün en popüler `count` yapımı ────────────────────────────────
// discover/{movie|tv}?with_genres=..&sort_by=.. — poster'ı olanları sıraya göre
// alır, count'a ulaşana dek sayfalar (sayfa başına 20). seed = 1..count (havuz sırası).
export async function fetchNominees({ mediaType, genreId, sortBy = "popularity.desc", language = "tr", count = POOL_COUNT }) {
  if (!API_KEY) throw new Error("TMDB API anahtarı yok (EXPO_PUBLIC_API_KEY)");
  const path = mediaType === "tv" ? "discover/tv" : "discover/movie";
  const collected = [];
  const seen = new Set();

  for (let page = 1; page <= 8 && collected.length < count; page++) {
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
      if (collected.length >= count) break;
    }
  }

  return collected.slice(0, count);
}

// ─── Eski 32'lik dokümanı (varsa) 64'lük havuza yükselt ───────────────────────
// SADECE selection fazında ve havuz eksikse: mevcut adaylar (seed'leri) korunur,
// yeni adaylar sona eklenir (seed devam eder) → deterministik yapı bozulmaz.
// rules gereği update yalnız createdBy'da başarılı olur; diğer istemcilerde
// sessizce mevcut havuzla devam edilir (best-effort).
async function maybeUpgradePool(periodId, data, language) {
  try {
    if (getPhase(periodId) !== "selection") return data;
    const cur = Array.isArray(data?.nominees) ? data.nominees : [];
    if (cur.length < 2 || cur.length >= POOL_COUNT) return data;

    const entry = getScheduleEntry(data.monthIndex ?? parsePeriodId(periodId).monthIndex);
    const fresh = await fetchNominees({
      mediaType: data.mediaType || entry.mediaType,
      genreId: data.genreId || entry.genreId,
      sortBy: entry.sortBy,
      language,
      count: POOL_COUNT,
    });
    const have = new Set(cur.map((n) => n.id));
    const extra = fresh
      .filter((n) => !have.has(n.id))
      .map((n, i) => ({ ...n, seed: cur.length + i + 1 }))
      .slice(0, POOL_COUNT - cur.length);
    if (extra.length === 0) return data;

    const nominees = [...cur, ...extra];
    await updateDoc(doc(db, "tournaments", periodId), {
      nominees,
      poolSize: nominees.length,
    });
    return { ...data, nominees, poolSize: nominees.length };
  } catch (err) {
    if (__DEV__) console.warn("maybeUpgradePool:", err?.message);
    return data;
  }
}

// ─── Aday listesini ay başına bir kez oluştur (deterministik snapshot) ─────────
// İlk açan istemci TMDB'den çeker ve runTransaction ile create-if-absent yazar
// (yarış durumunda tek yazar kazanır). Sonradan açanlar var olanı döner.
export async function ensureTournament({ periodId, uid, language = "tr" }) {
  const ref = doc(db, "tournaments", periodId);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    // Eski 32'lik doküman + hâlâ seçim fazı → havuzu 64'e büyütmeyi dene.
    const data = await maybeUpgradePool(periodId, existing.data(), language);
    return { id: periodId, ...data };
  }

  const { year, monthIndex } = parsePeriodId(periodId);
  const entry = getScheduleEntry(monthIndex);
  const nominees = await fetchNominees({
    mediaType: entry.mediaType,
    genreId: entry.genreId,
    sortBy: entry.sortBy,
    language,
    count: POOL_COUNT,
  });
  if (nominees.length < FINALIST_COUNT) {
    // Havuz hedefe ulaşamadıysa yine de yaz (32 altı: eksik slotlar bracket'te
    // bye gibi davranır), ama en az 2 olmalı ki anlamlı olsun.
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
    poolSize: nominees.length,
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
// ⚠️ Çok kullanıcıda pahalıdır (N doküman). Yalnız agg dokümanı OLMAYAN eski
// aylar için fallback olarak kullanılır; yeni akış subscribeTournamentAgg +
// subscribeMyVote ikilisidir.
export function subscribeTournamentVotes(periodId, callback) {
  if (!periodId) return () => {};
  return onSnapshot(
    collection(db, "tournaments", periodId, "votes"),
    (snap) => callback(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))),
    (err) => __DEV__ && console.warn("subscribeTournamentVotes:", err.message),
  );
}

// ─── Agregat sayaçlar (Cloud Function onTournamentVoteWritten yazar) ─────────
// tournaments/{periodId}/agg/tallies → { noms, picks, voters }. İstemci tally
// için TEK dokümanı dinler; oy dokümanlarının tamamını çekmek gerekmez.
// Negatif sapmalar (nadir çift teslim) okurken 0'a kırpılır.
function sanitizeAgg(raw) {
  if (!raw) return null;
  const noms = {};
  for (const k of Object.keys(raw.noms || {})) {
    const v = raw.noms[k];
    if (typeof v === "number" && v > 0) noms[k] = v;
  }
  const picks = {};
  for (const k of Object.keys(raw.picks || {})) {
    const m = raw.picks[k] || {};
    picks[k] = {
      a: Math.max(0, typeof m.a === "number" ? m.a : 0),
      b: Math.max(0, typeof m.b === "number" ? m.b : 0),
    };
  }
  return { noms, picks, voters: Math.max(0, raw.voters || 0) };
}

// callback(agg | null) — null: agg dokümanı yok (fallback'e düş).
export function subscribeTournamentAgg(periodId, callback) {
  if (!periodId) return () => {};
  return onSnapshot(
    doc(db, "tournaments", periodId, "agg", "tallies"),
    (snap) => callback(snap.exists() ? sanitizeAgg(snap.data()) : null),
    (err) => {
      if (__DEV__) console.warn("subscribeTournamentAgg:", err.message);
      callback(null);
    },
  );
}

// Tek seferlik agg okuma (widget / podyum — geçmiş ay).
export async function fetchAggOnce(periodId) {
  try {
    const snap = await getDoc(doc(db, "tournaments", periodId, "agg", "tallies"));
    return snap.exists() ? sanitizeAgg(snap.data()) : null;
  } catch (err) {
    if (__DEV__) console.warn("fetchAggOnce:", err?.message);
    return null;
  }
}

// ─── Tek seferlik: kendi oy dokümanım (widget durumu için) ────────────────────
export async function fetchMyVoteOnce(periodId, uid) {
  if (!periodId || !uid) return null;
  try {
    const snap = await getDoc(doc(db, "tournaments", periodId, "votes", uid));
    return snap.exists() ? { uid: snap.id, ...snap.data() } : null;
  } catch (err) {
    if (__DEV__) console.warn("fetchMyVoteOnce:", err?.message);
    return null;
  }
}

// ─── Canlı: yalnız KENDİ oy dokümanım (myPicks / myNoms için) ─────────────────
export function subscribeMyVote(periodId, uid, callback) {
  if (!periodId || !uid) return () => {};
  return onSnapshot(
    doc(db, "tournaments", periodId, "votes", uid),
    (snap) => callback(snap.exists() ? { uid: snap.id, ...snap.data() } : null),
    (err) => __DEV__ && console.warn("subscribeMyVote:", err.message),
  );
}

// ─── Maç oyu — TEK ve DEĞİŞTİRİLEMEZ ─────────────────────────────────────────
// Kullanıcının kendi dokümanına merge; `lastKey` rules'ın "yalnız bu YENİ
// anahtar eklendi" doğrulaması içindir. Aynı maça ikinci yazım veya taraf
// değiştirme sunucu tarafından reddedilir (firestore.rules).
export async function castVote({ periodId, uid, matchId, side }) {
  if (!periodId || !uid || !matchId || (side !== "a" && side !== "b")) return;
  await setDoc(
    doc(db, "tournaments", periodId, "votes", uid),
    { uid, picks: { [matchId]: side }, lastKey: matchId, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

// ─── Aday hype'ı (seçim fazı) — TEK HAK ve DEĞİŞTİRİLEMEZ ─────────────────────
// Aynı votes/{uid} dokümanı kullanılır. Geri alma yolu KALDIRILDI (tek oy
// modeli); sunucu tarafında da rules yalnız İLK noms anahtarına izin verir.
// Seçim fazı dışında yazmayı reddeder ki sonradan atılan hype bracket'i
// değiştirmesin (rules'taki 0-7 gün penceresinin istemci karşılığı).
export async function setNomination({ periodId, uid, nomineeId }) {
  if (!periodId || !uid || nomineeId == null) return;
  if (getPhase(periodId) !== "selection") return;
  const key = String(nomineeId);
  await setDoc(
    doc(db, "tournaments", periodId, "votes", uid),
    { uid, noms: { [key]: true }, updatedAt: serverTimestamp() },
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
