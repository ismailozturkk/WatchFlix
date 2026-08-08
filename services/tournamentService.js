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
  mergePool,
  FINALIST_COUNT,
} from "./tournamentEngine";

const RAW_KEY = process.env.EXPO_PUBLIC_API_KEY || "";
const API_KEY = RAW_KEY && !RAW_KEY.startsWith("Bearer ") ? `Bearer ${RAW_KEY}` : RAW_KEY;

// Seçim HAVUZU: TMDB'den 64 aday çekilir; SELECTION fazında kullanıcı oylarıyla
// en çok oyu alan 32'si (FINALIST_COUNT) turnuvaya katılır (engine.selectFinalists).
const POOL_COUNT = 64;

// Kullanıcının aramayla havuza eklediği adaylar (tournaments/{periodId}/pool).
const POOL_COL = "pool";

const tmdbLang = (lang) => (lang === "tr" ? "tr-TR" : "en-US");

// TMDB ham sonucu → havuz adayı. fetchNominees (discover), searchCandidates
// (search) ve fetchTmdbItem (detay) AYNI şekli üretsin diye tek yerde: havuz
// bu üç kaynaktan gelen kayıtları tek liste olarak harmanlıyor (engine.mergePool).
function toCandidate(r, mediaType) {
  const date = (mediaType === "tv" ? r.first_air_date : r.release_date) || "";
  return {
    id: r.id,
    title: (mediaType === "tv" ? r.name : r.title) || r.original_name || r.original_title || "—",
    posterPath: r.poster_path,
    mediaType,
    popularity: r.popularity || 0,
    voteAverage: r.vote_average || 0,
    year: date.slice(0, 4) || null,
  };
}

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
      collected.push({ seed: collected.length + 1, ...toCandidate(r, mediaType) });
      if (collected.length >= count) break;
    }
  }

  return collected.slice(0, count);
}

// ─── TMDB: isme göre arama ────────────────────────────────────────────────────
// Havuz yalnız o türün EN POPÜLER 64 yapımıdır; niş/eski yapımlar orada olmaz.
// Bu yüzden seçim fazında search/{movie|tv} ile TÜM TMDB'de aranır.
//
// TMDB search uç noktası tür filtresi KABUL ETMEZ; ayın türüne uymayanlar dönen
// `genre_ids` ile burada SESSİZCE elenir. Kullanıcıya "bu tür olmaz" diye bir
// şey açıklanmaz — arama sonucunda yalnız o ay hype verilebilecek yapımlar
// listelenir, tıpkı sıradan bir arama gibi.
export async function searchCandidates({
  query, mediaType, genreId, language = "tr", signal, limit = 24,
}) {
  const q = String(query || "").trim();
  if (!q || !API_KEY) return [];
  const path = mediaType === "tv" ? "search/tv" : "search/movie";
  const res = await axios.get(`https://api.themoviedb.org/3/${path}`, {
    params: { query: q, language: tmdbLang(language), page: 1 },
    headers: { accept: "application/json", Authorization: API_KEY },
    signal,
  });

  const wanted = Number(genreId);
  return (res?.data?.results || [])
    .filter(
      (r) =>
        r?.id && r.poster_path && !r.adult &&
        Array.isArray(r.genre_ids) && r.genre_ids.includes(wanted),
    )
    .map((r) => toCandidate(r, mediaType))
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, limit);
}

// ─── TMDB: tek yapım (kendini onarma yolu) ────────────────────────────────────
// Hype yazıldı ama havuz kaydı yazılamadıysa (ağ kesintisi) ekran adayı bu
// uçtan geri kurar. Detay yanıtı `genre_ids` yerine `genres[]` taşır; tür
// doğrulaması çağıran tarafta yapılmaz — zaten hype'ı verilmiş bir yapımdır.
export async function fetchTmdbItem({ mediaType, id, language = "tr" }) {
  if (!API_KEY || id == null) return null;
  try {
    const res = await axios.get(
      `https://api.themoviedb.org/3/${mediaType === "tv" ? "tv" : "movie"}/${id}`,
      { params: { language: tmdbLang(language) }, headers: { accept: "application/json", Authorization: API_KEY } },
    );
    const r = res?.data;
    return r?.id && r.poster_path ? toCandidate(r, mediaType) : null;
  } catch (err) {
    if (__DEV__) console.warn("fetchTmdbItem:", err?.message);
    return null;
  }
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
    // Öneriler ANCAK bundan sonra harmanlanır: maybeUpgradePool eksik havuzu
    // TMDB'den tamamlayıp geri YAZIYOR, önerileri o yazıma karıştırmamalıyız.
    const data = await maybeUpgradePool(periodId, existing.data(), language);
    const suggested = await fetchPoolCandidates(periodId);
    return { id: periodId, ...data, nominees: mergePool(data.nominees, suggested) };
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

// ─── Topluluğun aramayla eklediği adaylar ─────────────────────────────────────
// tournaments/{periodId}/pool/{tmdbId} — seçim fazında kullanıcı TMDB'de arayıp
// havuzda olmayan bir yapımı ekler; TEK hype hakkı buna harcanır (rules bunu
// kullanıcının noms'una bağlar → kişi başına en fazla BİR öneri).
// Doküman değişmezdir; bracket'in deterministikliği buna dayanır.
function toPoolItem(id, d) {
  const num = Number(id);
  return {
    id: Number.isFinite(num) ? num : id,
    title: d?.title || "—",
    posterPath: d?.posterPath || null,
    mediaType: d?.mediaType || null,
    popularity: d?.popularity || 0,
    voteAverage: d?.voteAverage || 0,
    year: d?.year || null,
    addedBy: d?.addedBy || null,
    // Sıralama TÜM istemcilerde aynı olsun diye sunucu zaman damgası kullanılır
    // (yerel yazım çözülene dek 0 — birkaç yüz ms sonra oturur).
    addedAtMs: d?.addedAt?.toMillis?.() || 0,
  };
}

export async function fetchPoolCandidates(periodId) {
  if (!periodId) return [];
  try {
    const snap = await getDocs(collection(db, "tournaments", periodId, POOL_COL));
    return snap.docs.map((d) => toPoolItem(d.id, d.data()));
  } catch (err) {
    if (__DEV__) console.warn("fetchPoolCandidates:", err?.message);
    return [];
  }
}

export function subscribeTournamentPool(periodId, callback) {
  if (!periodId) return () => {};
  return onSnapshot(
    collection(db, "tournaments", periodId, POOL_COL),
    (snap) => callback(snap.docs.map((d) => toPoolItem(d.id, d.data()))),
    (err) => __DEV__ && console.warn("subscribeTournamentPool:", err.message),
  );
}

// Havuza aday ekle. Doküman id'si TMDB id'sidir → aynı yapım iki kez eklenemez;
// başkası önce eklediyse bu sessizce başarı sayılır (kullanıcının hype'ı yine
// o yapıma gider). Rules update'e izin vermediği için önce varlık kontrolü şart.
export async function addPoolCandidate({ periodId, uid, candidate }) {
  if (!periodId || !uid || candidate?.id == null) return false;
  if (getPhase(periodId) !== "selection") return false;
  const key = String(candidate.id);
  const ref = doc(db, "tournaments", periodId, POOL_COL, key);
  const existing = await getDoc(ref);
  if (existing.exists()) return true;
  await setDoc(ref, {
    title: String(candidate.title || "—").slice(0, 120),
    posterPath: candidate.posterPath || null,
    mediaType: candidate.mediaType || null,
    popularity: Number(candidate.popularity) || 0,
    voteAverage: Number(candidate.voteAverage) || 0,
    year: candidate.year || null,
    addedBy: uid,
    addedAt: serverTimestamp(),
  });
  return true;
}

// ─── Hafif okuma (widget) — yoksa null, ASLA oluşturmaz ───────────────────────
// nominees, havuz önerileriyle BİRLEŞTİRİLMİŞ döner: widget/podyum ile tam ekran
// aynı bracket'i türetsin diye (hepsi docData.nominees üzerinden hesaplıyor).
// Öneri koleksiyonu okunamazsa [] döner — o an öneri yokmuş gibi davranılır.
export async function getTournamentDoc(periodId) {
  try {
    const snap = await getDoc(doc(db, "tournaments", periodId));
    if (!snap.exists()) return null;
    const data = snap.data();
    const suggested = await fetchPoolCandidates(periodId);
    return { id: periodId, ...data, nominees: mergePool(data.nominees, suggested) };
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

// ─── Kazanan arşivi (biten aylar) ─────────────────────────────────────────────
// tournamentWinners/{YYYY-MM} — archiveTournamentWinners (Cloud Function) yazar,
// istemci YALNIZ okur (firestore.rules'ta write:false). Geçmiş kazananlar
// listesi bunu kullanır: aksi halde her ay için doküman + agg + havuz okuyup
// bracket'i yeniden türetmek gerekirdi.
//
// Koleksiyon ayda bir doküman büyür; sıralama istemcide yapılır (indeks yok).
// Dönem kimliği sıfır dolgulu olduğundan ("2026-03") dizgi sırası kronolojiktir.
export async function fetchWinnerArchive({ max = 240 } = {}) {
  try {
    const snap = await getDocs(collection(db, "tournamentWinners"));
    return snap.docs
      .map((d) => ({ periodId: d.id, ...d.data() }))
      .sort((a, b) => (a.periodId < b.periodId ? 1 : a.periodId > b.periodId ? -1 : 0))
      .slice(0, max);
  } catch (err) {
    if (__DEV__) console.warn("fetchWinnerArchive:", err?.message);
    return [];
  }
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
