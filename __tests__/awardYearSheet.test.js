// Oscar / Emmy yıl seçici (AwardYearSheet) — 20 Eki yenilemesi.
//
// Eski hâli: iki ekranda kopya ham `Modal` + 4 sütunlu düz ızgara; yıl listesi elle
// 2027→1970 döngüsüydü (yapılandırmada olmayan bir yıl seçilince servis sessizce
// `items[0]`a düşüp YANLIŞ yılın afişlerini gösteriyordu). Bu test:
//   1. saf yardımcıları (yıl listesi, on yıl gruplama, satırlara bölme),
//   2. sayfanın yerleşimini (on yıl başlıkları, seçili hücre, bekleyen yıl işareti,
//      şerit, kapatma),
//   3. iki ekranın ortak sayfaya bağlı kaldığını (ham Modal'a dönmediğini) sabitler.
import fs from "fs";
import path from "path";
import React from "react";
import { act, create } from "react-test-renderer";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  ScrollView: "ScrollView",
  TouchableOpacity: "TouchableOpacity",
  StyleSheet: {
    create: (styles) => styles,
    absoluteFill: {},
    absoluteFillObject: {},
    hairlineWidth: 1,
  },
  Platform: { OS: "ios" },
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 20, left: 0, right: 0 }),
}));
// Modal yok: kabuk çocuğunu doğrudan çizer.
jest.mock("../components/common/BottomSheetModal", () => ({
  __esModule: true,
  default: ({ visible, onClose, children }) =>
    visible ? require("react").createElement("BottomSheetModal", { visible, onClose }, children) : null,
}));
jest.mock("../components/common/GlassCloseButton", () => ({
  __esModule: true,
  default: "GlassCloseButton",
}));
// Cam yolu burada yok: şerit düğmesi düz dokunulabilir olarak çizilir.
jest.mock("../components/common/GlassTouchable", () => ({
  __esModule: true,
  default: "TouchableOpacity",
}));
// Babel eklentisi Text'i AppText'e çevirir; gerçeğini Reanimated getirir.
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("../components/AppIcon", () => ({ __esModule: true, default: "AppIcon" }));
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: {
      secondary: "#222",
      between: "#333",
      border: "#444",
      accent: "#6C63FF",
      text: { primary: "#fff", secondary: "#ccc", muted: "#888" },
    },
  }),
}));
// SectionHeader cam/tipografi zincirini getirir; sayfanın ondan tek ihtiyacı altın renk sabiti.
jest.mock("../components/home/SectionHeader", () => ({ SECTION_GOLD: "#F2B705" }));
jest.mock("../services/hapticsService", () => ({ triggerHaptic: jest.fn() }));

const AwardYearSheet = require("../components/home/AwardYearSheet").default;
const { buildAwardYears, groupYearsByDecade, chunkYears, decadeOf } = require("../utils/awardYears");

const ROOT = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

const YEARS = [2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010, 1971, 1970];

describe("awardYears yardımcıları", () => {
  test("buildAwardYears: yeniden eskiye, tekrarsız; açıklanmamış yıl bekleyen sayılır", () => {
    const { years, pending } = buildAwardYears([
      { year: 2025, isConfirmed: true },
      { year: 2027, isConfirmed: false },
      { year: 2026, isConfirmed: true },
      { year: 2025, isConfirmed: true },
      { year: "x", isConfirmed: true },
      null,
    ]);
    expect(years).toEqual([2027, 2026, 2025]);
    expect([...pending]).toEqual([2027]);
  });

  test("buildAwardYears: aynı yıl biri onaylıysa bekleyen değildir; bozuk girdi boş döner", () => {
    const { pending } = buildAwardYears([
      { year: 2024, isConfirmed: false },
      { year: 2024, isConfirmed: true },
    ]);
    expect(pending.size).toBe(0);
    expect(buildAwardYears(undefined)).toEqual({ years: [], pending: new Set() });
  });

  test("groupYearsByDecade: on yıllar yeniden eskiye, her birinde min/max", () => {
    const groups = groupYearsByDecade(YEARS);
    expect(groups.map((g) => g.decade)).toEqual([2020, 2010, 1970]);
    expect(groups[0]).toMatchObject({ min: 2020, max: 2027 });
    expect(groups[0].years).toHaveLength(8);
    expect(groups[2]).toMatchObject({ min: 1970, max: 1971 });
  });

  test("chunkYears: son satır eksik kalabilir, boyut bozuksa 1'e düşer", () => {
    expect(chunkYears([1, 2, 3, 4, 5], 4)).toEqual([[1, 2, 3, 4], [5]]);
    expect(chunkYears([1, 2], 0)).toEqual([[1], [2]]);
    expect(decadeOf(2029)).toBe(2020);
    expect(decadeOf(1970)).toBe(1970);
  });
});

const texts = (tree) =>
  tree.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));

async function render(props) {
  let tree;
  await act(async () => {
    tree = create(
      React.createElement(AwardYearSheet, {
        visible: true,
        onClose: () => {},
        title: "Oscar Yılı Seçin",
        years: YEARS,
        pendingYears: new Set([2027]),
        pendingLabel: "Çok Yakında",
        selectedYear: 2026,
        onSelect: () => {},
        ...props,
      }),
    );
  });
  return tree;
}

const cells = (tree) =>
  tree.root
    .findAllByType("TouchableOpacity")
    .filter((n) => /^\d{4}(,|$)/.test(n.props.accessibilityLabel || ""));

describe("AwardYearSheet yerleşimi", () => {
  test("başlık, aralık ve 'Çok Yakında' açıklaması; on yıl başlıkları ve şerit", async () => {
    const tree = await render();
    const all = texts(tree);
    expect(all).toContain("Oscar Yılı Seçin");
    expect(all).toContain("1970 – 2027");
    expect(all).toContain("Çok Yakında");
    expect(all).toEqual(expect.arrayContaining(["2020 – 2027", "2010 – 2019", "1970 – 1971"]));
    // Şerit: her on yıl için bir düğme (+ hücre düğmelerinden ayrı, etiketsiz).
    const chips = tree.root
      .findAllByType("TouchableOpacity")
      .filter((n) => !n.props.accessibilityLabel);
    expect(chips.map((c) => c.props.accessibilityState.selected)).toEqual([true, false, false]);
  });

  test("her yıl bir hücre; seçili yıl işaretli, bekleyen yıl etiketinde 'Çok Yakında' var", async () => {
    const tree = await render();
    const all = cells(tree);
    expect(all).toHaveLength(YEARS.length);
    const selected = all.filter((c) => c.props.accessibilityState.selected);
    expect(selected).toHaveLength(1);
    expect(selected[0].props.accessibilityLabel).toBe("2026");
    expect(all[0].props.accessibilityLabel).toBe("2027, Çok Yakında");
  });

  test("hücreye basmak yılı sayı olarak bildirir; kapat düğmesi onClose'u çağırır", async () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    const tree = await render({ onSelect, onClose });
    await act(async () => {
      cells(tree).find((c) => c.props.accessibilityLabel === "2019").props.onPress();
    });
    expect(onSelect).toHaveBeenCalledWith(2019);
    tree.root.findByType("GlassCloseButton").props.onPress();
    expect(onClose).toHaveBeenCalled();
  });

  test("bekleyen yıl yoksa açıklama çıkmaz; tek on yıllık listede şerit çizilmez", async () => {
    const tree = await render({ years: [2026, 2025, 2024], pendingYears: new Set() });
    expect(texts(tree)).not.toContain("Çok Yakında");
    const chips = tree.root
      .findAllByType("TouchableOpacity")
      .filter((n) => !n.props.accessibilityLabel);
    expect(chips).toHaveLength(0);
  });

  test("visible=false iken hiçbir şey çizilmez", async () => {
    const tree = await render({ visible: false });
    expect(tree.root.findAllByType("TouchableOpacity")).toHaveLength(0);
  });
});

describe("Ekranlar ortak sayfayı kullanır", () => {
  const SCREENS = [
    ["screens/movie/MovieOscar.js", "getOscarConfig"],
    ["screens/tv/TvShowsEmmy.js", "getEmmyConfig"],
  ];

  test.each(SCREENS)("%s: ham Modal ve elle yıl döngüsü yok", (file, getter) => {
    const src = read(file);
    expect(src).toMatch(/<AwardYearSheet[\s>]/);
    expect(src).toContain("useAwardYears");
    expect(src).toContain(getter);
    expect(src).not.toMatch(/<Modal[\s>]/);
    expect(src).not.toMatch(/for \(let y = 20\d\d; y >= 1970; y--\)/);
  });
});
