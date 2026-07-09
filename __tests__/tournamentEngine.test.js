// Turnuva aday belirleme (nomination) motor kurallari icin birim testler.
// tournamentEngine saf JS'tir (firebase/RN importu yok) — node ortaminda calisir.
const {
  tallyNominations,
  getMyNominations,
  rankPool,
  selectFinalists,
  resolveFinalists,
  FINALIST_COUNT,
  MAX_NOMINATIONS,
  buildBracket,
  tallyVotes,
  computeContestantTotals,
  computeThirdPlace,
  getChampionStats,
} = require("../services/tournamentEngine");

const makePool = (n) =>
  Array.from({ length: n }, (_, i) => ({
    seed: i + 1,
    id: 1000 + i,
    title: `Aday ${i + 1}`,
    posterPath: "/x.jpg",
    mediaType: "movie",
  }));

describe("tek oy modeli", () => {
  test("MAX_NOMINATIONS = 1 — hype (aday oyu) kullanici basina tek haktir", () => {
    expect(MAX_NOMINATIONS).toBe(1);
  });

  test("tallyNominations coklu-nom'lu ESKI dokumanlari saymaya devam eder (gecmis aylarin bracket'i degismez)", () => {
    // 10-hak doneminden kalan dokuman: tum anahtarlar sayilmali.
    const legacy = [{ uid: "eski", noms: { 1: true, 2: true, 3: true } }];
    expect(tallyNominations(legacy)).toEqual({ 1: 1, 2: 1, 3: 1 });
  });
});

describe("tallyNominations", () => {
  test("noms map'lerini aday basina sayar; false degerleri ve noms'suz dokumanlari atlar", () => {
    const votes = [
      { uid: "u1", noms: { 1001: true, 1002: true } },
      { uid: "u2", noms: { 1001: true, 1003: false } },
      { uid: "u3", picks: { r32_0: "a" } }, // yalniz mac oyu — sorun cikarmamali
    ];
    expect(tallyNominations(votes)).toEqual({ 1001: 2, 1002: 1 });
  });
});

describe("getMyNominations", () => {
  test("yalniz ilgili kullanicinin acik (true) oylarini dondurur", () => {
    const votes = [
      { uid: "u1", noms: { 1001: true, 1002: false } },
      { uid: "u2", noms: { 1003: true } },
    ];
    expect([...getMyNominations(votes, "u1")]).toEqual(["1001"]);
    expect(getMyNominations(votes, "yok").size).toBe(0);
  });
});

describe("selectFinalists", () => {
  test("havuz <= 32 ise listeyi OLDUGU GIBI dondurur (eski aylarin bracket'i degismez)", () => {
    const pool = makePool(32);
    const out = selectFinalists(pool, { 1031: 99 });
    expect(out).toBe(pool); // ayni referans — dokunulmadi
  });

  test("havuz > 32 ise en cok oy alan 32'yi alir ve 1..32 yeniden seed'ler", () => {
    const pool = makePool(64);
    // Havuzun SONUNDAKI aday (havuz seed 64) en cok oyu alsin.
    const tally = { [String(1000 + 63)]: 5, [String(1000 + 40)]: 3 };
    const out = selectFinalists(pool, tally);
    expect(out).toHaveLength(FINALIST_COUNT);
    expect(out[0].id).toBe(1000 + 63); // en cok oy → 1 numarali seed
    expect(out[0].seed).toBe(1);
    expect(out[0].poolSeed).toBe(64);  // orijinal havuz sirasi saklanir
    expect(out[1].id).toBe(1000 + 40);
    // Kalan slotlar oy esitliginde (0 oy) havuz sirasina gore dolar.
    expect(out[2].id).toBe(1000);
    expect(out.map((n) => n.seed)).toEqual(
      Array.from({ length: FINALIST_COUNT }, (_, i) => i + 1),
    );
  });

  test("oy esitliginde dusuk havuz seed'i one gecer", () => {
    const pool = makePool(64);
    const tally = { 1010: 2, 1050: 2 };
    const out = selectFinalists(pool, tally);
    expect(out[0].id).toBe(1010);
    expect(out[1].id).toBe(1050);
  });
});

describe("rankPool", () => {
  test("tum havuzu siralar; ilk 32 finalist bayragi alir, oy sayisi eklenir", () => {
    const pool = makePool(64);
    const ranked = rankPool(pool, { [String(1000 + 63)]: 1 });
    expect(ranked).toHaveLength(64);
    expect(ranked[0].id).toBe(1000 + 63);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].nomVotes).toBe(1);
    expect(ranked[0].finalist).toBe(true);
    expect(ranked[32].finalist).toBe(false);
  });
});

describe("resolveFinalists + buildBracket entegrasyonu", () => {
  test("aday oyuyla one cikan yapi bracket'e 1 numarali seed (1v17) olarak oturur", () => {
    const pool = makePool(64);
    const voteDocs = [{ uid: "u1", noms: { [String(1000 + 63)]: true } }];
    const finalists = resolveFinalists({ nominees: pool, voteDocs });
    const bracket = buildBracket({
      nominees: finalists,
      tallies: tallyVotes(voteDocs),
      periodId: "2026-07",
      ms: new Date(2026, 6, 8).getTime(), // Son 32'nin ilk gunu
    });
    const m0 = bracket.rounds[0].matches[0];
    expect(m0.a.id).toBe(1000 + 63); // yeni seed 1
    expect(m0.a.seed).toBe(1);
    expect(m0.b.seed).toBe(17);      // klasik 1v17 eslesmesi
  });
});

describe("getChampionStats + computeThirdPlace", () => {
  // 32 aday, hic oy yok → tum eslesmeler (kararli turlarda) DUSUK SEED kazanir.
  // Bu deterministik zincirde: sampiyon=seed1, ikinci=seed9 (final rakibi),
  // ucuncu=seed5 (yari final kaybedenlerinden dusuk seed'li olan; digeri seed13).
  const pool = makePool(32);

  test("tum turlar karara baglaninca seed zincirine gore sampiyon/ikinci/ucuncu doner", () => {
    const bracket = buildBracket({
      nominees: pool,
      tallies: {},
      periodId: "2026-07",
      ms: new Date(2026, 6, 26).getTime(), // RESULTS fazi (gun 21+) — final de karara baglanmis
    });
    expect(bracket.champion.seed).toBe(1);

    const stats = getChampionStats(bracket);
    expect(stats.runnerUp.seed).toBe(9);
    expect(stats.third.c.seed).toBe(5);
    expect(stats.finalTotal).toBe(0);
    expect(stats.pct).toBe(0);
    expect(stats.totalVotes).toBe(0);

    // computeThirdPlace dogrudan cagrilinca da (PodiumModal'in kullandigi yol) ayni sonuc.
    const totals = computeContestantTotals(bracket.rounds);
    const third = computeThirdPlace(bracket, totals);
    expect(third.c.seed).toBe(5);
  });

  test("final henuz karara baglanmadiysa (yari final bitti, final surerken) sampiyon/istatistik null doner", () => {
    const bracket = buildBracket({
      nominees: pool,
      tallies: {},
      periodId: "2026-07",
      ms: new Date(2026, 6, 16).getTime(), // final basladi (gun15) ama bitmedi (gun<21)
    });
    expect(bracket.champion).toBeNull();
    expect(getChampionStats(bracket)).toBeNull();
  });

  test("oylarla ikinci/ucuncu seed disi bir yapiya kayabilir", () => {
    // seed9 (final rakibi) yerine seed16'nin finale cikmasini oyla zorla:
    // r32_15: seed16(a) vs seed32(b) zaten seed16 kazanir (dusuk seed) — degisiklik yok.
    // Bunun yerine sf_1 macinda seed9 yerine seed13'un kazanmasini saglayalim (fazla oy).
    const voteDocs = [{ uid: "u1", picks: { sf_1: "b" } }]; // b=seed13 tarafi
    const tallies = tallyVotes(voteDocs);
    const bracket = buildBracket({
      nominees: pool,
      tallies,
      periodId: "2026-07",
      ms: new Date(2026, 6, 26).getTime(),
    });
    const stats = getChampionStats(bracket);
    expect(stats.runnerUp.seed).toBe(13); // artik final rakibi seed13 (sf_1'e oy verildi, final'in kendisine degil)
    expect(stats.finalTotal).toBe(0);     // final macinin kendi oyu yok, sadece sf_1'e verildi
    expect(stats.finalVotes).toBe(0);
    expect(stats.pct).toBe(0);
  });
});
