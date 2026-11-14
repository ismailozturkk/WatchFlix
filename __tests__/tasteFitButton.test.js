// TasteFitButton: boşta → yükleniyor → sonuç → ayrıntılar akışı (taklit RN, sahte zamanlayıcı).
const React = require("react");
const { act, create } = require("react-test-renderer");

jest.mock("react-native", () => {
  const React = require("react");
  const host = (name) => {
    const C = React.forwardRef((props, ref) => React.createElement(name, { ...props, ref }, props.children));
    C.displayName = name;
    return C;
  };
  class Value {
    constructor(v) {
      this.v = v;
      this.ls = {};
      this.n = 0;
    }
    setValue(v) {
      this.v = v;
      Object.values(this.ls).forEach((l) => l({ value: v }));
    }
    addListener(l) {
      this.n += 1;
      this.ls[this.n] = l;
      return this.n;
    }
    removeListener(id) {
      delete this.ls[id];
    }
    interpolate() {
      return this;
    }
  }
  const anim = (value, cfg) => ({
    start: (cb) => {
      if (value && cfg && typeof cfg.toValue === "number") value.setValue(cfg.toValue);
      if (cb) cb({ finished: true });
    },
    stop: () => {},
  });
  return {
    Animated: {
      Value,
      View: host("AnimatedView"),
      Text: host("AnimatedText"),
      createAnimatedComponent: () => host("AnimatedSvgEl"),
      timing: anim,
      spring: anim,
      delay: () => ({ start: (cb) => cb && cb({ finished: true }), stop: () => {} }),
      add: (a) => a,
      parallel: (list) => ({
        start: (cb) => {
          list.forEach((a) => a.start());
          if (cb) cb({ finished: true });
        },
        stop: () => {},
      }),
      loop: () => ({ start: () => {}, stop: () => {} }),
      sequence: () => ({ start: () => {}, stop: () => {} }),
    },
    Easing: { linear: 0, quad: 0, cubic: 0, out: () => 0, in: () => 0, inOut: () => 0 },
    LayoutAnimation: { configureNext: jest.fn(), Presets: { easeInEaseOut: {} } },
    Pressable: host("Pressable"),
    ScrollView: host("ScrollView"),
    StyleSheet: { create: (s) => s, hairlineWidth: 1, absoluteFill: {}, absoluteFillObject: {} },
    Text: host("Text"),
    View: host("View"),
  };
});
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("expo-image", () => ({ Image: "ExpoImage" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("react-native-svg", () => ({ __esModule: true, default: "Svg", Circle: "Circle" }));
jest.mock("../components/common/GlassTouchable", () => "GlassTouchable");
const mockHaptic = jest.fn();
jest.mock("../services/hapticsService", () => ({ haptic: (...a) => mockHaptic(...a) }));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text", AnimatedAppText: "AnimatedText" }));
jest.mock("@theme/colors", () => ({ alpha: (c) => c }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
jest.mock("../hooks/usePosterUri", () => () => (type, id, p) => `https://img/${type}/${id}${p}`);
const mockLists = { current: {} };
jest.mock("../context/ListStatusContext", () => ({ useListStatusContext: () => mockLists.current }));

const TasteFitButton = require("../components/detail/TasteFitButton").default;
const { MIN_LOADING_MS } = require("../components/detail/TasteFitButton");
const COPY = require("../utils/titleTasteFitCopy").getTitleTasteFitCopy("tr");
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

global.IS_REACT_ACT_ENVIRONMENT = true;

const theme = {
  accent: "#62C2A2",
  secondary: "#181B22",
  border: "#303641",
  colors: { blue: "#138DF0", purple: "#A77BFF", green: "#3CCB9A" },
  text: { primary: "#FFFFFF", secondary: "#D1D5DB", muted: "#89919F" },
};

const textOf = (tree) =>
  tree.root
    .findAll((n) => typeof n.type === "string" && (n.type === "Text" || n.type === "AnimatedText"))
    .map((n) => [].concat(n.props.children).join(""))
    .join(" | ");

function fanLibrary() {
  const watchedMoviesItems = [];
  const ratings = {};
  for (let i = 1; i <= 12; i += 1) {
    watchedMoviesItems.push({ id: i, type: "movie", name: `M${i}`, imagePath: `/p${i}.jpg`, genres: ["Bilim Kurgu"], minutes: 120 });
    ratings[`movie_${i}`] = 9;
  }
  return {
    loading: false,
    watchedTvLoaded: true,
    watchedMoviesItems,
    watchedTvMap: {},
    watchListItems: [],
    favoritesItems: [],
    activityIndex: { ratings },
  };
}

const details = {
  id: 999,
  genres: [{ id: 878, name: "Bilim Kurgu" }],
  runtime: 125,
  vote_average: 8.2,
  vote_count: 4000,
};

beforeEach(() => {
  mockHaptic.mockClear();
  jest.useFakeTimers();
  jest.spyOn(console, "error").mockImplementation((msg) => {
    if (String(msg).includes("react-test-renderer is deprecated")) return;
    throw new Error(String(msg));
  });
});
afterEach(() => {
  jest.useRealTimers();
  console.error.mockRestore();
});

test("düğmeye basınca yerinde yükleme, sonra yüzde + karar; ayrıntılar açılır", () => {
  mockLists.current = fanLibrary();
  let tree;
  act(() => {
    tree = create(<TasteFitButton theme={theme} type="movie" details={details} similar={[{ id: 1 }, { id: 2 }, { id: 50 }]} />);
  });
  const button = tree.root.findByType("GlassTouchable");
  expect(button.props.accessibilityLabel.startsWith(COPY.button.title)).toBe(true);

  act(() => button.props.onPress());
  expect(tree.root.findAll((n) => typeof n.type === "string" && n.props.accessibilityRole === "progressbar")).toHaveLength(1);
  expect(textOf(tree)).toMatch(/İzlediklerin taranıyor/);
  // Sayaçlar 0'dan başlar; kütüphane 12 izlenen + 12 puan.
  act(() => {
    jest.advanceTimersByTime(MIN_LOADING_MS - 200);
  });
  expect(textOf(tree)).toMatch(/12 \| 12 \| 0/);

  act(() => {
    jest.advanceTimersByTime(MIN_LOADING_MS + 50);
  });
  const resultRow = tree.root.find((n) => typeof n.type === "string" && n.type === "Pressable" && n.props.accessibilityState);
  expect(resultRow.props.accessibilityLabel).toMatch(
    new RegExp(`^${esc(COPY.title)}: %\\d+\\. (${esc(COPY.tiers.love)}|${esc(COPY.tiers.like)})$`),
  );
  expect(textOf(tree)).toMatch(/Ayrıntılar/);
  // Basış + patlama titreşimi (yüksek uyumda "match", değilse "success").
  expect(mockHaptic.mock.calls.map((c) => c[0])).toEqual(["press", expect.stringMatching(/^(match|success)$/)]);

  act(() => resultRow.props.onPress());
  const all = textOf(tree);
  expect(all).toMatch(/Tür eğilimi/);
  expect(all).toMatch(/Benzer yapımlar/);
  expect(all).toMatch(/Benzer 2 yapımı izledin, ortalama 9 verdin/);
  expect(all).toMatch(/İzlediğin benzerleri/);
  expect(tree.root.findAllByType("ExpoImage")).toHaveLength(2);

  // "Yeniden" yeniden yükleme sahnesine döner.
  const again = tree.root.find((n) => typeof n.type === "string" && n.type === "Pressable" && !n.props.accessibilityState && n.props.onPress);
  act(() => again.props.onPress());
  expect(tree.root.findAll((n) => typeof n.type === "string" && n.props.accessibilityRole === "progressbar")).toHaveLength(1);
  act(() => tree.unmount());
});

test("liste verisi inmeden sonuç gösterilmez; inince hesaplanır", () => {
  mockLists.current = { ...fanLibrary(), loading: true };
  let tree;
  const el = () => <TasteFitButton theme={theme} type="movie" details={details} similar={[]} />;
  act(() => {
    tree = create(el());
  });
  act(() => tree.root.findByType("GlassTouchable").props.onPress());
  act(() => {
    jest.advanceTimersByTime(MIN_LOADING_MS + 500);
  });
  expect(tree.root.findAll((n) => typeof n.type === "string" && n.props.accessibilityRole === "progressbar")).toHaveLength(1);
  mockLists.current = fanLibrary();
  act(() => tree.update(el()));
  expect(tree.root.findAll((n) => typeof n.type === "string" && n.props.accessibilityRole === "progressbar")).toHaveLength(0);
  expect(textOf(tree)).toMatch(/%\d+/);
  act(() => tree.unmount());
});

test("az izlenen varsa yüzde yerine açıklama", () => {
  mockLists.current = { ...fanLibrary(), watchedMoviesItems: fanLibrary().watchedMoviesItems.slice(0, 2) };
  let tree;
  act(() => {
    tree = create(<TasteFitButton theme={theme} type="movie" details={details} similar={[]} />);
  });
  act(() => tree.root.findByType("GlassTouchable").props.onPress());
  act(() => {
    jest.advanceTimersByTime(MIN_LOADING_MS + 50);
  });
  expect(textOf(tree)).toMatch(/en az 5 izlediğin/);
  expect(textOf(tree)).not.toMatch(/%\d+/);
  act(() => tree.unmount());
});
