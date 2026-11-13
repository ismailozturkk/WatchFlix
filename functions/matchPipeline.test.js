// Zevk Çemberleri Faz 5 — sunucu hattının saf çekirdeği (emülatörsüz).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = require("./matchPipeline");

const NOW = Date.UTC(2026, 10, 13, 12);
const DAY = P.DAY;

const fakeResult = (score, extra = {}) => ({
  score,
  display: Math.max(0, Math.min(100, Math.round(score))),
  flags: { guide: false, implicitHeavy: false, ...(extra.flags || {}) },
  explain: { loved: ["movie_1", "movie_2"], split: "movie_9", ...(extra.explain || {}) },
});

/** Simetrik skor tablosu → scores Map (decideSuggestions / formCircles girdisi). */
function tableToScores(table) {
  const scores = new Map();
  const add = (a, b, s) => {
    if (!scores.has(a)) scores.set(a, []);
    scores.get(a).push({ uid: b, r: fakeResult(s) });
  };
  for (const [pair, s] of Object.entries(table)) {
    const [a, b] = pair.split("-");
    add(a, b, s);
    add(b, a, s);
  }
  for (const list of scores.values()) list.sort((x, y) => y.r.score - x.r.score || (x.uid < y.uid ? -1 : 1));
  return scores;
}

test("onay sürümü ve bilinmeyen kulvarlar: istemciyle aynı kural", () => {
  assert.deepEqual(P.readOptIn({ optIn: true, lanes: ["movie", "korku"], consentVersion: 1 }), { optedIn: true, lanes: ["movie"] });
  assert.deepEqual(P.readOptIn({ optIn: true, lanes: ["movie"], consentVersion: 0 }), { optedIn: false, lanes: [] });
  assert.deepEqual(P.readOptIn({ optIn: true, lanes: [], consentVersion: 1 }), { optedIn: false, lanes: [] });
  assert.deepEqual(P.readOptIn(null), { optedIn: false, lanes: [] });
  const client = fs.readFileSync(path.join(__dirname, "..", "utils", "matchFeature.js"), "utf8");
  assert.match(client, new RegExp(`MATCH_CONSENT_VERSION = ${P.CONSENT_VERSION}\\b`));
});

test("yaş kapısı: kanıtsız tarih = reşit değil", () => {
  const now = new Date(2026, 10, 13);
  assert.equal(P.isAdultBirthDate("2008-11-13", now), true);
  assert.equal(P.isAdultBirthDate("2008-11-14", now), false);
  for (const bad of [null, undefined, "", "2008-02-30", "13/11/2000", 20001113]) assert.equal(P.isAdultBirthDate(bad, now), false);
});

test("yapılandırma: yalnız bilinen sayısal alanlar ezilir", () => {
  const c = P.parseServerConfig({ enabled: true, twinPoolMin: 30, maxSuggestions: "9", core: { twinThreshold: 88, yok: 1, gamma: "x" } });
  assert.equal(c.enabled, true);
  assert.equal(c.server.twinPoolMin, 30);
  assert.equal(c.server.maxSuggestions, P.SERVER_DEFAULTS.maxSuggestions);
  assert.deepEqual(c.core, { twinThreshold: 88 });
  assert.equal(P.parseServerConfig({ enabled: "true" }).enabled, false);
});

test("profil girdisi: kulvara ayrılır, ad/afiş saklanmaz, güç hesaplanır", () => {
  const watchedMovies = Array.from({ length: 70 }, (_, i) => ({
    id: i + 1,
    name: `Film ${i}`,
    imagePath: "/p.jpg",
    genres: ["Dram"],
    minutes: 110,
    dateAdded: new Date(NOW - i * 2 * DAY).toISOString(),
  }));
  const watchedShows = [{ id: 5, name: "Dizi", genres: ["Komedi"], watchedEpisodeCount: 8, showEpisodeCount: 20, watchEvents: [{ watchedAt: NOW - 200 * DAY }] }];
  const { lanes } = P.buildLaneInputs({
    side: { watchedMovies, watchedShows, favorites: [{ id: 1, type: "movie" }], ratings: { movie_1: 9 } },
    fourFavorites: { movies: [{ id: 1 }, { id: 2 }] },
    lanes: ["movie", "tv"],
    now: NOW,
  });
  assert.equal(lanes.movie.items.length, 70);
  assert.equal(lanes.tv.items.length, 1);
  const text = JSON.stringify(lanes);
  assert.ok(!text.includes("Film 0") && !text.includes("/p.jpg") && !text.includes("Dizi\""));
  assert.deepEqual(lanes.movie.items.find((it) => it.key === "movie_1"), { key: "movie_1", g: ["Dram"], r: 9, f: 1, m: 110, at: Date.parse(watchedMovies[0].dateAdded) });
  assert.equal(lanes.tv.items[0].ep, 8);
  assert.equal(lanes.movie.strength.eligible, true); // izleme yolu: 60+ film, 2 favori, yakın tarihli
  assert.equal(typeof lanes.movie.strength.strength, "number");
});

test("TMDB → TitleFeatures: kişisel veri yok; dizi bitirme / bırakma", () => {
  const tf = P.titleFeaturesFromTmdb("tv", {
    vote_average: 8.1, vote_count: 900, original_language: "ja", first_air_date: "2004-10-01",
    number_of_episodes: 20, status: "Ended", keywords: { results: [{ id: 11 }, { id: 12 }] }, production_companies: [{ id: 3 }],
  }, NOW);
  assert.deepEqual(tf, { type: "tv", voteAverage: 8.1, voteCount: 900, lang: "ja", year: 2004, kw: [11, 12], studios: [3], fetchedAt: NOW, episodes: 20, status: "Ended" });
  const fin = P.enrichItem({ key: "tv_5", g: [], ep: 20 }, tf, NOW);
  assert.deepEqual(fin.tv, { finished: true });
  assert.deepEqual(fin.features, ["kw:11", "kw:12", "lang:ja", "studio:3"]);
  const dropped = P.enrichItem({ key: "tv_5", g: [], ep: 3, last: NOW - 200 * DAY }, tf, NOW);
  assert.deepEqual(dropped.tv, { dropped: true });
  // Devam eden dizi bırakılmış sayılmaz; yakın zamanda izlenen de.
  assert.equal(P.enrichItem({ key: "tv_5", g: [], ep: 3, last: NOW - 200 * DAY }, { ...tf, status: "Returning Series" }, NOW).tv, undefined);
  assert.equal(P.enrichItem({ key: "tv_5", g: [], ep: 3, last: NOW - 10 * DAY }, tf, NOW).tv, undefined);
});

test("havuz: 18+, kulvar seçili, güç yeterli ve boş değil", () => {
  const lane = (eligible, n = 3) => ({ items: Array.from({ length: n }, (_, i) => ({ key: `movie_${i}` })), strength: { eligible } });
  const members = [
    { uid: "a", adult: true, lanes: ["movie"], profile: { lanes: { movie: lane(true) } } },
    { uid: "b", adult: false, lanes: ["movie"], profile: { lanes: { movie: lane(true) } } },
    { uid: "c", adult: true, lanes: ["tv"], profile: { lanes: { movie: lane(true) } } },
    { uid: "d", adult: true, lanes: ["movie"], profile: { lanes: { movie: lane(false) } } },
    { uid: "e", adult: true, lanes: ["movie"], profile: { lanes: { movie: lane(true, 0) } } },
  ];
  assert.deepEqual(P.laneEligible(members, "movie").map((m) => m.uid), ["a"]);
});

test("karar: küçük havuzda ikiz iddiası yok, 80+ 'near'; büyük havuzda karşılıklı ilk N + etkinlik ile 'twin'", () => {
  const scores = tableToScores({ "a-b": 95, "a-c": 82, "a-d": 60, "b-c": 70 });
  const all = new Set(["a", "b", "c", "d"]);
  const small = P.decideSuggestions(scores, { active: all, poolSize: 4 });
  assert.equal(small.twinsEnabled, false);
  assert.deepEqual(small.suggestions.get("a").map((x) => [x.uid, x.verdict]), [["b", "near"], ["c", "near"]]);
  const big = P.decideSuggestions(scores, { active: all, poolSize: 200 });
  assert.deepEqual(big.suggestions.get("a").map((x) => [x.uid, x.verdict]), [["b", "twin"], ["c", "near"]]);
  // b etkin değil → ikiz değil
  const idle = P.decideSuggestions(scores, { active: new Set(["a", "c", "d"]), poolSize: 200 });
  assert.equal(idle.suggestions.get("a")[0].verdict, "near");
  // karşılıklı ilk N değil → ikiz değil (mutualTop 1: b'nin ilk 1'i a, a'nınki b → ikiz; c için a ilk değil)
  const strict = P.decideSuggestions(tableToScores({ "a-b": 95, "c-b": 97, "a-c": 50 }), { active: new Set(["a", "b", "c"]), poolSize: 200, cfg: { ...P.SERVER_DEFAULTS, mutualTop: 1 } });
  assert.equal(strict.suggestions.get("a")[0].verdict, "near");
});

test("karar: rehber (guide) yüzdesiz; en çok 5 aday", () => {
  const scores = new Map([["a", [{ uid: "g", r: fakeResult(70, { flags: { guide: true } }) }, ...Array.from({ length: 8 }, (_, i) => ({ uid: `n${i}`, r: fakeResult(85) }))]]]);
  const { suggestions } = P.decideSuggestions(scores, { poolSize: 10 });
  assert.equal(suggestions.get("a").length, 5);
  assert.equal(suggestions.get("a")[0].verdict, "guide");
  const { items } = P.buildLaneSuggestion({ owner: "a", lane: "movie", picks: suggestions.get("a"), salt: "s", cards: new Map() });
  assert.equal(items[0].score, null);
  assert.equal(items[1].score, 85);
});

test("GİZLİLİK: öneri kartında uid, kullanıcı adı, doğum tarihi, e-posta yok; cid sahibe özel ve belirlenimli", () => {
  const cards = new Map([["bob", P.publicCard({ displayName: "Bob", username: "bobby", birthDate: "1990-01-01", email: "b@x.y", avatarIndex: 3, photoURL: "https://p" })]]);
  const picks = [{ uid: "bob", verdict: "near", r: fakeResult(84) }];
  const forAlice = P.buildLaneSuggestion({ owner: "alice", lane: "movie", picks, salt: "s1", cards, greetedBy: new Set(["bob"]) });
  const [card] = forAlice.items;
  assert.deepEqual(Object.keys(card).sort(), ["avatarIndex", "cid", "displayName", "greeted", "implicitHeavy", "loved", "photoURL", "score", "sent", "split", "verdict"]);
  const text = JSON.stringify(forAlice.items);
  for (const secret of ["bob\"", "bobby", "1990", "b@x.y"]) assert.ok(!text.includes(secret), secret);
  assert.equal(card.greeted, true);
  assert.equal(forAlice.map[card.cid], "bob");
  const forCarol = P.buildLaneSuggestion({ owner: "carol", lane: "movie", picks, salt: "s1", cards });
  assert.notEqual(forCarol.items[0].cid, card.cid);
  assert.equal(P.opaqueId("s1", "alice", "bob", "movie"), card.cid);
  assert.notEqual(P.opaqueId("s2", "alice", "bob", "movie"), card.cid);
});

test("çember: 3–10 kişi, ortalama ≥ 88 ve en düşük ≥ 80; kapalıyken hiç", () => {
  const strong = {};
  const ids = ["a", "b", "c", "d"];
  for (let i = 0; i < ids.length; i += 1) for (let j = i + 1; j < ids.length; j += 1) strong[`${ids[i]}-${ids[j]}`] = 92;
  strong["d-e"] = 95; // e yalnız d'ye yakın → çembere giremez
  strong["a-e"] = 60;
  const scores = tableToScores(strong);
  assert.deepEqual(P.formCircles(scores), [["a", "b", "c", "d"]]);
  assert.deepEqual(P.formCircles(scores, { enabled: false }), []);
  // ortalama şartı: herkes 81 → ortalama 88'in altında → çember yok
  assert.deepEqual(P.formCircles(tableToScores({ "a-b": 81, "a-c": 81, "b-c": 81 })), []);
  // 2 kişi çember değildir
  assert.deepEqual(P.formCircles(tableToScores({ "a-b": 99 })), []);
});

test("çember: en çok 10 üye; anahtar üyelerden türetilir ve uid içermez", () => {
  const table = {};
  const ids = Array.from({ length: 13 }, (_, i) => `u${String(i).padStart(2, "0")}`);
  for (let i = 0; i < ids.length; i += 1) for (let j = i + 1; j < ids.length; j += 1) table[`${ids[i]}-${ids[j]}`] = 90;
  const circles = P.formCircles(tableToScores(table));
  assert.equal(circles[0].length, 10);
  const key = P.circleKey("s", "movie", circles[0]);
  assert.equal(key, P.circleKey("s", "movie", [...circles[0]].reverse()));
  assert.ok(!key.includes("u0"));
});

test("selam kotası: günde en çok N; ertesi gün sıfırlanır", () => {
  let quota = null;
  for (let i = 0; i < 3; i += 1) {
    const r = P.nextHelloQuota(quota, NOW, 3);
    assert.equal(r.allowed, true);
    quota = r.quota;
  }
  assert.equal(P.nextHelloQuota(quota, NOW, 3).allowed, false);
  assert.equal(P.nextHelloQuota(quota, NOW + DAY, 3).allowed, true);
  assert.equal(P.helloKey("b", "a"), "a_b");
});

test("profil yeniden kurulumu: damga değişmediyse ya da 6 saat dolmadıysa okuma yok", () => {
  const prof = { v: P.PROFILE_VERSION, builtAt: NOW - 3600000, sourceStamp: 100, optLanes: ["movie"] };
  assert.equal(P.needsRebuild(prof, { sourceStamp: 100, lanes: ["movie"], now: NOW }), false);
  assert.equal(P.needsRebuild(prof, { sourceStamp: 200, lanes: ["movie"], now: NOW }), false); // 6 saat dolmadı
  assert.equal(P.needsRebuild(prof, { sourceStamp: 200, lanes: ["movie"], now: NOW + 6 * 3600000 }), true);
  assert.equal(P.needsRebuild(prof, { sourceStamp: 100, lanes: ["movie", "tv"], now: NOW }), true); // kulvar değişti
  assert.equal(P.needsRebuild(null, { sourceStamp: 1, lanes: ["movie"], now: NOW }), true);
});

test("uçtan uca saf hesap: benzer iki kullanıcı birbirini önerir, üçüncüyü değil", () => {
  const mk = (seed, n, genres) =>
    Array.from({ length: n }, (_, i) => ({ key: `movie_${seed + i}`, g: genres, r: 4 + ((i * 7) % 7), at: NOW - (i % 30) * DAY }));
  const shared = mk(1, 120, ["Dram", "Gerilim"]);
  const pool = [
    { uid: "a", profile: { lanes: { movie: { items: shared } } } },
    { uid: "b", profile: { lanes: { movie: { items: shared.map((it) => ({ ...it })) } } } },
    { uid: "c", profile: { lanes: { movie: { items: mk(5000, 120, ["Komedi", "Aile"]) } } } },
  ];
  const { scores } = P.scoreLane(pool, "movie", { now: NOW });
  assert.equal(scores.get("a")[0].uid, "b");
  assert.ok(scores.get("a")[0].r.score > scores.get("a")[1].r.score);
  // engel: hiç skorlanmaz
  const blocked = P.scoreLane(pool, "movie", { now: NOW, blocks: new Map([["a", new Set(["b"])]]) });
  assert.ok(!blocked.scores.get("a").some((x) => x.uid === "b"));
});
