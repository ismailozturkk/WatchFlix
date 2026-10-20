// scripts/ai-eval/lib/score.js
//
// Saklanan ham model yanıtını puanlar. Ağ çağrısı yalnız TMDB doğrulamasında yapılır
// (önbellekli) — modeli yeniden çağırmadan rapor yeniden üretilebilir.

import { extractJSONDetailed, posterKey } from "../../../services/aiCineService";
import { foldTitle } from "./titleMatch.js";
import { checkResponse, rawTitleObjects } from "./schema.js";
import { costUsd } from "./models.js";

const TRUNCATED = new Set(["MAX_TOKENS", "max_tokens"]);
const REFUSED = new Set(["SAFETY", "RECITATION", "BLOCKED", "refusal"]);
const STRICT_PASS_RATE = 0.8; // başlıkların en az %80'i TMDB'de aynı adla bulunmalı

const textOf = (r) =>
  [r?.take, r?.content, r?.summary, r?.reason, r?.items?.[0]?.reason]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .find(Boolean) || "";

/**
 * @param {object} row       saklanan çağrı kaydı ({ok, text, finishReason, usage, latencyMs, error})
 * @param {object} kase      veri kümesi vakası (+ çözülmüş: language, offTopicReply, watched[], listNames[])
 * @param {{verify:Function}} verifier  TMDB doğrulayıcı
 */
export async function scoreRow(row, kase, verifier) {
  const base = {
    caseId: row.caseId,
    model: row.model,
    run: row.run ?? 0,
    category: kase.category,
    costUsd: row.ok ? costUsd(row.model, row.usage) : 0,
    usage: row.usage || { input: 0, output: 0, thoughts: 0 },
    latencyMs: row.latencyMs ?? null,
  };
  if (!row.ok) return { ...base, status: "error", pass: false, error: row.error || "unknown" };

  const finish = row.finishReason;
  const refused = REFUSED.has(finish);
  const truncated = TRUNCATED.has(finish);
  const { value, repaired } = extractJSONDetailed(row.text);
  const parsed = !!value && typeof value === "object";
  const result = { ...base, status: "ok", finishReason: finish, refused, truncated, parsed, repaired };

  if (!parsed) return { ...result, pass: false, fail: [refused ? "refused" : "unparseable"], issues: [] };

  // targetMedia varsa uygulama cevabı title_spotlight'a kilitler (enforceTargetMediaResponse):
  // yalnız anlamlı bir metin üretip üretmediği ölçülür.
  if (kase.locked) {
    const hasText = !!textOf(value);
    const fail = [];
    if (repaired) fail.push("repaired_json");
    if (!hasText) fail.push("locked_no_text");
    return { ...result, locked: true, issues: [], titles: { total: 0 }, pass: fail.length === 0, fail };
  }

  const issues = checkResponse(value, kase.style);
  const typeOk = kase.expect.includes(value.type);

  // Başlıklar (tekrarsız) + TMDB doğrulaması
  const seen = new Set();
  const unique = [];
  for (const it of rawTitleObjects(value)) {
    const title = String(it?.title ?? "").trim();
    if (!title) continue;
    const key = posterKey(it?.mediaType, title);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ title, mediaType: it?.mediaType === "tv" ? "tv" : "movie" });
  }
  const counts = { total: unique.length, exact: 0, close: 0, wrong_type: 0, loose: 0, none: 0, appFound: 0 };
  const suspect = [];
  for (const t of unique) {
    let v;
    try {
      v = await verifier.verify({ ...t, language: kase.tmdbLanguage });
    } catch (e) {
      v = { status: "unverified", appFound: false };
    }
    if (counts[v.status] !== undefined) counts[v.status] += 1;
    if (v.appFound) counts.appFound += 1;
    if (v.status !== "exact" && v.status !== "close") suspect.push(`${t.title} [${t.mediaType}:${v.status}]`);
  }
  const strictRate = counts.total ? (counts.exact + counts.close) / counts.total : null;

  // Kural ihlalleri
  const folded = unique.map((t) => foldTitle(t.title));
  const banned = new Set([...(kase.watched || []), ...(kase.avoidTitles || [])].map(foldTitle));
  const violations = folded.filter((f) => banned.has(f)).length;
  let offList = 0;
  if (kase.fromList) {
    const allowed = new Set((kase.listNames || []).map(foldTitle));
    offList = folded.filter((f) => !allowed.has(f)).length;
  }

  const fail = [];
  if (repaired) fail.push("repaired_json");
  if (truncated) fail.push("truncated");
  if (!typeOk) fail.push(`type_${value.type}`);
  for (const i of issues) fail.push(i);
  if (kase.offTopic) {
    const ok =
      value.type === "general" &&
      foldTitle(value.content) === foldTitle(kase.offTopicReply) &&
      !rawTitleObjects(value).length;
    if (!ok) fail.push("offtopic_not_refused");
  } else if (strictRate !== null && strictRate < STRICT_PASS_RATE) {
    fail.push("titles_not_found");
  }
  if (violations) fail.push("repeats_seen_titles");
  if (offList) fail.push("picks_outside_list");

  return {
    ...result,
    type: value.type,
    typeOk,
    issues,
    titles: counts,
    strictRate,
    suspect,
    violations,
    offList,
    pass: fail.length === 0,
    fail: Array.from(new Set(fail)),
  };
}
