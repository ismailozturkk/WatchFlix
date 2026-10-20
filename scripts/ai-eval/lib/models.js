// scripts/ai-eval/lib/models.js
//
// Karşılaştırılan modeller ve fiyatları (USD / 1M token).
// Fiyatlar 2026-10-19'da resmi sayfalardan okundu:
//   Gemini: https://ai.google.dev/gemini-api/docs/pricing
//   Claude: https://platform.claude.com/docs/en/about-claude/pricing (Haiku 5.5, 100K token altı istemler)
// Değişirse YALNIZ burayı güncelle.

export const MODELS = {
  "gemini-2.5-flash": {
    label: "Gemini 2.5 Flash (şimdiki)",
    provider: "gemini",
    apiModel: "gemini-2.5-flash",
    inPerM: 0.3,
    outPerM: 2.5,
  },
  "gemini-2.5-flash-lite": {
    label: "Gemini 2.5 Flash-Lite",
    provider: "gemini",
    apiModel: "gemini-2.5-flash-lite",
    inPerM: 0.1,
    outPerM: 0.4,
  },
  // Düşünme KAPALI: Gemini tarafındaki thinkingBudget:0 ile eşdeğer koşul.
  "claude-haiku-5-5": {
    label: "Claude Haiku 5.5 (düşünme kapalı)",
    provider: "anthropic",
    apiModel: "claude-haiku-5-5",
    thinking: "disabled",
    inPerM: 0.1,
    outPerM: 0.5,
  },
  // İsteğe bağlı: düşünme açık, en düşük efor. Düşünme token'ları çıkış fiyatıyla faturalanır.
  "claude-haiku-5-5-think-low": {
    label: "Claude Haiku 5.5 (uyarlamalı düşünme, efor low)",
    provider: "anthropic",
    apiModel: "claude-haiku-5-5",
    thinking: "adaptive",
    effort: "low",
    inPerM: 0.1,
    outPerM: 0.5,
  },
};

export const DEFAULT_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "claude-haiku-5-5"];

/** Düşünme token'ları çıkış olarak faturalanır. */
export function costUsd(modelId, { input = 0, output = 0, thoughts = 0 } = {}) {
  const m = MODELS[modelId];
  if (!m) return 0;
  return (input * m.inPerM + (output + thoughts) * m.outPerM) / 1e6;
}
