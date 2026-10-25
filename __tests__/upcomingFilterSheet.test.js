// __tests__/upcomingFilterSheet.test.js
//
// "Yaklaşan Filmler" filtre sayfası (components/home/UpcomingFilterSheet.js) ve çip satırı
// (components/home/UpcomingFilterChips.js): taslak sözleşmesi, ay/özel aralık seçimi, "Tarihe göre"
// ↔ gösterim bağı, sıfırlama, hazır aralık çipleri.

import React from "react";
import { act, create } from "react-test-renderer";

let mockLang = "tr";
const mockPicker = { props: null };
jest.mock("react-native", () => ({
  StyleSheet: { create: (styles) => styles },
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Text: "Text",
  View: "View",
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("../components/common/BottomSheetModal", () => ({
  __esModule: true,
  default: ({ visible, children }) => (visible ? children : null),
}));
jest.mock("../components/common/SheetScroll", () => ({ __esModule: true, default: "SheetScroll" }));
jest.mock("../components/modals/DatePickerModal", () => ({
  __esModule: true,
  default: (props) => {
    mockPicker.props = props;
    return null;
  },
}));
// Gerçek SectionChipRail FlatList ister (RN taklidinde yok): veriyi düz çizen kabuk.
jest.mock("../components/home/SectionChips", () => ({
  SectionChipRail: ({ data, renderChip, keyExtractor }) =>
    data.map((item, index) => {
      const el = renderChip(item, index);
      return { ...el, key: keyExtractor(item) };
    }),
}));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: mockLang }) }));
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: {
      accent: "#3388ff",
      primary: "#111111",
      secondary: "#222222",
      border: "#333333",
      text: { primary: "#ffffff", secondary: "#cccccc", muted: "#999999" },
    },
  }),
}));

const UpcomingFilterSheet = require("../components/home/UpcomingFilterSheet").default;
const UpcomingFilterChips = require("../components/home/UpcomingFilterChips").default;
const { UPCOMING_FILTERS_COPY, formatUpcomingDay } = require("../utils/upcomingFiltersCopy");
const {
  DEFAULT_UPCOMING_FILTERS,
  QUICK_RANGES,
  SCOPES,
  UPCOMING_GENRES,
  UPCOMING_LANGUAGES,
  UPCOMING_SORTS,
  normalizeUpcomingFilters,
  upcomingBounds,
  upcomingDateRange,
  upcomingMonths,
} = require("../utils/upcomingFilters");
const { isoDate } = require("../utils/discoverFilters");

global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer;
let warn;
beforeEach(() => {
  mockLang = "tr";
  mockPicker.props = null;
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

const baseProps = (over = {}) => ({
  visible: true,
  onClose: jest.fn(),
  filters: normalizeUpcomingFilters(DEFAULT_UPCOMING_FILTERS),
  onApply: jest.fn(),
  region: "TR",
  ...over,
});
const render = (el) => act(() => { renderer = create(el); });
const renderSheet = (props) => render(<UpcomingFilterSheet {...props} />);
const rerender = (props) => act(() => renderer.update(<UpcomingFilterSheet {...props} />));
const find = (testID) => renderer.root.findAllByProps({ testID })[0];
const maybe = (testID) => renderer.root.findAllByProps({ testID }).length > 0;
const press = (testID) => act(() => find(testID).props.onPress());
const lastApplied = (props) => props.onApply.mock.calls.at(-1)[0];
const textsOf = () => renderer.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));
const plusDays = (iso, n) => {
  const [y, m, d] = iso.split("-").map(Number);
  return isoDate(new Date(y, m - 1, d + n));
};

describe("sayfa — seçenekler", () => {
  test("her seçenek kümesi için çip ve iki tarih alanı var", () => {
    renderSheet(baseProps());
    QUICK_RANGES.forEach((id) => expect(maybe(`upcoming-range-${id}`)).toBe(true));
    upcomingMonths().forEach((m) => expect(maybe(`upcoming-month-${m}`)).toBe(true));
    SCOPES.forEach((id) => expect(maybe(`upcoming-scope-${id}`)).toBe(true));
    UPCOMING_GENRES.forEach((id) => expect(maybe(`upcoming-genre-${id}`)).toBe(true));
    UPCOMING_LANGUAGES.forEach((id) => expect(maybe(`upcoming-language-${id}`)).toBe(true));
    UPCOMING_SORTS.forEach((id) => expect(maybe(`upcoming-sort-${id}`)).toBe(true));
    expect(maybe("upcoming-date-from")).toBe(true);
    expect(maybe("upcoming-date-to")).toBe(true);
  });

  test.each(["tr", "en", "es", "pt", "de"])("%s: başlık, düğme ve bölge adı kendi dilinde", (dil) => {
    mockLang = dil;
    renderSheet(baseProps());
    const texts = textsOf();
    const copy = UPCOMING_FILTERS_COPY[dil];
    expect(texts).toContain(copy.ui.sheetTitle);
    expect(texts).toContain(copy.ui.apply);
    expect(texts.some((t) => t.includes(copy.regions.TR))).toBe(true);
  });

  test("tarih alanları hazır aralıkta da ETKİN pencereyi gösterir; 'Tümü'de bitiş sınırsız", () => {
    renderSheet(baseProps());
    const copy = UPCOMING_FILTERS_COPY.tr;
    const range = upcomingDateRange(DEFAULT_UPCOMING_FILTERS);
    // İlk eşleşme DateField öğesi; ekran okuyucu etiketi içteki düğmede.
    const label = (id) => renderer.root.findAll((n) => n.props.testID === id && n.props.accessibilityLabel)[0].props.accessibilityLabel;
    expect(label("upcoming-date-from")).toBe(`${copy.ui.from}: ${formatUpcomingDay(range.gte, copy)}`);
    expect(label("upcoming-date-to")).toBe(`${copy.ui.to}: ${formatUpcomingDay(range.lte, copy)}`);
    expect(find("upcoming-date-to").props.active).toBe(false);
    press("upcoming-range-all");
    expect(label("upcoming-date-to")).toBe(`${copy.ui.to}: ${copy.ui.noEnd}`);
  });
});

describe("sayfa — taslak", () => {
  test("seçimler taslakta kalır; 'Sonuçları göster' normalize süzgeci uygular", () => {
    const props = baseProps();
    renderSheet(props);
    const month = upcomingMonths()[3];
    press(`upcoming-month-${month}`);
    press("upcoming-scope-digital");
    press("upcoming-genre-27");
    press("upcoming-genre-35");
    press("upcoming-language-ja");
    expect(props.onApply).not.toHaveBeenCalled();
    press("upcoming-sheet-apply");
    expect(lastApplied(props)).toEqual({
      range: "calendarMonth",
      month,
      from: null,
      to: null,
      scope: "digital",
      genres: [27, 35],
      language: "ja",
      sort: "popular",
    });
  });

  test("'Tarihe göre' Tüm dünya'dan Sinemada'ya geçirir; Tüm dünya'ya dönünce Popüler'e iner", () => {
    renderSheet(baseProps());
    press("upcoming-sort-soonest");
    expect(find("upcoming-scope-cinema").props.selected).toBe(true);
    expect(find("upcoming-sort-soonest").props.selected).toBe(true);
    press("upcoming-scope-all");
    expect(find("upcoming-sort-popular").props.selected).toBe(true);
  });

  test("Sıfırla: varsayılanda kapalı; özelleştirilmişte taslağı varsayılana çeker", () => {
    renderSheet(baseProps());
    expect(find("upcoming-sheet-reset").props.disabled).toBe(true);
    act(() => renderer.unmount());
    const props = baseProps({ filters: normalizeUpcomingFilters({ range: "6m", scope: "cinema", genres: [27] }) });
    renderSheet(props);
    expect(find("upcoming-sheet-reset").props.disabled).toBe(false);
    press("upcoming-sheet-reset");
    press("upcoming-sheet-apply");
    expect(lastApplied(props)).toEqual(normalizeUpcomingFilters(DEFAULT_UPCOMING_FILTERS));
  });

  test("kapatıp yeniden açınca taslak GÜNCEL süzgeçten kurulur", () => {
    const props = baseProps({ filters: normalizeUpcomingFilters({ genres: [35] }) });
    renderSheet(props);
    press("upcoming-genre-18");
    rerender({ ...props, visible: false });
    rerender({ ...props, visible: true });
    expect(find("upcoming-genre-18").props.selected).toBe(false);
    expect(find("upcoming-genre-35").props.selected).toBe(true);
  });
});

describe("sayfa — özel aralık", () => {
  test("başlangıç seçici: sınırlar + seçince aralık özel olur, bitiş korunur", () => {
    const props = baseProps({ filters: normalizeUpcomingFilters({ range: "3m" }) });
    renderSheet(props);
    const { minIso, maxIso } = upcomingBounds();
    const range = upcomingDateRange({ range: "3m" });
    expect(mockPicker.props.visible).toBe(false);
    press("upcoming-date-from");
    expect(mockPicker.props).toMatchObject({
      visible: true,
      title: UPCOMING_FILTERS_COPY.tr.ui.pickFromTitle,
      value: range.gte,
      minDate: minIso,
      maxDate: maxIso,
      quickActions: false,
    });
    const from = plusDays(minIso, 10);
    act(() => mockPicker.props.onConfirm(from));
    expect(mockPicker.props.visible).toBe(false);
    press("upcoming-sheet-apply");
    expect(lastApplied(props)).toMatchObject({ range: "custom", from, to: range.lte });
  });

  test("başlangıç bitişi geçerse bitiş bir ay sonraya kayar", () => {
    const props = baseProps();
    renderSheet(props);
    const { lte } = upcomingDateRange(DEFAULT_UPCOMING_FILTERS); // 1 hafta
    const from = plusDays(lte, 20);
    press("upcoming-date-from");
    act(() => mockPicker.props.onConfirm(from));
    press("upcoming-sheet-apply");
    const applied = lastApplied(props);
    expect(applied.from).toBe(from);
    const [y, m, d] = from.split("-").map(Number);
    expect(applied.to).toBe(isoDate(new Date(y, m, d)));
  });

  test("bitiş seçici: en erken başlangıç; seçince özel aralık", () => {
    const props = baseProps({ filters: normalizeUpcomingFilters({ range: "all" }) });
    renderSheet(props);
    const { gte } = upcomingDateRange({ range: "all" });
    press("upcoming-date-to");
    expect(mockPicker.props).toMatchObject({
      visible: true,
      title: UPCOMING_FILTERS_COPY.tr.ui.pickToTitle,
      minDate: gte,
    });
    const to = plusDays(gte, 45);
    act(() => mockPicker.props.onConfirm(to));
    press("upcoming-sheet-apply");
    expect(lastApplied(props)).toMatchObject({ range: "custom", from: gte, to });
  });

  test("sayfa kapanınca seçici de kapalı çizilir", () => {
    const props = baseProps();
    renderSheet(props);
    press("upcoming-date-to");
    expect(mockPicker.props.visible).toBe(true);
    rerender({ ...props, visible: false });
    rerender({ ...props, visible: true });
    expect(mockPicker.props.visible).toBe(false);
  });
});

describe("çip satırı", () => {
  const renderChips = (props) => render(<UpcomingFilterChips {...props} />);

  test("varsayılan: Filtreler + hazır aralıklar + 'Tarih seç'; hazır aralık çipi doğrudan uygular", () => {
    const onSelectRange = jest.fn();
    const onOpenFilters = jest.fn();
    renderChips({ filters: normalizeUpcomingFilters({}), onSelectRange, onOpenFilters });
    expect(find("upcoming-chip-filters").props.label).toBe(UPCOMING_FILTERS_COPY.tr.ui.filters);
    expect(find("upcoming-chip-range-7d").props.selected).toBe(true);
    expect(maybe("upcoming-chip-pick")).toBe(true);
    expect(maybe("upcoming-chip-picked")).toBe(false);
    press("upcoming-chip-range-3m");
    expect(onSelectRange).toHaveBeenCalledWith("3m");
    press("upcoming-chip-pick");
    press("upcoming-chip-filters");
    expect(onOpenFilters).toHaveBeenCalledTimes(2);
  });

  test("süzgeç sayısı rozette (tarih sayılmaz); ay seçiliyken seçili ay çipi öne gelir", () => {
    const month = upcomingMonths()[2];
    renderChips({
      filters: normalizeUpcomingFilters({ range: "calendarMonth", month, scope: "cinema", genres: [27] }),
      onSelectRange: jest.fn(),
      onOpenFilters: jest.fn(),
    });
    expect(find("upcoming-chip-filters").props.label).toBe("Filtreler · 2");
    expect(find("upcoming-chip-picked").props.selected).toBe(true);
    expect(maybe("upcoming-chip-pick")).toBe(false);
    QUICK_RANGES.forEach((id) => expect(find(`upcoming-chip-range-${id}`).props.selected).toBe(false));
  });
});
