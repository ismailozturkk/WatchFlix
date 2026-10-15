// services/aiCineInsights.js
//
// CineMatch'in "akıllı" katmanı: modele GİTMEYEN, yerelde çalışan, token ve kota
// harcamayan mantık. Saf JS — React'a, depolamaya, ağa bağlı değil.
//
//   • buildContextBlock      günün saati / hafta sonu bağlamı (sistem talimatına eklenir)
//   • buildVibePrompt        "ruh hali · süre · kiminle" seçicisinin model metni
//   • collectSuggestedTitles / buildAvoidBlock   aynı sohbette tekrar öneri engeli
//   • buildFollowUps         cevabın türüne göre sıradaki mantıklı adım çipleri
//   • computeMatchScore      zevk uyumu (tür örtüşmesi + puan), dayanak yoksa null
//   • applyDiscoveryFilters  platform / tür / içerik tipi / süre doğrulaması + rapor
//   • sessionRuntime         izleme planı oturumlarının toplam süresi
//   • conversation*          geçmiş ekranı için önizleme, arama, gruplama
//   • buildShareText / collectLibraryItems   paylaşım ve "hepsini listeye ekle"
//
// Neden ayrı dosya: ekranda satır içi duran filtre/özet mantığı test edilemiyordu
// ve her kota harcayan mesaj için doğru çalışması kritik. Burada test edilir.

import {
  collectTitles,
  normMediaType,
  posterKey,
  safeArr,
  safeNum,
  toStr,
} from "./aiCineService";
import { foldForSearch } from "../utils/friendsListModel";

const clean = (value, max = 80) =>
  toStr(value).replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

const norm = (value) => toStr(value).toLowerCase().trim();

// ── Günün bağlamı ────────────────────────────────────────────────────────────

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Saat ve gün bilgisini model için sade bir sözlüğe çevirir. Geçersiz tarihte null. */
export function describeMoment(now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return null;
  const day = now.getDay();
  const hour = now.getHours();
  let part = "late night";
  if (hour >= 5 && hour < 12) part = "morning";
  else if (hour >= 12 && hour < 17) part = "afternoon";
  else if (hour >= 17 && hour < 22) part = "evening";
  const weekend = day === 0 || day === 6 || (day === 5 && hour >= 17);
  return { dayName: DAY_NAMES[day], part, weekend, hour };
}

/** Sistem talimatına eklenen yumuşak bağlam. Duyurulmaz; yalnız "bu akşam" gibi isteklerde işe yarar. */
export function buildContextBlock(now = new Date()) {
  const moment = describeMoment(now);
  if (!moment) return "";
  const weekend = moment.weekend ? ", weekend" : "";
  return [
    `CURRENT MOMENT (soft context, never announce it): ${moment.dayName} ${moment.part}${weekend}.`,
    `For "tonight / now / this weekend" style requests, match runtime and intensity to this moment (late night → shorter and gentler; weekend evening → a long film or an episode marathon is fine).`,
  ].join("\n");
}

// ── Ruh hali seçicisi ────────────────────────────────────────────────────────

export const VIBE_MOODS = Object.freeze({
  cozy: "comforting, warm, easy to watch",
  thrilling: "tense and edge-of-your-seat",
  funny: "light and genuinely funny",
  emotional: "moving and emotionally rich",
  mindbending: "clever, twisty, thought-provoking",
  adventurous: "big, exciting, escapist adventure",
});

export const VIBE_LENGTHS = Object.freeze({
  short: "short: under 100 minutes (for series: short episodes or a miniseries)",
  medium: "medium: roughly 90–130 minutes",
  long: "long and immersive: 2 hours or more, or a series",
});

export const VIBE_COMPANIES = Object.freeze({
  solo: "watching alone",
  partner: "watching with a partner (date-night friendly)",
  friends: "watching with friends (crowd-pleasing, fun to discuss afterwards)",
  family: "watching with family including kids (age-appropriate, nothing graphic)",
});

const pickKey = (value, table) => (typeof value === "string" && value in table ? value : null);

/** Seçicinin ham değerini doğrular; bilinmeyen anahtarları düşürür. */
export function normalizeVibe(vibe) {
  return {
    mood: pickKey(vibe?.mood, VIBE_MOODS),
    length: pickKey(vibe?.length, VIBE_LENGTHS),
    company: pickKey(vibe?.company, VIBE_COMPANIES),
  };
}

export const hasVibe = (vibe) => {
  const v = normalizeVibe(vibe);
  return Boolean(v.mood || v.length || v.company);
};

/**
 * Modele gidecek kullanıcı metni. Seçimler KULLANICI mesajının içinde durur;
 * böylece konuşma geçmişiyle birlikte sonraki mesajlarda da hatırlanır.
 */
export function buildVibePrompt(vibe) {
  const v = normalizeVibe(vibe);
  const parts = ["Recommend titles for me to watch right now."];
  if (v.mood) parts.push(`Mood: ${VIBE_MOODS[v.mood]}.`);
  if (v.length) parts.push(`Length: ${VIBE_LENGTHS[v.length]}.`);
  if (v.company) parts.push(`Context: ${VIBE_COMPANIES[v.company]}.`);
  return parts.join(" ");
}

/** Süre seçimi "kısa" ise filmleri yerelde de doğrulamak için üst sınır (dk). */
export const maxRuntimeForVibe = (vibe) => (normalizeVibe(vibe).length === "short" ? 100 : null);

// ── Aynı sohbette tekrar öneri engeli ────────────────────────────────────────

const REPEAT_GUARDED_TYPES = new Set(["recommendations", "watchlist", "general"]);

/** Bu sohbette daha önce ÖNERİLMİŞ başlıklar (en yeni sonda, tekrarsız, sınırlı). */
export function collectSuggestedTitles(messages, limit = 30) {
  const seen = new Set();
  const out = [];
  safeArr(messages).forEach((message) => {
    if (message?.role !== "assistant" || message?.status === "error") return;
    const response = message?.aiResponse;
    if (!response || !REPEAT_GUARDED_TYPES.has(response.type)) return;
    collectTitles(response).forEach(({ title, mediaType }) => {
      const key = posterKey(mediaType, title);
      if (seen.has(key)) return;
      seen.add(key);
      out.push(clean(title, 60));
    });
  });
  return out.slice(-Math.max(0, limit));
}

export function buildAvoidBlock(titles) {
  const list = safeArr(titles).map((title) => clean(title, 60)).filter(Boolean);
  if (!list.length) return "";
  return `ALREADY SUGGESTED IN THIS CONVERSATION (do NOT suggest these again; questions that name a specific title are exempt): ${list.join("; ")}.`;
}

// ── Zevk uyumu ───────────────────────────────────────────────────────────────

// TMDB film/dizi tür adları ve Türkçe karşılıkları aynı kavrama bağlanır;
// "Sci-Fi & Fantasy" gibi birleşik adlar parçalanır.
const GENRE_ALIASES = {
  "science fiction": "sci-fi",
  scifi: "sci-fi",
  "bilim kurgu": "sci-fi",
  aksiyon: "action",
  macera: "adventure",
  komedi: "comedy",
  dram: "drama",
  korku: "horror",
  gerilim: "thriller",
  romantik: "romance",
  suc: "crime",
  gizem: "mystery",
  fantastik: "fantasy",
  animasyon: "animation",
  aile: "family",
  belgesel: "documentary",
  savas: "war",
  tarih: "history",
  muzik: "music",
  "vahsi bati": "western",
};

function genreTokens(value) {
  return foldForSearch(toStr(value))
    .split(/[&/,]|\s+ve\s+|\s+and\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => GENRE_ALIASES[part] || part);
}

/**
 * Bir kartın kullanıcının zevkine uyumu, 0–100. Dayanak yoksa (kart bulunamadı,
 * tür bilgisi ya da zevk profili yok) `null` döner — uydurma bir sayı göstermemek
 * için. Tür örtüşmesi belirleyici (ilk sıradaki türler daha ağır), TMDB puanı
 * küçük bir düzeltme.
 *
 * @param {object} card  tmdbLookup kartı ({ found, genres[], rating })
 * @param {string[]} tasteGenres  en sevilen türler, güçlüden zayıfa
 */
export function computeMatchScore(card, tasteGenres) {
  if (!card?.found) return null;
  const cardGenres = new Set(safeArr(card.genres).flatMap(genreTokens));
  if (cardGenres.size === 0) return null;
  const taste = safeArr(tasteGenres).map(genreTokens).filter((tokens) => tokens.length > 0);
  if (taste.length === 0) return null;

  let weighted = 0;
  taste.forEach((tokens, index) => {
    if (tokens.some((token) => cardGenres.has(token))) {
      weighted += Math.max(0.4, 1 - index * 0.15);
    }
  });

  const overlap = Math.min(1, weighted / 1.6);
  const rating = safeNum(card.rating);
  const ratingBonus = rating > 0 ? Math.max(-6, Math.min(8, (rating - 6.5) * 3)) : 0;
  const score = Math.round(38 + overlap * 52 + ratingBonus);
  return Math.max(30, Math.min(98, score));
}

/** Rozet yalnız yeterince güçlü bir uyumda gösterilir. */
export const MATCH_SCORE_MIN_VISIBLE = 60;

export const matchLevel = (score) => {
  if (score == null || score < MATCH_SCORE_MIN_VISIBLE) return "none";
  if (score >= 85) return "high";
  if (score >= 72) return "good";
  return "fair";
};

// ── Keşif filtresi doğrulaması ───────────────────────────────────────────────

const containsEither = (value, wanted) => {
  const a = norm(value);
  const b = norm(wanted);
  return Boolean(a && b) && (a.includes(b) || b.includes(a));
};

/** Cevaptaki öğe sayısı (öneri/liste/oturum/benzer). Filtre raporu için. */
export function countResponseItems(response) {
  if (!response || typeof response !== "object") return 0;
  switch (response.type) {
    case "recommendations":
    case "general":
      return safeArr(response.items).length;
    case "watchlist":
      return safeArr(response.sections).reduce((sum, section) => sum + safeArr(section?.items).length, 0);
    case "watch_plan":
      return safeArr(response.sessions).reduce((sum, session) => sum + safeArr(session?.items).length, 0);
    default:
      return 0;
  }
}

/**
 * Modelin cevabını kullanıcının seçtiği filtrelere karşı TMDB verisiyle yerelde
 * doğrular (model talimata uysa da hatalı yapım önerebiliyor). Yalnız
 * `recommendations` ve `watchlist` etkilenir; adı verilmiş yapım soruları,
 * karşılaştırma ve planlar bilerek dokunulmaz.
 *
 * Bilgisi OLMAYAN öğe elenmez: TMDB bir yapım için platform ya da tür vermemişse
 * "uyuşmuyor" değil "doğrulanamadı"dır ve doğrulananların ardında kalır.
 *
 * @returns {{ response: object, report: { removed: number, relaxed: boolean, trimmed: number } }}
 */
export function applyDiscoveryFilters(response, posterMap, filters = {}) {
  const none = { response, report: { removed: 0, relaxed: false, trimmed: 0 } };
  if (!response || !["recommendations", "watchlist"].includes(response.type)) return none;

  const mediaType = filters.mediaType || "all";
  const providers = safeArr(filters.providers).map(norm).filter(Boolean);
  const genres = safeArr(filters.genres).map(norm).filter(Boolean);
  const maxRuntime = Number(filters.maxRuntime) > 0 ? Number(filters.maxRuntime) : null;
  const maxItems = Number(filters.maxItems) > 0 ? Number(filters.maxItems) : null;
  const active = mediaType !== "all" || providers.length > 0 || genres.length > 0 || maxRuntime != null;

  // 0 = uyuşmuyor, 1 = doğrulanamadı, 2 = doğrulandı
  const grade = (item) => {
    const kind = normMediaType(item?.mediaType);
    if (mediaType !== "all" && kind !== mediaType) return 0;
    const card = (posterMap || {})[posterKey(kind, item?.title)];
    let unknown = false;

    if (providers.length) {
      const known = safeArr(card?.providers);
      if (known.length === 0) unknown = true;
      else if (!known.some((name) => providers.some((wanted) => containsEither(name, wanted)))) return 0;
    }
    if (genres.length) {
      const known = safeArr(card?.genres);
      if (known.length === 0) unknown = true;
      else if (!known.some((name) => genres.some((wanted) => containsEither(name, wanted)))) return 0;
    }
    if (maxRuntime != null && kind === "movie") {
      const minutes = safeNum(card?.runtimeMinutes);
      if (minutes > maxRuntime) return 0;
      if (minutes === 0) unknown = true;
    }
    return unknown ? 1 : 2;
  };

  const rank = (items) => {
    if (!active) return { items, removed: 0 };
    const graded = items.map((item) => ({ item, g: grade(item) }));
    const kept = [
      ...graded.filter((entry) => entry.g === 2),
      ...graded.filter((entry) => entry.g === 1),
    ].map((entry) => entry.item);
    return { items: kept, removed: items.length - kept.length };
  };

  const cap = (items) => (maxItems && items.length > maxItems ? items.slice(0, maxItems) : items);

  if (response.type === "recommendations") {
    const original = safeArr(response.items);
    const ranked = rank(original);
    // Hepsi elenirse boş kart göstermek yerine orijinal korunur (ve rapor "gevşetildi" der).
    const relaxed = active && ranked.items.length === 0 && original.length > 0;
    const base = relaxed ? original : ranked.items;
    const next = cap(base);
    return {
      response: { ...response, items: next },
      report: {
        removed: relaxed ? 0 : ranked.removed,
        relaxed,
        trimmed: Math.max(0, base.length - next.length),
      },
    };
  }

  let removed = 0;
  let trimmed = 0;
  const sections = safeArr(response.sections).map((section) => {
    const ranked = rank(safeArr(section?.items));
    removed += ranked.removed;
    const next = cap(ranked.items);
    trimmed += Math.max(0, ranked.items.length - next.length);
    return { ...section, items: next };
  });
  const filled = sections.filter((section) => section.items.length > 0);
  if (active && filled.length === 0 && countResponseItems(response) > 0) {
    return { response, report: { removed: 0, relaxed: true, trimmed: 0 } };
  }
  return { response: { ...response, sections: filled }, report: { removed, relaxed: false, trimmed } };
}

// ── Detay ekranından iliştirilen yapım ───────────────────────────────────────

const filled = (value) => value != null && value !== "" && !(Array.isArray(value) && value.length === 0);
const firstFilled = (...values) => values.find(filled);

/**
 * "Bu yapım hakkında sor" ile gelen yapımın kartı. Ataçtaki alanlar yetkilidir
 * (kullanıcının baktığı kayıt bu); TMDB aramasından çözülen kart YALNIZCA aynı
 * kayıtsa ve ataçta eksik olan zengin alanları (benzer yapımlar, slogan, arka
 * plan, süre) tamamlar. Farklı bir kayda denk gelmişse hiçbir alanı alınmaz.
 */
export function buildTargetCard(targetMedia, resolved) {
  const kind = normMediaType(targetMedia?.mediaType);
  const sameRecord = Boolean(resolved?.found) && String(resolved.id) === String(targetMedia?.id);
  const extra = sameRecord ? resolved : {};
  return {
    key: `${kind}-${targetMedia?.id}`,
    mediaType: kind,
    query: toStr(targetMedia?.title),
    found: true,
    id: targetMedia?.id,
    title: toStr(targetMedia?.title),
    posterPath: firstFilled(targetMedia?.posterPath, extra.posterPath) || null,
    backdropPath: firstFilled(targetMedia?.backdropPath, extra.backdropPath) || null,
    year: firstFilled(targetMedia?.year, extra.year) || "",
    rating: safeNum(firstFilled(targetMedia?.rating, extra.rating)),
    overview: toStr(firstFilled(targetMedia?.overview, extra.overview)),
    tagline: toStr(firstFilled(targetMedia?.tagline, extra.tagline)),
    runtimeMinutes: safeNum(firstFilled(targetMedia?.runtimeMinutes, extra.runtimeMinutes)),
    genres: safeArr(firstFilled(targetMedia?.genres, extra.genres)),
    cast: safeArr(firstFilled(targetMedia?.cast, extra.cast)),
    director: toStr(firstFilled(targetMedia?.director, extra.director)),
    providers: safeArr(firstFilled(targetMedia?.providers, extra.providers)),
    similar: safeArr(extra.similar),
  };
}

// ── Süre ─────────────────────────────────────────────────────────────────────

/** "1 sa 45 dk" / "1h 45m". 0 ya da geçersiz → "". */
export function formatDuration(minutes, language = "en") {
  const total = Math.round(safeNum(minutes));
  if (total <= 0) return "";
  const h = Math.floor(total / 60);
  const m = total % 60;
  const hourUnit = language === "tr" ? "sa" : "h";
  const minUnit = language === "tr" ? "dk" : "m";
  if (h === 0) return `${m} ${minUnit}`;
  return m === 0 ? `${h} ${hourUnit}` : `${h} ${hourUnit} ${m} ${minUnit}`;
}

/**
 * Bir izleme planı oturumunun toplam süresi. Film süreleri TMDB'den gelir;
 * dizilerin toplam süresi bilinmez (kaç bölüm izleneceği belli değil), bu yüzden
 * toplama katılmaz ve `series` sayısıyla ayrıca bildirilir.
 */
export function sessionRuntime(session, posterMap) {
  let minutes = 0;
  let movies = 0;
  let series = 0;
  safeArr(session?.items).forEach((item) => {
    const kind = normMediaType(item?.mediaType);
    if (kind === "tv") {
      series += 1;
      return;
    }
    const card = (posterMap || {})[posterKey(kind, item?.title)];
    const runtime = safeNum(card?.runtimeMinutes);
    if (runtime > 0) {
      minutes += runtime;
      movies += 1;
    }
  });
  return { minutes, movies, series };
}

// ── Sıradaki adım çipleri ────────────────────────────────────────────────────

const FOLLOW_UP_COPY = {
  tr: {
    different: "Daha farklı öner",
    pickOne: "Hangisini izleyeyim?",
    shorter: "Daha kısa olanlar",
    similarTo: "{title} gibi",
    watchFirst: "Hangisi önce?",
    third: "Üçüncü seçenek",
    makePlan: "İzleme planı yap",
    shortenPlan: "Planı kısalt",
    weekend: "Hafta sonuna sığdır",
    swapOne: "Birini değiştir",
    moreLikeThis: "Daha fazlası",
    hiddenGems: "Sadece gizli cevherler",
    toPlan: "Plana çevir",
    similar: "Benzerlerini öner",
    pitch: "Spoilersız tanıtım",
    versus: "{a} ile karşılaştır",
    movies: "Film öner",
    series: "Dizi öner",
  },
  en: {
    different: "Show me different ones",
    pickOne: "Which one should I watch?",
    shorter: "Shorter options",
    similarTo: "More like {title}",
    watchFirst: "Which first?",
    third: "A third option",
    makePlan: "Make a watch plan",
    shortenPlan: "Shorten the plan",
    weekend: "Fit it in a weekend",
    swapOne: "Swap one out",
    moreLikeThis: "More like this",
    hiddenGems: "Hidden gems only",
    toPlan: "Turn into a plan",
    similar: "Suggest similar",
    pitch: "Spoiler-free pitch",
    versus: "Compare with {a}",
    movies: "Suggest movies",
    series: "Suggest series",
  },
};

const fill = (template, values) =>
  template.replace(/\{(\w+)\}/g, (_, key) => (values[key] != null ? values[key] : ""));

const short = (title, max = 18) => {
  const text = clean(title, 60);
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
};

/**
 * Cevabın türüne göre sıradaki mantıklı adımlar. Hepsi yerelde üretilir (token
 * harcamaz); HER BİRİ bir AI mesajıdır ve kullanıcı dokununca kota harcar.
 *
 * `prompt` modele gider (İngilizce; cevap kullanıcının dilinde döner), `label`
 * çipte görünür.
 *
 * @param {object} response
 * @param {object} [options]
 * @param {"tr"|"en"} [options.language]
 * @param {number} [options.limit]
 * @param {object} [options.posterMap]  spotlight için TMDB "benzer" önerisi
 * @returns {{ id: string, icon: string, label: string, prompt: string }[]}
 */
export function buildFollowUps(response, { language = "en", limit = 3, posterMap } = {}) {
  if (!response || typeof response !== "object") return [];
  const copy = FOLLOW_UP_COPY[language === "tr" ? "tr" : "en"];
  const out = [];
  const add = (id, icon, label, prompt) => out.push({ id: `${response.type}:${id}`, icon, label, prompt });

  switch (response.type) {
    case "recommendations": {
      const items = safeArr(response.items);
      if (!items.length) break;
      const first = clean(items[0]?.title);
      add("different", "shuffle-outline", copy.different, "Suggest 3-5 different titles in the same spirit. Do not repeat any title already suggested.");
      if (items.length > 1) {
        add("pick", "trophy-outline", copy.pickOne, "From the titles you just suggested, pick the single best one for me tonight and say why in one short sentence.");
      }
      if (first) {
        add("similar", "copy-outline", fill(copy.similarTo, { title: short(first) }), `Recommend titles similar to "${first}", excluding the ones already suggested.`);
      }
      add("shorter", "timer-outline", copy.shorter, "Suggest shorter alternatives with a similar feel: under 100 minutes, or series with short episodes.");
      break;
    }
    case "comparison": {
      const a = clean(response.left?.title);
      const b = clean(response.right?.title);
      if (!a || !b) break;
      add("first", "flag-outline", copy.watchFirst, `Which should I watch first, "${a}" or "${b}"? Answer in two short sentences.`);
      add("third", "add-circle-outline", copy.third, `Suggest one more title that combines what is best about "${a}" and "${b}".`);
      add("plan", "calendar-outline", copy.makePlan, `Make a watch plan to watch both "${a}" and "${b}".`);
      break;
    }
    case "watch_plan": {
      if (!safeArr(response.sessions).length) break;
      add("shorten", "cut-outline", copy.shortenPlan, "Make this watch plan shorter and tighter, about half the time.");
      add("weekend", "calendar-outline", copy.weekend, "Fit this watch plan into a single weekend.");
      add("swap", "swap-horizontal-outline", copy.swapOne, "Swap one title in this plan for something different of similar length.");
      break;
    }
    case "watchlist": {
      if (countResponseItems(response) === 0) break;
      add("more", "add-circle-outline", copy.moreLikeThis, "Add more titles that fit the same theme as this list. Do not repeat any title already listed.");
      add("gems", "diamond-outline", copy.hiddenGems, "Make a version of this list with only lesser-known hidden gems.");
      add("plan", "calendar-outline", copy.toPlan, "Turn this list into a watch plan.");
      break;
    }
    case "title_spotlight": {
      const title = clean(response.title);
      if (!title) break;
      add("similar", "copy-outline", copy.similar, `Recommend titles similar to "${title}".`);
      add("pitch", "sparkles-outline", copy.pitch, `Give me a short spoiler-free pitch for "${title}": who it suits and what to expect.`);
      const card = (posterMap || {})[posterKey(response.mediaType, title)];
      const rival = clean(safeArr(card?.similar)[0]?.title || safeArr(card?.similar)[0]?.query);
      if (rival) {
        add("versus", "git-compare-outline", fill(copy.versus, { a: short(rival) }), `Compare "${title}" with "${rival}".`);
      }
      break;
    }
    case "general": {
      if (!safeArr(response.items).length) break;
      add("more", "add-circle-outline", copy.moreLikeThis, "Suggest a few more titles in the same direction.");
      add("movies", "film-outline", copy.movies, "Recommend a few movies for me based on my taste.");
      add("series", "tv-outline", copy.series, "Recommend a couple of series for me based on my taste.");
      break;
    }
    default:
      break;
  }
  return out.slice(0, Math.max(0, limit));
}

// ── Liste eylemleri / paylaşım ───────────────────────────────────────────────

/** Cevaptaki bulunmuş başlıklar → libraryActions.addManyToMembership öğeleri. */
export function collectLibraryItems(response, posterMap) {
  const seen = new Set();
  const items = [];
  collectTitles(response).forEach(({ title, mediaType }) => {
    const card = (posterMap || {})[posterKey(mediaType, title)];
    if (!card?.found || card.id == null) return;
    const type = normMediaType(card.mediaType || mediaType);
    const key = `${type}:${card.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({
      id: card.id,
      type,
      name: toStr(card.title) || title,
      imagePath: card.posterPath || null,
    });
  });
  return items;
}

/** Cevabı düz metin listesi olarak paylaşmak için. */
export function buildShareText(response, posterMap, { language = "en", appName = "Seelogd" } = {}) {
  const titles = collectTitles(response);
  if (!titles.length) return "";
  const lines = titles.map(({ title, mediaType }, index) => {
    const card = (posterMap || {})[posterKey(mediaType, title)];
    const name = card?.found ? toStr(card.title) || title : title;
    const year = card?.found && card.year ? ` (${card.year})` : "";
    const rating = safeNum(card?.rating) > 0 ? ` ★${safeNum(card.rating).toFixed(1)}` : "";
    return `${index + 1}. ${name}${year}${rating}`;
  });
  const head = language === "tr" ? `${appName} · CineMatch önerileri` : `${appName} · CineMatch picks`;
  return [head, "", ...lines].join("\n");
}

// ── Geçmiş ekranı ────────────────────────────────────────────────────────────

/** Bir konuşmanın liste satırı için önizlemesi: son soru + son cevabın posterleri. */
export function conversationPreview(conversation, maxPosters = 3) {
  const messages = safeArr(conversation?.messages);
  let lastUser = "";
  let posters = [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!lastUser && message?.role === "user") {
      lastUser = clean(message.display || message.text, 90);
    }
    if (posters.length === 0 && message?.role === "assistant" && message?.aiResponse) {
      posters = collectTitles(message.aiResponse)
        .map(({ title, mediaType }) => (message.posterMap || {})[posterKey(mediaType, title)])
        .filter((card) => card?.found && card.posterPath)
        .slice(0, maxPosters)
        .map((card) => card.posterPath);
    }
    if (lastUser && posters.length) break;
  }
  return { lastUser, posters };
}

/** Başlık + sorular + önerilen başlıklar üzerinde aksan/büyük-küçük harf duyarsız arama. */
export function filterConversations(list, query) {
  const needle = foldForSearch(query).trim();
  const all = safeArr(list);
  if (!needle) return all;
  return all.filter((conversation) => {
    const haystack = [
      conversation?.title,
      ...safeArr(conversation?.messages).flatMap((message) => [
        message?.display,
        message?.role === "assistant" && message?.aiResponse
          ? collectTitles(message.aiResponse).map((entry) => entry.title).join(" ")
          : "",
      ]),
    ]
      .map(toStr)
      .join(" ");
    return foldForSearch(haystack).includes(needle);
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Kısa görece zaman: "•" (az önce) · "5 dk" · "3 sa" · "dün" · "3 g" · "12.06".
 * Geçersiz zaman damgası boş döner.
 */
export function formatRelativeTime(timestamp, language = "en", now = Date.now()) {
  if (!timestamp || !Number.isFinite(Number(timestamp))) return "";
  const tr = language === "tr";
  const minutes = Math.floor((now - timestamp) / 60000);
  if (minutes < 1) return "•";
  if (minutes < 60) return `${minutes} ${tr ? "dk" : "m"}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${tr ? "sa" : "h"}`;
  const days = Math.floor(hours / 24);
  if (days === 1) return tr ? "dün" : "1d";
  if (days < 7) return `${days} ${tr ? "g" : "d"}`;
  const date = new Date(timestamp);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}`;
}

/** "today" | "yesterday" | "week" | "earlier" */
export function recencyBucket(timestamp, now = Date.now()) {
  if (!timestamp) return "earlier";
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const diff = startOfToday.getTime() - timestamp;
  if (diff <= 0) return "today";
  if (diff <= DAY_MS) return "yesterday";
  if (diff <= 6 * DAY_MS) return "week";
  return "earlier";
}

/** [{ bucket, items }] — boş gruplar atılır, sıra korunur (en yeni önce). */
export function groupConversationsByRecency(list, now = Date.now()) {
  const order = ["today", "yesterday", "week", "earlier"];
  const groups = new Map(order.map((bucket) => [bucket, []]));
  safeArr(list).forEach((conversation) => {
    groups.get(recencyBucket(conversation?.updatedAt, now)).push(conversation);
  });
  return order
    .map((bucket) => ({ bucket, items: groups.get(bucket) }))
    .filter((group) => group.items.length > 0);
}

// ── Kota göstergesi ──────────────────────────────────────────────────────────

/**
 * Üst çubuktaki kota ölçeri için. `quota` sunucudan ya da plan sınırlarından
 * gelir; günlük hak aylıktan önce biterse ölçer günlüğü gösterir.
 */
export function quotaMeter(quota, fallbackLimits) {
  const dailyLimit = safeNum(quota?.daily?.limit, safeNum(fallbackLimits?.daily));
  const dailyUsed = Math.max(0, safeNum(quota?.daily?.used));
  const monthlyLimit = safeNum(quota?.monthly?.limit, safeNum(fallbackLimits?.monthly));
  const monthlyUsed = Math.max(0, safeNum(quota?.monthly?.used));
  const dailyLeft = Math.max(0, dailyLimit - dailyUsed);
  const monthlyLeft = Math.max(0, monthlyLimit - monthlyUsed);
  // Aylık sınır bilinmiyorsa yalnız günlük hak belirleyici.
  const left = monthlyLimit > 0 ? Math.min(dailyLeft, monthlyLeft) : dailyLeft;
  const ratio = dailyLimit > 0 ? Math.min(1, dailyUsed / dailyLimit) : 0;
  let level = "ok";
  if (left <= 0 && dailyLimit > 0) level = "empty";
  else if (dailyLimit > 0 && dailyLeft <= Math.max(1, Math.ceil(dailyLimit * 0.2))) level = "low";
  return { dailyUsed, dailyLimit, dailyLeft, monthlyUsed, monthlyLimit, monthlyLeft, left, ratio, level };
}
