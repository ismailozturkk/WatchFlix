// __tests__/followedUpcomingRail.test.js
//
// Film / Dizi sekmesindeki "Takip ettiklerinin yaklaşanları" rafının ÜÇ DURUMU
// (components/person/FollowedUpcomingRail.js):
//   kimse takipte değil → hiç çizilmez · takip var, yaklaşan yok → ince bilgi satırı · yaklaşan var → poster rafı.
// Sessiz satırın başlığı İKİ satıra izinli: "Nothing upcoming from people you follow" 412 pt altında tek
// satıra sığmıyordu (Yoga ölçümü 320–412 pt × tr/en/es, 7 Kas — docs/ozellikler/OYUNCU_TAKIBI.md).
import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => {
  const R = require("react");
  const host = (name) =>
    function Host({ children, ...props }) {
      return R.createElement(name, props, typeof children === "function" ? children({ pressed: false }) : children);
    };
  return {
    StyleSheet: { create: (s) => s, hairlineWidth: 1 },
    Dimensions: { get: () => ({ width: 390, height: 800 }) },
    View: "View",
    Text: "Text",
    Pressable: host("Pressable"),
    TouchableOpacity: host("Touchable"),
    Animated: { View: "View", Value: class {}, timing: () => ({ start: () => {} }) },
  };
});
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("../components/PosterImage", () => ({ __esModule: true, default: "Poster" }));
jest.mock("../components/ListBadges", () => ({ __esModule: true, default: () => null }));
jest.mock("../components/PaginatedRail", () => ({
  __esModule: true,
  default: ({ data, renderItem }) =>
    require("react").createElement(
      "Rail",
      null,
      data.map((item) => require("react").createElement(require("react").Fragment, { key: item.id }, renderItem({ item }))),
    ),
}));
const mockSkeleton = jest.fn(() => null);
jest.mock("../components/Skeleton", () => ({ RailSkeleton: (props) => mockSkeleton(props) }));
jest.mock("../components/PosterInfoBadges", () => ({ UpcomingPosterBadges: "UpcomingBadges" }));
jest.mock("../components/person/FollowedPeopleSheet", () => ({ __esModule: true, default: () => null }));
jest.mock("../services/analytics", () => ({ ANALYTICS_EVENTS: {}, trackEvent: () => {} }));
jest.mock("../utils/i18nText", () => ({ i18nText: (_key, fallback) => fallback }));
let mockLang = "en";
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: mockLang }) }));
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: { primary: "#111111", secondary: "#1b1b1b", border: "#333333", accent: "#3388ff", text: { primary: "#fff", muted: "#888" } },
  }),
}));
jest.mock("../context/AppSettingsContext", () => ({
  useApiSettings: () => ({ API_KEY: "k" }),
  useListLayoutSettings: () => ({ railPosterSize: "normal", railPosterRadius: 15, posterBadges: {} }),
}));
jest.mock("../context/ListStatusContext", () => ({ useListStatusContext: () => ({ statusIndex: {} }) }));
jest.mock("../context/MediaQuickActionsContext", () => ({ useMediaQuickActions: () => ({ openQuickActions: () => {} }) }));
let mockPeople = [];
jest.mock("../hooks/useFollowedPeople", () => ({
  __esModule: true,
  default: () => ({ people: mockPeople, count: mockPeople.length }),
}));
let mockItems = [];
jest.mock("../services/followedUpcoming", () => ({ fetchFollowedUpcoming: () => Promise.resolve(mockItems) }));
jest.mock("../utils/phoneCalendar", () => ({
  buildEventKey: (item) => item.key,
  loadSavedKeysSet: () => Promise.resolve(new Set()),
  removeEventFromPhoneCalendar: jest.fn(),
  saveEventToPhoneCalendar: jest.fn(),
  saveManyEventsToPhoneCalendar: jest.fn(),
}));

const FollowedUpcomingRail = require("../components/person/FollowedUpcomingRail").default;
const { FOLLOWED_PEOPLE_COPY } = require("../utils/followedPeopleCopy");

global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer;
let errorSpy;
beforeEach(() => {
  mockSkeleton.mockClear();
  mockLang = "en";
  mockPeople = [{ id: 1, name: "Ada Demir" }];
  mockItems = [];
  const original = console.error;
  errorSpy = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (String(message).includes("react-test-renderer is deprecated")) return;
    original(message, ...args);
  });
});
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = null;
  errorSpy.mockRestore();
});

const mount = async () => {
  await act(async () => {
    renderer = create(<FollowedUpcomingRail mediaType="movie" navigation={{ push: jest.fn() }} />);
  });
  return renderer;
};
const textNodes = () => renderer.root.findAllByType("Text");
const textOf = (node) => [].concat(node.props.children).join("");

it("kimse takipte değilken hiçbir şey çizmez — ilk karede iskelet bile (yanıp sönmesin)", async () => {
  mockPeople = [];
  await mount();
  expect(renderer.toJSON()).toBeNull();
  expect(mockSkeleton).not.toHaveBeenCalled();
});

it("takip var, yaklaşan yok → bilgi satırı; başlık iki satıra izinli (dar ekranda '…' olmasın)", async () => {
  await mount();
  const copy = FOLLOWED_PEOPLE_COPY.en.rail;
  const title = textNodes().find((node) => textOf(node) === copy.quietTitle);
  expect(title).toBeDefined();
  expect(title.props.numberOfLines).toBe(2);
  expect(textNodes().map(textOf)).toContain(copy.quietBody(1));
  expect(renderer.root.findAllByType("Rail")).toHaveLength(0);
});

it("yaklaşan varken başlık + poster rafı çizilir; kartta takvim düğmesi var", async () => {
  mockItems = [
    { id: 7, title: "Film", poster_path: "/p.jpg", _date: "2099-01-02", _people: ["Ada Demir"] },
  ];
  await mount();
  const copy = FOLLOWED_PEOPLE_COPY.en.rail;
  expect(textNodes().map(textOf)).toEqual(expect.arrayContaining([copy.title, "Ada Demir"]));
  expect(renderer.root.findAllByType("Poster")).toHaveLength(1);
  // Geri sayım + tarih ortak satırda (iki ayrı köşe dar posterde çakışıyordu).
  expect(renderer.root.findAllByType("UpcomingBadges").map((node) => node.props.date)).toEqual(["2099-01-02"]);
  const calendar = renderer.root
    .findAllByType("Pressable")
    .filter((node) => node.props.accessibilityLabel === copy.addToCalendar("Film"));
  expect(calendar).toHaveLength(1);
});
