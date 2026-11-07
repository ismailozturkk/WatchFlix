// __tests__/profileRemindersQuickDelete.test.js
//
// Profil > Hatırlatıcılar kartları: "Yayınlandı" rozetinin yanındaki çöp düğmesi.
// Gerçek yerleşim (95 dp'lik kartta sığma) cihazda doğrulanır; burada kilitlenenler:
//   • düğme YALNIZ "Yayınlandı" görünen kartta, rozetle aynı hapın içinde çıkar,
//   • yaklaşan hatırlatıcıda ve Ayarlar > Poster görünümü'nde geri sayım rozeti
//     kapalıyken çıkmaz,
//   • dokununca seçim sayfası (izlendi / izleme listesi / yalnız sil) açılır; seçilen yol
//     doğru kimlikle (uid + kart belgesi) utils/reminderReleasedActions'a gider.
import React from "react";
import { act, create } from "react-test-renderer";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("react-native", () => {
  class Value {
    constructor(value) {
      this.value = value;
    }
    setValue(value) {
      this.value = value;
    }
    interpolate() {
      return 0;
    }
  }
  return {
    StyleSheet: { create: (styles) => styles, absoluteFill: {} },
    Text: "Text",
    View: "View",
    Image: "Image",
    TouchableOpacity: "TouchableOpacity",
    Dimensions: { get: () => ({ width: 390, height: 800 }) },
    Animated: { Value, View: "View", spring: () => ({ start: () => {} }) },
  };
});
// Derleme eklentisi (scripts/babel-transform-app-text.js) `Text`'i AppText'e çevirir.
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Ionicons" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("../components/Skeleton", () => ({ __esModule: true, default: "Skeleton" }));
jest.mock("../components/common/GlassIconButton", () => ({
  __esModule: true,
  default: "GlassIconButton",
}));
jest.mock("../components/StaggerItem", () => ({
  __esModule: true,
  default: ({ children }) => children,
}));
jest.mock("../hooks/useReduceMotion", () => ({ __esModule: true, default: () => true }));
jest.mock("../utils/i18nText", () => ({ i18nText: (_key, fallback) => fallback }));

const mockState = { uid: "u1", posterBadges: {}, view: null };

jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: {
      accent: "#a",
      secondary: "#s",
      border: "#b",
      text: { primary: "#t1", secondary: "#t2", muted: "#t3" },
      notesColor: {
        green: "#g",
        greenBackground: "#gb",
        blue: "#bl",
        blueBackground: "#blb",
        orange: "#o",
        orangeBackground: "#ob",
        red: "#r",
        redBackground: "#rb",
        purple: "#p",
        purpleBackground: "#pb",
      },
    },
  }),
}));
jest.mock("../context/LanguageContext", () => ({
  useLanguage: () => ({ t: require("../translations/tr.json"), language: "tr" }),
}));
jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: mockState.uid ? { uid: mockState.uid } : null }),
}));
jest.mock("../context/AppSettingsContext", () => ({
  useApiSettings: () => ({ API_KEY: "key" }),
  useImageQualitySettings: () => ({ getTmdbUrl: () => "https://img/x.jpg" }),
  useListLayoutSettings: () => ({ posterBadges: mockState.posterBadges }),
}));
jest.mock("../context/ProfileRemindersContext", () => ({
  useProfileReminders: () => mockState.view,
}));
jest.mock("../utils/reminderReleasedActions", () => ({
  finishReleasedReminder: jest.fn(),
}));
jest.mock("../components/reminders/ReleasedReminderSheet", () => ({
  __esModule: true,
  default: "ReleasedReminderSheet",
}));

const released = require("../utils/reminderReleasedActions");
const ProfileReminders = require("../screens/tabs/profile/ProfileReminders").default;

const DELETE = "Hatırlatmayı kaldır";
const releasedMovie = { movieId: 1, movieName: "Eski Film", releaseDate: "2026-09-01", posterPath: "/a" };
const upcomingMovie = { movieId: 2, movieName: "Yeni Film", releaseDate: "2026-12-01", posterPath: "/b" };
const releasedEpisode = {
  episodeId: "e1",
  episodeNumber: 3,
  showId: 7,
  showName: "Dizi",
  seasonNumber: 1,
  airDate: "2026-09-02",
};
const upcomingEpisode = { ...releasedEpisode, episodeId: "e2", episodeNumber: 4, airDate: "2026-12-02" };

// Yayınlanmış → { isRemaining:false }; gelecek → geri sayım (gerçeği ProfileRemindersContext).
const calculateDateDifference = (date) =>
  date < "2026-10-16"
    ? { text: date, isRemaining: false }
    : { text: "47 gün", days: 47, months: 1, isRemaining: true };

function setView(activeTab, overrides = {}) {
  mockState.view = {
    loading: false,
    activeTab,
    setActiveTab: jest.fn(),
    formatDate: (d) => d,
    calculateDateDifference,
    reminders: {
      movieReminders: [upcomingMovie, releasedMovie],
      tvReminders: [{ showId: 7, showName: "Dizi", seasons: [{ seasonNumber: 1, episodes: [upcomingEpisode, releasedEpisode] }] }],
    },
    ...overrides,
  };
}

function mount() {
  let tree;
  act(() => {
    tree = create(React.createElement(ProfileReminders, { navigation: { navigate: jest.fn() } }));
  });
  return tree;
}

const deleteButtons = (tree) =>
  tree.root
    .findAllByType("TouchableOpacity")
    .filter((n) => n.props.accessibilityLabel === DELETE);
const sheetOf = (tree) => tree.root.findByType("ReleasedReminderSheet");
const textsOf = (node) => node.findAllByType("Text").map((n) => [].concat(n.props.children).join(""));

beforeEach(() => {
  jest.clearAllMocks();
  mockState.uid = "u1";
  mockState.posterBadges = {};
});

describe("Profil hatırlatıcıları: Yayınlandı kartında kaldırma düğmesi", () => {
  it("film: yalnız yayınlanmış kartta, 'Yayınlandı' ile aynı hapın içinde çıkar", () => {
    setView("movie");
    const tree = mount();

    const buttons = deleteButtons(tree);
    expect(buttons).toHaveLength(1); // yaklaşan filmde yok
    // Düğmenin ebeveyni hap: içinde etiket de var.
    const pill = buttons[0].parent;
    expect(textsOf(pill)).toContain("Yayınlandı");
    expect(buttons[0].findByType("Ionicons").props.name).toBe("trash-outline");
    // 390 dp'de kart yeterince geniş: baştaki tik de durur (≤375 dp'de atılır,
    // ölçüm ProfileReminders.js'teki yorumda).
    expect(pill.findAllByType("Ionicons").map((n) => n.props.name)).toEqual([
      "checkmark-circle",
      "trash-outline",
    ]);
  });

  it("film: dokununca seçim sayfası açılır; hiçbir şey seçilmeden yazılmaz", () => {
    setView("movie");
    const tree = mount();
    expect(sheetOf(tree).props.visible).toBe(false);

    act(() => deleteButtons(tree)[0].props.onPress());

    expect(sheetOf(tree).props.visible).toBe(true);
    expect(sheetOf(tree).props.target).toEqual({ kind: "movie", reminder: releasedMovie });
    expect(released.finishReleasedReminder).not.toHaveBeenCalled();
  });

  it.each(["delete", "watchlist", "watched"])(
    "film: '%s' seçilince sayfa kapanır, doğru kullanıcı ve kart belgesiyle yazılır",
    (action) => {
      setView("movie");
      const tree = mount();
      act(() => deleteButtons(tree)[0].props.onPress());

      act(() => sheetOf(tree).props.onSelect(action));

      expect(sheetOf(tree).props.visible).toBe(false);
      // Kapanış animasyonu boyunca başlık boşalmasın: hedef korunur.
      expect(sheetOf(tree).props.target).not.toBeNull();
      expect(released.finishReleasedReminder).toHaveBeenCalledTimes(1);
      expect(released.finishReleasedReminder).toHaveBeenCalledWith({
        action,
        uid: "u1",
        kind: "movie",
        reminder: releasedMovie,
        apiKey: "key",
        language: "tr",
      });
    },
  );

  it("dizi: yayınlanmış bölümde çıkar, bölüm belgesiyle yazılır", () => {
    setView("tv");
    const tree = mount();

    expect(deleteButtons(tree)).toHaveLength(1);
    act(() => deleteButtons(tree)[0].props.onPress());
    act(() => sheetOf(tree).props.onSelect("watched"));

    expect(released.finishReleasedReminder).toHaveBeenCalledWith(
      expect.objectContaining({ action: "watched", kind: "tv", reminder: releasedEpisode }),
    );
  });

  it("sayfa kapatılırsa (dışarı dokunma) hiçbir şey yazılmaz", () => {
    setView("movie");
    const tree = mount();
    act(() => deleteButtons(tree)[0].props.onPress());

    act(() => sheetOf(tree).props.onClose());

    expect(sheetOf(tree).props.visible).toBe(false);
    expect(released.finishReleasedReminder).not.toHaveBeenCalled();
  });

  it("yaklaşan kartta geri sayım rozeti eskisi gibi, düğme yok", () => {
    setView("movie", {
      reminders: { movieReminders: [upcomingMovie], tvReminders: [] },
    });
    const tree = mount();

    expect(deleteButtons(tree)).toHaveLength(0);
    expect(tree.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""))).toContain(
      "47 gün",
    );
  });

  it("Poster görünümü'nde geri sayım rozeti kapalıysa düğme de çıkmaz", () => {
    mockState.posterBadges = { countdown: false };
    setView("movie");
    const tree = mount();

    expect(deleteButtons(tree)).toHaveLength(0);
    expect(tree.root.findAllByType("Text").map((n) => [].concat(n.props.children).join(""))).not.toContain(
      "Yayınlandı",
    );
  });

  it("etiket tek satırda kalır ve dar kartta küçülür (düğmeyi itmez)", () => {
    setView("movie");
    const tree = mount();

    const label = deleteButtons(tree)[0]
      .parent.findAllByType("Text")
      .find((n) => [].concat(n.props.children).join("") === "Yayınlandı");
    expect(label.props.numberOfLines).toBe(1);
    expect(label.props.adjustsFontSizeToFit).toBe(true);
    expect(label.props.minimumFontScale).toBeLessThan(1);
  });
});
