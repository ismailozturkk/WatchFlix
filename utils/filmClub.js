// utils/filmClub.js
//
// Film Kulübü (docs/ozellikler/FILM_KULUBU.md) — saf çekirdek: tur taslağı, oy sayımı, kazanan, evre, istatistik.
// Firestore'a dokunmaz (bkz. services/filmClubService.js). Zaman değerleri MİLİSANİYE; Firestore Timestamp'leri
// `toMillis` ile çevrilir.
//
// Veri modeli (grup başına):
//   groups/{gid}.club                     = { enabled, cadence: "weekly"|"monthly", updatedBy }
//   groups/{gid}/clubRounds/{rid}         = tur (aşağıdaki buildRoundDraft alanları + sunucu zamanları)
//   groups/{gid}/clubRounds/{rid}/discussion/{cid} = { senderId, senderName, text, createdAt }
//
// Tur evreleri: voting (aday oylaması) → watching (seçilen film izleniyor, tartışma açık) → done (arşiv).
// Süre dolan evreyi herhangi bir üye kapatabilir; süreden önce yalnız kurucu/yönetici. Kural aynası firestore.rules
// (match /clubRounds). Aşağıdaki sayılar kuralla AYNI olmalı — __tests__/filmClub.test.js metni karşılaştırır.

export const CLUB_MIN_CANDIDATES = 2;
export const CLUB_MAX_CANDIDATES = 6;
export const CLUB_RATING_MIN = 1;
export const CLUB_RATING_MAX = 10;
export const CLUB_COMMENT_MAX = 1000;
export const CLUB_SENDER_NAME_MAX = 60;
// Kural üst sınırları (gün): oylama en çok 4, izleme en çok 31 gün sürebilir.
export const CLUB_MAX_VOTE_DAYS = 4;
export const CLUB_MAX_WATCH_DAYS = 31;

const DAY_MS = 24 * 60 * 60 * 1000;

export const CLUB_CADENCES = Object.freeze({
  weekly: Object.freeze({ id: "weekly", voteDays: 2, watchDays: 7 }),
  monthly: Object.freeze({ id: "monthly", voteDays: 3, watchDays: 30 }),
});
export const DEFAULT_CADENCE = "weekly";

export const cadenceOf = (id) => CLUB_CADENCES[id] || CLUB_CADENCES[DEFAULT_CADENCE];

/** Firestore Timestamp / Date / sayı → milisaniye (yoksa null). */
export function toMillis(value) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6);
  return null;
}

/** Aday kimliği: "movie-550" / "tv-1399" (kural pick.media_type + '-' + pick.id ile aynısını kurar). */
export const candidateIdOf = (media) => `${media?.media_type === "tv" ? "tv" : "movie"}-${media?.id}`;

/** TMDB öğesi → Firestore'a yazılan hafif aday. Kişi ve kimliksiz öğe → null. */
export function sanitizeClubMedia(raw) {
  if (!raw || typeof raw !== "object") return null;
  const type = raw.media_type || raw.type || (raw.first_air_date || raw.name ? "tv" : "movie");
  if (type !== "movie" && type !== "tv") return null;
  const id = Math.round(Number(raw.id));
  if (!Number.isFinite(id) || id <= 0) return null;
  const title = String(raw.title || raw.name || "").trim().slice(0, 120);
  if (!title) return null;
  const date = raw.release_date || raw.first_air_date || null;
  // TMDB sonucu `poster_path`, profil liste öğesi `imagePath` taşır (utils/listShare.mediaToListItem).
  const poster = [raw.poster_path, raw.imagePath].find((value) => typeof value === "string" && value.startsWith("/"));
  return {
    id,
    media_type: type,
    title,
    poster_path: poster || null,
    release_date: typeof date === "string" && date ? date.slice(0, 10) : null,
  };
}

/** Yinelenenleri ve geçersizleri atar, en çok CLUB_MAX_CANDIDATES aday bırakır. */
export function normalizeCandidates(list) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(list) ? list : []) {
    const media = sanitizeClubMedia(raw);
    if (!media) continue;
    const id = candidateIdOf(media);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(media);
    if (out.length >= CLUB_MAX_CANDIDATES) break;
  }
  return out;
}

/**
 * Yeni tur belgesi (zamanlar ms; servis Timestamp'e çevirir, createdAt sunucu zamanıdır).
 * Aday sayısı CLUB_MIN_CANDIDATES altındaysa null.
 */
export function buildRoundDraft({ number, candidates, cadence, uid, nowMs }) {
  const list = normalizeCandidates(candidates);
  if (list.length < CLUB_MIN_CANDIDATES || !uid) return null;
  const c = cadenceOf(cadence);
  return {
    number: Math.max(1, Math.round(Number(number)) || 1),
    status: "voting",
    cadence: c.id,
    createdBy: uid,
    candidates: list,
    candidateIds: list.map(candidateIdOf),
    votes: {},
    voteEndsAtMs: nowMs + c.voteDays * DAY_MS,
    pickId: null,
    pick: null,
    watched: {},
    ratings: {},
    commentCount: 0,
  };
}

/** İzleme bitiş zamanı: seçildiği andan itibaren kulübün sıklığı kadar. */
export const watchEndsAtFor = (cadence, nowMs) => nowMs + cadenceOf(cadence).watchDays * DAY_MS;

/** Aday başına oy: [{ id, media, count, voters }] — çoktan aza, eşitlikte aday sırası. */
export function tallyRound(round) {
  const candidates = Array.isArray(round?.candidates) ? round.candidates : [];
  const votes = round?.votes && typeof round.votes === "object" ? round.votes : {};
  const rows = candidates.map((media, order) => ({ id: candidateIdOf(media), media, count: 0, voters: [], order }));
  const byId = new Map(rows.map((row) => [row.id, row]));
  Object.entries(votes).forEach(([uid, choice]) => {
    const row = byId.get(choice);
    if (!row) return;
    row.count += 1;
    row.voters.push(uid);
  });
  return rows.sort((a, b) => b.count - a.count || a.order - b.order);
}

/** Kazanan aday (oy yoksa ilk aday). Aday yoksa null. */
export function pickWinner(round) {
  const [top] = tallyRound(round);
  return top ? top.media : null;
}

export const myVoteOf = (round, uid) => (uid && round?.votes ? round.votes[uid] || null : null);
export const hasWatched = (round, uid) => !!(uid && round?.watched && round.watched[uid] != null);
export const myRatingOf = (round, uid) => {
  const value = uid && round?.ratings ? Number(round.ratings[uid]) : NaN;
  return Number.isFinite(value) ? value : null;
};

/** Oy değişimi: aynı adaya basmak oyu geri çeker (null), başkası seçer. */
export const nextClubVote = (round, uid, candidateId) => (myVoteOf(round, uid) === candidateId ? null : candidateId);

export function isValidRating(value) {
  return Number.isInteger(value) && value >= CLUB_RATING_MIN && value <= CLUB_RATING_MAX;
}

/**
 * Turun ekrandaki evresi:
 *   "voting" | "votingOver" (süre doldu, kapatılmayı bekliyor) | "watching" | "watchingOver" | "done"
 */
export function roundPhase(round, nowMs) {
  if (!round) return null;
  if (round.status === "done") return "done";
  if (round.status === "watching") {
    const end = toMillis(round.watchEndsAt) ?? round.watchEndsAtMs ?? null;
    return end != null && nowMs >= end ? "watchingOver" : "watching";
  }
  const end = toMillis(round.voteEndsAt) ?? round.voteEndsAtMs ?? null;
  return end != null && nowMs >= end ? "votingOver" : "voting";
}

/** Oylamayı kapatabilir mi (kural: yönetici her zaman, üye süre dolunca). */
export function canCloseVoting(round, { isManager, nowMs }) {
  const phase = roundPhase(round, nowMs);
  return phase === "votingOver" || (phase === "voting" && !!isManager);
}

/** Turu bitirebilir mi (kural: yönetici her zaman, üye süre dolunca). */
export function canFinishRound(round, { isManager, nowMs }) {
  const phase = roundPhase(round, nowMs);
  return phase === "watchingOver" || (phase === "watching" && !!isManager);
}

/** Kalan süre (ms, en az 0) — evrenin bitişine. */
export function msLeft(round, nowMs) {
  const end =
    round?.status === "watching"
      ? toMillis(round.watchEndsAt) ?? round.watchEndsAtMs
      : round?.status === "voting"
        ? toMillis(round.voteEndsAt) ?? round.voteEndsAtMs
        : null;
  return end == null ? null : Math.max(0, end - nowMs);
}

/** Kalan süre → { days, hours } (gün yuvarlanmaz; 0 gün kalırsa saat). */
export function splitLeft(ms) {
  if (ms == null) return null;
  const hours = Math.ceil(ms / (60 * 60 * 1000));
  return { days: Math.floor(hours / 24), hours: hours % 24 };
}

/** Yalnız ŞU ANKİ üyeler sayılır (ayrılanın oyu/puanı istatistikte kalır ama katılım oranına girmez). */
export function roundStats(round, memberIds) {
  const members = new Set(Array.isArray(memberIds) ? memberIds : []);
  const watchedUids = Object.keys(round?.watched || {}).filter((uid) => round.watched[uid] != null);
  const ratings = Object.values(round?.ratings || {})
    .map(Number)
    .filter((n) => isValidRating(n));
  const avg = ratings.length ? ratings.reduce((sum, n) => sum + n, 0) / ratings.length : null;
  const watchedMembers = watchedUids.filter((uid) => members.has(uid)).length;
  return {
    watchedCount: watchedUids.length,
    memberCount: members.size,
    watchedPct: members.size ? Math.round((watchedMembers / members.size) * 100) : 0,
    ratingCount: ratings.length,
    avgRating: avg == null ? null : Math.round(avg * 10) / 10,
    spread: ratings.length >= 2 ? Math.max(...ratings) - Math.min(...ratings) : 0,
  };
}

/** Açık tur (voting/watching) — birden çok varsa en yüksek numaralı. */
export function activeRoundOf(rounds) {
  let best = null;
  for (const round of Array.isArray(rounds) ? rounds : []) {
    if (!round || round.status === "done") continue;
    if (!best || (round.number || 0) > (best.number || 0)) best = round;
  }
  return best;
}

export const nextRoundNumber = (rounds) =>
  (Array.isArray(rounds) ? rounds : []).reduce((max, round) => Math.max(max, Number(round?.number) || 0), 0) + 1;

/**
 * Kulüp arşivi istatistiği (yalnız bitmiş turlar):
 *   roundsDone, avgRating (tur ortalamalarının ortalaması), participationPct (izleyen/üye ortalaması),
 *   topRated (en yüksek ortalamalı tur), divisive (puan aralığı en geniş tur, aralık ≥ 3), loyal (en çok izleyen üye).
 */
export function clubStats(rounds, memberIds) {
  const done = (Array.isArray(rounds) ? rounds : []).filter((round) => round?.status === "done" && round.pick);
  const members = Array.isArray(memberIds) ? memberIds : [];
  if (!done.length) {
    return { roundsDone: 0, avgRating: null, participationPct: 0, topRated: null, divisive: null, loyal: null };
  }
  const perRound = done.map((round) => ({ round, stats: roundStats(round, members) }));
  const rated = perRound.filter((entry) => entry.stats.avgRating != null);
  const avgRating = rated.length
    ? Math.round((rated.reduce((sum, entry) => sum + entry.stats.avgRating, 0) / rated.length) * 10) / 10
    : null;
  const participationPct = Math.round(perRound.reduce((sum, entry) => sum + entry.stats.watchedPct, 0) / perRound.length);
  const topRated = rated.reduce(
    (best, entry) => (!best || entry.stats.avgRating > best.stats.avgRating ? entry : best),
    null,
  );
  const divisive = perRound.reduce(
    (best, entry) => (entry.stats.spread >= 3 && (!best || entry.stats.spread > best.stats.spread) ? entry : best),
    null,
  );
  const counts = new Map();
  done.forEach((round) =>
    Object.keys(round.watched || {}).forEach((uid) => {
      if (members.includes(uid)) counts.set(uid, (counts.get(uid) || 0) + 1);
    }),
  );
  let loyal = null;
  counts.forEach((count, uid) => {
    if (!loyal || count > loyal.count || (count === loyal.count && members.indexOf(uid) < members.indexOf(loyal.uid))) {
      loyal = { uid, count };
    }
  });
  return {
    roundsDone: done.length,
    avgRating,
    participationPct,
    topRated: topRated ? { round: topRated.round, avgRating: topRated.stats.avgRating } : null,
    divisive: divisive ? { round: divisive.round, spread: divisive.stats.spread } : null,
    loyal,
  };
}

/** Tartışma mesajı: kırpılmış metin ya da (boşsa) null. */
export function sanitizeComment(text) {
  const value = String(text ?? "").trim();
  return value ? value.slice(0, CLUB_COMMENT_MAX) : null;
}
