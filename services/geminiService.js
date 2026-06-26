// services/geminiService.js
//
// WhatchFlix yapay zeka asistanı ("CineMatch") için merkezi Gemini servisi.
//
// Sorumluluklar:
//   - Güçlü, yapılandırılmış sistem prompt'u üretmek (kullanıcı zevk profili dahil)
//   - Konuşma geçmişini gerçek çok-turlu `contents` dizisine çevirmek (HAFIZA)
//   - İsteği AbortController timeout + geçici hatalarda tek retry ile yapmak
//   - Yanıtı savunmacı şekilde parse etmek (güvenlik bloğu, boş candidate, MAX_TOKENS)
//   - Yanıttan film/dizi başlıklarını ayıklamak ve markdown'a hazırlamak
//
// Bu modül React'tan bağımsızdır (saf JS) — test edilebilir ve UI'dan ayrıktır.

export const GEMINI_MODEL = "gemini-2.5-flash";
export const GEMINI_TIMEOUT_MS = 30000;

// API'ye gönderilecek azami mesaj sayısı (6 gidiş-geliş). Token şişmesini önler.
export const MAX_HISTORY_MESSAGES = 12;

/**
 * Tipli Gemini hatası. `code` UI tarafında lokalize hata mesajına eşlenir.
 * code ∈ NO_API_KEY | NETWORK | TIMEOUT | RATE_LIMIT | BLOCKED | EMPTY | API_ERROR
 */
export class GeminiError extends Error {
  constructor(code, message, { status, cause } = {}) {
    super(message || code);
    // ⚠️ Babel/Metro, `extends Error` sınıflarında prototip zincirini bozar →
    // `err instanceof GeminiError` cihazda FALSE döner. Prototipi elle
    // bağlayarak instanceof'u güvenli kılıyoruz. (Yine de UI tarafında
    // `err.code` üzerinden kontrol etmek en sağlamı.)
    Object.setPrototypeOf(this, GeminiError.prototype);
    this.name = "GeminiError";
    this.code = code;
    this.status = status;
    if (cause) this.cause = cause;
  }
}

/** Bir hatanın bizim tipli Gemini hatamız olup olmadığını güvenle anlar. */
export function isGeminiError(err) {
  return err instanceof GeminiError || typeof err?.code === "string";
}

// ── Sistem prompt'u ─────────────────────────────────────────────────────────

/**
 * Kullanıcının zevk profilinden okunabilir bir tür listesi üretir.
 * null / "-" gibi boş değerleri eler.
 */
function formatGenres(genres) {
  const cleaned = (genres || [])
    .map((g) => (typeof g === "string" ? g.trim() : ""))
    .filter((g) => g && g !== "-");
  return Array.from(new Set(cleaned));
}

/**
 * Güçlü, yapılandırılmış sistem talimatı.
 * @param {object} opts
 * @param {string} opts.language - Yanıt dili (örn. "tr" | "en")
 * @param {string[]} [opts.movieGenres] - En çok izlenen film türleri
 * @param {string[]} [opts.tvGenres] - En çok izlenen dizi türleri
 * @param {string} [opts.offTopicReply] - Konu dışı sorulara verilecek lokalize ret cümlesi
 */
export function buildSystemInstruction({
  language = "en",
  movieGenres = [],
  tvGenres = [],
  offTopicReply = "I can only help with movies, TV series, and watchable content.",
} = {}) {
  const movieList = formatGenres(movieGenres);
  const tvList = formatGenres(tvGenres);

  const tasteLines = [];
  if (movieList.length) {
    tasteLines.push(`- Favorite movie genres: ${movieList.join(", ")}`);
  }
  if (tvList.length) {
    tasteLines.push(`- Favorite TV genres: ${tvList.join(", ")}`);
  }
  const tasteBlock = tasteLines.length
    ? `USER TASTE PROFILE (soft background context for personalization — weave it in naturally, do not announce that you are using it):\n${tasteLines.join("\n")}`
    : "USER TASTE PROFILE: unknown yet — infer preferences from the conversation.";

  return [
    `ROLE: You are "CineMatch", a warm and knowledgeable film & TV companion living inside the WatchFlix app. You help users discover what to watch next and answer questions about movies and series.`,

    `CAPABILITIES:
- Recommend movies and TV series precisely tailored to the user's taste and request.
- Explain a title's hook (spoiler-free), main cast, director/creator, release year, runtime, genres, an approximate IMDb-style rating, and where to stream it when you know.
- Compare titles, build themed watchlists, and answer film/TV trivia.`,

    tasteBlock,

    `RESPONSE STYLE:
- Always respond in ${language}.
- Use clean, scannable Markdown. Open with one short framing sentence, then a list of picks.
- Make every title **bold-worthy**, but rely on the tagging rules below for the actual title text.
- For each recommendation, keep it compact (1–3 lines): a one-sentence spoiler-free hook, a quick "why it fits you", and a meta line like: year · main genre · ~IMDb rating · key cast/director · streaming platform (omit any part you are unsure of).
- Recommend 3–6 titles unless the user asks for more or fewer. Avoid walls of text.
- Never repeat a title you already recommended earlier in this conversation.
- End with one short, inviting follow-up question to keep the conversation going.`,

    `TITLE TAGGING (CRITICAL — the app parses these tags to build tappable chips, so they must be exact):
- Wrap EVERY TV series title exactly as <SERIES: Exact Title>  e.g. <SERIES: Breaking Bad>
- Wrap EVERY movie title exactly as <MOVIE: Exact Title>  e.g. <MOVIE: Inception>
- Apply the tag on every mention of a title, including inside sentences and lists.
- Do not wrap the tag in extra markdown (no **<MOVIE: ...>**); the app styles it.`,

    `BEHAVIOR:
- If the user asks for a recommendation without giving details, just confidently pick great titles using their taste profile — never stall by asking for clarification first.
- Continue naturally from previous turns; remember context and what was already suggested.
- If the user asks about anything unrelated to movies, TV series, or watchable content, reply with EXACTLY this sentence and nothing else: "${offTopicReply}"
- Be warm, concise, and confident. No filler, no disclaimers about being an AI.`,
  ].join("\n\n");
}

// ── İstek gövdesi kurulumu ──────────────────────────────────────────────────

/**
 * Kullanıcının yazdığı mesaj + seçtiği türlerden tek bir kullanıcı turu metni kurar.
 * Tür seçiliyse model için açık bir talimata dönüştürür.
 */
export function buildUserPrompt({ message = "", movieGenres = [], tvGenres = [] } = {}) {
  const msg = (message || "").trim();
  const movies = formatGenres(movieGenres);
  const tv = formatGenres(tvGenres);

  if (movies.length) {
    return `Recommend movies in these genres: ${movies.join(", ")}.${msg ? " " + msg : ""}`;
  }
  if (tv.length) {
    return `Recommend TV series in these genres: ${tv.join(", ")}.${msg ? " " + msg : ""}`;
  }
  return msg;
}

/**
 * Konuşma geçmişini + güncel kullanıcı mesajını Gemini `contents` dizisine çevirir.
 * Geçmiş { role: "user" | "assistant", text } biçimindedir; "assistant" → "model".
 * Yalnızca son MAX_HISTORY_MESSAGES mesaj gönderilir.
 */
export function buildContents(history = [], userText = "") {
  const recent = history.slice(-MAX_HISTORY_MESSAGES);
  const contents = recent
    .filter((m) => m && typeof m.text === "string" && m.text.trim() !== "")
    .map((m) => ({
      role: m.role === "assistant" || m.role === "model" ? "model" : "user",
      parts: [{ text: m.text }],
    }));

  if (userText && userText.trim() !== "") {
    contents.push({ role: "user", parts: [{ text: userText }] });
  }
  return contents;
}

// ── Ağ katmanı ──────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Tek istek dener. Geçici hatalarda (network / 503) çağıran tekrar dener.
 */
async function postOnce(url, body, signal) {
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
    if (status === 429) {
      throw new GeminiError("RATE_LIMIT", `Rate limited (429): ${detail}`, { status });
    }
    if (status === 503 || status === 500) {
      // Çağıran retry edebilsin diye API_ERROR ama "geçici" işaretiyle
      const e = new GeminiError("API_ERROR", `Server error (${status}): ${detail}`, { status });
      e.transient = true;
      throw e;
    }
    throw new GeminiError("API_ERROR", `API error (${status}): ${detail}`, { status });
  }

  return res.json();
}

/**
 * Gemini yanıt gövdesini savunmacı şekilde düz metne çevirir.
 * @returns {{ text: string, truncated: boolean }}
 */
export function parseResponse(data) {
  const blockReason = data?.promptFeedback?.blockReason;
  if (blockReason) {
    throw new GeminiError("BLOCKED", `Prompt blocked: ${blockReason}`);
  }

  const candidate = data?.candidates?.[0];
  if (!candidate) {
    throw new GeminiError("EMPTY", "No candidates returned");
  }

  const finishReason = candidate.finishReason;
  if (finishReason === "SAFETY" || finishReason === "RECITATION") {
    throw new GeminiError("BLOCKED", `Response blocked: ${finishReason}`);
  }

  const parts = candidate.content?.parts || [];
  const text = parts.map((p) => p?.text || "").join("").trim();
  if (!text) {
    // finishReason'ı mesaja koy: MAX_TOKENS (düşünme bütçesi tükenmesi),
    // OTHER vb. teşhis için toast/konsolda görünür.
    throw new GeminiError("EMPTY", `Empty response text (finishReason: ${finishReason || "none"})`);
  }

  return { text, truncated: finishReason === "MAX_TOKENS" };
}

/**
 * Asistana bir mesaj gönderir ve düz metin yanıtı döndürür.
 *
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {Array}  [opts.history] - Önceki turlar [{ role, text }] (güncel mesaj HARİÇ)
 * @param {string} opts.userMessage - Bu turdaki kullanıcı metni (buildUserPrompt çıktısı)
 * @param {string} [opts.language]
 * @param {string[]} [opts.movieGenres]
 * @param {string[]} [opts.tvGenres]
 * @param {string} [opts.offTopicReply]
 * @returns {Promise<{ text: string, truncated: boolean }>}
 * @throws {GeminiError}
 */
export async function askGemini({
  apiKey,
  history = [],
  userMessage,
  language = "en",
  movieGenres = [],
  tvGenres = [],
  offTopicReply,
}) {
  if (!apiKey) {
    throw new GeminiError("NO_API_KEY", "Missing Gemini API key");
  }
  if (!userMessage || userMessage.trim() === "") {
    throw new GeminiError("EMPTY", "Empty user message");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const body = {
    contents: buildContents(history, userMessage),
    systemInstruction: {
      parts: [
        {
          text: buildSystemInstruction({
            language,
            movieGenres,
            tvGenres,
            offTopicReply,
          }),
        },
      ],
    },
    generationConfig: {
      temperature: 0.85,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
      responseMimeType: "text/plain",
      // gemini-2.5-flash varsayılan olarak "thinking" yapar ve bu çıktı
      // token bütçesini tüketir. Uzun sistem prompt'u + geçmişle birlikte
      // model bazen tüm bütçeyi düşünmede harcayıp BOŞ yanıt (MAX_TOKENS)
      // dönebiliyor. Öneri sohbeti için düşünmeyi kapatıyoruz → hem daha
      // hızlı hem de boş-yanıt tuzağı ortadan kalkıyor.
      thinkingConfig: { thinkingBudget: 0 },
    },
    // Öneri asistanı için katı engellemeleri gevşetiyoruz (film konuları
    // bazen şiddet/korku temalı olabilir; yine de "BLOCK_ONLY_HIGH").
    safetySettings: [
      "HARM_CATEGORY_HARASSMENT",
      "HARM_CATEGORY_HATE_SPEECH",
      "HARM_CATEGORY_SEXUALLY_EXPLICIT",
      "HARM_CATEGORY_DANGEROUS_CONTENT",
    ].map((category) => ({ category, threshold: "BLOCK_ONLY_HIGH" })),
  };

  // AbortController ile timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    let data;
    try {
      data = await postOnce(url, body, controller.signal);
    } catch (err) {
      // Geçici hatalarda (network / 5xx) tek retry
      const retryable =
        err instanceof GeminiError &&
        (err.code === "NETWORK" || err.transient === true);
      if (!retryable) throw err;
      await sleep(800);
      data = await postOnce(url, body, controller.signal);
    }
    return parseResponse(data);
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Yanıt sonrası yardımcılar ───────────────────────────────────────────────

/**
 * Yanıttan <MOVIE: ...> ve <SERIES: ...> başlıklarını ayıklar.
 * @returns {{ movies: string[], series: string[] }}
 */
export function extractTitles(text) {
  if (!text) return { movies: [], series: [] };

  const grab = (re) =>
    Array.from(
      new Set(
        (text.match(re) || []).map((m) =>
          m
            .replace(/^<(MOVIE|SERIES):\s*/i, "")
            .replace(/>$/, "")
            .trim(),
        ),
      ),
    ).filter(Boolean);

  return {
    movies: grab(/<MOVIE:\s*([^>]+)>/gi),
    series: grab(/<SERIES:\s*([^>]+)>/gi),
  };
}

/**
 * Ham yanıtı markdown gösterimine hazırlar:
 *   <MOVIE: X> / <SERIES: X> → **X** (kalın),
 *   satır sonlarını normalize eder, fazla boşlukları kırpar.
 */
export function formatForMarkdown(text) {
  if (!text) return text;
  return text
    .replace(/<MOVIE:\s*([^>]+)>/gi, "**$1**")
    .replace(/<SERIES:\s*([^>]+)>/gi, "**$1**")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
