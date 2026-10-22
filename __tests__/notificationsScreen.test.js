import React from "react";
import { act, create } from "react-test-renderer";

let mockUid = "user-a";
let mockLanguage = "tr";
let mockInbox;
const mockFetchOlder = jest.fn();
jest.mock("react-native", () => ({
  View: "View", Text: "Text", ActivityIndicator: "Spinner",
  SectionList: "SectionList", StyleSheet: { create: (s) => s },
}));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: mockUid } }) }));
jest.mock("../context/NotificationsContext", () => ({ useNotifications: () => mockInbox }));
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: {
  primary: "#111111", secondary: "#222222", border: "#333333", accent: "#8888ff", text: { primary: "#ffffff", secondary: "#aaaaaa" },
  colors: { red: "#ff3232", blue: "#3b82f6", green: "#22c55e", purple: "#a855f7", orange: "#ff7c25" },
} }) }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: mockLanguage, t: require(`../translations/${mockLanguage}.json`) }) }));
jest.mock("../context/UserProfileContext", () => ({ useUserProfile: () => ({ profile: { unreadNotifsCount: 101 } }) }));
jest.mock("../components/ScreenDecor", () => "Decor");
jest.mock("../components/friends/FriendsScreenHeader", () => "Header");
jest.mock("../components/AppIcon", () => "Icon");
jest.mock("../components/common/GlassPressable", () => "Button");
jest.mock("../components/common/GlassIconButton", () => ({ __esModule: true, default: "IconButton" }));
jest.mock("../services/notificationsService", () => ({ fetchOlderNotifications: (...args) => mockFetchOlder(...args) }));

const Screen = require("../screens/tabs/profile/NotificationsScreen").default;
const ProfileButton = require("../components/profile/ProfileNotificationsButton").default;
global.IS_REACT_ACT_ENVIRONMENT = true;
let renderer;
let rowRenderer;
let warn;
const navigation = { navigate: jest.fn() };
const item = { id: "n1", type: "message", fromUid: "friend", fromName: "Ada", text: "Merhaba", createdAt: 1000, read: false };
beforeEach(() => {
  jest.clearAllMocks();
  mockUid = "user-a";
  mockLanguage = "tr";
  mockInbox = { items: [item], loading: false, error: null, cursor: "first-cursor", hasMore: true, markRead: jest.fn().mockResolvedValue(), retry: jest.fn() };
  const original = console.error;
  warn = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (!String(message).includes("react-test-renderer is deprecated")) original(message, ...args);
  });
});
afterEach(() => {
  act(() => { renderer?.unmount(); rowRenderer?.unmount(); });
  renderer = null; rowRenderer = null;
  warn.mockRestore();
});
const render = () => act(() => { renderer = create(<Screen navigation={navigation} />); });
const list = () => renderer.root.findByType("SectionList");
const row = (id = item.id) => {
  const current = list().props.sections.flatMap((section) => section.data).find((entry) => entry.id === id);
  act(() => {
    const element = list().props.renderItem({ item: current });
    if (rowRenderer) rowRenderer.update(element);
    else rowRenderer = create(element);
  });
  return rowRenderer.root.findByProps({ testID: `notification-${id}` });
};
const pressFooter = async () => {
  const footer = list().props.ListFooterComponent;
  act(() => { rowRenderer = create(footer); });
  await act(async () => { await rowRenderer.root.findByType("Button").props.onPress(); });
};

test("her bildirimin simgesi türüne göre renkli: beğeni kırmızı, mesaj vurgu rengi; okununca soluk", () => {
  mockInbox = { ...mockInbox, items: [
    { id: "l1", type: "post_like", fromName: "Ada", createdAt: 2000, read: false },
    { id: "r1", type: "friend_request", fromName: "Can", createdAt: 1900, read: true },
    item,
  ] };
  render();
  const iconOf = (id) => {
    const current = list().props.sections.flatMap((section) => section.data).find((entry) => entry.id === id);
    let r;
    act(() => { r = create(list().props.renderItem({ item: current })); });
    const icon = r.root.findAllByType("Icon")[0];
    const props = icon.props;
    act(() => r.unmount());
    return props;
  };
  expect(iconOf("l1").color).toBe("#ff3232"); // okunmamış beğeni
  expect(iconOf("n1").color).toBe("#8888ff"); // okunmamış mesaj → vurgu
  // Okunmuş istek: aynı mavi, ama soluk (alfa < 1).
  expect(iconOf("r1").color).toBe("rgba(59, 130, 246, 0.7)");
});

test("profile bell shows unread badge and opens inbox", () => {
  act(() => { renderer = create(<ProfileButton navigation={navigation} />); });
  const button = renderer.root.findByType("IconButton");
  expect(button.props.testID).toBe("profile-notifications-button");
  expect(button.props.accessibilityLabel).toContain("101");
  // Rozet cam dışında, `overlay` olarak çizilir (cam çocuğu kırpar).
  let overlay;
  act(() => { overlay = create(button.props.overlay); });
  expect(overlay.root.findAllByType("Text").some((n) => n.props.children === "99+")).toBe(true);
  act(() => overlay.unmount());
  act(() => button.props.onPress());
  expect(navigation.navigate).toHaveBeenCalledWith("NotificationsScreen");
});

test("tap expands and marks read; only the separate content button navigates", async () => {
  render();
  const button = row();
  expect(button.props.accessibilityState.expanded).toBe(false);
  expect(rowRenderer.root.findAllByProps({ testID: "notification-detail-n1" })).toHaveLength(0);
  await act(async () => { await button.props.onPress(); });
  expect(mockInbox.markRead).toHaveBeenCalledWith("n1");
  expect(navigation.navigate).not.toHaveBeenCalled();
  expect(row().props.accessibilityState.expanded).toBe(true);
  expect(rowRenderer.root.findAllByProps({ testID: "notification-detail-n1" })).toHaveLength(1);
  await act(async () => { await rowRenderer.root.findByProps({ testID: "notification-open-n1" }).props.onPress(); });
  expect(navigation.navigate).toHaveBeenCalledWith("ChatScreen", { friendUid: "friend", friendName: "Ada" });
  act(() => renderer.root.findAllByType("Button")[1].props.onPress());
  expect(list().props.sections).toEqual([]);
});

test("expanded unread item stays visible after reading until collapsed", async () => {
  render();
  act(() => renderer.root.findAllByType("Button")[1].props.onPress());
  const button = row();
  await act(async () => { await button.props.onPress(); });
  expect(list().props.sections[0].data[0].read).toBe(true);
  const expanded = row();
  expect(expanded.props.accessibilityState.expanded).toBe(true);
  act(() => expanded.props.onPress());
  expect(list().props.sections).toEqual([]);
});

test("opening another notification collapses the previous one", async () => {
  mockInbox.items = [item, { ...item, id: "n2", text: "İkinci mesaj" }];
  render();
  const first = row();
  await act(async () => { await first.props.onPress(); });
  const second = row("n2");
  await act(async () => { await second.props.onPress(); });
  expect(row("n2").props.accessibilityState.expanded).toBe(true);
  expect(row("n1").props.accessibilityState.expanded).toBe(false);
  expect(navigation.navigate).not.toHaveBeenCalled();
});

test("notifications without a destination can still expand and collapse", async () => {
  mockInbox.items = [{ ...item, type: "future_type", fromUid: undefined }];
  render();
  const button = row();
  await act(async () => { await button.props.onPress(); });
  const expanded = row();
  expect(expanded.props.accessibilityState.expanded).toBe(true);
  expect(rowRenderer.root.findAllByProps({ testID: "notification-open-n1" })).toHaveLength(0);
  act(() => expanded.props.onPress());
  expect(row().props.accessibilityState.expanded).toBe(false);
});

test("read failure preserves unread and shows error without navigating", async () => {
  mockInbox.markRead.mockRejectedValue(new Error("offline"));
  render();
  const button = row();
  await act(async () => { await button.props.onPress(); });
  expect(navigation.navigate).not.toHaveBeenCalled();
  expect(list().props.sections[0].data[0].read).toBe(false);
  expect(renderer.root.findAllByType("Text").some((n) => n.props.accessibilityRole === "alert")).toBe(true);
});

test("older pages merge into inbox, and switching accounts clears them", async () => {
  mockFetchOlder.mockResolvedValue({ items: [{ ...item, id: "older", createdAt: 500 }], cursor: "next", hasMore: false });
  render();
  await pressFooter();
  expect(mockFetchOlder).toHaveBeenCalledWith("user-a", "first-cursor");
  expect(list().props.sections.flatMap((s) => s.data).map((n) => n.id)).toEqual(["n1", "older"]);
  mockUid = "user-b";
  mockInbox = { ...mockInbox, items: [], hasMore: false };
  act(() => renderer.update(<Screen navigation={navigation} />));
  expect(list().props.sections).toEqual([]);
});

test("loading and listener error are distinct from an empty inbox", () => {
  mockInbox.loading = true;
  render();
  expect(renderer.root.findAllByType("Spinner")).toHaveLength(1);
  expect(renderer.root.findAllByType("SectionList")).toHaveLength(0);
  mockInbox = { ...mockInbox, loading: false, items: [], error: new Error("offline") };
  act(() => renderer.update(<Screen navigation={navigation} />));
  expect(list().props.ListEmptyComponent).toBeNull();
  act(() => renderer.root.findAllByType("Button")[2].props.onPress());
  expect(mockInbox.retry).toHaveBeenCalled();
});

test("pending open cannot navigate after account change", async () => {
  render();
  // Expand first, fail the read, then retry through the separate content button.
  mockInbox.markRead.mockRejectedValueOnce(new Error("offline"));
  const collapsed = row();
  await act(async () => { await collapsed.props.onPress(); });
  let resolveRead;
  mockInbox.markRead.mockReturnValue(new Promise((resolve) => { resolveRead = resolve; }));
  row();
  const button = rowRenderer.root.findByProps({ testID: "notification-open-n1" });
  let pending;
  act(() => { pending = button.props.onPress(); });
  mockUid = "user-b";
  mockInbox = { ...mockInbox, items: [] };
  act(() => renderer.update(<Screen navigation={navigation} />));
  await act(async () => { resolveRead(); await pending; });
  expect(navigation.navigate).not.toHaveBeenCalled();
});

test("expanded notification updates its copy and action when language changes", async () => {
  render();
  const collapsed = row();
  await act(async () => { await collapsed.props.onPress(); });
  for (const language of ["en", "es", "pt", "de", "tr"]) {
    mockLanguage = language;
    act(() => renderer.update(<Screen navigation={navigation} />));
    expect(row().props.accessibilityState.expanded).toBe(true);
    const copy = require("../utils/notificationInboxCopy").notificationInboxCopy(language);
    expect(renderer.root.findByType("Header").props.title).toBe(copy.title);
    expect(rowRenderer.root.findAllByType("Text").some((n) => n.props.children === copy.open)).toBe(true);
    expect(rowRenderer.root.findAllByType("Text").some((n) => n.props.children === require(`../translations/${language}.json`).notifBodyMessage)).toBe(true);
  }
  expect(mockInbox.markRead).toHaveBeenCalledTimes(1);
});
