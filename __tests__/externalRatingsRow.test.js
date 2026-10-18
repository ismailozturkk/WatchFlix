// __tests__/externalRatingsRow.test.js
//
// Detaydaki harici puan satırı: yalnız veri GELİNCE görünür, N/A çizmez, kimlik yoksa istek atmaz.
import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, hairlineWidth: 1 },
  View: "View",
  Text: "Text",
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({ theme: { secondary: "#111", border: "#333", text: { primary: "#fff", muted: "#888" } } }),
}));
const mockFetch = jest.fn();
jest.mock("../services/externalRatings", () => ({ fetchTitleRatings: (...args) => mockFetch(...args) }));

const ExternalRatingsRow = require("../components/detail/ExternalRatingsRow").default;

global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer;
let warn;
beforeEach(() => {
  mockFetch.mockReset();
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
const texts = () => renderer.root.findAllByType("Text").map((n) => n.props.children);

it("üç puanı da gösterir", async () => {
  mockFetch.mockResolvedValue({ found: true, imdbRating: 8.14, imdbVotes: 1234567, rottenTomatoes: 93, metascore: 80 });
  await mount("tt0944947");
  expect(texts()).toEqual(["IMDb", "8.1", "Rotten Tomatoes", "93%", "Metascore", "80"]);
  expect(mockFetch).toHaveBeenCalledWith("tt0944947");
});

it("olmayan puanı (N/A → null) çizmez", async () => {
  mockFetch.mockResolvedValue({ found: true, imdbRating: 7, imdbVotes: null, rottenTomatoes: null, metascore: null });
  await mount("tt1");
  expect(texts()).toEqual(["IMDb", "7.0"]);
});

it("hiç puan yoksa, bulunamadıysa ya da sunucu cevap vermediyse hiçbir şey çizmez", async () => {
  for (const reply of [{ found: true }, { found: false, reason: "quota" }, null]) {
    mockFetch.mockResolvedValue(reply);
    await mount("tt2");
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

it("erişilebilirlik etiketi oy sayısını da okur", async () => {
  mockFetch.mockResolvedValue({ found: true, imdbRating: 9.2, imdbVotes: 2345678 });
  await mount("tt3");
  const chip = renderer.root.findAll((n) => n.props.accessibilityLabel);
  expect(chip[0].props.accessibilityLabel).toBe("IMDb 9.2/10, 2,345,678");
});
