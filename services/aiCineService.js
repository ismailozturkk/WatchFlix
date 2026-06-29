// services/aiCineService.js
//
// WhatchFlix "CineMatch Pro" — YAPILANDIRILMIŞ (JSON) AI cevap servisi.
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
  GEMINI_TIMEOUT_MS,
  buildContents,
  parseResponse,
  logUsage,
  maskKey,
  logHttpError,
} from "./geminiService";

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
    return { type: "general", title: "", summary: "", content: toStr(obj), tips: [] };
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
  safeArr(cards).forEach((c) => {
    if (!c) return;
    map[posterKey(c.mediaType, c.query)] = c;
  });
  return map;
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
    `ROLE: You are "CineMatch", a film & TV expert living inside the WatchFlix app. You help users discover and decide what to watch.`,

    `OUTPUT FORMAT (CRITICAL):
- Respond with a SINGLE valid JSON object and NOTHING else. No markdown, no code fences, no commentary outside JSON.
- The JSON MUST have a "type" field set to one of: recommendations | comparison | watch_plan | watchlist | title_spotlight | general.
- Every referenced title MUST be an object {"title": "Exact Title", "mediaType": "movie" | "tv"}. mediaType is REQUIRED.
- Keep text fields concise and spoiler-free. Always write all human-readable text in ${language}.`,

    tasteBlock,

    userLibrary || null,

    `RESPONSE TYPE SELECTION (pick by user intent):
- comparison      → user compares two titles ("X mi Y mi", "X vs Y", "which is better").
- watch_plan      → user wants a viewing schedule / marathon / "how to finish in N days" / "movie night".
- watchlist       → user wants a themed list / collection ("best space movies", "shows to binge").
- title_spotlight → user asks about ONE specific title (details, cast, where to watch, "künye", "hakkında").
- recommendations → user wants suggestions ("öner", "recommend", "ne izlesem").
- general         → greetings, trivia, or anything else on-topic that doesn't fit above.`,

    `SCHEMAS (fill only the chosen type; omit fields you are unsure of):

recommendations:
{"type":"recommendations","title":"...","summary":"...","items":[{"title":"...","mediaType":"movie","hook":"one-sentence spoiler-free hook","why":"why it fits the user","year":"2010","genre":"Sci-Fi","rating":8.4}],"tips":["..."]}

comparison:
{"type":"comparison","title":"...","summary":"...","left":{"title":"...","mediaType":"movie"},"right":{"title":"...","mediaType":"movie"},"metrics":[{"label":"Story","leftScore":4,"rightScore":5},{"label":"Acting","leftScore":5,"rightScore":4},{"label":"Visuals","leftScore":5,"rightScore":5},{"label":"Rewatch","leftScore":3,"rightScore":4}],"leftPros":["..."],"leftCons":["..."],"rightPros":["..."],"rightCons":["..."],"verdict":"short conclusion","tips":["..."]}

watch_plan:
{"type":"watch_plan","title":"...","summary":"...","totalRuntime":"~18h","sessions":[{"label":"Day 1 — Pilot night","items":[{"title":"...","mediaType":"tv","runtime":"3 x 47m"}],"note":"short tip"}],"tips":["..."]}

watchlist:
{"type":"watchlist","title":"...","summary":"...","sections":[{"name":"Essentials","items":[{"title":"...","mediaType":"movie","note":"one line why","mustWatch":true}]}],"tips":["..."]}

title_spotlight:
{"type":"title_spotlight","title":"...","mediaType":"movie","summary":"spoiler-free hook","year":"2021","genres":["Sci-Fi","Drama"],"rating":8.0,"runtime":"2h 35m","cast":["Actor A","Actor B"],"director":"...","whereToWatch":["Netflix"],"similar":[{"title":"...","mediaType":"movie"}],"tips":["..."]}

general:
{"type":"general","title":"...","content":"plain text answer","items":[{"title":"...","mediaType":"movie"}],"tips":["..."]}`,

    `SCORING & SIZE RULES:
- metric scores are integers 0–5. rating is an approximate IMDb-style number 0–10.
- recommendations: 3–6 items. watchlist: 1–4 sections, 2–6 items each. comparison: 3–5 metrics.
- tips: 1–3 short, actionable strings. Never repeat the same title twice in one response.`,

    `BEHAVIOR:
- If the user gives no details, confidently pick great titles from their taste profile — never stall.
- If the request is unrelated to movies/TV/watchable content, return:
  {"type":"general","title":"","summary":"","content":"${offTopicReply}","tips":[]}
- If a USER LIBRARY is provided: personalize with it, NEVER recommend titles listed under WATCHED HISTORY, and when the user refers to "my watchlist / favorites / my list" choose ONLY from the listed items.
- Output JSON ONLY.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ── Ağ katmanı ────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function postOnce(url, body, signal, meta = {}) {
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new GeminiError("TIMEOUT", "Request aborted/timed out", { cause: err });
    }
    throw new GeminiError("NETWORK", "Network request failed", { cause: err });
  }

  if (!res.ok) {
    const status = res.status;
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      /* yoksay */
    }
    // Ayrıntılı, okunaklı hata çıktısı (model + maskeli anahtar + Gemini mesajı).
    logHttpError(status, res.statusText, detail, meta);
    if (status === 429) {
      throw new GeminiError("RATE_LIMIT", `Rate limited (429): ${detail}`, { status });
    }
    if (status === 503 || status === 500) {
      const e = new GeminiError("API_ERROR", `Server error (${status}): ${detail}`, { status });
      e.transient = true;
      throw e;
    }
    throw new GeminiError("API_ERROR", `API error (${status}): ${detail}`, { status });
  }
  return res.json();
}

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
 * @returns {Promise<object>} normalize edilmiş response nesnesi (type alanı garanti)
 * @throws {GeminiError}
 */
export async function askCineStructured({
  apiKey,
  history = [],
  userMessage,
  language = "en",
  movieGenres = [],
  tvGenres = [],
  offTopicReply,
  userLibrary = "",
}) {
  if (!apiKey) throw new GeminiError("NO_API_KEY", "Missing Gemini API key");
  if (!userMessage || userMessage.trim() === "") {
    throw new GeminiError("EMPTY", "Empty user message");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const keyMask = maskKey(apiKey);
  // İstek tanılaması: hangi model + hangi anahtar (maskeli) + endpoint kullanılıyor.
  console.log(
    `[CineMatch Pro] ➜ İstek | model: ${GEMINI_MODEL} | anahtar: ${keyMask} | ` +
      `endpoint: ${url.split("?")[0]}`,
  );
  const meta = { model: GEMINI_MODEL, keyMask };

  const body = {
    contents: buildContents(history, userMessage),
    systemInstruction: {
      parts: [
        {
          text: buildCineSystemInstruction({
            language,
            movieGenres,
            tvGenres,
            offTopicReply,
            userLibrary,
          }),
        },
      ],
    },
    generationConfig: {
      temperature: 0.8,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 0 },
    },
    safetySettings: [
      "HARM_CATEGORY_HARASSMENT",
      "HARM_CATEGORY_HATE_SPEECH",
      "HARM_CATEGORY_SEXUALLY_EXPLICIT",
      "HARM_CATEGORY_DANGEROUS_CONTENT",
    ].map((category) => ({ category, threshold: "BLOCK_ONLY_HIGH" })),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    let data;
    try {
      data = await postOnce(url, body, controller.signal, meta);
    } catch (err) {
      const retryable =
        err instanceof GeminiError && (err.code === "NETWORK" || err.transient === true);
      if (!retryable) throw err;
      await sleep(800);
      data = await postOnce(url, body, controller.signal, meta);
    }
    // Maliyet analizi: token kullanımı + tahmini ücreti console'a yaz.
    logUsage(data);
    return parseCineResponse(data);
  } finally {
    clearTimeout(timeoutId);
  }
}
