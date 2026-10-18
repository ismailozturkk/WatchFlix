// Dizi "Bölüm Puan Grafiği" ızgarası (components/tv/TvGraphGrid.js) — performans sözleşmesi.
//
// Eskiden ızgara her dokunuşta yüzlerce hücreyi yeniden çiziyordu ve hepsini ilk karede
// mount ediyordu. Burada: (1) görüntü alanı ölçülmeden liste kurulmaz, (2) ilk karede yalnız
// ekranı dolduran satır istenir, (3) bölüm seçimi yalnız ilgili hücreleri yeniden çizer,
// (4) kip değişince liste sıfırdan kurulur.
import React from "react";
import { act, create } from "react-test-renderer";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("react-native", () => {
  const React = require("react");
  return {
    StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
    Text: "Text",
    View: "View",
    Pressable: "Pressable",
    ScrollView: "ScrollView",
    // Sanallaştırmayı taklit ETMEZ: her satırı renderItem ile çizer. Bellek-atlama
    // kararını gerçek bileşenin `memo`su verir; test onu sayar.
    FlatList: ({ data, renderItem, keyExtractor, ListFooterComponent, ...rest }) =>
      React.createElement(
        "FlatList",
        { data, ...rest },
        data.map((item, index) =>
          React.createElement(React.Fragment, { key: keyExtractor(item, index) }, renderItem({ item, index })),
        ),
        ListFooterComponent,
      ),
  };
});
// Derleme eklentisi (scripts/babel-transform-app-text.js) `Text`'i AppText'e çevirir.
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
// Hücre her render'ında renk katmanını çözer: çağrı sayısı = hücre render sayısı.
jest.mock("../utils/ratingColors", () => ({
  getRatingColors: jest.fn(() => ({ bg: "#0f0", text: "#000" })),
}));

const { getRatingColors } = require("../utils/ratingColors");
const { TV_GRAPH_GRID_SIZES } = require("../utils/tvGraphGrid");
const TvGraphGrid = require("../components/tv/TvGraphGrid").default;

const LABELS = {
  season: "Sezon",
  episode: "Bölüm",
  rating: "Puan",
  seasonLetter: "S",
  episodeLetter: "B",
};

const makeSeasons = (seasonCount, episodeCount) =>
  Array.from({ length: seasonCount }, (_, s) => ({
    season_number: s + 1,
    episodes: Array.from({ length: episodeCount }, (_, e) => ({
      episode_number: e + 1,
      vote_average: 7 + ((s + e) % 3),
    })),
  }));

const onPress = jest.fn();

function baseProps(overrides = {}) {
  return {
    seasons: makeSeasons(3, 6),
    grid: TV_GRAPH_GRID_SIZES.default,
    gridKey: "default",
    selected: null,
    onPress,
    borderColor: "#111",
    headerColor: "#999",
    labels: LABELS,
    ...overrides,
  };
}

async function mount(props) {
  let tree;
  await act(async () => {
    tree = create(React.createElement(TvGraphGrid, props));
  });
  return tree;
}

async function measure(tree, height = 600) {
  const viewport = tree.root.findAllByType("View").find((n) => typeof n.props.onLayout === "function");
  await act(async () => {
    viewport.props.onLayout({ nativeEvent: { layout: { height } } });
  });
}

async function update(tree, props) {
  await act(async () => {
    tree.update(React.createElement(TvGraphGrid, props));
  });
}

beforeEach(() => {
  getRatingColors.mockClear();
  onPress.mockClear();
});

test("does not build the list before the viewport is measured", async () => {
  const tree = await mount(baseProps());
  expect(tree.root.findAllByType("FlatList")).toHaveLength(0);
  expect(getRatingColors).not.toHaveBeenCalled();
  await measure(tree);
  expect(tree.root.findAllByType("FlatList")).toHaveLength(1);
});

test("renders one cell per episode with a localized accessibility label", async () => {
  const tree = await mount(baseProps());
  await measure(tree);
  const cells = tree.root.findAllByType("Pressable");
  expect(cells).toHaveLength(18);
  expect(cells[0].props.accessibilityLabel).toBe("Sezon 1, Bölüm 1, Puan 7.0");
});

test("a selection re-renders only the affected cells, not the whole grid", async () => {
  const props = baseProps();
  const tree = await mount(props);
  await measure(tree);
  expect(getRatingColors).toHaveBeenCalledTimes(18);

  getRatingColors.mockClear();
  await update(tree, { ...props, selected: { season: 2, index: 3 } });
  expect(getRatingColors).toHaveBeenCalledTimes(1);
  const selectedCell = tree.root
    .findAllByType("Pressable")
    .find((n) => n.props.accessibilityState.selected);
  expect(selectedCell.props.accessibilityLabel).toContain("Sezon 2, Bölüm 4");

  // Seçimi başka satıra taşımak: eski + yeni hücre, başka hiçbir şey.
  getRatingColors.mockClear();
  await update(tree, { ...props, selected: { season: 1, index: 0 } });
  expect(getRatingColors).toHaveBeenCalledTimes(2);

  getRatingColors.mockClear();
  await update(tree, { ...props, selected: null });
  expect(getRatingColors).toHaveBeenCalledTimes(1);
});

test("tapping a cell reports its season and episode index", async () => {
  const tree = await mount(baseProps());
  await measure(tree);
  // Satır başına 3 sezon: 7. hücre = 3. satır (bölüm indeksi 2), 2. sütun (sezon 2).
  const cell = tree.root.findAllByType("Pressable")[7];
  act(() => cell.props.onPress());
  expect(onPress).toHaveBeenCalledWith(2, 2);
});

test("the heatmap pins the season header outside the scrolling list", async () => {
  const props = baseProps({ grid: TV_GRAPH_GRID_SIZES.heatmap, gridKey: "heatmap" });
  const tree = await mount(props);
  await measure(tree);
  const listTexts = tree.root
    .findByType("FlatList")
    .findAllByType("Text")
    .map((n) => n.props.children.join(""));
  // Satır başlıkları (B1…B6) listede; sezon başlıkları (S1…S3) listenin DIŞINDA.
  expect(listTexts).toEqual(["B1", "B2", "B3", "B4", "B5", "B6"]);
  const allTexts = tree.root.findAllByType("Text").map((n) => n.props.children.join(""));
  expect(allTexts).toEqual(expect.arrayContaining(["S1", "S2", "S3"]));
  // Isı haritasında hücrenin içinde yazı yok.
  const cell = tree.root.findAllByType("Pressable")[0];
  expect(cell.findAllByType("Text")).toHaveLength(0);
});

test("asks the list for only the rows that fill the screen, with fixed-height layout", async () => {
  const props = baseProps({ seasons: makeSeasons(2, 60) });
  const tree = await mount(props);
  await measure(tree, 300);
  const small = tree.root.findByType("FlatList").props;
  const rowHeight = TV_GRAPH_GRID_SIZES.default.cell + TV_GRAPH_GRID_SIZES.default.margin * 2;
  expect(small.data).toHaveLength(60);
  expect(small.initialNumToRender).toBeLessThan(20);
  expect(small.getItemLayout(small.data, 5)).toEqual({ length: rowHeight, offset: rowHeight * 5, index: 5 });

  await measure(tree, 900);
  expect(tree.root.findByType("FlatList").props.initialNumToRender).toBeGreaterThan(small.initialNumToRender);
});

test("switching the grid mode rebuilds the list with the new row height", async () => {
  const props = baseProps({ seasons: makeSeasons(2, 30) });
  const tree = await mount(props);
  await measure(tree);
  const before = tree.root.findByType("FlatList").props.getItemLayout(null, 1).length;
  await update(tree, { ...props, grid: TV_GRAPH_GRID_SIZES.compact, gridKey: "compact" });
  const after = tree.root.findByType("FlatList").props.getItemLayout(null, 1).length;
  expect(after).toBeLessThan(before);
});

test("short seasons leave empty cells instead of crashing", async () => {
  const seasons = makeSeasons(2, 4);
  seasons[1].episodes = seasons[1].episodes.slice(0, 2);
  const tree = await mount(baseProps({ seasons }));
  await measure(tree);
  expect(tree.root.findAllByType("Pressable")).toHaveLength(6);
});

test("an empty season list renders nothing", async () => {
  const tree = await mount(baseProps({ seasons: [] }));
  await measure(tree);
  expect(tree.root.findAllByType("FlatList")).toHaveLength(0);
});
