// Zevk Çemberleri Faz 5 sunucu hattı — emülatörde uçtan uca:
// katılım → profil → gece işi → öneri belgesi (uid yok) → karşılıklı selam → arkadaşlık → ayrılma temizliği.
const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const M = require("./matchServer");

const NOW = Date.UTC(2026, 10, 13, 12);
const DAY = 86400000;
const skip = !process.env.FIRESTORE_EMULATOR_HOST && "Firestore emulator required";

const optIn = { optIn: true, lanes: ["movie"], consentVersion: 1, updatedAt: new Date(NOW) };

async function seedUser(db, uid, { birthDate = "1990-05-05", start = 1, genres = ["Dram"], name = uid } = {}) {
  await db.doc(`Users/${uid}`).set({ displayName: `${name} görünen`, username: `${name}_kadi`, birthDate, avatarIndex: 2, email: `${uid}@x.test`, fourFavorites: { movies: [{ id: start }, { id: start + 1 }] } });
  const ratings = {};
  const batch = db.batch();
  for (let i = 0; i < 70; i += 1) {
    const id = start + i;
    batch.set(db.doc(`Lists/${uid}/watchedMovies/movie_${id}`), { id, type: "movie", name: `Film ${id}`, genres, minutes: 100, dateAdded: new Date(NOW - (i % 40) * DAY).toISOString() });
    ratings[`movie_${id}`] = 3 + (i % 8);
  }
  await batch.commit();
  await db.doc(`Lists/${uid}`).set({ updatedAt: new Date(NOW - DAY), activityIndex: { ratings, comments: [`movie_${start}`, `movie_${start + 1}`, `movie_${start + 2}`] } });
  await db.doc(`Users/${uid}/private/match`).set(optIn);
}

test("katılım → gece işi → selam → arkadaşlık → ayrılma", { skip }, async () => {
  const app = initializeApp({ projectId: "demo-match-server" }, "match-server-test");
  const db = getFirestore(app);
  try {
    await db.doc("AppConfig/match").set({ enabled: true });
    await seedUser(db, "alice", { start: 1 });
    await seedUser(db, "bob", { start: 1 });
    await seedUser(db, "carol", { start: 5000, genres: ["Komedi"] });
    await seedUser(db, "teen", { start: 1, birthDate: "2012-01-01" });

    // Tetikleyicinin işi: üyelik + profil. 18 altı hiç üye olmaz, profil oluşmaz.
    for (const uid of ["alice", "bob", "carol", "teen"]) {
      await M.syncMember(db, uid, (await db.doc(`Users/${uid}/private/match`).get()).data(), { now: NOW });
    }
    assert.equal((await db.doc("MatchMembers/teen").get()).exists, false);
    assert.equal((await db.doc("MatchProfiles/teen").get()).exists, false);
    const prof = (await db.doc("MatchProfiles/alice").get()).data();
    assert.equal(prof.lanes.movie.items.length, 70);
    assert.ok(!JSON.stringify(prof).includes("Film 1"), "profilde yapım adı yok");

    const summary = await M.runNightly(db, { now: NOW });
    assert.equal(summary.members, 3);
    const sug = (await db.doc("MatchSuggestions/alice").get()).data();
    const lane = sug.lanes.movie;
    assert.equal(lane.pool, 3);
    assert.equal(lane.twinsEnabled, false); // havuz < 150
    const text = JSON.stringify(sug);
    for (const secret of ["bob_kadi", "\"bob\"", "1990-05-05", "@x.test"]) assert.ok(!text.includes(secret), secret);
    const bobCard = lane.items.find((it) => it.displayName === "bob görünen");
    assert.ok(bobCard, "alice'e bob önerilir");
    assert.equal(bobCard.verdict, "near");
    assert.ok(!lane.items.some((it) => it.displayName === "carol görünen"), "zevki farklı carol önerilmez");

    // Yeniden çalıştırma aynı belgeyi yazar (opak kimlik belirlenimli).
    await M.runNightly(db, { now: NOW });
    assert.equal((await db.doc("MatchSuggestions/alice").get()).data().lanes.movie.items[0].cid, lane.items[0].cid);

    // Engel (karşı taraftan): selam gitmez, aday "bulunamadı" gibi görünür.
    await db.doc("Users/bob/blocked/alice").set({ at: NOW });
    await assert.rejects(M.sendHello(db, "alice", { cid: bobCard.cid }, { now: NOW }), { code: "not-found" });
    await db.doc("Users/bob/blocked/alice").delete();

    // Selam: tek taraflı → "sent"; karşı tarafın kartında greeted.
    assert.deepEqual(await M.sendHello(db, "alice", { cid: bobCard.cid }, { now: NOW }), { status: "sent" });
    assert.deepEqual(await M.sendHello(db, "alice", { cid: bobCard.cid }, { now: NOW }), { status: "already" });
    const bobLane = (await db.doc("MatchSuggestions/bob").get()).data().lanes.movie;
    const aliceCard = bobLane.items.find((it) => it.displayName === "alice görünen");
    assert.equal(aliceCard.greeted, true);
    await assert.rejects(M.sendHello(db, "bob", { cid: "yanlis_kimlik_123" }, { now: NOW }), { code: "not-found" });

    // Karşılıklı → arkadaşlık + iki tarafa bildirim.
    assert.deepEqual(await M.sendHello(db, "bob", { cid: aliceCard.cid }, { now: NOW }), { status: "mutual" });
    assert.equal((await db.doc("Users/alice/friends/bob").get()).get("friendUsername"), "bob_kadi");
    assert.equal((await db.doc("Users/bob/friends/alice").get()).exists, true);
    assert.equal((await db.doc("Users/alice").get()).get("friendsCount"), 1);
    const notes = await db.collection("Users/alice/notifications").get();
    assert.equal(notes.docs[0].get("type"), "friend_accepted");
    assert.equal(notes.docs[0].get("source"), "match");

    // Arkadaş kartı sunucu skoru: yalnız arkadaşa; yapım anahtarı dönmez.
    const pair = await M.pairScore(db, "alice", "bob");
    assert.equal(typeof pair.lanes.movie.display, "number");
    assert.ok(!JSON.stringify(pair).includes("movie_"));
    await assert.rejects(M.pairScore(db, "alice", "carol"), { code: "permission-denied" });

    // Ayrılma: bob'un bütün eşleşme verisi silinir ve alice'in önerisinden düşer.
    await M.syncMember(db, "bob", null, { now: NOW });
    for (const path of ["MatchMembers/bob", "MatchProfiles/bob", "MatchSuggestions/bob", "MatchPairs/bob", "MatchHellos/alice_bob"]) {
      assert.equal((await db.doc(path).get()).exists, false, path);
    }
    const after = (await db.doc("MatchSuggestions/alice").get()).data().lanes.movie.items;
    assert.ok(!after.some((it) => it.cid === bobCard.cid));
    assert.ok(!Object.values((await db.doc("MatchPairs/alice").get()).get("map")).some((v) => v.uid === "bob"));
    // Arkadaşlık bozulmaz (§8: kurulmuş arkadaşlık skordan bağımsız).
    assert.equal((await db.doc("Users/alice/friends/bob").get()).exists, true);
  } finally {
    await db.recursiveDelete(db.collection("Users"));
    for (const c of ["Lists", "MatchMembers", "MatchProfiles", "MatchSuggestions", "MatchPairs", "MatchHellos", "MatchMeta", "AppConfig", "TitleFeatures"]) {
      await db.recursiveDelete(db.collection(c));
    }
    await deleteApp(app);
  }
});

test("bayrak kapalıyken gece işi hiçbir şey yazmaz; selam reddedilir", { skip }, async () => {
  const app = initializeApp({ projectId: "demo-match-off" }, "match-off-test");
  const db = getFirestore(app);
  try {
    assert.deepEqual(await M.runNightly(db, { now: NOW }), { skipped: "disabled" });
    assert.equal((await db.collection("MatchSuggestions").get()).size, 0);
    await assert.rejects(M.sendHello(db, "a", { cid: "abcdefghijklmnop" }, { now: NOW }), { code: "failed-precondition" });
  } finally {
    await deleteApp(app);
  }
});

test("yapım özellikleri: eksikler TMDB'den çekilir, taze olan yeniden istenmez", { skip }, async () => {
  const app = initializeApp({ projectId: "demo-match-tf" }, "match-tf-test");
  const db = getFirestore(app);
  try {
    await db.doc("TitleFeatures/movie_1").set({ type: "movie", fetchedAt: NOW - DAY, kw: [] });
    const asked = [];
    const fetchTitle = async (type, id) => {
      asked.push(`${type}_${id}`);
      return { vote_average: 7, vote_count: 100, original_language: "en", release_date: "2001-01-01", keywords: { keywords: [{ id: 9 }] } };
    };
    const map = await M.loadTitleFeatures(db, ["movie_1", "movie_2", "movie_2", "bozuk"], { fetchTitle, now: NOW });
    assert.deepEqual(asked, ["movie_2"]);
    assert.deepEqual(map.get("movie_2").kw, [9]);
    assert.equal((await db.doc("TitleFeatures/movie_2").get()).get("year"), 2001);
  } finally {
    await db.recursiveDelete(db.collection("TitleFeatures"));
    await deleteApp(app);
  }
});
