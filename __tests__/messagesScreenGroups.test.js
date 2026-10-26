import React from "react";
import { act, create } from "react-test-renderer";
import MessagesScreen from "../screens/chat/MessagesScreen";

// Mesajlar ekranında GRUP satırı, 1-1 satırıyla aynı "yeni mesaj" görünümünü
// taşımalı: satır vurgusu, kalın ad/önizleme, vurgulu saat ve sağda okunmamış
// sayısı rozeti; ayrıca "Gruplar" sekmesinde toplam rozeti ve başlıkta
// "N okunmamış mesaj". Eskiden grup satırı hiçbir okunmamış durumu göstermiyordu
// çünkü gruplarda sayaç hiç tutulmuyordu. Sayaç artık kullanıcının kendi gelen
// kutusunda (Users/{uid}/groupInbox/{groupId}); grup belgesindeki eski
// `unread` haritası OKUNMAZ.
//
// Bu test ekranın BAĞLANTISINI kilitler (hangi props nereye gider). Çizimin
// kendisi (renk, yerleşim) components/friends/PersonRow'dadır ve cihazda görülür.

jest.mock("react-native", () => {
  const React = require("react");
  return {
    View: "View",
    Text: "Text",
    StyleSheet: { create: (s) => s },
    FlatList: ({ data, renderItem, keyExtractor }) =>
      React.createElement(
        "List",
        null,
        data.map((item, index) =>
          React.createElement(React.Fragment, { key: keyExtractor(item) }, renderItem({ item, index })),
        ),
      ),
  };
});
// Babel eklentisi (scripts/babel-transform-app-text.js) `Text`'i AppText'e çevirir.
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeArea" }));

// getAuth() gerçekte SABİT bir nesne döndürür; her çağrıda yeni `user` verirsek
// ekranın `[user]` bağımlı efektleri her render'da yeniden çalışıp döngüye girer.
const mockAuth = { currentUser: { uid: "me" } };
jest.mock("firebase/auth", () => ({ getAuth: () => mockAuth }));
jest.mock("firebase/firestore", () => ({
  collection: (...path) => path.join("/"),
  onSnapshot: (_ref, next) => {
    next({ docs: [] });
    return () => {};
  },
}));
jest.mock("../firebase", () => ({ db: {} }));

const mockTheme = { primary: "#111111", accent: "#3388ff" };
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock("../context/FriendsContext", () => ({ useFriends: () => ({ isBlocked: () => false }) }));

jest.mock("../components/ScreenDecor", () => ({ __esModule: true, default: "Decor" }));
jest.mock("../components/chat/GroupAvatar", () => ({ __esModule: true, default: "GroupAvatar" }));
jest.mock("../components/chat/ChatCreateFab", () => ({ __esModule: true, default: "Fab" }));
jest.mock("../components/chat/NewConversationSheet", () => ({ __esModule: true, default: "NewSheet" }));
jest.mock("../components/friends/FriendsScreenHeader", () => ({ __esModule: true, default: "Header" }));
jest.mock("../components/friends/FriendsSegmentedTabs", () => ({ __esModule: true, default: "Tabs" }));
jest.mock("../components/friends/FriendsSearchField", () => ({ __esModule: true, default: "Search" }));
jest.mock("../components/friends/FriendsEmptyState", () => ({ __esModule: true, default: "Empty" }));
jest.mock("../components/friends/PersonRow", () => ({ __esModule: true, default: "PersonRow" }));
jest.mock("../components/friends/friendsTokens", () => ({ UNREAD_BADGE: "#e11d48" }));

jest.mock("../utils/i18nText", () => {
  const i18nText = (_key, fallback, vars) =>
    String(fallback).replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars?.[k] ?? ""));
  return { i18nText, i18nCount: (key, fallback, n) => i18nText(key, fallback, { n }) };
});
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr" }) }));
jest.mock("../services/usageTrackerService", () => ({ trackFirestoreRead: jest.fn() }));

let mockGroups = [];
let mockInbox = {};
jest.mock("../services/groupsService", () => ({
  subscribeUserGroups: (_uid, callback) => {
    callback(mockGroups);
    return () => {};
  },
  subscribeGroupInbox: (_uid, callback) => {
    callback(mockInbox);
    return () => {};
  },
}));

global.IS_REACT_ACT_ENVIRONMENT = true;

const group = (id, extra = {}) => ({
  id,
  name: `Grup ${id}`,
  avatarIndex: 0,
  members: ["me", "ali"],
  memberInfo: { ali: { name: "Ali" } },
  lastMessage: { text: "selam", senderId: "ali", time: { toMillis: () => Date.now() } },
  ...extra,
});

let renderer;
let consoleError;

beforeEach(() => {
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

async function renderGroupsTab(groups, inbox = {}) {
  mockGroups = groups;
  mockInbox = inbox;
  await act(() => {
    renderer = create(<MessagesScreen navigation={{ navigate: jest.fn() }} />);
  });
  await act(() => renderer.root.findByType("Tabs").props.onChange("group"));
}
const rows = () => renderer.root.findAllByType("PersonRow");
const tabs = () => renderer.root.findByType("Tabs").props.tabs;

describe("MessagesScreen — grup satırı", () => {
  it("okunmamış grup, 1-1 satırıyla aynı vurguyu ve sayaç rozetini alır", async () => {
    // Grup belgesindeki eski harita (me: 9) yok sayılır; kaynak gelen kutusu.
    await renderGroupsTab([group("g1", { unread: { me: 9 } })], { g1: 3 });
    const row = rows()[0].props;
    expect(row.highlighted).toBe(true);
    expect(row.titleStrong).toBe(true);
    expect(row.subtitleStrong).toBe(true);
    expect(row.metaAccent).toBe(true);
    expect(row.trailing).toBeTruthy();
    let pill;
    await act(() => {
      pill = create(row.trailing);
    });
    const labels = pill.root.findAllByType("Text").map((t) => t.props.children);
    await act(() => pill.unmount());
    expect(labels).toEqual(["3"]);
  });

  it("gelen kutusunda sayaç yoksa ya da sıfırsa satır normal kalır", async () => {
    await renderGroupsTab(
      [group("g1"), group("g2"), group("g3", { unread: { me: 4 } })],
      { g2: 0, baskaGrup: 7 },
    );
    for (const row of rows()) {
      expect(row.props.highlighted).toBe(false);
      expect(row.props.titleStrong).toBe(false);
      expect(row.props.metaAccent).toBe(false);
      expect(row.props.trailing).toBeNull();
    }
  });

  it("'Gruplar' sekmesi toplam okunmamışı rozet olarak taşır, başlık da söyler", async () => {
    // Üyesi olunmayan grubun bayat kaydı (eskiGrup) toplama girmez.
    await renderGroupsTab([group("g1"), group("g2"), group("g3")], {
      g1: 3,
      g2: 2,
      eskiGrup: 6,
    });
    const groupsTab = tabs().find((t) => t.key === "group");
    expect(groupsTab.badge).toBe(5);
    expect(groupsTab.badgeColor).toBe("#e11d48");
    expect(renderer.root.findByType("Header").props.subtitle).toBe("5 okunmamış mesaj");
  });

  it("okunmamış yoksa sekme rozeti 0, başlık grup sayısını gösterir", async () => {
    await renderGroupsTab([group("g1"), group("g2")]);
    expect(tabs().find((t) => t.key === "group").badge).toBe(0);
    expect(renderer.root.findByType("Header").props.subtitle).toBe("2 grup");
  });
});
