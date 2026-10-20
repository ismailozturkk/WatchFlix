// __tests__/listSortFilterSheet.test.js
//
// Ortak "Sırala ve filtrele" sayfasının AKIŞI (saf kararlar __tests__/listSortFilter.test.js'te): sıralama çipi
// + yön oku, bölümler (segment / çip / çok seçimli / ekran düğümü), türleri daraltma, Sıfırla durumu, kapalı
// "Görünüm" satırı ve açılınca ayarlar, "N sonuç göster". Görsel parçalar taklit edilir.

import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, hairlineWidth: 1, flatten: (s) => s },
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  ActivityIndicator: "Spinner",
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("@expo/vector-icons/Feather", () => ({ __esModule: true, default: "Icon" }));
const mockHost = (name) => ({
  __esModule: true,
  default: ({ children, ...props }) => require("react").createElement(name, props, children),
});
jest.mock("../components/common/GlassCloseButton", () => mockHost("CloseButton"));
jest.mock("../components/common/SheetScroll", () => mockHost("Scroll"));
jest.mock("../components/common/BottomSheetModal", () => ({
  __esModule: true,
  default: ({ visible, children }) => (visible ? require("react").createElement("Sheet", null, children) : null),
}));
// Poster bilgisi çipleri kendi dosyasında; burada yalnız props'u görmek yeter.
jest.mock("../components/lists/ListPosterInfoControls", () => mockHost("PosterInfo"));

const ListSortFilterSheet = require("../components/lists/ListSortFilterSheet").default;
const { LIST_SORT_FILTER_COPY } = require("../utils/listSortFilterCopy");

global.IS_REACT_ACT_ENVIRONMENT = true;

const theme = {
  primary: "#111111", secondary: "#1b1b1b", border: "#333333",
  text: { primary: "#ffffff", secondary: "#bbbbbb", muted: "#888888" },
};
const tr = LIST_SORT_FILTER_COPY.tr;
const GENRES = Array.from({ length: 14 }, (_, i) => `Tür ${i + 1}`);

let renderer;
let errorSpy;
beforeEach(() => {
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
});

const host = (testID) => renderer.root.findAll((n) => typeof n.type === "string" && n.props.testID === testID);
const has = (testID) => host(testID).length > 0;
const one = (testID) => {
  const found = host(testID);
  if (found.length !== 1) throw new Error(`${testID}: ${found.length} düğüm`);
  return found[0];
};
const press = (testID) => act(() => one(testID).props.onPress());
const textOf = (testID) => {
  const node = one(testID);
  const parts = node.type === "Text" ? [node] : node.findAllByType("Text");
  return parts.map((n) => [].concat(n.props.children).join("")).join("");
};
const iconNames = (testID) => one(testID).findAllByType("Icon").map((n) => n.props.name);

const baseProps = () => ({
  visible: true,
  onClose: jest.fn(),
  theme,
  accent: "#3388ff",
  copy: tr,
  resultCount: 42,
  filtering: false,
  activeCount: 0,
  onReset: jest.fn(),
  sort: {
    options: [
      { key: "default", label: "Liste sırası", icon: "list" },
      { key: "dateAdded", label: "Eklenme", icon: "calendar" },
      { key: "name", label: "İsim", icon: "type" },
    ],
    value: "default",
    dir: "desc",
    supportsDir: true,
    onChange: jest.fn(),
  },
  sections: [],
  view: {
    columns: 3,
    onColumns: jest.fn(),
    radius: 10,
    onRadius: jest.fn(),
    posterInfo: { title: true },
    onPosterInfo: jest.fn(),
    showAddedBy: false,
  },
});
const render = (overrides = {}) => {
  const props = { ...baseProps(), ...overrides };
  act(() => {
    renderer = create(<ListSortFilterSheet {...props} />);
  });
  return props;
};

describe("üst bölüm", () => {
  it("sonuç sayısı ve Sıfırla durumu", () => {
    render();
    expect(textOf("sort-filter-results")).toBe("42 sonuç");
    expect(one("sort-filter-reset").props.disabled).toBe(true);
    act(() => renderer.unmount());
    const props = render({ activeCount: 3 });
    expect(one("sort-filter-reset").props.disabled).toBe(false);
    expect(textOf("sort-filter-reset")).toBe("Sıfırla · 3");
    press("sort-filter-reset");
    expect(props.onReset).toHaveBeenCalledTimes(1);
  });

  it("alt düğme sonuç sayısını söyler ve sayfayı kapatır; süzme sürerken yüklenme göstergesi", () => {
    const props = render();
    expect(textOf("sort-filter-apply")).toBe("42 sonuç göster");
    press("sort-filter-apply");
    expect(props.onClose).toHaveBeenCalledTimes(1);
    act(() => renderer.unmount());
    render({ filtering: true });
    expect(one("sort-filter-apply").findAllByType("Spinner")).toHaveLength(1);
  });

  it("kapalıyken hiçbir şey çizilmez", () => {
    render({ visible: false });
    expect(has("sort-filter-apply")).toBe(false);
  });
});

describe("sıralama", () => {
  it("başka çipe basınca o anahtarın doğal yönüyle bildirir (İsim → A-Z)", () => {
    const props = render();
    press("sort-filter-sort-name");
    expect(props.sort.onChange).toHaveBeenCalledWith({ key: "name", dir: "asc" });
    press("sort-filter-sort-dateAdded");
    expect(props.sort.onChange).toHaveBeenLastCalledWith({ key: "dateAdded", dir: "desc" });
  });

  it("seçili çipte yön oku var; yeniden basınca yön çevrilir; liste sırasında ok yok", () => {
    const props = render({ sort: { ...baseProps().sort, value: "name", dir: "asc" } });
    expect(has("sort-filter-dir")).toBe(true);
    expect(iconNames("sort-filter-dir")).toEqual(["arrow-up"]);
    expect(textOf("sort-filter-dir-text")).toBe("Artan");
    press("sort-filter-sort-name");
    expect(props.sort.onChange).toHaveBeenCalledWith({ key: "name", dir: "desc" });
    act(() => renderer.unmount());
    render({ sort: { ...baseProps().sort, value: "default" } });
    expect(has("sort-filter-dir")).toBe(false);
    expect(has("sort-filter-dir-text")).toBe(false);
  });

  it("azalan yönde aşağı ok ve 'Azalan'", () => {
    render({ sort: { ...baseProps().sort, value: "dateAdded", dir: "desc" } });
    expect(iconNames("sort-filter-dir")).toEqual(["arrow-down"]);
    expect(textOf("sort-filter-dir-text")).toBe("Azalan");
  });

  it("yön desteklemeyen ekran (Ortak liste): ok ve yön metni yok", () => {
    render({ sort: { ...baseProps().sort, value: "name", supportsDir: false } });
    expect(has("sort-filter-dir")).toBe(false);
    expect(has("sort-filter-dir-text")).toBe(false);
  });
});

describe("bölümler", () => {
  it("segment: seçimi bildirir", () => {
    const onChange = jest.fn();
    render({
      sections: [
        {
          id: "type", kind: "segment", title: "TÜR", value: "all", onChange,
          options: [{ key: "all", label: "Hepsi" }, { key: "movie", label: "Film" }, { key: "tv", label: "Dizi" }],
        },
      ],
    });
    expect(one("sort-filter-type-all").props.accessibilityState.selected).toBe(true);
    press("sort-filter-type-tv");
    expect(onChange).toHaveBeenCalledWith("tv");
  });

  it("çip bölümü (tarih): tek seçim", () => {
    const onChange = jest.fn();
    render({
      sections: [
        { id: "date", kind: "chips", title: "TARİH", value: "all", onChange, options: [{ key: "all", label: "Tümü" }, { key: "7", label: "Son 7 gün" }] },
      ],
    });
    press("sort-filter-date-7");
    expect(onChange).toHaveBeenCalledWith("7");
  });

  it("çok seçimli türler: ilk 8 + '+6 daha'; açınca hepsi; daralt geri alır", () => {
    const onToggle = jest.fn();
    render({
      sections: [
        { id: "genre", kind: "multi", title: "TÜRLER", options: GENRES, value: [], onToggle, moreLabel: tr.moreChips, lessLabel: tr.lessChips },
      ],
    });
    expect(has("sort-filter-genre-Tür 8")).toBe(true);
    expect(has("sort-filter-genre-Tür 9")).toBe(false);
    expect(textOf("sort-filter-genre-more")).toBe("+6 daha");
    press("sort-filter-genre-Tür 2");
    expect(onToggle).toHaveBeenCalledWith("Tür 2");
    press("sort-filter-genre-more");
    expect(has("sort-filter-genre-Tür 14")).toBe(true);
    expect(textOf("sort-filter-genre-more")).toBe("Daralt");
    press("sort-filter-genre-more");
    expect(has("sort-filter-genre-Tür 14")).toBe(false);
  });

  it("seçili tür gizli bölgede olsa da görünür kalır", () => {
    render({
      sections: [
        { id: "genre", kind: "multi", title: "TÜRLER", options: GENRES, value: ["Tür 13"], onToggle: jest.fn(), moreLabel: tr.moreChips, lessLabel: tr.lessChips },
      ],
    });
    expect(has("sort-filter-genre-Tür 13")).toBe(true);
    expect(one("sort-filter-genre-Tür 13").props.accessibilityState.selected).toBe(true);
    expect(textOf("sort-filter-genre-more")).toBe("+5 daha");
  });

  it("az türde 'daha' çipi çıkmaz", () => {
    render({
      sections: [
        { id: "genre", kind: "multi", title: "TÜRLER", options: GENRES.slice(0, 5), value: [], onToggle: jest.fn(), moreLabel: tr.moreChips, lessLabel: tr.lessChips },
      ],
    });
    expect(has("sort-filter-genre-more")).toBe(false);
  });

  it("ekranın kendi düğümü (Platformlarım / Paylaşan üye) olduğu gibi çizilir", () => {
    render({ sections: [{ id: "platform", kind: "node", node: React.createElement("Custom", { testID: "ozel-dugum" }) }] });
    expect(has("ozel-dugum")).toBe(true);
    expect(has("sort-filter-section-platform")).toBe(true);
  });
});

describe("görünüm", () => {
  it("kapalı satırda özet gösterir; ayarlar görünmez", () => {
    render();
    expect(textOf("sort-filter-view-summary")).toBe("3'lü · Normal");
    expect(has("sort-filter-columns-3")).toBe(false);
    expect(has("sort-filter-radius-10")).toBe(false);
  });

  it("özet sütun ve köşe değerini yansıtır", () => {
    render({ view: { ...baseProps().view, columns: 4, radius: 20 } });
    expect(textOf("sort-filter-view-summary")).toBe("4'lü · Yuvarlak");
  });

  it("açılınca sütun / köşe seçenekleri ve poster bilgisi çipleri gelir; seçimler bildirilir", () => {
    const props = render();
    press("sort-filter-view-toggle");
    expect(one("sort-filter-view-toggle").props.accessibilityState.expanded).toBe(true);
    expect(one("sort-filter-columns-3").props.accessibilityState.selected).toBe(true);
    press("sort-filter-columns-4");
    expect(props.view.onColumns).toHaveBeenCalledWith(4);
    expect(one("sort-filter-radius-10").props.accessibilityState.selected).toBe(true);
    press("sort-filter-radius-20");
    expect(props.view.onRadius).toHaveBeenCalledWith(20);
    const info = renderer.root.findByType("PosterInfo");
    expect(info.props.variant).toBe("chips");
    expect(info.props.value).toEqual({ title: true });
    expect(info.props.showAddedBy).toBe(false);
    act(() => info.props.onValueChange("rating", false));
    expect(props.view.onPosterInfo).toHaveBeenCalledWith("rating", false);
  });

  it("Ortak listede 'ekleyen' poster bilgisi seçeneği açılır; tekrar basınca kapanır", () => {
    render({ view: { ...baseProps().view, showAddedBy: true } });
    press("sort-filter-view-toggle");
    expect(renderer.root.findByType("PosterInfo").props.showAddedBy).toBe(true);
    press("sort-filter-view-toggle");
    expect(has("sort-filter-columns-3")).toBe(false);
  });
});
