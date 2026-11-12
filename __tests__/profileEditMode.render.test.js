import React from "react";
import { act, create } from "react-test-renderer";
import { StyleSheet, View } from "react-native";

// Profil önizlemesinin DÜZENLEME MODU parçaları (9 Kas kullanıcı kararı: ayrı
// "Profili Düzenle" ekranı yerine arkadaşın gördüğü düzen yerinde düzenlenir,
// UI aynı kalır). Bu test neyin çizildiğini ve dokunuşların neyi çağırdığını
// kilitler; görsel düzen cihazda görülür.
//   • Hero: ad / kullanıcı adı / hakkında aynı stilde TextInput'a döner.
//   • Sosyal şerit: sekiz platformun hepsi; bağlı olmayan soluk; dokununca
//     altında kayıtlı değerle dolu alan açılır.
//   • Vitrin rozetleri: 6 yuva — dolu yuvada ×, boşta +.
//   • Favoriler: üç kategori; dolu yuvada ×, boşta + (seçiciyi açar).

jest.mock("react-native", () => {
  const React = require("react");
  class Value {
    constructor(v) { this.v = v; }
    interpolate() { return this; }
  }
  return {
    View: "View",
    Text: "Text",
    TextInput: "TextInput",
    Pressable: "Pressable",
    TouchableOpacity: "TouchableOpacity",
    StyleSheet: {
      create: (s) => s,
      hairlineWidth: 1,
      absoluteFill: { position: "absolute" },
      flatten: (s) => Object.assign({}, ...[s].flat(Infinity).filter(Boolean)),
    },
    Animated: {
      Value,
      View: ({ children, ...rest }) => React.createElement("AnimatedView", rest, children),
      timing: () => ({ start: () => {} }),
    },
  };
});
jest.mock("../components/typography/AppText", () => ({ AppText: "Text", AppTextInput: "TextInput" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("../components/profile/StatsComponents", () => ({ withAlpha: (c) => c }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Ionicons" }));
jest.mock("@expo/vector-icons/FontAwesome6", () => ({ __esModule: true, default: "FA6" }));
jest.mock("@expo/vector-icons/MaterialCommunityIcons", () => ({ __esModule: true, default: "MCI" }));
jest.mock("@expo/vector-icons/Feather", () => ({ __esModule: true, default: "Feather" }));
jest.mock("../components/BackButton", () => ({ __esModule: true, default: "BackButton" }));
jest.mock("../components/common/UserAvatar", () => ({ __esModule: true, default: "UserAvatar" }));
jest.mock("../components/profile/ProfileAvatarHalo", () => ({ __esModule: true, default: "ProfileAvatarHalo" }));
jest.mock("../components/common/GlassIconButton", () => ({ __esModule: true, default: "GlassIconButton" }));
jest.mock("../components/common/GlassBox", () => {
  const React = require("react");
  return { __esModule: true, default: ({ children, ...rest }) => React.createElement("GlassBox", rest, children) };
});
jest.mock("../components/common/GlassPressable", () => ({ __esModule: true, default: "GlassPressable" }));
jest.mock("../components/common/GlassTouchable", () => ({ __esModule: true, default: "GlassTouchable" }));
jest.mock("../components/badges/IdentityBadgesRow", () => ({ __esModule: true, default: "IdentityBadges" }));
jest.mock("../components/badges/AppBadge", () => ({ __esModule: true, default: "AppBadge" }));
jest.mock("../components/AppIcon", () => ({ __esModule: true, default: "AppIcon" }));
jest.mock("../components/friends/PillButton", () => ({ __esModule: true, default: "PillButton" }));
jest.mock("../components/profile/SocialLinksRow", () => ({ __esModule: true, default: "SocialLinksRow" }));
jest.mock("../components/favorites/FavoriteArt", () => ({ __esModule: true, default: "FavoriteArt" }));
jest.mock("../components/favorites/FavoritePickerSheet", () => ({ __esModule: true, default: "FavoritePickerSheet" }));
jest.mock("../components/profile/ProfileBannerBackdrop", () => ({ __esModule: true, default: "ProfileBannerBackdrop" }));
jest.mock("../components/auth/AuthKit", () => {
  const React = require("react");
  return {
    AuthPressable: ({ children, containerStyle, ...rest }) =>
      React.createElement("AuthPressable", rest, children),
  };
});
jest.mock("../services/hapticsService", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));
jest.mock("../utils/i18nText", () => ({ i18nText: (_key, fallback) => fallback }));

const mockTheme = {
  primary: "#111111", secondary: "#1b1b1b", border: "#333333", accent: "#3388ff",
  text: { primary: "#ffffff", secondary: "#bbbbbb", muted: "#888888" },
  colors: { red: "#e11", green: "#1e1" },
};
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));

const { ProfileHero } = require("../components/friends/FriendProfileSections");
const SocialLinksEditRow = require("../components/profile/SocialLinksEditRow").default;
const { FriendBadgeShowcase } = require("../components/badges/BadgeShowcaseCard");
const FavoritesShowcase = require("../components/favorites/FavoritesShowcase").default;
const { SOCIAL_PLATFORMS } = require("../utils/socialLinks");

global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer;
let consoleError;
beforeEach(() => {
  jest.clearAllMocks();
  const original = console.error;
  consoleError = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
});
afterEach(async () => {
  if (renderer) await act(() => renderer.unmount());
  renderer = null;
  consoleError.mockRestore();
});

const mount = async (el) => {
  await act(() => { renderer = create(el); });
};
const byTestId = (id) => renderer.root.findAll((n) => n.props?.testID === id && typeof n.type === "string");
const flat = (style) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
// Pressable'ın stil işlevi basılı değilken çözülür.
const pressableStyle = (node) => flat(typeof node.props.style === "function" ? node.props.style({ pressed: false }) : node.props.style);
const texts = () => renderer.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));

const heroBase = {
  avatarIndex: 3, photoURL: null, name: "Ali Veli", username: "aliveli",
  badges: [], language: "tr", bio: "Film delisi", socialLinks: { instagram: "ali" }, memberSince: null,
};

describe("ProfileHero", () => {
  it("arkadaş görünümünde yuvarlak seviye halkasını ve seri alevini gösterir", async () => {
    await mount(<ProfileHero {...heroBase} avatarProgress={{ progress: 42, borderColor: "#123456", borderColor2: "#abcdef" }} streak={<View testID="friend-streak">🔥 3</View>} />);
    const halo = renderer.root.findByType("ProfileAvatarHalo");
    expect(halo.props.progress).toBe(42);
    expect(halo.props.avatarIndex).toBe(3);
    expect(halo.props.ringHidden).toBe(false);
    expect(byTestId("friend-streak")).toHaveLength(1);
  });

  it("salt-okumada ad / kullanıcı adı / hakkında metin olarak çizilir", async () => {
    await mount(<ProfileHero {...heroBase} />);
    expect(renderer.root.findAllByType("TextInput")).toHaveLength(0);
    expect(texts()).toEqual(expect.arrayContaining(["Ali Veli", "@aliveli", "Film delisi"]));
    expect(renderer.root.findAllByType("SocialLinksRow")).toHaveLength(1);
  });

  it("düzenleme modunda aynı alanlar yazılabilir olur ve taslağa yazar", async () => {
    const editor = {
      name: "Ali Veli", onChangeName: jest.fn(), namePlaceholder: "Adın", nameMax: 40,
      username: "aliveli", onChangeUsername: jest.fn(), usernameMax: 20,
      usernameHint: { tone: "error", text: "Bu kullanıcı adı alınmış" },
      bio: "", onChangeBio: jest.fn(), bioPlaceholder: "Kendinden bahset…", bioMax: 160,
      socialDraft: { instagram: "ali" }, socialInvalid: [], onChangeSocial: jest.fn(),
      avatarHint: "Avatarı değiştir",
    };
    await mount(<ProfileHero {...heroBase} editor={editor} />);
    const [name] = byTestId("profile-edit-name");
    const [username] = byTestId("profile-edit-username");
    const [bio] = byTestId("profile-edit-bio");
    expect(name.props.value).toBe("Ali Veli");
    expect(name.props.maxLength).toBe(40);
    expect(username.props.value).toBe("aliveli");
    expect(username.props.autoCapitalize).toBe("none");
    // Boş hakkında yine çizilir (yazılabilsin); yer tutucu görünür.
    expect(bio.props.value).toBe("");
    expect(bio.props.placeholder).toBe("Kendinden bahset…");
    // Ad alanı formun en belirgini: kalın, büyük yazı; sayaç etiket satırında.
    expect(flat(name.props.style).fontSize).toBe(20);
    expect(texts()).toContain("8/40");
    expect(texts()).toContain("Bu kullanıcı adı alınmış");
    expect(flat(byTestId("profile-edit-username-hint")[0].props.style).color).toBe("#e11");

    await act(() => name.props.onChangeText("Ali V."));
    await act(() => username.props.onChangeText("yeni"));
    await act(() => bio.props.onChangeText("Merhaba"));
    expect(editor.onChangeName).toHaveBeenCalledWith("Ali V.");
    expect(editor.onChangeUsername).toHaveBeenCalledWith("yeni");
    expect(editor.onChangeBio).toHaveBeenCalledWith("Merhaba");
    // Salt-okuma şeridinin yerine düzenleme şeridi gelir.
    expect(renderer.root.findAllByType("SocialLinksRow")).toHaveLength(0);
    expect(byTestId("social-edit-instagram")).toHaveLength(1);
  });
});

describe("SocialLinksEditRow", () => {
  it("sekiz platformun hepsi çizilir; bağlı olmayan soluk", async () => {
    await mount(
      <SocialLinksEditRow draft={{ instagram: "ali" }} invalid={[]} onChange={jest.fn()} theme={mockTheme} language="tr" />,
    );
    SOCIAL_PLATFORMS.forEach((p) => expect(byTestId(`social-edit-${p.key}`)).toHaveLength(1));
    expect(pressableStyle(byTestId("social-edit-instagram")[0]).opacity).toBe(1);
    const other = SOCIAL_PLATFORMS.find((p) => p.key !== "instagram").key;
    expect(pressableStyle(byTestId(`social-edit-${other}`)[0]).opacity).toBeLessThan(0.5);
    expect(byTestId("social-edit-input")).toHaveLength(0);
  });

  it("ikona dokununca altında kayıtlı değerle dolu alan açılır; yeniden dokununca kapanır", async () => {
    const onChange = jest.fn();
    await mount(
      <SocialLinksEditRow draft={{ instagram: "ali" }} invalid={[]} onChange={onChange} theme={mockTheme} language="tr" />,
    );
    await act(() => byTestId("social-edit-instagram")[0].props.onPress());
    const [input] = byTestId("social-edit-input");
    expect(input.props.value).toBe("ali");
    await act(() => input.props.onChangeText("instagram.com/Ali.Veli "));
    expect(onChange).toHaveBeenCalledWith("instagram", expect.any(String));

    // Bağlı olmayan platform: boş alan, seçilince renklenir.
    const other = SOCIAL_PLATFORMS.find((p) => p.key !== "instagram").key;
    await act(() => byTestId(`social-edit-${other}`)[0].props.onPress());
    expect(byTestId("social-edit-input")[0].props.value).toBe("");
    expect(pressableStyle(byTestId(`social-edit-${other}`)[0]).opacity).toBe(1);
    await act(() => byTestId(`social-edit-${other}`)[0].props.onPress());
    expect(byTestId("social-edit-input")).toHaveLength(0);
  });

  it("geçersiz işaretli platform kırmızı çerçeveli", async () => {
    await mount(
      <SocialLinksEditRow draft={{ instagram: "a b" }} invalid={["instagram"]} onChange={jest.fn()} theme={mockTheme} language="tr" />,
    );
    expect(pressableStyle(byTestId("social-edit-instagram")[0]).borderColor).toBe("#e5484d");
  });
});

describe("FriendBadgeShowcase", () => {
  const badge = (id) => ({ id, icon: "star-outline", iconSolid: "star", rarity: "common", tier: 0, aileToplam: 0, tr: id, en: id });

  it("salt-okumada boş vitrin çizilmez", async () => {
    await mount(<FriendBadgeShowcase badges={[]} />);
    expect(renderer.toJSON()).toBeNull();
  });

  it("düzenleme modunda 6 yuva: dolularda ×, boşlarda +", async () => {
    const onRemoveBadge = jest.fn();
    const onPressEmpty = jest.fn();
    await mount(
      <FriendBadgeShowcase badges={[badge("ilk_kare")]} editing onRemoveBadge={onRemoveBadge} onPressEmpty={onPressEmpty} />,
    );
    const remove = renderer.root.findAll(
      (n) => n.type === "TouchableOpacity" && String(n.props.accessibilityLabel || "").includes("vitrinden çıkar"),
    );
    const empty = renderer.root.findAll(
      (n) => n.type === "TouchableOpacity" && n.props.accessibilityLabel === "Rozet Seç",
    );
    expect(remove).toHaveLength(1);
    expect(empty).toHaveLength(5);
    await act(() => remove[0].props.onPress());
    expect(onRemoveBadge).toHaveBeenCalledWith(expect.objectContaining({ id: "ilk_kare" }));
    await act(() => empty[0].props.onPress());
    expect(onPressEmpty).toHaveBeenCalled();
  });

  it("dar ekranda 6 rozet yatay sığar, 4 rozet ortalanır", async () => {
    await mount(<FriendBadgeShowcase badges={Array.from({ length: 6 }, (_, i) => badge(`badge_${i}`))} />);
    const row = renderer.root.findAll((n) => n.type === "View" && typeof n.props.onLayout === "function")[0];
    await act(() => row.props.onLayout({ nativeEvent: { layout: { width: 280 } } }));
    const tiles = renderer.root.findAll((n) => n.type === "TouchableOpacity" && String(n.props.accessibilityLabel).includes("badge_"));
    expect(tiles).toHaveLength(6);
    const widths = tiles.map((tile) => StyleSheet.flatten(tile.props.style).width);
    expect(widths.reduce((sum, width) => sum + width, 0) + 5 * 7).toBeLessThanOrEqual(280);

    await mount(<FriendBadgeShowcase badges={Array.from({ length: 4 }, (_, i) => badge(`badge_${i}`))} />);
    const fourRow = renderer.root.findAll((n) => n.type === "View" && typeof n.props.onLayout === "function")[0];
    expect(StyleSheet.flatten(fourRow.props.style).justifyContent).toBe("center");
  });
});

describe("FavoritesShowcase", () => {
  const film = (id) => ({ id, title: `Film ${id}`, image: `/f${id}.jpg` });
  // FavoriteSlots yuvaları satır ölçülünce çizer.
  const measure = async () => {
    const rows = renderer.root.findAll((n) => n.type === "View" && typeof n.props.onLayout === "function");
    await act(() => rows.forEach((r) => r.props.onLayout({ nativeEvent: { layout: { width: 260 } } })));
  };

  it("salt-okumada yalnız dolu kategoriler, × / + yok", async () => {
    await mount(<FavoritesShowcase favorites={{ movies: [film(1)], shows: [], people: [] }} navigation={{}} />);
    await measure();
    expect(renderer.root.findAll((n) => n.type === "AuthPressable" && String(n.props.accessibilityLabel).includes("kaldır"))).toHaveLength(0);
    expect(renderer.root.findAllByType("FavoritePickerSheet")).toHaveLength(0);
  });

  it("düzenleme modunda üç kategori, dolu yuvada ×, boş yuvaya dokununca seçici o kategoride açılır", async () => {
    const onChange = jest.fn();
    await mount(
      <FavoritesShowcase favorites={{ movies: [film(1)], shows: [], people: [] }} navigation={{}} editing onChange={onChange} />,
    );
    await measure();
    const removes = renderer.root.findAll((n) => n.type === "AuthPressable" && String(n.props.accessibilityLabel).includes("kaldır"));
    expect(removes).toHaveLength(1);
    // 3 kategori × 4 yuva − 1 dolu = 11 boş yuva.
    const adds = renderer.root.findAll(
      (n) => n.type === "AuthPressable" && typeof n.props.accessibilityLabel === "string" && / ekle$/.test(n.props.accessibilityLabel),
    );
    expect(adds).toHaveLength(11);

    await act(() => removes[0].props.onPress());
    expect(onChange).toHaveBeenCalledWith({ movies: [], shows: [], people: [] });

    const showAdd = adds.find((n) => n.props.accessibilityLabel === "Dizi ekle");
    await act(() => showAdd.props.onPress());
    const picker = renderer.root.findByType("FavoritePickerSheet");
    expect(picker.props.visible).toBe(true);
    expect(picker.props.kind).toBe("shows");
  });
});
