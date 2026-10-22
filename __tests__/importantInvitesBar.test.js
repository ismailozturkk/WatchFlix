import React from "react";
import { act, create } from "react-test-renderer";

let mockInbox;
let mockLanguage = "tr";
const mockUpsell = jest.fn();
jest.mock("react-native", () => ({
  View: "View", Text: "Text", ActivityIndicator: "Spinner", StyleSheet: { create: (styles) => styles },
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("../components/AppIcon", () => "Icon");
jest.mock("../components/common/GlassPressable", () => "Button");
jest.mock("../context/NotificationsContext", () => ({ useNotifications: () => mockInbox }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: mockLanguage }) }));
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: {
  primary: "#111", secondary: "#222", border: "#333", text: { primary: "#fff", secondary: "#bbb", muted: "#999" },
} }) }));
jest.mock("../hooks/usePremiumGate", () => ({ usePremiumGate: () => ({ allows: () => true, showUpsell: mockUpsell }) }));

const Bar = require("../components/profile/ImportantInvitesBar").default;
global.IS_REACT_ACT_ENVIRONMENT = true;
const now = new Date("2026-10-22T12:00:00Z").getTime();
const room = { id: "room", type: "cineswipe_invite", inviteCode: "123456", fromName: "Ada", createdAt: now - 1000, read: true };
const duel = { id: "duel", type: "game_challenge", dayKey: "2026-10-22", fromName: "Can", createdAt: now - 2000, read: false };
let renderer;
let warn;
const navigation = { navigate: jest.fn() };
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(now);
  jest.clearAllMocks();
  mockLanguage = "tr";
  mockInbox = { items: [room, duel], respond: jest.fn().mockResolvedValue(true) };
  const original = console.error;
  warn = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (!String(message).includes("react-test-renderer is deprecated")) original(message, ...args);
  });
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  warn.mockRestore();
  jest.useRealTimers();
});
const render = () => act(() => { renderer = create(<Bar navigation={navigation} />); });
const button = (id) => renderer.root.findByProps({ testID: id });

test("profile bar shows pending read invitation and decline records decision", async () => {
  render();
  expect(button("important-invites-bar")).toBeTruthy();
  await act(async () => { await button("important-invite-decline").props.onPress(); });
  expect(mockInbox.respond).toHaveBeenCalledWith("room", "declined");
  expect(navigation.navigate).not.toHaveBeenCalled();
  expect(button("important-invites-bar")).toBeTruthy(); // next invitation remains
});

test("next and accept open the selected daily challenge", async () => {
  render();
  act(() => button("important-invite-next").props.onPress());
  await act(async () => { await button("important-invite-accept").props.onPress(); });
  expect(mockInbox.respond).toHaveBeenCalledWith("duel", "accepted");
  expect(navigation.navigate).toHaveBeenCalledWith("SceneGamePlayScreen", expect.objectContaining({ modeId: "daily" }));
});

test("failed response leaves invitation visible and shows error", async () => {
  mockInbox.respond.mockRejectedValueOnce(new Error("offline"));
  render();
  await act(async () => { await button("important-invite-decline").props.onPress(); });
  expect(button("important-invites-bar")).toBeTruthy();
  expect(renderer.root.findAllByProps({ accessibilityRole: "alert" })).toHaveLength(1);
});
