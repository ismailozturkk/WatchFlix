// __tests__/followPersonButton.test.js
//
// Kişi sayfasındaki "Takip et" hapı + "Takip ettiklerim" sayfası + useFollowedPeople kancasının
// BAĞLANTISI, GERÇEK depoyla (bellek-içi MMKV). Görsel parçalar taklit edilir; props'ları
// doğrudan okunup tetiklenir.

import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, absoluteFillObject: {}, hairlineWidth: 1 },
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  FlatList: ({ data, renderItem, keyExtractor }) =>
    require("react").createElement(
      "FlatList",
      null,
      data.map((item) =>
        require("react").createElement("Item", { key: keyExtractor(item) }, renderItem({ item })),
      ),
    ),
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("expo-image", () => ({ Image: "Image" }));
const mockHost = (name) => ({
  __esModule: true,
  default: ({ children, ...props }) => require("react").createElement(name, props, children),
});
jest.mock("../components/common/GlassCloseButton", () => mockHost("CloseButton"));
jest.mock("../components/common/BottomSheetModal", () => ({
  __esModule: true,
  default: ({ visible, children }) => (visible ? children : null),
}));

const mockToast = { success: jest.fn(), warning: jest.fn(), undo: jest.fn() };
jest.mock("../components/AppToast", () => ({ toast: mockToast }));
const mockTrack = jest.fn();
jest.mock("../services/analytics", () => ({
  ANALYTICS_EVENTS: { PERSON_FOLLOW: "person_follow" },
  trackEvent: (...args) => mockTrack(...args),
}));
const mockHaptic = jest.fn();
jest.mock("../services/hapticsService", () => ({ triggerHaptic: (...args) => mockHaptic(...args) }));

let mockLang = "tr";
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: mockLang }) }));
const mockTheme = {
  primary: "#111111", secondary: "#1b1b1b", border: "#333333", accent: "#3388ff",
  text: { primary: "#ffffff", secondary: "#bbbbbb", muted: "#888888" },
};
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "u1" } }) }));
jest.mock("../context/AppSettingsContext", () => ({
  useImageQualitySettings: () => ({ getTmdbUrl: (path) => `https://img${path}` }),
}));

const { __resetAllMMKV } = require("react-native-mmkv");
const { Keys, get } = require("../services/storage");
const { __resetStoreCaches } = require("../services/storage/store");
const { __resetStores } = require("../services/storage/instances");
const FollowPersonButton = require("../components/person/FollowPersonButton").default;
const FollowedPeopleSheet = require("../components/person/FollowedPeopleSheet").default;
const { MAX_FOLLOWED, normalizeFollowed } = require("../utils/followedPeople");
const { FOLLOWED_PEOPLE_COPY } = require("../utils/followedPeopleCopy");

global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer;
let warn;
const stored = () => normalizeFollowed(get(Keys.followedPeople, { uid: "u1" }));
const actor = { id: 31, name: "Ada Demir", profile_path: "/ada.jpg", known_for_department: "Acting" };

beforeEach(() => {
  __resetStores();
  __resetAllMMKV();
  __resetStoreCaches();
  Object.values(mockToast).forEach((fn) => fn.mockClear());
  mockTrack.mockClear();
  mockHaptic.mockClear();
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

const mount = (element) => {
  act(() => {
    renderer = create(element);
  });
  return renderer;
};
const button = () => renderer.root.findByType("Pressable");
const labelText = () => renderer.root.findByType("Text").props.children;
const press = (node) => act(() => node.props.onPress());

describe("Takip et hapı", () => {
  it("takipte değilken 'Takip et' der; basınca kaydeder, etiketi 'Takipte'ye çevirir", () => {
    mount(<FollowPersonButton person={actor} />);
    expect(labelText()).toBe(FOLLOWED_PEOPLE_COPY.tr.button.follow);
    expect(button().props.accessibilityLabel).toBe(FOLLOWED_PEOPLE_COPY.tr.button.followLabel("Ada Demir"));

    press(button());

    expect(stored()["31"]).toMatchObject({ id: 31, name: "Ada Demir", photo: "/ada.jpg", department: "Acting" });
    expect(labelText()).toBe(FOLLOWED_PEOPLE_COPY.tr.button.following);
    expect(button().props.accessibilityState).toEqual({ selected: true });
    expect(mockToast.success).toHaveBeenCalledWith(
      FOLLOWED_PEOPLE_COPY.tr.toast.followed("Ada Demir"),
      FOLLOWED_PEOPLE_COPY.tr.toast.followedHint,
    );
    expect(mockHaptic).toHaveBeenCalledWith("success");
    // Ölçüm: kişinin adı/kimliği ASLA gönderilmez.
    expect(mockTrack).toHaveBeenCalledWith("person_follow", { action: "follow", source: "profile", department: "Acting" });
    expect(JSON.stringify(mockTrack.mock.calls)).not.toContain("Ada");
  });

  it("ikinci basış takibi bırakır; toast'taki Geri Al kişiyi geri getirir", () => {
    mount(<FollowPersonButton person={actor} />);
    press(button());
    press(button());

    expect(stored()).toEqual({});
    expect(get(Keys.followedPeople, { uid: "u1" })).toBeNull(); // boşken anahtar silinir
    expect(labelText()).toBe(FOLLOWED_PEOPLE_COPY.tr.button.follow);
    expect(mockTrack).toHaveBeenLastCalledWith("person_follow", { action: "unfollow", source: "profile", department: "Acting" });

    const [title, onUndo] = mockToast.undo.mock.calls[0];
    expect(title).toBe(FOLLOWED_PEOPLE_COPY.tr.toast.unfollowed("Ada Demir"));
    act(() => onUndo());
    expect(stored()["31"]).toBeDefined();
    expect(labelText()).toBe(FOLLOWED_PEOPLE_COPY.tr.button.following);
  });

  it("sınır dolunca takip ETMEZ ve nedenini söyler", () => {
    const { followPerson } = require("../utils/followedPeople");
    const { set } = require("../services/storage");
    let full = {};
    for (let i = 1; i <= MAX_FOLLOWED; i += 1) full = followPerson(full, { id: i, name: `K${i}` }, i).followed;
    set(Keys.followedPeople, full, { uid: "u1" });

    // 31 numaralı kişi zaten dolu listede olurdu (basış takibi BIRAKIRDI): dışarıdan biri.
    mount(<FollowPersonButton person={{ ...actor, id: 999 }} />);
    press(button());

    expect(stored()["999"]).toBeUndefined();
    expect(Object.keys(stored())).toHaveLength(MAX_FOLLOWED);
    expect(mockToast.warning).toHaveBeenCalledWith(
      FOLLOWED_PEOPLE_COPY.tr.toast.limit(MAX_FOLLOWED),
      FOLLOWED_PEOPLE_COPY.tr.toast.limitHint,
    );
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it("kimliği ya da adı olmayan kişide hiçbir şey çizmez", () => {
    mount(<FollowPersonButton person={{ id: 5 }} />);
    expect(renderer.toJSON()).toBeNull();
  });

  it("dili izler (İngilizce)", () => {
    mockLang = "en";
    mount(<FollowPersonButton person={actor} />);
    expect(labelText()).toBe("Follow");
  });
});

describe("Takip ettiklerim sayfası", () => {
  const seed = () => {
    const { followPerson } = require("../utils/followedPeople");
    const { set } = require("../services/storage");
    let map = followPerson({}, { id: 1, name: "Ada", known_for_department: "Acting", profile_path: "/a.jpg" }, 10).followed;
    map = followPerson(map, { id: 2, name: "Bora", known_for_department: "Directing" }, 20).followed;
    set(Keys.followedPeople, map, { uid: "u1" });
  };

  it("kişileri en yeni takip üstte listeler, sayıyı ve bölüm etiketini gösterir", () => {
    seed();
    mount(<FollowedPeopleSheet visible onClose={() => {}} navigation={{ navigate: jest.fn() }} />);
    const texts = renderer.root.findAllByType("Text").map((node) => node.props.children);
    expect(texts).toEqual(
      expect.arrayContaining([
        FOLLOWED_PEOPLE_COPY.tr.sheet.title,
        FOLLOWED_PEOPLE_COPY.tr.sheet.count(2, MAX_FOLLOWED),
        "Bora",
        "Yönetmen",
        "Ada",
        "Oyuncu",
      ]),
    );
    expect(texts.indexOf("Bora")).toBeLessThan(texts.indexOf("Ada"));
  });

  it("satıra basınca sayfayı kapatıp kişi sayfasını açar", () => {
    seed();
    const navigate = jest.fn();
    const onClose = jest.fn();
    mount(<FollowedPeopleSheet visible onClose={onClose} navigation={{ navigate }} />);
    const open = renderer.root
      .findAllByType("Pressable")
      .find((node) => node.props.accessibilityLabel === FOLLOWED_PEOPLE_COPY.tr.sheet.open("Ada"));
    press(open);
    expect(onClose).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("ActorViewScreen", { personId: 1 });
  });

  it("takipten çıkarır (onaysız) ve Geri Al sunar", () => {
    seed();
    mount(<FollowedPeopleSheet visible onClose={() => {}} navigation={{ navigate: jest.fn() }} />);
    const unfollow = renderer.root
      .findAllByType("Pressable")
      .find((node) => node.props.accessibilityLabel === FOLLOWED_PEOPLE_COPY.tr.sheet.unfollowLabel("Ada"));
    press(unfollow);
    expect(stored()["1"]).toBeUndefined();
    expect(stored()["2"]).toBeDefined();
    expect(mockTrack).toHaveBeenCalledWith("person_follow", { action: "unfollow", source: "sheet", department: "Acting" });

    act(() => mockToast.undo.mock.calls[0][1]());
    expect(stored()["1"]).toMatchObject({ name: "Ada", photo: "/a.jpg", department: "Acting" });
  });

  it("kimse yokken boş durumu söyler", () => {
    mount(<FollowedPeopleSheet visible onClose={() => {}} navigation={{ navigate: jest.fn() }} />);
    const texts = renderer.root.findAllByType("Text").map((node) => node.props.children);
    expect(texts).toContain(FOLLOWED_PEOPLE_COPY.tr.sheet.empty);
  });

  it("kapalıyken hiçbir şey çizmez", () => {
    seed();
    mount(<FollowedPeopleSheet visible={false} onClose={() => {}} navigation={{ navigate: jest.fn() }} />);
    expect(renderer.toJSON()).toBeNull();
  });
});
