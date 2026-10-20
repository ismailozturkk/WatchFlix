// functions/tournamentBracket.js, services/tournamentEngine.js'in hesap
// cekirdeginin CommonJS kopyasidir (CF ESM motoru require edemiyor). Bu test
// ikisinin AYRISMADIGINI dogrular: ayni girdiler -> birebir ayni podyum.
//
// Motorda siralama/eslesme/kazanan kurali degisirse bu test kirmiziya doner.
// Cozum portu motora gore guncellemektir, testi gevsetmek DEGIL.
const engine = require("../services/tournamentEngine");
const port = require("../functions/tournamentBracket");

const PERIOD = "2026-03";
// Tum turlar kapandiktan (21. gun) sonrasi — arsiv bu ani kullanir.
const FINISHED_MS = engine.getPeriodStartMs(PERIOD) + 40 * engine.DAY;

const makePool = (n) =>
  Array.from({ length: n }, (_, i) => ({
    seed: i + 1,
    id: 1000 + i,
    title: `Aday ${i + 1}`,
    posterPath: "/x.jpg",
    mediaType: "movie",
  }));

// Deterministik sozde-rastgele (Math.random yok — test tekrarlanabilir olmali).
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Her mac icin rastgele ama TEKRARLANABILIR oy dagilimi (beraberlikler dahil).
function makeTallies(seed) {
  const rnd = lcg(seed);
  const t = {};
  for (const r of engine.ROUNDS) {
    for (let i = 0; i < r.matches; i++) {
      t[`${r.key}_${i}`] = {
        a: Math.floor(rnd() * 6),
        b: Math.floor(rnd() * 6),
      };
    }
  }
  return t;
}

function makeNomTally(seed, poolSize) {
  const rnd = lcg(seed);
  const t = {};
  for (let i = 0; i < poolSize; i++) {
    const v = Math.floor(rnd() * 4);
    if (v > 0) t[String(1000 + i)] = v;
  }
  return t;
}

const suggestions = [
  { id: 9001, seed: 0, title: "Onerilen A", posterPath: "/a.jpg", mediaType: "movie", addedAtMs: 100 },
  { id: 9002, seed: 0, title: "Onerilen B", posterPath: "/b.jpg", mediaType: "movie", addedAtMs: 200 },
];

// Motor tarafinda podyumu ayni kurallarla hesapla (getChampionStats + ucuncu).
function enginePodium({ nominees, suggested, nomTally, tallies }) {
  const pool = engine.mergePool(nominees, suggested);
  const finalists = engine.selectFinalists(pool, nomTally);
  if (!finalists || !finalists.length) return null;
  const bracket = engine.buildBracket({
    nominees: finalists, tallies, periodId: PERIOD, ms: FINISHED_MS,
  });
  if (!bracket.champion) return null;
  const stats = engine.getChampionStats(bracket);
  return {
    championId: bracket.champion.id,
    championSeed: bracket.champion.seed,
    runnerUpId: stats.runnerUp ? stats.runnerUp.id : null,
    thirdId: stats.third ? stats.third.c.id : null,
    finalVotes: stats.finalVotes,
    finalTotal: stats.finalTotal,
    championTotalVotes: stats.totalVotes,
  };
}

function portPodium(args) {
  const p = port.resolvePodium({ periodId: PERIOD, ms: FINISHED_MS, ...args });
  if (!p) return null;
  return {
    championId: p.champion.id,
    championSeed: p.champion.seed,
    runnerUpId: p.runnerUp ? p.runnerUp.id : null,
    thirdId: p.third ? p.third.id : null,
    finalVotes: p.finalVotes,
    finalTotal: p.finalTotal,
    championTotalVotes: p.championTotalVotes,
  };
}

describe("port <-> motor sabitleri", () => {
  test("FINALIST_COUNT ve tur takvimi birebir ayni", () => {
    expect(port.FINALIST_COUNT).toBe(engine.FINALIST_COUNT);
    expect(port.DAY).toBe(engine.DAY);
    expect(port.ROUNDS.map((r) => [r.key, r.matches, r.startDay, r.endDay])).toEqual(
      engine.ROUNDS.map((r) => [r.key, r.matches, r.startDay, r.endDay]),
    );
  });
});

describe("port <-> motor: saf yardimcilar ayni sonucu verir", () => {
  const pool = makePool(64);
  const nomTally = makeNomTally(7, 64);

  test("mergePool", () => {
    expect(port.mergePool(pool, suggestions)).toEqual(engine.mergePool(pool, suggestions));
  });

  test("rankPool", () => {
    expect(port.rankPool(pool, nomTally)).toEqual(engine.rankPool(pool, nomTally));
  });

  test("selectFinalists", () => {
    expect(port.selectFinalists(pool, nomTally)).toEqual(engine.selectFinalists(pool, nomTally));
  });

  test("tallyNominations / tallyVotes", () => {
    const votes = [
      { uid: "u1", noms: { 1001: true }, picks: { r32_0: "a", r16_1: "b" } },
      { uid: "u2", noms: { 1001: true, 1009: false }, picks: { r32_0: "b" } },
      { uid: "u3", picks: { final_0: "x" } }, // gecersiz taraf — iki tarafta da atlanmali
    ];
    expect(port.tallyNominations(votes)).toEqual(engine.tallyNominations(votes));
    expect(port.tallyVotes(votes)).toEqual(engine.tallyVotes(votes));
  });

  test("buildBracket tum turlariyla ayni", () => {
    const finalists = engine.selectFinalists(pool, nomTally);
    const tallies = makeTallies(11);
    // round.def'teki tr/en ETIKETLERI bilerek port edilmedi (yalniz arayuz
    // kullanir). Karsilastirmadan once def'i hesaba giren alanlara indirgeriz;
    // takvim esitligi ayrica "port <-> motor sabitleri" testinde dogrulanir.
    const norm = (bracket) => ({
      champion: bracket.champion,
      championDecided: bracket.championDecided,
      rounds: bracket.rounds.map((r) => ({
        ...r,
        def: { key: r.def.key, matches: r.def.matches, startDay: r.def.startDay, endDay: r.def.endDay },
      })),
    });
    const a = port.buildBracket({ nominees: finalists, tallies, periodId: PERIOD, ms: FINISHED_MS });
    const b = engine.buildBracket({ nominees: finalists, tallies, periodId: PERIOD, ms: FINISHED_MS });
    expect(norm(a)).toEqual(norm(b));
  });
});

describe("port <-> motor: podyum 40 tohumda da ayni cikar", () => {
  // Tek bir ornek uyusabilir; asil risk bir SIRALAMA/ESITLIK kuralinin
  // ayrismasi. Farkli oy dagilimlariyla tarayarak bunu yakalariz.
  test("sampiyon / ikinci / ucuncu ve skorlar birebir esler", () => {
    const pool = makePool(64);
    for (let seed = 1; seed <= 40; seed++) {
      const args = {
        nominees: pool,
        suggested: seed % 3 === 0 ? suggestions : [],
        nomTally: makeNomTally(seed, 64),
        tallies: makeTallies(seed * 31),
      };
      expect(portPodium(args)).toEqual(enginePodium(args));
    }
  });

  test("hic oy yokken (seed zinciri) de ayni", () => {
    const args = { nominees: makePool(64), suggested: [], nomTally: {}, tallies: {} };
    expect(portPodium(args)).toEqual(enginePodium(args));
  });

  test("havuz tam 32 iken (eski aylar) de ayni", () => {
    const args = { nominees: makePool(32), suggested: [], nomTally: {}, tallies: makeTallies(5) };
    expect(portPodium(args)).toEqual(enginePodium(args));
  });
});

describe("resolvePodium arsiv davranisi", () => {
  test("bos havuzda null doner (yazilacak kayit yok)", () => {
    expect(port.resolvePodium({ periodId: PERIOD, nominees: [], nomTally: {}, tallies: {} })).toBeNull();
  });

  test("ms verilmezse ay basindan 40 gun sonrasi varsayilir — tum turlar kapali", () => {
    const args = { periodId: PERIOD, nominees: makePool(64), nomTally: {}, tallies: makeTallies(3) };
    expect(port.resolvePodium(args)).toEqual(port.resolvePodium({ ...args, ms: FINISHED_MS }));
  });

  test("toplam eleme oyu tum maclardan toplanir", () => {
    const tallies = { r32_0: { a: 2, b: 3 }, final_0: { a: 1, b: 0 } };
    const out = port.resolvePodium({ periodId: PERIOD, nominees: makePool(64), nomTally: {}, tallies });
    expect(out.totalVotes).toBe(6);
  });
});
