// scripts/ai-eval/lib/providers.js
//
// Aynı istemi (sistem talimatı + geçmiş + kullanıcı mesajı) farklı sağlayıcılara
// gönderir. Gemini ayarları functions/aiProxy.js'teki buildGenerateBody ile BİREBİR
// aynıdır (cine modu); değiştirirsen ikisini birlikte güncelle.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Geçici hatalarda (429/5xx/ağ) artan beklemeyle yeniden dener. */
export async function withRetry(fn, { attempts = 3, baseMs = 1500, sleepImpl = sleep } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err?.status;
      const transient = err?.transient || status === 429 || (status >= 500 && status < 600);
      if (!transient || i === attempts - 1) break;
      await sleepImpl(baseMs * 2 ** i * (status === 429 ? 2 : 1));
    }
  }
  throw lastErr;
}

export async function callGemini({
  apiKey,
  apiModel,
  system,
  history = [],
  userMessage,
  maxOutputTokens = 1800,
  fetchImpl = fetch,
  timeoutMs = 60000,
}) {
  const contents = [
    ...history.map((m) => ({
      role: m.role === "assistant" || m.role === "model" ? "model" : "user",
      parts: [{ text: m.text }],
    })),
    { role: "user", parts: [{ text: userMessage }] },
  ];
  const body = {
    contents,
    systemInstruction: { parts: [{ text: system }] },
    generationConfig: {
      temperature: 0.8,
      topP: 0.95,
      topK: 40,
      maxOutputTokens,
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
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  let res;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      // Anahtar URL'de değil başlıkta: hata günlüklerine sızmasın.
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    const e = new Error(err?.name === "AbortError" ? "UPSTREAM_TIMEOUT" : "UPSTREAM_NETWORK");
    e.transient = true;
    throw e;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const e = new Error(`Gemini HTTP ${res.status}: ${detail.slice(0, 200)}`);
    e.status = res.status;
    throw e;
  }
  const data = await res.json();
  const candidate = data?.candidates?.[0];
  const text = (candidate?.content?.parts || []).map((p) => p?.text || "").join("").trim();
  const u = data?.usageMetadata || {};
  return {
    text,
    finishReason: candidate?.finishReason || (data?.promptFeedback?.blockReason ? "BLOCKED" : "NONE"),
    usage: {
      input: u.promptTokenCount || 0,
      output: u.candidatesTokenCount || 0,
      thoughts: u.thoughtsTokenCount || 0,
    },
    latencyMs: Date.now() - started,
  };
}

/**
 * @param {object} p
 * @param {object} p.client  `new Anthropic()` (ANTHROPIC_API_KEY ortamdan okunur)
 * @param {"disabled"|"adaptive"} [p.thinking]
 * @param {string} [p.effort]
 */
export async function callClaude({
  client,
  apiModel,
  system,
  history = [],
  userMessage,
  maxOutputTokens = 1800,
  thinking = "disabled",
  effort,
}) {
  const messages = history.map((m) => ({
    role: m.role === "assistant" || m.role === "model" ? "assistant" : "user",
    content: m.text,
  }));
  while (messages.length && messages[0].role !== "user") messages.shift(); // ilk mesaj user olmalı
  messages.push({ role: "user", content: userMessage });

  // Haiku 5.5: varsayılan dışı temperature/top_p/top_k 400 verir → hiçbiri gönderilmez.
  // Asistan ön doldurması (prefill) de kaldırıldı → JSON yalnız talimatla istenir
  // (Gemini'nin responseMimeType'ından farklı olarak ek bir kısıt yoktur).
  const params = {
    model: apiModel,
    max_tokens: maxOutputTokens,
    system,
    messages,
    thinking: { type: thinking },
  };
  if (effort) params.output_config = { effort };

  const started = Date.now();
  let res;
  try {
    res = await client.messages.create(params);
  } catch (err) {
    if (err?.status === 529) err.transient = true;
    throw err;
  }
  const text = (res.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  const u = res.usage || {};
  return {
    text,
    finishReason: res.stop_reason || "NONE",
    usage: {
      input:
        (u.input_tokens || 0) +
        (u.cache_creation_input_tokens || 0) +
        (u.cache_read_input_tokens || 0),
      output: u.output_tokens || 0, // düşünme token'ları da burada sayılır
      thoughts: 0,
    },
    latencyMs: Date.now() - started,
  };
}

/** Model kimliğine göre doğru sağlayıcıyı çağırır. */
export function makeCaller(modelCfg, { geminiKey, anthropicClient, fetchImpl } = {}) {
  if (modelCfg.provider === "gemini") {
    if (!geminiKey) throw new Error("GEMINI_API_KEY tanımlı değil");
    return (req) => callGemini({ apiKey: geminiKey, apiModel: modelCfg.apiModel, fetchImpl, ...req });
  }
  if (modelCfg.provider === "anthropic") {
    if (!anthropicClient) throw new Error("ANTHROPIC_API_KEY tanımlı değil");
    return (req) =>
      callClaude({
        client: anthropicClient,
        apiModel: modelCfg.apiModel,
        thinking: modelCfg.thinking,
        effort: modelCfg.effort,
        ...req,
      });
  }
  throw new Error(`Bilinmeyen sağlayıcı: ${modelCfg.provider}`);
}
