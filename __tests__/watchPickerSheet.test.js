// __tests__/watchPickerSheet.test.js
//
// "Ne izlesem?" giriş kartı + seçim sayfasının AKIŞI (saf kararlar __tests__/watchPicker.test.js'te):
// açılışta karıştırma → bitince sonuç, dokunarak atlama, "Hareketi azalt", tür çipleri, tekrarsız
// "başka biri", geçmiş şeridi, TMDB ayrıntısı (yayınlanmadı uyarısı), detaya gitme KAPANIŞTAN SONRA
// (onDismissed), analitik. Görsel parçalar (alt sayfa kabuğu, cam düğme, afiş, simgeler) taklit edilir.

import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => {
  class Value {
    constructor(v) { this.v = v; }
    setValue(v) { this.v = v; }
    stopAnimation() {}
  }
  return {
    StyleSheet: { create: (s) => s, absoluteFill: {}, absoluteFillObject: {}, hairlineWidth: 1, flatten: (s) => s },
    View: "View",
    Text: "Text",
    Pressable: "Pressable",
    Animated: {
      View: "AnimatedView",
      Value,
      spring: () => ({ start: (cb) => cb && cb({ finished: true }) }),
    },
  };
});
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "Gradient" }));
const mockHost = (name) => ({
  __esModule: true,
  default: ({ children, ...props }) => require("react").createElement(name, props, children),
});
jest.mock("../components/PosterImage", () => mockHost("Poster"));
jest.mock("../components/common/GlassCloseButton", () => mockHost("CloseButton"));
jest.mock("../components/common/SheetScroll", () => mockHost("Scroll"));

let mockSheetProps = null;
jest.mock("../components/common/BottomSheetModal", () => ({
  __esModule: true,
  default: (props) => {
    mockSheetProps = props;
    return props.visible ? require("react").createElement("Sheet", null, props.children) : null;
  },
}));

const mockTheme = {
  primary: "#111111", secondary: "#1b1b1b", between: "#222222", border: "#333333", accent: "#3388ff",
  text: { primary: "#ffffff", secondary: "#bbbbbb", muted: "#888888" },
};
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
jest.mock("../context/AppSettingsContext", () => ({
  useApiSettings: () => ({ API_KEY: "key" }),
  useImageQualitySettings: () => ({ getTmdbUrl: (path) => `https://img/${path}` }),
}));
let mockReduce = false;
jest.mock("../hooks/useReduceMotion", () => ({ __esModule: true, default: () => mockReduce }));
jest.mock("../utils/genreLabels", () => ({ buildGenreMap: () => ({ 28: "Aksiyon", 18: "Dram" }) }));

const mockHaptic = { selectionAsync: jest.fn(() => Promise.resolve()), notificationAsync: jest.fn(() => Promise.resolve()) };
jest.mock("../services/hapticsService", () => ({
  selectionAsync: (...a) => mockHaptic.selectionAsync(...a),
  notificationAsync: (...a) => mockHaptic.notificationAsync(...a),
  NotificationFeedbackType: { Success: "success" },
}));
const mockReadTmdb = jest.fn();
jest.mock("../services/favoriteRecommendations", () => ({ readTmdb: (...a) => mockReadTmdb(...a) }));
const mockTrack = jest.fn();
jest.mock("../services/analytics", () => ({
  ANALYTICS_EVENTS: { WATCH_PICK_ROLLED: "watch_pick_rolled", WATCH_PICK_OPENED: "watch_pick_opened" },
  trackEvent: (...a) => mockTrack(...a),
}));
// Deterministik, çeşitli "rastgele": 0,1,2,0,1,2…
let mockCounter = 0;
jest.mock("../utils/randomPick", () => ({ randomInt: (n) => (n <= 1 ? 0 : mockCounter++ % n) }));

const WatchPickerEntry = require("../components/lists/WatchPickerEntry").default;
const WatchPickerSheet = require("../components/lists/WatchPickerSheet").default;
const { WATCH_PICKER_COPY } = require("../utils/watchPickerCopy");

global.IS_REACT_ACT_ENVIRONMENT = true;
const tr = WATCH_PICKER_COPY.tr;

const movie = (id, extra = {}) => ({ id, type: "movie", name: `Film ${id}`, imagePath: `/m${id}.jpg`, ...extra });
const show = (id, extra = {}) => ({ id, type: "tv", name: `Dizi ${id}`, imagePath: `/s${id}.jpg`, ...extra });
const ITEMS = [movie(1, { genres: [28], minutes: 92 }), movie(2), show(3, { seasonCount: 1 })];

let renderer;
let errorSpy;
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-10-19T12:00:00Z"));
  mockCounter = 0;
  mockReduce = false;
  mockSheetProps = null;
  mockTrack.mockClear();
  mockHaptic.selectionAsync.mockClear();
  mockHaptic.notificationAsync.mockClear();
  mockReadTmdb.mockReset();
  mockReadTmdb.mockResolvedValue({});
  const original = console.error;
  errorSpy = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
});
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = null;
  errorSpy.mockRestore();
  jest.useRealTimers();
});

const host = (testID) => renderer.root.findAll((n) => typeof n.type === "string" && n.props.testID === testID);
const one = (testID) => {
  const found = host(testID);
  if (found.length !== 1) throw new Error(`${testID}: ${found.length} düğüm`);
  return found[0];
};
const textOf = (testID) => {
  const node = one(testID);
  const parts = node.type === "Text" ? [node] : node.findAllByType("Text");
  return parts.map((n) => [].concat(n.props.children).join("")).join("");
};
const press = (testID) => act(() => one(testID).props.onPress());
const advance = async (ms) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    // Zincirli promise'lar (readTmdb → then → setDetails) için birkaç mikro görev.
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
};

const renderSheet = async (props = {}) => {
  const onClose = jest.fn();
  const onOpen = jest.fn();
  await act(async () => {
    renderer = create(<WatchPickerSheet visible items={ITEMS} onClose={onClose} onOpen={onOpen} {...props} />);
  });
  return { onClose, onOpen };
};
const settleFully = () => advance(260 + 2000);

describe("WatchPickerEntry", () => {
  const renderEntry = (props = {}) => {
    const onPick = jest.fn();
    act(() => {
      renderer = create(<WatchPickerEntry theme={mockTheme} copy={tr} items={ITEMS} onPick={onPick} {...props} />);
    });
    return onPick;
  };

  it("zar karışık, Film ve Dizi düğmeleri doğrudan o türle açar", () => {
    const onPick = renderEntry();
    press("watch-picker-entry");
    press("watch-picker-entry-movie");
    press("watch-picker-entry-tv");
    expect(onPick.mock.calls).toEqual([["mixed"], ["movie"], ["tv"]]);
  });

  it("etiketler kısa; erişilebilirlik etiketi sayıyı taşır", () => {
    renderEntry();
    expect(textOf("watch-picker-entry")).toBe("Ne izlesem?");
    expect(textOf("watch-picker-entry-movie")).toBe("Film");
    expect(textOf("watch-picker-entry-tv")).toBe("Dizi");
    expect(one("watch-picker-entry-movie").props.accessibilityLabel).toContain("2"); // 2 film
    expect(one("watch-picker-entry-tv").props.accessibilityLabel).toContain("1"); // 1 dizi
  });

  it("havuzu boş tür kapalı; boş listede ikisi de kapalı", () => {
    renderEntry({ items: [movie(1), movie(2)] });
    expect(one("watch-picker-entry-tv").props.disabled).toBe(true);
    expect(one("watch-picker-entry-movie").props.disabled).toBe(false);
    act(() => renderer.unmount());
    renderEntry({ items: [] });
    expect(one("watch-picker-entry-movie").props.disabled).toBe(true);
    expect(one("watch-picker-entry-tv").props.disabled).toBe(true);
  });

  it("süzgeçli listede tek satırlık not çıkar, süzgeçsizde çıkmaz", () => {
    renderEntry();
    expect(host("watch-picker-entry-note")).toHaveLength(0);
    act(() => renderer.unmount());
    renderEntry({ filtered: true });
    expect(textOf("watch-picker-entry-note")).toBe("Süzdüğün listeden seçilir");
  });
});

describe("WatchPickerSheet", () => {
  it("açılınca karıştırır, ~1 sn sonra sonuç verir; sonuç anında eylemler açılır", async () => {
    await renderSheet();
    expect(textOf("watch-picker-pool")).toBe("3 yapım arasından");
    // Sayfa oturmadan önce seçim yok.
    expect(mockTrack).not.toHaveBeenCalled();

    await advance(260);
    expect(mockTrack).toHaveBeenCalledWith("watch_pick_rolled", { media_type: "mixed", pool_size: 3, reroll: false });
    expect(one("watch-picker-open").props.disabled).toBe(true); // karıştırırken kapalı
    expect(one("watch-picker-reroll").props.disabled).toBe(true);

    await advance(2000);
    expect(one("watch-picker-open").props.disabled).toBe(false);
    expect(one("watch-picker-reroll").props.disabled).toBe(false);
    expect(mockHaptic.notificationAsync).toHaveBeenCalledWith("success");
    expect(textOf("watch-picker-title")).toMatch(/^(Film|Dizi) \d$/);
  });

  it("karıştırırken sahneye dokunmak hemen sonuca atlar", async () => {
    await renderSheet();
    await advance(260 + 120);
    expect(one("watch-picker-open").props.disabled).toBe(true);
    press("watch-picker-stage");
    expect(one("watch-picker-open").props.disabled).toBe(false);
    // Atlama kutlama titreşimi vermez (kullanıcı zaten dokundu).
    expect(mockHaptic.notificationAsync).not.toHaveBeenCalled();
  });

  it("Hareketi azalt: karıştırma yok, sayfa oturunca doğrudan sonuç", async () => {
    mockReduce = true;
    await renderSheet();
    await advance(260);
    expect(one("watch-picker-open").props.disabled).toBe(false);
    expect(mockHaptic.selectionAsync).not.toHaveBeenCalled();
  });

  it("Başka biri: art arda aynı yapım çıkmaz, geçmiş şeridi dolar", async () => {
    await renderSheet();
    await settleFully();
    const first = textOf("watch-picker-title");
    press("watch-picker-reroll");
    await advance(2000);
    const second = textOf("watch-picker-title");
    expect(second).not.toBe(first);
    expect(mockTrack).toHaveBeenLastCalledWith("watch_pick_rolled", { media_type: "mixed", pool_size: 3, reroll: true });
    // İki sonuç → şerit iki afiş gösterir (tek sonuçta gizli).
    expect(renderer.root.findAll((n) => typeof n.type === "string" && String(n.props.testID || "").startsWith("watch-picker-history-"))).toHaveLength(2);
  });

  it("tür çipi havuzu daraltır; boş tür kapalı", async () => {
    await renderSheet({ items: [movie(1), movie(2)] });
    expect(one("watch-picker-type-tv").props.disabled).toBe(true);
    // Yalnız film var → varsayılan tür Film.
    expect(one("watch-picker-type-movie").props.accessibilityState.selected).toBe(true);
    await advance(260);
    expect(mockTrack).toHaveBeenCalledWith("watch_pick_rolled", expect.objectContaining({ media_type: "movie", pool_size: 2 }));
  });

  it("karışık listede tür değiştirince yeniden seçer ve yalnız o türden verir", async () => {
    await renderSheet();
    await settleFully();
    press("watch-picker-type-tv");
    await advance(2000);
    expect(textOf("watch-picker-title")).toBe("Dizi 3");
    expect(textOf("watch-picker-pool")).toBe("1 yapım arasından");
  });

  it("giriş satırından gelen tür doğrudan seçilir (karışık listede bile)", async () => {
    await renderSheet({ initialType: "tv" });
    expect(one("watch-picker-type-tv").props.accessibilityState.selected).toBe(true);
    await advance(260);
    expect(mockTrack).toHaveBeenCalledWith("watch_pick_rolled", { media_type: "tv", pool_size: 1, reroll: false });
    await advance(2000);
    expect(textOf("watch-picker-title")).toBe("Dizi 3");
  });

  it("istenen türün havuzu boşsa varsayılana düşer", async () => {
    await renderSheet({ items: [movie(1), movie(2)], initialType: "tv" });
    expect(one("watch-picker-type-movie").props.accessibilityState.selected).toBe(true);
  });

  it("süzgeçli listede havuz satırı bunu söyler", async () => {
    await renderSheet({ filtered: true });
    expect(textOf("watch-picker-pool")).toBe("Süzülmüş listenden · 3 yapım");
  });

  it("gerekçe satırı: uzun süredir listede bekleyen yapım", async () => {
    await renderSheet({ items: [movie(1, { dateAdded: "2026-06-01T00:00:00Z" })] });
    await advance(260);
    expect(textOf("watch-picker-reason")).toBe("4 aydır listende bekliyor");
  });

  it("TMDB ayrıntısı: yıl/puan gelir; yayınlanmamış yapım uyarılır", async () => {
    mockReadTmdb.mockResolvedValue({ release_date: "2027-03-01", status: "Planned", vote_average: 0, overview: "Özet" });
    await renderSheet({ items: [movie(1)] });
    await advance(260);
    expect(mockReadTmdb).toHaveBeenCalledWith("/movie/1", expect.objectContaining({ apiKey: "key", language: "tr", type: "movie" }));
    expect(textOf("watch-picker-unreleased")).toBe(tr.sheet.unreleased);
    expect(textOf("watch-picker-meta")).toContain("2027");
  });

  it("ayrıntı isteği düşerse sayfa onsuz çalışır", async () => {
    mockReadTmdb.mockRejectedValue(new Error("ağ yok"));
    await renderSheet({ items: [movie(1)] });
    await advance(260);
    expect(textOf("watch-picker-title")).toBe("Film 1");
    expect(host("watch-picker-unreleased")).toHaveLength(0);
  });

  it("Detaylara git: önce sayfa kapanır, detay KAPANIŞTAN SONRA (onDismissed) açılır", async () => {
    const { onClose, onOpen } = await renderSheet({ items: [movie(1)] });
    await advance(260);
    press("watch-picker-open");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled(); // kapanış bitmeden gezinme yok
    expect(mockTrack).toHaveBeenCalledWith("watch_pick_opened", { media_type: "movie", rerolls: 0 });
    act(() => mockSheetProps.onDismissed());
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 1, type: "movie" }));
    // İkinci kapanış bildirimi aynı yapımı yeniden açmaz.
    act(() => mockSheetProps.onDismissed());
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("kapatıp açmadan kapanırsa (X) detay açılmaz", async () => {
    const { onOpen } = await renderSheet({ items: [movie(1)] });
    await advance(260);
    act(() => mockSheetProps.onDismissed());
    expect(onOpen).not.toHaveBeenCalled();
  });
});
