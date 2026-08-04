// services/geminiService.js
//
// Seelogd yapay zeka asistanı ("CineMatch") için merkezi Gemini servisi.
//
// ⚠️ GÜVENLİK (Faz 0 — yayın blokeri çözümü): Gemini API anahtarı ARTIK
// istemcide DEĞİL. Tüm istekler `callGemini` Cloud Function proxy'sinden
// geçer (functions/index.js); anahtar yalnız sunucuda (Secret Manager) durur
// ve kullanıcı başına GÜNLÜK kota sunucuda uygulanır (AiUsage/{uid}).
//
// Sorumluluklar:
//   - Güçlü, yapılandırılmış sistem prompt'u üretmek (kullanıcı zevk profili dahil)
//   - Konuşma geçmişini proxy'ye gidecek sade {role, text} dizisine çevirmek (HAFIZA)
//   - callGemini callable'ını çağırmak ve hatalarını GeminiError koduna eşlemek
//   - Yanıtı savunmacı şekilde parse etmek (güvenlik bloğu, boş candidate, MAX_TOKENS)
//   - Yanıttan film/dizi başlıklarını ayıklamak ve markdown'a hazırlamak
//
// Bu modül React'tan bağımsızdır (saf JS) — test edilebilir ve UI'dan ayrıktır.
// (firebase bağımlılığı yalnız çağrı anında lazy-require edilir.)

export const GEMINI_MODEL = "gemini-2.5-flash";
export const GEMINI_TIMEOUT_MS = 30000;

// API'ye gönderilecek azami mesaj sayısı (6 gidiş-geliş). Token şişmesini önler.
export const MAX_HISTORY_MESSAGES = 12;

// ── Maliyet analizi ───────────────────────────────────────────────────────────
// gemini-2.5-flash fiyatlandırması (USD / 1.000.000 token).
// ⚠️ Bunlar referans değerlerdir; KENDİ Google AI / Vertex faturanıza göre
// güncelleyin. Güncel fiyat: https://ai.google.dev/gemini-api/docs/pricing
export const GEMINI_PRICING = {
  inputPerMillion: 0.30,   // giriş (prompt) token'ı başına
  outputPerMillion: 2.50,  // çıkış (yanıt + düşünme) token'ı başına
};

/**
 * Tipli Gemini hatası. `code` UI tarafında lokalize hata mesajına eşlenir.
 * code ∈ NO_API_KEY | NETWORK | TIMEOUT | RATE_LIMIT | QUOTA | AUTH |
 *        BLOCKED | EMPTY | API_ERROR
 * (QUOTA = günlük AI hakkı bitti; AUTH = oturum yok/geçersiz.)
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

/**
 * API anahtarını console'da göstermek için maskeler (sızıntı riskini azaltır).
 * Başındaki 6 + sonundaki 4 karakter + uzunluk gösterilir → hangi anahtar
 * olduğunu doğrulamaya yeter ama tamamını ifşa etmez.
 */
export function maskKey(key) {
  if (key === undefined || key === null || key === "") return "(BOŞ / TANIMSIZ)";
  const k = String(key);
  if (k.length <= 12) return `${k.slice(0, 3)}…(${k.length} karakter)`;
  return `${k.slice(0, 6)}…${k.slice(-4)} (${k.length} karakter)`;
}

/**
 * Bir HTTP hata gövdesini (Gemini JSON formatı) ayrıntılı, okunaklı biçimde
 * console'a yazar. Hem çağıran katmanlar hem de teşhis için.
 */
export function logHttpError(status, statusText, rawBody, { model, keyMask } = {}) {
  let parsed = null;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    /* düz metin olabilir */
  }
  const e = parsed?.error || {};
  const lines = [
    `[Gemini] ❌ HTTP ${status}${statusText ? " " + statusText : ""}`,
    model ? `  • model:   ${model}` : null,
    keyMask ? `  • anahtar: ${keyMask}` : null,
    `  • code:    ${e.code ?? status}`,
    `  • status:  ${e.status ?? "-"}`,
    `  • message: ${e.message ?? (rawBody || "-")}`,
    Array.isArray(e.details) && e.details.length
      ? `  • details: ${JSON.stringify(e.details)}`
      : null,
  ].filter(Boolean);
  console.warn(lines.join("\n"));
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
    `ROLE: You are "CineMatch", a warm and knowledgeable film & TV companion living inside the Seelogd app. You help users discover what to watch next and answer questions about movies and series.`,

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

// ── Ağ katmanı: callGemini Cloud Function proxy'si ─────────────────────────
// Doğrudan Gemini HTTP çağrısı KALDIRILDI (anahtar istemcide tutulamaz).
// Retry/timeout üst akış tarafında (functions/index.js) yapılır.

export const CALLABLE_TIMEOUT_MS = 75000; // sunucu tavanı 70 sn + pay

/**
 * Geçmişi proxy'ye gidecek sade [{role, text}] biçimine indirger.
 * (UI mesaj nesnelerindeki cards/posterMap gibi ağır alanları taşımayız.)
 */
export function sanitizeHistory(history = []) {
  return (Array.isArray(history) ? history : [])
    .slice(-MAX_HISTORY_MESSAGES)
    .filter((m) => m && typeof m.text === "string" && m.text.trim() !== "")
    .map((m) => ({
      role: m.role === "assistant" || m.role === "model" ? "model" : "user",
      text: m.text,
    }));
}

/** Firebase callable hatasını tipli GeminiError'a çevirir. */
function mapCallableError(err) {
  const code = String(err?.code || ""); // örn. "functions/resource-exhausted"
  const details = err?.details;

  if (code.endsWith("resource-exhausted")) {
    if (details?.reason === "DAILY_QUOTA" || details?.reason === "MONTHLY_QUOTA") {
      const e = new GeminiError(
        details.reason === "MONTHLY_QUOTA" ? "MONTHLY_QUOTA" : "QUOTA",
        details.reason === "MONTHLY_QUOTA"
          ? `Monthly AI quota exceeded (${details.monthly?.used}/${details.monthly?.limit})`
          : `Daily AI quota exceeded (${details.daily?.used ?? details.used}/${details.daily?.limit ?? details.limit})`,
      );
      e.quota = details;
      return e;
    }
    return new GeminiError("RATE_LIMIT", "Rate limited by server");
  }
  if (code.endsWith("deadline-exceeded")) {
    return new GeminiError("TIMEOUT", "Proxy request timed out", { cause: err });
  }
  if (code.endsWith("unauthenticated")) {
    return new GeminiError("AUTH", "Sign-in required for AI chat", { cause: err });
  }
  if (code.endsWith("failed-precondition")) {
    // Sunucuda GEMINI_API_KEY secret'ı tanımsız.
    return new GeminiError("NO_API_KEY", "AI is not configured on server");
  }
  if (code.endsWith("unavailable")) {
    const e = new GeminiError("API_ERROR", "AI service unavailable", { cause: err });
    e.transient = true;
    return e;
  }
  // Callable'a hiç ulaşılamadı (uçak modu vb.) → FirebaseError "internal"
  // ya da düz fetch TypeError'ı olarak gelir.
  const msg = String(err?.message || "");
  if (!code || /network|fetch|internet|ECONN|timeout/i.test(msg)) {
    return new GeminiError("NETWORK", msg || "Network request failed", { cause: err });
  }
  return new GeminiError("API_ERROR", msg || code, { cause: err });
}

/**
 * callGemini Cloud Function'ını çağırır ve HAM Gemini yanıt gövdesini döndürür
 * (candidates/usageMetadata...). Parse, çağıran katmanda (parseResponse /
 * parseCineResponse) yapılır — eski davranışla birebir aynı.
 *
 * @param {object} opts
 * @param {"chat"|"cine"} opts.mode - text/plain sohbet | JSON (CineMatch Pro)
 * @param {Array}  [opts.history]  - [{role, text}] (sanitizeHistory'den geçmiş)
 * @param {string} opts.userMessage
 * @param {string} opts.systemInstruction
 * @returns {Promise<object>} Gemini generateContent yanıtı
 * @throws {GeminiError}
 */
export async function callGeminiProxy({
  mode,
  history = [],
  userMessage,
  systemInstruction,
  onQuota,
}) {
  let call;
  try {
    // Lazy require: bu modül saf JS kalsın (testler firebase'i yüklemesin).
    // eslint-disable-next-line global-require
    const { fns } = require("../firebase");
    // eslint-disable-next-line global-require
    const { httpsCallable } = require("firebase/functions");
    call = httpsCallable(fns, "callGemini", { timeout: CALLABLE_TIMEOUT_MS });
  } catch (err) {
    throw new GeminiError("API_ERROR", "Cloud Functions başlatılamadı", { cause: err });
  }

  let result;
  try {
    result = await call({ mode, history, userMessage, systemInstruction });
  } catch (err) {
    throw mapCallableError(err);
  }

  const data = result?.data?.data;
  if (!data) {
    throw new GeminiError("EMPTY", "Proxy boş yanıt döndürdü");
  }
  const quota = result?.data?.quota;
  if (quota) {
    onQuota?.(quota);
    const daily = quota.daily || quota;
    const monthly = quota.monthly;
    console.log(
      `[callGemini] 📊 AI kota: günlük ${daily.used}/${daily.limit}` +
        (monthly ? ` · aylık ${monthly.used}/${monthly.limit}` : ""),
    );
  }
  return data;
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

// ── Token & maliyet ───────────────────────────────────────────────────────────

/**
 * Gemini yanıtındaki `usageMetadata`'dan token sayımlarını çıkarır.
 * @returns {{ promptTokens:number, outputTokens:number, thoughtsTokens:number, totalTokens:number }}
 */
export function extractUsage(data) {
  const u = data?.usageMetadata || {};
  const promptTokens = u.promptTokenCount || 0;
  const outputTokens = u.candidatesTokenCount || 0;
  const thoughtsTokens = u.thoughtsTokenCount || 0; // "thinking" token'ları (varsa)
  const totalTokens =
    u.totalTokenCount || promptTokens + outputTokens + thoughtsTokens;
  return { promptTokens, outputTokens, thoughtsTokens, totalTokens };
}

/**
 * Token sayımından tahmini USD maliyet hesaplar. Düşünme token'ları çıkış
 * olarak faturalanır.
 * @returns {{ inputCost:number, outputCost:number, totalCost:number }}
 */
export function estimateCost({ promptTokens = 0, outputTokens = 0, thoughtsTokens = 0 } = {}) {
  const inputCost = (promptTokens / 1e6) * GEMINI_PRICING.inputPerMillion;
  const outputCost =
    ((outputTokens + thoughtsTokens) / 1e6) * GEMINI_PRICING.outputPerMillion;
  return { inputCost, outputCost, totalCost: inputCost + outputCost };
}

/** Token kullanımı + tahmini maliyeti console'a okunaklı biçimde yazar. */
export function logUsage(data) {
  const usage = extractUsage(data);
  const cost = estimateCost(usage);
  console.log(
    `[CineMatch/Gemini] 🎯 Token — giriş: ${usage.promptTokens} | ` +
      `çıkış: ${usage.outputTokens}` +
      (usage.thoughtsTokens ? ` | düşünme: ${usage.thoughtsTokens}` : "") +
      ` | toplam: ${usage.totalTokens}  💰 Tahmini maliyet: $${cost.totalCost.toFixed(6)} ` +
      `(giriş $${cost.inputCost.toFixed(6)} + çıkış $${cost.outputCost.toFixed(6)})`,
  );
  return { usage, cost };
}

/**
 * Asistana bir mesaj gönderir ve düz metin yanıtı döndürür.
 * İstek `callGemini` Cloud Function proxy'sinden geçer — istemcide API
 * anahtarı YOKTUR; günlük kota sunucuda uygulanır.
 *
 * @param {object} opts
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
  history = [],
  userMessage,
  language = "en",
  movieGenres = [],
  tvGenres = [],
  offTopicReply,
} = {}) {
  if (!userMessage || userMessage.trim() === "") {
    throw new GeminiError("EMPTY", "Empty user message");
  }

  console.log(
    `[CineMatch/Gemini] ➜ İstek | model: ${GEMINI_MODEL} | proxy: callGemini (anahtar sunucuda)`,
  );

  const data = await callGeminiProxy({
    mode: "chat",
    history: sanitizeHistory(history),
    userMessage,
    systemInstruction: buildSystemInstruction({
      language,
      movieGenres,
      tvGenres,
      offTopicReply,
    }),
  });

  // Maliyet analizi: token kullanımı + tahmini ücreti console'a yaz.
  // (parseResponse'tan ÖNCE — boş/engellenmiş yanıtta bile prompt token'ları
  //  faturalanır, görmek isteriz.)
  const { usage, cost } = logUsage(data);
  return { ...parseResponse(data), usage, cost };
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
