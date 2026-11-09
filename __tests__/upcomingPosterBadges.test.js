// __tests__/upcomingPosterBadges.test.js
//
// Yaklaşan raflarındaki geri sayım + çıkış tarihi rozet çifti (components/PosterInfoBadges.js
// UpcomingPosterBadges; kullananlar: MovieUpcoming, FollowedUpcomingRail).
// Eskiden iki rozet ayrı köşelere mutlak konumlanıyordu ve 320 pt'de İngilizce "Tomorrow" tarih rozetine
// biniyordu (Yoga ölçümü, 7 Kas). Artık ikisi aynı satırda, sarmalı (sığmazsa tarih alt satıra iner) ve
// tarih `marginLeft: "auto"` ile sağda kalıyor. Bu test yapıyı kilitler; yerleşim Yoga ölçümüyle doğrulandı.
import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  StyleSheet: { create: (s) => s, hairlineWidth: 1 },
  View: "View",
  Text: "Text",
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
let mockBadges = {};
jest.mock("../context/AppSettingsContext", () => ({
  useListLayoutSettings: () => ({ railPosterSize: "normal", posterBadges: mockBadges }),
}));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "en" }) }));

const { UpcomingPosterBadges } = require("../components/PosterInfoBadges");

global.IS_REACT_ACT_ENVIRONMENT = true;

const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const flat = (style) => Object.assign({}, ...[].concat(style).flat(Infinity).filter(Boolean));
const textOf = (node) => [].concat(node.props.children).join("");

let renderer;
let errorSpy;
beforeEach(() => {
  mockBadges = {};
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

const mount = () => {
  act(() => {
    renderer = create(<UpcomingPosterBadges date={tomorrow()} />);
  });
  const row = renderer.root.findAllByType("View")[0];
  const [countdown, date] = row.children;
  return { row, countdown, date };
};

it("iki rozet tek, sarmalı bir satırda; kendileri mutlak konumlu değil", () => {
  const { row, countdown, date } = mount();
  expect(flat(row.props.style)).toMatchObject({
    position: "absolute",
    top: 5,
    left: 5,
    right: 5,
    flexDirection: "row",
    flexWrap: "wrap",
  });
  expect(row.props.pointerEvents).toBe("none");
  // Rozetlerin kök View'ları: mutlak konum yok (yoksa satırdan çıkıp yine çakışırlar).
  const countdownBox = countdown.findAllByType("View")[0];
  const dateBox = date.findAllByType("View")[0];
  expect(flat(countdownBox.props.style).position).toBeUndefined();
  expect(flat(dateBox.props.style).position).toBeUndefined();
  // Tarih sağa yaslanır (alt satıra inse de).
  expect(flat(dateBox.props.style).marginLeft).toBe("auto");
});

it("önce geri sayım, sonra tarih ('Tomorrow' en uzun etiket)", () => {
  mount();
  const texts = renderer.root.findAllByType("Text").map(textOf);
  expect(texts[0]).toBe("Tomorrow");
  expect(texts).toHaveLength(2);
});

it("poster rozeti ayarları içeride uygulanır (geri sayım kapalı → yalnız tarih)", () => {
  mockBadges = { countdown: false };
  mount();
  const texts = renderer.root.findAllByType("Text").map(textOf);
  expect(texts).toHaveLength(1);
  expect(texts[0]).not.toBe("Tomorrow");
});
