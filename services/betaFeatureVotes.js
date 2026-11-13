import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, fns } from "../firebase";
import { isBetaFeature } from "../utils/betaFeatures";

export function listenMyBetaVote(featureId, uid, onVote, onError) {
  if (!isBetaFeature(featureId) || !uid) return () => {};
  return onSnapshot(
    doc(db, "betaFeatureVotes", featureId, "votes", uid),
    (snapshot) => onVote(snapshot.exists() ? snapshot.data()?.choice || null : null),
    onError,
  );
}

const voteBetaFeature = httpsCallable(fns, "voteBetaFeature");

export async function castBetaVote(featureId, choice) {
  if (!isBetaFeature(featureId) || !["like", "dislike"].includes(choice)) {
    throw new Error("invalid-beta-vote");
  }
  const result = await voteBetaFeature({ featureId, choice });
  return result.data;
}
