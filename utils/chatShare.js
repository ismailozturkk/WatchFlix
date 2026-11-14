// utils/chatShare.js
//
// "Sohbete gönder" — liste ve CineMatch (AI) cevabı gibi ZENGİN içeriklerin
// sohbet/grup mesajına dönüştürülmesinin SAF çekirdeği (Firebase/React yok, jest
// ile test edilir).
//
// Mesaj şeması (1-1 ve grup AYNI):
//   kind:  "listShare" | "aiShare"
//   text:  gelen kutusu / bildirim / alıntı için kısa önizleme ("📋 Başlık")
//   share: aşağıdaki gövde (mesajın İÇİNE gömülü anlık görüntü)
//
// Neden anlık görüntü (bağlantı değil): alıcının listeyi okuma yetkisi olmayabilir
// (kişisel liste), AI cevabı hiçbir yerde kalıcı değil ve gönderen sonradan
// listeyi değiştirse de sohbet o anki halini göstermeli. Bedeli doküman boyutu —
// bu yüzden her alan kırpılır, öğe sayısı sınırlıdır (1 MiB doküman tavanının çok
// altında: en kötü durumda ~40 KB).
//
// Neden "list" değil "listShare": eski sürümlerde `kind: "list"` içeren,
// `items` dizili kayıtlar olabilir (bkz. utils/chatReply.js); yeni türler bunlarla
// KARIŞMASIN diye ayrı adlandırıldı.
//
//   (post / tournament / cineRoom gövdeleri aşağıdaki build*/sanitize* içinde)
//   list share  { v, type:"list", title, listKey?, source?, total, items[] }
//     item      { id, media_type, title, poster_path?, genres?, minutes?, … }
//   ai share    { v, type:"ai", variant, question?, summary?, versus?, compare?, spotlight?,
//                 total, sections[] }
//     section   { label?, labelKey?, note?, picks[] }
//     pick      { media_type, title, id?, poster_path?, year?, rating?, note?, must?,
//                 minutes?, genres? }
//     compare   { metrics?[{key?,label?,left,right}], leftPros?, leftCons?, rightPros?, rightCons? }
//     spotlight { backdrop_path?, tagline?, director?, cast?, overview? }
//
// `id` yalnız TMDB'de BULUNAN başlıklarda var; yoksa kart dokunulamaz (alıcı
// tarafında detay ekranına gidecek kimlik yok).

import { isInviteMessageId } from "./chatInvites";
import { i18nText } from "./i18nText";
import { tmdbPathFromPoster, MAX_SHARED_LIST_ITEMS } from "./listShare";
import { PREVIEW_MAX } from "./threadPreview";
import { tierOf } from "./tasteMatch";
import { sanitizeBracketSnapshot } from "./tournamentShare";
import { sanitizeSettingsShare, SETTINGS_SHARE_TYPE, settingsShareSectionIds } from "./settingsShare";
import { sanitizeTvGraphShare, TV_GRAPH_SHARE_TYPE } from "./tvGraphShare";

export const SHARE_VERSION = 1;

export const SHARE_KIND = Object.freeze({
  LIST: "listShare",
  AI: "aiShare",
  POST: "postShare",
  TOURNAMENT: "tournamentShare",
  CINE_ROOM: "cineRoomShare",
  TASTE_MATCH: "tasteMatchShare",
  CHALLENGE: "challengeShare",
  DUEL_RESULT: "duelResultShare",
  SETTINGS: "settingsShare",
  FRAME: "frameShare",
  CHAIN: "chainShare",
  CLUB: "clubShare",
  TIER_LIST: "tierListShare",
  TV_GRAPH: "tvGraphShare",
});

export const SHARE_TYPE = Object.freeze({
  LIST: "list",
  AI: "ai",
  POST: "post",
  TOURNAMENT: "tournament",
  CINE_ROOM: "cineRoom",
  TASTE_MATCH: "tasteMatch",
  CHALLENGE: "challenge",
  DUEL_RESULT: "duelResult",
  FRAME: "frame",
  CHAIN: "chain",
  CLUB: "club",
  TIER_LIST: "tierList",
  // Gövde utils/tvGraphShare.js'te (dizi bölüm grafiği anlık görüntüsü).
  TV_GRAPH: TV_GRAPH_SHARE_TYPE,
  // Gövdenin kendisi utils/settingsShare.js'te (görünüm ayarları; alıcı seçerek uygular).
  SETTINGS: SETTINGS_SHARE_TYPE,
});

const KIND_BY_TYPE = {
  [SHARE_TYPE.LIST]: SHARE_KIND.LIST,
  [SHARE_TYPE.AI]: SHARE_KIND.AI,
  [SHARE_TYPE.POST]: SHARE_KIND.POST,
  [SHARE_TYPE.TOURNAMENT]: SHARE_KIND.TOURNAMENT,
  [SHARE_TYPE.CINE_ROOM]: SHARE_KIND.CINE_ROOM,
  [SHARE_TYPE.TASTE_MATCH]: SHARE_KIND.TASTE_MATCH,
  [SHARE_TYPE.CHALLENGE]: SHARE_KIND.CHALLENGE,
  [SHARE_TYPE.DUEL_RESULT]: SHARE_KIND.DUEL_RESULT,
  [SHARE_TYPE.SETTINGS]: SHARE_KIND.SETTINGS,
  [SHARE_TYPE.FRAME]: SHARE_KIND.FRAME,
  [SHARE_TYPE.CHAIN]: SHARE_KIND.CHAIN,
  [SHARE_TYPE.CLUB]: SHARE_KIND.CLUB,
  [SHARE_TYPE.TIER_LIST]: SHARE_KIND.TIER_LIST,
  [SHARE_TYPE.TV_GRAPH]: SHARE_KIND.TV_GRAPH,
};
const SHARE_KINDS = Object.values(SHARE_KIND);

// Liste: kaydetme akışının tavanıyla (SaveSharedListModal) AYNI — daha fazlası
// saklansa bile kaydedilemezdi.
export const MAX_LIST_SHARE_ITEMS = MAX_SHARED_LIST_ITEMS;
export const MAX_AI_SHARE_PICKS = 24;
export const MAX_AI_SHARE_SECTIONS = 10;

const MAX_TITLE = 90;
const MAX_LIST_TITLE = 60;
const MAX_NOTE = 160;
const MAX_SUMMARY = 700;
const MAX_QUESTION = 160;
const MAX_LABEL = 60;

// Öntanımlı dört profil listesi: alıcı etiketi KENDİ dilinde çözer (gönderenin
// çevrilmiş başlığı yerine), vurgu rengi/ikonu da bu anahtardan gelir.
export const DEFAULT_LIST_KEYS = Object.freeze([
  "watchedMovies",
  "watchedTv",
  "favorites",
  "watchList",
]);

export const AI_VARIANTS = Object.freeze([
  "recommendations",
  "comparison",
  "watch_plan",
  "watchlist",
  "title_spotlight",
  "general",
]);

// ─── Küçük temizleyiciler ────────────────────────────────────────────────────

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** Tek satır metin: boşlukları sıkıştırır, kırpar. Metin değilse "". */
export function clip(value, max) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

/** Çok satırlı metin (özet): satır sonlarını korur, art arda boş satırı tek yapar. */
export function clipMultiline(value, max) {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

const finitePositive = (value) => (Number.isFinite(value) && value > 0 ? value : null);

const mediaTypeOf = (...candidates) => {
  for (const candidate of candidates) {
    if (candidate === "tv" || candidate === "series" || candidate === "show") return "tv";
    if (candidate === "movie") return "movie";
  }
  return "movie";
};

const posterPathOf = (raw) => {
  const direct = raw?.poster_path || raw?.posterPath || raw?.imagePath;
  if (typeof direct === "string" && direct.startsWith("/")) return direct;
  return tmdbPathFromPoster(raw?.poster) || null;
};

const idOf = (raw) => {
  const id = raw?.id;
  return typeof id === "number" || (typeof id === "string" && id !== "") ? id : null;
};

// ─── Liste ───────────────────────────────────────────────────────────────────

// Liste paylaşımının kaynağı: profil listesi, ortak liste ya da CineSwipe odasının
// ortak eşleşmeleri. Tanınmayan kaynak düşürülür (kart düz liste olarak çizilir).
export const LIST_SOURCES = Object.freeze(["profile", "shared", "cineswipe"]);

/**
 * Profil/ortak liste öğesi veya paylaşım medyası → mesaja gömülecek kompakt medya.
 * Alan adları `utils/listShare.mediaToListItem` ile UYUMLU (alıcı "Listeyi kaydet"
 * dediğinde aynı dönüştürücüden geçer): media_type, title, poster_path, genres,
 * minutes/episode olguları.
 */
export function toShareMedia(raw, { fallbackType = "movie" } = {}) {
  const id = idOf(raw);
  if (id === null) return null;
  const media = {
    id,
    media_type: mediaTypeOf(raw.media_type, raw.type, fallbackType),
    title: clip(raw.title || raw.name, MAX_TITLE),
  };
  const poster = posterPathOf(raw);
  if (poster) media.poster_path = poster;

  const genres = Array.isArray(raw.genres)
    ? raw.genres.filter((g) => typeof g === "string" && g.trim()).map((g) => clip(g, 30)).slice(0, 4)
    : [];
  if (genres.length) media.genres = genres;

  const date = raw.release_date || raw.first_air_date;
  const year = clip(raw.year || (date ? String(date).slice(0, 4) : ""), 4);
  if (/^\d{4}$/.test(year)) media.year = year;

  const rating = finitePositive(raw.vote_average ?? raw.rating);
  if (rating) media.vote_average = Math.round(rating * 10) / 10;

  // Süre olguları: "Listeyi kaydet" tekrar TMDB'ye gitmesin, kaydedilen liste
  // süre rozetini anında göstersin (bkz. listShare.mediaToListItem).
  ["minutes", "episodeMinutes", "episodeCount", "seasonCount", "totalMinutes"].forEach((field) => {
    const value = finitePositive(raw[field]);
    if (value) media[field] = Math.round(value);
  });
  return media;
}

/**
 * Bir listeyi paylaşım gövdesine çevirir. Boş/geçersizse null (gönderilecek bir
 * şey yok — çağıran düğmeyi zaten pasif tutmalı).
 *
 * @param {object}   opts
 * @param {string}   opts.title      Görünen liste adı (gönderenin dilinde).
 * @param {object[]} opts.items      Profil listesi öğeleri `{id,type,name,imagePath,…}`.
 * @param {string}  [opts.listKey]   Öntanımlı liste anahtarı (alıcı etiketi çevirir).
 * @param {string}  [opts.fallbackType]  Tür alanı olmayan öğeler için ("tv" listeleri).
 * @param {"profile"|"shared"|"cineswipe"} [opts.source]
 *   "cineswipe": bir CineSwipe odasının ortak eşleşmeleri (davetin geldiği sohbete
 *   oda bitince yazılır); kart kendi başlığını ve rengini bu kaynaktan alır.
 */
export function buildListShare({ title, items, listKey, fallbackType = "movie", source } = {}) {
  const seen = new Set();
  const media = [];
  let total = 0;
  (Array.isArray(items) ? items : []).forEach((raw) => {
    const item = toShareMedia(raw, { fallbackType });
    if (!item) return;
    const key = `${item.media_type}_${item.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    total += 1;
    if (media.length < MAX_LIST_SHARE_ITEMS) media.push(item);
  });
  if (media.length === 0) return null;

  const share = {
    v: SHARE_VERSION,
    type: SHARE_TYPE.LIST,
    title: clip(title, MAX_LIST_TITLE),
    total,
    items: media,
  };
  if (DEFAULT_LIST_KEYS.includes(listKey)) share.listKey = listKey;
  if (LIST_SOURCES.includes(source)) share.source = source;
  return share;
}

function sanitizeListShare(raw) {
  const seen = new Set();
  const items = [];
  (Array.isArray(raw.items) ? raw.items : []).forEach((entry) => {
    const item = toShareMedia(entry);
    if (!item) return;
    const key = `${item.media_type}_${item.id}`;
    if (seen.has(key) || items.length >= MAX_LIST_SHARE_ITEMS) return;
    seen.add(key);
    items.push(item);
  });
  if (items.length === 0) return null;
  const total = Number.isFinite(raw.total) ? Math.max(items.length, Math.round(raw.total)) : items.length;
  const share = {
    v: SHARE_VERSION,
    type: SHARE_TYPE.LIST,
    title: clip(raw.title, MAX_LIST_TITLE),
    total,
    items,
  };
  if (DEFAULT_LIST_KEYS.includes(raw.listKey)) share.listKey = raw.listKey;
  if (LIST_SOURCES.includes(raw.source)) share.source = raw.source;
  return share;
}

// ─── AI cevabı ───────────────────────────────────────────────────────────────

function sanitizePick(raw) {
  if (!isObject(raw)) return null;
  const title = clip(raw.title, MAX_TITLE);
  if (!title) return null;
  const pick = { media_type: mediaTypeOf(raw.media_type, raw.mediaType), title };
  const id = idOf(raw);
  if (id !== null) pick.id = id;
  const poster = posterPathOf(raw);
  if (poster) pick.poster_path = poster;
  const year = clip(String(raw.year ?? ""), 4);
  if (/^\d{4}$/.test(year)) pick.year = year;
  const rating = finitePositive(raw.rating ?? raw.vote_average);
  if (rating) pick.rating = Math.round(rating * 10) / 10;
  const note = clip(raw.note, MAX_NOTE);
  if (note) pick.note = note;
  if (raw.must === true) pick.must = true;
  // Kalıp olguları (CineMatch kartındaki gibi): süre ve en çok üç tür.
  const minutes = finitePositive(raw.minutes ?? raw.runtimeMinutes);
  if (minutes && minutes <= MAX_PICK_MINUTES) pick.minutes = Math.round(minutes);
  const genres = shortList(raw.genres, 3, 24);
  if (genres.length) pick.genres = genres;
  return pick;
}

// Karşılaştırma tablosu ve yapım detayı — AI ekranındaki kalıbın sohbette aynı
// düzende çizilebilmesi için gereken ek alanlar. Hepsi isteğe bağlı: eski
// mesajlarda yoktur, kart yokluğunda o bloğu çizmez.
const MAX_PICK_MINUTES = 1000;
const MAX_METRICS = 6;
const MAX_PROS = 3;
const MAX_PRO_TEXT = 100;
const MAX_OVERVIEW = 420;

function shortList(raw, max, maxText) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => clip(entry, maxText))
    .filter(Boolean)
    .slice(0, max);
}

const scoreOf = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(5, Math.round(n))) : null;
};

function sanitizeCompare(raw) {
  if (!isObject(raw)) return null;
  const metrics = [];
  (Array.isArray(raw.metrics) ? raw.metrics : []).forEach((entry) => {
    if (!isObject(entry) || metrics.length >= MAX_METRICS) return;
    const left = scoreOf(entry.left ?? entry.leftScore);
    const right = scoreOf(entry.right ?? entry.rightScore);
    if (left === null || right === null) return;
    const metric = { left, right };
    const key = clip(entry.key, 20).toLowerCase();
    if (/^[a-z_]+$/.test(key)) metric.key = key;
    const label = clip(entry.label, 30);
    if (label) metric.label = label;
    if (!metric.key && !metric.label) return;
    metrics.push(metric);
  });
  const compare = {};
  if (metrics.length) compare.metrics = metrics;
  ["leftPros", "leftCons", "rightPros", "rightCons"].forEach((field) => {
    const list = shortList(raw[field], MAX_PROS, MAX_PRO_TEXT);
    if (list.length) compare[field] = list;
  });
  return Object.keys(compare).length ? compare : null;
}

function sanitizeSpotlight(raw) {
  if (!isObject(raw)) return null;
  const spotlight = {};
  const backdrop = raw.backdrop_path || raw.backdropPath;
  if (typeof backdrop === "string" && /^\/[\w.-]{1,80}$/.test(backdrop)) spotlight.backdrop_path = backdrop;
  const tagline = clip(raw.tagline, 120);
  if (tagline) spotlight.tagline = tagline;
  const director = clip(raw.director, 60);
  if (director) spotlight.director = director;
  const cast = shortList(raw.cast, 4, 40);
  if (cast.length) spotlight.cast = cast;
  const overview = clipMultiline(raw.overview, MAX_OVERVIEW);
  if (overview) spotlight.overview = overview;
  return Object.keys(spotlight).length ? spotlight : null;
}

function sanitizeAiShare(raw) {
  const variant = AI_VARIANTS.includes(raw.variant) ? raw.variant : "general";
  let remaining = MAX_AI_SHARE_PICKS;
  let total = 0;
  const sections = [];

  (Array.isArray(raw.sections) ? raw.sections : []).slice(0, MAX_AI_SHARE_SECTIONS).forEach((entry) => {
    if (!isObject(entry)) return;
    const picks = [];
    (Array.isArray(entry.picks) ? entry.picks : []).forEach((pickRaw) => {
      const pick = sanitizePick(pickRaw);
      if (!pick) return;
      total += 1;
      if (remaining > 0) {
        picks.push(pick);
        remaining -= 1;
      }
    });
    if (picks.length === 0) return;
    const section = { picks };
    const label = clip(entry.label, MAX_LABEL);
    if (label) section.label = label;
    const labelKey = clip(entry.labelKey, 30).toLowerCase();
    if (labelKey) section.labelKey = labelKey;
    const note = clip(entry.note, MAX_NOTE);
    if (note) section.note = note;
    sections.push(section);
  });

  const summary = clipMultiline(raw.summary, MAX_SUMMARY);
  // Ne öğe ne metin: bomboş bir kart göndermenin anlamı yok.
  if (sections.length === 0 && !summary) return null;

  const share = { v: SHARE_VERSION, type: SHARE_TYPE.AI, variant, total, sections };
  if (summary) share.summary = summary;
  const question = clip(raw.question, MAX_QUESTION);
  if (question) share.question = question;
  // Karşılaştırma yalnız İKİ başlık varken yan yana çizilebilir.
  if (raw.versus === true && sections.length === 1 && sections[0].picks.length === 2) {
    share.versus = true;
    const compare = sanitizeCompare(raw.compare);
    if (compare) share.compare = compare;
  }
  if (variant === "title_spotlight" && sections.length === 1 && sections[0].picks.length === 1) {
    const spotlight = sanitizeSpotlight(raw.spotlight);
    if (spotlight) share.spotlight = spotlight;
  }
  return share;
}

/**
 * CineMatch cevabının serileştirilebilir özeti. `sections` çağıran tarafça
 * (services/aiCineInsights.buildChatShare) kurulur; burada yalnız doğrulanır.
 * `compare` (karşılaştırma tablosu) yalnız iki başlıklı `versus` kartta,
 * `spotlight` (yapım detayı ekleri) yalnız tek başlıklı yapım detayında kalır.
 */
export function buildAiShare({ variant, question, summary, versus, sections, compare, spotlight } = {}) {
  return sanitizeAiShare({ variant, question, summary, versus, sections, compare, spotlight });
}

// ─── Gönderi (Hub'daki Paylaşımlar) ──────────────────────────────────────────

export const POST_TYPES = Object.freeze(["review", "list", "text", "poll", "tierlist", "tvgraph"]);
export const MAX_POST_SHARE_ITEMS = 12;
const MAX_POST_TITLE = 120;
const MAX_EXCERPT = 280;
const MAX_POLL_OPTION_LABEL = 40;
const MAX_POLL_OPTIONS = 4;
const MAX_AUTHOR_NAME = 40;

const httpUrl = (value, max = 500) =>
  typeof value === "string" && /^https?:\/\//i.test(value) && value.length <= max ? value : null;

function sanitizePostShare(raw) {
  const postId = typeof raw.postId === "string" ? raw.postId.trim().slice(0, 80) : "";
  if (!postId) return null;

  const seen = new Set();
  const items = [];
  let total = 0;
  (Array.isArray(raw.items) ? raw.items : []).forEach((entry) => {
    const item = toShareMedia(entry);
    if (!item) return;
    const key = `${item.media_type}_${item.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    total += 1;
    if (items.length < MAX_POST_SHARE_ITEMS) items.push(item);
  });
  if (Number.isFinite(raw.total)) total = Math.max(total, Math.round(raw.total));

  const title = clip(raw.title, MAX_POST_TITLE);
  const excerpt = clipMultiline(raw.excerpt, MAX_EXCERPT);

  let poll = null;
  if (isObject(raw.poll)) {
    const question = clip(raw.poll.question, MAX_POST_TITLE);
    const options = (Array.isArray(raw.poll.options) ? raw.poll.options : [])
      .map((label) => clip(label, MAX_POLL_OPTION_LABEL))
      .filter(Boolean)
      .slice(0, MAX_POLL_OPTIONS);
    if (question && options.length >= 2) {
      poll = {
        question,
        kind: raw.poll.kind === "media" ? "media" : "text",
        options,
        votes: Number.isFinite(raw.poll.votes) ? Math.max(0, Math.round(raw.poll.votes)) : 0,
      };
    }
  }

  // Ne başlık, ne metin, ne afiş, ne anket: kartın gösterecek bir şeyi yok.
  if (!title && !excerpt && items.length === 0 && !poll) return null;

  const share = {
    v: SHARE_VERSION,
    type: SHARE_TYPE.POST,
    postId,
    postType: POST_TYPES.includes(raw.postType) ? raw.postType : "review",
    title,
  };
  if (excerpt) share.excerpt = excerpt;
  if (items.length) {
    share.items = items;
    share.total = total;
  }
  if (poll) share.poll = poll;

  const rating = Number(raw.rating);
  if (Number.isFinite(rating) && rating >= 1 && rating <= 5) share.rating = Math.round(rating);
  if (raw.spoiler === true) share.spoiler = true;

  if (isObject(raw.author)) {
    const author = {};
    const name = clip(raw.author.name, MAX_AUTHOR_NAME);
    if (name) author.name = name;
    if (Number.isInteger(raw.author.avatarIndex) && raw.author.avatarIndex >= 0 && raw.author.avatarIndex < 1000) {
      author.avatarIndex = raw.author.avatarIndex;
    }
    const photoURL = httpUrl(raw.author.photoURL);
    if (photoURL) author.photoURL = photoURL;
    if (Object.keys(author).length) share.author = author;
  }
  return share;
}

/**
 * Feed gönderisi (Posts/{id} belgesi) → paylaşım gövdesi. YALNIZ herkese açık
 * gönderiler: "takipçilere özel" bir gönderiyi sohbete gömmek içeriği yetkisiz
 * kişilere sızdırırdı. Geçersiz / özel ise null (çağıran düğmeyi hiç göstermez).
 */
export function buildPostShare(post) {
  if (!isObject(post) || !post.id) return null;
  if (post.visibility && post.visibility !== "public") return null;
  // Tier list gönderisinin afişleri kademe sırasıyla düzleşir (kart ilk afişleri çizer).
  const media =
    post.type === "tierlist" && isObject(post.tierList) && Array.isArray(post.tierList.tiers)
      ? post.tierList.tiers.flatMap((tier) => (Array.isArray(tier?.items) ? tier.items : []))
      : Array.isArray(post.mediaList)
        ? post.mediaList
        : [];
  const poll = isObject(post.poll) ? post.poll : null;
  return sanitizePostShare({
    postId: String(post.id),
    postType: post.type,
    title: post.title,
    excerpt: post.content,
    rating: post.userRating,
    spoiler: post.hasSpoiler === true,
    items: media,
    total: media.length,
    author: {
      name: post.authorName,
      avatarIndex: post.authorAvatarIndex,
      photoURL: post.authorPhotoURL || post.authorAvatar,
    },
    poll: poll
      ? {
          question: poll.question || post.title,
          kind: poll.type,
          options: (Array.isArray(poll.options) ? poll.options : []).map((option) => option?.label),
          votes: Object.values(poll.votes || {}).filter((value) => value != null).length,
        }
      : undefined,
  });
}

// ─── Turnuva ─────────────────────────────────────────────────────────────────

export const TOURNAMENT_PHASES = Object.freeze(["selection", "voting", "results", "upcoming"]);
const PERIOD_ID = /^\d{4}-(0[1-9]|1[0-2])$/;

function sanitizeTournamentShare(raw) {
  const periodId = typeof raw.periodId === "string" && PERIOD_ID.test(raw.periodId) ? raw.periodId : null;
  if (!periodId) return null;
  const share = {
    v: SHARE_VERSION,
    type: SHARE_TYPE.TOURNAMENT,
    periodId,
    phase: TOURNAMENT_PHASES.includes(raw.phase) ? raw.phase : "selection",
  };
  if (isObject(raw.champion)) {
    const id = idOf(raw.champion);
    const title = clip(raw.champion.title, MAX_TITLE);
    if (id !== null && title) {
      const champion = {
        id,
        media_type: mediaTypeOf(raw.champion.media_type, raw.champion.mediaType),
        title,
      };
      const poster = posterPathOf(raw.champion);
      if (poster) champion.poster_path = poster;
      share.champion = champion;
    }
  }
  const voters = finitePositive(raw.voters);
  if (voters) share.voters = Math.round(voters);
  // Gönderim anındaki eleme ağacı (utils/tournamentShare.js) — eski mesajlarda yok.
  const bracket = sanitizeBracketSnapshot(raw.bracket);
  if (bracket) share.bracket = bracket;
  return share;
}

/**
 * Hub turnuva kartının anlık görüntüsü: ay, o anki faz, (bittiyse) şampiyon ve
 * katılımcı sayısı. Tür/tema adı alıcının dilinde `periodId`'den çözülür.
 */
export function buildTournamentShare({ periodId, phase, champion, voters, bracket } = {}) {
  return sanitizeTournamentShare({ periodId, phase, champion, voters, bracket });
}

// ─── CineSwipe daveti ────────────────────────────────────────────────────────

const ROOM_CODE = /^\d{6}$/;
const roomCodeOf = (value) => String(value ?? "").replace(/\s+/g, "");

function sanitizeCineRoomShare(raw) {
  const code = roomCodeOf(raw.code);
  if (!ROOM_CODE.test(code)) return null;
  const share = { v: SHARE_VERSION, type: SHARE_TYPE.CINE_ROOM, code };
  const host = clip(raw.host, MAX_AUTHOR_NAME);
  if (host) share.host = host;
  const count = finitePositive(raw.count);
  if (count && count <= 500) share.count = Math.round(count);
  // Sırayla oda: kurucu seçimini yaptı/yapıyor, davet 24 saat açık (kart bunu söyler).
  if (raw.async === true) share.async = true;
  return share;
}

/** CineSwipe odası daveti: 6 haneli kod + (varsa) kuran kişi, kart sayısı ve "sırayla" işareti. */
export function buildCineRoomShare({ code, host, count, async } = {}) {
  return sanitizeCineRoomShare({ code, host, count, async });
}

// ─── Zevk uyumu ──────────────────────────────────────────────────────────────

export const MAX_TASTE_SHARE_ITEMS = 4;
export const MAX_TASTE_SHARE_GENRES = 6;
const TASTE_PART_IDS = ["genres", "overlap", "ratings", "favorites"];
const percentInt = (value) => (Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : null);
const countInt = (value) => (Number.isFinite(value) && value >= 0 ? Math.min(99999, Math.round(value)) : null);

function sanitizeTasteMatchShare(raw) {
  const score = percentInt(raw.score);
  // Puansız (veri yetersiz) uyum paylaşılmaz: uydurma yüzde göndermeyiz.
  if (score === null) return null;
  const share = { v: SHARE_VERSION, type: SHARE_TYPE.TASTE_MATCH, score, tier: tierOf(score) };

  const host = clip(raw.host, MAX_AUTHOR_NAME);
  if (host) share.host = host;
  const friend = clip(raw.friend, MAX_AUTHOR_NAME);
  if (friend) share.friend = friend;

  const overlap = countInt(raw.overlap);
  if (overlap !== null) share.overlap = overlap;
  const favorites = countInt(raw.favorites);
  if (favorites !== null) share.favorites = favorites;
  const agreement = percentInt(raw.agreement);
  const pairs = countInt(raw.pairs);
  if (agreement !== null && pairs) {
    share.agreement = agreement;
    share.pairs = pairs;
  }

  // Film / dizi ayrı uyum (paylaşılmayan ya da verisi az kategori yoktur: uydurma puan gitmez).
  // `movie` / `tv` düz sayıları eski sürümler için kalır; yeni kart `types`tan (paylaşılıyor mu · ortak sayısı) çizer.
  const movie = percentInt(raw.movie);
  if (movie !== null) share.movie = movie;
  const tv = percentInt(raw.tv);
  if (tv !== null) share.tv = tv;
  if (isObject(raw.types)) {
    const types = {};
    ["movie", "tv"].forEach((key) => {
      const entry = raw.types[key];
      if (!isObject(entry)) return;
      if (entry.shared === false) {
        types[key] = { shared: false };
        return;
      }
      const t = { shared: true };
      const score = percentInt(entry.score);
      if (score !== null) t.score = score;
      const common = countInt(entry.overlap);
      if (common !== null) t.overlap = common;
      types[key] = t;
    });
    if (Object.keys(types).length) share.types = types;
  }
  if (raw.scope === "movies" || raw.scope === "shows") share.scope = raw.scope;
  if (raw.limited === true) share.limited = true;
  if (raw.lowData === true) share.lowData = true;

  const genres = (Array.isArray(raw.genres) ? raw.genres : []).map((g) => clip(g, 30)).filter(Boolean).slice(0, MAX_TASTE_SHARE_GENRES);
  if (genres.length) share.genres = genres;
  const loved = (Array.isArray(raw.loved) ? raw.loved : []).map((n) => clip(n, MAX_TITLE)).filter(Boolean).slice(0, 3);
  if (loved.length) share.loved = loved;

  const seenPart = new Set();
  const parts = [];
  (Array.isArray(raw.parts) ? raw.parts : []).forEach((entry) => {
    const value = percentInt(entry?.value);
    if (!TASTE_PART_IDS.includes(entry?.id) || value === null || seenPart.has(entry.id)) return;
    seenPart.add(entry.id);
    parts.push({ id: entry.id, value });
  });
  if (parts.length) share.parts = parts;

  const seen = new Set();
  const items = [];
  (Array.isArray(raw.items) ? raw.items : []).forEach((entry) => {
    const media = toShareMedia(entry);
    if (!media || !media.title || seen.has(`${media.media_type}_${media.id}`) || items.length >= MAX_TASTE_SHARE_ITEMS) return;
    seen.add(`${media.media_type}_${media.id}`);
    items.push({
      id: media.id,
      media_type: media.media_type,
      title: media.title,
      ...(media.poster_path ? { poster_path: media.poster_path } : {}),
    });
  });
  if (items.length) share.items = items;
  return share;
}

/**
 * `computeTasteMatch` çıktısı → sohbet gövdesi. Puan yoksa (veri yetersiz) null.
 * Kart, profildeki zevk uyumu kartının TÜRLER dahil üst kısmını çizer: halka + kademe + ısı çubuğu,
 * Film / Dizi kutuları, sayı şeridi (ortak izlenen · favori · puan uyumu) ve ortak tür çipleri.
 * Yalnız İKİ tarafın da bildiği veriler gider (tür eğilimi, ayrışılan başlık ve içgörüler bilerek GİTMEZ).
 */
export function buildTasteMatchShare(match, { host, friend } = {}) {
  if (!isObject(match) || match.score == null) return null;
  const typeOf = (info) =>
    isObject(info) ? (info.shared === false ? { shared: false } : { shared: true, score: info.score ?? undefined, overlap: info.overlap }) : undefined;
  return sanitizeTasteMatchShare({
    types: isObject(match.byType) ? { movie: typeOf(match.byType.movie), tv: typeOf(match.byType.tv) } : undefined,
    scope: match.scope,
    limited: match.state === "limited",
    lowData: match.lowData === true,
    score: match.score,
    host,
    friend,
    overlap: match.watched?.overlap?.length,
    favorites: Array.isArray(match.favorites) ? match.favorites.length : undefined,
    agreement: match.ratings?.agreement == null ? undefined : match.ratings.agreement * 100,
    pairs: match.ratings?.pairs,
    movie: match.byType?.movie?.score ?? undefined,
    tv: match.byType?.tv?.score ?? undefined,
    genres: match.genres?.shared,
    parts: match.breakdown,
    // Afişler kartta çizilmez (kart türlerde biter); yalnız alıntı küçük resmi için ilk ortak izlenen gider.
    items: (match.highlights || []).slice(0, 1).map((h) => ({ id: h.id, type: h.type, name: h.name, imagePath: h.imagePath })),
  });
}

// ─── Günlük meydan okuma (düello) ────────────────────────────────────────────

const CHALLENGE_DAY = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const MAX_CHALLENGE_SCORE = 100000;
export const MAX_CHALLENGE_QUESTIONS = 50;

function sanitizeChallengeShare(raw) {
  const dayKey = typeof raw.dayKey === "string" && CHALLENGE_DAY.test(raw.dayKey) ? raw.dayKey : null;
  if (!dayKey) return null;
  const score = Number(raw.score);
  // Skorsuz ("henüz oynamadım") bir meydan okuma olmaz; uydurma 0 da gönderilmez.
  if (!Number.isFinite(score) || score < 0) return null;
  const total = Math.max(1, Math.min(MAX_CHALLENGE_QUESTIONS, Math.round(Number(raw.total)) || 10));
  const correct = Math.max(0, Math.min(total, Math.round(Number(raw.correct)) || 0));
  const share = {
    v: SHARE_VERSION,
    type: SHARE_TYPE.CHALLENGE,
    dayKey,
    score: Math.min(MAX_CHALLENGE_SCORE, Math.round(score)),
    correct,
    total,
  };
  const host = clip(raw.host, MAX_AUTHOR_NAME);
  if (host) share.host = host;
  return share;
}

/**
 * Günlük Meydan Okuma sonucu → düello kartı. Alıcı AYNI günün aynı 10 sahnesini oynar
 * (günlük set herkeste sabit); karttaki skor yalnız ilk görünüm içindir, karşılaştırmada
 * alıcının cihazı iki tarafın skorunu günlük tablodan DOĞRULAYARAK okur.
 */
export function buildChallengeShare({ dayKey, score, correct, total, host } = {}) {
  return sanitizeChallengeShare({ dayKey, score, correct, total, host });
}

// ─── Düello sonucu ───────────────────────────────────────────────────────────

// Firebase Auth uid'i (28 karakter) ve emülatör/test kimlikleri; yol ayırıcısı ya da boşluk taşımaz.
const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const duelScoreOf = (value) => {
  // null/boş "skor yok" demek; Number(null) = 0 uydurma bir skor yazardı.
  if (value === null || value === undefined || value === "") return null;
  const score = Number(value);
  return Number.isFinite(score) && score >= 0 ? Math.min(MAX_CHALLENGE_SCORE, Math.round(score)) : null;
};

function sanitizeDuelResultShare(raw) {
  const dayKey = typeof raw.dayKey === "string" && CHALLENGE_DAY.test(raw.dayKey) ? raw.dayKey : null;
  const hostUid = typeof raw.hostUid === "string" && UID_PATTERN.test(raw.hostUid) ? raw.hostUid : null;
  const guestScore = duelScoreOf(raw.guestScore);
  // Kimin meydan okuduğu bilinmeyen ya da kabul edenin skoru olmayan sonuç yazılmaz.
  if (!dayKey || !hostUid || guestScore === null) return null;
  const total = Math.max(1, Math.min(MAX_CHALLENGE_QUESTIONS, Math.round(Number(raw.total)) || 10));
  const share = {
    v: SHARE_VERSION,
    type: SHARE_TYPE.DUEL_RESULT,
    dayKey,
    hostUid,
    guestScore,
    correct: Math.max(0, Math.min(total, Math.round(Number(raw.correct)) || 0)),
    total,
  };
  const hostScore = duelScoreOf(raw.hostScore);
  if (hostScore !== null) share.hostScore = hostScore;
  const host = clip(raw.host, MAX_AUTHOR_NAME);
  if (host) share.host = host;
  const guest = clip(raw.guest, MAX_AUTHOR_NAME);
  if (guest) share.guest = guest;
  return share;
}

/**
 * Kabul edilen günlük düellonun SONUCU: kabul eden oyunu bitirince davetin geldiği sohbete yazılır
 * (mesajın göndereni = kabul eden, `hostUid` = meydan okuyan). Karttaki iki skor gönderenin cihazında
 * yazıldığı için yalnız ilk görünümdür; kart iki tarafın skorunu günlük tablodan yeniden okur.
 * `hostScore` yoksa (meydan okuyanın satırı okunamadı) kart onu tablodan bulmaya çalışır.
 */
export function buildDuelResultShare({ dayKey, hostUid, host, hostScore, guest, guestScore, correct, total } = {}) {
  return sanitizeDuelResultShare({ dayKey, hostUid, host, hostScore, guest, guestScore, correct, total });
}

// ─── Günün Karesi sonucu ─────────────────────────────────────────────────────

export const FRAME_SHARE_MARKS = Object.freeze(["miss", "skip", "hit", "empty"]);
const MAX_FRAME_NUMBER = 100000;

function sanitizeFrameShare(raw) {
  const dayKey = typeof raw.dayKey === "string" && CHALLENGE_DAY.test(raw.dayKey) ? raw.dayKey : null;
  const number = Math.round(Number(raw.number));
  const marks = Array.isArray(raw.marks) ? raw.marks : [];
  if (!dayKey || !Number.isFinite(number) || number < 1 || number > MAX_FRAME_NUMBER) return null;
  if (marks.length !== 6 || !marks.every((mark) => FRAME_SHARE_MARKS.includes(mark))) return null;
  // Yalnız BİTMİŞ oyun paylaşılır: ya bilinmiş (tek "hit") ya da altı hak da harcanmış.
  const hits = marks.filter((mark) => mark === "hit").length;
  const used = marks.filter((mark) => mark !== "empty").length;
  if (hits > 1 || (hits === 0 && used < 6)) return null;
  const share = { v: SHARE_VERSION, type: SHARE_TYPE.FRAME, dayKey, number, marks: [...marks] };
  const host = clip(raw.host, MAX_AUTHOR_NAME);
  if (host) share.host = host;
  return share;
}

/**
 * Günün Karesi sonucu → sohbet kartı. Yalnız numara ve kutucuklar taşınır; filmin adı / kimliği ASLA (alıcı
 * henüz oynamamış olabilir). Alıcı aynı gün kendi oyununu karttan açar.
 */
export function buildFrameShare({ dayKey, number, marks, host } = {}) {
  return sanitizeFrameShare({ dayKey, number, marks, host });
}

const FRAME_EMOJI = { miss: "🟥", skip: "⬜", hit: "🟩", empty: "⬛" };

// ─── Film Zinciri meydan okuması ─────────────────────────────────────────────

const CHAIN_PUZZLE_ID = /^\d{1,9}-\d{1,9}$/;
const CHAIN_MAX_LINKS = 6; // utils/filmChain.CHAIN_MAX_FILMS ile aynı (oraya bağlanmaz: bulmaca verisini çekmesin)
const MAX_CHAIN_NUMBER = 100000;

function sanitizeChainPerson(raw) {
  if (!isObject(raw)) return null;
  const id = Math.round(Number(raw.id));
  const name = clip(raw.name, 80);
  if (!Number.isFinite(id) || id <= 0 || !name) return null;
  const profilePath = typeof raw.profilePath === "string" && /^\/[\w.-]+$/.test(raw.profilePath) ? raw.profilePath : null;
  return { id, name, profilePath };
}

/** utils/filmChain.chainPoints'in aynısı (bekçi testi eşitliği denetler); karttaki puan gönderenden alınmaz. */
export const chainSharePoints = (links, par, gaveUp) =>
  gaveUp || !links ? 0 : Math.max(10, 100 - 25 * Math.max(0, links - par));

function sanitizeChainShare(raw) {
  const puzzleId = typeof raw.puzzleId === "string" && CHAIN_PUZZLE_ID.test(raw.puzzleId) ? raw.puzzleId : null;
  const start = sanitizeChainPerson(raw.start);
  const target = sanitizeChainPerson(raw.target);
  const par = Math.round(Number(raw.par));
  const gaveUp = raw.gaveUp === true;
  const links = gaveUp ? 0 : Math.round(Number(raw.links));
  if (!puzzleId || !start || !target || start.id === target.id) return null;
  if (!Number.isFinite(par) || par < 1 || par > CHAIN_MAX_LINKS) return null;
  if (!gaveUp && (!Number.isFinite(links) || links < 1 || links > CHAIN_MAX_LINKS)) return null;
  const share = {
    v: SHARE_VERSION,
    type: SHARE_TYPE.CHAIN,
    puzzleId,
    mode: "free",
    start,
    target,
    par,
    links,
    gaveUp,
    points: chainSharePoints(links, par, gaveUp),
  };
  const dayKey = typeof raw.dayKey === "string" && CHALLENGE_DAY.test(raw.dayKey) ? raw.dayKey : null;
  const number = Math.round(Number(raw.number));
  if (raw.mode === "daily" && dayKey && Number.isFinite(number) && number >= 1 && number <= MAX_CHAIN_NUMBER) {
    share.mode = "daily";
    share.dayKey = dayKey;
    share.number = number;
  }
  const host = clip(raw.host, MAX_AUTHOR_NAME);
  if (host) share.host = host;
  return share;
}

/**
 * Film Zinciri sonucu → sohbette meydan okuma kartı. Yalnız bulmacanın kendisi (başlangıç → hedef, en kısa) ve
 * gönderenin SAYILARI taşınır (film sayısı, puan); zincirin film ve oyuncuları ASLA — alıcı aynı bulmacayı karttan
 * oynar (`puzzleId`). Günlükse ve gün bugünse alıcı günlük modda, değilse serbest modda aynı bulmacayı açar.
 */
export function buildChainShare({ puzzle, links, gaveUp, mode, host } = {}) {
  if (!isObject(puzzle)) return null;
  return sanitizeChainShare({
    puzzleId: puzzle.id,
    start: puzzle.start,
    target: puzzle.target,
    par: puzzle.par,
    links,
    gaveUp: !!gaveUp,
    mode,
    dayKey: puzzle.dayKey,
    number: puzzle.number,
    host,
  });
}

// ─── Film Kulübü duyurusu ────────────────────────────────────────────────────

export const CLUB_SHARE_EVENTS = Object.freeze(["voting", "picked", "done"]);
const CLUB_DOC_ID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_CLUB_CANDIDATES = 6; // utils/filmClub.CLUB_MAX_CANDIDATES (bekçi testi eşitliği denetler)
const MAX_CLUB_NUMBER = 100000;

function sanitizeClubMedia(raw) {
  if (!isObject(raw)) return null;
  // toShareMedia bilinmeyen türü filme çevirir; kişi (oyuncu) kulüp adayı olamaz.
  if (raw.media_type != null && raw.media_type !== "movie" && raw.media_type !== "tv") return null;
  const media = toShareMedia(raw);
  if (!media || !media.title || (media.media_type !== "movie" && media.media_type !== "tv")) return null;
  const out = { id: media.id, media_type: media.media_type, title: media.title };
  if (media.poster_path) out.poster_path = media.poster_path;
  if (media.year) out.year = media.year;
  return out;
}

const finiteInt = (value, min, max) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

function sanitizeClubShare(raw) {
  const event = CLUB_SHARE_EVENTS.includes(raw.event) ? raw.event : null;
  const groupId = typeof raw.groupId === "string" && CLUB_DOC_ID.test(raw.groupId) ? raw.groupId : null;
  const roundId = typeof raw.roundId === "string" && CLUB_DOC_ID.test(raw.roundId) ? raw.roundId : null;
  const number = finiteInt(raw.number, 1, MAX_CLUB_NUMBER);
  if (!event || !groupId || !roundId || number === null) return null;
  const share = { v: SHARE_VERSION, type: SHARE_TYPE.CLUB, event, groupId, roundId, number };
  if (event === "voting") {
    const candidates = (Array.isArray(raw.candidates) ? raw.candidates : [])
      .map(sanitizeClubMedia)
      .filter(Boolean)
      .slice(0, MAX_CLUB_CANDIDATES);
    if (candidates.length < 2) return null;
    share.candidates = candidates;
  } else {
    const pick = sanitizeClubMedia(raw.pick);
    if (!pick) return null;
    share.pick = pick;
  }
  const endsAt = finiteInt(raw.endsAt, 1, Number.MAX_SAFE_INTEGER);
  if (event !== "done" && endsAt !== null) share.endsAt = endsAt;
  if (event === "done") {
    const avg = Number(raw.avgRating);
    if (raw.avgRating != null && Number.isFinite(avg) && avg >= 1 && avg <= 10) share.avgRating = Math.round(avg * 10) / 10;
    const watchedCount = finiteInt(raw.watchedCount, 0, 1000);
    const memberCount = finiteInt(raw.memberCount, 0, 1000);
    if (watchedCount !== null) share.watchedCount = watchedCount;
    if (memberCount !== null) share.memberCount = memberCount;
  }
  return share;
}

/**
 * Film Kulübü olayı → grup sohbetinde duyuru kartı (services/filmClubService.js yazar). Kart yalnız anlık
 * görüntüdür; canlı durum (oylar, izleyenler, tartışma) kulüp ekranında, `groupId` + `roundId` ile açılır.
 * Tartışmanın içeriği ASLA karta girmez (spoiler kalkanı kural tarafında).
 *   event "voting" → adaylar + oylama bitişi · "picked" → seçilen film + izleme bitişi · "done" → film + ortalama
 */
export function buildClubShare({ event, groupId, roundId, number, candidates, pick, endsAt, avgRating, watchedCount, memberCount } = {}) {
  return sanitizeClubShare({ event, groupId, roundId, number, candidates, pick, endsAt, avgRating, watchedCount, memberCount });
}

// ─── Tier list ───────────────────────────────────────────────────────────────

// utils/tierList.TIER_LIMITS ile aynı (oraya bağlanmaz: chatShare saf ve hafif kalsın; bekçi testi eşitliği denetler).
export const MAX_TIER_SHARE_TIERS = 10;
export const MAX_TIER_SHARE_ITEMS = 100;
const MAX_TIER_LABEL = 24;
const MAX_TIER_TITLE = 50;
const TIER_HEX = /^#[0-9A-F]{6}$/i;

function sanitizeTierListShare(raw) {
  const seen = new Set();
  let budget = MAX_TIER_SHARE_ITEMS;
  const tiers = (Array.isArray(raw.tiers) ? raw.tiers : [])
    .filter(isObject)
    .slice(0, MAX_TIER_SHARE_TIERS)
    .map((tier, index) => {
      const items = [];
      (Array.isArray(tier.items) ? tier.items : []).forEach((entry) => {
        const media = sanitizeClubMedia(entry);
        if (!media || budget <= 0) return;
        const key = `${media.media_type}_${media.id}`;
        if (seen.has(key)) return;
        seen.add(key);
        budget -= 1;
        items.push(media);
      });
      return {
        label: clip(tier.label, MAX_TIER_LABEL) || String(index + 1),
        color: typeof tier.color === "string" && TIER_HEX.test(tier.color) ? tier.color.toUpperCase() : "#CFCFCF",
        items,
      };
    });
  const total = tiers.reduce((sum, tier) => sum + tier.items.length, 0);
  // Boş tablo gönderilmez: en az iki kademe ve en az bir yerleşmiş yapım.
  if (tiers.length < 2 || total === 0) return null;
  const share = { v: SHARE_VERSION, type: SHARE_TYPE.TIER_LIST, title: clip(raw.title, MAX_TIER_TITLE), total, tiers };
  const host = clip(raw.host, MAX_AUTHOR_NAME);
  if (host) share.host = host;
  return share;
}

/**
 * Tier list → sohbet kartı (anlık görüntü). Girdi utils/tierList.tierListShareView çıktısı: yalnız yerleştirilmiş
 * yapımlar, kademe sırasıyla; havuz paylaşılmaz. Alıcı karttan "Kopyasını düzenle" ile kendi tablosunu açar.
 */
export function buildTierListShare({ title, tiers, host } = {}) {
  return sanitizeTierListShare({ title, tiers, host });
}

// ─── Ortak: doğrulama, okuma, önizleme ───────────────────────────────────────

/** Bilinmeyen/bozuk gövde → null; geçerliyse temizlenmiş kopya. */
export function sanitizeShare(raw) {
  if (!isObject(raw)) return null;
  switch (raw.type) {
    case SHARE_TYPE.LIST:
      return sanitizeListShare(raw);
    case SHARE_TYPE.AI:
      return sanitizeAiShare(raw);
    case SHARE_TYPE.POST:
      return sanitizePostShare(raw);
    case SHARE_TYPE.TOURNAMENT:
      return sanitizeTournamentShare(raw);
    case SHARE_TYPE.CINE_ROOM:
      return sanitizeCineRoomShare(raw);
    case SHARE_TYPE.TASTE_MATCH:
      return sanitizeTasteMatchShare(raw);
    case SHARE_TYPE.CHALLENGE:
      return sanitizeChallengeShare(raw);
    case SHARE_TYPE.DUEL_RESULT:
      return sanitizeDuelResultShare(raw);
    case SHARE_TYPE.SETTINGS:
      return sanitizeSettingsShare(raw);
    case SHARE_TYPE.FRAME:
      return sanitizeFrameShare(raw);
    case SHARE_TYPE.CHAIN:
      return sanitizeChainShare(raw);
    case SHARE_TYPE.CLUB:
      return sanitizeClubShare(raw);
    case SHARE_TYPE.TIER_LIST:
      return sanitizeTierListShare(raw);
    case SHARE_TYPE.TV_GRAPH:
      return sanitizeTvGraphShare(raw);
    default:
      return null;
  }
}

/** Mesajdan paylaşım gövdesini okur; paylaşım mesajı değilse (veya bozuksa) null. */
export function readShare(message) {
  if (!isObject(message)) return null;
  if (!SHARE_KINDS.includes(message.kind)) return null;
  const share = sanitizeShare(message.share);
  // kind ile gövde türü TUTARSIZSA (elle bozulmuş kayıt) gösterme.
  return share && KIND_BY_TYPE[share.type] === message.kind ? share : null;
}

const titlesOf = (share) => {
  if (share.type === SHARE_TYPE.LIST) return share.items.map((item) => item.title);
  return share.sections.flatMap((section) => section.picks.map((pick) => pick.title));
};

const firstLine = (text, max) => clip(String(text || "").split("\n")[0], max);

const POST_EMOJI = { review: "⭐", list: "📋", text: "💬", poll: "📊", tierlist: "🏅", tvgraph: "📈" };

/**
 * Alıntı kartı / sabitleme için SİMGESİZ önizleme (tür simgesi bileşende çizilir).
 */
export function sharePreview(share) {
  if (!share) return "";
  switch (share.type) {
    case SHARE_TYPE.LIST:
      if (share.source === "cineswipe") {
        return i18nText("autoI18n.paylas_cine_eslesme_onizleme", "CineSwipe · {{n}} ortak eşleşme", {
          n: share.total ?? share.items.length,
        });
      }
      return (
        share.title ||
        i18nText("autoI18n.n_icerik", "{{n}} içerik", { n: share.total ?? share.items.length })
      );
    case SHARE_TYPE.POST:
      return (
        share.title ||
        firstLine(share.excerpt, 80) ||
        share.poll?.question ||
        i18nText("autoI18n.gonderi", "Gönderi")
      );
    case SHARE_TYPE.TOURNAMENT:
      return i18nText("autoI18n.paylas_turnuva_baslik", "Aylık turnuva");
    case SHARE_TYPE.CINE_ROOM:
      return i18nText("autoI18n.paylas_cine_daveti", "CineSwipe daveti");
    case SHARE_TYPE.TASTE_MATCH:
      return i18nText("autoI18n.paylas_zevk_onizleme", "İzleme uyumu %{{n}}", { n: share.score });
    case SHARE_TYPE.CHALLENGE:
      return i18nText("autoI18n.paylas_meydan_onizleme", "Günlük meydan okuma · {{n}} puan", { n: share.score });
    case SHARE_TYPE.DUEL_RESULT:
      // Sıra kartla aynı: önce kabul eden (mesajın sahibi), sonra meydan okuyan.
      return i18nText("autoI18n.paylas_duello_sonuc_onizleme", "Düello sonucu · {{a}} – {{b}}", {
        a: share.guestScore,
        b: share.hostScore ?? "?",
      });
    case SHARE_TYPE.SETTINGS:
      return i18nText("autoI18n.paylas_ayar_onizleme", "Görünüm ayarları ({{n}})", {
        n: settingsShareSectionIds(share).length,
      });
    case SHARE_TYPE.FRAME:
      return i18nText("autoI18n.paylas_kare_onizleme", "Günün Karesi #{{n}}", { n: share.number });
    case SHARE_TYPE.CHAIN:
      return i18nText("autoI18n.paylas_zincir_onizleme", "Film Zinciri · {{a}} → {{b}}", {
        a: share.start.name,
        b: share.target.name,
      });
    case SHARE_TYPE.CLUB:
      if (share.event === "voting") {
        return i18nText("autoI18n.paylas_kulup_oylama_onizleme", "Film Kulübü #{{n}} · oylama başladı", { n: share.number });
      }
      return share.event === "done"
        ? i18nText("autoI18n.paylas_kulup_bitti_onizleme", "Film Kulübü #{{n}} bitti · {{title}}", {
            n: share.number,
            title: share.pick.title,
          })
        : i18nText("autoI18n.paylas_kulup_secildi_onizleme", "Film Kulübü #{{n}} · {{title}}", {
            n: share.number,
            title: share.pick.title,
          });
    case SHARE_TYPE.TIER_LIST:
      return share.title
        ? i18nText("autoI18n.paylas_tier_onizleme", "Tier list · {{title}}", { title: share.title })
        : i18nText("autoI18n.paylas_tier_onizleme_adsiz", "Tier list · {{n}} yapım", { n: share.total });
    case SHARE_TYPE.TV_GRAPH:
      return i18nText("autoI18n.tvgraph_onizleme", "Bölüm grafiği · {{title}}", { title: share.title });
    default: {
      const head = titlesOf(share).slice(0, 3).join(", ");
      return head || firstLine(share.summary, 80) || share.question || "CineMatch";
    }
  }
}

/**
 * Mesajın `text` alanı: gelen kutusu satırı ve push bildirimi bunu gösterir.
 * Emoji ÖNEKİ bilinçli (anket "📊", koleksiyon "📋" ile aynı dil).
 */
export function shareMessageText(share) {
  if (!share) return "";
  let line;
  switch (share.type) {
    case SHARE_TYPE.LIST:
      line = `${share.source === "cineswipe" ? "🎬" : "📋"} ${sharePreview(share)}`;
      break;
    case SHARE_TYPE.POST:
      line = `${POST_EMOJI[share.postType] || "📝"} ${sharePreview(share)}`;
      break;
    case SHARE_TYPE.TOURNAMENT:
      line = `🏆 ${sharePreview(share)}`;
      break;
    case SHARE_TYPE.CINE_ROOM:
      line = `🎬 ${sharePreview(share)}`;
      break;
    case SHARE_TYPE.TASTE_MATCH:
      line = `💞 ${sharePreview(share)}`;
      break;
    case SHARE_TYPE.CHALLENGE:
    case SHARE_TYPE.DUEL_RESULT:
      line = `⚔️ ${sharePreview(share)}`;
      break;
    case SHARE_TYPE.SETTINGS:
      line = `🎨 ${sharePreview(share)}`;
      break;
    case SHARE_TYPE.FRAME:
      line = `🎬 ${sharePreview(share)} ${share.marks.map((mark) => FRAME_EMOJI[mark]).join("")}`;
      break;
    case SHARE_TYPE.CHAIN:
      // Sayı spoiler değil; zincirin halkaları yazılmaz.
      line = `🔗 ${sharePreview(share)}${share.gaveUp ? "" : ` · ${"🎬".repeat(share.links)}`}`;
      break;
    case SHARE_TYPE.CLUB:
      line = `🎟️ ${sharePreview(share)}`;
      break;
    case SHARE_TYPE.TIER_LIST:
      line = `🏅 ${sharePreview(share)}`;
      break;
    case SHARE_TYPE.TV_GRAPH:
      line = `📈 ${sharePreview(share)}`;
      break;
    default:
      line = `✨ CineMatch · ${sharePreview(share)}`;
  }
  return line.slice(0, PREVIEW_MAX);
}

/**
 * Gönderilecek mesajın alanları. Geçersizse null. ChatScreen yalnız gönderen
 * alanlarını (senderId, timestamp, status…) üstüne ekler.
 */
export function buildShareMessage(rawShare) {
  const share = sanitizeShare(rawShare);
  if (!share) return null;
  return {
    kind: KIND_BY_TYPE[share.type],
    text: shareMessageText(share),
    share,
  };
}

/** Alıntı küçük resmi için ilk posterli öğenin TMDB yolu. */
export function shareThumb(share) {
  if (!share) return null;
  switch (share.type) {
    case SHARE_TYPE.LIST:
    case SHARE_TYPE.POST:
      return (share.items || []).find((item) => item.poster_path)?.poster_path || null;
    case SHARE_TYPE.TOURNAMENT:
      return share.champion?.poster_path || null;
    case SHARE_TYPE.TV_GRAPH:
      return share.poster_path || null;
    case SHARE_TYPE.CINE_ROOM:
    case SHARE_TYPE.CHALLENGE:
    case SHARE_TYPE.DUEL_RESULT:
    case SHARE_TYPE.SETTINGS:
    case SHARE_TYPE.FRAME:
    case SHARE_TYPE.CHAIN:
      return null;
    case SHARE_TYPE.TASTE_MATCH:
      return (share.items || []).find((item) => item.poster_path)?.poster_path || null;
    case SHARE_TYPE.CLUB:
      return (share.pick || share.candidates.find((item) => item.poster_path))?.poster_path || null;
    case SHARE_TYPE.TIER_LIST:
      for (const tier of share.tiers) {
        const hit = tier.items.find((item) => item.poster_path);
        if (hit) return hit.poster_path;
      }
      return null;
    default:
      for (const section of share.sections) {
        const hit = section.picks.find((pick) => pick.poster_path);
        if (hit) return hit.poster_path;
      }
      return null;
  }
}

// ─── Gezinme ─────────────────────────────────────────────────────────────────

/**
 * Hedefi olan paylaşımların açılacağı ekran. Liste ve AI cevabı kendi içinde
 * tam görünüm taşıdığı için null (dokunuşu bileşen kendisi yönetir).
 *
 * CineSwipe: oda kodu `inviteCode` ile gelir, ekran kodu kutuya HAZIR yazar ama
 * katılmayı alıcıya bırakır (katılmak oda hakkı / bildirim doğurabilir).
 * `inviteChat` (davetin geldiği sohbet, bkz. utils/importantInvites.chatTargetOf)
 * verilirse ekran oda bitince ortak eşleşmeleri o sohbete yazar.
 */
export function shareRoute(share, { inviteChat, inviteMessageId } = {}) {
  switch (share?.type) {
    case SHARE_TYPE.POST:
      return { name: "PostDetailScreen", params: { postId: share.postId } };
    case SHARE_TYPE.TOURNAMENT:
      return { name: "TournamentScreen", params: undefined };
    case SHARE_TYPE.CINE_ROOM:
      // `inviteMessageId`: bu davet kartı — oda bitince kart iki tarafta "Tamamlandı" olur (utils/chatInvites).
      return {
        name: "CineSwipeScreen",
        params: {
          initialMode: "duo",
          inviteCode: share.code,
          ...(inviteChat ? { inviteChat } : {}),
          ...(inviteChat && isInviteMessageId(inviteMessageId) ? { inviteMessageId } : {}),
        },
      };
    default:
      return null;
  }
}

// ─── Gezinme ─────────────────────────────────────────────────────────────────

/**
 * Alıcı seçilince ChatScreen'e verilecek parametreler. Film/dizi detayındaki
 * `initialMedia` akışıyla aynı kalıp: ChatScreen açılınca mesajı kendisi
 * gönderir ve parametreyi temizler (`initialShareKey` çift gönderimi önler).
 *
 * @param {{recipientType?: string, id?: string, uid?: string, name?: string, avatarIndex?: number}} recipient
 */
export function chatParamsForShare(recipient, share, now = Date.now()) {
  if (!recipient || !share) return null;
  const shared = {
    initialShare: share,
    initialShareKey: `${share.type}-${now}`,
  };
  if (recipient.recipientType === "group") {
    if (!recipient.id) return null;
    return {
      groupId: recipient.id,
      groupName: recipient.name,
      groupAvatarIndex: recipient.avatarIndex,
      ...shared,
    };
  }
  if (!recipient.uid) return null;
  return {
    friendUid: recipient.uid,
    friendName: recipient.name,
    friendAvatarIndex: recipient.avatarIndex,
    ...shared,
  };
}
