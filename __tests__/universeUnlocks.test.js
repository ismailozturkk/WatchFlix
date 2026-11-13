// Gizli evrenler (utils/universeUnlocks.js) + kapı soruları (utils/universeRiddles.js).
import fs from "fs";
import path from "path";
import {
  groupUnlockCount,
  isTitleWatched,
  isUniverseId,
  UNIVERSE_DAYS,
  universeDayUniverses,
  unlockedUniverses,
  withSolved,
} from "../utils/universeUnlocks";

describe("evren günleri", () => {
  it("4 Mayıs Star Wars, 21 Ekim Geleceğe Dönüş; sıradan gün boş", () => {
    expect([...universeDayUniverses(new Date(2027, 4, 4))]).toEqual(["starWars"]);
    expect([...universeDayUniverses(new Date(2027, 9, 21))]).toEqual(["backToTheFuture"]);
    expect(universeDayUniverses(new Date(2027, 0, 13)).size).toBe(0);
    expect(universeDayUniverses(new Date("geçersiz")).size).toBe(0);
  });
  it("bütün evren günleri bilinen evrenler", () => {
    for (const u of UNIVERSE_DAYS) expect([u.id, isUniverseId(u.id)]).toEqual([u.id, true]);
  });
});
import { UNIVERSE_RIDDLES, matchesRiddle, normalizeAnswer } from "../utils/universeRiddles";
import { UNIVERSE_IDS } from "../utils/weatherUniverses";
import { WEATHER_GROUPS, eventPick, eventU, restU } from "../utils/weatherParticles";

describe("gizli evrenler", () => {
  it("hiç çözülmemişse hepsi kilitli; kar/yağmur evren sayılmaz", () => {
    expect(unlockedUniverses(null).size).toBe(0);
    expect(unlockedUniverses({}).size).toBe(0);
    expect(isUniverseId("snow")).toBe(false);
    expect(isUniverseId("arcane")).toBe(true);
  });

  it("yalnız çözülen evren açılır; izlemek tek başına açmaz", () => {
    const solved = withSolved({}, "dark", 1);
    expect(unlockedUniverses(solved)).toEqual(new Set(["dark"]));
    // aynı evren ikinci kez: aynı nesne (gereksiz yazım yok)
    expect(withSolved(solved, "dark", 2)).toBe(solved);
    // evren olmayan / bilinmeyen kimlik kaydedilmez, kayıttaysa sayılmaz
    expect(withSolved(solved, "snow")).toBe(solved);
    expect(unlockedUniverses({ dark: 1, eskiEvren: 1, got: 0 })).toEqual(new Set(["dark"]));
  });

  it("detaydaki gizli kart: yapım izlendiyse (dizi: işaret ya da bölüm kaydı)", () => {
    const src = { statusIndex: { movie: { 597: { isWatched: true }, 27205: { isWatched: false } }, tv: {} }, watchedTvMap: { 70523: {} } };
    expect(isTitleWatched(src, "movie", 597)).toBe(true);
    expect(isTitleWatched(src, "movie", 27205)).toBe(false);
    expect(isTitleWatched(src, "tv", 70523)).toBe(true);
    expect(isTitleWatched(src, "tv", 597)).toBe(false);
    expect(isTitleWatched({}, "movie", null)).toBe(false);
  });

  it("grup sayacı yalnız evrenleri sayar", () => {
    const films = WEATHER_GROUPS.find((g) => g.id === "films");
    const n = groupUnlockCount(films.effects, new Set(["titanic", "snow"]));
    expect(n.open).toBe(1);
    expect(n.total).toBe(films.effects.filter((id) => UNIVERSE_IDS.includes(id)).length);
  });
});

describe("kapı soruları", () => {
  it("her evrenin bir sorusu var, fazlası yok", () => {
    expect(Object.keys(UNIVERSE_RIDDLES).sort()).toEqual([...UNIVERSE_IDS].sort());
  });

  it("her kabul edilen cevap kendi sorusunu açar", () => {
    for (const [id, r] of Object.entries(UNIVERSE_RIDDLES)) {
      expect(r.q.length).toBeGreaterThan(10);
      for (const a of r.answers) expect([id, a, matchesRiddle(id, a)]).toEqual([id, a, true]);
    }
  });

  it("büyük/küçük harf, aksan, noktalama ve kısa cümle hoş görülür", () => {
    expect(normalizeAnswer("  The OVERLOOK!  ")).toBe("overlook");
    expect(normalizeAnswer("Şükrü İĞDE")).toBe("sukru igde");
    expect(matchesRiddle("breakingBad", "HEISENBERG.")).toBe(true);
    expect(matchesRiddle("spiderMan", "May Teyze")).toBe(true);
    expect(matchesRiddle("spiderMan", "Aunt May")).toBe(true);
    expect(matchesRiddle("fallout", "Vault 33")).toBe(true);
    expect(matchesRiddle("sherlock", "221 B")).toBe(true);
    expect(matchesRiddle("naruto", "Gizli Yaprak Köyü")).toBe(true);
    expect(matchesRiddle("shining", "Overlook Oteli")).toBe(true);
    expect(matchesRiddle("jujutsuKaisen", "Ryōmen Sukuna")).toBe(true);
    // küçük yazım hatası (5+ harf)
    expect(matchesRiddle("breakingBad", "heisenburg")).toBe(true);
    expect(matchesRiddle("demonSlayer", "nezukko")).toBe(true);
    // bitişik Türkçe ek, büyük/küçük harf karışık
    expect(matchesRiddle("strangerThings", "HawkinsTE")).toBe(true);
    expect(matchesRiddle("avatar", "pandoraya")).toBe(true);
    expect(matchesRiddle("arcane", "Polvorita")).toBe(true);
    expect(matchesRiddle("backToTheFuture", "88 mph")).toBe(true);
  });

  it("yanlış, boş ya da tahmin listesi kabul edilmez", () => {
    expect(matchesRiddle("breakingBad", "")).toBe(false);
    expect(matchesRiddle("breakingBad", "jesse")).toBe(false);
    expect(matchesRiddle("backToTheFuture", "89")).toBe(false);
    expect(matchesRiddle("squidGame", "457")).toBe(false);
    expect(matchesRiddle("titanic", "jake")).toBe(false); // kısa adda harf hatası yok
    expect(matchesRiddle("got", "rhaegal viserion drogon balerion")).toBe(false); // 4+ kelime
    expect(matchesRiddle("nope", "drogon")).toBe(false);
  });

  it("soru metni 6 dilde var", () => {
    for (const lang of ["tr", "en", "de", "es", "it", "pt"]) {
      const j = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "translations", `${lang}.json`), "utf8"));
      for (const id of UNIVERSE_IDS) expect([lang, id, typeof j.autoI18n[`evren_soru_${id}`]]).toEqual([lang, id, "string"]);
    }
  });
});

describe("çok olaylı sahne saati (eventPick)", () => {
  const p = { period: 60, y0: 0, rest: 2.5 };
  it("döngü boyunca sabit, döngüden döngüye sırayla döner", () => {
    expect(eventPick(p, 120.1, 2)).toBe(0);
    expect(eventPick(p, 179.9, 2)).toBe(0);
    expect(eventPick(p, 180.1, 2)).toBe(1);
    expect(eventPick(p, 240.1, 2)).toBe(0);
    expect(eventPick(p, 300.1, 3)).toBe(2);
    expect(eventPick(p, 300.1, 1)).toBe(0);
  });

  it("eventU: yalnız sırası gelen olay ilerler, öbürü dinlenmede (2) kalır", () => {
    // döngü 2 (t 120…180): olay 0; u = 0.4 → t = 120 + 0.4 / 2.5 * 60
    const tA = 120 + (0.4 / 2.5) * 60;
    expect(eventU(p, tA, 0)).toBeCloseTo(restU(p, tA));
    expect(eventU(p, tA, 1)).toBe(2);
    const tB = tA + 60;
    expect(eventU(p, tB, 1)).toBeCloseTo(0.4);
    expect(eventU(p, tB, 0)).toBe(2);
    // dinlenme her iki olayda da 2
    expect(eventU(p, 120 + 50, 0)).toBe(2);
  });
});

describe("gizli evren kaydı (tek belge, yerel-öncelikli)", () => {
  const { solvedFromDoc, buildUniverseDoc } = require("../utils/universeUnlocks");
  const { universeUnlocksSpec, UNIVERSES_DOC_PATH } = require("../services/userData/domains");

  it("belgeden yalnız bilinen evrenler ve geçerli damgalar okunur", () => {
    expect(solvedFromDoc(null)).toEqual({});
    expect(solvedFromDoc({ solved: { dark: 5, uydurma: 3, got: "x", aot: 0 } })).toEqual({ dark: 5 });
    expect(buildUniverseDoc({ dark: 5 }, 9)).toEqual({ id: "all", solved: { dark: 5 }, updatedAt: 9 });
  });

  it("alan: private/universes, merge yazımı; bulut belgesi tek okumayla gelir", async () => {
    const kind = universeUnlocksSpec.kinds.doc;
    expect(kind.pathOf("u1", "all")).toBe("Users/u1/private/universes");
    expect(kind.merge).toBe(true);
    const fetchDoc = jest.fn(async () => ({ solved: { dark: 1 }, updatedAt: 1 }));
    const out = await universeUnlocksSpec.fetchCloud("u1", { fetchDoc });
    expect(fetchDoc).toHaveBeenCalledTimes(1);
    expect(fetchDoc).toHaveBeenCalledWith(UNIVERSES_DOC_PATH("u1"));
    expect(out.doc[0]).toMatchObject({ id: "all", solved: { dark: 1 } });
    expect(await universeUnlocksSpec.fetchCloud("u1", { fetchDoc: async () => null })).toEqual({ doc: [] });
  });

  it("yazma günlüğü merge bayrağını taşır", () => {
    jest.resetModules();
    require("expo-file-system").__reset();
    const outbox = require("../services/userData/outbox");
    const [rec] = outbox.enqueue("u1", [{ path: "Users/u1/private/universes", op: "set", data: { a: 1 }, merge: true }]);
    expect(rec.merge).toBe(true);
    const [plain] = outbox.enqueue("u1", [{ path: "Notes/u1/items/a", op: "set", data: { a: 1 } }]);
    expect(plain.merge).toBeUndefined();
  });
});
