// __tests__/tasteMatchCard.test.js
//
// Arkadaş profilindeki zevk uyumu kartı: durumlar (yüzde var/yok), film / dizi kutuları (paylaşılmayan kategori),
// "!" bilgi sayfası, içgörüler, davet ve sohbete gönder düğmeleri, gizlilik notları.
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
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "Gradient" }));
jest.mock("react-native-svg", () => ({ __esModule: true, default: "Svg", Circle: "Circle" }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock("../components/common/BottomSheetModal", () => ({
  __esModule: true,
  default: ({ visible, children }) => (visible ? children : null),
}));
jest.mock("../components/common/GlassCloseButton", () => ({ __esModule: true, default: "GlassClose" }));
jest.mock("../theme/colors", () => ({ alpha: (c) => c }));
let mockLang = "tr";
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: mockLang }) }));
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: { primary: "#111", secondary: "#1b1b1b", between: "#222", border: "#333", accent: "#38f", text: { primary: "#fff", secondary: "#bbb", muted: "#888" } },
  }),
}));
jest.mock("../context/AppSettingsContext", () => ({
  useImageQualitySettings: () => ({ getTmdbUrl: (path) => `https://img${path}` }),
}));

const TasteMatchCard = require("../components/friends/TasteMatchCard").default;
const { TASTE_MATCH_COPY } = require("../utils/tasteMatchCopy");
const { MIN_FAVORITES, MIN_RATED_PAIRS, MIN_WATCHED_FOR_OVERLAP, WEIGHTS } = require("../utils/tasteMatch");

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
const typeInfo = (over = {}) => ({ shared: true, score: 70, overlap: 4, mine: 10, theirs: 12, ...over });
const match = (over = {}) => ({
  state: "ok",
  score: 72,
  tier: "high",
  scope: "both",
  byType: { movie: typeInfo({ score: 80, overlap: 3 }), tv: typeInfo({ score: 61, overlap: 0 }) },
  watched: { overlap: [{}, {}, {}], mine: 10, theirs: 12 },
  favorites: [{}],
  genres: { similarity: 0.9, shared: ["Drama", "Komedi"], comparable: true, lean: { mine: null, theirs: null } },
  ratings: { pairs: 4, agreement: 0.83 },
  highlights: [],
  loved: [],
  split: null,
  breakdown: [],
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
const flat = (children) => [].concat(children).join("");
const texts = () => renderer.root.findAllByType("Text").map((n) => flat(n.props.children));
const byLabel = (label) => renderer.root.findAll((n) => n.props.accessibilityLabel === label);
const pressable = (label) => renderer.root.findAllByType("Pressable").find((b) => b.props.accessibilityLabel === label);
const inviteButton = () => pressable(copy.together.action("Ada"));

it("yüzdeyi, kademeyi ve sayı kutularını gösterir (uzun cümle yok)", () => {
  mount();
  const t = texts();
  expect(t).toContain("%72");
  expect(t).toContain(copy.tiers.high);
  // sayı kutuları: değer + KISA etiket
  expect(t).toContain("3");
  expect(t).toContain(copy.parts.overlap);
  expect(t).toContain("1");
  expect(t).toContain(copy.parts.favorites);
  expect(t).toContain("%83");
  expect(t).toContain(copy.parts.ratings);
  // ortak türler çip olarak
  expect(t).toContain("Drama");
  expect(t).toContain("Komedi");
  expect(t).not.toContain(copy.limited);
  expect(t.some((x) => x.includes("ortak izlenen"))).toBe(false); // eski satır cümleleri kalktı
});

it("halka yüzdeyi oranla çizer; bileşen çubukları dökümden gelir", () => {
  mount({
    match: match({
      breakdown: [
        { id: "genres", value: 80, weight: 0.4 },
        { id: "overlap", value: 45, weight: 0.3 },
        { id: "ratings", value: 83, weight: 0.3 },
      ],
    }),
  });
  const arc = renderer.root.findAllByType("Circle").find((c) => c.props.strokeDasharray);
  const circumference = Number(arc.props.strokeDasharray);
  expect(arc.props.strokeDashoffset).toBeCloseTo(circumference * (1 - 0.72), 5);
});

it.each([
  [59, 0],
  [60, 1],
  [70, 2],
  [80, 3],
  [90, 4],
])("ana progres çubuğu %i puanda ısı seviyesi %i olur", (score, level) => {
  mount({ match: match({ score }) });
  expect(byLabel(`heat-${level}`)).toHaveLength(1);
  const gradient = renderer.root.findAllByType("Gradient")[0];
  expect(gradient.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ width: `${score}%` })]));
});

describe("film / dizi kutuları", () => {
  it("iki kategori de açıkken her biri kendi yüzdesini ve ortak sayısını gösterir", () => {
    mount();
    const t = texts();
    expect(t).toContain(copy.types.movie);
    expect(t).toContain(copy.types.tv);
    expect(t).toContain("%80");
    expect(t).toContain("%61");
    expect(t).toContain(copy.types.common(3));
    expect(byLabel(`${copy.types.movie}: %80`)).not.toHaveLength(0);
  });

  it("arkadaş yalnız film paylaşıyorsa dizi kutusu 'Paylaşılmıyor' (yüzde yok), üstte tek kategori notu", () => {
    mount({
      match: match({
        scope: "movies",
        byType: { movie: typeInfo({ score: 72 }), tv: { shared: false, score: null, overlap: 0, mine: 0, theirs: 0 } },
      }),
    });
    const t = texts();
    expect(t).toContain(copy.types.notShared);
    expect(t).toContain(copy.scopeOnly.movies);
    expect(byLabel(`${copy.types.tv}: ${copy.types.notShared}`)).not.toHaveLength(0);
    expect(t).not.toContain("%61");
  });

  it("yalnız dizi paylaşılıyorsa film kutusu sönük", () => {
    mount({
      match: match({
        scope: "shows",
        byType: { movie: { shared: false, score: null, overlap: 0, mine: 0, theirs: 0 }, tv: typeInfo({ score: 66 }) },
      }),
    });
    expect(texts()).toContain(copy.scopeOnly.shows);
    expect(byLabel(`${copy.types.movie}: ${copy.types.notShared}`)).not.toHaveLength(0);
    expect(texts()).toContain("%66");
  });

  it("paylaşılan ama kaydı az kategori '–' ve 'Veri az' der, yüzde uydurmaz", () => {
    mount({ match: match({ byType: { movie: typeInfo({ score: 80 }), tv: typeInfo({ score: null, overlap: 0 }) } }) });
    expect(texts()).toContain("–");
    expect(texts()).toContain(copy.types.notEnough);
  });

  it("veri yokken (no-data) ya da hiçbir kategori açık değilken kutular çizilmez", () => {
    mount({ match: match({ state: "no-data", score: null, tier: null, components: [] }), noWatchedVisible: true });
    expect(texts()).not.toContain(copy.types.movie);
    act(() => renderer.unmount());
    mount({ match: match({ scope: "none" }) });
    expect(texts()).not.toContain(copy.types.movie);
  });

  it("eski biçimde (byType yok) çökmez ve kutu çizmez", () => {
    const legacy = match();
    delete legacy.byType;
    delete legacy.scope;
    mount({ match: legacy });
    expect(texts()).not.toContain(copy.types.movie);
    expect(texts()).toContain("%72");
  });
});

describe("'!' bilgi sayfası", () => {
  const open = () => act(() => pressable(copy.info.open).props.onPress());

  it("başta kapalı; düğmeye basınca neye göre belirlendiğini anlatır", () => {
    mount();
    expect(texts()).not.toContain(copy.info.title);
    open();
    const t = texts();
    expect(t).toContain(copy.info.title);
    expect(t).toContain(copy.info.intro);
    expect(t).toContain(copy.info.scopeBody);
    expect(t).toContain(copy.info.minBody(MIN_WATCHED_FOR_OVERLAP, MIN_RATED_PAIRS, MIN_FAVORITES));
  });

  it("ağırlıklar ve kademe aralıkları hesabın sabitlerinden okunur (elle yazılmaz)", () => {
    mount();
    open();
    const t = texts();
    expect(t).toContain(copy.percent(Math.round(WEIGHTS.genres * 100)));
    expect(t).toContain(copy.percent(Math.round(WEIGHTS.overlap * 100)));
    expect(t).toContain(copy.info.bonus); // ortak favori: bonus
    expect(t).toContain(`${copy.percent(75)}–${copy.percent(100)}`);
    expect(t).toContain(`${copy.percent(0)}–${copy.percent(34)}`);
    for (const id of ["veryHigh", "high", "medium", "low"]) expect(t).toContain(copy.tiers[id]);
  });

  it("veri yokken de bilgi düğmesi çalışır", () => {
    mount({ match: match({ state: "no-data", score: null, tier: null, components: [] }) });
    open();
    expect(texts()).toContain(copy.info.title);
  });
});

it("içgörüler: birlikte sevilen, ayrışılan ve tür eğilimi satırları", () => {
  mount({
    match: match({
      loved: [{ name: "Film 1", mine: 10, theirs: 9 }, { name: "Film 2", mine: 9, theirs: 9 }],
      split: { name: "Film 3", mine: 2, theirs: 9 },
      genres: { similarity: 0.9, shared: ["Drama"], comparable: true, lean: { mine: "Korku", theirs: "Komedi" } },
    }),
  });
  const t = texts();
  expect(t).toContain(copy.insights.loved("Film 1, Film 2"));
  expect(t).toContain(copy.insights.split("Film 3", 2, 9, "Ada"));
  expect(t).toContain(copy.insights.lean("Korku", "Komedi", "Ada"));
});

it("tür eğilimi tek yönlüyse tek cümle; içgörü yoksa kutu yok", () => {
  mount({ match: match({ genres: { similarity: 0.9, shared: ["Drama"], comparable: true, lean: { mine: null, theirs: "Komedi" } } }) });
  expect(texts()).toContain(copy.insights.leanTheirs("Komedi", "Ada"));
  act(() => renderer.unmount());
  mount();
  expect(texts().some((x) => x.startsWith("Eğilim") || x.startsWith("Ayrıştığınız"))).toBe(false);
});

it("ortak izlenen şeridi: afişler, iki tarafın puanı çipte; yalnız biri puanladıysa çip yok", () => {
  mount({
    match: match({
      highlights: [
        { key: "movie_1", id: 1, type: "movie", name: "Film 1", imagePath: "/m1.jpg", mine: 9, theirs: 8 },
        { key: "movie_2", id: 2, type: "movie", name: "Film 2", imagePath: "/m2.jpg", mine: null, theirs: 7 },
      ],
    }),
  });
  const t = texts();
  expect(t).toContain(copy.sharedTitle);
  expect(t).toContain("9 · 8");
  expect(t).not.toContain("null · 7");
  expect(byLabel(`Film 1. ${copy.ratingPair(9, 8)}`)).not.toHaveLength(0);
  expect(byLabel("Film 2")).not.toHaveLength(0);
});

it("veri yokken içgörü ve şerit çizilmez", () => {
  mount({
    match: match({
      state: "no-data",
      score: null,
      tier: null,
      components: [],
      loved: [{ name: "Film 1", mine: 10, theirs: 9 }],
      highlights: [{ key: "movie_1", id: 1, type: "movie", name: "Film 1", imagePath: "/m1.jpg", mine: 9, theirs: 8 }],
    }),
  });
  expect(texts()).not.toContain(copy.sharedTitle);
  expect(texts()).not.toContain(copy.insights.loved("Film 1"));
});

it("uyumu sohbete gönder düğmesi: yalnız arkadaşa ve puan varsa; basış iletilir", () => {
  const onShareMatch = jest.fn();
  mount({ onShareMatch });
  expect(pressable(copy.shareAction("Ada"))).toBeTruthy();
  act(() => pressable(copy.shareAction("Ada")).props.onPress());
  expect(onShareMatch).toHaveBeenCalledTimes(1);

  act(() => renderer.unmount());
  mount({ onShareMatch, canInvite: false }); // arkadaş değil
  expect(pressable(copy.shareAction("Ada"))).toBeUndefined();

  act(() => renderer.unmount());
  mount({ onShareMatch, match: match({ state: "no-data", score: null, tier: null, components: [] }) }); // puan yok
  expect(pressable(copy.shareAction("Ada"))).toBeUndefined();

  act(() => renderer.unmount());
  mount(); // işleyici verilmediyse
  expect(pressable(copy.shareAction("Ada"))).toBeUndefined();
});

it("birlikte izleyelim: ortak varsa 'iki listede', davet düğmesi basışı iletir", () => {
  const onInvite = mount();
  expect(texts()).toContain(copy.together.both(1));
  expect(inviteButton()).toBeTruthy();
  act(() => inviteButton().props.onPress());
  expect(onInvite).toHaveBeenCalledTimes(1);
});

it("ortak yok, yalnız tek taraflı adaylar: 'henüz izlemediği N aday'", () => {
  mount({ together: together([cand(1, "mine"), cand(2, "theirs")], { both: 0, mine: 1, theirs: 1 }) });
  expect(texts()).toContain(copy.together.mixed(2));
});

it("arkadaş değilse davet düğmesi yok, nedeni yazar", () => {
  mount({ canInvite: false });
  expect(inviteButton()).toBeUndefined();
  expect(texts()).toContain(copy.together.needFriend);
});

it("aday yoksa düğme yok, ipucu var", () => {
  mount({ together: together([], { both: 0, mine: 0, theirs: 0 }) });
  expect(inviteButton()).toBeUndefined();
  expect(texts()).toContain(copy.together.none);
  expect(texts()).toContain(copy.together.noneHint);
});

it("meşgulken düğme devre dışı", () => {
  mount({ inviteBusy: true });
  expect(inviteButton().props.disabled).toBe(true);
  expect(inviteButton().props.accessibilityState).toEqual({ disabled: true, busy: true });
});

it("veri yoksa yüzde ÇİZMEZ; gizliyse nedenini söyler", () => {
  mount({
    match: match({ state: "no-data", score: null, tier: null, favorites: null, ratings: { pairs: 0, agreement: null }, components: [] }),
    noWatchedVisible: true,
  });
  const t = texts();
  expect(t.some((x) => x.startsWith("%"))).toBe(false);
  expect(t).toContain(copy.title);
  expect(t).toContain(copy.noData.hidden("Ada"));
  expect(t).not.toContain(copy.parts.overlap); // sayı kutuları da gizlenir
});

it("yeterli kayıt yoksa 'biraz daha izleme kaydı' der", () => {
  mount({ match: match({ state: "no-data", score: null, tier: null, components: [] }), noWatchedVisible: false });
  expect(texts()).toContain(copy.noData.notEnough);
});

it("kısmi veride kısa 'yaklaşık' notu; arkadaşın listesi gizliyse bunu söyler", () => {
  mount({ match: match({ state: "limited" }), friendListHidden: true });
  expect(texts()).toContain(copy.limited);
  expect(texts()).toContain(copy.together.hiddenList("Ada"));
});

it("dili izler; yüzde biçimi dile göre (İngilizce 72%)", () => {
  mockLang = "en";
  mount();
  expect(texts()).toContain(TASTE_MATCH_COPY.en.tiers.high);
  expect(texts()).toContain("72%");
});

it("ortak tür / puan uyumu / favori yoksa o kutular çizilmez", () => {
  mount({ match: match({ genres: { similarity: null, shared: [], comparable: false, lean: { mine: null, theirs: null } }, ratings: { pairs: 0, agreement: null }, favorites: [] }) });
  const t = texts();
  expect(t).not.toContain("Drama");
  expect(t).not.toContain(copy.parts.ratings);
  expect(t).not.toContain(copy.parts.favorites);
  expect(t).toContain(copy.parts.overlap);
});

it("dökümsüz eski biçimde çubuk çizmez ama çökmez", () => {
  const legacy = match();
  delete legacy.breakdown;
  delete legacy.highlights;
  delete legacy.loved;
  delete legacy.split;
  delete legacy.genres.lean;
  mount({ match: legacy });
  expect(texts()).toContain(copy.parts.overlap);
});
