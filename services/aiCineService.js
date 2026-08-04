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

export { GeminiError, isGeminiError } from "./geminiService";

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
 * Gemini çıktısından ilk geçerli JSON nesnesini çıkarır.
 * Önce düz parse, olmazsa süslü parantez eşlemesiyle dengeli blok yakalar.
 */
export function extractJSON(text) {
  if (text == null) return null;
  if (typeof text === "object") return text;

  let s = String(text).trim();
  // ```json ... ``` veya ``` ... ``` çitlerini soy
  s = s
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(s);
  } catch {
    /* parantez eşlemesine düş */
  }

  const start = s.indexOf("{");
  if (start === -1) return null;

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
          return JSON.parse(cand);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
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
 * CineMatch Pro sistem talimatı — Gemini'den SADECE JSON ister.
 */
export function buildCineSystemInstruction({
  language = "en",
  movieGenres = [],
  tvGenres = [],
  offTopicReply = "I can only help with movies, TV series, and watchable content.",
  userLibrary = "",
} = {}) {
  const movieList = formatGenres(movieGenres);
  const tvList = formatGenres(tvGenres);
  const tasteLines = [];
  if (movieList.length) tasteLines.push(`- Favorite movie genres: ${movieList.join(", ")}`);
  if (tvList.length) tasteLines.push(`- Favorite TV genres: ${tvList.join(", ")}`);
  const tasteBlock = tasteLines.length
    ? `USER TASTE PROFILE (use softly for personalization, do not announce it):\n${tasteLines.join("\n")}`
    : "USER TASTE PROFILE: unknown — infer from the conversation.";

  return [
    `ROLE: You are CineMatch, Seelogd's concise film and TV decision assistant.`,

    `OUTPUT FORMAT (CRITICAL):
- Respond with a SINGLE valid JSON object and NOTHING else. No markdown, no code fences, no commentary outside JSON.
- The JSON MUST have a "type" field set to one of: recommendations | comparison | watch_plan | watchlist | title_spotlight | general.
- Every referenced title MUST be an object {"title": "Exact Title", "mediaType": "movie" | "tv"}. mediaType is REQUIRED.
- Never invent TMDB IDs or factual metadata. Seelogd resolves IDs, posters, year, rating, genres, runtime, cast, crew, providers and similar titles from TMDB.
- Keep every text field to one short spoiler-free sentence. Write human-readable text in ${language}.`,

    tasteBlock,

    userLibrary || null,

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

    `SCORING & SIZE RULES:
- comparison metric keys may only be story, acting, visuals, pacing, emotion or rewatch; scores are integers 0–5.
- recommendations: 3–5 items. watchlist: 1–3 sections with 2–5 items. comparison: 3–5 metrics.
- general content: at most 80 words. Never repeat a title in one response.`,

    `BEHAVIOR:
- If the user gives no details, confidently pick great titles from their taste profile — never stall.
- If the request is unrelated to movies/TV/watchable content, return:
  {"type":"general","content":"${offTopicReply}"}
- If a USER LIBRARY is provided: personalize with it, NEVER recommend titles listed under WATCHED HISTORY, and when the user refers to "my watchlist / favorites / my list" choose ONLY from the listed items.
- Output JSON ONLY.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ── Ağ katmanı: callGemini Cloud Function proxy'si ───────────────────────────
// Doğrudan Gemini HTTP çağrısı KALDIRILDI (anahtar istemcide tutulamaz).
// Timeout/retry sunucuda (functions/index.js), kota da orada uygulanır.

/** Gemini gövdesini güvenle parse edip JSON nesnesine çevirir. */
function parseCineResponse(data) {
  const { text } = parseResponse(data); // blok/boş durumlarda GeminiError fırlatır
  const obj = extractJSON(text);
  if (!obj) {
    throw new GeminiError("EMPTY", "Model JSON döndürmedi / parse edilemedi");
  }
  return normalizeResponse(obj);
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

  return parseCineResponse(data);
}
