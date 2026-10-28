const fs = require("fs");
const path = require("path");
const React = require("react");
const { act, create } = require("react-test-renderer");

jest.mock("react-native", () => ({
  Animated: { View: "AnimatedView" },
  Image: "Image",
  Linking: { openURL: jest.fn(() => Promise.resolve()) },
  ScrollView: "ScrollView",
  StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
  Text: "Text",
  View: "View",
}));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("../components/common/GlassTouchable", () => "GlassTouchable");
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));

const {
  DetailActionCluster,
  DetailFactsStrip,
  DetailJournalPanel,
} = require("../components/detail/DetailContentSections");

global.IS_REACT_ACT_ENVIRONMENT = true;

const theme = {
  accent: "#62C2A2",
  secondary: "#181B22",
  border: "#303641",
  colors: { blue: "#138DF0", purple: "#A77BFF", green: "#3CCB9A" },
  text: { primary: "#FFFFFF", secondary: "#D1D5DB", muted: "#89919F" },
};

test("ana inceleme eylemini iki hızlı eylemden ayrı bir hiyerarşide sunar", () => {
  const onReview = jest.fn();
  const onAi = jest.fn();
  const onSend = jest.fn();
  let tree;
  act(() => {
    tree = create(
      <DetailActionCluster
        theme={theme}
        review={{ title: "İnceleme", subtitle: "Hub'da paylaş", icon: "create-outline", onPress: onReview }}
        ai={{ title: "Yapay Zeka", subtitle: "Bilgi / Öneri", icon: "sparkles-outline", onPress: onAi }}
        send={{ title: "Gönder", subtitle: "Sohbete gönder", icon: "paper-plane-outline", onPress: onSend }}
      />,
    );
  });

  const actions = tree.root.findAllByType("GlassTouchable");
  expect(actions).toHaveLength(3);
  expect(actions.map((item) => item.props.accessibilityLabel)).toEqual([
    "İnceleme. Hub'da paylaş",
    "Yapay Zeka. Bilgi / Öneri",
    "Gönder. Sohbete gönder",
  ]);
  actions.forEach((item) => item.props.onPress());
  expect(onReview).toHaveBeenCalledTimes(1);
  expect(onAi).toHaveBeenCalledTimes(1);
  expect(onSend).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});

test("bilgi şeridi ile yorum ve not alanı veriyi ve eylemleri korur", () => {
  const onComment = jest.fn();
  const onNote = jest.fn();
  let factsTree;
  let journalTree;
  act(() => {
    factsTree = create(
      <DetailFactsStrip
        theme={theme}
        facts={[
          { key: "season", icon: "layers-outline", value: 3, label: "Sezon" },
          { key: "episode", icon: "play-circle-outline", value: 24, trailing: " / 8", label: "Bölüm" },
        ]}
      />,
    );
    journalTree = create(
      <DetailJournalPanel
        theme={theme}
        comment={{ title: "Yorumlar", subtitle: "Tüm yorumları gör", icon: "chatbubble-ellipses-outline", onPress: onComment }}
        note={{ title: "Notum", subtitle: "Bir not ekle", icon: "document-text-outline", onPress: onNote }}
      />,
    );
  });

  expect(factsTree.root.findAllByType("Ionicons")).toHaveLength(2);
  const rows = journalTree.root.findAllByType("GlassTouchable");
  expect(rows.map((item) => item.props.accessibilityLabel)).toEqual([
    "Yorumlar. Tüm yorumları gör",
    "Notum. Bir not ekle",
  ]);
  rows[0].props.onPress();
  rows[1].props.onPress();
  expect(onComment).toHaveBeenCalledTimes(1);
  expect(onNote).toHaveBeenCalledTimes(1);
  act(() => {
    factsTree.unmount();
    journalTree.unmount();
  });
});

test("film ve dizi ekranları ortak yeni bölümleri kullanır; dizi ilerleme çubuğu yerinde kalır", () => {
  const movie = fs.readFileSync(path.join(__dirname, "..", "screens", "movie", "MovieDetail.js"), "utf8");
  const tv = fs.readFileSync(path.join(__dirname, "..", "screens", "tv", "TvShowsDetails.js"), "utf8");

  for (const source of [movie, tv]) {
    expect(source).toMatch(/<DetailActionCluster\b/);
    expect(source).toMatch(/<DetailFactsStrip\b/);
    expect(source).toMatch(/<DetailJournalPanel\b/);
    expect(source).toMatch(/<DetailOverviewSection\b/);
    expect(source).toMatch(/<DetailProviderRail\b/);
  }
  expect(tv).toMatch(/<WatchProgressBar[\s\S]*?style=\{styles\.showProgressTrack\}/);
});
