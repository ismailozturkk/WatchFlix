const React = require("react");
const { act, create } = require("react-test-renderer");

const makeAnimatedValue = (initial) => ({
  _value: initial,
  setValue(v) {
    this._value = v;
  },
  stopAnimation: jest.fn(),
  interpolate: () => 1,
});

jest.mock("react-native", () => ({
  Animated: {
    Value: function AnimatedValue(v) {
      return makeAnimatedValue(v);
    },
    View: "AnimatedView",
    timing: () => ({ start: (cb) => cb && cb({ finished: true }), stop: jest.fn() }),
    spring: () => ({ start: (cb) => cb && cb({ finished: true }), stop: jest.fn() }),
    parallel: () => ({ start: (cb) => cb && cb({ finished: true }), stop: jest.fn() }),
  },
  Dimensions: { get: () => ({ width: 390, height: 844 }) },
  Easing: {
    out: (fn) => fn,
    in: (fn) => fn,
    cubic: (t) => t,
    ease: (t) => t,
  },
  Modal: "Modal",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  StyleSheet: { create: (styles) => styles, absoluteFill: {}, hairlineWidth: 1 },
  Text: "Text",
  TouchableOpacity: "TouchableOpacity",
  View: "View",
}));

jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("@expo/vector-icons/MaterialCommunityIcons", () => "MaterialCommunityIcons");
jest.mock("lottie-react-native", () => "LottieView");
jest.mock("@services/hapticsService", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));
jest.mock("@components/AppToast", () => ({ show: jest.fn() }));
jest.mock("@components/toast/ModalToastHost", () => "ModalToastHost");
jest.mock("@components/typography/AppText", () => ({
  AppText: "Text",
  AnimatedAppText: "AnimatedText",
  AppTextInput: "TextInput",
}));
jest.mock("../components/common/GlassTouchable", () => "GlassTouchable");
jest.mock("../components/common/GlassCloseButton", () => "GlassCloseButton");
jest.mock("../components/common/ModalBlurBackdrop", () => "ModalBlurBackdrop");
jest.mock("../components/common/ListActionIcon", () => "ListActionIcon");
jest.mock("../components/SharedListsSection", () => "SharedListsSection");

const mockTheme = {
  primary: "#0E1015",
  secondary: "#181B22",
  accent: "#62C2A2",
  border: "#303641",
  shadow: "#000000",
  colors: {
    blue: "#3B82F6",
    green: "#22C55E",
    orange: "#F59E0B",
    red: "#EF4444",
  },
  text: {
    primary: "#FFFFFF",
    secondary: "#D1D5DB",
    muted: "#89919F",
  },
};

let mockListContext = {
  otherListKeys: [],
  allListKeys: [],
};
let mockSharedContext = {
  sharedLists: [],
  sharedItemsByList: {},
};

jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({ theme: mockTheme }),
}));
jest.mock("../context/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      watch: "İzle",
      watched: "İzlendi",
      watching: "İzleniyor",
      remind: "Hatırlat",
      cancel: "İptal",
    },
    language: "tr-TR",
  }),
}));
jest.mock("../context/ListStatusContext", () => ({
  useListStatusContext: () => mockListContext,
}));
jest.mock("../context/SharedListsContext", () => ({
  useSharedLists: () => mockSharedContext,
}));
jest.mock("../context/AppSettingsContext", () => ({
  useHapticsSettings: () => ({ hapticsEnabled: false }),
}));

const Toast = require("@components/AppToast");
const { View } = require("react-native");
const i18n = require("../translations").default;
const DetailListActionTile = require("../components/detail/DetailListActionTile").default;
const ListView = require("../components/ListView").default;
const ListViewTv = require("../components/ListViewTv").default;
const { WATCH_STATE } = require("../utils/watchState");

global.IS_REACT_ACT_ENVIRONMENT = true;

describe("DetailListActionTile & tek satır liste eylemleri", () => {
  let errorSpy;

  beforeAll(async () => {
    await i18n.changeLanguage("tr");
  });

  beforeEach(() => {
    jest.useFakeTimers();
    Toast.show.mockClear();
    mockListContext = { otherListKeys: [], allListKeys: [] };
    mockSharedContext = { sharedLists: [], sharedItemsByList: {} };
    const origError = console.error;
    errorSpy = jest.spyOn(console, "error").mockImplementation((msg, ...rest) => {
      if (String(msg).includes("react-test-renderer is deprecated")) return;
      origError(msg, ...rest);
    });
  });

  afterEach(() => {
    errorSpy.mockRestore();
    jest.useRealTimers();
  });

  test("DetailListActionTile aktif, kilitli, compact ve alt sayfa (sheet) durumlarını doğru çizer", () => {
    const onPress = jest.fn();
    let tree;

    act(() => {
      tree = create(
        <DetailListActionTile
          label="İzleme Listesi"
          color={mockTheme.colors.blue}
          theme={mockTheme}
          onPress={onPress}
        >
          <View />
        </DetailListActionTile>,
      );
    });

    let btn = tree.root.findByType("GlassTouchable");
    expect(btn.props.glass).toBe(true);
    expect(btn.props.accessibilityState).toEqual({ selected: false, disabled: false });
    expect(tree.root.findByType("Ionicons").props.name).toBe("add");

    // Compact modda (MediaQuickActionsSheet) yerel cam kapatılır
    act(() => {
      tree.update(
        <DetailListActionTile
          label="Listede"
          color={mockTheme.colors.blue}
          theme={mockTheme}
          active
          compact
          onPress={onPress}
        >
          <View />
        </DetailListActionTile>,
      );
    });
    btn = tree.root.findByType("GlassTouchable");
    expect(btn.props.glass).toBe(false);
    expect(btn.props.accessibilityState).toEqual({ selected: true, disabled: false });
    expect(tree.root.findByType("Ionicons").props.name).toBe("checkmark");

    // Kilitli durumda kilit simgesi gösterilir
    act(() => {
      tree.update(
        <DetailListActionTile
          label="İzle"
          color={mockTheme.text.muted}
          theme={mockTheme}
          locked
          onPress={onPress}
        >
          <View />
        </DetailListActionTile>,
      );
    });
    expect(tree.root.findByType("Ionicons").props.name).toBe("lock-closed");
    expect(tree.root.findByType("GlassTouchable").props.accessibilityState).toEqual({
      selected: false,
      disabled: true,
    });

    // Sheet modunda rozet yokken köşe rozeti çizilmez, rozet varken sayaç hapı çizilir
    act(() => {
      tree.update(
        <DetailListActionTile
          kind="sheet"
          label="Diğerleri"
          color={mockTheme.accent}
          theme={mockTheme}
          onPress={onPress}
        >
          <View />
        </DetailListActionTile>,
      );
    });
    expect(tree.root.findAllByType("Ionicons")).toHaveLength(0);
    expect(tree.root.findAllByType("Text")).toHaveLength(1);

    act(() => {
      tree.update(
        <DetailListActionTile
          kind="sheet"
          label="Diğerleri"
          color={mockTheme.colors.orange}
          theme={mockTheme}
          active
          badge={3}
          onPress={onPress}
        >
          <View />
        </DetailListActionTile>,
      );
    });
    expect(tree.root.findAllByType("Ionicons")).toHaveLength(0);
    expect(tree.root.findByType("GlassTouchable").props.accessibilityLabel).toBe(
      "Diğerleri (3)",
    );

    act(() => tree.unmount());
  });

  test("ListView tek yatay satırda özel ve ortak liste sayılarını birleştirir ve kilitli durumu korur", () => {
    mockListContext = {
      otherListKeys: ["Kült Filmler", "Bilim Kurgu"],
      allListKeys: ["watchList", "watchedMovies", "favorites", "Kült Filmler", "Bilim Kurgu"],
    };
    mockSharedContext = {
      sharedLists: [{ id: "shared-1", name: "Cuma Gecesi" }],
      sharedItemsByList: {
        "shared-1": [{ key: "movie_550", id: 550, type: "movie" }],
      },
    };

    const updateList = jest.fn();
    let tree;
    act(() => {
      tree = create(
        <ListView
          type="movie"
          navigation={{ navigate: jest.fn() }}
          updateList={updateList}
          updateWatchedList={jest.fn()}
          openWatchedHistory={jest.fn()}
          addReminder={jest.fn()}
          watchLocked
          listStates={{
            watchList: false,
            watchedMovies: false,
            favorites: true,
            "Kült Filmler": true,
            "Bilim Kurgu": false,
          }}
          sharedItem={{ id: 550, type: "movie", name: "Fight Club" }}
        />,
      );
    });

    const tiles = tree.root.findAllByType(DetailListActionTile);
    expect(tiles).toHaveLength(4);
    // Dört hücre de AYNI yatay satırın doğrudan çocukları (2×2 ızgara değil)
    const row = tiles[0].parent;
    expect(tiles.every((tile) => tile.parent === row)).toBe(true);
    expect(row.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ flexDirection: "row" })]),
    );
    expect(tiles.map((t) => t.props.label)).toEqual([
      "İzle",
      "İzleme Listesi",
      "Favorim",
      "Diğerleri",
    ]);

    // 1 özel liste ("Kült Filmler") + 1 ortak liste ("shared-1") = 2 seçili rozet
    expect(tiles[3].props.badge).toBe(2);
    expect(tiles[3].props.active).toBe(true);
    expect(tiles[0].props.locked).toBe(true);

    // Kilitli İzle düğmesine basılınca uyarı toast'u çıkar
    act(() => {
      tiles[0].props.onPress();
    });
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ type: "warning" }),
    );

    // Diğer Listeler modalı açıldığında başlık alt yazısı "3 liste · 2 seçili" gösterir
    act(() => {
      tiles[3].props.onPress();
    });
    const modal = tree.root.findByType("Modal");
    expect(modal.props.visible).toBe(true);
    const subtitleTexts = modal
      .findAllByType("Text")
      .map((node) => (Array.isArray(node.props.children) ? node.props.children.join("") : String(node.props.children)));
    expect(subtitleTexts).toContain("3 liste · 2 seçili");

    act(() => tree.unmount());
  });

  test("ListViewTv kısmen izlenen dizide play rozeti çizer ve watchedOverride (Reminder) dokunuşunu tüm hücreye yayar", () => {
    const onToggleReminder = jest.fn();
    function MockReminder({ renderTrigger }) {
      return renderTrigger({ isReminderSet: true, onPress: onToggleReminder });
    }

    let tree;
    act(() => {
      tree = create(
        <ListViewTv
          type="tv"
          navigation={{ navigate: jest.fn() }}
          updateList={jest.fn()}
          showWatchState={WATCH_STATE.PARTIAL}
          onMarkWatched={jest.fn()}
          onUnmarkWatched={jest.fn()}
          listStates={{ watchList: true, favorites: false }}
        />,
      );
    });

    let tiles = tree.root.findAllByType(DetailListActionTile);
    expect(tiles).toHaveLength(4);
    expect(tiles.every((tile) => tile.parent === tiles[0].parent)).toBe(true);
    expect(tiles[0].props.label).toBe("İzleniyor");
    expect(tiles[0].props.activeIcon).toBe("play");
    expect(tiles[1].props.label).toBe("Listede");

    // Yayınlanmamış dizide watchedOverride (Reminder) tüm hücreyi tıklanabilir ve aktif yapar
    act(() => {
      tree.update(
        <ListViewTv
          type="tv"
          navigation={{ navigate: jest.fn() }}
          updateList={jest.fn()}
          showWatchState={WATCH_STATE.UNAIRED}
          watchedOverride={<MockReminder />}
          listStates={{ watchList: false, favorites: false }}
        />,
      );
    });

    tiles = tree.root.findAllByType(DetailListActionTile);
    expect(tiles[0].props.label).toBe("Hatırlat");
    expect(tiles[0].props.active).toBe(true);

    act(() => {
      tiles[0].props.onPress();
      jest.advanceTimersByTime(20);
    });
    expect(onToggleReminder).toHaveBeenCalledTimes(1);

    act(() => tree.unmount());
  });
});
