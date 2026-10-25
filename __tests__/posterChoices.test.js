// __tests__/posterChoices.test.js
//
// Özel afişler: saf kurallar (utils/posterChoices), yerel-öncelikli alan tanımı,
// kök sağlayıcının Premium kapısı (seç / varsayılana dön / tavan), arkadaş
// okumasının koşulları (sahibin planı + liste görünürlüğü) ve PosterImage'in
// seçimi çizmesi (kendi seçimin, PosterChoicesScope ile profil sahibinin seçimi).

import React from "react";
import { act, create } from "react-test-renderer";

global.IS_REACT_ACT_ENVIRONMENT = true;

let mockUser = { uid: "me" };
let mockPlan = "premium";
let mockStoredDoc = null;
const mockApply = jest.fn();
const mockFetch = jest.fn();

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, flatten: (s) => (Array.isArray(s) ? Object.assign({}, ...s) : s || {}) },
  View: "View",
}));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({ theme: { secondary: "#111", border: "#222", text: { muted: "#999" } } }),
}));
jest.mock("../context/AppSettingsContext", () => ({
  useImageQualitySettings: () => ({ getTmdbUrl: (p, type, w) => `tmdb:${type}:${w}:${p}` }),
}));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock("../context/PremiumContext", () => ({ usePremium: () => ({ plan: mockPlan }) }));
jest.mock("../hooks/useUserDataDomain", () => ({
  __esModule: true,
  default: () => ({ uid: "me", get: (kind, key) => (kind === "doc" && key === "all" ? mockStoredDoc : undefined) }),
}));
jest.mock("../services/userData", () => ({ posterChoicesDomain: { apply: (...a) => mockApply(...a) } }));
jest.mock("../services/posterChoicesService", () => ({
  fetchUserPosterChoices: (...a) => mockFetch(...a),
}));

const {
  MAX_POSTER_CHOICES,
  buildPosterChoicesDoc,
  CHOICE_KIND,
  choicesFromDoc,
  choicesOfKind,
  choiceSetFromDoc,
  EMPTY_CHOICE_SET,
  withChoiceSetKind,
  isValidPosterPath,
  orderGalleryForChoice,
  posterChoiceKey,
  resolvePosterPath,
  sanitizePosterChoices,
  withPosterChoice,
} = require("../utils/posterChoices");
const { posterChoicesSpec } = require("../services/userData/domains");
const {
  POSTER_CHOICE_RESULT,
  PosterChoicesScope,
  usePosterChoices,
} = require("../context/PosterChoicesContext");
const { PosterChoicesProvider, useUserPosterChoices } = require("../context/PosterChoicesProvider");
const PosterImage = require("../components/PosterImage").default;

const flush = () => act(async () => {});

beforeEach(() => {
  mockUser = { uid: "me" };
  mockPlan = "premium";
  mockStoredDoc = null;
  mockApply.mockReset();
  mockFetch.mockReset();
});

describe("saf kurallar", () => {
  test("anahtar: tür adları tek biçime iner, geçersiz kimlik reddedilir", () => {
    expect(posterChoiceKey("movie", 603)).toBe("movie_603");
    expect(posterChoiceKey("show", "1399")).toBe("tv_1399");
    expect(posterChoiceKey("tv", 0)).toBeNull();
    expect(posterChoiceKey("person", 5)).toBeNull();
    expect(posterChoiceKey("movie", "abc")).toBeNull();
  });

  test("yol süzgeci yalnız TMDB görsel yolunu kabul eder", () => {
    expect(isValidPosterPath("/kqjL17yufvn9OVLyXYpvtyrFfak.jpg")).toBe(true);
    expect(isValidPosterPath("https://evil.example/x.jpg")).toBe(false);
    expect(isValidPosterPath("/../../x.jpg")).toBe(false);
    expect(isValidPosterPath("/abc.exe")).toBe(false);
  });

  test("arkadaşın belgesinden gelen bozuk girdiler atılır", () => {
    const clean = sanitizePosterChoices({
      movie_1: "/good1.jpg",
      tv_2: "javascript:alert(1)",
      hack: "/good2.jpg",
      movie_3: 42,
    });
    expect(clean).toEqual({ movie_1: "/good1.jpg" });
    expect(Object.isFrozen(clean)).toBe(true);
    expect(choicesFromDoc(null)).toEqual({});
  });

  test("çözüm: seçim varsa o, yoksa çağıranın yolu", () => {
    const choices = { movie_603: "/mine.jpg" };
    expect(resolvePosterPath(choices, "movie", 603, "/tmdb.jpg")).toBe("/mine.jpg");
    expect(resolvePosterPath(choices, "tv", 603, "/tmdb.jpg")).toBe("/tmdb.jpg");
    expect(resolvePosterPath(choices, "movie", 1, null)).toBeNull();
  });

  test("seç / kaldır / değişmedi / tavan", () => {
    const one = withPosterChoice({}, "movie", 1, "/a1.jpg");
    expect(one).toEqual({ movie_1: "/a1.jpg" });
    expect(withPosterChoice(one, "movie", 1, "/a1.jpg")).toBe(one);
    expect(withPosterChoice(one, "movie", 1, null)).toEqual({});
    expect(withPosterChoice(one, "movie", 2, "bad")).toBeNull();

    const full = Object.fromEntries(
      Array.from({ length: MAX_POSTER_CHOICES }, (_, i) => [`movie_${i + 1}`, `/p${i + 1}.jpg`]),
    );
    expect(withPosterChoice(full, "movie", 9999, "/new1.jpg")).toBeNull();
    // Tavan doluyken VAR OLAN seçim değiştirilebilir
    expect(withPosterChoice(full, "movie", 1, "/new1.jpg").movie_1).toBe("/new1.jpg");
  });

  test("galeri sırası: seçili afiş başa alınır, yoksa eklenir", () => {
    const imgs = [{ file_path: "/a1.jpg" }, { file_path: "/b1.jpg" }, { file_path: "/c1.jpg" }];
    expect(orderGalleryForChoice(imgs, "/c1.jpg").map((i) => i.file_path)).toEqual(["/c1.jpg", "/a1.jpg", "/b1.jpg"]);
    expect(orderGalleryForChoice(imgs, "/z1.jpg")[0]).toEqual({ file_path: "/z1.jpg" });
    expect(orderGalleryForChoice(imgs, null)).toBe(imgs);
  });

  test("yerel alan: tek belge, tam belge yazımı", async () => {
    expect(posterChoicesSpec.kinds.doc.pathOf("u1", "all")).toBe("PosterChoices/u1");
    const remote = { fetchDoc: jest.fn().mockResolvedValue({ choices: { movie_1: "/a1.jpg" } }) };
    await expect(posterChoicesSpec.fetchCloud("u1", remote)).resolves.toEqual({
      doc: [{ choices: { movie_1: "/a1.jpg" }, id: "all" }],
    });
    remote.fetchDoc.mockResolvedValue(null);
    await expect(posterChoicesSpec.fetchCloud("u1", remote)).resolves.toEqual({ doc: [] });
    expect(
      buildPosterChoicesDoc({ posters: { movie_1: "/a1.jpg" }, backdrops: { tv_2: "/b2.jpg" } }, 5),
    ).toEqual({
      id: "all",
      choices: { movie_1: "/a1.jpg" },
      backdrops: { tv_2: "/b2.jpg" },
      updatedAt: 5,
    });
  });

  test("seçim kümesi: iki harita ayrı süzülür, boşsa ortak boş küme", () => {
    expect(choiceSetFromDoc(null)).toBe(EMPTY_CHOICE_SET);
    expect(choiceSetFromDoc({ choices: { movie_1: "/a1.jpg" } })).toEqual({
      posters: { movie_1: "/a1.jpg" },
      backdrops: {},
    });
    // Eski belge (arka plan alanı yok) bozulmadan okunur
    const set = choiceSetFromDoc({ choices: {}, backdrops: { movie_1: "/b1.jpg", bad: "/x.jpg" } });
    expect(choicesOfKind(set, CHOICE_KIND.BACKDROP)).toEqual({ movie_1: "/b1.jpg" });
    expect(choicesOfKind(set, CHOICE_KIND.POSTER)).toEqual({});
    // Değişmeyen harita aynı kümeyi döndürür (yazma yok)
    expect(withChoiceSetKind(set, CHOICE_KIND.BACKDROP, set.backdrops)).toBe(set);
    expect(withChoiceSetKind(set, CHOICE_KIND.BACKDROP, null)).toBe(set);
  });
});

function mountProvider() {
  const box = {};
  const Probe = () => {
    box.value = usePosterChoices();
    return null;
  };
  let tree;
  act(() => {
    tree = create(
      <PosterChoicesProvider>
        <Probe />
      </PosterChoicesProvider>,
    );
  });
  return { box, tree };
}

describe("kök sağlayıcı (Premium kapısı)", () => {
  test("Premium: kayıtlı seçim çizilir, yeni seçim yerel alana TAM belge olarak yazılır", () => {
    mockStoredDoc = { id: "all", choices: { movie_603: "/mine1.jpg" } };
    const { box } = mountProvider();
    expect(box.value.resolve("movie", 603, "/tmdb.jpg")).toBe("/mine1.jpg");
    expect(box.value.chosenFor("movie", 603)).toBe("/mine1.jpg");

    expect(box.value.choose("tv", 1399, "/got11.jpg")).toBe(POSTER_CHOICE_RESULT.OK);
    expect(mockApply).toHaveBeenCalledTimes(1);
    const [uid, changes] = mockApply.mock.calls[0];
    expect(uid).toBe("me");
    expect(changes[0].kind).toBe("doc");
    expect(changes[0].doc.choices).toEqual({ movie_603: "/mine1.jpg", tv_1399: "/got11.jpg" });

    expect(box.value.choose("movie", 603, "/mine1.jpg")).toBe(POSTER_CHOICE_RESULT.UNCHANGED);
    expect(box.value.choose("movie", 603, "nope")).toBe(POSTER_CHOICE_RESULT.FULL);
  });

  test("arka plan: afişten AYRI harita, aynı belgeye yazılır; afişe dokunmaz", () => {
    mockStoredDoc = { id: "all", choices: { movie_603: "/mine1.jpg" }, backdrops: { tv_1: "/bd1.jpg" } };
    const { box } = mountProvider();
    expect(box.value.resolveBackdrop("tv", 1, "/tmdbbd.jpg")).toBe("/bd1.jpg");
    expect(box.value.resolveBackdrop("movie", 603, "/tmdbbd.jpg")).toBe("/tmdbbd.jpg");
    expect(box.value.chosenFor("tv", 1, "backdrop")).toBe("/bd1.jpg");
    expect(box.value.chosenFor("tv", 1)).toBeNull();

    expect(box.value.choose("movie", 603, "/bd603.jpg", "backdrop")).toBe(POSTER_CHOICE_RESULT.OK);
    const doc = mockApply.mock.calls[0][1][0].doc;
    expect(doc.choices).toEqual({ movie_603: "/mine1.jpg" });
    expect(doc.backdrops).toEqual({ tv_1: "/bd1.jpg", movie_603: "/bd603.jpg" });

    expect(box.value.reset("tv", 1, "backdrop")).toBe(POSTER_CHOICE_RESULT.OK);
    const after = mockApply.mock.calls[1][1][0].doc;
    expect(after.backdrops).toEqual({});
    expect(after.choices).toEqual({ movie_603: "/mine1.jpg" });
  });

  test("Free: seçim SİLİNMEZ ama çizilmez; seçmek kilitli, varsayılana dönmek serbest", () => {
    mockPlan = "free";
    mockStoredDoc = { id: "all", choices: { movie_603: "/mine1.jpg" } };
    const { box } = mountProvider();
    expect(box.value.allowed).toBe(false);
    expect(box.value.resolve("movie", 603, "/tmdb.jpg")).toBe("/tmdb.jpg");
    expect(box.value.choose("movie", 1, "/a1.jpg")).toBe(POSTER_CHOICE_RESULT.LOCKED);
    expect(mockApply).not.toHaveBeenCalled();

    expect(box.value.reset("movie", 603)).toBe(POSTER_CHOICE_RESULT.OK);
    expect(mockApply.mock.calls[0][1][0].doc.choices).toEqual({});
  });

  test("oturum yoksa hiçbir şey yazılmaz", () => {
    mockUser = null;
    const { box } = mountProvider();
    expect(box.value.choose("movie", 1, "/a1.jpg")).toBe(POSTER_CHOICE_RESULT.SIGNED_OUT);
    expect(box.value.reset("movie", 1)).toBe(POSTER_CHOICE_RESULT.SIGNED_OUT);
    expect(mockApply).not.toHaveBeenCalled();
  });
});

describe("arkadaşın seçimleri", () => {
  function mountFriend(ownerUid, options) {
    const box = {};
    const Probe = () => {
      box.value = useUserPosterChoices(ownerUid, options);
      return null;
    };
    act(() => {
      create(
        <PosterChoicesProvider>
          <Probe />
        </PosterChoicesProvider>,
      );
    });
    return box;
  }

  test("sahibin planı Premium ve listeleri açıksa TEK okuma yapılır", async () => {
    const set = { posters: { movie_1: "/his1.jpg" }, backdrops: { movie_1: "/hisbd1.jpg" } };
    mockFetch.mockResolvedValue(set);
    const box = mountFriend("bob", { entitlements: { premium: true }, canRead: true });
    await flush();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith("bob");
    expect(box.value).toEqual(set);
  });

  test("Free sahip, gizli liste ya da kendi profilin: okuma YOK", async () => {
    mountFriend("bob", { entitlements: { premium: false }, canRead: true });
    mountFriend("bob", { entitlements: { premium: true }, canRead: false });
    mountFriend("me", { entitlements: { premium: true }, canRead: true });
    await flush();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("süresi dolmuş promosyon planı Free sayılır", async () => {
    mountFriend("bob", {
      entitlements: { premium: true, premiumSource: "promo", promoUntil: Date.now() - 1000 },
      canRead: true,
    });
    await flush();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("PosterImage", () => {
  const uriOf = (tree) => tree.root.findByType("Image").props.source.uri;

  test("mediaId verilince kendi seçimin; verilmezse TMDB yolu", () => {
    mockStoredDoc = { id: "all", choices: { movie_603: "/mine1.jpg" } };
    let tree;
    act(() => {
      tree = create(
        <PosterChoicesProvider>
          <PosterImage path="/tmdb.jpg" type="movie" mediaId={603} size={120} />
        </PosterChoicesProvider>,
      );
    });
    expect(uriOf(tree)).toBe("tmdb:poster:120:/mine1.jpg");

    act(() => {
      tree.update(
        <PosterChoicesProvider>
          <PosterImage path="/tmdb.jpg" type="movie" size={120} />
        </PosterChoicesProvider>,
      );
    });
    expect(uriOf(tree)).toBe("tmdb:poster:120:/tmdb.jpg");
  });

  test("PosterChoicesScope: profil sahibinin seçimi önce, yoksa izleyenin seçimi, o da yoksa varsayılan", () => {
    mockStoredDoc = { id: "all", choices: { movie_1: "/mine1.jpg", movie_2: "/mine2.jpg" } };
    const friend = Object.freeze({ posters: { movie_1: "/his1.jpg" }, backdrops: {} });
    let tree;
    act(() => {
      tree = create(
        <PosterChoicesProvider>
          <PosterChoicesScope choices={friend}>
            <PosterImage path="/t1.jpg" type="movie" mediaId={1} testID="a" />
            <PosterImage path="/t2.jpg" type="movie" mediaId={2} testID="b" />
            <PosterImage path="/t3.jpg" type="movie" mediaId={3} testID="c" />
          </PosterChoicesScope>
        </PosterChoicesProvider>,
      );
    });
    const uris = tree.root.findAllByType("Image").map((n) => n.props.source.uri);
    expect(uris).toEqual([
      "tmdb:poster:200:/his1.jpg",
      "tmdb:poster:200:/mine2.jpg",
      "tmdb:poster:200:/t3.jpg",
    ]);
  });

  test("sağlayıcı dışında düz geçiş (açılış ekranı vb.)", () => {
    let tree;
    act(() => {
      tree = create(<PosterImage path="/t1.jpg" type="movie" mediaId={1} />);
    });
    expect(uriOf(tree)).toBe("tmdb:poster:200:/t1.jpg");
  });
});

describe("useBackdropUri", () => {
  const useBackdropUri = require("../hooks/useBackdropUri").default;

  test("kendi seçimin, PosterChoicesScope içinde profil sahibinin seçimi; yoksa TMDB", () => {
    mockStoredDoc = { id: "all", choices: {}, backdrops: { movie_1: "/mybd1.jpg", movie_2: "/mybd2.jpg" } };
    const out = {};
    const Probe = ({ name }) => {
      const backdropUri = useBackdropUri();
      out[name] = [1, 2, 3].map((id) => backdropUri("movie", id, `/t${id}.jpg`, 780));
      return null;
    };
    act(() => {
      create(
        <PosterChoicesProvider>
          <Probe name="own" />
          <PosterChoicesScope choices={{ posters: {}, backdrops: { movie_1: "/hisbd1.jpg" } }}>
            <Probe name="friend" />
          </PosterChoicesScope>
        </PosterChoicesProvider>,
      );
    });
    expect(out.own).toEqual([
      "tmdb:backdrop:780:/mybd1.jpg",
      "tmdb:backdrop:780:/mybd2.jpg",
      "tmdb:backdrop:780:/t3.jpg",
    ]);
    expect(out.friend).toEqual([
      "tmdb:backdrop:780:/hisbd1.jpg",
      "tmdb:backdrop:780:/mybd2.jpg",
      "tmdb:backdrop:780:/t3.jpg",
    ]);
  });

  test("Free planda kayıtlı arka plan çizilmez", () => {
    mockPlan = "free";
    mockStoredDoc = { id: "all", backdrops: { movie_1: "/mybd1.jpg" } };
    let uri;
    const Probe = () => {
      uri = useBackdropUri()("movie", 1, "/t1.jpg");
      return null;
    };
    act(() => {
      create(
        <PosterChoicesProvider>
          <Probe />
        </PosterChoicesProvider>,
      );
    });
    expect(uri).toBe("tmdb:backdrop:1000:/t1.jpg");
  });
});
