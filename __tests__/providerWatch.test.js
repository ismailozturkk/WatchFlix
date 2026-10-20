// __tests__/providerWatch.test.js
//
// İzleme listesi "Platformlarımda" süzgeci: saf çekirdek (utils/providerWatch.js) + bölüm bileşeni
// (components/lists/PlatformFilterSection.js).
import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s },
  View: "View",
  Text: "Text",
  TouchableOpacity: "TouchableOpacity",
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));

const {
  STALE_AFTER_DAYS,
  classifyTitle,
  isStale,
  normalizeProviderWatch,
  planPlatformFilter,
  platformsOfTitle,
  providerKey,
} = require("../utils/providerWatch");
const { PROVIDER_WATCH_COPY, getProviderWatchCopy } = require("../utils/providerWatchCopy");
const PlatformFilterSection = require("../components/lists/PlatformFilterSection").default;

global.IS_REACT_ACT_ENVIRONMENT = true;

const NOW = Date.UTC(2026, 9, 18, 12);
const NETFLIX = 8;
const PRIME = 119;
const DISNEY = 337;

const doc = (overrides = {}) => ({
  region: "TR",
  updatedAt: { toMillis: () => NOW - 3600000 },
  items: {
    movie_1: { a: [NETFLIX, 2], n: [] },
    movie_2: { a: [DISNEY], n: [] },
    tv_3: { a: [PRIME, NETFLIX], n: [] },
    movie_4: { a: [] },
  },
  ...overrides,
});
const movie = (id) => ({ id, type: "movie" });
const tv = (id) => ({ id, type: "tv" });

describe("providerKey", () => {
  it("türe göre anahtar kurar; geçersiz kimlikte null", () => {
    expect(providerKey({ id: 5, type: "tv" })).toBe("tv_5");
    expect(providerKey({ id: "7", type: "movie" })).toBe("movie_7");
    expect(providerKey({ id: 9 })).toBe("movie_9"); // türü yazılmamış kayıt film sayılır
    expect(providerKey({ id: 0 })).toBeNull();
    expect(providerKey({ id: "x" })).toBeNull();
    expect(providerKey(null)).toBeNull();
  });
});

describe("normalizeProviderWatch", () => {
  it("belgeyi sadeleştirir: kimlikler sayıya, zaman damgası ms'ye", () => {
    const out = normalizeProviderWatch(doc({ items: { movie_1: { a: ["8", 2, "x", -1] } } }));
    expect(out.region).toBe("TR");
    expect(out.updatedAtMs).toBe(NOW - 3600000);
    expect(out.items).toEqual({ movie_1: [8, 2] });
  });

  it("bozuk girdi ve geçersiz anahtarlar atılır", () => {
    for (const raw of [null, undefined, 5, "x", []]) expect(normalizeProviderWatch(raw)).toBeNull();
    const out = normalizeProviderWatch({ items: { movie_1: { a: [1] }, bozuk: { a: [1] }, tv_x: { a: [1] } } });
    expect(Object.keys(out.items)).toEqual(["movie_1"]);
    expect(out.region).toBe("");
    expect(out.updatedAtMs).toBe(0);
    expect(normalizeProviderWatch({ items: "yok" }).items).toEqual({});
  });
});

describe("classifyTitle", () => {
  const snapshot = normalizeProviderWatch(doc());

  it("platformlarımdan biri varsa yes; yoksa no; taranmamışsa unknown", () => {
    expect(classifyTitle(snapshot, movie(1), [NETFLIX])).toBe("yes");
    expect(classifyTitle(snapshot, movie(2), [NETFLIX])).toBe("no");
    expect(classifyTitle(snapshot, movie(4), [NETFLIX])).toBe("no"); // hiçbir yerde yok ≠ bilinmiyor
    expect(classifyTitle(snapshot, movie(99), [NETFLIX])).toBe("unknown");
    expect(classifyTitle(null, movie(1), [NETFLIX])).toBe("unknown");
    expect(classifyTitle(snapshot, { id: 0 }, [NETFLIX])).toBe("unknown");
  });

  it("aynı kimlikli film ve dizi karışmaz", () => {
    expect(classifyTitle(snapshot, tv(3), [PRIME])).toBe("yes");
    expect(classifyTitle(snapshot, movie(3), [PRIME])).toBe("unknown");
  });

  it("kimlikler metin olarak gelse de eşleşir", () => {
    expect(classifyTitle(snapshot, movie(1), ["8"])).toBe("yes");
  });

  it("hangi platformlarımda olduğunu söyler", () => {
    expect(platformsOfTitle(snapshot, tv(3), [NETFLIX, PRIME, DISNEY]).sort((a, b) => a - b)).toEqual([8, 119]);
    expect(platformsOfTitle(snapshot, movie(2), [NETFLIX])).toEqual([]);
    expect(platformsOfTitle(snapshot, movie(99), [NETFLIX])).toEqual([]);
  });
});

describe("planPlatformFilter", () => {
  const snapshot = normalizeProviderWatch(doc());
  const items = [movie(1), movie(2), tv(3), movie(99)];
  const base = { snapshot, myProviderIds: [NETFLIX], region: "TR", items, now: NOW };

  it("hazır: evet / hayır / bilinmiyor sayıları", () => {
    const plan = planPlatformFilter(base);
    expect(plan.state).toBe("ready");
    expect(plan.counts).toEqual({ yes: 2, no: 1, unknown: 1, total: 4 });
    expect(plan.ageDays).toBe(0);
  });

  it("platform seçilmemişse off", () => {
    expect(planPlatformFilter({ ...base, myProviderIds: [] }).state).toBe("off");
    expect(planPlatformFilter({ ...base, myProviderIds: undefined }).state).toBe("off");
  });

  it("belge yok ya da boşsa no-data", () => {
    expect(planPlatformFilter({ ...base, snapshot: null }).state).toBe("no-data");
    expect(planPlatformFilter({ ...base, snapshot: normalizeProviderWatch({ region: "TR", items: {} }) }).state).toBe(
      "no-data",
    );
  });

  it("bölge farklıysa veri kullanılmaz", () => {
    expect(planPlatformFilter({ ...base, region: "US" }).state).toBe("region");
    // Belgede bölge yazmıyorsa eşleşmeye zorlanmaz.
    const noRegion = normalizeProviderWatch({ items: { movie_1: { a: [NETFLIX] } } });
    expect(planPlatformFilter({ ...base, snapshot: noRegion, region: "US" }).state).toBe("ready");
  });

  it("yaşı gün olarak verir; eski denetimi işaretler", () => {
    const old = normalizeProviderWatch(doc({ updatedAt: { toMillis: () => NOW - 5 * 86400000 - 1000 } }));
    const plan = planPlatformFilter({ ...base, snapshot: old });
    expect(plan.ageDays).toBe(5);
    expect(isStale(plan.ageDays)).toBe(true);
    expect(isStale(STALE_AFTER_DAYS)).toBe(false);
    expect(isStale(null)).toBe(false);
    const noStamp = normalizeProviderWatch({ region: "TR", items: { movie_1: { a: [8] } } });
    expect(planPlatformFilter({ ...base, snapshot: noStamp }).ageDays).toBeNull();
  });

  it("liste boşken hazır ve sıfır sayar", () => {
    const plan = planPlatformFilter({ ...base, items: [] });
    expect(plan.state).toBe("ready");
    expect(plan.counts.total).toBe(0);
  });
});

describe("PlatformFilterSection", () => {
  let warn;
  beforeEach(() => {
    const original = console.error;
    warn = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
      if (String(message).includes("react-test-renderer is deprecated")) return;
      original(message, ...args);
    });
  });
  const theme = { text: { primary: "#fff", secondary: "#bbb", muted: "#888" }, secondary: "#111", border: "#333" };
  const copy = PROVIDER_WATCH_COPY.tr;
  let renderer;
  afterEach(() => {
    if (renderer) act(() => renderer.unmount());
    renderer = null;
    warn.mockRestore();
  });
  const mount = (plan, extra = {}) => {
    const onToggle = jest.fn();
    act(() => {
      renderer = create(
        <PlatformFilterSection plan={plan} selected={false} onToggle={onToggle} copy={copy} theme={theme} accent="#38f" {...extra} />,
      );
    });
    return onToggle;
  };
  const texts = () => renderer.root.findAllByType("Text").map((n) => n.props.children);
  const plan = (state, counts = {}, ageDays = 0) => ({
    state,
    counts: { yes: 0, no: 0, unknown: 0, total: 0, ...counts },
    ageDays,
  });

  it("hazırken çipi ve kapsamı gösterir; çip basışı iletir", () => {
    const onToggle = mount(plan("ready", { yes: 3, no: 4, unknown: 2, total: 9 }));
    expect(texts()).toEqual(
      expect.arrayContaining([copy.section, copy.chipCount(3), copy.ready(3, 9), copy.unknown(2)]),
    );
    const chip = renderer.root.findByType("TouchableOpacity");
    expect(chip.props.accessibilityRole).toBe("switch");
    act(() => chip.props.onPress());
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("bilinmeyen yoksa ve denetim tazeyse ek not yok", () => {
    mount(plan("ready", { yes: 1, total: 1 }, 0));
    expect(texts().some((t) => String(t).includes("denetlenmedi"))).toBe(false);
    expect(texts().some((t) => String(t).includes("Son denetim"))).toBe(false);
  });

  it("denetim eskiyse yaşını söyler", () => {
    mount(plan("ready", { yes: 1, total: 1 }, 6));
    expect(texts()).toContain(copy.age(6));
  });

  it("hiçbiri yoksa çip çizmez, nedenini söyler; ama seçiliyse çip kalır (kapatılabilsin)", () => {
    mount(plan("ready", { yes: 0, no: 5, total: 5 }));
    expect(renderer.root.findAllByType("TouchableOpacity")).toHaveLength(0);
    expect(texts()).toContain(copy.none);
    act(() => renderer.unmount());
    mount(plan("ready", { yes: 0, no: 5, total: 5 }), { selected: true });
    expect(renderer.root.findAllByType("TouchableOpacity")).toHaveLength(1);
  });

  it.each([
    ["off", "off"],
    ["no-data", "noData"],
    ["region", "region"],
  ])("%s durumunda çip yok, açıklama var", (state, key) => {
    mount(plan(state));
    expect(renderer.root.findAllByType("TouchableOpacity")).toHaveLength(0);
    expect(texts()).toContain(copy[key]);
  });

  it("dili izler", () => {
    expect(getProviderWatchCopy("en")).toBe(PROVIDER_WATCH_COPY.en);
    expect(getProviderWatchCopy("xx")).toBe(PROVIDER_WATCH_COPY.en);
    expect(getProviderWatchCopy("tr").chip).toBe("Platformlarımda");
  });
});
