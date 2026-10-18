// scripts/ai-eval/lib/schema.js
//
// Model çıktısının, sistem talimatındaki "COMPACT SCHEMAS" ve boyut kurallarına
// uyup uymadığını denetler. `value` HAM ayrıştırılmış JSON olmalı
// (normalizeResponse'tan ÖNCE: type eksikse uygulama tahmin eder, ama bu da bir kusurdur).

import { CINE_VALID_TYPES, resolveStyleRules, toStr } from "../../../services/aiCineService";

const METRIC_KEYS = ["story", "acting", "visuals", "pacing", "emotion", "rewatch"];
const isMedia = (v) => v === "movie" || v === "tv";
const arr = (v) => (Array.isArray(v) ? v : []);
const words = (s) => toStr(s).trim().split(/\s+/).filter(Boolean).length;

/** Yanıttaki tüm {title, mediaType} nesneleri (tekrarlar DAHİL, ham). */
export function rawTitleObjects(r) {
  if (!r || typeof r !== "object") return [];
  const out = [];
  const push = (it) => it && typeof it === "object" && out.push(it);
  switch (r.type) {
    case "recommendations":
    case "general":
      arr(r.items).forEach(push);
      break;
    case "comparison":
      push(r.left);
      push(r.right);
      break;
    case "watch_plan":
      arr(r.sessions).forEach((s) => arr(s?.items).forEach(push));
      break;
    case "watchlist":
      arr(r.sections).forEach((s) => arr(s?.items).forEach(push));
      break;
    case "title_spotlight":
      push({ title: r.title, mediaType: r.mediaType });
      arr(r.similar).forEach(push);
      break;
    default:
      break;
  }
  return out;
}

/**
 * @returns {string[]} kusur kodları (boşsa şemaya uygun)
 */
export function checkResponse(value, { responseStyle, spoilerLevel, maxItems } = {}) {
  const issues = [];
  if (!value || typeof value !== "object") return ["not_object"];
  if (!CINE_VALID_TYPES.includes(value.type)) issues.push("type_missing_or_invalid");

  const rules = resolveStyleRules({ responseStyle, spoilerLevel, maxItems });
  const max = rules.maxItems;
  const recMin = Math.min(3, max);
  const watchlistCap = rules.style === "detailed" ? 9 : 12;
  const generalWords = rules.style === "concise" ? 50 : rules.style === "detailed" ? 120 : 80;

  const badItem = (it) =>
    !toStr(it?.title).trim() || !isMedia(it?.mediaType);
  const objs = rawTitleObjects(value);
  if (objs.some(badItem)) issues.push("item_missing_title_or_mediatype");

  const seen = new Set();
  for (const it of objs) {
    const k = `${it?.mediaType}|${toStr(it?.title).toLowerCase().trim()}`;
    if (seen.has(k)) {
      issues.push("duplicate_title");
      break;
    }
    seen.add(k);
  }

  switch (value.type) {
    case "recommendations": {
      const n = arr(value.items).length;
      if (n < recMin) issues.push("too_few_items");
      if (n > max) issues.push("too_many_items");
      break;
    }
    case "comparison": {
      if (!toStr(value.left?.title) || !toStr(value.right?.title)) issues.push("comparison_missing_side");
      const metrics = arr(value.metrics);
      if (metrics.length < 3 || metrics.length > 5) issues.push("comparison_metric_count");
      const badMetric = metrics.some(
        (m) =>
          !METRIC_KEYS.includes(m?.key) ||
          !Number.isInteger(m?.left) || m.left < 0 || m.left > 5 ||
          !Number.isInteger(m?.right) || m.right < 0 || m.right > 5,
      );
      if (badMetric) issues.push("comparison_bad_metric");
      if (!toStr(value.verdict).trim()) issues.push("comparison_missing_verdict");
      break;
    }
    case "watch_plan":
      if (!arr(value.sessions).length) issues.push("plan_no_sessions");
      break;
    case "watchlist": {
      const sections = arr(value.sections);
      if (sections.length < 1 || sections.length > 3) issues.push("watchlist_section_count");
      let total = 0;
      for (const s of sections) {
        const n = arr(s?.items).length;
        total += n;
        if (n < 2 || n > max) issues.push("watchlist_items_per_section");
      }
      if (total > watchlistCap) issues.push("watchlist_total_over_cap");
      break;
    }
    case "title_spotlight":
      if (!toStr(value.title).trim() || !isMedia(value.mediaType)) issues.push("spotlight_missing_title");
      if (!toStr(value.take).trim()) issues.push("spotlight_missing_take");
      break;
    case "general":
      if (!toStr(value.content).trim()) issues.push("general_missing_content");
      else if (words(value.content) > Math.round(generalWords * 1.15)) issues.push("general_too_long");
      break;
    default:
      break;
  }
  return Array.from(new Set(issues));
}
