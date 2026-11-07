// __tests__/tvOnAirRail.test.js
//
// (Dosyanın sonunda "Yaklaşan Diziler" rafının bağlantısı da var: aynı taklit kümesi.)
//
// "Yayında" rafı (screens/tv/TvShowsOnTheAir.js): eski "Bugün Yayında" + "Bu Hafta Yayında" rafları tek
// rafta, çiple seçilir. Çip doğru listeyi çizer, YALNIZ seçili ucun bölümünü etkinleştirir ve "Tümü"
// düğmesi seçili ucun bölümüne gider. Bağlam ve yaprak bileşenler taklit; raf GERÇEK.

import React from "react";
import { act, create } from "react-test-renderer";

let mockCtx;

jest.mock("react-native", () => ({
  StyleSheet: { create: (styles) => styles },
  Dimensions: { get: () => ({ width: 400, height: 800 }) },
  View: "View",
  TouchableOpacity: "TouchableOpacity",
  Animated: {
    Value: function Value() {},
    timing: () => ({ start: () => {} }),
    View: "AnimatedView",
  },
}));
jest.mock("../components/PosterImage", () => ({ __esModule: true, default: "PosterImage" }));
jest.mock("../components/ListBadges", () => ({ __esModule: true, default: "ListBadges" }));
jest.mock("../components/PosterInfoBadges", () => ({
  RatingBadge: "RatingBadge",
  ReleaseDateBadge: "ReleaseDateBadge",
  POSTER_BADGE_POS: {},
}));
jest.mock("../components/Skeleton", () => ({ RailSkeleton: "RailSkeleton" }));
jest.mock("../components/PaginatedRail", () => ({ __esModule: true, default: "PaginatedRail" }));
jest.mock("../components/home/SectionHeader", () => {
  const React = require("react");
  return { __esModule: true, default: (props) => React.createElement("SectionHeader", props, props.children) };
});
jest.mock("../components/home/SectionChips", () => {
  const React = require("react");
  return {
    SectionChipRail: ({ data, renderChip }) =>
      React.createElement(
        "SectionChipRail",
        null,
        data.map((item) => React.createElement(React.Fragment, { key: item }, renderChip(item))),
      ),
  };
});
jest.mock("../components/home/DiscoverFilterChip", () => ({ __esModule: true, default: "DiscoverFilterChip" }));
jest.mock("../components/home/TvUpcomingRangeChips", () => ({ __esModule: true, default: "TvUpcomingRangeChips" }));
jest.mock("../hooks/useRailPosterStyle", () => ({ __esModule: true, default: () => ({}) }));
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: { shadow: "#000" } }) }));
jest.mock("../context/MediaQuickActionsContext", () => ({
  useMediaQuickActions: () => ({ openQuickActions: () => {} }),
}));
jest.mock("../context/AppSettingsContext", () => ({
  useImageQualitySettings: () => ({ getTmdbUrl: () => "" }),
  useListLayoutSettings: () => ({ posterBadges: {} }),
}));
jest.mock("../context/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      tvShowScreens: {
        onAir: "Yayında",
        airingToday: "Bugün Yayında",
        onTheAir: "Bu Hafta Yayında",
        airingRangeToday: "Bugün",
        airingRangeWeek: "Bu hafta",
        upcoming: "Yaklaşan Diziler",
      },
    },
  }),
}));
jest.mock("../context/TvShowContex", () => ({ useTvShow: () => mockCtx }));

const TvShowsOnTheAir = require("../screens/tv/TvShowsOnTheAir").default;
const TvShowsUpcoming = require("../screens/tv/TvShowsUpcoming").default;

const show = (id) => ({ id, poster_path: `/p${id}.jpg` });

function makeCtx(range) {
  return {
    selectedAiringRange: range,
    setSelectedAiringRange: jest.fn(),
    activateTvSection: jest.fn(),
    moviesAiringToday: [show(1)],
    pageAiringToday: 1,
    totalPagesAiringToday: 3,
    loadingAiringToday: false,
    loadingMoreAiringToday: false,
    loadMoreAiringToday: jest.fn(),
    moviesOnTheAir: [show(2), show(3)],
    pageOnTheAir: 2,
    totalPagesOnTheAir: 2,
    loadingOnTheAir: false,
    loadingMoreOnTheAir: false,
    loadMoreOnTheAir: jest.fn(),
  };
}

function mount(range) {
  mockCtx = makeCtx(range);
  const navigation = { navigate: jest.fn(), push: jest.fn() };
  let tree;
  act(() => {
    tree = create(<TvShowsOnTheAir navigation={navigation} />);
  });
  return { tree, navigation };
}

const chips = (tree) => tree.root.findAllByType("DiscoverFilterChip");

describe("Yayında rafı — Bugün / Bu hafta tek rafta", () => {
  test("varsayılan Bugün: tek başlık, iki çip, bugünün listesi, yalnız airingToday etkin", () => {
    const { tree } = mount("today");
    const headers = tree.root.findAllByType("SectionHeader");
    expect(headers).toHaveLength(1);
    expect(headers[0].props.title).toBe("Yayında");
    expect(chips(tree).map((c) => [c.props.label, c.props.selected])).toEqual([
      ["Bugün", true],
      ["Bu hafta", false],
    ]);
    const rail = tree.root.findByType("PaginatedRail");
    expect(rail.props.data.map((item) => item.id)).toEqual([1]);
    expect(rail.props.hasMore).toBe(true);
    expect(rail.props.onLoadMore).toBe(mockCtx.loadMoreAiringToday);
    expect(mockCtx.activateTvSection.mock.calls).toEqual([["airingToday"]]);
  });

  test("Bu hafta çipi seçimi bağlama yazar", () => {
    const { tree } = mount("today");
    act(() => chips(tree)[1].props.onPress());
    expect(mockCtx.setSelectedAiringRange).toHaveBeenCalledWith("week");
  });

  test("Bu hafta seçiliyken haftanın listesi ve onTheAir bölümü; Tümü haftalık uca gider", () => {
    const { tree, navigation } = mount("week");
    const rail = tree.root.findByType("PaginatedRail");
    expect(rail.props.data.map((item) => item.id)).toEqual([2, 3]);
    expect(rail.props.hasMore).toBe(false);
    expect(mockCtx.activateTvSection.mock.calls).toEqual([["onTheAir"]]);
    act(() => tree.root.findByType("SectionHeader").props.onPressAction());
    expect(navigation.navigate).toHaveBeenCalledWith("SeeAllScreen", {
      mediaType: "tv",
      section: "onTheAir",
      title: "Bu Hafta Yayında",
    });
  });

  test("Bugün seçiliyken Tümü bugünün ucuna gider", () => {
    const { tree, navigation } = mount("today");
    act(() => tree.root.findByType("SectionHeader").props.onPressAction());
    expect(navigation.navigate).toHaveBeenCalledWith("SeeAllScreen", {
      mediaType: "tv",
      section: "airingToday",
      title: "Bugün Yayında",
    });
  });

  test("seçili ucun yüklemesi sürerken iskelet çizilir, başlık ve çipler yerinde kalır", () => {
    mockCtx = { ...makeCtx("week"), loadingOnTheAir: true };
    let tree;
    act(() => {
      tree = create(<TvShowsOnTheAir navigation={{ navigate: jest.fn() }} />);
    });
    expect(tree.root.findAllByType("RailSkeleton")).toHaveLength(1);
    expect(tree.root.findAllByType("PaginatedRail")).toHaveLength(0);
    expect(chips(tree)).toHaveLength(2);
  });
});

describe("Yaklaşan Diziler rafı", () => {
  function mountUpcoming(overrides = {}) {
    mockCtx = {
      selectedUpcomingRange: "3m",
      setSelectedUpcomingRange: jest.fn(),
      activateTvSection: jest.fn(),
      seriesUpcoming: [show(7), { id: 8, poster_path: null }],
      pageUpcoming: 1,
      totalPagesUpcoming: 4,
      loadingUpcoming: false,
      loadingMoreUpcoming: false,
      loadMoreUpcoming: jest.fn(),
      ...overrides,
    };
    const navigation = { navigate: jest.fn(), push: jest.fn() };
    let tree;
    act(() => {
      tree = create(<TvShowsUpcoming navigation={navigation} />);
    });
    return { tree, navigation };
  }

  test("başlık + aralık çipleri bağlama bağlı; upcoming bölümü etkin; Tümü aynı bölüme gider", () => {
    const { tree, navigation } = mountUpcoming();
    const header = tree.root.findByType("SectionHeader");
    expect(header.props).toMatchObject({ section: "upcoming", mediaType: "tv", title: "Yaklaşan Diziler" });
    const chipsRow = tree.root.findByType("TvUpcomingRangeChips");
    expect(chipsRow.props.range).toBe("3m");
    expect(chipsRow.props.onSelectRange).toBe(mockCtx.setSelectedUpcomingRange);
    expect(mockCtx.activateTvSection.mock.calls).toEqual([["upcoming"]]);
    const rail = tree.root.findByType("PaginatedRail");
    expect(rail.props.hasMore).toBe(true);
    expect(rail.props.onLoadMore).toBe(mockCtx.loadMoreUpcoming);
    // Afişsiz kayıt kart çizmez.
    expect(rail.props.renderItem({ item: { id: 8, poster_path: null } })).toBeNull();
    act(() => header.props.onPressAction());
    expect(navigation.navigate).toHaveBeenCalledWith("SeeAllScreen", {
      mediaType: "tv",
      section: "upcoming",
      title: "Yaklaşan Diziler",
    });
  });

  test("yüklenirken iskelet; çip satırı yerinde", () => {
    const { tree } = mountUpcoming({ loadingUpcoming: true });
    expect(tree.root.findAllByType("RailSkeleton")).toHaveLength(1);
    expect(tree.root.findAllByType("TvUpcomingRangeChips")).toHaveLength(1);
  });
});
