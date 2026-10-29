// __tests__/importDataModalFlow.test.js
// ImportDataModal'ın akışı uçtan uca (servisler taklit): yapıştır → içerik analizi →
// "İçeri aktar" → ilerleme (bu sırada kapatma = durdurma onayı) → başarı; kesintide
// "kaldığı yerden devam"; aktarım geçmişi kartından kaynak sıfırlama onayı.

jest.mock("react-native", () => {
  const React = require("react");
  const host = (name) => {
    const Component = React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => ({ scrollTo: () => {}, scrollToEnd: () => {} }));
      return React.createElement(name, props, props.children);
    });
    Component.displayName = name;
    return Component;
  };
  return {
    Modal: host("Modal"),
    View: "View",
    Text: "Text",
    TextInput: "TextInput",
    TouchableOpacity: "TouchableOpacity",
    ScrollView: host("ScrollView"),
    ActivityIndicator: "ActivityIndicator",
    Animated: { View: "AnimatedView", Text: "AnimatedText", createAnimatedComponent: (component) => component },
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
    Platform: { OS: "ios", select: (options) => options.ios ?? options.default },
    PixelRatio: { get: () => 2 },
    StyleSheet: { create: (styles) => styles, hairlineWidth: 1, absoluteFill: {}, absoluteFillObject: {} },
  };
});
jest.mock("../components/typography/AppText", () => ({
  AppText: "Text",
  AppTextInput: "TextInput",
  AnimatedAppText: "Text",
  ReanimatedAppText: "Text",
}));
jest.mock("react-native-reanimated", () => {
  const anim = () => {
    const builder = { delay: () => builder, duration: () => builder };
    return builder;
  };
  return {
    __esModule: true,
    default: { View: "AnimatedView", createAnimatedComponent: (component) => component },
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
jest.mock("react-native-svg", () => ({ __esModule: true, default: "Svg", Circle: "Circle", Defs: "Defs", LinearGradient: "SvgGradient", Stop: "Stop" }));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("expo-clipboard", () => ({ getStringAsync: jest.fn(async () => "") }));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn(async () => ({ canceled: true })) }));
jest.mock("expo-file-system/legacy", () => ({ readAsStringAsync: jest.fn(), EncodingType: { Base64: "base64" } }));
jest.mock("../components/AppIcon", () => ({ __esModule: true, default: "Icon" }));
jest.mock("../components/common/ModalBlurBackdrop", () => ({ __esModule: true, default: "Backdrop" }));
jest.mock("../components/common/GlassCloseButton", () => ({ __esModule: true, default: "CloseButton" }));
jest.mock("../components/common/GlassTouchable", () => ({ __esModule: true, default: "GlassTouchable" }));
jest.mock("../components/common/GlassBox", () => ({ __esModule: true, default: "GlassBox" }));
jest.mock("../components/import/ImportHelpModal", () => ({ __esModule: true, default: () => null }));
jest.mock("../components/toast/ModalToastHost", () => ({ __esModule: true, default: () => null }));
jest.mock("../components/AppToast", () => ({ __esModule: true, default: { show: jest.fn() } }));
jest.mock("../hooks/useSheetTransition", () => ({
  __esModule: true,
  default: () => ({ mounted: true, backdropOpacity: 1, sheetStyle: {}, onSheetLayout: () => {}, onOverlayLayout: () => {}, fit: (style) => style }),
}));
jest.mock("../hooks/useReduceMotion", () => ({ __esModule: true, default: () => false }));
jest.mock("../services/hapticsService", () => ({ triggerHaptic: jest.fn() }));
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({ theme: { accent: "#138DF0", primary: "#000", secondary: "#1c1c1e", border: "#333", text: { primary: "#fff", secondary: "#ccc", muted: "#888" } } }),
}));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "u1" } }) }));
jest.mock("../context/UserProfileContext", () => ({ useUserProfile: () => ({ displayName: "Test", username: "test", avatarIndex: 0, photoURL: null }) }));
const mockRefreshList = jest.fn(async () => {});
jest.mock("../context/ListStatusContext", () => ({ useListStatusContext: () => ({ refreshList: mockRefreshList }) }));
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({}));
jest.mock("../services/import/importStats", () => ({
  ...jest.requireActual("../services/import/importStats"),
  loadImportStats: jest.fn(),
}));
jest.mock("../services/import/importReset", () => ({ resetImportedData: jest.fn() }));
jest.mock("../services/import/importRunner", () => ({
  ...jest.requireActual("../services/import/importRunner"),
  runImportJob: jest.fn(),
}));

const React = require("react");
const { create, act } = require("react-test-renderer");
const ImportDataModal = require("../components/import/ImportDataModal").default;
const { getImportCopy } = require("../components/import/importCopy");
const { loadImportStats, mergeSourceStats, emptySourceStats } = require("../services/import/importStats");
const { resetImportedData } = require("../services/import/importReset");
const { runImportJob } = require("../services/import/importRunner");
const { ImportError } = require("../services/import/importErrors");
const Toast = require("../components/AppToast").default;

global.IS_REACT_ACT_ENVIRONMENT = true;
const copy = getImportCopy("tr");

const DIARY = `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
2024-01-02,Heat,1995,u,4.5,,,2024-01-01
2024-02-02,Dune,2021,u,4,,,2024-02-01`;

const textOf = (node) => [].concat(node.props.children).filter((child) => typeof child === "string" || typeof child === "number").join("");
const texts = (renderer) => renderer.root.findAllByType("Text").map(textOf).filter(Boolean);

function press(renderer, label) {
  const textNode = renderer.root.findAllByType("Text").find((node) => textOf(node) === label);
  if (!textNode) throw new Error(`"${label}" bulunamadı. Ekrandaki metinler: ${texts(renderer).join(" | ")}`);
  let node = textNode;
  while (node && !node.props.onPress) node = node.parent;
  if (!node) throw new Error(`"${label}" basılabilir değil`);
  return act(async () => {
    await node.props.onPress();
  });
}

const flush = () => act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 50));
});

async function renderModal(onClose = jest.fn()) {
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(ImportDataModal, { visible: true, onClose }));
  });
  await flush();
  return renderer;
}

async function pasteAndAnalyze(renderer) {
  const input = renderer.root.findByType("TextInput");
  await act(async () => input.props.onChangeText(DIARY));
  await press(renderer, copy.parseBtn);
  await flush();
}

beforeEach(() => {
  jest.clearAllMocks();
  loadImportStats.mockResolvedValue({ letterboxd: emptySourceStats(), imdb: emptySourceStats() });
});

test("yapıştır → içerik analizi → İçeri aktar → ilerleme; aktarım sürerken kapatma durdurma onayı açar", async () => {
  let finish;
  runImportJob.mockImplementation((job, { onEvent }) => new Promise((resolve) => {
    onEvent({ type: "stage", stage: "matching", total: 2, done: 0 });
    finish = () => resolve({ success: true, count: 2, ratingsCount: 2, unmatchedItems: [], posters: [], durationMs: 3000 });
  }));
  const onClose = jest.fn();
  const renderer = await renderModal(onClose);
  expect(texts(renderer)).toContain(copy.history.empty);

  await pasteAndAnalyze(renderer);
  expect(texts(renderer)).toContain(copy.analysis.title("Letterboxd"));
  expect(texts(renderer)).toContain(copy.analysis.ratingsTitle);

  await press(renderer, copy.analysis.importBtn(2));
  expect(runImportJob).toHaveBeenCalledTimes(1);
  const job = runImportJob.mock.calls[0][0];
  expect(job).toMatchObject({ uid: "u1", language: "tr-TR" });
  expect(job.sourceItems.map((item) => item.importSource)).toEqual(["letterboxd", "letterboxd"]);
  await flush();
  expect(texts(renderer)).toContain(copy.run.heroMatching);

  // Geri tuşu / dışarı dokunma aktarım sürerken sayfayı KAPATMAZ, onay açar.
  await act(async () => renderer.root.findByType("Modal").props.onRequestClose());
  expect(onClose).not.toHaveBeenCalled();
  expect(texts(renderer)).toContain(copy.run.stopTitle);
  await press(renderer, copy.run.stopCancel);
  expect(texts(renderer)).not.toContain(copy.run.stopTitle);

  await act(async () => finish());
  await flush();
  expect(texts(renderer)).toContain(copy.successTitle);
  expect(mockRefreshList).toHaveBeenCalledWith("all");
  expect(loadImportStats).toHaveBeenCalledTimes(2); // açılışta + başarıdan sonra
  await press(renderer, copy.done);
  expect(onClose).toHaveBeenCalled();
  act(() => renderer.unmount());
});

test("bağlantı koparsa kesinti ekranı; 'Kaldığı yerden devam et' aynı işi sürdürür", async () => {
  runImportJob
    .mockImplementationOnce(async () => {
      throw new ImportError("network");
    })
    .mockImplementationOnce(async () => ({ success: true, count: 2, unmatchedItems: [], posters: [] }));
  const renderer = await renderModal();
  await pasteAndAnalyze(renderer);
  await press(renderer, copy.analysis.importBtn(2));
  await flush();
  expect(texts(renderer)).toContain(copy.result.interruptedTitle);
  expect(texts(renderer)).toContain(copy.errors.network);

  await press(renderer, copy.result.resume);
  await flush();
  expect(runImportJob).toHaveBeenCalledTimes(2);
  expect(runImportJob.mock.calls[1][0]).toBe(runImportJob.mock.calls[0][0]);
  expect(texts(renderer)).toContain(copy.successTitle);
  act(() => renderer.unmount());
});

test("aktarım geçmişi birikimli görünür; sıfırlama onaydan sonra çalışır ve kart yenilenir", async () => {
  const letterboxd = mergeSourceStats(emptySourceStats(), { titles: 1204, ratings: 860 }, { at: "2026-10-29T10:00:00Z" });
  loadImportStats.mockResolvedValue({ letterboxd, imdb: emptySourceStats() });
  resetImportedData.mockImplementation(async (uid, source, { onProgress }) => {
    onProgress(1, 2);
    return { titles: 1204, watchEvents: 1300, ratings: 860, reviews: 0, listItems: 0, lists: 0, keptReviews: 0 };
  });
  const renderer = await renderModal();
  expect(texts(renderer)).toContain(copy.history.title);

  await press(renderer, copy.history.reset("Letterboxd"));
  expect(resetImportedData).not.toHaveBeenCalled(); // önce onay
  expect(texts(renderer)).toContain(copy.history.resetTitle("Letterboxd"));

  await press(renderer, copy.history.resetConfirm);
  await flush();
  expect(resetImportedData).toHaveBeenCalledWith("u1", "letterboxd", expect.any(Object));
  expect(mockRefreshList).toHaveBeenCalledWith("all");
  expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({
    type: "success",
    text1: copy.history.resetDone("Letterboxd"),
    text2: copy.history.resetDoneBody(2064),
  }));
  expect(loadImportStats).toHaveBeenCalledTimes(2);
  act(() => renderer.unmount());
});
