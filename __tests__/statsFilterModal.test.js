// __tests__/statsFilterModal.test.js
//
// Film / Dizi istatistik "Filtrele" sayfası (components/profile/StatsFilterModal.js).
// Eskiden her izleme günü ayrı çipti; yıllarca kullanımda yüzlerce çip alt alta
// diziliyordu. Burada sabitlenen: tarih yıl → ay → gün olarak açılır (dokunuş
// başına bir düzey), seçili çipe tekrar basmak üst düzeye döner, tür listesi
// katlanır ve seçili tür her zaman görünür kalır.

import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
  Dimensions: { get: () => ({ width: 390, height: 844 }) },
  ScrollView: "ScrollView",
  Text: "Text",
  View: "View",
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Icon" }));
jest.mock("../components/common/BottomSheetModal", () => ({
  __esModule: true,
  default: ({ visible, children }) => (visible ? children : null),
}));
jest.mock("../components/common/GlassCloseButton", () => ({
  __esModule: true,
  default: "CloseButton",
}));
jest.mock("../components/common/GlassPressable", () => ({
  __esModule: true,
  default: ({ children, ...rest }) => require("react").createElement("Pressable", rest, children),
}));
jest.mock("../components/profile/StatsComponents", () => ({ withAlpha: (color) => color }));
jest.mock("../utils/i18nText", () => ({
  i18nText: (_key, fallback, options) =>
    options && "n" in options ? fallback.replace("{{n}}", options.n) : fallback,
}));

const StatsFilterModal = require("../components/profile/StatsFilterModal").default;

global.IS_REACT_ACT_ENVIRONMENT = true;

const theme = {
  accent: "#3388ff",
  primary: "#111111",
  secondary: "#222222",
  border: "#333333",
  text: { primary: "#ffffff", secondary: "#cccccc", muted: "#999999" },
};

let renderer;
let warn;
beforeEach(() => {
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

const DATES = ["2025-11-05", "2025-03-14", "2025-03-02", "2024-12-31"];
const COUNTS = { "2025-11-05": 2, "2025-03-14": 3, "2025-03-02": 1, "2024-12-31": 5 };

const baseProps = (over = {}) => ({
  visible: true,
  onClose: jest.fn(),
  theme,
  dates: DATES,
  dateCounts: COUNTS,
  selectedDate: null,
  onSelectDate: jest.fn(),
  genres: [],
  selectedGenre: null,
  onSelectGenre: jest.fn(),
  formatDate: (d) => `gün:${d}`,
  locale: "tr-TR",
  ...over,
});
const render = (props) => act(() => { renderer = create(<StatsFilterModal {...props} />); });
const rerender = (props) => act(() => renderer.update(<StatsFilterModal {...props} />));
// `testID` bileşen sarmalayıcılarından da geçer; yalnız ana (host) öğeleri say.
const ids = (prefix) =>
  renderer.root
    .findAll(
      (n) =>
        typeof n.type === "string" &&
        typeof n.props.testID === "string" &&
        n.props.testID.startsWith(prefix),
    )
    .map((n) => n.props.testID);
const find = (testID) => renderer.root.findAllByProps({ testID })[0];
const press = (testID) => act(() => find(testID).props.onPress());
const textsOf = () => renderer.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));

describe("tarih: yıl → ay → gün", () => {
  test("başta yalnız yıl çipleri var; ay ve gün çipleri kalabalık yapmaz", () => {
    render(baseProps());
    expect(ids("stats-year-")).toEqual(["stats-year-2025", "stats-year-2024"]);
    expect(ids("stats-month-")).toEqual([]);
    expect(ids("stats-day-")).toEqual([]);
  });

  test("yıla basınca o yıl seçilir (tüm yıl filtresi)", () => {
    const props = baseProps();
    render(props);
    press("stats-year-2025");
    expect(props.onSelectDate).toHaveBeenLastCalledWith("2025");
  });

  test("yıl seçiliyken yalnız verisi olan aylar basılabilir", () => {
    render(baseProps({ selectedDate: "2025" }));
    expect(ids("stats-month-")).toEqual(["stats-month-2025-03", "stats-month-2025-11"]);
    expect(ids("stats-day-")).toEqual([]);
  });

  test("aya basınca o ay seçilir, gün çipleri o aydakilerle sınırlı", () => {
    const props = baseProps({ selectedDate: "2025" });
    render(props);
    press("stats-month-2025-03");
    expect(props.onSelectDate).toHaveBeenLastCalledWith("2025-03");

    rerender({ ...props, selectedDate: "2025-03" });
    expect(ids("stats-day-")).toEqual(["stats-day-2025-03-02", "stats-day-2025-03-14"]);
  });

  test("güne basınca tek gün seçilir", () => {
    const props = baseProps({ selectedDate: "2025-03" });
    render(props);
    press("stats-day-2025-03-14");
    expect(props.onSelectDate).toHaveBeenLastCalledWith("2025-03-14");
  });

  test("seçili çipe tekrar basmak bir üst düzeye döner (gün → ay → yıl → tümü)", () => {
    const day = baseProps({ selectedDate: "2025-03-14" });
    render(day);
    press("stats-day-2025-03-14");
    expect(day.onSelectDate).toHaveBeenLastCalledWith("2025-03");

    rerender({ ...day, selectedDate: "2025-03" });
    press("stats-month-2025-03");
    expect(day.onSelectDate).toHaveBeenLastCalledWith("2025");

    rerender({ ...day, selectedDate: "2025" });
    press("stats-year-2025");
    expect(day.onSelectDate).toHaveBeenLastCalledWith(null);
  });

  test("gün seçiliyken üst yıl/ay yolu açık kalır, 'Tüm Tarihler' temizler", () => {
    const props = baseProps({ selectedDate: "2025-03-14" });
    render(props);
    expect(ids("stats-month-")).toHaveLength(2);
    expect(ids("stats-day-")).toHaveLength(2);
    press("stats-date-all");
    expect(props.onSelectDate).toHaveBeenLastCalledWith(null);
  });

  test("tek yıllık veride aylar yıla basmadan görünür", () => {
    render(baseProps({ dates: ["2025-03-14", "2025-06-01"] }));
    expect(ids("stats-month-")).toEqual(["stats-month-2025-03", "stats-month-2025-06"]);
  });

  test("başlıkta seçili aralığın özeti yazar", () => {
    render(baseProps({ selectedDate: "2025", locale: "en-US" }));
    expect(textsOf()).toContain("2025");
    rerender(baseProps({ selectedDate: "2025-03-14" }));
    expect(textsOf()).toContain("gün:2025-03-14");
  });

  test("yıllarca kullanımda çip sayısı gün sayısıyla değil gezintiyle büyür", () => {
    const many = [];
    for (let year = 2018; year <= 2025; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        for (let day = 1; day <= 28; day += 2) {
          many.push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
        }
      }
    }
    render(baseProps({ dates: many, dateCounts: undefined }));
    const closed = ids("stats-").length;
    expect(many.length).toBeGreaterThan(1000);
    expect(closed).toBeLessThan(15); // Tüm Tarihler + 8 yıl + alt çubuk düğmeleri

    rerender(baseProps({ dates: many, dateCounts: undefined, selectedDate: "2025-03" }));
    expect(ids("stats-").length).toBeLessThan(45);
  });
});

describe("tür", () => {
  const genres = Array.from({ length: 14 }, (_, i) => ({ name: `Tür${i}`, count: 100 - i }));

  test("tür yoksa tür grubu gizlenir", () => {
    render(baseProps({ genres: [] }));
    expect(ids("stats-genre-")).toEqual([]);
  });

  test("ilk 8 tür + 'Tümünü göster (6)'; açınca hepsi, kapatma düğmesi gelir", () => {
    render(baseProps({ genres }));
    expect(ids("stats-genre-Tür")).toHaveLength(8);
    expect(textsOf()).toContain("Tümünü göster (6)");

    press("stats-genre-more");
    expect(ids("stats-genre-Tür")).toHaveLength(14);
    expect(ids("stats-genre-less")).toHaveLength(1);

    press("stats-genre-less");
    expect(ids("stats-genre-Tür")).toHaveLength(8);
  });

  test("seçili tür ilk 8'de değilse de görünür kalır", () => {
    render(baseProps({ genres, selectedGenre: "Tür12" }));
    expect(ids("stats-genre-Tür")).toContain("stats-genre-Tür12");
    expect(textsOf()).toContain("Tümünü göster (5)");
  });

  test("türe basınca seçilir, seçiliye tekrar basınca kalkar", () => {
    const props = baseProps({ genres });
    render(props);
    press("stats-genre-Tür3");
    expect(props.onSelectGenre).toHaveBeenLastCalledWith("Tür3");

    rerender({ ...props, selectedGenre: "Tür3" });
    press("stats-genre-Tür3");
    expect(props.onSelectGenre).toHaveBeenLastCalledWith(null);
  });

  test("çiplerde izlenme sayısı yazar", () => {
    render(baseProps({ genres: [{ name: "Dram", count: 42 }] }));
    expect(textsOf()).toContain("42");
  });

  test("düz ad dizisi de çalışır (sayaçsız)", () => {
    render(baseProps({ genres: ["Dram", "Komedi"] }));
    expect(ids("stats-genre-")).toEqual([
      "stats-genre-all",
      "stats-genre-Dram",
      "stats-genre-Komedi",
    ]);
  });
});

describe("alt çubuk", () => {
  test("Temizle ikisini de sıfırlar; filtre yokken devre dışı", () => {
    const idle = baseProps();
    render(idle);
    expect(find("stats-filter-clear").props.disabled).toBe(true);

    const props = baseProps({ selectedDate: "2025", selectedGenre: "Dram", genres: ["Dram"] });
    rerender(props);
    expect(find("stats-filter-clear").props.disabled).toBe(false);
    press("stats-filter-clear");
    expect(props.onSelectDate).toHaveBeenLastCalledWith(null);
    expect(props.onSelectGenre).toHaveBeenLastCalledWith(null);
  });

  test("Tamam sayfayı kapatır", () => {
    const props = baseProps();
    render(props);
    press("stats-filter-done");
    expect(props.onClose).toHaveBeenCalled();
  });
});
