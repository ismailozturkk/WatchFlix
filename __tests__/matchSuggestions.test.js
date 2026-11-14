// __tests__/matchSuggestions.test.js — Zevk Çemberleri Faz 6 öneri görünüm modeli (utils/matchSuggestions.js),
// ekran metinleri (6 dil) ve Geliştirici Laboratuvarı sahte durumları.

import {
  applyCircleResult,
  applyHelloResult,
  applyServerPairScore,
  errorKindOf,
  helloState,
  laneStatus,
  normalizeSuggestions,
  parseTitleKey,
  removeCandidate,
  titleKeysOf,
} from "../utils/matchSuggestions";
import { MATCH_SCREEN_COPY } from "../utils/matchScreenCopy";
import { MATCH_DEV_STATES } from "../utils/matchDevSamples";
import { tierOf } from "../utils/tasteMatch";

const item = (cid, extra = {}) => ({
  cid,
  verdict: "near",
  score: 84,
  displayName: "Deniz",
  avatarIndex: 2,
  photoURL: null,
  loved: ["movie_1", "movie_2"],
  split: "movie_3",
  implicitHeavy: false,
  greeted: false,
  sent: false,
  ...extra,
});
const docOf = (items, extra = {}) => ({ v: 1, updatedAt: 1700000000000, lanes: { movie: { pool: 10, active: 9, inPool: true, twinsEnabled: false, items, circle: null, ...extra } } });

describe("normalizeSuggestions", () => {
  test("belge yok → hazır değil; kulvar durumları", () => {
    const empty = normalizeSuggestions(null);
    expect(empty.ready).toBe(false);
    expect(laneStatus(empty, "movie")).toBe("not-ready");
    expect(laneStatus(empty, "tv", ["movie"])).toBe("not-selected");
    expect(laneStatus(normalizeSuggestions(docOf([], { inPool: false })), "movie")).toBe("not-in-pool");
    expect(laneStatus(normalizeSuggestions(docOf([])), "movie")).toBe("empty");
    expect(laneStatus(normalizeSuggestions(docOf([item("cid_aaaaaaaaaa")])), "movie")).toBe("list");
  });

  test("bozuk aday elenir; yüzde 0–100; rehber yüzdesiz; ikiz önce", () => {
    const view = normalizeSuggestions(
      docOf([
        item("kisa"),
        item("cid_bbbbbbbbbb", { verdict: "lover" }),
        item("cid_cccccccccc", { score: null }),
        item("cid_dddddddddd", { score: 140 }),
        item("cid_eeeeeeeeee", { verdict: "guide", score: 77 }),
        item("cid_ffffffffff", { verdict: "twin", score: 92 }),
        item("cid_gggggggggg", { loved: ["movie_1", "bozuk", 5, "tv_9"], split: "x" }),
      ]),
    );
    const items = view.lanes.movie.items;
    expect(items.map((it) => it.cid)).toEqual(["cid_ffffffffff", "cid_dddddddddd", "cid_gggggggggg", "cid_eeeeeeeeee"]);
    expect(items[1].score).toBe(100);
    expect(items[3].score).toBeNull();
    expect(items[2].loved).toEqual(["movie_1", "tv_9"]);
    expect(items[2].split).toBeNull();
  });

  test("GİZLİLİK: bilinmeyen alan taşınmaz; friendUid yalnız karşılıklıda", () => {
    const view = normalizeSuggestions(
      docOf([
        item("cid_aaaaaaaaaa", { uid: "gizli", username: "kadi", friendUid: "sizan" }),
        item("cid_bbbbbbbbbb", { mutual: true, friendUid: "arkadas" }),
      ]),
    );
    const [a, b] = view.lanes.movie.items;
    expect(JSON.stringify(a)).not.toMatch(/gizli|kadi|sizan/);
    expect(a.friendUid).toBeNull();
    expect(b.friendUid).toBe("arkadas");
  });

  test("çember: 3'ten küçük ya da anahtarsız düşer; sayaç boyutla sınırlı", () => {
    expect(normalizeSuggestions(docOf([], { circle: { key: "k", size: 2 } })).lanes.movie.circle).toBeNull();
    expect(normalizeSuggestions(docOf([], { circle: { size: 5 } })).lanes.movie.circle).toBeNull();
    const c = normalizeSuggestions(docOf([], { circle: { key: "k", size: 4, joinedCount: 9, genres: ["drama", "crime", "war"] } })).lanes.movie.circle;
    expect(c).toMatchObject({ key: "k", size: 4, joinedCount: 4, genres: ["drama", "crime"], joined: false, groupId: null });
  });
});

describe("selam ve eylemler", () => {
  test("helloState", () => {
    expect(helloState(item("c", {}))).toBe("none");
    expect(helloState(item("c", { sent: true }))).toBe("sent");
    expect(helloState(item("c", { greeted: true }))).toBe("greeted");
    expect(helloState(item("c", { sent: true, greeted: true }))).toBe("mutual");
    expect(helloState(item("c", { mutual: true }))).toBe("mutual");
  });

  test("selam cevabı, gizleme ve çember katılımı görünüme işlenir", () => {
    const view = normalizeSuggestions(docOf([item("cid_aaaaaaaaaa"), item("cid_bbbbbbbbbb", { greeted: true })], { circle: { key: "k", size: 5, joinedCount: 1 } }));
    const sent = applyHelloResult(view, "cid_aaaaaaaaaa", { status: "sent" });
    expect(helloState(sent.lanes.movie.items.find((i) => i.cid === "cid_aaaaaaaaaa"))).toBe("sent");
    const mutual = applyHelloResult(view, "cid_bbbbbbbbbb", { status: "mutual" });
    expect(helloState(mutual.lanes.movie.items.find((i) => i.cid === "cid_bbbbbbbbbb"))).toBe("mutual");
    expect(applyHelloResult(view, "cid_aaaaaaaaaa", { status: "garip" })).toBe(view);
    expect(removeCandidate(view, "cid_aaaaaaaaaa").lanes.movie.items.map((i) => i.cid)).toEqual(["cid_bbbbbbbbbb"]);
    const joined = applyCircleResult(view, "movie", { status: "group", joined: 3, groupId: "g1" });
    expect(joined.lanes.movie.circle).toMatchObject({ joined: true, joinedCount: 3, groupId: "g1", groupReady: true });
  });

  test("afiş anahtarları tekil ve sınırlı; anahtar ayrıştırma", () => {
    const view = normalizeSuggestions(docOf([item("cid_aaaaaaaaaa"), item("cid_bbbbbbbbbb", { loved: ["movie_2", "tv_5"], split: null })]));
    expect(titleKeysOf(view, "movie")).toEqual(["movie_1", "movie_2", "movie_3", "tv_5"]);
    expect(parseTitleKey("tv_12")).toEqual({ key: "tv_12", type: "tv", id: 12 });
    expect(parseTitleKey("person_1")).toBeNull();
  });

  test("callable hata kodu → metin türü", () => {
    expect(errorKindOf({ code: "functions/resource-exhausted" })).toBe("limit");
    expect(errorKindOf({ code: "functions/not-found" })).toBe("gone");
    expect(errorKindOf({ code: "functions/failed-precondition" })).toBe("closed");
    expect(errorKindOf(new Error("x"))).toBe("error");
  });
});

describe("arkadaş kartı: sunucu skoru", () => {
  const client = { score: 40, tier: tierOf(40), byType: { movie: { shared: true, score: 41 }, tv: { shared: true, score: 30 } }, loved: ["movie_1"] };

  test("iki kulvar: kulvar yüzdeleri sunucudan, ana yüzde ortak yapımı çok olan kulvardan; içgörü korunur", () => {
    const out = applyServerPairScore(client, { lanes: { movie: { display: 88, verdict: "near", common: 40 }, tv: { display: 61, verdict: "near", common: 12 } } });
    expect(out.score).toBe(88);
    expect(out.tier).toBe(tierOf(88));
    expect(out.byType.movie.score).toBe(88);
    expect(out.byType.tv.score).toBe(61);
    expect(out.loved).toEqual(["movie_1"]);
    expect(out.source).toBe("server");
  });

  test("biri havuzda değil / hata → istemci sonucu aynen", () => {
    expect(applyServerPairScore(client, { lanes: {} })).toBe(client);
    expect(applyServerPairScore(client, null)).toBe(client);
    expect(applyServerPairScore(null, { lanes: { movie: { display: 1 } } })).toBeNull();
  });

  test("rehber kulvarı yüzdesiz", () => {
    const out = applyServerPairScore(client, { lanes: { movie: { display: null, verdict: "guide", common: 5 } } });
    expect(out.byType.movie.score).toBeNull();
    expect(out.score).toBe(40);
  });
});

describe("ekran metinleri", () => {
  const shape = (obj) =>
    Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, v && typeof v === "object" ? shape(v) : typeof v]),
    );

  test("6 dil, aynı anahtarlar ve aynı türler", () => {
    expect(Object.keys(MATCH_SCREEN_COPY).sort()).toEqual(["de", "en", "es", "fr", "it", "ja", "pt", "tr"]);
    const ref = shape(MATCH_SCREEN_COPY.tr);
    for (const [lang, copy] of Object.entries(MATCH_SCREEN_COPY)) expect([lang, shape(copy)]).toEqual([lang, ref]);
  });

  test("işlev metinleri sayı ve adı içerir; puan değeri kalıbı yok", () => {
    for (const copy of Object.values(MATCH_SCREEN_COPY)) {
      expect(copy.poolCount(37)).toContain("37");
      expect(copy.circle.joined(2, 6)).toContain("2/6");
      expect(copy.scoreLabel(88)).toContain("88");
      expect(copy.circle.body(6, "")).toContain("6");
      expect(JSON.stringify(copy)).not.toMatch(/\b\d+\/10\b/);
    }
  });
});

describe("Geliştirici Laboratuvarı sahte durumları", () => {
  test("her durum geçerli bir görünüm üretir ve beklenen ekran durumuna düşer", () => {
    const expected = {
      "not-ready": "not-ready",
      "low-data": "not-in-pool",
      empty: "empty",
      cold: "list",
      twin: "list",
      guide: "list",
      circle: "list",
      "circle-ready": "empty",
    };
    for (const st of MATCH_DEV_STATES) {
      expect([st.id, laneStatus(normalizeSuggestions(st.doc), "movie")]).toEqual([st.id, expected[st.id]]);
    }
    const twin = normalizeSuggestions(MATCH_DEV_STATES.find((s) => s.id === "twin").doc);
    expect(twin.lanes.movie.items.map(helloState)).toEqual(["none", "greeted", "sent", "mutual"]);
    expect(twin.lanes.tv.items).toHaveLength(1);
  });
});
