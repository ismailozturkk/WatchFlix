// __tests__/ratingSummary.test.js
//
// Sade puan özeti: saf biçim yardımcıları (utils/ratingSummaryModel.js) + bileşen
// (components/RatingSummary.js; gerçek computeHybrid, taklit abonelikler) + erişilebilirlik metinleri.
import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, hairlineWidth: 1 },
  View: "View",
  Text: "Text",
  TouchableOpacity: "TouchableOpacity",
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
const mockToast = { show: jest.fn() };
jest.mock("@components/AppToast", () => ({ __esModule: true, default: mockToast }));
jest.mock("@context/ThemeContext", () => ({
  useTheme: () => ({
    theme: { accent: "#38f", colors: { yellow: "#fc0" }, text: { primary: "#fff", muted: "#888" } },
  }),
}));
jest.mock("@context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "u1" } }) }));
let mockLang = "tr";
jest.mock("@context/LanguageContext", () => ({ useLanguage: () => ({ language: mockLang }) }));
jest.mock("@utils/i18nText", () => ({ i18nText: (_key, fallback) => fallback }));
let mockUnreleased = false;
jest.mock("@utils/watchState", () => ({ isUnreleased: () => mockUnreleased }));

// ratingsService: gerçek computeHybrid, Firebase ve abonelikler taklit.
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
  doc: jest.fn(), getDoc: jest.fn(), setDoc: jest.fn(), deleteDoc: jest.fn(), collection: jest.fn(),
  query: jest.fn(), orderBy: jest.fn(), onSnapshot: jest.fn(), serverTimestamp: jest.fn(), runTransaction: jest.fn(),
}));
jest.mock("../services/usageTrackerService", () => ({ trackFirestoreWrite: jest.fn(), trackFirestoreDelete: jest.fn() }));
let mockAgg = { count: 0, sum: 0 };
let mockMine = null;
jest.mock("@services/ratingsService", () => {
  const actual = jest.requireActual("../services/ratingsService");
  return {
    ...actual,
    subscribeToAggregate: (_key, cb) => {
      cb(mockAgg);
      return () => {};
    },
    subscribeToMyRating: (_key, _uid, cb) => {
      cb(mockMine);
      return () => {};
    },
  };
});

const RatingSummary = require("../components/RatingSummary").default;
const { formatMyRating, formatScore, summarizeVotes } = require("../utils/ratingSummaryModel");
const { RATING_SUMMARY_COPY, getRatingSummaryCopy } = require("../utils/ratingSummaryCopy");

global.IS_REACT_ACT_ENVIRONMENT = true;

describe("biçim yardımcıları", () => {
  it("formatScore: bir ondalık, puan yoksa null", () => {
    expect(formatScore(7.84)).toBe("7.8");
    expect(formatScore(10)).toBe("10.0");
    expect(formatScore(0)).toBeNull();
    expect(formatScore(null)).toBeNull();
    expect(formatScore("x")).toBeNull();
  });
  it("formatMyRating: tam sayı yalın, ondalık korunur", () => {
    expect(formatMyRating(8)).toBe("8");
    expect(formatMyRating(7.5)).toBe("7.5");
    expect(formatMyRating("9")).toBe("9");
    expect(formatMyRating(0)).toBeNull();
    expect(formatMyRating(null)).toBeNull();
  });
  it("summarizeVotes: iki kaynağın toplamı, kısa biçim", () => {
    expect(summarizeVotes(12000, 300)).toBe("12.3K");
    expect(summarizeVotes(0, 5)).toBe("5");
    expect(summarizeVotes(0, 0)).toBeNull();
    expect(summarizeVotes(undefined, undefined)).toBeNull();
    expect(summarizeVotes(-3, 2)).toBe("2");
  });
});

describe("RatingSummary", () => {
  let renderer;
  let warn;
  beforeEach(() => {
    mockLang = "tr";
    mockAgg = { count: 0, sum: 0 };
    mockMine = null;
    mockUnreleased = false;
    mockToast.show.mockClear();
    const original = console.error;
    warn = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
      if (String(message).includes("react-test-renderer is deprecated")) return;
      original(message, ...args);
    });
  });
  afterEach(() => {
    if (renderer) act(() => renderer.unmount());
    renderer = null;
    warn.mockRestore();
  });

  const mount = (props = {}) => {
    const onPressRate = jest.fn();
    act(() => {
      renderer = create(
        <RatingSummary mediaType="movie" mediaId={1} tmdbAvg={7.8} tmdbCount={12000} onPressRate={onPressRate} {...props} />,
      );
    });
    return onPressRate;
  };
  const texts = () =>
    renderer.root.findAllByType("Text").map((n) => (Array.isArray(n.props.children) ? n.props.children.join("") : n.props.children));
  const button = () => renderer.root.findByType("TouchableOpacity");
  const iconNames = () => renderer.root.findAllByType("Icon").map((n) => n.props.name);

  it("tek yıldız, 7.8/10 ve kısa oy sayısı; beş yıldız şeridi YOK", () => {
    mount();
    expect(texts()).toEqual(expect.arrayContaining(["7.8", "/10", "12K", "Puan ver"]));
    expect(iconNames().filter((name) => name === "star")).toHaveLength(1); // yalnız altın yıldız
    expect(iconNames()).toContain("star-outline"); // düğme
    expect(iconNames()).not.toContain("star-half");
  });

  it("uygulama oyları puana ve oy toplamına katılır", () => {
    mockAgg = { count: 4, sum: 40 }; // dört kişi 10 vermiş
    mount({ tmdbAvg: 6, tmdbCount: 100 });
    expect(texts()).toContain("6.2"); // (6*100 + 40) / 104
    expect(texts()).toContain("104");
  });

  it("puan verdiysen düğmede yalnız kendi puanın (dolu accent yıldız + sayı)", () => {
    mockMine = 8;
    mount();
    const t = texts();
    expect(t).toContain("8");
    expect(t).not.toContain("Puan ver");
    expect(iconNames().filter((name) => name === "star")).toHaveLength(2); // altın + kendi puanın
    expect(button().props.accessibilityLabel).toBe(`${RATING_SUMMARY_COPY.tr.score("7.8", "12K")}. ${RATING_SUMMARY_COPY.tr.rated("8")}`);
  });

  it("ondalıklı kendi puanı korunur", () => {
    mockMine = 7.5;
    mount();
    expect(texts()).toContain("7.5");
  });

  it("düğme puanlama sayfasını açar", () => {
    const onPressRate = mount();
    act(() => button().props.onPress());
    expect(onPressRate).toHaveBeenCalledTimes(1);
  });

  it("yayınlanmadıysa kilitli: toast, puanlama açılmaz", () => {
    mockUnreleased = true;
    const onPressRate = mount({ tmdbAvg: 0, tmdbCount: 0, releaseDate: "2999-01-01" });
    expect(iconNames()).toContain("lock-closed");
    act(() => button().props.onPress());
    expect(onPressRate).not.toHaveBeenCalled();
    expect(mockToast.show).toHaveBeenCalledTimes(1);
    expect(button().props.accessibilityLabel).toContain(RATING_SUMMARY_COPY.tr.locked);
  });

  it("kilitli olsa da zaten puan verdiysen yönetebilirsin", () => {
    mockUnreleased = true;
    mockMine = 6;
    const onPressRate = mount();
    act(() => button().props.onPress());
    expect(onPressRate).toHaveBeenCalledTimes(1);
  });

  it("hiç puan / oy yoksa tire gösterir, /10 ve oy sayısı çizmez", () => {
    mount({ tmdbAvg: 0, tmdbCount: 0 });
    const t = texts();
    expect(t).toContain("–");
    expect(t).not.toContain("/10");
    expect(button().props.accessibilityLabel).toContain(RATING_SUMMARY_COPY.tr.noScore);
  });

  it("dili izler (İngilizce erişilebilirlik)", () => {
    mockLang = "en";
    mount();
    expect(button().props.accessibilityLabel).toBe(`${RATING_SUMMARY_COPY.en.score("7.8", "12K")}. ${RATING_SUMMARY_COPY.en.rate}`);
    expect(getRatingSummaryCopy("xx")).toBe(RATING_SUMMARY_COPY.en);
  });
});
