const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const pb = require("./publicBoards");

test("tablo kimliği yalnız bilinen biçimlerde kaynağa çevrilir", () => {
  assert.deepEqual(pb.boardSource("scene_guess"), { collection: "SceneGame", orderField: "bestScore" });
  assert.deepEqual(pb.boardSource("quick_blur_poster"), {
    collection: "GameLeaderboards/quick_blur_poster/entries",
    orderField: "score",
  });
  assert.ok(pb.boardSource("poster_classic_normal"));
  assert.ok(pb.boardSource("scene_daily_2026-11-01"));
  for (const bad of ["", "Users", "quick_../Users", "scene_daily_bugün", "quick_A", null, 7]) {
    assert.equal(pb.boardSource(bad), null, String(bad));
  }
});

test("anlık görüntü 10 dk taze; gelecekteki damga taze sayılmaz", () => {
  const now = 1_000_000_000;
  assert.equal(pb.isFreshSnapshot(now - 1000, now), true);
  assert.equal(pb.isFreshSnapshot(now - pb.BOARD_SNAPSHOT_TTL_MS, now), false);
  assert.equal(pb.isFreshSnapshot(now + 5000, now), false);
  assert.equal(pb.isFreshSnapshot(undefined, now), false);
});

test("Timestamp'ler ms'ye, iç içe yapı korunur", () => {
  const ts = { toMillis: () => 42 };
  assert.deepEqual(pb.plain({ a: ts, b: [ts, { c: ts }], d: "x", e: null }), { a: 42, b: [42, { c: 42 }], d: "x", e: null });
  const docs = [{ id: "u1", data: () => ({ score: 9, updatedAt: ts }) }];
  assert.deepEqual(pb.snapshotEntries(docs), [{ id: "u1", data: { score: 9, updatedAt: 42 } }]);
});

test("Top 100 yükü yalnız sayı taşır, bozuk sayaç 0", () => {
  const docs = [
    { id: "movie_1", data: () => ({ count: 5, extra: "gizli" }) },
    { id: "tv_2", data: () => ({ count: -3 }) },
    { id: "movie_3", data: () => ({}) },
  ];
  assert.deepEqual(pb.top100Payload(docs), { movie_1: { count: 5 }, tv_2: { count: 0 }, movie_3: { count: 0 } });
});

test("istemci sabitleriyle eşit (parite)", () => {
  const read = (rel) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
  assert.match(read("services/top100Service.js"), new RegExp(`TOP100_COUNTER_READ = ${pb.TOP100_COUNTER_LIMIT};`));
  assert.match(read("utils/gameBoards.js"), new RegExp(`BOARD_LIMIT = ${pb.BOARD_SNAPSHOT_LIMIT};`));
  assert.match(read("services/boardSnapshots.js"), new RegExp(`BOARD_SNAPSHOT_TTL_MS = ${pb.BOARD_SNAPSHOT_TTL_MS / 60000} \\* 60 \\* 1000;`));
});
