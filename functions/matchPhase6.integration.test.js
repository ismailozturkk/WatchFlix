// Zevk Çemberleri Faz 6 sunucu eylemleri — emülatörde:
// gizle / engelle / şikâyet (opak kimlikle) ve çember → grup sohbeti.
const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const M = require("./matchServer");

const NOW = Date.UTC(2026, 10, 13, 12);
const skip = !process.env.FIRESTORE_EMULATOR_HOST && "Firestore emulator required";

const card = (cid, name) => ({ cid, verdict: "near", score: 84, displayName: name, avatarIndex: 1, photoURL: null, loved: [], split: null, implicitHeavy: false, greeted: false, sent: false });

async function cleanup(db) {
  for (const c of ["Users", "MatchMembers", "MatchSuggestions", "MatchPairs", "MatchCircles", "ContentReports", "groups", "AppConfig"]) {
    await db.recursiveDelete(db.collection(c));
  }
}

test("gizle / engelle / şikâyet: aday öneriden düşer, gizlenir, engel ve şikâyet yazılır", { skip }, async () => {
  const app = initializeApp({ projectId: "demo-match-actions" }, "match-actions-test");
  const db = getFirestore(app);
  try {
    await db.doc("Users/alice").set({ displayName: "Alice" });
    for (const u of ["bob", "carol", "dave"]) await db.doc(`Users/${u}`).set({ displayName: `${u} görünen` });
    await db.doc("MatchMembers/alice").set({ lanes: ["movie"] });
    const map = { cid_bob_00001: { uid: "bob", lane: "movie" }, cid_carol_0001: { uid: "carol", lane: "movie" }, cid_dave_00001: { uid: "dave", lane: "movie" } };
    await db.doc("MatchPairs/alice").set({ map, uids: ["bob", "carol", "dave"] });
    await db.doc("MatchSuggestions/alice").set({ v: 1, lanes: { movie: { pool: 4, items: [card("cid_bob_00001", "bob görünen"), card("cid_carol_0001", "carol görünen"), card("cid_dave_00001", "dave görünen")] } } });

    await assert.rejects(M.matchAction(db, "alice", { cid: "cid_bob_00001", action: "sil" }), { code: "invalid-argument" });
    await assert.rejects(M.matchAction(db, "alice", { cid: "yok_boyle_bir_cid", action: "hide" }), { code: "not-found" });

    assert.deepEqual(await M.matchAction(db, "alice", { cid: "cid_bob_00001", action: "hide" }), { status: "ok" });
    assert.deepEqual(await M.matchAction(db, "alice", { cid: "cid_carol_0001", action: "block" }), { status: "ok" });
    assert.deepEqual(await M.matchAction(db, "alice", { cid: "cid_dave_00001", action: "report", reason: "harassment" }), { status: "ok" });

    const items = (await db.doc("MatchSuggestions/alice").get()).get("lanes").movie.items;
    assert.equal(items.length, 0);
    const pairs = (await db.doc("MatchPairs/alice").get()).data();
    assert.deepEqual(pairs.map, {});
    assert.deepEqual(pairs.uids, []);
    assert.deepEqual((await db.doc("MatchMembers/alice").get()).get("hidden"), ["bob", "carol", "dave"]);
    assert.equal((await db.doc("Users/alice/blocked/carol").get()).exists, true);
    assert.equal((await db.doc("Users/alice/blocked/bob").get()).exists, false, "gizle engel değildir");
    const reports = (await db.collection("ContentReports").get()).docs.map((d) => d.data());
    assert.equal(reports.length, 1);
    assert.equal(reports[0].targetUserId, "dave");
    assert.equal(reports[0].reporterId, "alice");
    assert.equal(reports[0].reason, "harassment");
    assert.equal(reports[0].source, "match");
    assert.equal(reports[0].targetPreview, "dave görünen");
  } finally {
    await cleanup(db);
    await deleteApp(app);
  }
});

test("çember: 3. katılımda grup kurulur, 4. katılan gruba eklenir; katılmayana grup kimliği verilmez", { skip }, async () => {
  const app = initializeApp({ projectId: "demo-match-circle" }, "match-circle-test");
  const db = getFirestore(app);
  try {
    await db.doc("AppConfig/match").set({ enabled: true });
    const members = ["u1", "u2", "u3", "u4", "u5"];
    const circle = { key: "circlekey_abcdefghij", size: 5, genres: ["drama"], joined: false, joinedCount: 0, groupId: null, groupReady: false };
    for (const u of members) {
      await db.doc(`Users/${u}`).set({ displayName: `${u} ad`, username: `${u}_kadi`, avatarIndex: 3 });
      await db.doc(`MatchSuggestions/${u}`).set({ v: 1, lanes: { movie: { items: [], circle } } });
    }
    await db.doc("MatchCircles/circlekey_abcdefghij").set({ lane: "movie", members, genres: ["drama"], updatedAt: NOW });
    await db.doc("Users/outsider").set({ displayName: "dışarıda" });
    await db.doc("MatchSuggestions/outsider").set({ v: 1, lanes: { movie: { items: [], circle } } });

    await assert.rejects(M.joinCircle(db, "outsider", { lane: "movie" }, { now: NOW }), { code: "not-found" });
    await assert.rejects(M.joinCircle(db, "u1", { lane: "anime" }, { now: NOW }), { code: "invalid-argument" });

    let r = await M.joinCircle(db, "u1", { lane: "movie", name: "Zevk Çemberi" }, { now: NOW });
    assert.equal(r.status, "waiting");
    assert.equal(r.joined, 1);
    assert.equal(r.size, 5);
    // Tekrar katılmak sayacı artırmaz.
    assert.equal((await M.joinCircle(db, "u1", { lane: "movie" }, { now: NOW })).joined, 1);
    r = await M.joinCircle(db, "u2", { lane: "movie", name: "Zevk Çemberi" }, { now: NOW + 1 });
    assert.equal(r.status, "waiting");

    // u4, u2'yi engellemiş: u4 katılamaz.
    await db.doc("Users/u4/blocked/u2").set({ at: NOW });
    await assert.rejects(M.joinCircle(db, "u4", { lane: "movie" }, { now: NOW + 2 }), { code: "failed-precondition" });
    await db.doc("Users/u4/blocked/u2").delete();

    r = await M.joinCircle(db, "u3", { lane: "movie", name: "  Zevk Çemberi  " }, { now: NOW + 3 });
    assert.equal(r.status, "group");
    assert.equal(r.created, true);
    const group = (await db.doc(`groups/${r.groupId}`).get()).data();
    assert.deepEqual(group.members, ["u1", "u2", "u3"]);
    assert.equal(group.createdBy, "u1");
    assert.equal(group.name, "Zevk Çemberi");
    assert.equal(group.source, "match");
    // Kullanıcı adı grup kartına yazılmaz (gizlilik metni 1.8).
    assert.deepEqual(group.memberInfo.u2, { name: "u2 ad", username: "", avatarIndex: 3, photoURL: null });
    // Diğer katılanlara bildirim; kurana değil.
    for (const u of ["u1", "u2"]) {
      const notes = (await db.collection(`Users/${u}/notifications`).get()).docs.map((d) => d.data());
      assert.equal(notes.length, 1, u);
      assert.equal(notes[0].type, "match_circle");
      assert.equal(notes[0].groupId, r.groupId);
    }
    assert.equal((await db.collection("Users/u3/notifications").get()).size, 0);
    // Öneri belgeleri: katılana grup kimliği, katılmayana yalnız "hazır".
    const view = async (u) => (await db.doc(`MatchSuggestions/${u}`).get()).get("lanes").movie.circle;
    assert.equal((await view("u1")).groupId, r.groupId);
    assert.equal((await view("u1")).joinedCount, 3);
    assert.equal((await view("u5")).groupId, null);
    assert.equal((await view("u5")).groupReady, true);
    assert.equal((await view("u5")).joined, false);

    const late = await M.joinCircle(db, "u4", { lane: "movie" }, { now: NOW + 4 });
    assert.equal(late.status, "group");
    assert.equal(late.groupId, r.groupId);
    assert.ok(!late.created);
    const after = (await db.doc(`groups/${r.groupId}`).get()).data();
    assert.deepEqual(after.members, ["u1", "u2", "u3", "u4"]);
    assert.equal(after.memberInfo.u4.name, "u4 ad");

    // Ayrılan üye çember kaydından düşer; grup bozulmaz.
    await M.removeMember(db, "u2");
    const rec = (await db.doc("MatchCircles/circlekey_abcdefghij").get()).data();
    assert.ok(!rec.members.includes("u2"));
    assert.ok(!("u2" in rec.joined));
    assert.ok((await db.doc(`groups/${r.groupId}`).get()).get("members").includes("u2"));
  } finally {
    await cleanup(db);
    await deleteApp(app);
  }
});
