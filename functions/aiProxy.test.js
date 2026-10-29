// callGemini çekirdeği (aiProxy.js) — emülatörsüz, sahte fetch ile.
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  AI_MODEL,
  AI_FALLBACK_MODEL,
  AI_LIMITS,
  AI_TOTAL_BUDGET_MS,
  AiProxyError,
  UpstreamError,
  buildAiContents,
  parseAiRequest,
  buildGenerateBody,
  postGenerateContent,
  classifyResponse,
  slimResponse,
  generateWithFallback,
  toClientError,
} = require("./aiProxy");

const quiet = { warn() {} };
const okBody = (text = '{"type":"general","content":"selam"}', extra = {}) => ({
  candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }],
  usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
  ...extra,
});
const reply = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

/** Sıradaki yanıtları dönen sahte fetch; her çağrıyı kaydeder. */
function scriptedFetch(steps) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const step = steps[Math.min(calls.length - 1, steps.length - 1)];
    if (step instanceof Error) throw step;
    return typeof step === "function" ? step(url, init) : step;
  };
  return { fetchImpl, calls };
}

const noSleep = async () => {};
const ai = (extra = {}) => ({ mode: "cine", userMessage: "öner", systemInstruction: "sistem", ...extra });

test("parseAiRequest: geçersiz girdi Gemini'ye gitmeden reddedilir", () => {
  const code = (data) => {
    try {
      parseAiRequest(data);
      return "ok";
    } catch (e) {
      assert.ok(e instanceof AiProxyError);
      return e.code;
    }
  };
  assert.equal(code(ai()), "ok");
  assert.equal(code(null), "invalid-argument");
  assert.equal(code(ai({ mode: "free-text" })), "invalid-argument");
  assert.equal(code(ai({ userMessage: "   " })), "invalid-argument");
  assert.equal(code(ai({ userMessage: "x".repeat(AI_LIMITS.maxMessageChars + 1) })), "invalid-argument");
  assert.equal(code(ai({ systemInstruction: "" })), "invalid-argument");
  assert.equal(code(ai({ systemInstruction: "x".repeat(AI_LIMITS.maxSystemChars + 1) })), "invalid-argument");
  // Sınırın tam üstü değil, tam kendisi geçer.
  assert.equal(code(ai({ systemInstruction: "x".repeat(AI_LIMITS.maxSystemChars) })), "ok");
});

test("buildAiContents: uzun geçmiş mesajı reddetmez, kırpar", () => {
  const long = "a".repeat(AI_LIMITS.maxHistoryMessageChars + 500);
  const contents = buildAiContents([{ role: "assistant", text: long }], "devam");
  assert.equal(contents.length, 2);
  assert.equal(contents[0].role, "model");
  assert.equal(contents[0].parts[0].text.length, AI_LIMITS.maxHistoryMessageChars);
  assert.ok(contents[0].parts[0].text.endsWith("…"));
});

test("buildAiContents: ardışık aynı roller birleşir, son kullanıcı turu bu mesajla birleşir", () => {
  const contents = buildAiContents(
    [
      { role: "user", text: "A" },
      { role: "assistant", text: "cevap" },
      { role: "user", text: "B (cevapsız kaldı)" },
    ],
    "C",
  );
  assert.deepEqual(
    contents.map((c) => [c.role, c.parts[0].text]),
    [
      ["user", "A"],
      ["model", "cevap"],
      ["user", "B (cevapsız kaldı)\n\nC"],
    ],
  );
});

test("buildAiContents: boş/bozuk öğeler atlanır, yalnız son maxHistory mesaj alınır", () => {
  const history = [null, { role: "user" }, { role: "user", text: "  " }, { role: "user", text: 5 }];
  for (let i = 0; i < 20; i += 1) history.push({ role: i % 2 ? "assistant" : "user", text: `m${i}` });
  const contents = buildAiContents(history, "son");
  // 20 mesajın son 12'si: m8..m19 + bu tur
  assert.equal(contents[0].parts[0].text, "m8");
  assert.equal(contents.length, 13);
  assert.equal(contents[contents.length - 1].parts[0].text, "son");
  assert.deepEqual(buildAiContents("bozuk", "x"), [{ role: "user", parts: [{ text: "x" }] }]);
});

test("buildAiContents: toplam tavan aşılınca en eski turlar düşer", () => {
  const chunk = "z".repeat(7000);
  const history = [];
  for (let i = 0; i < 6; i += 1) history.push({ role: i % 2 ? "assistant" : "user", text: `${i}${chunk}` });
  const contents = buildAiContents(history, "yeni");
  const total = contents.slice(0, -1).reduce((n, c) => n + c.parts[0].text.length, 0);
  assert.ok(total <= AI_LIMITS.maxHistoryTotalChars, `toplam ${total}`);
  assert.ok(contents.length < 7, "en eski turlar düşmeli");
  assert.ok(contents[contents.length - 2].parts[0].text.startsWith("5"), "en yeni geçmiş korunur");
});

test("postGenerateContent: anahtar URL'de değil başlıkta", async () => {
  const { fetchImpl, calls } = scriptedFetch([reply(okBody())]);
  await postGenerateContent({ model: AI_MODEL, body: {}, apiKey: "GIZLI", timeoutMs: 1000, fetchImpl, log: quiet });
  assert.ok(!calls[0].url.includes("GIZLI"));
  assert.ok(!calls[0].url.includes("key="));
  assert.equal(calls[0].init.headers["x-goog-api-key"], "GIZLI");
  assert.ok(calls[0].url.endsWith(`/${AI_MODEL}:generateContent`));
});

test("postGenerateContent: hata türleri sınıflanır", async () => {
  const run = (step) =>
    postGenerateContent({
      model: "m",
      body: {},
      apiKey: "k",
      timeoutMs: 1000,
      fetchImpl: scriptedFetch([step]).fetchImpl,
      log: quiet,
    }).catch((e) => e);

  const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
  assert.equal((await run(abort)).kind, "timeout");
  assert.equal((await run(new TypeError("fetch failed"))).kind, "network");
  const e503 = await run(reply({ error: {} }, 503));
  assert.equal(e503.kind, "http");
  assert.equal(e503.transient, true);
  const e400 = await run(reply({ error: {} }, 400));
  assert.equal(e400.transient, false);
  assert.equal(e400.fallbackable, false);
  const e404 = await run(reply({ error: {} }, 404));
  assert.equal(e404.transient, false);
  assert.equal(e404.fallbackable, true, "emekli birincil model yedekle denenmeli");
  const badJson = await run({ ok: true, status: 200, json: async () => { throw new SyntaxError("x"); } });
  assert.equal(badJson.kind, "network");
});

test("postGenerateContent: yanıt hiç gelmezse zaman aşımı istek asılı kalmadan düşer", async () => {
  const hang = (url, init) =>
    new Promise((_, reject) => {
      init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    });
  const err = await postGenerateContent({ model: "m", body: {}, apiKey: "k", timeoutMs: 20, fetchImpl: hang, log: quiet }).catch((e) => e);
  assert.equal(err.kind, "timeout");
});

test("classifyResponse: engel / boş / tamam", () => {
  assert.equal(classifyResponse(okBody()), "ok");
  assert.equal(classifyResponse({ promptFeedback: { blockReason: "SAFETY" } }), "blocked");
  assert.equal(classifyResponse({ candidates: [{ finishReason: "SAFETY", content: { parts: [] } }] }), "blocked");
  assert.equal(classifyResponse({ candidates: [{ finishReason: "PROHIBITED_CONTENT" }] }), "blocked");
  assert.equal(classifyResponse({ candidates: [] }), "empty");
  assert.equal(classifyResponse({}), "empty");
  assert.equal(classifyResponse({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [] } }] }), "empty");
  assert.equal(classifyResponse(okBody("   ")), "empty");
  // Yalnız düşünce parçası varsa kullanıcıya gösterilecek metin yoktur.
  assert.equal(
    classifyResponse({ candidates: [{ content: { parts: [{ text: "plan", thought: true }] }, finishReason: "STOP" }] }),
    "empty",
  );
});

test("slimResponse: istemci şekli korunur, düşünce ve iç alanlar taşınmaz", () => {
  const slim = slimResponse(
    {
      candidates: [
        {
          content: { parts: [{ text: "düşünce", thought: true }, { text: '{"a":' }, { text: "1}" }] },
          finishReason: "MAX_TOKENS",
          safetyRatings: [{ category: "X" }],
          citationMetadata: {},
        },
      ],
      usageMetadata: { promptTokenCount: 7, candidatesTokenCount: "bozuk", totalTokenCount: 9 },
      modelVersion: "gemini-2.5-flash-001",
      responseId: "iç",
    },
    AI_MODEL,
  );
  assert.deepEqual(slim, {
    candidates: [{ content: { role: "model", parts: [{ text: '{"a":1}' }] }, finishReason: "MAX_TOKENS" }],
    usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 0, thoughtsTokenCount: 0, totalTokenCount: 9 },
    modelVersion: "gemini-2.5-flash-001",
  });
  assert.deepEqual(slimResponse({ promptFeedback: { blockReason: "OTHER" } }, "m").promptFeedback, { blockReason: "OTHER" });
});

test("generateWithFallback: ilk deneme tutarsa tek istek", async () => {
  const { fetchImpl, calls } = scriptedFetch([reply(okBody())]);
  const r = await generateWithFallback({ body: {}, apiKey: "k", fetchImpl, sleep: noSleep, log: quiet });
  assert.equal(calls.length, 1);
  assert.equal(r.model, AI_MODEL);
  assert.equal(r.verdict, "ok");
});

test("generateWithFallback: 503'te yedek modelle ikinci deneme", async () => {
  const { fetchImpl, calls } = scriptedFetch([reply({}, 503), reply(okBody())]);
  const r = await generateWithFallback({ body: {}, apiKey: "k", fetchImpl, sleep: noSleep, log: quiet });
  assert.equal(calls.length, 2);
  assert.ok(calls[1].url.includes(`/${AI_FALLBACK_MODEL}:`));
  assert.equal(r.model, AI_FALLBACK_MODEL);
  assert.deepEqual(r.attempts.map((a) => a.outcome), ["http", "ok"]);
});

test("generateWithFallback: boş yanıt yeniden denenir; ikisi de boşsa 'empty' fırlar", async () => {
  const empty = reply({ candidates: [{ finishReason: "OTHER", content: { parts: [] } }] });
  const recovered = scriptedFetch([empty, reply(okBody())]);
  const ok = await generateWithFallback({ body: {}, apiKey: "k", fetchImpl: recovered.fetchImpl, sleep: noSleep, log: quiet });
  assert.equal(ok.verdict, "ok");

  const stuck = scriptedFetch([empty, empty]);
  const err = await generateWithFallback({ body: {}, apiKey: "k", fetchImpl: stuck.fetchImpl, sleep: noSleep, log: quiet }).catch((e) => e);
  assert.ok(err instanceof UpstreamError);
  assert.equal(err.kind, "empty");
  assert.equal(err.attempts.length, 2);
  assert.equal(toClientError(err).details.reason, "EMPTY_RESPONSE");
});

test("generateWithFallback: kalıcı hatada (400/403) ikinci deneme yapılmaz", async () => {
  for (const status of [400, 401, 403]) {
    const { fetchImpl, calls } = scriptedFetch([reply({}, status), reply(okBody())]);
    const err = await generateWithFallback({ body: {}, apiKey: "k", fetchImpl, sleep: noSleep, log: quiet }).catch((e) => e);
    assert.equal(calls.length, 1, `HTTP ${status}`);
    assert.equal(err.status, status);
    assert.equal(toClientError(err).code, "internal");
  }
});

test("generateWithFallback: engellenen yanıt kullanıcıya döner, yeniden denenmez", async () => {
  const { fetchImpl, calls } = scriptedFetch([reply({ promptFeedback: { blockReason: "SAFETY" } })]);
  const r = await generateWithFallback({ body: {}, apiKey: "k", fetchImpl, sleep: noSleep, log: quiet });
  assert.equal(calls.length, 1);
  assert.equal(r.verdict, "blocked");
  assert.equal(r.data.promptFeedback.blockReason, "SAFETY");
});

test("generateWithFallback: süre bütçesi bittiyse ikinci deneme yapılmaz", async () => {
  let clock = 0;
  const now = () => clock;
  const { fetchImpl, calls } = scriptedFetch([
    () => {
      clock = AI_TOTAL_BUDGET_MS - 1000; // ilk deneme bütçenin neredeyse hepsini yedi
      return reply({}, 503);
    },
    reply(okBody()),
  ]);
  const err = await generateWithFallback({ body: {}, apiKey: "k", fetchImpl, sleep: noSleep, now, log: quiet }).catch((e) => e);
  assert.equal(calls.length, 1);
  assert.equal(err.status, 503);
  assert.equal(toClientError(err).code, "unavailable");
});

test("generateWithFallback: ikinci denemenin zaman aşımı kalan bütçeyle sınırlı", async () => {
  let clock = 0;
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push(init.signal);
    if (seen.length === 1) {
      clock = AI_TOTAL_BUDGET_MS - 6000;
      return reply({}, 503);
    }
    return reply(okBody());
  };
  const timeouts = [];
  const realSetTimeout = global.setTimeout;
  global.setTimeout = (fn, ms, ...rest) => {
    timeouts.push(ms);
    return realSetTimeout(fn, ms, ...rest);
  };
  try {
    await generateWithFallback({ body: {}, apiKey: "k", fetchImpl, sleep: noSleep, now: () => clock, log: quiet });
  } finally {
    global.setTimeout = realSetTimeout;
  }
  assert.equal(timeouts[0], 25000);
  assert.equal(timeouts[1], 6000);
});

test("toClientError: istemcinin tanıdığı kodlar", () => {
  const up = (kind, status) => new UpstreamError(kind, { status, model: "m" });
  assert.deepEqual(
    { code: toClientError(up("http", 429)).code, reason: toClientError(up("http", 429)).details.reason },
    { code: "resource-exhausted", reason: "UPSTREAM_RATE_LIMIT" },
  );
  assert.equal(toClientError(up("timeout")).code, "deadline-exceeded");
  assert.equal(toClientError(up("network")).code, "unavailable");
  assert.equal(toClientError(up("http", 502)).code, "unavailable");
  assert.equal(toClientError(up("http", 400)).code, "internal");
  assert.equal(toClientError(new Error("x")).code, "internal");
});

test("buildGenerateBody: cine JSON, sohbet düz metin; düşünme kapalı", () => {
  const cine = buildGenerateBody({ mode: "cine", contents: [], systemInstruction: "s" });
  assert.equal(cine.generationConfig.responseMimeType, "application/json");
  assert.equal(cine.generationConfig.maxOutputTokens, 1800);
  assert.equal(cine.generationConfig.thinkingConfig.thinkingBudget, 0);
  assert.equal(cine.systemInstruction.parts[0].text, "s");
  const chat = buildGenerateBody({ mode: "chat", contents: [], systemInstruction: "s" });
  assert.equal(chat.generationConfig.responseMimeType, "text/plain");
});
