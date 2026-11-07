// Haftalık Lig — GERÇEK Firestore (emülatör) üzerinde transaction'lar.
//
// `npm test` içinde ATLANIR (emülatör yoksa); çalıştırmak için kökten:
//   export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" PATH="$JAVA_HOME/bin:$PATH"
//   npx firebase emulators:exec --only firestore --project demo-league \
//     "node --test functions/league.integration.test.js"
//
// Neyi kanıtlar: ilk XP'de gruba katılma ve grup dolunca yenisinin açılması, günlük tavan ve tekrarın
// sunucuda tutması, hafta dönümünün iki yolunun (çağrı + zamanlanmış iş) AYNI sonucu yazması ve
// zamanlanmış işin çağrı yolunun sonuçlandırdığı oyuncuyu ezmemesi. Saf kurallar: __tests__/leagueRules.test.js.

const test = require("node:test");
const assert = require("node:assert/strict");

const emulator = process.env.FIRESTORE_EMULATOR_HOST;
const skip = emulator ? false : "FIRESTORE_EMULATOR_HOST yok (emülatör gerekir)";

let db;
let league;
let rules;

const FRI = Date.parse("2026-10-30T12:00:00Z"); // hafta 2026-10-26
const NEXT_MON = Date.parse("2026-11-02T08:00:00Z"); // hafta 2026-11-02

test.before(async () => {
  if (skip) return;
  process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "demo-league";
  const { initializeApp } = require("firebase-admin/app");
  const { getFirestore } = require("firebase-admin/firestore");
  initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  db = getFirestore();
  league = require("./league");
  rules = require("./leagueRules");
});

test.beforeEach(async () => {
  if (skip) return;
  for (const name of ["LeagueUsers", "LeagueWeeks"]) await db.recursiveDelete(db.collection(name));
});

const award = (uid, source, ref, nowMs = FRI) =>
  league.awardXp(db, { uid, source, ref, nowMs, identity: { displayName: uid, avatarIndex: 1 } });

test("ilk XP gruba sokar; tekrar ve günlük tavan sunucuda tutar", { skip }, async () => {
  const first = await award("u1", "watch", "movie:550");
  assert.deepEqual(
    { awarded: first.awarded, tier: first.tier, groupId: first.groupId, week: first.week, xp: first.xp },
    { awarded: 10, tier: 0, groupId: "bronze-1", week: "2026-10-26", xp: 10 },
  );
  const member = (await db.doc("LeagueWeeks/2026-10-26/groups/bronze-1/leagueMembers/u1").get()).data();
  assert.equal(member.xp, 10);
  assert.equal(member.displayNameSnapshot, "u1");

  assert.equal((await award("u1", "watch", "movie:550")).reason, "duplicate");
  for (let i = 1; i < rules.XP_SOURCES.watch.daily; i += 1) await award("u1", "watch", `movie:${1000 + i}`);
  const capped = await award("u1", "watch", "movie:9999");
  assert.equal(capped.reason, "daily_cap");
  assert.equal(capped.xp, rules.XP_SOURCES.watch.daily * rules.XP_SOURCES.watch.xp);
});

test("grup GROUP_SIZE kişide dolar, sıradaki yeni gruba girer", { skip }, async () => {
  for (let i = 0; i < rules.GROUP_SIZE; i += 1) await award(`p${i}`, "game", `quick:older:${i}`);
  const extra = await award("late", "game", "quick:older:x");
  assert.equal(extra.groupId, "bronze-2");
  const g1 = (await db.doc("LeagueWeeks/2026-10-26/groups/bronze-1").get()).data();
  assert.equal(g1.size, rules.GROUP_SIZE);
  const open = (await db.doc("LeagueWeeks/2026-10-26/open/bronze").get()).data();
  assert.deepEqual(open, { groupId: "bronze-2", size: 1, count: 2 });
});

test("hafta dönümü: çağrı yolu ve zamanlanmış iş aynı sonucu yazar, birbirini ezmez", { skip }, async () => {
  // 6 kişi, XP'ler farklı: a en çok (terfi, ≥100 XP), f en az (bronzda düşme yok → kalır).
  const plan = { a: 12, b: 8, c: 6, d: 4, e: 2, f: 1 };
  for (const [uid, games] of Object.entries(plan)) {
    for (let i = 0; i < games; i += 1) {
      // Günlük tavanı aşmamak için oyunları günlere yay (pazartesi → cuma).
      const day = Math.floor(i / rules.XP_SOURCES.game.daily);
      await award(uid, "game", `quick:popular:${uid}${i}`, Date.parse("2026-10-26T09:00:00Z") + day * rules.DAY_MS + i);
    }
  }

  // a yeni haftada oynar → kendi geçen haftasını kendisi sonuçlandırır, yeni liginde gruba girer.
  const aNext = await award("a", "watch", "movie:1", NEXT_MON);
  assert.equal(aNext.settled.outcome, "up");
  assert.equal(aNext.tier, 1);
  assert.equal(aNext.groupId, "silver-1");
  assert.equal(aNext.week, "2026-11-02");

  const done = await league.settleWeek(db, "2026-10-26", NEXT_MON);
  assert.equal(done.groups, 1);
  assert.equal(done.players, 5); // a atlandı

  const a = (await db.doc("LeagueUsers/a").get()).data();
  assert.equal(a.week, "2026-11-02"); // zamanlanmış iş yeni haftayı ezmedi
  assert.equal(a.lastResult.rank, 1);
  const f = (await db.doc("LeagueUsers/f").get()).data();
  assert.deepEqual(
    { tier: f.tier, outcome: f.lastResult.outcome, rank: f.lastResult.rank, size: f.lastResult.size },
    { tier: 0, outcome: "stay", rank: 6, size: 6 },
  );
  const b = (await db.doc("LeagueUsers/b").get()).data();
  assert.equal(b.lastResult.outcome, "stay"); // 6 kişide yalnız 1 terfi

  // İkinci çalışma hiçbir şey yazmaz.
  assert.deepEqual(await league.settleWeek(db, "2026-10-26", NEXT_MON), { groups: 0, players: 0 });
});

test("oy doğrulaması gerçek oy belgesine bakar", { skip }, async () => {
  assert.equal(await league.voteExists(db, "u1", "poll:2026-10-30"), false);
  await db.doc("DailyPolls/2026-10-30/votes/u1").set({ choice: "a" });
  await db.doc("Top100Hype/movie_550/votes/u1").set({ hype: true });
  assert.equal(await league.voteExists(db, "u1", "poll:2026-10-30"), true);
  assert.equal(await league.voteExists(db, "u1", "top100:movie_550"), true);
  assert.equal(await league.voteExists(db, "u2", "top100:movie_550"), false);
  assert.equal(await league.voteExists(db, "u1", "nope"), false);
});
