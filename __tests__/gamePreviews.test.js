// __tests__/gamePreviews.test.js
//
// Eğlence > Oyunlar kartlarındaki önizlemeler (components/game/GamePreviews.js). Önizleme "oynanmış bir soru" gibi
// doğru şıkkı işaretler, yani afiş ile cevap birbirini tutmalı: bu dosya PREVIEW_FACTS'in gerçek bilgilerle uyumunu,
// her oyunun her dilde metin sızıntısı olmadan çizildiğini ve simge adlarını sabitler.

import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, absoluteFill: {}, absoluteFillObject: {}, hairlineWidth: 1 },
  View: "View",
  Text: "Text",
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "Gradient" }));
jest.mock("../components/AppIcon", () => ({
  __esModule: true,
  default: (props) => require("react").createElement("Icon", props),
}));
let mockLang = "tr";
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: mockLang }) }));

const fs = require("fs");
const path = require("path");
const GamePreview = require("../components/game/GamePreviews").default;
const { PREVIEW_FACTS } = require("../components/game/GamePreviews");
const { QUICK_COPY } = require("../utils/quickGamesCopy");
const { QUICK_GAME_IDS, QUICK_GENRES } = require("../utils/quickGames");
const { GAME_REGISTRY } = require("../screens/game/gameRegistry");

global.IS_REACT_ACT_ENVIRONMENT = true;

const ALL_IDS = [...GAME_REGISTRY.map((g) => g.id), "older", ...QUICK_GAME_IDS];
const LANGS = Object.keys(QUICK_COPY);

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
const texts = () => renderer.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));

describe("önizleme gerçekleri", () => {
  test("her afiş kataloğda bulunur (sessiz geri düşüş yok) ve hepsi farklıdır", () => {
    const f = PREVIEW_FACTS;
    const posters = [
      f.scene_guess.poster, f.poster_puzzle.poster, f.older.first.poster, f.older.second.poster,
      f.popular.winner, f.popular.loser, f.decade.poster, f.kind.poster, f.genre.poster,
    ];
    // Bulunamayan kimlik kataloğun ilk afişine düşer → kopya olarak yakalanır.
    expect(new Set(posters.map((p) => `${p.mediaType}-${p.id}`)).size).toBe(posters.length);
  });

  test("işaretli cevaplar afişle tutarlı", () => {
    const f = PREVIEW_FACTS;
    expect(f.older.first.year).toBeLessThan(f.older.second.year);
    expect(f.popular.winner.voteCount).toBeGreaterThan(f.popular.loser.voteCount);
    expect(f.decade.options).toContain(f.decade.correct);
    expect(f.kind.poster.mediaType).toBe(f.kind.correct);
    expect(f.genre.options).toContain(f.genre.correct);
    f.genre.options.forEach((g) => expect(QUICK_GENRES).toContain(g));
  });
});

describe("çizim", () => {
  test.each(LANGS)("dil %s: yedi oyunun önizlemesi çizilir, metin sızıntısı yok", (lang) => {
    mockLang = lang;
    for (const gameId of ALL_IDS) {
      act(() => { renderer = create(<GamePreview gameId={gameId} height={72} />); });
      expect(renderer.toJSON()).not.toBeNull();
      expect(renderer.root.findAllByType("Image").length).toBeGreaterThan(0);
      expect(texts().some((t) => /undefined|NaN|\[object/.test(t))).toBe(false);
      act(() => renderer.unmount());
      renderer = null;
    }
  });

  test("şıklı önizlemeler o dilin etiketlerini ve tek doğru işaretini taşır", () => {
    mockLang = "de";
    act(() => { renderer = create(<GamePreview gameId="genre" height={72} />); });
    expect(texts()).toEqual(PREVIEW_FACTS.genre.options.map((g) => QUICK_COPY.de.genres[g]));
    expect(renderer.root.findAll((n) => n.type === "Icon" && n.props.name === "checkmark-circle")).toHaveLength(1);
  });

  test("bilinmeyen oyun kimliği hiçbir şey çizmez", () => {
    act(() => { renderer = create(<GamePreview gameId="yok" height={72} />); });
    expect(renderer.toJSON()).toBeNull();
  });

  test("simge adları Ionicons sözlüğünde var", () => {
    const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    const glyphs = JSON.parse(read("node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json"));
    const names = [...read("components/game/GamePreviews.js").matchAll(/name="([a-z-]+)"/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(4);
    names.forEach((name) => expect(glyphs[name]).toBeDefined());
  });
});
