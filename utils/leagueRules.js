// utils/leagueRules.js
//
// Haftalık Lig kurallarının UYGULAMA AYNASI. Kaynak: functions/leagueRules.js (sunucu); bu dosya oradan
// türetildi. __tests__/leagueRules.test.js ikisinin aynı sonucu verdiğini denetler: birini değiştiren ikisini de değiştirir.
//
// MODEL
//   • Hafta = İstanbul saatiyle pazartesi 00:00 → sonraki pazartesi 00:00 (Türkiye 2016'dan beri sabit UTC+3;
//     Intl'e güvenmeyiz, Hermes'te saat dilimi desteği tutarsız). Hafta kimliği = o pazartesinin günü ("2026-10-26").
//   • Lige katılım = haftanın ilk XP'si. O an oyuncunun ligindeki açık gruba girer (en çok GROUP_SIZE kişi);
//     boş grup önceden kurulmaz, bu yüzden az kullanıcıda da grup dolu görünür.
//   • XP yalnız awardLeagueXp callable'ı ile yazılır. Kaynağa göre sabit XP + GÜNLÜK TAVAN; aynı olay (kaynak|ref)
//     hafta içinde bir kez sayılır. Oy kaynağı sunucuda gerçek oy belgesiyle doğrulanır; oyun ve izleme
//     doğrulanamaz (istemci yazıyor) — tavan, bir kişinin ligi tek başına bozmasını önler.
//   • Hafta sonu: grubun üst %20'si (en az 1, en az MIN_PROMOTE_XP ile) bir üst lige çıkar, alt %20'si
//     (grup en az MIN_DEMOTE_GROUP kişiyse) düşer. Eşit XP'de o XP'ye ÖNCE ulaşan önde.

export const TZ_OFFSET_MS = 3 * 60 * 60 * 1000; // Europe/Istanbul, sabit UTC+3
export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;

export const TIERS = Object.freeze(["bronze", "silver", "gold", "diamond", "legend"]);
export const GROUP_SIZE = 30;
export const PROMOTE_RATIO = 0.2;
export const DEMOTE_RATIO = 0.2;
export const MIN_DEMOTE_GROUP = 5;
export const MIN_PROMOTE_XP = 100;
export const MAX_REFS = 400;

/** Kaynak → olay başına XP ve günlük olay tavanı. */
export const XP_SOURCES = Object.freeze({
  game: Object.freeze({ xp: 15, daily: 10 }), // oyun bitirmek (hızlı oyunlar, Sahne Tahmin, Poster, serbest zincir)
  daily: Object.freeze({ xp: 40, daily: 3 }), // günlük bulmaca: Günün Karesi, Film Zinciri, Günlük Meydan Okuma
  watch: Object.freeze({ xp: 10, daily: 15 }), // izlendi işareti (film, bölüm, sezon, dizi)
  vote: Object.freeze({ xp: 10, daily: 5 }), // Günün Sorusu ve Top 100 oyu (sunucuda doğrulanır)
});
export const SOURCE_IDS = Object.freeze(Object.keys(XP_SOURCES));

const pad = (n) => String(n).padStart(2, "0");
const isoDay = (date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** İstanbul takvim günü ("YYYY-MM-DD"). */
export function dayKeyOf(ms) {
  return isoDay(new Date(ms + TZ_OFFSET_MS));
}

/** Günü n gün kaydırır. */
export function shiftDay(dayKey, n) {
  return isoDay(new Date(Date.parse(`${dayKey}T00:00:00Z`) + n * DAY_MS));
}

/** Haftanın kimliği: İstanbul'da o haftanın pazartesisi. */
export function weekIdOf(ms) {
  const local = new Date(ms + TZ_OFFSET_MS);
  const back = (local.getUTCDay() + 6) % 7; // pazartesi 0 … pazar 6
  return isoDay(new Date(local.getTime() - back * DAY_MS));
}

/** Haftanın başladığı an (UTC ms). */
export function weekStartMs(weekId) {
  return Date.parse(`${weekId}T00:00:00Z`) - TZ_OFFSET_MS;
}

/** Haftanın bittiği an = sonraki pazartesi 00:00 İstanbul. */
export function weekEndMs(weekId) {
  return weekStartMs(weekId) + WEEK_MS;
}

export function prevWeekId(weekId) {
  return weekIdOf(weekStartMs(weekId) - 1);
}

export const clampTier = (tier) => Math.min(TIERS.length - 1, Math.max(0, Math.trunc(Number(tier)) || 0));

/** Grup boyutuna göre terfi / düşme kontenjanı. */
export function zoneCounts(size) {
  const n = Math.max(0, Math.trunc(Number(size)) || 0);
  if (n === 0) return { promote: 0, demote: 0 };
  return {
    promote: Math.max(1, Math.floor(n * PROMOTE_RATIO)),
    demote: n >= MIN_DEMOTE_GROUP ? Math.floor(n * DEMOTE_RATIO) : 0,
  };
}

/** Bir sıranın hafta sonu sonucu: "up" | "down" | "stay". rank 1'den başlar. */
export function outcomeFor({ tier, rank, size, xp }) {
  const t = clampTier(tier);
  const { promote, demote } = zoneCounts(size);
  if (rank <= promote && (Number(xp) || 0) >= MIN_PROMOTE_XP && t < TIERS.length - 1) return "up";
  if (demote > 0 && rank > size - demote && t > 0) return "down";
  return "stay";
}

const xpAtOf = (row) => {
  const at = Number(row?.xpAt);
  return Number.isFinite(at) && at > 0 ? at : Number.MAX_SAFE_INTEGER;
};

/** Üyeleri sıralar: XP çok olan önde; eşitse o XP'ye önce ulaşan; sonra uid (kararlı). */
export function rankMembers(members = []) {
  return [...members]
    .filter((row) => row && row.uid)
    .sort(
      (a, b) =>
        (Number(b.xp) || 0) - (Number(a.xp) || 0) ||
        xpAtOf(a) - xpAtOf(b) ||
        (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0),
    )
    .map((row, index) => ({ ...row, xp: Number(row.xp) || 0, rank: index + 1 }));
}

/** Grubun hafta sonu sonucu: her üye için sıra, sonuç ve yeni lig. */
export function settleGroup(tier, members = []) {
  const ranked = rankMembers(members);
  const size = ranked.length;
  const from = clampTier(tier);
  return ranked.map((row) => {
    const outcome = outcomeFor({ tier: from, rank: row.rank, size, xp: row.xp });
    const toTier = outcome === "up" ? from + 1 : outcome === "down" ? from - 1 : from;
    return { uid: row.uid, rank: row.rank, size, xp: row.xp, outcome, fromTier: from, toTier };
  });
}

const REF_PATTERNS = Object.freeze({
  game: /^[a-z_]{1,24}:[A-Za-z0-9_:.-]{1,60}$/,
  daily: /^(frame|chain|challenge):(\d{4}-\d{2}-\d{2})$/,
  watch: /^(movie|tv):[1-9]\d{0,8}(:s\d{1,3}(:e\d{1,4})?)?$/,
  vote: /^(poll:(\d{4}-\d{2}-\d{2})|top100:(movie|tv)_[1-9]\d{0,8})$/,
});

/** Tarih taşıyan ref'lerde gün bugünden en çok 1 gün sapabilir (cihazın yerel günü İstanbul'dan farklı olabilir). */
export function isValidRef(source, ref, nowMs) {
  const pattern = REF_PATTERNS[source];
  if (!pattern || typeof ref !== "string") return false;
  const match = pattern.exec(ref);
  if (!match) return false;
  const day = source === "daily" ? match[2] : source === "vote" ? match[2] : null;
  if (day) {
    if (!DAY_RE.test(day)) return false;
    const today = dayKeyOf(nowMs);
    if (day !== today && day !== shiftDay(today, -1) && day !== shiftDay(today, 1)) return false;
  }
  return true;
}

/** Yeni haftanın boş durumu. */
export const freshWeek = (weekId) => ({ week: weekId, groupId: null, xp: 0, xpAt: 0, todayKey: null, counts: {}, refs: [] });

/**
 * XP kararı (saf). state: LeagueUsers/{uid} belgesinin hafta alanları.
 * @returns {{ ok: true, xp: number, next: object } | { ok: false, reason: string, next: object }}
 *   next: yazılacak hafta durumu (red durumunda yalnız hafta değiştiyse farklıdır)
 */
export function awardDecision(state, { source, ref, nowMs }) {
  const week = weekIdOf(nowMs);
  const base = state && state.week === week ? state : freshWeek(week);
  const rule = XP_SOURCES[source];
  if (!rule) return { ok: false, reason: "bad_source", next: base };
  if (!isValidRef(source, ref, nowMs)) return { ok: false, reason: "bad_ref", next: base };
  const today = dayKeyOf(nowMs);
  const counts = base.todayKey === today && base.counts ? base.counts : {};
  const key = `${source}|${ref}`;
  const refs = Array.isArray(base.refs) ? base.refs : [];
  if (refs.includes(key)) return { ok: false, reason: "duplicate", next: base };
  const used = Math.max(0, Math.trunc(Number(counts[source])) || 0);
  if (used >= rule.daily) return { ok: false, reason: "daily_cap", next: base };
  return {
    ok: true,
    xp: rule.xp,
    next: {
      ...base,
      todayKey: today,
      counts: { ...counts, [source]: used + 1 },
      refs: [...refs, key].slice(-MAX_REFS),
      xp: (Number(base.xp) || 0) + rule.xp,
      xpAt: nowMs,
    },
  };
}

/** Grup kimliği: "<lig>-<sıra no>" (aynı hafta, aynı ligde artan). */
export const groupIdOf = (tier, n) => `${TIERS[clampTier(tier)]}-${Math.max(1, Math.trunc(Number(n)) || 1)}`;

