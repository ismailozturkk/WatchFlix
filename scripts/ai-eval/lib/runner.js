// scripts/ai-eval/lib/runner.js
//
// Vaka × model × tekrar çağrılarını yürütür; her sonucu results.jsonl'e ekler.
// Yeniden çalıştırmada başarılı satırlar atlanır (para harcanmaz), hatalılar tekrar denenir.

import fs from "fs";
import { MODELS, costUsd } from "./models.js";
import { buildRequest } from "./prompt.js";
import { makeCaller, withRetry } from "./providers.js";

export const rowKey = (caseId, model, run) => `${caseId}|${model}|${run}`;

export function loadRows(file) {
  const map = new Map();
  if (!fs.existsSync(file)) return map;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      map.set(rowKey(r.caseId, r.model, r.run), r); // sonraki satır öncekini ezer
    } catch {
      /* bozuk satırı atla */
    }
  }
  return map;
}

/** Kaba maliyet tahmini: çağrı yapmadan önce kullanıcıya gösterilir. */
export function estimatePlan(cases, modelIds, runs, maxOutputTokens) {
  const requests = cases.map((k) => buildRequest(k));
  const inChars = requests.map((r) => r.system.length + r.userMessage.length +
    r.history.reduce((a, m) => a + m.text.length, 0));
  const inTokens = inChars.map((n) => Math.ceil(n / 3.3)); // Türkçe/JSON için temkinli oran
  return modelIds.map((id) => {
    const m = MODELS[id];
    const typicalOut = 300;
    const typical = inTokens.reduce((a, t) => a + costUsd(id, { input: t, output: typicalOut }), 0) * runs;
    const worst = inTokens.reduce((a, t) => a + costUsd(id, { input: t, output: maxOutputTokens }), 0) * runs;
    return { id, label: m.label, calls: cases.length * runs, typical, worst };
  });
}

/** Her vakadan sırayla alarak (tür dengesi korunur) en fazla `limit` vaka seçer. */
export function pickBalanced(cases, limit) {
  if (!limit || limit >= cases.length) return cases;
  const groups = new Map();
  cases.forEach((k) => {
    if (!groups.has(k.category)) groups.set(k.category, []);
    groups.get(k.category).push(k);
  });
  const out = [];
  while (out.length < limit && [...groups.values()].some((g) => g.length)) {
    for (const g of groups.values()) {
      if (g.length && out.length < limit) out.push(g.shift());
    }
  }
  return out;
}

export async function collect({
  cases, modelIds, runs, file, keys, maxOutputTokens, concurrency = 4,
  log = () => {}, callerFactory = makeCaller, sleepImpl,
}) {
  const existing = loadRows(file);
  const callers = Object.fromEntries(
    modelIds.map((id) => [id, callerFactory(MODELS[id], keys)]),
  );
  const tasks = [];
  for (const kase of cases) {
    for (const model of modelIds) {
      for (let run = 0; run < runs; run++) {
        const prev = existing.get(rowKey(kase.id, model, run));
        if (prev?.ok) continue;
        tasks.push({ kase, model, run });
      }
    }
  }
  log(`${tasks.length} çağrı yapılacak (${existing.size} kayıt zaten var).`);

  let done = 0;
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const { kase, model, run } = tasks[next++];
      const req = buildRequest(kase);
      let row;
      try {
        const res = await withRetry(
          () => callers[model]({ ...req, maxOutputTokens }),
          { sleepImpl },
        );
        row = { caseId: kase.id, model, run, ok: true, ...res };
      } catch (err) {
        row = {
          caseId: kase.id, model, run, ok: false,
          error: String(err?.message || err).slice(0, 300),
        };
      }
      fs.appendFileSync(file, JSON.stringify(row) + "\n");
      existing.set(rowKey(kase.id, model, run), row);
      done += 1;
      if (done % 10 === 0 || done === tasks.length) log(`  ${done}/${tasks.length}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length || 1) }, worker));
  return existing;
}
