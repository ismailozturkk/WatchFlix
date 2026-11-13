// utils/matchSuggestions.js
//
// Zevk Çemberleri Faz 6 — öneri belgesinin (MatchSuggestions/{uid}, sunucu yazar) SAF görünüm modeli.
// Ekran: screens/match/MatchScreen.js. Sunucu şekli: functions/matchServer.js runNightly + matchPipeline.
//
// Belgeye GÜVENİLMEZ: bozuk / eksik alanlar elenir. Adayın uid'si belgede YOK (opak `cid`); kart yalnız görünen
// ad + avatar + ortak sevilen yapım anahtarları + ayrışılan yapım anahtarı taşır. Puan DEĞERİ hiç yok
// (gizlilik metni 1.8: "tek tek puanların gösterilmez").

import { tierOf } from "./tasteMatch";

export const MATCH_LANE_IDS = Object.freeze(["movie", "tv"]);
const VERDICTS = new Set(["twin", "near", "guide"]);
const KEY_RE = /^(movie|tv)_(\d+)$/;
const CID_RE = /^[A-Za-z0-9_-]{10,40}$/;
const MAX_ITEMS = 10;
const MAX_LOVED = 6;

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const toMs = (v) => {
  if (isNum(v)) return v;
  if (v && typeof v.toMillis === "function") return v.toMillis();
  return null;
};

/** "movie_550" → { key, type: "movie", id: 550 } ya da null. */
export function parseTitleKey(key) {
  const m = typeof key === "string" ? KEY_RE.exec(key) : null;
  return m ? { key, type: m[1], id: Number(m[2]) } : null;
}

function normalizeItem(raw) {
  if (!raw || typeof raw !== "object" || typeof raw.cid !== "string" || !CID_RE.test(raw.cid)) return null;
  const verdict = VERDICTS.has(raw.verdict) ? raw.verdict : null;
  if (!verdict) return null;
  // Rehber (guide) yüzdesizdir; diğerlerinde skor 0–100.
  const score = verdict === "guide" || !isNum(raw.score) ? null : Math.max(0, Math.min(100, Math.round(raw.score)));
  if (verdict !== "guide" && score === null) return null;
  return {
    cid: raw.cid,
    verdict,
    score,
    displayName: typeof raw.displayName === "string" ? raw.displayName.slice(0, 60) : "",
    avatarIndex: isNum(raw.avatarIndex) ? raw.avatarIndex : 0,
    photoURL: typeof raw.photoURL === "string" ? raw.photoURL : null,
    loved: (Array.isArray(raw.loved) ? raw.loved : []).filter((k) => parseTitleKey(k)).slice(0, MAX_LOVED),
    split: parseTitleKey(raw.split) ? raw.split : null,
    implicitHeavy: !!raw.implicitHeavy,
    greeted: !!raw.greeted,
    sent: !!raw.sent,
    mutual: !!raw.mutual,
    // Karşılıklı selamdan sonra artık arkadaş: sunucu sohbet için uid'yi YALNIZ bu durumda yazar.
    friendUid: raw.mutual && typeof raw.friendUid === "string" ? raw.friendUid : null,
  };
}

function normalizeCircle(raw) {
  if (!raw || typeof raw !== "object" || typeof raw.key !== "string" || !raw.key) return null;
  const size = isNum(raw.size) ? raw.size : 0;
  if (size < 3) return null;
  return {
    key: raw.key,
    size,
    genres: (Array.isArray(raw.genres) ? raw.genres : []).filter((g) => typeof g === "string").slice(0, 2),
    joined: !!raw.joined,
    joinedCount: isNum(raw.joinedCount) ? Math.max(0, Math.min(size, raw.joinedCount)) : 0,
    groupId: typeof raw.groupId === "string" && raw.groupId ? raw.groupId : null,
    groupReady: !!raw.groupReady,
  };
}

const VERDICT_ORDER = { twin: 0, near: 1, guide: 2 };

function normalizeLane(raw) {
  if (!raw || typeof raw !== "object") return null;
  const items = (Array.isArray(raw.items) ? raw.items : [])
    .map(normalizeItem)
    .filter(Boolean)
    .sort((a, b) => VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict] || (b.score ?? -1) - (a.score ?? -1))
    .slice(0, MAX_ITEMS);
  return {
    pool: isNum(raw.pool) ? raw.pool : 0,
    active: isNum(raw.active) ? raw.active : 0,
    inPool: !!raw.inPool,
    twinsEnabled: !!raw.twinsEnabled,
    items,
    circle: normalizeCircle(raw.circle),
  };
}

/**
 * Belge → görünüm. `null` belge = henüz gece işi çalışmadı.
 * @returns {{ ready: boolean, updatedAt: number|null, lanes: Record<"movie"|"tv", object|null> }}
 */
export function normalizeSuggestions(doc) {
  const lanes = {};
  for (const lane of MATCH_LANE_IDS) lanes[lane] = normalizeLane(doc?.lanes?.[lane]);
  return { ready: !!doc && typeof doc === "object", updatedAt: toMs(doc?.updatedAt), lanes };
}

/**
 * Kulvarın ekran durumu (öncelik sırasıyla):
 *   not-ready  belge yok (ilk gece işi bekleniyor) · not-selected  kulvar seçilmemiş · not-in-pool  eşleşme gücü
 *   yetmedi · empty  havuzda ama aday yok · list  aday var.
 */
export function laneStatus(view, lane, selectedLanes = MATCH_LANE_IDS) {
  if (!selectedLanes.includes(lane)) return "not-selected";
  if (!view?.ready) return "not-ready";
  const entry = view.lanes?.[lane];
  if (!entry) return "not-ready";
  if (!entry.inPool) return "not-in-pool";
  return entry.items.length ? "list" : "empty";
}

/**
 * Selam düğmesinin durumu:
 *   mutual  karşılıklı (artık arkadaş) · sent  ben gönderdim, cevap yok · greeted  o bana verdi, ben vermedim · none
 */
export function helloState(item) {
  if (!item) return "none";
  if (item.mutual || (item.sent && item.greeted)) return "mutual";
  if (item.sent) return "sent";
  if (item.greeted) return "greeted";
  return "none";
}

const mapItems = (view, fn) => ({
  ...view,
  lanes: Object.fromEntries(
    Object.entries(view.lanes || {}).map(([lane, entry]) => [lane, entry ? { ...entry, items: fn(entry.items, lane) } : entry]),
  ),
});

/** Sunucunun selam cevabını görünüme işler (iyimser güncelleme yok: cevap geldikten sonra). */
export function applyHelloResult(view, cid, result) {
  const status = result?.status;
  if (!["sent", "already", "mutual"].includes(status)) return view;
  return mapItems(view, (items) =>
    items.map((it) => (it.cid === cid ? { ...it, sent: true, mutual: it.mutual || status === "mutual" } : it)),
  );
}

/** Gizlenen / engellenen / şikâyet edilen adayı görünümden çıkarır. */
export function removeCandidate(view, cid) {
  return mapItems(view, (items) => items.filter((it) => it.cid !== cid));
}

/** Çember katılım cevabı → görünüm. */
export function applyCircleResult(view, lane, result) {
  const entry = view?.lanes?.[lane];
  if (!entry?.circle || !result) return view;
  const circle = {
    ...entry.circle,
    joined: true,
    joinedCount: isNum(result.joined) ? result.joined : entry.circle.joinedCount,
    groupId: typeof result.groupId === "string" ? result.groupId : entry.circle.groupId,
    groupReady: !!result.groupId || entry.circle.groupReady,
  };
  return { ...view, lanes: { ...view.lanes, [lane]: { ...entry, circle } } };
}

/** Kartlarda adı/afişi gereken yapım anahtarları (TMDB'den okunacak; tekil, sınırlı). */
export function titleKeysOf(view, lane, limit = 30) {
  const keys = new Set();
  for (const it of view?.lanes?.[lane]?.items || []) {
    for (const k of it.loved.slice(0, 3)) keys.add(k);
    if (it.split) keys.add(it.split);
  }
  return [...keys].slice(0, limit);
}

/** Selam / eylem hatası (callable kodu) → ekran metni anahtarı. */
export function errorKindOf(error) {
  const code = String(error?.code || "").replace(/^functions\//, "");
  if (code === "resource-exhausted") return "limit";
  if (code === "not-found") return "gone";
  if (code === "failed-precondition") return "closed";
  return "error";
}

// ── arkadaş kartı: sunucu skoru (iki taraf da havuzdaysa) ────────────────────────

/**
 * İstemci sonucunun (utils/tasteMatch.computeTasteMatch) yüzdelerini sunucu skoruyla değiştirir; böylece
 * eşleşme kartıyla arkadaş kartı AYNI yüzdeyi gösterir (rehber Faz 6 kabul ölçütü). İçgörü alanlarına dokunmaz.
 * Ana yüzde: ortak yapımı en çok olan kulvarın sunucu skoru (sunucuda karma kulvar yok).
 * @param {object|null} tasteMatch
 * @param {{ lanes?: Record<string, { display: number|null, verdict: string, common: number }> }|null} server
 */
export function applyServerPairScore(tasteMatch, server) {
  if (!tasteMatch || !server?.lanes) return tasteMatch;
  const lanes = MATCH_LANE_IDS.map((lane) => [lane, server.lanes[lane]]).filter(
    ([, r]) => r && (isNum(r.display) || r.verdict === "guide"),
  );
  if (!lanes.length) return tasteMatch;
  const byType = { ...tasteMatch.byType };
  for (const [lane, r] of lanes) {
    if (byType[lane]?.shared) byType[lane] = { ...byType[lane], score: isNum(r.display) ? r.display : null };
  }
  const [, main] = [...lanes].sort((a, b) => (b[1].common || 0) - (a[1].common || 0))[0];
  const score = isNum(main.display) ? main.display : tasteMatch.score;
  return {
    ...tasteMatch,
    score,
    tier: tierOf(score),
    byType,
    source: "server",
  };
}
