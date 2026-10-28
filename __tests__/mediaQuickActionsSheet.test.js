// __tests__/mediaQuickActionsSheet.test.js
//
// Ana ekranda postere basılı tutunca açılan hızlı eylem sayfası
// (components/modals/MediaQuickActionsSheet.js) → kardeş modal devri.
//
// Kök neden: Eskiden `closeThen` sabit `setTimeout(next, 220)` kullanıyordu.
// 200 ms'lik çıkış animasyonu JS köprüsü gecikmesiyle 220 ms'de henüz bitmediği
// için `mounted` hâlâ `true` iken `RatingSheetModal` `visible={true}` oluyordu.
// iOS UIKit kapanmakta olan `RCTModalHostViewController` üstüne ikinci bir
// Modal sunamadığından ("already presenting") oylama penceresi düşüyor ve
// ekran donmuş kalıyordu.

import React, { useState } from "react";
import { act, create } from "react-test-renderer";

// Çıkış animasyonunun bitişini testten kontrol edebilmek için bekleyen
// paralel animasyon tamamlama callback'lerini tutuyoruz.
const pendingParallelCallbacks = [];

jest.mock("react-native", () => {
  const makeValue = (initial) => ({
    _value: initial,
    setValue(v) {
      this._value = v;
    },
    interpolate: () => 0,
  });
  return {
    Animated: {
      Value: function AnimatedValue(v) {
        return makeValue(v);
      },
      View: "AnimatedView",
      timing: () => ({ start: (cb) => cb && cb({ finished: true }), stop: jest.fn() }),
      spring: () => ({ start: (cb) => cb && cb({ finished: true }), stop: jest.fn() }),
      parallel: () => ({
        start: (cb) => {
          pendingParallelCallbacks.push(cb);
        },
        stop: jest.fn(),
      }),
    },
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
    Easing: {
      out: (fn) => fn,
      in: (fn) => fn,
      cubic: (t) => t,
      quad: (t) => t,
    },
    Modal: "Modal",
    ScrollView: "ScrollView",
    StyleSheet: { create: (s) => s, absoluteFill: {}, hairlineWidth: 1 },
    Text: "Text",
    TouchableOpacity: "TouchableOpacity",
    View: "View",
  };
});

jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("axios", () => ({ get: jest.fn(() => new Promise(() => {})) }));
jest.mock("@components/AppToast", () => ({ show: jest.fn() }));
jest.mock("@components/toast/ModalToastHost", () => "ModalToastHost");
jest.mock("@components/typography/AppText", () => ({
  AppText: "Text",
  AnimatedAppText: "AnimatedText",
  AppTextInput: "TextInput",
}));

jest.mock("../hooks/useUserDataDomain", () => () => ({
  has: () => false,
}));
jest.mock("../services/userData", () => ({
  remindersActions: {},
  remindersDomain: {},
}));
jest.mock("../components/common/ModalBlurBackdrop", () => "ModalBlurBackdrop");
jest.mock("../components/PosterImage", () => "PosterImage");
jest.mock("../components/ListView", () => "ListView");
jest.mock("../components/ListViewTv", () => "ListViewTv");
jest.mock("../components/Reminder", () => "Reminder");
jest.mock("../components/RatingSummary", () => "RatingSummary");
jest.mock("../components/modals/RatingSheetModal", () => "RatingSheetModal");
jest.mock("../components/modals/WatchHistorySheet", () => "WatchHistorySheet");
jest.mock("../components/detail/WatchedDateSheet", () => "WatchedDateSheet");
jest.mock("../components/common/GlassTouchable", () => "GlassTouchable");

jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: {
      primary: "#000",
      secondary: "#111",
      accent: "#f5c518",
      border: "#222",
      text: { primary: "#fff", secondary: "#ccc", muted: "#888" },
    },
  }),
}));
jest.mock("../context/LanguageContext", () => ({
  useLanguage: () => ({ t: {}, language: "tr-TR" }),
}));
jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { uid: "u1" } }),
}));
jest.mock("../context/DeviceNotificationsContext", () => ({
  useDeviceNotifications: () => ({}),
}));
jest.mock("../context/AppSettingsContext", () => ({
  useApiSettings: () => ({ API_KEY: "k", language: "tr-TR" }),
  useImageQualitySettings: () => ({ getTmdbUrl: () => null }),
}));
jest.mock("../hooks/useBackdropUri", () => () => (_id, _type, fallback) => fallback);
jest.mock("../context/ListStatusContext", () => ({
  useListStatusContext: () => ({
    allLists: {},
    statusIndex: {},
    watchedMoviesItems: [],
  }),
}));
jest.mock("../hooks/useWatchedShow", () => ({
  useWatchedShow: () => ({
    aggregates: { watchedEpisodeCount: 0 },
    watchEvents: [],
    showDoc: null,
  }),
}));
jest.mock("../hooks/useReminderGate", () => () => ({
  checkGate: () => true,
}));
jest.mock("../services/listItemsService", () => ({
  PREDEFINED_MOVIE_LISTS: ["watchedMovies", "watchlistMovies", "favoritesMovies"],
}));
jest.mock("../services/libraryActions", () => ({
  markMovieWatched: jest.fn(),
  markShowWatched: jest.fn(),
  removeMovieWatch: jest.fn(),
  removeTvWatch: jest.fn(),
  setListMembership: jest.fn(),
}));

const MediaQuickActionsSheet =
  require("../components/modals/MediaQuickActionsSheet").default;

global.IS_REACT_ACT_ENVIRONMENT = true;

const flushLastParallel = (finished = true) => {
  const cb = pendingParallelCallbacks.pop();
  if (cb) cb({ finished });
};

function Host({ initialTarget }) {
  const [target, setTarget] = useState(initialTarget);
  return (
    <MediaQuickActionsSheet
      target={target}
      onClose={() => setTarget(null)}
    />
  );
}

describe("MediaQuickActionsSheet — oylama ve kardeş modal devri", () => {
  let renderer;
  let errorSpy;

  beforeEach(() => {
    jest.useFakeTimers();
    pendingParallelCallbacks.length = 0;
    const origError = console.error;
    errorSpy = jest.spyOn(console, "error").mockImplementation((msg, ...rest) => {
      if (String(msg).includes("react-test-renderer is deprecated")) return;
      origError(msg, ...rest);
    });
  });

  afterEach(() => {
    if (renderer) act(() => renderer.unmount());
    renderer = null;
    errorSpy.mockRestore();
    jest.useRealTimers();
  });

  const sampleTarget = {
    media: {
      id: 550,
      mediaType: "movie",
      title: "Fight Club",
      poster_path: "/poster.jpg",
      release_date: "1999-10-15",
      vote_average: 8.4,
    },
  };

  test("oylamaya basınca ana Modal tamamen kapanıp settle süresi dolmadan RatingSheetModal açılmaz (iki Modal asla çakışmaz)", () => {
    act(() => {
      renderer = create(<Host initialTarget={sampleTarget} />);
    });

    const quickModal = () => renderer.root.findAllByType("Modal")[0];
    const ratingHostModal = () => renderer.root.findAllByType("Modal")[1];
    const ratingModal = () => renderer.root.findByType("RatingSheetModal");

    expect(quickModal().props.visible).toBe(true);
    expect(ratingHostModal().props.visible).toBe(false);
    expect(ratingModal().props.visible).toBe(false);

    // Kullanıcı hızlı eylem sayfasındaki oylama satırına ("Puan ver") basar
    const ratingSummary = renderer.root.findByType("RatingSummary");
    act(() => {
      ratingSummary.props.onPressRate();
    });

    // Çıkış animasyonu henüz bitmedi (ör. 250 ms geçti ama native animasyon callback'i henüz dönmedi).
    // Eski kodda 220 ms'de RatingSheetModal açılıyor ve iki Modal çakışıp iOS'u donduruyordu.
    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(quickModal().props.visible).toBe(true);
    expect(ratingHostModal().props.visible).toBe(false);
    expect(ratingModal().props.visible).toBe(false);

    // Çıkış animasyonu biter → ana Modal visible=false olur, ama native pencerenin
    // kalkması için DISMISS_SETTLE_MS (90 ms) beklenir.
    act(() => {
      flushLastParallel(true);
    });
    expect(quickModal().props.visible).toBe(false);
    expect(ratingHostModal().props.visible).toBe(false);
    expect(ratingModal().props.visible).toBe(false);

    act(() => {
      jest.advanceTimersByTime(89);
    });
    expect(ratingHostModal().props.visible).toBe(false);
    expect(ratingModal().props.visible).toBe(false);

    // 90 ms dolunca RatingSheetModal güvenle açılır ve medya bilgisini korur
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(quickModal().props.visible).toBe(false);
    expect(ratingHostModal().props.visible).toBe(true);
    expect(ratingModal().props.visible).toBe(true);
    expect(ratingModal().props.mediaId).toBe(550);
    expect(ratingModal().props.details).toEqual(
      expect.objectContaining({ title: "Fight Club" }),
    );
  });

  test("izleme geçmişinden 'Tekrar Ekle'ye basınca WatchHistorySheet tamamen kapanmadan (onDismissed) tarih sayfası açılmaz", () => {
    act(() => {
      renderer = create(<Host initialTarget={sampleTarget} />);
    });

    const historySheet = () => renderer.root.findByType("WatchHistorySheet");
    const dateSheet = () => renderer.root.findByType("WatchedDateSheet");

    act(() => {
      historySheet().props.onAddAgain();
    });

    // 300 ms geçse bile onDismissed gelmeden tarih sayfası açılmaz
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(dateSheet().props.visible).toBe(false);

    // WatchHistorySheet kapanışını tamamladığında (onDismissed) tarih sayfası açılır
    act(() => {
      historySheet().props.onDismissed();
    });
    expect(dateSheet().props.visible).toBe(true);
  });
});
