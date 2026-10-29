// __tests__/importViews.test.js
// İçe aktarma ekranlarının (analiz, ilerleme, sonuç/kesinti, aktarım geçmişi) gerçek
// metinler ve dolu veriyle hatasız çizildiği; beş dilin hepsinde eksik anahtar olmadığı.

jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: (styles) => styles, hairlineWidth: 1, absoluteFill: {}, absoluteFillObject: {} },
  PixelRatio: { get: () => 2 },
  Platform: { OS: "ios", select: (options) => options.ios ?? options.default },
  // AppText (babel ile tüm <Text>'lerin yerine geçen bileşen) RN Animated'ı da sarar.
  Animated: { View: "AnimatedView", Text: "AnimatedText", createAnimatedComponent: (component) => component },
}));
jest.mock("react-native-reanimated", () => {
  const anim = () => {
    const builder = { delay: () => builder, duration: () => builder };
    return builder;
  };
  const Animated = { View: "AnimatedView", createAnimatedComponent: (component) => component };
  return {
    __esModule: true,
    default: Animated,
    Easing: { out: () => () => 0, cubic: () => 0, quad: () => 0 },
    FadeIn: anim(),
    FadeInDown: anim(),
    FadeInUp: anim(),
    FadeInLeft: anim(),
    LinearTransition: anim(),
    cancelAnimation: () => {},
    useSharedValue: (value) => ({ value }),
    useAnimatedProps: (fn) => fn(),
    useAnimatedStyle: (fn) => fn(),
    withDelay: (_ms, value) => value,
    withRepeat: (value) => value,
    withSequence: (...values) => values.at(-1),
    withSpring: (value) => value,
    withTiming: (value) => value,
  };
});
jest.mock("react-native-svg", () => ({
  __esModule: true,
  default: "Svg",
  Circle: "Circle",
  Defs: "Defs",
  LinearGradient: "SvgGradient",
  Stop: "Stop",
}));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("../components/AppIcon", () => ({ __esModule: true, default: "Icon" }));
jest.mock("../components/common/GlassTouchable", () => ({ __esModule: true, default: "GlassTouchable" }));
jest.mock("../hooks/useReduceMotion", () => ({ __esModule: true, default: () => false }));
jest.mock("../services/hapticsService", () => ({ triggerHaptic: jest.fn() }));
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({}));

const React = require("react");
const { create, act } = require("react-test-renderer");
const ImportAnalysisView = require("../components/import/ImportAnalysisView").default;
const ImportProgressView = require("../components/import/ImportProgressView").default;
const ImportResultView = require("../components/import/ImportResultView").default;
const ImportHistoryCard = require("../components/import/ImportHistoryCard").default;
const { IMPORT_COPY } = require("../components/import/importCopy");
const { buildBundleFromFiles } = require("../services/import/importSources");
const { analyzeImport } = require("../services/import/importAnalysis");
const { createImportProgress, reduceImportProgress } = require("../services/import/importProgress");
const { mergeSourceStats, emptySourceStats } = require("../services/import/importStats");
const { ImportError } = require("../services/import/importErrors");

global.IS_REACT_ACT_ENVIRONMENT = true;

const theme = {
  accent: "#138DF0",
  primary: "#000",
  secondary: "#1c1c1e",
  border: "#333",
  text: { primary: "#fff", secondary: "#ccc", muted: "#888" },
};

function render(element) {
  let renderer;
  act(() => {
    renderer = create(element);
  });
  const texts = renderer.root
    .findAllByType("Text")
    .map((node) => [].concat(node.props.children).filter((child) => typeof child === "string" || typeof child === "number").join(""))
    .filter(Boolean);
  act(() => renderer.unmount());
  return texts;
}

const bundle = buildBundleFromFiles({
  "diary.csv": `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
2023-01-02,Heat,1995,u,4.5,,,2023-01-01
2024-03-02,Heat,1995,u,5,Yes,,2024-03-01
2024-05-02,Dune,2021,u,3,,,2024-05-01`,
  "watchlist.csv": "Date,Name,Year,Letterboxd URI\n2024-06-01,Alien,1979,u",
  "lists/x.csv": "Position,Name,Year,URL\n1,Heat,1995,u",
  "ratings (imdb).csv": "Const,Your Rating,Date Rated,Title,Title Type,Year\ntt1,8,2024-01-01,Show,TV Series,2010",
});

function progressState() {
  let state = createImportProgress({ matchTotal: 4, saveTotal: 3, listTotal: 1, now: 0 });
  state = reduceImportProgress(state, { type: "match", done: 1, total: 4, status: "matched", item: { title: "Heat", year: 1995 }, media: { id: 1, title: "Heat", poster_path: "/h.jpg" } }, 10);
  state = reduceImportProgress(state, { type: "match", done: 2, total: 4, status: "unmatched", item: { title: "Kayıp" } }, 20);
  state = reduceImportProgress(state, { type: "stage", stage: "saving", total: 3, done: 0 }, 30);
  state = reduceImportProgress(state, { type: "save", done: 1, total: 3, outcome: "added", item: { id: 1, title: "Heat", poster_path: "/h.jpg", sourceYear: 1995 } }, 40);
  return state;
}

describe.each(Object.keys(IMPORT_COPY))("%s", (language) => {
  const copy = IMPORT_COPY[language];

  test("analiz ekranı: başlık, sayılar, puan dağılımı ve 'İçeri aktar'", () => {
    const analysis = analyzeImport(bundle);
    const texts = render(React.createElement(ImportAnalysisView, {
      parsed: bundle,
      analysis,
      copy,
      theme,
      includeWatched: true,
      includeWatchlist: true,
      includeCustomLists: true,
      onToggleWatched: () => {},
      onToggleWatchlist: () => {},
      onToggleCustomLists: () => {},
      targetList: "watchedMovies",
      onTargetChange: () => {},
      importCount: 5,
      onBack: () => {},
      onImport: () => {},
    }));
    expect(texts).toContain(copy.analysis.title("Letterboxd + IMDb"));
    expect(texts).toContain(copy.analysis.ratingsTitle);
    expect(texts).toContain(copy.analysis.importBtn(5));
    expect(texts).toContain(copy.analysis.decade(1990));
  });

  test("ilerleme ekranı: aşama, sayaç, durum rozeti ve durdurma onayı", () => {
    const state = progressState();
    const texts = render(React.createElement(ImportProgressView, {
      progress: state,
      copy,
      theme,
      cancelling: false,
      confirmingStop: true,
      onAskStop: () => {},
      onDismissStop: () => {},
      onConfirmStop: () => {},
    }));
    expect(texts).toContain(copy.run.heroSaving);
    expect(texts).toContain(copy.run.counter(1, 3));
    expect(texts).toContain(copy.run.statusAdded);
    expect(texts).toContain(copy.run.stopTitle);
    expect(texts).toContain(copy.run.stageLists);
  });

  test("sonuç ve kesinti ekranları", () => {
    const success = render(React.createElement(ImportResultView, {
      variant: "success",
      result: { count: 12, ratingsCount: 3, reviewsCount: 1, customListsCount: 1, customListItemsCount: 2, unmatchedCount: 1, unmatchedItems: [{ title: "Kayıp", year: 2001 }], retryableCount: 2, failedMatchCount: 2, posters: ["/a.jpg", "/b.jpg", "/c.jpg"], durationMs: 75000 },
      copy,
      theme,
      onDone: () => {},
      onRetryFailed: () => {},
    }));
    expect(success).toContain(copy.successTitle);
    expect(success).toContain(copy.result.duration(copy.result.minSec(1, 15)));
    expect(success).toContain(copy.result.retry(2));
    expect(success).toContain(copy.result.unmatchedShow(1));

    const interrupted = render(React.createElement(ImportResultView, {
      variant: "interrupted",
      error: new ImportError("network"),
      summary: { saved: 0, lists: 0, matched: 3 },
      progress: progressState(),
      copy,
      theme,
      onDone: () => {},
      onResume: () => {},
    }));
    expect(interrupted).toContain(copy.result.interruptedTitle);
    expect(interrupted).toContain(copy.errors.network);
    expect(interrupted).toContain(copy.result.nothingSaved);
    expect(interrupted).toContain(copy.result.resume);
  });

  test("aktarım geçmişi: birikimli sayılar, sıfırlama onayı ve boş durum", () => {
    let letterboxd = mergeSourceStats(emptySourceStats(), { titles: 1204, ratings: 860, reviews: 45, lists: 6 }, { at: "2026-10-01T10:00:00Z" });
    letterboxd = mergeSourceStats(letterboxd, { titles: 20 }, { at: "2026-10-29T10:00:00Z" });
    const texts = render(React.createElement(ImportHistoryCard, {
      stats: { letterboxd, imdb: emptySourceStats() },
      loading: false,
      copy,
      theme,
      locale: "en-US",
      resetState: { source: "letterboxd", phase: "confirm" },
      onAskReset: () => {},
      onCancelReset: () => {},
      onConfirmReset: () => {},
    }));
    expect(texts).toContain(copy.history.title);
    expect(texts).toContain(copy.history.resetTitle("Letterboxd"));
    expect(texts).toContain(copy.history.resetBody(copy.sourceFrom.letterboxd));
    expect(texts).not.toContain("IMDb"); // aktarımı olmayan kaynak gösterilmez

    const empty = render(React.createElement(ImportHistoryCard, {
      stats: { letterboxd: emptySourceStats(), imdb: emptySourceStats() },
      loading: false,
      copy,
      theme,
      locale: "en-US",
      resetState: null,
      onAskReset: () => {},
      onCancelReset: () => {},
      onConfirmReset: () => {},
    }));
    expect(empty).toContain(copy.history.empty);
  });
});
