// services/matchAnalytics.js
//
// Zevk Çemberleri ölçümü (Faz 4). Kimlik / liste / skor YOK; yalnız kulvar, güç kademesi ve adım kimliği.
// Oturum belleği modül düzeyindedir: kulvar başına bir kez MATCH_STRENGTH_VIEWED; oturum içinde
// görülen sonraki adım değişince MATCH_STEP_DONE (önceki adım tamamlandı sayılır).

import { ANALYTICS_EVENTS, trackEvent } from "./analytics";
import { strengthTier } from "../utils/matchFeature";

const viewedLanes = new Set();
const lastStep = new Map();

export function trackLaneView(lane, info) {
  if (!info) return;
  if (!viewedLanes.has(lane)) {
    viewedLanes.add(lane);
    trackEvent(ANALYTICS_EVENTS.MATCH_STRENGTH_VIEWED, { lane, tier: strengthTier(info), eligible: info.eligible ? 1 : 0 });
  }
  const prev = lastStep.get(lane);
  const cur = info.next?.id;
  if (prev && cur && prev !== cur) trackEvent(ANALYTICS_EVENTS.MATCH_STEP_DONE, { lane, step: prev });
  if (cur) lastStep.set(lane, cur);
}

/** Yalnız testler: oturum belleğini sıfırlar. */
export function resetMatchAnalyticsSession() {
  viewedLanes.clear();
  lastStep.clear();
}
