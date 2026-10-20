// __tests__/tasteMatchCard.test.js
//
// Arkadaş profilindeki zevk uyumu kartı: durumlar (yüzde var/yok), davet düğmesi koşulları, gizlilik notları.
import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, hairlineWidth: 1 },
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  ActivityIndicator: "Spinner",
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("../theme/colors", () => ({ alpha: (c) => c }));
let mockLang = "tr";
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: mockLang }) }));
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({ theme: { primary: "#111", secondary: "#1b1b1b", border: "#333", accent: "#38f", text: { primary: "#fff", secondary: "#bbb" } } }),
}));
jest.mock("../context/AppSettingsContext", () => ({
  useImageQualitySettings: () => ({ getTmdbUrl: (path) => `https://img${path}` }),
}));

const TasteMatchCard = require("../components/friends/TasteMatchCard").default;
const { TASTE_MATCH_COPY } = require("../utils/tasteMatchCopy");

global.IS_REACT_ACT_ENVIRONMENT = true;

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

const copy = TASTE_MATCH_COPY.tr;
const cand = (id, source = "both") => ({ key: `movie_${id}`, id, type: "movie", name: `Film ${id}`, imagePath: `/m${id}.jpg`, source });
const match = (over = {}) => ({
  state: "ok",
  score: 72,
  tier: "high",
  watched: { overlap: [{}, {}, {}], mine: 10, theirs: 12 },
  favorites: [{}],
  genres: { similarity: 0.9, shared: ["Drama", "Komedi"], comparable: true },
  ratings: { pairs: 4, agreement: 0.83 },
  components: ["genres", "overlap", "ratings"],
  ...over,
});
const together = (candidates = [cand(1), cand(2, "mine")], counts = { both: 1, mine: 1, theirs: 0 }) => ({ candidates, counts });

const mount = (props = {}) => {
  const onInvite = jest.fn();
  act(() => {
    renderer = create(
      <TasteMatchCard match={match()} together={together()} friendName="Ada" canInvite onInvite={onInvite} {...props} />,
    );
  });
  return onInvite;
};
const texts = () =>
  renderer.root.findAllByType("Text").map((n) => (Array.isArray(n.props.children) ? n.props.children.join("") : n.props.children));
const button = () => renderer.root.findAllByType("Pressable")[0];

it("yüzdeyi, kademeyi ve satırları gösterir", () => {
  mount();
  const t = texts();
  expect(t).toContain("%72");
  expect(t).toContain(copy.tiers.high);
  expect(t).toContain(copy.rows.overlap(3));
  expect(t).toContain(copy.rows.favorites(1));
  expect(t).toContain(copy.rows.genres("Drama, Komedi"));
  expect(t).toContain(copy.rows.ratings(83, 4));
  expect(t).not.toContain(copy.limited);
});

it("birlikte izleyelim: ortak varsa 'iki listede', davet düğmesi basışı iletir", () => {
  const onInvite = mount();
  expect(texts()).toContain(copy.together.both(1));
  expect(button().props.accessibilityLabel).toBe(copy.together.action("Ada"));
  act(() => button().props.onPress());
  expect(onInvite).toHaveBeenCalledTimes(1);
});

it("ortak yok, yalnız tek taraflı adaylar: 'henüz izlemediği N aday'", () => {
  mount({ together: together([cand(1, "mine"), cand(2, "theirs")], { both: 0, mine: 1, theirs: 1 }) });
  expect(texts()).toContain(copy.together.mixed(2));
});

it("arkadaş değilse davet düğmesi yok, nedeni yazar", () => {
  mount({ canInvite: false });
  expect(renderer.root.findAllByType("Pressable")).toHaveLength(0);
  expect(texts()).toContain(copy.together.needFriend);
});

it("aday yoksa düğme yok, ipucu var", () => {
  mount({ together: together([], { both: 0, mine: 0, theirs: 0 }) });
  expect(renderer.root.findAllByType("Pressable")).toHaveLength(0);
  expect(texts()).toContain(copy.together.none);
  expect(texts()).toContain(copy.together.noneHint);
});

it("meşgulken düğme devre dışı", () => {
  mount({ inviteBusy: true });
  expect(button().props.disabled).toBe(true);
  expect(button().props.accessibilityState).toEqual({ disabled: true, busy: true });
});

it("veri yoksa yüzde ÇİZMEZ; gizliyse nedenini söyler", () => {
  mount({
    match: match({ state: "no-data", score: null, tier: null, favorites: null, ratings: { pairs: 0, agreement: null }, components: [] }),
    noWatchedVisible: true,
  });
  const t = texts();
  expect(t.some((x) => String(x).startsWith("%"))).toBe(false);
  expect(t).toContain(copy.title);
  expect(t).toContain(copy.noData.hidden("Ada"));
  expect(t).not.toContain(copy.rows.overlap(3)); // satırlar da gizlenir
});

it("yeterli kayıt yoksa 'biraz daha izleme kaydı' der", () => {
  mount({ match: match({ state: "no-data", score: null, tier: null, components: [] }), noWatchedVisible: false });
  expect(texts()).toContain(copy.noData.notEnough);
});

it("kısmi veride 'yaklaşık' notu; arkadaşın listesi gizliyse bunu söyler", () => {
  mount({ match: match({ state: "limited" }), friendListHidden: true });
  expect(texts()).toContain(copy.limited);
  expect(texts()).toContain(copy.together.hiddenList("Ada"));
});

it("dili izler (İngilizce)", () => {
  mockLang = "en";
  mount();
  expect(texts()).toContain(TASTE_MATCH_COPY.en.tiers.high);
});

it("ortak tür yoksa ve puan uyumu yoksa o satırlar çizilmez", () => {
  mount({ match: match({ genres: { similarity: null, shared: [], comparable: false }, ratings: { pairs: 0, agreement: null }, favorites: [] }) });
  const t = texts();
  expect(t.some((x) => String(x).startsWith("Ortak türler"))).toBe(false);
  expect(t.some((x) => String(x).includes("uyum ·"))).toBe(false);
  expect(t.some((x) => String(x).includes("ortak favori"))).toBe(false);
});
