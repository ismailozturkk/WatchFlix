// Zevk Çemberleri Faz 4: özellik kapısı, katılım belgesi ve metin tablosu.
import { MATCH_CONSENT_VERSION, optInPayload, parseMatchConfig, readOptIn, resolveMatchFeature, strengthTier } from "../utils/matchFeature";
import { MATCH_COPY, getMatchCopy, stepText } from "../utils/matchCopy";
import { ANALYTICS_EVENTS, isValidEventName } from "../utils/analyticsEvents";

jest.mock("../services/analytics", () => ({
  ANALYTICS_EVENTS: jest.requireActual("../utils/analyticsEvents").ANALYTICS_EVENTS,
  trackEvent: jest.fn(),
}));

const NOW = new Date(2026, 10, 13);
const ADULT = "1995-06-01";
const MINOR = "2012-06-01";

describe("resolveMatchFeature", () => {
  test("bayrak kapalıyken kimseye açık değil", () => {
    expect(resolveMatchFeature({ config: null, birthDate: ADULT, now: NOW }).available).toBe(false);
    expect(resolveMatchFeature({ config: { enabled: "true" }, birthDate: ADULT, now: NOW }).available).toBe(false);
  });
  test("bayrak açık + 18+ → açık; 18 altı ya da tarihsiz → kapalı", () => {
    expect(resolveMatchFeature({ config: { enabled: true }, birthDate: ADULT, now: NOW }).available).toBe(true);
    expect(resolveMatchFeature({ config: { enabled: true }, birthDate: MINOR, now: NOW }).available).toBe(false);
    expect(resolveMatchFeature({ config: { enabled: true }, birthDate: null, now: NOW }).available).toBe(false);
  });
  test("geliştirici derlemesi bayrağı zorlar ama yaş kapısını AŞMAZ", () => {
    expect(resolveMatchFeature({ isDev: true, birthDate: ADULT, now: NOW }).available).toBe(true);
    expect(resolveMatchFeature({ isDev: true, birthDate: MINOR, now: NOW }).available).toBe(false);
  });
  test("bozuk yapılandırma kapalı sayılır", () => {
    for (const bad of [undefined, null, 1, "x", { enabled: 1 }]) expect(parseMatchConfig(bad).enabled).toBe(false);
  });
});

describe("katılım belgesi", () => {
  test("yazılacak belge yalnız tanınan kulvarları taşır; kulvarsız = katılım yok", () => {
    expect(optInPayload(["tv", "movie", "tv", "korku"])).toEqual({ optIn: true, lanes: ["tv", "movie"], consentVersion: MATCH_CONSENT_VERSION });
    expect(optInPayload([])).toEqual({ optIn: false, lanes: [], consentVersion: MATCH_CONSENT_VERSION });
    expect(optInPayload(null).optIn).toBe(false);
  });
  test("okuma: eski onay sürümü yeniden onay ister", () => {
    expect(readOptIn(null)).toEqual({ optedIn: false, lanes: [], needsConsent: false });
    expect(readOptIn({ optIn: true, lanes: ["movie"], consentVersion: MATCH_CONSENT_VERSION })).toEqual({ optedIn: true, lanes: ["movie"], needsConsent: false });
    expect(readOptIn({ optIn: true, lanes: ["movie"], consentVersion: 0 })).toMatchObject({ optedIn: false, needsConsent: true });
    expect(readOptIn({ optIn: false, lanes: ["movie"], consentVersion: 1 }).optedIn).toBe(false);
  });
  test("güç kademesi", () => {
    expect(strengthTier({ eligible: true, strength: 20 })).toBe("ready");
    expect(strengthTier({ eligible: false, strength: 50 })).toBe("mid");
    expect(strengthTier({ eligible: false, strength: 10 })).toBe("low");
    expect(strengthTier(null)).toBe("low");
  });
});

describe("metin tablosu", () => {
  const STEPS = ["watch", "favorites", "recent", "rate", "comment", "spread", "diversify", "twinWatch", "twinRate", "ready"];
  const shape = (obj) =>
    Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v && typeof v === "object" && !Array.isArray(v) ? shape(v) : Array.isArray(v) ? `array:${v.length}` : typeof v]));

  test("altı dil aynı şekilde; her adımın metni var", () => {
    const langs = Object.keys(MATCH_COPY);
    expect(langs.sort()).toEqual(["de", "en", "es", "it", "pt", "tr"]);
    const ref = shape(MATCH_COPY.tr);
    for (const lang of langs) {
      expect(shape(MATCH_COPY[lang])).toEqual(ref);
      for (const id of STEPS) expect(stepText(MATCH_COPY[lang], { id, need: 3 })).toBeTruthy();
    }
  });
  test("bilinmeyen dil İngilizce; bilinmeyen adım boş", () => {
    expect(getMatchCopy("xx")).toBe(MATCH_COPY.en);
    expect(stepText(MATCH_COPY.tr, { id: "yok" })).toBe("");
    expect(stepText(MATCH_COPY.tr, { id: "rate", need: 12 })).toBe("12 yapım daha puanla");
  });
  test("onay metni yaş, konum, kullanıcı adı göstermeme ve ayrılma hakkını söyler (tr)", () => {
    const text = MATCH_COPY.tr.consent.points.join(" ");
    for (const word of ["18", "konum", "kullanıcı adın", "ayrılabilirsin", "silinir"]) expect(text).toContain(word);
  });
});

describe("ölçüm olayları", () => {
  test("adlar geçerli ve kişisel veri taşımaz", () => {
    for (const key of ["MATCH_OPT_IN", "MATCH_OPT_OUT", "MATCH_STRENGTH_VIEWED", "MATCH_STEP_DONE"]) {
      expect(isValidEventName(ANALYTICS_EVENTS[key])).toBe(true);
    }
  });

  test("Hub kartı: kulvar başına bir kez görüldü; adım değişince tamamlandı", () => {
    const { trackEvent } = require("../services/analytics");
    const { trackLaneView, resetMatchAnalyticsSession } = require("../services/matchAnalytics");
    resetMatchAnalyticsSession();
    trackEvent.mockClear();
    trackLaneView("movie", { eligible: false, strength: 30, next: { id: "rate", need: 5 } });
    trackLaneView("movie", { eligible: false, strength: 31, next: { id: "rate", need: 4 } });
    trackLaneView("movie", { eligible: true, strength: 50, next: { id: "twinWatch", need: 40 } });
    const names = trackEvent.mock.calls.map(([name, params]) => [name, params]);
    expect(names).toEqual([
      [ANALYTICS_EVENTS.MATCH_STRENGTH_VIEWED, { lane: "movie", tier: "low", eligible: 0 }],
      [ANALYTICS_EVENTS.MATCH_STEP_DONE, { lane: "movie", step: "rate" }],
    ]);
  });
});
