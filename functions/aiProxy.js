"use strict";

// callGemini'nin Firestore'suz çekirdeği: girdi doğrulama/normalizasyon, Gemini
// isteği (deneme başına zaman aşımı, toplam süre bütçesi, yedek model), yanıt
// doğrulama ve istemciye dönen sade gövde. Kimlik, kota ve iade index.js'tedir.
// Testler emülatörsüz çalışır: aiProxy.test.js.
//
// İstemci aynası: services/geminiService.js (AI_REQUEST_LIMITS, MAX_HISTORY_MESSAGES).
// Eşitliği __tests__/aiRequestLimits.test.js doğrular.

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

const AI_MODEL = "gemini-2.5-flash";
// İkinci deneme bu modelle yapılır. Birincil model aşırı yük (503), proje kotası
// (429) ya da emeklilik (404) verdiğinde aynı modeli hemen yeniden denemek çoğu
// zaman yine düşer; Flash-Lite ayrı kota havuzunda, aynı istem ve JSON
// sözleşmesiyle çalışır. Yedek istenmiyorsa AI_MODEL ile aynı yap.
const AI_FALLBACK_MODEL = "gemini-2.5-flash-lite";

const AI_LIMITS = Object.freeze({
  maxHistory: 12, // geçmişten alınan son mesaj sayısı
  maxMessageChars: 4000, // bu turdaki kullanıcı mesajı (aşan REDDEDİLİR)
  maxHistoryMessageChars: 8000, // geçmişteki tek mesaj (aşan KIRPILIR)
  maxHistoryTotalChars: 24000, // geçmiş toplamı (aşınca en eski turlar düşer)
  maxSystemChars: 24000, // sistem talimatı (kütüphane özeti dahil)
});

const AI_ATTEMPT_TIMEOUT_MS = 25000;
// İki deneme + bekleme bu bütçeye sığar: callable tavanı 70 sn, kota/iade
// işlemleri ve soğuk başlangıç için pay kalır.
const AI_TOTAL_BUDGET_MS = 55000;
// Bütçede bundan az süre kaldıysa ikinci deneme yapılmaz (yarım kalır, hak boşa gider).
const AI_MIN_ATTEMPT_MS = 5000;
const AI_RETRY_DELAY_MS = 600;

const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
// Bu nedenlerle biten yanıt kullanıcının içeriği yüzünden engellenmiştir: hak
// iade edilmez, yeniden denenmez (aynı istem aynı sonucu verir).
const BLOCK_FINISH_REASONS = new Set([
  "SAFETY",
  "RECITATION",
  "PROHIBITED_CONTENT",
  "BLOCKLIST",
  "SPII",
  "IMAGE_SAFETY",
]);

/** İstemciye HttpsError olarak dönecek hata (index.js çevirir). */
class AiProxyError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = "AiProxyError";
    this.code = code;
    if (details) this.details = details;
  }
}

/**
 * Gemini çağrısı hatası. kind ∈ timeout | network | http | empty.
 * `transient`: aynı istek az sonra geçebilir. `fallbackable`: yedek modelle
 * denemeye değer (404 = birincil model emekli/yanlış ad).
 */
class UpstreamError extends Error {
  constructor(kind, { status, model } = {}) {
    super(kind === "http" ? `UPSTREAM_${status}` : `UPSTREAM_${String(kind).toUpperCase()}`);
    this.name = "UpstreamError";
    this.kind = kind;
    this.status = status;
    this.model = model;
    this.transient = kind !== "http" || TRANSIENT_STATUSES.has(status);
    this.fallbackable = this.transient || status === 404;
  }
}

const roleOf = (role) => (role === "assistant" || role === "model" ? "model" : "user");

function clampText(text, max) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/**
 * İstemciden gelen geçmişi Gemini `contents` dizisine çevirir.
 *  - Son `maxHistory` mesaj alınır; metni olmayanlar atlanır.
 *  - Uzun mesaj REDDEDİLMEZ, kırpılır: geçmiş istemcinin elinde olmayan model
 *    çıktısını da içerir, tek uzun cevap sohbeti kalıcı olarak kilitlememeli.
 *  - Ardışık aynı roller birleşir (hatalı cevap ayıklanınca iki kullanıcı turu
 *    yan yana kalır).
 *  - Toplam tavan aşılınca EN ESKİ turlar düşer; bu turdaki mesaj hep kalır.
 */
function buildAiContents(history, userMessage) {
  const recent = Array.isArray(history) ? history.slice(-AI_LIMITS.maxHistory) : [];
  const turns = [];
  for (const m of recent) {
    if (!m || typeof m.text !== "string" || m.text.trim() === "") continue;
    const text = clampText(m.text, AI_LIMITS.maxHistoryMessageChars);
    const role = roleOf(m.role);
    const last = turns[turns.length - 1];
    if (last && last.role === role) last.text = `${last.text}\n\n${text}`;
    else turns.push({ role, text });
  }

  let budget = AI_LIMITS.maxHistoryTotalChars;
  const kept = [];
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    budget -= turns[i].text.length;
    if (budget < 0) break;
    kept.unshift(turns[i]);
  }

  const last = kept[kept.length - 1];
  if (last && last.role === "user") {
    last.text = `${last.text}\n\n${userMessage}`;
  } else {
    kept.push({ role: "user", text: userMessage });
  }
  return kept.map(({ role, text }) => ({ role, parts: [{ text }] }));
}

/** callGemini girdisini doğrular; geçersizse Gemini'ye gitmeden reddeder. */
function parseAiRequest(data) {
  const { mode, history, userMessage, systemInstruction } = data || {};
  if (mode !== "chat" && mode !== "cine") {
    throw new AiProxyError("invalid-argument", "mode must be 'chat' or 'cine'");
  }
  if (typeof userMessage !== "string" || userMessage.trim() === "") {
    throw new AiProxyError("invalid-argument", "userMessage required");
  }
  if (userMessage.length > AI_LIMITS.maxMessageChars) {
    throw new AiProxyError("invalid-argument", "userMessage too long", { reason: "MESSAGE_TOO_LONG" });
  }
  if (typeof systemInstruction !== "string" || systemInstruction.trim() === "") {
    throw new AiProxyError("invalid-argument", "systemInstruction required");
  }
  if (systemInstruction.length > AI_LIMITS.maxSystemChars) {
    throw new AiProxyError("invalid-argument", "systemInstruction too long", { reason: "PROMPT_TOO_LONG" });
  }
  return { mode, systemInstruction, contents: buildAiContents(history, userMessage) };
}

/** generateContent gövdesi. scripts/ai-eval/lib/providers.js aynı ayarları kullanır. */
function buildGenerateBody({ mode, contents, systemInstruction }) {
  return {
    contents,
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: mode === "cine" ? 0.8 : 0.85,
      topP: 0.95,
      topK: 40,
      // CineMatch yalnız kompakt JSON döndürür; düz sohbet biraz daha geniş kalır.
      // Cine tavanı: ayrıntılı üslup + 10 öğe (8 ayarı + filtre payı) 1200'de
      // kesiliyordu; istemci kesik JSON'u onarır (repairTruncatedJSON) ama
      // tavan sonuca yetmeli. Ücret yalnız üretilen token kadar artar.
      maxOutputTokens: mode === "cine" ? 1800 : 2048,
      responseMimeType: mode === "cine" ? "application/json" : "text/plain",
      thinkingConfig: { thinkingBudget: 0 },
    },
    safetySettings: [
      "HARM_CATEGORY_HARASSMENT",
      "HARM_CATEGORY_HATE_SPEECH",
      "HARM_CATEGORY_SEXUALLY_EXPLICIT",
      "HARM_CATEGORY_DANGEROUS_CONTENT",
    ].map((category) => ({ category, threshold: "BLOCK_ONLY_HIGH" })),
  };
}

/**
 * Tek generateContent isteği. Anahtar URL'de değil `x-goog-api-key` başlığında
 * gider: URL hata/erişim günlüklerine düşebilir. Zaman aşımı gövde okunurken de
 * geçerlidir (yanıt başlığı gelip gövde takılırsa istek asılı kalmasın).
 */
async function postGenerateContent({ model, body, apiKey, timeoutMs, fetchImpl = fetch, log = console }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      let detail = "";
      try {
        detail = await res.text();
      } catch {
        /* yoksay */
      }
      log.warn(`[callGemini] ${model} HTTP ${res.status}: ${String(detail).slice(0, 500)}`);
      throw new UpstreamError("http", { status: res.status, model });
    }
    return await res.json();
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    // AbortError = zaman aşımı; geri kalanı (DNS, bağlantı koptu, bozuk JSON) ağ hatası.
    throw new UpstreamError(err?.name === "AbortError" ? "timeout" : "network", { model });
  } finally {
    clearTimeout(timer);
  }
}

/** İlk adayın düşünce DIŞI metni ve bitiş nedeni. */
function readCandidate(data) {
  const candidate = Array.isArray(data?.candidates) ? data.candidates[0] || null : null;
  const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
  const text = parts
    .filter((p) => p && p.thought !== true && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
  return { candidate, text, finishReason: candidate?.finishReason || null };
}

/** "ok" | "blocked" (kullanıcı içeriği; hak harcanır) | "empty" (model boş döndü; yeniden denenir). */
function classifyResponse(data) {
  if (data?.promptFeedback?.blockReason) return "blocked";
  const { candidate, text, finishReason } = readCandidate(data);
  if (candidate && BLOCK_FINISH_REASONS.has(finishReason)) return "blocked";
  if (!text.trim()) return "empty";
  return "ok";
}

const tokenCount = (v) => (Number.isFinite(v) && v >= 0 ? v : 0);

/**
 * İstemciye dönen sade gövde. Şekil Gemini yanıtıyla aynıdır (eski istemciler
 * `candidates[0].content.parts` okur); düşünce parçaları, güvenlik puanları ve
 * iç alanlar taşınmaz.
 */
function slimResponse(data, model) {
  const { candidate, text, finishReason } = readCandidate(data);
  const u = data?.usageMetadata || {};
  const out = {
    candidates: candidate
      ? [{ content: { role: "model", parts: text ? [{ text }] : [] }, finishReason }]
      : [],
    usageMetadata: {
      promptTokenCount: tokenCount(u.promptTokenCount),
      candidatesTokenCount: tokenCount(u.candidatesTokenCount),
      thoughtsTokenCount: tokenCount(u.thoughtsTokenCount),
      totalTokenCount: tokenCount(u.totalTokenCount),
    },
    modelVersion: typeof data?.modelVersion === "string" ? data.modelVersion : model,
  };
  const blockReason = data?.promptFeedback?.blockReason;
  if (blockReason) out.promptFeedback = { blockReason: String(blockReason) };
  return out;
}

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

function attemptModels() {
  return AI_FALLBACK_MODEL && AI_FALLBACK_MODEL !== AI_MODEL
    ? [AI_MODEL, AI_FALLBACK_MODEL]
    : [AI_MODEL, AI_MODEL];
}

/**
 * Birincil modeli dener; geçici hata, boş yanıt ya da 404'te (bütçe yetiyorsa)
 * yedek modelle bir kez daha dener. Kalıcı hatada (400/401/403…) hemen düşer.
 *
 * @returns {Promise<{ data, model, verdict, attempts }>} data = slimResponse
 * @throws {UpstreamError} son denemenin hatası; `attempts` eklenmiş olarak
 */
async function generateWithFallback({
  body,
  apiKey,
  fetchImpl = fetch,
  sleep = defaultSleep,
  now = Date.now,
  models = attemptModels(),
  log = console,
}) {
  const started = now();
  const attempts = [];
  let lastError = null;
  for (let i = 0; i < models.length; i += 1) {
    const model = models[i];
    if (i > 0) {
      const remaining = AI_TOTAL_BUDGET_MS - (now() - started);
      if (remaining < AI_RETRY_DELAY_MS + AI_MIN_ATTEMPT_MS) break;
      await sleep(AI_RETRY_DELAY_MS);
    }
    const timeoutMs = Math.min(AI_ATTEMPT_TIMEOUT_MS, AI_TOTAL_BUDGET_MS - (now() - started));
    try {
      const raw = await postGenerateContent({ model, body, apiKey, timeoutMs, fetchImpl, log });
      const verdict = classifyResponse(raw);
      attempts.push({ model, outcome: verdict });
      if (verdict === "empty") {
        lastError = new UpstreamError("empty", { model });
        continue;
      }
      return { data: slimResponse(raw, model), model, verdict, attempts };
    } catch (err) {
      if (!(err instanceof UpstreamError)) throw err;
      attempts.push({ model, outcome: err.kind, status: err.status });
      lastError = err;
      if (!err.fallbackable) break;
    }
  }
  lastError.attempts = attempts;
  throw lastError;
}

/** Üst akış hatasını istemcinin tanıdığı callable hatasına çevirir (bkz. geminiService.mapCallableError). */
function toClientError(err) {
  if (err instanceof UpstreamError) {
    if (err.kind === "http" && err.status === 429) {
      return new AiProxyError("resource-exhausted", "Upstream rate limited", { reason: "UPSTREAM_RATE_LIMIT" });
    }
    if (err.kind === "timeout") return new AiProxyError("deadline-exceeded", "Upstream timeout");
    if (err.kind === "empty") {
      return new AiProxyError("unavailable", "Empty model response", { reason: "EMPTY_RESPONSE" });
    }
    if (err.transient) return new AiProxyError("unavailable", "Upstream unavailable");
  }
  return new AiProxyError("internal", "AI request failed");
}

/** Günlük satırı için deneme özeti: "gemini-2.5-flash:http503 → gemini-2.5-flash-lite:ok". */
function describeAttempts(attempts) {
  return (attempts || [])
    .map((a) => `${a.model}:${a.outcome}${a.status ? a.status : ""}`)
    .join(" → ");
}

module.exports = {
  AI_MODEL,
  AI_FALLBACK_MODEL,
  AI_LIMITS,
  AI_ATTEMPT_TIMEOUT_MS,
  AI_TOTAL_BUDGET_MS,
  AiProxyError,
  UpstreamError,
  buildAiContents,
  parseAiRequest,
  buildGenerateBody,
  postGenerateContent,
  readCandidate,
  classifyResponse,
  slimResponse,
  generateWithFallback,
  toClientError,
  describeAttempts,
};
