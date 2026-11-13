const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { castVote, removeVotesForUser, BETA_FEATURE_IDS } = require("./betaFeatureVotes");

test("beta votes stay one per user and keep stored totals consistent", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST && "Firestore emulator required",
}, async () => {
  const app = initializeApp({ projectId: "demo-beta-votes" }, "beta-vote-test");
  const db = getFirestore(app);
  const total = db.doc("betaFeatureVotes/atmosphere");
  const own = total.collection("votes").doc("alice");
  try {
    assert.deepEqual(await castVote(db, "alice", "atmosphere", "like"), { choice: "like", changed: true });
    assert.deepEqual(await castVote(db, "alice", "atmosphere", "like"), { choice: "like", changed: false });
    await castVote(db, "bob", "atmosphere", "dislike");
    assert.equal((await total.get()).get("likes"), 1);
    assert.equal((await total.get()).get("dislikes"), 1);
    await castVote(db, "alice", "atmosphere", "dislike");
    assert.equal((await total.get()).get("likes"), 0);
    assert.equal((await total.get()).get("dislikes"), 2);
    assert.equal((await own.get()).get("choice"), "dislike");
    await assert.rejects(castVote(db, "alice", "unknown", "like"));
    await assert.rejects(castVote(db, "alice", "atmosphere", "other"));
    await removeVotesForUser(db, "alice");
    assert.equal((await own.get()).exists, false);
    assert.equal((await total.get()).get("dislikes"), 1);
  } finally {
    await db.recursiveDelete(total);
    await deleteApp(app);
  }
});

test("server and app beta feature ids match", () => {
  const fs = require("node:fs");
  const source = fs.readFileSync(require("node:path").join(__dirname, "..", "utils", "betaFeatures.js"), "utf8");
  for (const id of BETA_FEATURE_IDS) assert.match(source, new RegExp(`"${id}"`));
});
