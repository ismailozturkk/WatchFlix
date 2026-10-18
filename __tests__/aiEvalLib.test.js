// scripts/ai-eval kütüphanesinin ağ GEREKTİRMEYEN testleri: eşleştirme, şema denetimi,
// sağlayıcı istek biçimi, TMDB doğrulayıcı, puanlama, toplama/yeniden deneme, rapor.
import fs from "fs";
import os from "os";
import path from "path";
import { CASES, PERSONAS } from "../scripts/ai-eval/dataset.js";
import { costUsd, MODELS } from "../scripts/ai-eval/lib/models.js";
import { buildRequest, resolveCase } from "../scripts/ai-eval/lib/prompt.js";
import { callClaude, callGemini, withRetry } from "../scripts/ai-eval/lib/providers.js";
import { renderReport, summarize } from "../scripts/ai-eval/lib/report.js";
import { collect, loadRows, pickBalanced } from "../scripts/ai-eval/lib/runner.js";
import { checkResponse } from "../scripts/ai-eval/lib/schema.js";
import { scoreRow } from "../scripts/ai-eval/lib/score.js";
import { createTmdbVerifier } from "../scripts/ai-eval/lib/tmdb.js";
import { foldTitle, matchTitle } from "../scripts/ai-eval/lib/titleMatch.js";

const json = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

describe("başlık eşleştirme", () => {
  test("aksan, noktalama, tanımlık ve yıl eki yok sayılır", () => {
    expect(foldTitle("The Dark Knight")).toBe("dark knight");
    expect(foldTitle("Spider-Man: No Way Home")).toBe(foldTitle("spider man no way home"));
    expect(foldTitle("Dune (2021)")).toBe("dune");
    expect(foldTitle("ŞİMDİ ıslak")).toBe("simdi islak");
  });

  test("tam / yakın / eşleşmeyen", () => {
    expect(matchTitle("Inception", ["Başlangıç", "Inception"])).toBe("exact");
    expect(matchTitle("Everything Everywhere All At Once", ["Everything Everywhere All at Once"])).toBe("exact");
    expect(matchTitle("Interstelar", ["Interstellar"])).toBe("close");
    expect(matchTitle("Dune", ["Dune: Part Two"])).toBeNull();
    expect(matchTitle("Dark", ["Dork"])).toBeNull(); // kısa başlıkta yakın eşleşme kabul edilmez
  });
});

describe("şema denetimi", () => {
  const rec = (n) => ({
    type: "recommendations",
    items: Array.from({ length: n }, (_, i) => ({ title: `T${i}`, mediaType: "movie", reason: "x" })),
  });

  test("temiz öneri", () => expect(checkResponse(rec(5))).toEqual([]));

  test("öğe sayısı sınırları (varsayılan 3–5)", () => {
    expect(checkResponse(rec(2))).toContain("too_few_items");
    expect(checkResponse(rec(6))).toContain("too_many_items");
    expect(checkResponse(rec(6), { maxItems: 8 })).toEqual([]);
  });

  test("eksik mediaType, tekrar ve geçersiz tip yakalanır", () => {
    const bad = { type: "recommendations", items: [{ title: "A" }, { title: "B", mediaType: "movie" }, { title: "B", mediaType: "movie" }] };
    const issues = checkResponse(bad);
    expect(issues).toEqual(expect.arrayContaining(["item_missing_title_or_mediatype", "duplicate_title"]));
    expect(checkResponse({ items: [] })).toContain("type_missing_or_invalid");
  });

  test("karşılaştırma ölçütleri", () => {
    const ok = {
      type: "comparison",
      left: { title: "A", mediaType: "tv" },
      right: { title: "B", mediaType: "tv" },
      metrics: [{ key: "story", left: 4, right: 5 }, { key: "acting", left: 3, right: 5 }, { key: "pacing", left: 2, right: 4 }],
      verdict: "A",
    };
    expect(checkResponse(ok)).toEqual([]);
    expect(checkResponse({ ...ok, metrics: [{ key: "story", left: 9, right: 1 }] })).toEqual(
      expect.arrayContaining(["comparison_metric_count", "comparison_bad_metric"]),
    );
  });

  test("genel yanıt uzunluğu sınırı", () => {
    const long = { type: "general", content: Array(200).fill("kelime").join(" ") };
    expect(checkResponse(long)).toContain("general_too_long");
  });
});

describe("sağlayıcı istekleri", () => {
  test("Gemini: callGemini ile aynı üretim ayarı, anahtar başlıkta", async () => {
    const fetchImpl = jest.fn(async () =>
      json({
        candidates: [{ content: { parts: [{ text: "{}" }] }, finishReason: "STOP" }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 0 },
      }),
    );
    const res = await callGemini({
      apiKey: "K", apiModel: "gemini-2.5-flash-lite", system: "S",
      history: [{ role: "assistant", text: "a" }], userMessage: "u", fetchImpl,
    });
    const [url, init] = fetchImpl.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(url).toContain("gemini-2.5-flash-lite:generateContent");
    expect(url).not.toContain("K");
    expect(init.headers["x-goog-api-key"]).toBe("K");
    expect(body.generationConfig).toMatchObject({
      temperature: 0.8, topP: 0.95, topK: 40, maxOutputTokens: 1800,
      responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 },
    });
    expect(body.contents.map((c) => c.role)).toEqual(["model", "user"]);
    expect(res.usage).toEqual({ input: 10, output: 5, thoughts: 0 });
  });

  test("Claude: temperature göndermez, düşünme modu ve ilk user kuralı", async () => {
    const create = jest.fn(async () => ({
      content: [{ type: "text", text: "{}" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 20, output_tokens: 7 },
    }));
    const res = await callClaude({
      client: { messages: { create } }, apiModel: "claude-haiku-5-5", system: "S",
      history: [{ role: "model", text: "önce asistan" }, { role: "user", text: "u1" }, { role: "model", text: "a1" }],
      userMessage: "u2",
    });
    const p = create.mock.calls[0][0];
    expect(p).not.toHaveProperty("temperature");
    expect(p).not.toHaveProperty("top_p");
    expect(p.thinking).toEqual({ type: "disabled" });
    expect(p.messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(res).toMatchObject({ text: "{}", finishReason: "end_turn", usage: { input: 20, output: 7 } });

    await callClaude({
      client: { messages: { create } }, apiModel: "claude-haiku-5-5", system: "S",
      userMessage: "u", thinking: "adaptive", effort: "low",
    });
    expect(create.mock.calls[1][0]).toMatchObject({ thinking: { type: "adaptive" }, output_config: { effort: "low" } });
  });

  test("withRetry: 429/5xx tekrar denenir, 400 denenmez", async () => {
    const sleepImpl = jest.fn(async () => {});
    let n = 0;
    const flaky = async () => {
      n++;
      if (n < 3) throw Object.assign(new Error("x"), { status: 503 });
      return "ok";
    };
    await expect(withRetry(flaky, { sleepImpl })).resolves.toBe("ok");
    expect(sleepImpl).toHaveBeenCalledTimes(2);

    const bad = jest.fn(async () => { throw Object.assign(new Error("bad"), { status: 400 }); });
    await expect(withRetry(bad, { sleepImpl })).rejects.toThrow("bad");
    expect(bad).toHaveBeenCalledTimes(1);
  });

  test("maliyet: düşünme token'ları çıkış fiyatıyla", () => {
    expect(costUsd("gemini-2.5-flash", { input: 1e6, output: 0, thoughts: 1e6 })).toBeCloseTo(0.3 + 2.5);
    expect(costUsd("claude-haiku-5-5", { input: 2e6, output: 1e6 })).toBeCloseTo(0.2 + 0.5);
  });
});

describe("TMDB doğrulayıcı", () => {
  const searchFake = (table) =>
    jest.fn(async (url) => {
      const type = /search\/(movie|tv)/.exec(url)[1];
      const q = decodeURIComponent(/query=([^&]*)/.exec(url)[1]);
      return json({ results: table[`${type}:${q}`] || [] });
    });

  test("exact / wrong_type / loose / none", async () => {
    const fetchImpl = searchFake({
      "movie:Inception": [{ title: "Inception" }],
      "movie:Dark": [{ title: "Darkest Hour" }],
      "tv:Dark": [{ name: "Dark" }],
      "movie:Uydurma Film": [{ title: "Tamamen Başka" }],
    });
    const v = createTmdbVerifier({ token: "t", fetchImpl });
    expect((await v.verify({ title: "Inception", mediaType: "movie", language: "en-US" })).status).toBe("exact");
    expect((await v.verify({ title: "Dark", mediaType: "movie", language: "en-US" })).status).toBe("wrong_type");
    expect((await v.verify({ title: "Uydurma Film", mediaType: "movie", language: "en-US" })).status).toBe("loose");
    expect((await v.verify({ title: "Hiç Yok", mediaType: "movie", language: "en-US" })).status).toBe("none");
    // önbellek: aynı sorgu ikinci kez ağa gitmez
    const calls = fetchImpl.mock.calls.length;
    await v.verify({ title: "Inception", mediaType: "movie", language: "en-US" });
    expect(fetchImpl.mock.calls.length).toBe(calls);
  });
});

describe("puanlama", () => {
  const verifier = {
    verify: async ({ title }) =>
      title.startsWith("Fake") ? { status: "loose", appFound: true } : { status: "exact", appFound: true },
  };
  const kase = resolveCase({
    id: "t", category: "öneri", language: "tr", persona: "tr_scifi", message: "x", expect: ["recommendations"],
  });
  const okRow = (value, extra = {}) => ({
    caseId: "t", model: "gemini-2.5-flash", run: 0, ok: true,
    text: typeof value === "string" ? value : JSON.stringify(value),
    finishReason: "STOP", usage: { input: 1000, output: 100, thoughts: 0 }, latencyMs: 800, ...extra,
  });
  const recs = (titles) => ({
    type: "recommendations",
    items: titles.map((t) => ({ title: t, mediaType: "movie", reason: "r" })),
  });

  test("temiz yanıt kabul edilir", async () => {
    const s = await scoreRow(okRow(recs(["A1", "B2", "C3"])), kase, verifier);
    expect(s.pass).toBe(true);
    expect(s.strictRate).toBe(1);
    expect(s.costUsd).toBeGreaterThan(0);
  });

  test("uydurma başlıklar, izlenmiş başlık ve kesik JSON kusur sayılır", async () => {
    const fake = await scoreRow(okRow(recs(["Fake1", "Fake2", "Real"])), kase, verifier);
    expect(fake.fail).toContain("titles_not_found");

    const seen = await scoreRow(okRow(recs(["Inception", "X1", "X2"])), kase, verifier);
    expect(seen.violations).toBe(1);
    expect(seen.fail).toContain("repeats_seen_titles");

    const cut = await scoreRow(
      okRow('{"type":"recommendations","items":[{"title":"A1","mediaType":"movie"},{"title":"B2","mediaType":"mov', { finishReason: "MAX_TOKENS" }),
      kase, verifier,
    );
    expect(cut.pass).toBe(false);
    expect(cut.fail).toEqual(expect.arrayContaining(["repaired_json", "truncated"]));
  });

  test("API hatası ve ayrıştırılamayan metin", async () => {
    expect((await scoreRow({ caseId: "t", model: "m", ok: false, error: "boom" }, kase, verifier)).status).toBe("error");
    const junk = await scoreRow(okRow("merhaba dünya"), kase, verifier);
    expect(junk.fail).toContain("unparseable");
  });

  test("konu dışı: birebir ret cümlesi şart", async () => {
    const off = resolveCase({
      id: "o", category: "konu dışı", language: "tr", persona: "none", message: "tarif", expect: ["general"], offTopic: true,
    });
    const good = await scoreRow(okRow({ type: "general", content: off.offTopicReply }), off, verifier);
    expect(good.pass).toBe(true);
    const bad = await scoreRow(okRow({ type: "general", content: "Tarif: ..." }), off, verifier);
    expect(bad.fail).toContain("offtopic_not_refused");
  });

  test("kilitli (targetMedia) vakada yalnız metin üretimi aranır", async () => {
    const locked = resolveCase(CASES.find((k) => k.id === "lock-tr-01"));
    const s = await scoreRow(okRow({ type: "title_spotlight", title: "x", mediaType: "movie", take: "izlenir" }), locked, verifier);
    expect(s.pass).toBe(true);
  });
});

describe("toplama ve rapor", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-eval-"));
  const file = path.join(dir, "results.jsonl");
  const cases = CASES.slice(0, 3).map(resolveCase);

  test("hatalı satır tekrar denenir, başarılı satır atlanır", async () => {
    let failOnce = true;
    const factory = () => async () => {
      if (failOnce) {
        failOnce = false;
        throw Object.assign(new Error("kalıcı hata"), { status: 400 });
      }
      return { text: '{"type":"general","content":"x"}', finishReason: "STOP", usage: { input: 5, output: 5, thoughts: 0 }, latencyMs: 1 };
    };
    await collect({ cases, modelIds: ["gemini-2.5-flash"], runs: 1, file, keys: {}, maxOutputTokens: 100, concurrency: 1, callerFactory: factory, sleepImpl: async () => {} });
    expect([...loadRows(file).values()].filter((r) => !r.ok)).toHaveLength(1);

    const second = jest.fn(async () => ({ text: "{}", finishReason: "STOP", usage: { input: 1, output: 1, thoughts: 0 }, latencyMs: 1 }));
    await collect({ cases, modelIds: ["gemini-2.5-flash"], runs: 1, file, keys: {}, maxOutputTokens: 100, concurrency: 1, callerFactory: () => second });
    expect(second).toHaveBeenCalledTimes(1); // yalnız hatalı olan
    expect([...loadRows(file).values()].every((r) => r.ok)).toBe(true);
  });

  test("rapor tüm modelleri ve eşli karşılaştırmayı içerir", () => {
    const mk = (model, pass) => ({
      caseId: "a", model, run: 0, category: "öneri", status: "ok", parsed: true, repaired: false, truncated: false,
      refused: false, typeOk: true, issues: [], titles: { total: 4, exact: pass ? 4 : 1, close: 0, wrong_type: 0, loose: pass ? 0 : 3, none: 0, appFound: 4 },
      violations: 0, offList: 0, pass, fail: pass ? [] : ["titles_not_found"], suspect: pass ? [] : ["Fake [movie:loose]"],
      usage: { input: 2000, output: 200, thoughts: 0 }, costUsd: 0.001, latencyMs: 900,
    });
    const scored = [mk("gemini-2.5-flash", true), mk("claude-haiku-5-5", false)];
    expect(summarize(scored.slice(0, 1))).toMatchObject({ n: 1, passed: 1 });
    const md = renderReport({ scored, cases: [{ id: "a" }], generatedAt: "t", runs: 1 });
    expect(md).toContain(MODELS["claude-haiku-5-5"].label);
    expect(md).toContain("Yalnız temel geçti");
    expect(md).toContain("titles_not_found ×1");
  });

  test("pickBalanced türleri dengeler", () => {
    const picked = pickBalanced(CASES, 12);
    expect(picked).toHaveLength(12);
    expect(new Set(picked.map((k) => k.category)).size).toBeGreaterThanOrEqual(10);
  });
});

describe("veri kümesi bütünlüğü", () => {
  test("kimlikler benzersiz, personalar tanımlı, istem sunucu sınırı altında", () => {
    const ids = new Set();
    for (const k of CASES) {
      expect(ids.has(k.id)).toBe(false);
      ids.add(k.id);
      expect(PERSONAS[k.persona]).toBeDefined();
      expect(Array.isArray(k.expect) && k.expect.length > 0).toBe(true);
      const req = buildRequest(resolveCase(k));
      // functions/index.js: AI_MAX_SYSTEM_CHARS = 24000, tek kullanıcı mesajı 4000
      expect(req.system.length).toBeLessThan(24000);
      expect(req.userMessage.length).toBeLessThan(4000);
    }
  });

  test("izlenen listesi görünür pencere = en yeni 20", () => {
    const k = resolveCase(CASES.find((c) => c.persona === "tr_scifi"));
    expect(k.watched).toHaveLength(20);
    expect(buildRequest(k).system).toContain("Recently watched:");
  });
});
