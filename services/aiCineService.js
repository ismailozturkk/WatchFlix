// services/aiCineService.js
//
// Seelogd "CineMatch Pro" — YAPILANDIRILMIŞ (JSON) AI cevap servisi.
//
// CineMatch'in (geminiService.js) markdown sohbetinin yanında, bu servis Gemini'den
// SADECE geçerli JSON döndürmesini ister ve her "type" için zengin görsel kart render
// edilir (Navia mimarisi). Saf JS — React'tan bağımsız, test edilebilir.
//
// Response tipleri: recommendations | comparison | watch_plan | watchlist |
//                   title_spotlight | general

import {
  GeminiError,
  GEMINI_MODEL,
  parseResponse,
  logUsage,
  callGeminiProxy,
  sanitizeHistory,
} from "./geminiService";
import { ANALYTICS_EVENTS, trackEvent } from "./analytics";
import { AI_RESPONSE_STYLES, AI_SPOILER_LEVELS } from "../utils/aiPrefs";
import { aiPromptLanguageOf } from "../utils/appLanguages";

export { GeminiError } from "./geminiService";

export const CINE_VALID_TYPES = [
  "recommendations",
  "comparison",
  "watch_plan",
  "watchlist",
  "title_spotlight",
  "general",
];

// ── Güvenli dönüşüm yardımcıları (Gemini bazen beklenmedik şekil döndürür) ─────

/** Her şeyi güvenle okunabilir string'e çevirir. */
export const toStr = (v) => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(toStr).filter(Boolean).join(", ");
  if (typeof v === "object")
    return toStr(v.text ?? v.name ?? v.title ?? v.label ?? v.value ?? "");
  return String(v);
};

/** null/undefined/tek eleman → güvenli dizi. */
export const safeArr = (v) => {
  if (Array.isArray(v)) return v;
  if (v == null || v === "") return [];
  return [v];
};

/** Güvenli sayı dönüşümü (virgül ondalığı dahil). */
export const safeNum = (v, fallback = 0) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
};

/** mediaType'ı "movie" | "tv" olarak normalize eder. */
export const normMediaType = (m) =>
  m === "tv" || m === "series" || m === "show" ? "tv" : "movie";

/** Poster eşlemesi için tutarlı anahtar (ekran + kartlar aynı anahtarı kullanır). */
export const posterKey = (mediaType, title) =>
  `${normMediaType(mediaType)}|${toStr(title).toLowerCase().trim()}`;

// ── JSON çıkarma (kod bloğu / gürültü toleranslı) ─────────────────────────────

/**
 * Yarıda kesilmiş (MAX_TOKENS) bir JSON'u kurtarır: en son TAMAMLANMIŞ iç değerde
 * keser, açık kalan köşeli/süslü parantezleri kapatır. Yarım kalan son öğe
 * düşer, öncekiler korunur — ör. 5 önerinin 4'ü gelmişse 4'ü gösterilir.
 *
 * Neden önemli: sunucu hakkı yalnız üst akış hatasında iade eder; kesik ama
 * ayrıştırılamayan bir cevap kullanıcının mesaj hakkını boşuna yakıyordu.
 */
export function repairTruncatedJSON(text) {
  const s = String(text ?? "");
  const start = s.indexOf("{");
  if (start === -1) return null;

  const stack = [];
  let inStr = false;
  let esc = false;
  let cut = -1;
  let cutStack = null;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") {
      stack.pop();
      if (stack.length === 0) return null; // zaten tam; kurtarma gerekmez
      cut = i;
      cutStack = stack.slice();
    }
  }
  if (cut === -1) return null;

  const closers = cutStack
    .reverse()
    .map((open) => (open === "{" ? "}" : "]"))
    .join("");
  try {
    return JSON.parse(s.slice(start, cut + 1) + closers);
  } catch {
    return null;
  }
}

/**
 * Gemini çıktısından ilk geçerli JSON nesnesini çıkarır ve kurtarma gerekip
 * gerekmediğini söyler. Önce düz parse, olmazsa süslü parantez eşlemesiyle
 * dengeli blok, o da kapanmıyorsa kesik JSON onarımı.
 * @returns {{ value: object|null, repaired: boolean }}
 */
export function extractJSONDetailed(text) {
  if (text == null) return { value: null, repaired: false };
  if (typeof text === "object") return { value: text, repaired: false };

  let s = String(text).trim();
  // ```json ... ``` veya ``` ... ``` çitlerini soy
  s = s
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return { value: JSON.parse(s), repaired: false };
  } catch {
    /* parantez eşlemesine düş */
  }

  const start = s.indexOf("{");
  if (start === -1) return { value: null, repaired: false };

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') {
      inStr = true;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const cand = s.slice(start, i + 1);
        try {
          return { value: JSON.parse(cand), repaired: false };
        } catch {
          return { value: null, repaired: false };
        }
      }
    }
  }
  // Blok hiç kapanmadı: cevap yarıda kesilmiş olabilir.
  const repaired = repairTruncatedJSON(s);
  return { value: repaired, repaired: repaired != null };
}

export function extractJSON(text) {
  return extractJSONDetailed(text).value;
}

/**
 * Parse edilmiş nesneyi geçerli bir `type` ile normalize eder.
 * type eksik/yanlışsa alanlardan çıkarım yapar, son çare "general".
 */
export function normalizeResponse(obj) {
  if (!obj || typeof obj !== "object") {
    return { type: "general", content: toStr(obj) };
  }
  let type = obj.type;
  if (!CINE_VALID_TYPES.includes(type)) {
    if (obj.sections) type = "watchlist";
    else if (obj.sessions) type = "watch_plan";
    else if (obj.metrics || (obj.left && obj.right)) type = "comparison";
    else if (obj.cast || obj.whereToWatch || obj.director) type = "title_spotlight";
    else if (obj.items) type = "recommendations";
    else type = "general";
  }
  return { ...obj, type };
}

/**
 * Bir cevaptan tüm {title, mediaType} çiftlerini toplar (TMDB poster çözümü için).
 * Tekrarları eler.
 */
export function collectTitles(r) {
  const out = [];
  const push = (title, mediaType) => {
    const tt = toStr(title).trim();
    if (!tt) return;
    out.push({ title: tt, mediaType: normMediaType(mediaType) });
  };

  if (r && typeof r === "object") {
    switch (r.type) {
      case "recommendations":
      case "general":
        safeArr(r.items).forEach((it) => push(it?.title, it?.mediaType));
        break;
      case "comparison":
        push(r.left?.title, r.left?.mediaType);
        push(r.right?.title, r.right?.mediaType);
        break;
      case "watch_plan":
        safeArr(r.sessions).forEach((s) =>
          safeArr(s?.items).forEach((it) => push(it?.title, it?.mediaType)),
        );
        break;
      case "watchlist":
        safeArr(r.sections).forEach((s) =>
          safeArr(s?.items).forEach((it) => push(it?.title, it?.mediaType)),
        );
        break;
      case "title_spotlight":
        push(r.title, r.mediaType);
        safeArr(r.similar).forEach((it) => push(it?.title, it?.mediaType));
        break;
      default:
        break;
    }
  }

  const seen = new Set();
  return out.filter((x) => {
    const k = posterKey(x.mediaType, x.title);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** collectTitles çıktısını resolveCards için { movies, series } biçimine ayırır. */
export function splitTitlesForLookup(pairs) {
  const movies = [];
  const series = [];
  safeArr(pairs).forEach((p) => {
    if (normMediaType(p.mediaType) === "tv") series.push(p.title);
    else movies.push(p.title);
  });
  return { movies, series };
}

/** resolveCards çıktısını posterKey → card haritasına çevirir. */
export function buildPosterMap(cards) {
  const map = {};
  const add = (c) => {
    if (!c) return;
    map[posterKey(c.mediaType, c.query)] = c;
    safeArr(c.similar).forEach(add);
  };
  safeArr(cards).forEach(add);
  return map;
}

/** Yapılandırılmış cevabı kısa konuşma geçmişine çevirir. */
export function responseToHistoryText(response) {
  if (!response || typeof response !== "object") return "";
  const titleOf = (item) => toStr(item?.title).trim();
  const titlesOf = (items) => safeArr(items).map(titleOf).filter(Boolean);

  switch (response.type) {
    case "recommendations":
      return `recommendations: ${titlesOf(response.items).join(", ")}`;
    case "comparison":
      return [`comparison: ${titleOf(response.left)} vs ${titleOf(response.right)}`, toStr(response.verdict)]
        .filter(Boolean).join(" — ");
    case "watch_plan":
      return `watch plan: ${safeArr(response.sessions).flatMap((s) => titlesOf(s?.items)).join(", ")}`;
    case "watchlist":
      return `watchlist: ${safeArr(response.sections).flatMap((s) => titlesOf(s?.items)).join(", ")}`;
    case "title_spotlight":
      return [`title: ${titleOf(response)}`, toStr(response.take || response.summary)]
        .filter(Boolean).join(" — ");
    default:
      return toStr(response.content || response.summary || response.title);
  }
}

// ── GeminiError.code → lokalize hata mesajı ───────────────────────────────────

export function friendlyError(code, t) {
  const e = t?.AICineChat?.errors || {};
  switch (code) {
    case "NO_API_KEY":
      return e.noApiKey || "AI anahtarı tanımlı değil.";
    case "NETWORK":
      return e.network || "Bağlantı hatası. İnternetini kontrol et.";
    case "TIMEOUT":
      return e.timeout || "İstek zaman aşımına uğradı, tekrar dene.";
    case "RATE_LIMIT":
      return e.rateLimit || "Çok fazla istek. Biraz sonra tekrar dene.";
    case "QUOTA":
      return e.quota || "Bugünlük AI hakkın doldu. Yarın tekrar dene.";
    case "MONTHLY_QUOTA":
      return e.monthlyQuota || "Bu aylık AI hakkın doldu. Gelecek ay tekrar dene.";
    case "AUTH":
      return e.authRequired || "AI sohbet için giriş yapman gerekiyor.";
    case "BLOCKED":
      return e.blocked || "Bu içerik güvenlik nedeniyle yanıtlanamadı.";
    case "EMPTY":
      return e.empty || "Boş yanıt geldi, tekrar dener misin?";
    default:
      return e.generic || "Bir şeyler ters gitti. Tekrar dene.";
  }
}

// ── Sistem prompt'u (JSON-only) ───────────────────────────────────────────────

function formatGenres(genres) {
  const cleaned = (genres || [])
    .map((g) => (typeof g === "string" ? g.trim() : ""))
    .filter((g) => g && g !== "-");
  return Array.from(new Set(cleaned));
}

/**
 * Cevap stili tercihlerini (Ayarlar > Yapay zeka) talimat cümlelerine çevirir.
 *
 * ÇIKTI BÜTÇESİ: sunucu cine modunda 1200 token'da keser (functions/index.js).
 * Liste üst sınırları bu yüzden stile göre daralır: ayrıntılı üslupta her satır
 * daha uzun olduğundan toplam öğe sayısı düşük tutulur. Varsayılan (dengeli,
 * spoilersız, 5 öğe) eski talimatla aynı kuralları üretir.
 */
export function resolveStyleRules({ responseStyle, spoilerLevel, maxItems } = {}) {
  const style = AI_RESPONSE_STYLES.includes(responseStyle) ? responseStyle : "balanced";
  const spoilers = AI_SPOILER_LEVELS.includes(spoilerLevel) ? spoilerLevel : "none";
  // Ayar 3/5/8'dir; filtre açıkken ekran yerelde elenecekler için 1-2 öğe fazla ister.
  const requested = Number(maxItems);
  const max = Number.isInteger(requested) && requested >= 1 && requested <= 12 ? requested : 5;

  let textRule = "Keep every text field to one short sentence.";
  if (style === "concise") textRule = "Keep every text field to at most 8 words.";
  if (style === "detailed") {
    textRule = "Keep every text field to one or two vivid sentences (tone, pacing or a signature element), never longer.";
  }
  const spoilerRule =
    spoilers === "light"
      ? "Light setup is fine (first act only), but never reveal twists, deaths, endings or major reveals."
      : "Zero spoilers: never reveal twists, deaths, endings or major reveals.";
  // Eski talimatın birebir cümlesi: dengeli + spoilersız
  const combinedRule =
    style === "balanced" && spoilers === "none"
      ? "Keep every text field to one short spoiler-free sentence."
      : `${textRule} ${spoilerRule}`;

  const recMin = Math.min(3, max);
  const watchlistCap = style === "detailed" ? 9 : 12;
  const generalWords = style === "concise" ? 50 : style === "detailed" ? 120 : 80;
  const sizeRules = [
    `- comparison metric keys may only be story, acting, visuals, pacing, emotion or rewatch; scores are integers 0–5.`,
    `- recommendations: ${recMin}–${max} items. watchlist: 1–3 sections with 2–${max} items each, at most ${watchlistCap} items in total. comparison: 3–5 metrics.`,
    `- general content: at most ${generalWords} words. Never repeat a title in one response.`,
  ].join("\n");

  return { style, spoilers, maxItems: max, combinedRule, sizeRules };
}

/**
 * CineMatch Pro sistem talimatı — Gemini'den SADECE JSON ister.
 *
 * `contextBlock` / `avoidBlock` hazır metin bloklarıdır (services/aiCineInsights);
 * `focusMedia` önceki bir mesajda sorulmuş yapımdır (zorlanmaz, yalnız zamirleri
 * çözer) — `targetMedia` ise o mesajın KENDİSİNİN konusudur ve cevabı kilitler.
 */
export function buildCineSystemInstruction({
  language = "en",
  movieGenres = [],
  tvGenres = [],
  offTopicReply = "I can only help with movies, TV series, and watchable content.",
  userLibrary = "",
  discoveryPreferences = "",
  targetMedia = null,
  focusMedia = null,
  responseStyle = "balanced",
  spoilerLevel = "none",
  maxItems = 5,
  contextBlock = "",
  avoidBlock = "",
} = {}) {
  const rules = resolveStyleRules({ responseStyle, spoilerLevel, maxItems });
  const movieList = formatGenres(movieGenres);
  const tvList = formatGenres(tvGenres);
  const tasteLines = [];
  if (movieList.length) tasteLines.push(`- Favorite movie genres: ${movieList.join(", ")}`);
  if (tvList.length) tasteLines.push(`- Favorite TV genres: ${tvList.join(", ")}`);
  const tasteBlock = tasteLines.length
    ? `USER TASTE PROFILE (use softly for personalization, do not announce it):\n${tasteLines.join("\n")}`
    : "USER TASTE PROFILE: unknown — infer from the conversation.";
  const targetBlock = targetMedia?.title
    ? `AUTHORITATIVE TARGET MEDIA (do not replace it with a more popular or similarly named title):
- TMDB ID: ${toStr(targetMedia.id)}
- Media type: ${normMediaType(targetMedia.mediaType)}
- Display title: ${toStr(targetMedia.title)}
- Original title: ${toStr(targetMedia.originalTitle) || "unknown"}
- Year: ${toStr(targetMedia.year) || "unknown"}
- Genres: ${safeArr(targetMedia.genres).map(toStr).filter(Boolean).join(", ") || "unknown"}
- Overview: ${toStr(targetMedia.overview).slice(0, 900) || "unknown"}
- Cast: ${safeArr(targetMedia.cast).map(toStr).filter(Boolean).slice(0, 8).join(", ") || "unknown"}
The user's title-specific question refers ONLY to this exact TMDB record. Return title_spotlight with its display title and media type.`
    : null;
  // Önceki mesajdaki yapım: cevabı kilitlemez, yalnız "bunu / onu" gibi zamirleri çözer.
  const focusBlock =
    !targetMedia?.title && focusMedia?.title
      ? `CONVERSATION FOCUS (earlier in this chat the user asked about this exact title; resolve "it", "this", "bu", "onu" to it unless they name another title):
- TMDB ID: ${toStr(focusMedia.id)}
- Media type: ${normMediaType(focusMedia.mediaType)}
- Title: ${toStr(focusMedia.title)}${focusMedia.year ? ` (${toStr(focusMedia.year)})` : ""}`
      : null;

  return [
    `ROLE: You are CineMatch, Seelogd's concise film and TV decision assistant.`,

    `OUTPUT FORMAT (CRITICAL):
- Respond with a SINGLE valid JSON object and NOTHING else. No markdown, no code fences, no commentary outside JSON.
- The JSON MUST have a "type" field set to one of: recommendations | comparison | watch_plan | watchlist | title_spotlight | general.
- Every referenced title MUST be an object {"title": "Exact Title", "mediaType": "movie" | "tv"}. mediaType is REQUIRED.
- Never invent TMDB IDs or factual metadata. Seelogd resolves IDs, posters, year, rating, genres, runtime, cast, crew, providers and similar titles from TMDB.
- ${rules.combinedRule} Write human-readable text in ${aiPromptLanguageOf(language)}.`,

    tasteBlock,

    discoveryPreferences || null,

    targetBlock,

    focusBlock,

    userLibrary || null,

    contextBlock || null,

    avoidBlock || null,

    `RESPONSE TYPE SELECTION (pick by user intent):
- comparison      → user compares two titles ("X mi Y mi", "X vs Y", "which is better").
- watch_plan      → user wants a viewing schedule / marathon / "how to finish in N days" / "movie night".
- watchlist       → user wants a themed list / collection ("best space movies", "shows to binge").
- title_spotlight → user asks about ONE specific title (details, cast, where to watch, "künye", "hakkında").
- recommendations → user wants suggestions ("öner", "recommend", "ne izlesem").
- general         → greetings, trivia, or anything else on-topic that doesn't fit above.`,

    `COMPACT SCHEMAS (return only the chosen schema; never add title, summary, tips or factual TMDB fields):

recommendations:
{"type":"recommendations","items":[{"title":"Exact Title","mediaType":"movie","reason":"why it fits"}]}

comparison:
{"type":"comparison","left":{"title":"Exact Title","mediaType":"movie"},"right":{"title":"Exact Title","mediaType":"movie"},"metrics":[{"key":"story","left":4,"right":5}],"leftPros":["..."],"leftCons":["..."],"rightPros":["..."],"rightCons":["..."],"verdict":"short conclusion"}

watch_plan:
{"type":"watch_plan","sessions":[{"label":"Day 1","items":[{"title":"Exact Title","mediaType":"tv"}]}]}

watchlist:
{"type":"watchlist","sections":[{"key":"essential","items":[{"title":"Exact Title","mediaType":"movie","reason":"why it belongs","mustWatch":true}]}]}

title_spotlight:
{"type":"title_spotlight","title":"Exact Title","mediaType":"movie","take":"why it is worth considering"}

general:
{"type":"general","content":"brief answer","items":[{"title":"Exact Title","mediaType":"movie"}]}`,

    `SCORING & SIZE RULES:\n${rules.sizeRules}`,

    `BEHAVIOR:
- If the user gives no details, confidently pick great titles from their taste profile — never stall.
- Apply AI DISCOVERY FILTERS strictly to recommendations and generated watchlists. Direct questions about named titles, comparisons and title details always take priority over filters.
- If the request is unrelated to movies/TV/watchable content, return:
  {"type":"general","content":"${offTopicReply}"}
- If a USER LIBRARY is provided: personalize with it, NEVER recommend titles listed under WATCHED HISTORY, and when the user refers to "my watchlist / favorites / my list" choose ONLY from the listed items.
- Output JSON ONLY.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function enforceTargetMediaResponse(response, targetMedia) {
  if (!targetMedia?.title || !response || typeof response !== "object") return response;

  const take = toStr(
    response.take ||
      response.content ||
      response.summary ||
      response.reason ||
      safeArr(response.items)[0]?.reason,
  );

  return {
    type: "title_spotlight",
    title: toStr(targetMedia.title),
    mediaType: normMediaType(targetMedia.mediaType),
    take,
  };
}

// ── Ağ katmanı: callGemini Cloud Function proxy'si ───────────────────────────
// Doğrudan Gemini HTTP çağrısı KALDIRILDI (anahtar istemcide tutulamaz).
// Timeout/retry sunucuda (functions/index.js), kota da orada uygulanır.

/** Gemini gövdesini güvenle parse edip JSON nesnesine çevirir. */
function parseCineResponse(data) {
  const { text } = parseResponse(data); // blok/boş durumlarda GeminiError fırlatır
  const { value, repaired } = extractJSONDetailed(text);
  if (!value) {
    throw new GeminiError("EMPTY", "Model JSON döndürmedi / parse edilemedi");
  }
  const normalized = normalizeResponse(value);
  // Kesik cevaptan kurtarılan sonuç: arayüz "kısaltıldı" notu gösterebilsin.
  return repaired ? { ...normalized, truncated: true } : normalized;
}

/**
 * CineMatch Pro asistanına mesaj gönderir ve YAPILANDIRILMIŞ JSON cevabı döndürür.
 * İstek `callGemini` Cloud Function proxy'sinden geçer — istemcide API
 * anahtarı YOKTUR; günlük kota sunucuda uygulanır.
 * @returns {Promise<object>} normalize edilmiş response nesnesi (type alanı garanti)
 * @throws {GeminiError}
 */
export async function askCineStructured({
  history = [],
  userMessage,
  language = "en",
  movieGenres = [],
  tvGenres = [],
  offTopicReply,
  userLibrary = "",
  discoveryPreferences = "",
  targetMedia = null,
  focusMedia = null,
  responseStyle,
  spoilerLevel,
  maxItems,
  contextBlock = "",
  avoidBlock = "",
  onQuota,
} = {}) {
  if (!userMessage || userMessage.trim() === "") {
    throw new GeminiError("EMPTY", "Empty user message");
  }

  console.log(
    `[CineMatch Pro] ➜ İstek | model: ${GEMINI_MODEL} | proxy: callGemini (anahtar sunucuda)`,
  );

  const data = await callGeminiProxy({
    mode: "cine",
    history: sanitizeHistory(history),
    userMessage,
    systemInstruction: buildCineSystemInstruction({
      language,
      movieGenres,
      tvGenres,
      offTopicReply,
      userLibrary,
      discoveryPreferences,
      targetMedia,
      focusMedia,
      responseStyle,
      spoilerLevel,
      maxItems,
      contextBlock,
      avoidBlock,
    }),
    onQuota,
  });

  // Maliyet analizi: token kullanımı + tahmini ücreti console'a yaz.
  logUsage(data);

  // AI mesajı = uygulamanın kullanıcı başına DEĞİŞKEN maliyeti olan tek
  // özelliği. Token sayısı da gidiyor: konsolda "mesaj başı ortalama token"
  // olmadan kota (free 5 / premium 100) doğru fiyatlanamaz.
  trackEvent(ANALYTICS_EVENTS.AI_MESSAGE, {
    mode: "cine",
    language,
    history_length: Array.isArray(history) ? history.length : 0,
    prompt_tokens: data?.usageMetadata?.promptTokenCount ?? null,
    output_tokens: data?.usageMetadata?.candidatesTokenCount ?? null,
  });

  return enforceTargetMediaResponse(parseCineResponse(data), targetMedia);
}
