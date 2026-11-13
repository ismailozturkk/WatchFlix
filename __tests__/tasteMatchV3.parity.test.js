// Zevk eşleşmesi Faz 5: sunucu aynası (functions/tasteMatchCore.js, tasteMatchAdapter.js) istemci
// çekirdeğiyle AYNI sayıları üretmeli. Kopya functions/scripts/syncTasteCore.js ile üretilir.
import * as client from "../utils/tasteMatchV3";
import * as clientAdapter from "../utils/tasteMatchV3Adapter";
import { createWorld } from "./helpers/tasteSynth";

const server = require("../functions/tasteMatchCore");
const serverAdapter = require("../functions/tasteMatchAdapter");
const { build } = require("../functions/scripts/syncTasteCore");
const fs = require("fs");
const path = require("path");

const NOW = Date.UTC(2026, 10, 13);

test("üretilen kopyalar güncel (kaynak değiştiyse: node functions/scripts/syncTasteCore.js)", () => {
  for (const { to, text } of build()) {
    const current = fs.readFileSync(path.join(__dirname, "..", to), "utf8").replace(/\r\n/g, "\n");
    expect(current).toBe(text);
  }
});

test("aynı dışa aktarımlar", () => {
  expect(Object.keys(server).sort()).toEqual(Object.keys(client).sort());
  expect(Object.keys(serverAdapter).sort()).toEqual(Object.keys(clientAdapter).sort());
});

test("bağlam, profil ve çift skorları birebir aynı", () => {
  const world = createWorld({ seed: 11, titles: 900 });
  const [c1, c2] = world.centers(2);
  const users = [
    world.makeUser(c1, 120),
    world.makeUser(world.near(c1, 0.2), 90),
    world.makeUser(c2, 150),
    world.makeUser(c2, 40, { silent: true }),
    world.makeUser(world.near(c2, 0.4), 300, { rateShare: 0.9 }),
  ];
  const ctxC = client.buildContext(users, { now: NOW, k3Mode: "full" });
  const ctxS = server.buildContext(users, { now: NOW, k3Mode: "full" });
  expect(JSON.parse(JSON.stringify(ctxS))).toEqual(JSON.parse(JSON.stringify(ctxC)));
  const pc = users.map((u) => client.buildProfile(u, ctxC, { now: NOW }));
  const ps = users.map((u) => server.buildProfile(u, ctxS, { now: NOW }));
  expect(ps).toEqual(pc);
  for (let i = 0; i < users.length; i += 1) {
    for (let j = i + 1; j < users.length; j += 1) {
      const rc = client.scorePair(pc[i], pc[j], ctxC);
      const rs = server.scorePair(ps[i], ps[j], ctxS);
      expect(rs).toEqual(rc);
      expect(server.verdictOf(rs, ctxS)).toBe(client.verdictOf(rc, ctxC));
    }
  }
});

test("adaptör: aynı taraf → aynı girdi", () => {
  const side = {
    watchedMovies: [{ id: 1, genres: ["Dram"], minutes: 120, dateAdded: "2026-01-02", watchEvents: [{}, {}] }],
    watchedShows: [{ id: 7, genres: ["Komedi"], showEpisodeCount: 10, watchedEpisodeCount: 10, watchedSeasonCount: 2, totalMinutes: 300 }],
    favorites: [{ id: 1, type: "movie" }],
    ratings: { movie_1: 9, tv_7: 6 },
  };
  expect(serverAdapter.sideToTasteUser(side)).toEqual(clientAdapter.sideToTasteUser(side));
});
