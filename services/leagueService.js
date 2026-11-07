// services/leagueService.js
//
// Haftalık Lig'in istemci kapısı. Kurallar utils/leagueRules.js (sunucu kaynağının aynası), sunucu işi
// functions/league.js. İstemci XP YAZMAZ: yalnız olayı awardLeagueXp callable'ına bildirir; sunucu XP'yi,
// günlük tavanı ve tekrarı kendisi hesaplar. Lig durumu ve tablo Firestore'dan OKUNUR (kurallar: yalnız okuma).
//
// XP bildirimi sessizdir: çevrimdışı/hata oyunu ya da izleme kaydını asla bozmaz, kuyruklanmaz (kaçan bir olay
// en çok birkaç XP'dir). Aynı olay bu oturumda bir kez gönderilir; sunucu da haftalık tekrarı reddeder.
//
// Bellek önbelleği (CACHE_MS): Eğlence kartı ile lig ekranı aynı okumayı paylaşır. XP kazanınca tablo yeniden
// okunmaz; kendi satırım ve özetim yerinde güncellenir (yalnız gruba yeni girişte tablo tazelenir).

import { collection, doc, getDoc, getDocs, limit, orderBy, query } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, fns } from "../firebase";
import { GROUP_SIZE, SOURCE_IDS, clampTier, rankMembers, weekIdOf } from "../utils/leagueRules";
import { normalizeWatchDate } from "../utils/watchHistory";

export const CACHE_MS = 60 * 1000;
const sent = new Set();
const listeners = new Set();
let memory = null; // { uid, at, data, promise }

const emit = () => listeners.forEach((fn) => fn());

/** Önbellek değişince haber verir (kanca yeniden çizer). @returns {() => void} */
export function subscribeLeague(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Yalnız testler / hesap değişimi. */
export function __resetLeagueMemory() {
  memory = null;
  sent.clear();
}

const memberRow = (id, data = {}) => ({
  uid: data.uid || id,
  xp: Number(data.xp) || 0,
  xpAt: Number(data.xpAt) || 0,
  displayName: data.displayNameSnapshot || null,
  username: data.usernameSnapshot || null,
  avatarIndex: data.avatarIndexSnapshot ?? null,
  photoURL: data.photoURLSnapshot || null,
});

/** LeagueUsers belgesinin ekranda kullanılan kısmı. Bu hafta katılmadıysa joined:false. */
function userSummary(data, week) {
  const d = data || {};
  const joined = d.week === week && !!d.groupId;
  return {
    tier: clampTier(d.tier),
    week,
    joined,
    groupId: joined ? d.groupId : null,
    xp: joined ? Number(d.xp) || 0 : 0,
    lastResult: d.lastResult || null,
    // Geçen haftaya ait ama henüz sonuçlanmamış (pazartesi 00:00–00:10 arası): ekran "hesaplanıyor" der.
    pendingWeek: d.week && d.week !== week && d.groupId && d.lastResult?.week !== d.week ? d.week : null,
  };
}

async function readLeague(uid, nowMs) {
  const week = weekIdOf(nowMs);
  const snap = await getDoc(doc(db, "LeagueUsers", uid));
  const user = userSummary(snap.exists() ? snap.data() : null, week);
  let members = [];
  if (user.joined) {
    const rows = await getDocs(
      query(
        collection(db, "LeagueWeeks", week, "groups", user.groupId, "leagueMembers"),
        orderBy("xp", "desc"),
        limit(GROUP_SIZE),
      ),
    );
    rows.forEach((entry) => members.push(memberRow(entry.id, entry.data())));
  }
  // Eşit XP'de hafta sonu kuralının sırası (o XP'ye önce ulaşan önde): sorgu bunu bilmez.
  return { user, members: rankMembers(members) };
}

/** Anlık önbellek (yoksa null). */
export const peekLeague = (uid) => (memory && memory.uid === uid && memory.data ? memory.data : null);

/**
 * Lig durumu + grup tablosu. Hata fırlatır (ekran "yüklenemedi" gösterir).
 * @returns {Promise<{ user: ReturnType<typeof userSummary>, members: object[] }>}
 */
export function fetchLeague(uid, { fresh = false, nowMs = Date.now() } = {}) {
  if (!uid) return Promise.resolve(null);
  const week = weekIdOf(nowMs);
  const hit = memory && memory.uid === uid ? memory : null;
  if (!fresh && hit && hit.week === week && nowMs - hit.at < CACHE_MS) return hit.promise;
  const promise = readLeague(uid, nowMs).then((data) => {
    if (memory?.promise === promise) {
      memory.data = data;
      emit();
    }
    return data;
  });
  memory = { uid, week, at: nowMs, promise, data: hit?.data || null };
  promise.catch(() => {
    if (memory?.promise === promise) memory = hit?.data ? { ...hit, at: 0 } : null; // hata önbelleklenmez
  });
  return promise;
}

/** Callable yanıtını önbelleğe işler: kendi satırım + özet; yeni gruba girdiysem tablo tazelenir. */
function applyAward(uid, result) {
  if (!memory || memory.uid !== uid || !memory.data || !result || !(result.awarded > 0)) return;
  const { user, members } = memory.data;
  if (result.week !== memory.week) return;
  if (!user.joined || user.groupId !== result.groupId) {
    memory.at = 0; // sonraki okuma sunucudan
    fetchLeague(uid, { fresh: true }).catch(() => {});
    return;
  }
  const nextMembers = members.some((row) => row.uid === uid)
    ? members.map((row) => (row.uid === uid ? { ...row, xp: result.xp, xpAt: Date.now() } : row))
    : members;
  memory.data = {
    user: { ...user, xp: result.xp, tier: clampTier(result.tier), lastResult: result.lastResult || user.lastResult },
    members: rankMembers(nextMembers),
  };
  emit();
}

/**
 * Olayı lige bildirir (sessiz). Oturum yoksa ya da olay bu oturumda gönderildiyse hiçbir şey yapmaz.
 * @param {"game"|"daily"|"watch"|"vote"} source
 * @param {string} ref olayın kimliği (biçim: utils/leagueRules REF_PATTERNS)
 * @returns {Promise<object|null>} sunucunun yanıtı ({ awarded, xp, tier, … }) ya da null
 */
export async function awardLeagueXp(source, ref) {
  const uid = auth?.currentUser?.uid;
  if (!uid || !SOURCE_IDS.includes(source) || typeof ref !== "string" || !ref) return null;
  const key = `${uid}|${source}|${ref}`;
  if (sent.has(key)) return null;
  sent.add(key);
  try {
    const { data } = await httpsCallable(fns, "awardLeagueXp")({ source, ref });
    applyAward(uid, data);
    return data || null;
  } catch (e) {
    sent.delete(key); // ağ hatası: aynı olay sonra yeniden denenebilsin
    if (__DEV__) console.warn("awardLeagueXp error:", e?.message);
    return null;
  }
}

// ── Kaynak yardımcıları: çağıran yerler ref biçimini bilmesin ──────────────────

/** Bir oyun bitti (tavanlı). `kind`: oyun kimliği, `id`: oturumu ayıran değer (yoksa zaman). */
export const awardGameXp = (kind, id = Date.now()) =>
  awardLeagueXp(
    "game",
    `${String(kind).replace(/[^a-z_]/g, "_").slice(0, 24)}:${String(id).replace(/[^A-Za-z0-9_:.-]/g, "_").slice(0, 60)}`,
  );

/** Günlük bulmaca bitti: "frame" | "chain" | "challenge", gün "YYYY-MM-DD". */
export const awardDailyXp = (kind, dayKey) => awardLeagueXp("daily", `${kind}:${dayKey}`);

/** Günün Sorusu oyu. */
export const awardPollVoteXp = (dayKey) => awardLeagueXp("vote", `poll:${dayKey}`);

/** Top 100 oyu (mediaKey: "movie_550"). */
export const awardTop100VoteXp = (mediaKey) => awardLeagueXp("vote", `top100:${mediaKey}`);

/** İzleme günü bugün ya da dün mü (cihazın yerel günü)? Geçmişe dönük kayıt (içe aktarma, eski izleme) XP vermez. */
export function isRecentWatch(watchDate, nowMs = Date.now()) {
  const day = normalizeWatchDate(watchDate);
  if (!day) return false;
  const today = new Date(nowMs);
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  return day === normalizeWatchDate(today) || day === normalizeWatchDate(yesterday);
}

/**
 * İzlendi işareti. scope: { type: "movie"|"tv", id, season?, episode? }.
 * Yalnız yakın tarihli izleme sayılır (isRecentWatch).
 */
export function awardWatchXp({ type, id, season, episode }, watchDate) {
  if (!isRecentWatch(watchDate)) return Promise.resolve(null);
  const n = Math.trunc(Number(id));
  if (!(n > 0) || (type !== "movie" && type !== "tv")) return Promise.resolve(null);
  let ref = `${type}:${n}`;
  if (type === "tv" && season != null) {
    ref += `:s${Math.trunc(Number(season)) || 0}`;
    if (episode != null) ref += `:e${Math.trunc(Number(episode)) || 0}`;
  }
  return awardLeagueXp("watch", ref);
}
