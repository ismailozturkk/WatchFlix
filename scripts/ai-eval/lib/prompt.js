// scripts/ai-eval/lib/prompt.js
//
// Vakadan, uygulamanın GERÇEK istem kurucularıyla sistem talimatı üretir
// (services/aiCineService + aiUserContext + aiCineInsights). Böylece değerlendirme,
// üretimde modele giden metinle aynı istemi kullanır; istem değişince ölçüm de değişir.

import { buildCineSystemInstruction } from "../../../services/aiCineService";
import { sanitizeHistory } from "../../../services/geminiService";
import { buildLibraryContext } from "../../../services/aiUserContext";
import { buildAvoidBlock, buildContextBlock } from "../../../services/aiCineInsights";
import { tmdbLanguageOf } from "../../../utils/appLanguages";
import { OFF_TOPIC_REPLY, PERSONAS, visibleWatched } from "../dataset.js";

// Sabit an: istem tarih/saate bağlıdır; ölçümler tekrarlanabilir olsun.
const FIXED_NOW = new Date(2026, 9, 17, 20, 0, 0);

/** Vakayı puanlamada gereken türetilmiş alanlarla zenginleştirir. */
export function resolveCase(kase) {
  const persona = PERSONAS[kase.persona];
  if (!persona) throw new Error(`Bilinmeyen persona: ${kase.persona} (vaka ${kase.id})`);
  const listNames = kase.fromList
    ? (persona.lists?.[kase.fromList] || []).map((it) => it.name)
    : [];
  return {
    ...kase,
    tmdbLanguage: tmdbLanguageOf(kase.language),
    offTopicReply: OFF_TOPIC_REPLY[kase.language] || OFF_TOPIC_REPLY.en,
    watched: visibleWatched(kase.persona),
    listNames,
  };
}

/** @returns {{ system: string, history: Array, userMessage: string }} */
export function buildRequest(kase) {
  const persona = PERSONAS[kase.persona];
  const library = buildLibraryContext(persona.lists, {
    watchList: true,
    favorites: true,
    custom: true,
    watched: true,
  });
  const system = buildCineSystemInstruction({
    language: kase.language,
    movieGenres: persona.movieGenres,
    tvGenres: persona.tvGenres,
    offTopicReply: OFF_TOPIC_REPLY[kase.language] || OFF_TOPIC_REPLY.en,
    userLibrary: library.librarySummary,
    targetMedia: kase.targetMedia || null,
    focusMedia: null,
    responseStyle: kase.style?.responseStyle,
    spoilerLevel: kase.style?.spoilerLevel,
    maxItems: kase.style?.maxItems,
    contextBlock: buildContextBlock(FIXED_NOW),
    avoidBlock: buildAvoidBlock(kase.avoidTitles),
  });
  return {
    system,
    history: sanitizeHistory(kase.history || []),
    userMessage: kase.message,
  };
}
