// Beta özellik oylaması: her kullanıcı ve özellik için tek belge, toplamlar yalnız
// Admin SDK tarafından aynı Firestore transaction'ında güncellenir.
const { FieldValue } = require("firebase-admin/firestore");

const BETA_FEATURE_IDS = Object.freeze([
  "league", "challenges", "tierlist", "top100", "chain", "rating",
  "daily_frame", "film_club", "atmosphere", "profile_banner",
  "app_icon", "streak_flame", "match",
]);

const isValidFeature = (id) => typeof id === "string" && BETA_FEATURE_IDS.includes(id);
const isValidChoice = (choice) => choice === "like" || choice === "dislike";

async function castVote(db, uid, featureId, choice) {
  if (!uid || !isValidFeature(featureId) || !isValidChoice(choice)) {
    throw new Error("invalid-beta-vote");
  }
  const totalRef = db.doc(`betaFeatureVotes/${featureId}`);
  const voteRef = totalRef.collection("votes").doc(uid);
  return db.runTransaction(async (tx) => {
    const before = await tx.get(voteRef);
    const previous = before.exists ? before.get("choice") : null;
    if (previous === choice) return { choice, changed: false };
    const likes = (choice === "like" ? 1 : 0) - (previous === "like" ? 1 : 0);
    const dislikes = (choice === "dislike" ? 1 : 0) - (previous === "dislike" ? 1 : 0);
    tx.set(voteRef, { choice, updatedAt: FieldValue.serverTimestamp() });
    tx.set(totalRef, {
      likes: FieldValue.increment(likes),
      dislikes: FieldValue.increment(dislikes),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { choice, changed: true };
  });
}

async function removeVotesForUser(db, uid) {
  for (const featureId of BETA_FEATURE_IDS) {
    const totalRef = db.doc(`betaFeatureVotes/${featureId}`);
    const voteRef = totalRef.collection("votes").doc(uid);
    await db.runTransaction(async (tx) => {
      const vote = await tx.get(voteRef);
      if (!vote.exists) return;
      const choice = vote.get("choice");
      tx.delete(voteRef);
      if (isValidChoice(choice)) {
        tx.set(totalRef, {
          [choice === "like" ? "likes" : "dislikes"]: FieldValue.increment(-1),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    });
  }
}

module.exports = { BETA_FEATURE_IDS, isValidFeature, isValidChoice, castVote, removeVotesForUser };
