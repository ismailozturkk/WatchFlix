"use strict";

// Zevk Çemberleri — SUNUCU HATTININ SAF ÇEKİRDEĞİ (rehber Faz 5). Firestore / ağ YOK; I/O matchServer.js'te.
// Testler emülatörsüz: matchPipeline.test.js.
//
// Bağlayıcı kurallar: docs/ozellikler/ZEVK_ESLESMESI_ALGORITMA.md (§8 karar), ZEVK_ESLESMESI.md (§6 çember,
// §7 soğuk başlangıç, §8 gizlilik). Hesap çekirdeği tasteMatchCore.js (utils/tasteMatchV3.js'in üretilmiş kopyası).
//
// GİZLİLİK DEĞİŞMEZLERİ (testlerle korunur):
//   • Öneri belgesine aday için YALNIZ görünen ad, avatar, foto, opak `cid` ve ortak/ayrışan yapım anahtarları girer.
//     uid, kullanıcı adı, yaş, doğum tarihi, e-posta, puan değerleri GİRMEZ.
//   • Opak kimlik sahibe özeldir: aynı aday iki farklı kullanıcıda farklı `cid` taşır (sahip başkasına
//     "bu kişi" diye aktaramaz) ve tuzlu özettir (uid'den geri çözülemez).
//   • 18 yaş kanıtı olmayan ya da katılımı kapalı olan hiç profillenmez.

const { createHash } = require("node:crypto");
const core = require("./tasteMatchCore");
const { sideToTasteUser } = require("./tasteMatchAdapter");
const { laneStrength } = require("./matchStrengthCore");
const { weightedGenres } = require("./tasteGenreCanon");

const DAY = 86400000;
const MATCH_LANES = Object.freeze(["movie", "tv"]);
const ALLOWED_LANES = Object.freeze(["movie", "tv", "anime"]); // kuralın kabul ettiği; anime kulvarı henüz yok
const CONSENT_VERSION = 1; // utils/matchFeature.js MATCH_CONSENT_VERSION ile aynı (test)

/** Sunucu ayarları. `AppConfig/match` belgesindeki aynı adlı sayısal alanlar bunları ezer (parseServerConfig). */
const SERVER_DEFAULTS = Object.freeze({
  profileMinHours: 6, // aynı kullanıcının profili en sık bu aralıkla yeniden kurulur
  activeDays: 30, // ikiz için iki taraf da bu kadar gün içinde etkin olmalı (§8)
  maxSuggestions: 5, // kulvar başına gösterilen aday (§8)
  mutualTop: 10, // karşılıklı ilk N (§8)
  minScore: 80, // "yakın zevk" alt sınırı; altı önerilmez
  twinPoolMin: 150, // kulvar havuzu bundan küçükse "ikiz" iddiası ve çember YOK (§7)
  circleMin: 3,
  circleMax: 10,
  circleAvg: 88,
  circleEdge: 80,
  helloDailyLimit: 10,
  prefilterPool: 400, // havuz bunu aşınca önce içerik profiliyle en yakın K aday süzülür (ölçüm: 1000 kişi tam çift ~70 sn/kulvar)
  prefilterK: 100,
  titleFeaturesTtlDays: 90,
  tmdbPerRun: 1500, // gece başına en çok yeni/bayat yapım özelliği isteği
  maxItemsPerLane: 3000, // profil belgesi 1 MB sınırının altında kalsın (en yeniler tutulur)
});

const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const asArray = (v) => (Array.isArray(v) ? v : []);
const validId = (id) => Number.isInteger(Number(id)) && Number(id) > 0;

/** `AppConfig/match` → { enabled, server: {...SERVER_DEFAULTS, ...geçerli sayılar}, core: çekirdek sabitleri }. */
function parseServerConfig(data) {
  const d = data && typeof data === "object" ? data : {};
  const server = { ...SERVER_DEFAULTS };
  for (const key of Object.keys(SERVER_DEFAULTS)) if (isNum(d[key]) && d[key] >= 0) server[key] = d[key];
  // Çekirdek eşikleri (twinThreshold, nearThreshold…) yalnız DEFAULTS'ta var olan sayısal anahtarlarla ezilir.
  const coreOverrides = {};
  const src = d.core && typeof d.core === "object" ? d.core : {};
  for (const [key, value] of Object.entries(src)) if (isNum(core.DEFAULTS[key]) && isNum(value)) coreOverrides[key] = value;
  return { enabled: d.enabled === true, server, core: coreOverrides };
}

// ── yaş kapısı (utils/ageGate.js isAdultBirthDate aynası; parity testi kökte) ──
function isAdultBirthDate(value, now = new Date()) {
  if (typeof value !== "string") return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(y, mo - 1, d);
  if (probe.getFullYear() !== y || probe.getMonth() !== mo - 1 || probe.getDate() !== d) return false;
  if (Number.isNaN(now?.getTime?.())) return false;
  let age = now.getFullYear() - y;
  const diff = now.getMonth() + 1 - mo;
  if (diff < 0 || (diff === 0 && now.getDate() < d)) age -= 1;
  return age >= 18 && age <= 120;
}

/** Katılım belgesi (Users/{uid}/private/match) → { optedIn, lanes }. Eski onay sürümü katılım sayılmaz. */
function readOptIn(data) {
  const d = data && typeof data === "object" ? data : null;
  if (!d || d.optIn !== true || !isNum(d.consentVersion) || d.consentVersion < CONSENT_VERSION) return { optedIn: false, lanes: [] };
  const lanes = [...new Set(asArray(d.lanes).filter((l) => MATCH_LANES.includes(l)))];
  return { optedIn: lanes.length > 0, lanes };
}

// ── profil girdisi ───────────────────────────────────────────────────────────

const genreNames = (item) =>
  asArray(item?.genres)
    .map((g) => (typeof g === "string" ? g : g?.name))
    .filter((g) => typeof g === "string" && g.trim())
    .slice(0, 6);

/** Dizi kaydından son izleme anı (ms) — bırakma sinyali için. */
function lastWatchMs(show) {
  let last = null;
  for (const ev of asArray(show?.watchEvents)) {
    const t = toMs(ev?.watchedAt ?? ev?.recordedAt);
    if (t != null && (last == null || t > last)) last = t;
  }
  return last ?? toMs(show?.addedShowDate ?? show?.dateAdded);
}

function toMs(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? (value > 1e12 ? value : value * 1000) : null;
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : null;
  }
  if (typeof value.toMillis === "function") return value.toMillis();
  if (isNum(value.seconds)) return value.seconds * 1000;
  if (isNum(value._seconds)) return value._seconds * 1000;
  return null;
}

/**
 * Firestore'dan okunan ham veriler → saklanacak sıkıştırılmış kulvar öğeleri + eşleşme gücü.
 * `side` istemci arkadaş kartıyla aynı şekil (tasteMatchAdapter.sideToTasteUser): aynı veri aynı sinyal.
 * @param {{ side: object, commentKeys?: string[], fourFavorites?: object, lanes: string[], now?: number, maxItemsPerLane?: number }} input
 * @returns {{ lanes: Record<string, { items: object[], strength: object }> }}
 */
function buildLaneInputs({ side, commentKeys = [], fourFavorites = null, lanes, now = Date.now(), maxItemsPerLane = SERVER_DEFAULTS.maxItemsPerLane }) {
  const s = side || {};
  const user = sideToTasteUser(s);
  // Dizi ilerlemesi: TitleFeatures'taki toplam bölümle "bitirdi / bıraktı" gece hesaplanır.
  const tvProgress = new Map();
  for (const t of asArray(s.watchedShows)) {
    if (!t || !validId(t.id)) continue;
    tvProgress.set(`tv_${Number(t.id)}`, { ep: Number(t.watchedEpisodeCount) || 0, last: lastWatchMs(t) });
  }
  const fav = fourFavorites && typeof fourFavorites === "object" ? fourFavorites : {};
  const out = {};
  for (const lane of lanes) {
    if (!MATCH_LANES.includes(lane)) continue;
    const items = user.items
      .filter((it) => (lane === "tv" ? it.type === "tv" : it.type !== "tv"))
      .map((it) => compactItem(it, tvProgress.get(it.key)))
      .sort((a, b) => (b.at ?? 0) - (a.at ?? 0) || (a.key < b.key ? -1 : 1))
      .slice(0, maxItemsPerLane);
    const strength = laneStrength({
      lane,
      items: lane === "tv" ? s.watchedShows : s.watchedMovies,
      ratings: s.ratings,
      commentKeys,
      fourFavorites: asArray(lane === "tv" ? fav.shows : fav.movies).length,
      now,
    });
    out[lane] = { items, strength: { eligible: !!strength.eligible, strength: strength.strength, path: strength.path ?? null } };
  }
  return { lanes: out };
}

/** Saklanan öğe: kısa alan adları (belge boyutu). Ad / afiş / tarih metni YOK. */
function compactItem(it, tv) {
  const out = { key: it.key, g: genreNames(it) };
  if (isNum(it.rating)) out.r = it.rating;
  if (it.favorite) out.f = 1;
  if (isNum(it.watchCount) && it.watchCount >= 2) out.w = it.watchCount;
  if (isNum(it.minutes)) out.m = Math.round(it.minutes);
  if (isNum(it.addedAt)) out.at = Math.floor(it.addedAt / 1000) * 1000;
  if (it.tv?.nextSeason) out.ns = 1;
  if (it.tv?.finished) out.fin = 1;
  if (tv && tv.ep > 0) out.ep = tv.ep;
  if (tv && isNum(tv.last)) out.last = tv.last;
  return out;
}

/** TitleFeatures belge kimliği: "movie_123" / "tv_45" (liste anahtarıyla aynı). */
const titleIdOf = (key) => (/^(movie|tv)_\d+$/.test(key) ? key : null);

/**
 * TMDB ayrıntı yanıtı (append_to_response=keywords) → TitleFeatures belgesi. Kişisel veri yok.
 * @param {"movie"|"tv"} type
 */
function titleFeaturesFromTmdb(type, json, now = Date.now()) {
  if (!json || typeof json !== "object") return null;
  const kw = asArray(type === "tv" ? json.keywords?.results : json.keywords?.keywords)
    .map((k) => Number(k?.id))
    .filter((id) => Number.isInteger(id) && id > 0)
    .slice(0, 20);
  const studios = asArray(json.production_companies)
    .map((c) => Number(c?.id))
    .filter((id) => Number.isInteger(id) && id > 0)
    .slice(0, 3);
  const date = type === "tv" ? json.first_air_date : json.release_date;
  const year = typeof date === "string" && /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null;
  const doc = {
    type,
    voteAverage: isNum(json.vote_average) ? json.vote_average : null,
    voteCount: isNum(json.vote_count) ? json.vote_count : null,
    lang: typeof json.original_language === "string" ? json.original_language.slice(0, 5) : null,
    year,
    kw,
    studios,
    fetchedAt: now,
  };
  if (type === "tv") {
    doc.episodes = isNum(json.number_of_episodes) ? json.number_of_episodes : null;
    doc.status = typeof json.status === "string" ? json.status.slice(0, 30) : null;
  } else {
    doc.runtime = isNum(json.runtime) ? json.runtime : null;
  }
  return doc;
}

const DROP_IDLE_DAYS = 120;
const ENDED = new Set(["Ended", "Canceled"]);

/**
 * Saklanan öğe + TitleFeatures → çekirdek girdisi. Özellik yoksa "lite" alanlarla devam eder.
 * Dizi: toplam bölüm biliniyorsa bitirdi; bitmiş ya da iptal dizide yarıdan azı izlenmiş ve 120 gündür
 * dokunulmamışsa bıraktı. Devam eden dizi bırakılmış SAYILMAZ (adaptördeki ilke).
 */
function enrichItem(stored, tf, now = Date.now()) {
  const it = { key: stored.key, type: stored.key.startsWith("tv_") ? "tv" : "movie", genres: stored.g || [] };
  if (isNum(stored.r)) it.rating = stored.r;
  if (stored.f) it.favorite = true;
  if (isNum(stored.w)) it.watchCount = stored.w;
  if (isNum(stored.m)) it.minutes = stored.m;
  if (isNum(stored.at)) it.addedAt = stored.at;
  const tv = {};
  if (stored.ns) tv.nextSeason = true;
  if (stored.fin) tv.finished = true;
  if (tf) {
    if (isNum(tf.voteAverage)) it.voteAverage = tf.voteAverage;
    if (isNum(tf.voteCount)) it.voteCount = tf.voteCount;
    if (isNum(tf.year)) it.year = tf.year;
    if (tf.lang) it.originalLanguage = tf.lang;
    if (!isNum(it.minutes) && isNum(tf.runtime) && tf.runtime > 0) it.minutes = tf.runtime;
    const features = [];
    for (const id of asArray(tf.kw)) features.push(`kw:${id}`);
    if (tf.lang) features.push(`lang:${tf.lang}`);
    for (const id of asArray(tf.studios)) features.push(`studio:${id}`);
    if (features.length) it.features = features;
    if (it.type === "tv" && isNum(tf.episodes) && tf.episodes > 0 && isNum(stored.ep)) {
      if (stored.ep >= tf.episodes) tv.finished = true;
      else if (ENDED.has(tf.status) && stored.ep < tf.episodes / 2 && isNum(stored.last) && now - stored.last > DROP_IDLE_DAYS * DAY) {
        tv.dropped = true;
      }
    }
  }
  if (Object.keys(tv).length) it.tv = tv;
  return it;
}

// ── havuz, skor, karar ───────────────────────────────────────────────────────

/**
 * Kulvar havuzu: katılmış + 18+ + o kulvarı seçmiş + o kulvarda eşleşme gücü yeterli + boş olmayan.
 * @param {Array<object>} members { uid, adult, lanes, profile: { lanes: { [lane]: { items, strength } } } }
 */
function laneEligible(members, lane) {
  return asArray(members).filter((m) => {
    const l = m?.profile?.lanes?.[lane];
    return m && m.adult === true && asArray(m.lanes).includes(lane) && l?.strength?.eligible === true && asArray(l.items).length > 0;
  });
}

const blockedEither = (blocks, a, b) => !!(blocks?.get(a)?.has(b) || blocks?.get(b)?.has(a));

/**
 * Kulvar için bütün skor hesabı. Döner: { ctx, profiles: Map(uid→profil), scores: Map(uid→[{uid, r}] skora göre azalan) }.
 * Havuz `prefilterPool`'dan büyükse her kullanıcı için önce içerik profiline göre en yakın K aday süzülür (§6 adım 1).
 */
function scoreLane(pool, lane, { features = new Map(), cfg = SERVER_DEFAULTS, coreConfig = {}, blocks = new Map(), now = Date.now() } = {}) {
  const users = pool.map((m) => ({
    uid: m.uid,
    items: m.profile.lanes[lane].items.map((s) => enrichItem(s, features.get(s.key), now)),
  }));
  return scoreUsers(users, { cfg, coreConfig, blocks, now });
}

function scoreUsers(users, { cfg = SERVER_DEFAULTS, coreConfig = {}, blocks = new Map(), now = Date.now() } = {}) {
  const k3Mode = users.some((u) => u.items.some((it) => it.features)) ? "full" : "lite";
  const ctx = core.buildContext(users, { config: coreConfig, k3Mode, now });
  const profiles = new Map(users.map((u) => [u.uid, core.buildProfile(u, ctx, { now })]));
  const uids = users.map((u) => u.uid).sort();
  const candidatesOf = candidateFinder(uids, profiles, cfg);
  const scores = new Map(uids.map((u) => [u, []]));
  const done = new Set();
  for (const a of uids) {
    for (const b of candidatesOf(a)) {
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (done.has(key) || blockedEither(blocks, a, b)) continue;
      done.add(key);
      const r = core.scorePair(profiles.get(a), profiles.get(b), ctx);
      if (!r) continue;
      scores.get(a).push({ uid: b, r });
      scores.get(b).push({ uid: a, r });
    }
  }
  for (const list of scores.values()) list.sort((x, y) => y.r.score - x.r.score || (x.uid < y.uid ? -1 : 1));
  return { ctx, profiles, scores };
}

function cosineOf(a, b) {
  let d = 0;
  let na = 0;
  let nb = 0;
  for (const v of Object.values(a)) na += v * v;
  for (const v of Object.values(b)) nb += v * v;
  for (const [k, v] of Object.entries(a)) if (b[k] !== undefined) d += v * b[k];
  return na && nb ? d / Math.sqrt(na * nb) : 0;
}

/** Küçük havuzda herkes aday; büyükte içerik profiline (cv) göre en yakın K. Belirlenimli. */
function candidateFinder(uids, profiles, cfg) {
  if (uids.length <= cfg.prefilterPool) return (a) => uids.filter((b) => b !== a);
  return (a) => {
    const pa = profiles.get(a);
    return uids
      .filter((b) => b !== a)
      .map((b) => ({ b, c: cosineOf(pa.cv, profiles.get(b).cv) }))
      .sort((x, y) => y.c - x.c || (x.b < y.b ? -1 : 1))
      .slice(0, cfg.prefilterK)
      .map((x) => x.b);
  };
}

/**
 * §8 kararları → kullanıcı başına aday listesi (en çok maxSuggestions).
 * twin: skor ≥ ikiz eşiği ∧ karşılıklı ilk N ∧ iki taraf etkin ∧ havuz ≥ twinPoolMin.
 * near: skor ≥ minScore (havuz küçükken ikiz düzeyi de "near" etiketiyle gelir).
 * guide: deneyim tavanı öncesi ikiz düzeyi ∧ oran ≥ 3 → yüzde GÖSTERİLMEZ.
 * @param {Map<string, Array<{uid, r}>>} scores
 * @param {{ active: Set<string>, poolSize: number }} meta
 */
function decideSuggestions(scores, { active = new Set(), poolSize = 0, cfg = SERVER_DEFAULTS, coreConfig = {} } = {}) {
  const twinAt = isNum(coreConfig.twinThreshold) ? coreConfig.twinThreshold : core.DEFAULTS.twinThreshold;
  const twinsEnabled = poolSize >= cfg.twinPoolMin;
  const topOf = new Map();
  for (const [uid, list] of scores) topOf.set(uid, new Set(list.slice(0, cfg.mutualTop).map((x) => x.uid)));
  const out = new Map();
  for (const [uid, list] of scores) {
    const picks = [];
    for (const { uid: other, r } of list) {
      if (picks.length >= cfg.maxSuggestions) break;
      let verdict = null;
      if (r.flags?.guide) verdict = "guide";
      else if (r.score >= twinAt && twinsEnabled && topOf.get(uid)?.has(other) && topOf.get(other)?.has(uid) && active.has(uid) && active.has(other)) verdict = "twin";
      else if (r.score >= cfg.minScore) verdict = "near";
      if (!verdict) continue;
      picks.push({ uid: other, verdict, r });
    }
    out.set(uid, picks);
  }
  return { suggestions: out, twinsEnabled };
}

/**
 * §6 çember kurulumu (açgözlü, belirlenimli). Kenar = skor ≥ circleEdge. Her üye en çok bir çemberde.
 * Şartlar: 3–10 kişi; her üyenin diğerleriyle ORTALAMA skoru ≥ circleAvg; en düşük ikili skor ≥ circleEdge.
 * @returns {Array<string[]>} üye uid listeleri (sıralı)
 */
function formCircles(scores, { cfg = SERVER_DEFAULTS, enabled = true } = {}) {
  if (!enabled) return [];
  const edge = new Map();
  const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const strong = new Map();
  for (const [a, list] of scores) {
    for (const { uid: b, r } of list) {
      edge.set(key(a, b), r.score);
      if (r.score >= cfg.circleEdge) {
        if (!strong.has(a)) strong.set(a, new Set());
        strong.get(a).add(b);
      }
    }
  }
  const w = (a, b) => edge.get(key(a, b)) ?? -Infinity;
  const weight = (a) => [...(strong.get(a) || [])].reduce((s, b) => s + w(a, b), 0);
  const seeds = [...strong.keys()].sort((x, y) => weight(y) - weight(x) || (x < y ? -1 : 1));
  const used = new Set();
  const circles = [];
  const valid = (members) =>
    members.every((m) => {
      const others = members.filter((o) => o !== m);
      const ws = others.map((o) => w(m, o));
      return ws.every((x) => x >= cfg.circleEdge) && ws.reduce((s, x) => s + x, 0) / ws.length >= cfg.circleAvg;
    });
  for (const seed of seeds) {
    if (used.has(seed)) continue;
    const members = [seed];
    for (;;) {
      if (members.length >= cfg.circleMax) break;
      const pool = [...(strong.get(seed) || [])].filter((c) => !used.has(c) && !members.includes(c));
      let best = null;
      let bestAvg = -Infinity;
      for (const c of pool.sort()) {
        const next = [...members, c];
        if (members.length >= 2 && !valid(next)) continue;
        if (members.some((m) => w(m, c) < cfg.circleEdge)) continue;
        const avg = members.reduce((s, m) => s + w(m, c), 0) / members.length;
        if (avg > bestAvg) {
          bestAvg = avg;
          best = c;
        }
      }
      if (!best) break;
      members.push(best);
    }
    if (members.length >= cfg.circleMin && valid(members)) {
      members.sort();
      members.forEach((m) => used.add(m));
      circles.push(members);
    }
  }
  return circles;
}

// ── opak kimlik ve belge şekilleri ───────────────────────────────────────────

/** Sahibe özel, tuzlu, belirlenimli aday kimliği (22 karakter base64url). */
function opaqueId(salt, owner, candidate, lane) {
  return createHash("sha256").update(`${salt}|${owner}|${candidate}|${lane}`).digest("base64url").slice(0, 22);
}

/** Çember anahtarı: üyelerden türetilir (aynı üyeler → aynı anahtar); üye uid'si içermez. */
function circleKey(salt, lane, members) {
  return createHash("sha256").update(`${salt}|circle|${lane}|${[...members].sort().join(",")}`).digest("base64url").slice(0, 22);
}

/** Çember adı için baskın iki kanonik tür (üyelerin ortak sevdiklerinden). */
function circleGenres(memberItems) {
  const tally = new Map();
  for (const items of memberItems) {
    for (const it of items) {
      const liked = it.f || (isNum(it.r) && it.r >= 8) || it.w;
      if (!liked) continue;
      for (const [gid, wt] of weightedGenres(it.g || [])) tally.set(gid, (tally.get(gid) || 0) + wt);
    }
  }
  return [...tally.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 2).map(([gid]) => gid);
}

/** Aday kartının herkese açık kısmı. Başka alan EKLEME (gizlilik değişmezi, test). */
/**
 * Öneri belgesindeki çember görünümü (sahibe göre). Katılmayan üyelerin kimliği YOK; yalnız sayılar.
 * Grup kimliği yalnız katılmış sahibe verilir (katılmayan önce "katıl" der, sonra gruba eklenir).
 */
function circleView(circle, state, owner) {
  const joined = state?.joined || {};
  const me = !!joined[owner];
  return {
    key: circle.key,
    size: circle.size,
    genres: circle.genres || [],
    joined: me,
    joinedCount: Object.keys(joined).length,
    groupId: me ? state?.groupId || null : null,
    groupReady: !!state?.groupId,
  };
}

function publicCard(user) {
  const u = user || {};
  return {
    displayName: typeof u.displayName === "string" ? u.displayName.slice(0, 60) : "",
    avatarIndex: isNum(u.avatarIndex) ? u.avatarIndex : 0,
    photoURL: typeof u.photoURL === "string" ? u.photoURL : null,
  };
}

/**
 * Bir sahibin kulvar öneri girdisi. `greetedBy`: bana selam vermiş adaylar; `sentTo`: benim selam verdiklerim.
 * @returns {{ items: object[], map: Record<string, string> }} items istemciye, map (cid→uid) yalnız sunucuya
 */
function buildLaneSuggestion({ owner, lane, picks, salt, cards, greetedBy = new Set(), sentTo = new Set() }) {
  const items = [];
  const map = {};
  for (const { uid, verdict, r } of picks) {
    const cid = opaqueId(salt, owner, uid, lane);
    map[cid] = uid;
    items.push({
      cid,
      verdict,
      score: verdict === "guide" ? null : r.display,
      ...publicCard(cards.get(uid)),
      loved: asArray(r.explain?.loved).slice(0, 5),
      split: r.explain?.split ?? null,
      implicitHeavy: !!r.flags?.implicitHeavy,
      greeted: greetedBy.has(uid),
      sent: sentTo.has(uid),
    });
  }
  return { items, map };
}

/** Selam günlük sınırı: { day, count } → izin + yeni sayaç. Gün UTC. */
function nextHelloQuota(prev, now, limit = SERVER_DEFAULTS.helloDailyLimit) {
  const day = Math.floor(now / DAY);
  const count = prev && prev.day === day && isNum(prev.count) ? prev.count : 0;
  if (count >= limit) return { allowed: false, quota: { day, count } };
  return { allowed: true, quota: { day, count: count + 1 } };
}

/** İki uid için tek selam belgesi anahtarı (sıralı). */
const helloKey = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);

/** Profil yeniden kurulmalı mı? Kaynak damgası değişmediyse ya da son kurulum çok yeniyse hayır. */
function needsRebuild(profile, { sourceStamp, lanes, now = Date.now(), cfg = SERVER_DEFAULTS }) {
  if (!profile || profile.v !== PROFILE_VERSION) return true;
  const sameLanes = [...asArray(profile.optLanes)].sort().join(",") === [...asArray(lanes)].sort().join(",");
  if (!sameLanes) return true;
  if (isNum(sourceStamp) && isNum(profile.sourceStamp) && sourceStamp <= profile.sourceStamp) return false;
  return !(isNum(profile.builtAt) && now - profile.builtAt < cfg.profileMinHours * 3600000);
}
const PROFILE_VERSION = 1;

module.exports = {
  DAY,
  MATCH_LANES,
  ALLOWED_LANES,
  CONSENT_VERSION,
  SERVER_DEFAULTS,
  PROFILE_VERSION,
  parseServerConfig,
  isAdultBirthDate,
  readOptIn,
  toMs,
  buildLaneInputs,
  compactItem,
  titleIdOf,
  titleFeaturesFromTmdb,
  enrichItem,
  laneEligible,
  scoreLane,
  scoreUsers,
  candidateFinder,
  decideSuggestions,
  formCircles,
  opaqueId,
  circleKey,
  circleGenres,
  circleView,
  publicCard,
  buildLaneSuggestion,
  nextHelloQuota,
  helloKey,
  needsRebuild,
};
