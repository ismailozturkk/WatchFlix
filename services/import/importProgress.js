// services/import/importProgress.js
//
// İçe aktarma ilerlemesinin SAF durum modeli: aşama, aşama sayaçları, şu an işlenen
// öğe, son işlenen afişler, genel oran ve kalan süre tahmini. Yürütücü (importRunner)
// olay yayar, bu indirgeyici durumu üretir, ekran yalnız durumu çizer.
//
// Genel oran öğe sayısına değil İŞ'e göre: eşleştirme 5 paralel istekle hızlı geçer,
// kayıt sıralı transaction'dır. Eski çubuk %65'i eşleştirmeye ayırıyordu; büyük
// arşivde çubuk hızla %65'e fırlayıp kayıtta dakikalarca sürünüyordu.

export const IMPORT_STAGES = Object.freeze(["matching", "saving", "lists", "finalizing"]);

// Öğe başına göreli maliyet (eşleştirme = 1).
export const STAGE_WEIGHTS = Object.freeze({ matching: 1, saving: 2.5, lists: 4 });
// Profil istatistiklerinin yeniden hesabı için ayrılan pay.
const FINALIZE_SHARE = 0.04;
export const RECENT_LIMIT = 8;
// Bu kadar öğe ve süre birikmeden tahmin gösterilmez (ilk istekler ısınma).
const ETA_MIN_ITEMS = 4;
const ETA_MIN_MS = 2500;

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

export function createImportProgress({ matchTotal = 0, saveTotal = 0, listTotal = 0, now = Date.now() } = {}) {
  return {
    stage: "matching",
    startedAt: now,
    stageStartedAt: now,
    stageStartDone: 0,
    match: { done: 0, total: matchTotal, matched: 0, unmatched: 0, failed: 0 },
    save: { done: 0, total: saveTotal, added: 0, unchanged: 0, failed: 0 },
    lists: { done: 0, total: listTotal, added: 0, failed: 0 },
    current: null,
    recent: [],
    finalized: false,
    ratio: 0,
  };
}

const stageCounter = (state, stage = state.stage) =>
  stage === "matching" ? state.match : stage === "saving" ? state.save : stage === "lists" ? state.lists : null;

/** İşin ağırlıklı oranı; kalıcı bitiş yalnız `finalized` ile 1 olur. */
export function computeOverallRatio(state) {
  const { match, save, lists } = state;
  const work =
    match.total * STAGE_WEIGHTS.matching + save.total * STAGE_WEIGHTS.saving + lists.total * STAGE_WEIGHTS.lists;
  const done =
    Math.min(match.done, match.total) * STAGE_WEIGHTS.matching +
    Math.min(save.done, save.total) * STAGE_WEIGHTS.saving +
    Math.min(lists.done, lists.total) * STAGE_WEIGHTS.lists;
  if (state.finalized) return 1;
  const base = work > 0 ? done / work : state.stage === "finalizing" ? 1 : 0;
  return clamp01(base * (1 - FINALIZE_SHARE));
}

const itemKey = (item, media) =>
  media?.id != null
    ? `${media.mediaType || "movie"}_${media.id}`
    : `${item?.imdbId || ""}:${item?.title || ""}:${item?.year || ""}`;

function cardOf(event) {
  const media = event.media || (event.item?.id != null ? event.item : null);
  return {
    key: `${event.type}:${itemKey(event.item, media)}`,
    title: media?.title || event.item?.sourceTitle || event.item?.title || event.item?.imdbId || "",
    year: event.item?.sourceYear ?? event.item?.year ?? (media?.release_date ? Number(String(media.release_date).slice(0, 4)) : null),
    poster: media?.poster_path || null,
    status: event.status || event.outcome || "matched",
  };
}

function pushRecent(recent, card) {
  // Yalnız afişli kartlar şeride girer; aynı öğe iki kez görünmez.
  if (!card.poster) return recent;
  return [card, ...recent.filter((entry) => entry.key !== card.key)].slice(0, RECENT_LIMIT);
}

function withRatio(next) {
  return { ...next, ratio: Math.max(next.ratio || 0, computeOverallRatio(next)) };
}

/**
 * Olaylar:
 *   { type:"stage", stage, total?, done? }
 *   { type:"match", done, total, status:"matched"|"unmatched"|"failed", item, media }
 *   { type:"save",  done, total, outcome:"added"|"unchanged"|"failed", item }
 *   { type:"list",  done, total, name, added, failed? }
 *   { type:"finalized" }
 */
export function reduceImportProgress(state, event, now = Date.now()) {
  if (!event || typeof event !== "object") return state;
  switch (event.type) {
    case "stage": {
      const next = { ...state, stage: event.stage, stageStartedAt: now, recent: state.recent };
      const counter = stageCounter(next, event.stage);
      if (counter) {
        const updated = {
          ...counter,
          total: Number.isFinite(event.total) ? event.total : counter.total,
          done: Number.isFinite(event.done) ? event.done : counter.done,
        };
        // Yarıda kalan eşleştirme baştan koşar (önbellekten): sayaçlar çift sayılmasın.
        if (event.stage === "matching" && event.done === 0) {
          Object.assign(updated, { matched: 0, unmatched: 0, failed: 0 });
        }
        next[event.stage === "matching" ? "match" : event.stage === "saving" ? "save" : "lists"] = updated;
        next.stageStartDone = updated.done;
      } else {
        next.stageStartDone = 0;
      }
      // Kayıt aşaması kendi afiş akışıyla başlar.
      if (event.stage !== state.stage && event.stage === "saving") next.recent = [];
      next.current = null;
      return withRatio(next);
    }
    case "match": {
      const match = {
        ...state.match,
        done: Math.max(state.match.done, event.done || 0),
        total: event.total ?? state.match.total,
        matched: state.match.matched + (event.status === "matched" ? 1 : 0),
        unmatched: state.match.unmatched + (event.status === "unmatched" ? 1 : 0),
        failed: state.match.failed + (event.status === "failed" ? 1 : 0),
      };
      const card = cardOf(event);
      return withRatio({ ...state, match, current: card, recent: pushRecent(state.recent, card) });
    }
    case "save": {
      const save = {
        ...state.save,
        done: Math.max(state.save.done, event.done || 0),
        total: event.total ?? state.save.total,
        added: state.save.added + (event.outcome === "added" ? 1 : 0),
        unchanged: state.save.unchanged + (event.outcome === "unchanged" ? 1 : 0),
        failed: state.save.failed + (event.outcome === "failed" ? 1 : 0),
      };
      const card = cardOf(event);
      return withRatio({ ...state, save, current: card, recent: pushRecent(state.recent, card) });
    }
    case "list": {
      const lists = {
        ...state.lists,
        done: Math.max(state.lists.done, event.done || 0),
        total: event.total ?? state.lists.total,
        added: state.lists.added + (Number(event.added) || 0),
        failed: state.lists.failed + (event.failed ? 1 : 0),
      };
      return withRatio({ ...state, lists, current: { key: `list:${event.name}`, title: event.name, year: null, poster: null, status: event.failed ? "failed" : "list" } });
    }
    case "finalized":
      return { ...state, stage: "finalizing", finalized: true, ratio: 1, current: null };
    default:
      return state;
  }
}

/**
 * Kalan süre tahmini (ms) ya da yeterli veri yoksa null. Etkin aşamanın ölçülen
 * öğe hızından sonraki aşamalar ağırlık oranıyla tahmin edilir.
 */
export function estimateRemainingMs(state, now = Date.now()) {
  if (!state || state.finalized) return null;
  const counter = stageCounter(state);
  if (!counter) return null;
  const elapsed = now - state.stageStartedAt;
  const doneInStage = counter.done - (state.stageStartDone || 0);
  if (doneInStage < ETA_MIN_ITEMS || elapsed < ETA_MIN_MS) return null;
  const perItem = elapsed / doneInStage;
  const perUnit = perItem / STAGE_WEIGHTS[state.stage];
  let remaining = Math.max(0, counter.total - counter.done) * perItem;
  if (state.stage === "matching") {
    remaining += state.save.total * STAGE_WEIGHTS.saving * perUnit + state.lists.total * STAGE_WEIGHTS.lists * perUnit;
  } else if (state.stage === "saving") {
    remaining += state.lists.total * STAGE_WEIGHTS.lists * perUnit;
  }
  return Math.round(remaining);
}

/** Hangi aşamalar gösterilir: özel liste yoksa "Listeler" adımı hiç çizilmez. */
export function visibleStages(state) {
  return IMPORT_STAGES.filter((stage) => stage !== "lists" || state.lists.total > 0);
}

/** "done" | "active" | "pending" */
export function stageStatus(state, stage) {
  const order = IMPORT_STAGES.indexOf(stage);
  const current = IMPORT_STAGES.indexOf(state.stage);
  if (state.finalized) return "done";
  if (order < current) return "done";
  if (order === current) return "active";
  return "pending";
}
