// __tests__/certification.test.js
//
// Yaş sınırı rozeti: bölgeye göre doğru derece seçimi (film: sürüm türü önceliği, dizi: content_ratings),
// ABD yedeği ve işaretlenmesi, bilgi vermeyen değerlerin yok sayılması, ton sınıflandırması ve rozet bileşeni.

import React from "react";
import { act, create } from "react-test-renderer";

let mockLang = "tr";
jest.mock("react-native", () => ({
  StyleSheet: { create: (styles) => styles },
  Text: "Text",
  View: "View",
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: mockLang }) }));
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({ theme: { text: { muted: "#999999" } } }),
}));

const fs = require("fs");
const path = require("path");
const { certificationOf, certificationTone } = require("../utils/certification");
const CertificationBadge = require("../components/detail/CertificationBadge").default;

global.IS_REACT_ACT_ENVIRONMENT = true;

const movie = (results) => ({ release_dates: { results } });
const entry = (region, ...releases) => ({
  iso_3166_1: region,
  release_dates: releases.map(([certification, type, release_date = "2020-01-01"]) => ({ certification, type, release_date })),
});

describe("film: certificationOf", () => {
  test("kullanıcının bölgesi öncelikli", () => {
    const details = movie([entry("US", ["PG-13", 3]), entry("TR", ["13+", 3])]);
    expect(certificationOf("movie", details, "TR")).toEqual({ label: "13+", region: "TR", fallback: false });
  });

  test("bölgede kayıt yoksa ABD'ye düşer ve 'fallback' işaretlenir", () => {
    const details = movie([entry("US", ["R", 3]), entry("DE", ["16", 3])]);
    expect(certificationOf("movie", details, "TR")).toEqual({ label: "R", region: "US", fallback: true });
  });

  test("bölgede kayıt var ama derecesi boşsa ABD'ye düşer", () => {
    const details = movie([entry("TR", ["", 3]), entry("US", ["PG", 3])]);
    expect(certificationOf("movie", details, "TR")).toMatchObject({ label: "PG", region: "US", fallback: true });
  });

  test("kullanıcı bölgesi ABD ise fallback değildir", () => {
    expect(certificationOf("movie", movie([entry("US", ["PG", 3])]), "US")).toEqual({
      label: "PG",
      region: "US",
      fallback: false,
    });
  });

  test("sürüm önceliği: sinema > dijital > fiziksel > TV > sınırlı > prömiyer; eşitse en eski tarih", () => {
    const sira = entry("US", ["PG", 1], ["R", 4], ["PG-13", 3, "2020-05-01"], ["G", 3, "2020-02-01"], ["NC-17", 6]);
    expect(certificationOf("movie", movie([sira]), "US").label).toBe("G");
    expect(certificationOf("movie", movie([entry("US", ["PG", 1], ["R", 4])]), "US").label).toBe("R");
    expect(certificationOf("movie", movie([entry("US", ["PG", 1], ["R", 6], ["G", 5])]), "US").label).toBe("G");
  });

  test("bilgi vermeyen değerler (NR, Not Rated, boşluk) yok sayılır, sıradaki kullanılır", () => {
    const details = movie([entry("US", ["NR", 3], ["Not Rated", 4], ["  ", 5], ["PG-13", 6])]);
    expect(certificationOf("movie", details, "US").label).toBe("PG-13");
    expect(certificationOf("movie", movie([entry("US", ["NR", 3])]), "US")).toBeNull();
  });

  test("etiket boşluktan arındırılır; aşırı uzun değer yok sayılır", () => {
    expect(certificationOf("movie", movie([entry("US", ["  PG-13 ", 3])]), "US").label).toBe("PG-13");
    expect(certificationOf("movie", movie([entry("US", ["x".repeat(40), 3])]), "US")).toBeNull();
  });

  test.each([null, undefined, {}, { release_dates: null }, { release_dates: { results: null } }, { release_dates: { results: [] } }, { release_dates: { results: [null, {}] } }])(
    "bozuk/eksik veri %j için null, fırlatmaz",
    (details) => {
      expect(certificationOf("movie", details, "TR")).toBeNull();
    },
  );
});

describe("dizi: certificationOf", () => {
  const tv = (...rows) => ({ content_ratings: { results: rows.map(([region, rating]) => ({ iso_3166_1: region, rating })) } });

  test("bölge → ABD yedeği → null", () => {
    expect(certificationOf("tv", tv(["TR", "13+"], ["US", "TV-MA"]), "TR")).toEqual({ label: "13+", region: "TR", fallback: false });
    expect(certificationOf("tv", tv(["US", "TV-14"]), "ES")).toEqual({ label: "TV-14", region: "US", fallback: true });
    expect(certificationOf("tv", tv(["DE", "16"]), "TR")).toBeNull();
  });

  test("film verisi dizi çağrısında, dizi verisi film çağrısında KULLANILMAZ", () => {
    expect(certificationOf("tv", movie([entry("US", ["PG", 3])]), "US")).toBeNull();
    expect(certificationOf("movie", tv(["US", "TV-MA"]), "US")).toBeNull();
  });

  test("boş / NR derece yok sayılır", () => {
    expect(certificationOf("tv", tv(["TR", ""], ["US", "NR"]), "TR")).toBeNull();
    expect(certificationOf("tv", tv(["TR", "NR"], ["US", "TV-PG"]), "TR").label).toBe("TV-PG");
  });
});

describe("certificationTone", () => {
  test.each([
    ["G", "all"], ["PG", "all"], ["TV-Y", "all"], ["TV-Y7", "all"], ["TV-G", "all"], ["TV-PG", "all"],
    ["U", "all"], ["Genel İzleyici", "all"], ["GENEL İZLEYİCİ", "all"], ["genel ızleyıcı", "all"], ["Todos", "all"], ["TP", "all"], ["0", "all"], ["6+", "all"], ["7", "all"],
    ["PG-13", "teen"], ["TV-14", "teen"], ["12", "teen"], ["12A", "teen"], ["13+", "teen"], ["10+", "teen"],
    ["R", "mature"], ["NC-17", "mature"], ["TV-MA", "mature"], ["16", "mature"], ["18", "mature"], ["18+", "mature"], ["15+", "mature"],
    ["???", "unknown"], ["", "unknown"], [undefined, "unknown"], [null, "unknown"],
  ])("%s → %s", (label, expected) => {
    expect(certificationTone(label)).toBe(expected);
  });

  test("büyük/küçük harf farkı yok", () => {
    expect(certificationTone("tv-ma")).toBe("mature");
    expect(certificationTone("pg-13")).toBe("teen");
  });
});

describe("CertificationBadge bileşeni", () => {
  let renderer;
  let warn;
  beforeEach(() => {
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
  const render = (props) => act(() => { renderer = create(<CertificationBadge {...props} />); });
  const texts = () => renderer.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));

  test("derece yoksa HİÇBİR ŞEY çizmez", () => {
    render({ mediaType: "movie", details: movie([]), region: "TR" });
    expect(renderer.toJSON()).toBeNull();
    act(() => renderer.unmount());
    render({ mediaType: "movie", details: null, region: "TR" });
    expect(renderer.toJSON()).toBeNull();
  });

  test("kendi bölgesinin derecesini bölge eki olmadan yazar", () => {
    render({ mediaType: "movie", details: movie([entry("TR", ["13+", 3])]), region: "TR" });
    expect(texts()).toEqual(["13+"]);
    expect(renderer.root.findByProps({ testID: "certification-badge" }).props.accessibilityLabel).toBe("Yaş sınırı: 13+");
  });

  test("ABD yedeğinde bölge ekini yazar ve erişilebilir metin bölgeyi söyler", () => {
    render({ mediaType: "tv", details: { content_ratings: { results: [{ iso_3166_1: "US", rating: "TV-MA" }] } }, region: "TR" });
    expect(texts()).toEqual(["TV-MA · US"]);
    expect(renderer.root.findByProps({ testID: "certification-badge" }).props.accessibilityLabel).toBe(
      "Yaş sınırı: TV-MA (US derecesi)",
    );
  });

  test.each([
    ["tr", "Yaş sınırı: PG"],
    ["en", "Age rating: PG"],
    ["es", "Clasificación por edades: PG"],
    ["pt", "Classificação indicativa: PG"],
  ])("%s: erişilebilir etiket kendi dilinde", (dil, beklenen) => {
    mockLang = dil;
    render({ mediaType: "movie", details: movie([entry("US", ["PG", 3])]), region: "US" });
    expect(renderer.root.findByProps({ testID: "certification-badge" }).props.accessibilityLabel).toBe(beklenen);
  });

  test("ton rengi çerçeveye yansır: yeşil / amber / kırmızı", () => {
    const colorOf = (label) => {
      render({ mediaType: "movie", details: movie([entry("US", [label, 3])]), region: "US" });
      const flat = [].concat(renderer.root.findByProps({ testID: "certification-badge" }).props.style).flat(Infinity);
      const border = flat.find((s) => s && s.borderColor)?.borderColor;
      act(() => renderer.unmount());
      renderer = null;
      return border;
    };
    const all = colorOf("G");
    const teen = colorOf("PG-13");
    const mature = colorOf("R");
    expect(new Set([all, teen, mature]).size).toBe(3);
  });
});

describe("kapsam bekçisi: detay ekranları rozeti kullanıyor ve doğru veriyi istiyor", () => {
  const oku = (...p) => fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");

  test("film detayı rozeti tür satırında gösterir ve release_dates ister", () => {
    const kaynak = oku("screens", "movie", "MovieDetail.js");
    expect(kaynak).toMatch(/<CertificationBadge mediaType="movie" details=\{details\} region=\{providerRegion\}/);
    expect(kaynak).toContain("release_dates");
  });

  test("dizi detayı rozeti gösterir ve content_ratings ister (dizide release_dates geçersiz)", () => {
    const kaynak = oku("screens", "tv", "TvShowsDetails.js");
    expect(kaynak).toMatch(/<CertificationBadge mediaType="tv" details=\{details\} region=\{providerRegion\}/);
    expect(kaynak).toContain("content_ratings");
    expect(kaynak).not.toContain("recommendations,release_dates");
  });
});
