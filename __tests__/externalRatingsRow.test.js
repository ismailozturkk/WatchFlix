// __tests__/externalRatingsRow.test.js
//
// Detaydaki harici puan satırı + ayrıntı sayfası: tek satırda simgeli çipler, TEK dokunma hedefi, basınca ayrıntı sayfası
// (adlar, IMDb oy sayısı tam, Taze/Çürük, Metascore değerlendirmesi). Yalnız veri GELİNCE görünür, N/A çizmez,
// kimlik yoksa istek atmaz.
import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, hairlineWidth: 1 },
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("react-native-svg", () => ({ __esModule: true, default: "Svg", Circle: "Circle", Path: "Path" }));
const mockHost = (name) => ({
  __esModule: true,
  default: ({ children, ...props }) => require("react").createElement(name, props, children),
});
jest.mock("../components/common/GlassCloseButton", () => mockHost("CloseButton"));
jest.mock("../components/common/BottomSheetModal", () => ({
  __esModule: true,
  default: ({ visible, children }) => (visible ? children : null),
}));
let mockLang = "tr";
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: mockLang }) }));
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: { primary: "#000", secondary: "#111", border: "#333", text: { primary: "#fff", muted: "#888" } },
  }),
}));
const mockFetch = jest.fn();
jest.mock("../services/externalRatings", () => ({ fetchTitleRatings: (...args) => mockFetch(...args) }));

const ExternalRatingsRow = require("../components/detail/ExternalRatingsRow").default;
const { EXTERNAL_RATINGS_COPY } = require("../utils/externalRatingsCopy");

global.IS_REACT_ACT_ENVIRONMENT = true;
const copy = EXTERNAL_RATINGS_COPY.tr;

let renderer;
let warn;
beforeEach(() => {
  mockFetch.mockReset();
  mockLang = "tr";
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

const mount = async (imdbId) => {
  await act(async () => {
    renderer = create(<ExternalRatingsRow imdbId={imdbId} />);
  });
};
const texts = () =>
  renderer.root.findAllByType("Text").map((n) => (Array.isArray(n.props.children) ? n.props.children.join("") : n.props.children));
const trigger = () => renderer.root.findByType("Pressable");
const openSheet = () => act(() => trigger().props.onPress());

const FULL = { found: true, imdbRating: 8.14, imdbVotes: 2345678, rottenTomatoes: 93, metascore: 80 };

describe("satır", () => {
  it("üç çip tek satırda; oy sayısı çipte YOK", async () => {
    mockFetch.mockResolvedValue(FULL);
    await mount("tt0944947");
    expect(texts()).toEqual(["IMDb", "8.1", "93%", "80"]);
    expect(texts().some((t) => String(t).includes("M") && /\d/.test(String(t)) && String(t) !== "IMDb")).toBe(false);
    expect(renderer.root.findAllByType("Svg")).toHaveLength(1); // domates simgesi
    expect(mockFetch).toHaveBeenCalledWith("tt0944947");
  });

  it("üç çip TEK dokunma hedefinin içinde", async () => {
    mockFetch.mockResolvedValue(FULL);
    await mount("tt1");
    expect(renderer.root.findAllByType("Pressable")).toHaveLength(1);
    expect(trigger().props.accessibilityRole).toBe("button");
    expect(trigger().props.accessibilityLabel).toBe(
      copy.open("IMDb 8.1/10, Rotten Tomatoes 93%, Metascore 80/100"),
    );
  });

  it("olmayan puanı çizmez; tek çip de çalışır", async () => {
    mockFetch.mockResolvedValue({ found: true, imdbRating: 7, rottenTomatoes: null, metascore: null });
    await mount("tt2");
    expect(texts()).toEqual(["IMDb", "7.0"]);
    expect(renderer.root.findAllByType("Svg")).toHaveLength(0);
  });

  it("yalnız Metascore varsa tek çip", async () => {
    mockFetch.mockResolvedValue({ found: true, rottenTomatoes: null, metascore: 75 });
    await mount("tt6");
    expect(texts()).toEqual(["75"]);
  });

  it("hiç puan yoksa, bulunamadıysa ya da sunucu cevap vermediyse hiçbir şey çizmez", async () => {
    for (const reply of [{ found: true }, { found: false, reason: "quota" }, null]) {
      mockFetch.mockResolvedValue(reply);
      await mount("tt3");
      expect(renderer.toJSON()).toBeNull();
      act(() => renderer.unmount());
      renderer = null;
    }
  });

  it("IMDb kimliği yoksa istek atmaz", async () => {
    await mount(undefined);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(renderer.toJSON()).toBeNull();
  });
});

describe("ayrıntı sayfası", () => {
  it("kapalıyken çizilmez; basınca açılır: adlar, açıklamalar, IMDb oyu TAM", async () => {
    mockFetch.mockResolvedValue(FULL);
    await mount("tt0944947");
    expect(texts()).not.toContain(copy.title);
    openSheet();
    const t = texts();
    expect(t).toEqual(
      expect.arrayContaining([
        copy.title,
        "IMDb",
        copy.imdb.sub("2,345,678"),
        copy.imdb.scale,
        "Rotten Tomatoes",
        copy.rt.sub,
        copy.rt.fresh,
        "Metascore",
        copy.meta.sub,
        copy.meta.scale,
        copy.meta.verdicts.favorable, // 80
        copy.source,
      ]),
    );
    expect(t).toContain("8.1");
    expect(t).toContain("93%");
    expect(renderer.root.findAllByType("CloseButton")).toHaveLength(1);
  });

  it("kapat düğmesi sayfayı kapatır", async () => {
    mockFetch.mockResolvedValue(FULL);
    await mount("tt0944947");
    openSheet();
    act(() => renderer.root.findByType("CloseButton").props.onPress());
    expect(texts()).not.toContain(copy.title);
  });

  it("%60 altı Rotten Tomatoes 'Çürük', Metascore değerlendirmesi aralığa göre", async () => {
    mockFetch.mockResolvedValue({ found: true, imdbRating: null, rottenTomatoes: 45, metascore: 85 });
    await mount("tt7");
    openSheet();
    const t = texts();
    expect(t).toContain(copy.rt.rotten);
    expect(t).toContain(copy.meta.verdicts.universalAcclaim);
    expect(t).not.toContain("IMDb"); // IMDb puanı yok → satır da yok
  });

  it("yalnız gelen kaynaklar listelenir; IMDb oy sayısı yoksa 'Kullanıcı puanı'", async () => {
    mockFetch.mockResolvedValue({ found: true, imdbRating: 6.2, imdbVotes: null, rottenTomatoes: null, metascore: null });
    await mount("tt8");
    openSheet();
    const t = texts();
    expect(t).toContain(copy.imdb.sub(null));
    expect(t).not.toContain("Rotten Tomatoes");
    expect(t).not.toContain("Metascore");
  });

  it("dili izler (İngilizce)", async () => {
    mockLang = "en";
    mockFetch.mockResolvedValue(FULL);
    await mount("tt9");
    expect(trigger().props.accessibilityLabel).toBe(
      EXTERNAL_RATINGS_COPY.en.open("IMDb 8.1/10, Rotten Tomatoes 93%, Metascore 80/100"),
    );
    openSheet();
    expect(texts()).toContain(EXTERNAL_RATINGS_COPY.en.imdb.sub("2,345,678"));
  });

  it("başka yapıma geçince sayfa kapanır ve eski puan silinir", async () => {
    mockFetch.mockResolvedValueOnce(FULL).mockResolvedValueOnce({ found: false });
    await mount("tt10");
    openSheet();
    await act(async () => {
      renderer.update(<ExternalRatingsRow imdbId="tt11" />);
    });
    expect(renderer.toJSON()).toBeNull();
  });
});
