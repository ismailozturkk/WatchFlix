// scripts/ai-eval/run.eval.js
//
// Giriş noktası. Varsayılan: PLAN modu — hiçbir API çağrısı yapmaz, vaka sayısını
// ve tahmini maliyeti yazdırır. Gerçekten çağırmak için AI_EVAL_RUN=1.
// Kullanım ve ortam değişkenleri: scripts/ai-eval/README.md

import fs from "fs";
import path from "path";
import { CASES } from "./dataset.js";
import { DEFAULT_MODELS, MODELS } from "./lib/models.js";
import { resolveCase } from "./lib/prompt.js";
import { collect, estimatePlan, loadRows, pickBalanced, rowKey } from "./lib/runner.js";
import { createTmdbVerifier } from "./lib/tmdb.js";
import { scoreRow } from "./lib/score.js";
import { renderReport } from "./lib/report.js";

const env = process.env;
const OUT = path.join(__dirname, "out");
const RESULTS = path.join(OUT, "results.jsonl");
const TMDB_CACHE = path.join(OUT, "tmdb-cache.json");

const intEnv = (name, fallback) => {
  const n = parseInt(env[name], 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const log = (...a) => console.log("[ai-eval]", ...a);

function loadCases() {
  let all = [...CASES];
  const extra = path.join(__dirname, "extraCases.json");
  if (fs.existsSync(extra)) {
    const more = JSON.parse(fs.readFileSync(extra, "utf8"));
    log(`extraCases.json: ${more.length} ek vaka`);
    all = all.concat(more);
  }
  const ids = new Set();
  all.forEach((k) => {
    if (ids.has(k.id)) throw new Error(`Yinelenen vaka kimliği: ${k.id}`);
    ids.add(k.id);
  });
  const prefix = (env.AI_EVAL_CASES || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (prefix.length) all = all.filter((k) => prefix.some((p) => k.id.startsWith(p)));
  return pickBalanced(all, intEnv("AI_EVAL_LIMIT", 0)).map(resolveCase);
}

function loadTmdbCache() {
  try {
    return new Map(Object.entries(JSON.parse(fs.readFileSync(TMDB_CACHE, "utf8"))));
  } catch {
    return new Map();
  }
}

describe("ai model değerlendirmesi", () => {
  test("plan / çalıştır / raporla", async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const modelIds = (env.AI_EVAL_MODELS ? env.AI_EVAL_MODELS.split(",").map((s) => s.trim()) : DEFAULT_MODELS);
    const unknown = modelIds.filter((m) => !MODELS[m]);
    if (unknown.length) throw new Error(`Bilinmeyen model: ${unknown.join(", ")} (geçerli: ${Object.keys(MODELS).join(", ")})`);
    const runs = intEnv("AI_EVAL_RUNS", 1);
    const maxOutputTokens = intEnv("AI_EVAL_MAX_TOKENS", 1800);
    const cases = loadCases();
    const reportOnly = env.AI_EVAL_REPORT_ONLY === "1";

    log(`${cases.length} vaka × ${modelIds.length} model × ${runs} tekrar`);
    const plan = estimatePlan(cases, modelIds, runs, maxOutputTokens);
    plan.forEach((p) =>
      log(`  ${p.label}: ${p.calls} çağrı · tahmini ~$${p.typical.toFixed(3)} (en kötü ~$${p.worst.toFixed(3)})`),
    );
    log(`  TOPLAM tahmini ~$${plan.reduce((a, p) => a + p.typical, 0).toFixed(3)} (en kötü ~$${plan.reduce((a, p) => a + p.worst, 0).toFixed(3)})`);

    if (env.AI_EVAL_RUN !== "1" && !reportOnly) {
      log("PLAN modu: çağrı yapılmadı. Çalıştırmak için AI_EVAL_RUN=1 ayarla (README'ye bak).");
      return;
    }

    if (!env.TMDB_TOKEN) throw new Error("TMDB_TOKEN tanımlı değil (başlık doğrulaması için gerekli)");

    if (!reportOnly) {
      const needGemini = modelIds.some((m) => MODELS[m].provider === "gemini");
      const needClaude = modelIds.some((m) => MODELS[m].provider === "anthropic");
      if (needGemini && !env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY tanımlı değil");
      if (needClaude && !env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY tanımlı değil");
      const keys = { geminiKey: env.GEMINI_API_KEY };
      if (needClaude) {
        // eslint-disable-next-line global-require
        const Anthropic = require("@anthropic-ai/sdk");
        const Ctor = Anthropic.default || Anthropic;
        keys.anthropicClient = new Ctor(); // ANTHROPIC_API_KEY ortamdan okunur
      }
      await collect({
        cases, modelIds, runs, file: RESULTS, keys, maxOutputTokens,
        concurrency: intEnv("AI_EVAL_CONCURRENCY", 4), log,
      });
    }

    // ── Puanlama + rapor ──
    const rows = loadRows(RESULTS);
    const cache = loadTmdbCache();
    const verifier = createTmdbVerifier({ token: env.TMDB_TOKEN, cache });
    const byId = new Map(cases.map((k) => [k.id, k]));
    const scored = [];
    for (const k of cases) {
      for (const model of modelIds) {
        for (let run = 0; run < runs; run++) {
          const row = rows.get(rowKey(k.id, model, run));
          if (!row) continue;
          scored.push(await scoreRow(row, byId.get(k.id), verifier));
        }
      }
    }
    fs.writeFileSync(TMDB_CACHE, JSON.stringify(Object.fromEntries(cache)));

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const report = renderReport({ scored, cases, generatedAt: new Date().toISOString(), runs });
    fs.writeFileSync(path.join(OUT, `report-${stamp}.md`), report);
    fs.writeFileSync(path.join(OUT, "report-latest.md"), report);
    fs.writeFileSync(path.join(OUT, "scored-latest.json"), JSON.stringify(scored, null, 1));
    log(`Rapor: ${path.join("scripts", "ai-eval", "out", "report-latest.md")}`);
    console.log("\n" + report);
  });
});
