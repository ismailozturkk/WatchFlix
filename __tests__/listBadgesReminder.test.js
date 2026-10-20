// __tests__/listBadgesReminder.test.js
//
// Poster rozet yığınındaki "hatırlatma" (zil) rozeti: components/ListBadges.js +
// hooks/useUpcomingReminder.js. Gerçek çizim (renk, boyut, konum) cihazda
// doğrulanır; burada kilitlenen şey davranış:
//   • rozet yalnız süren hatırlatması olan içerikte, doğru türde (film/dizi) çıkar,
//   • Ayarlar > Poster görünümü anahtarı ve çağıranın `hide`ı onu kapatır,
//   • yığındaki sırası ayar ekranıyla aynı (liste üyelikleri → zil → puan/yorum),
//   • hatırlatıcılar değişince YALNIZ ilgili poster yeniden çizilir.

import React from "react";
import { act, create } from "react-test-renderer";
import ListBadges from "../components/ListBadges";
import useUpcomingReminder from "../hooks/useUpcomingReminder";
import { REMINDER_BADGE } from "../utils/reminderBadge";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// ── Sahte alan: services/userData ile aynı sözleşme (getSnapshot + subscribe) ──
let mockView;
const mockListeners = new Set();
const mockSetReminders = (movies = [], episodes = []) => {
  mockView = Object.freeze({ lists: Object.freeze({ movies, episodes }) });
  act(() => mockListeners.forEach((fn) => fn()));
};

let mockSettings;
let mockListStatus;
let mockActivity;
let mockUser;

jest.mock("react-native", () => ({
  View: "View",
  StyleSheet: { create: (styles) => styles, flatten: (style) => style },
}));
jest.mock("@expo/vector-icons/Ionicons", () => {
  const React = require("react");
  return { __esModule: true, default: (props) => React.createElement("Ionicons", props) };
});
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: { colors: {} } }) }));
jest.mock("../context/AppSettingsContext", () => ({
  useListLayoutSettings: () => mockSettings,
}));
jest.mock("../context/SharedListsContext", () => ({ useSharedLists: () => ({}) }));
jest.mock("../hooks/useListStatus", () => ({ useListStatus: () => mockListStatus }));
jest.mock("../hooks/useMediaActivity", () => ({ useMediaActivity: () => mockActivity }));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock("../services/storage", () => ({ getActiveUser: () => null }));
jest.mock("../services/userData", () => ({
  remindersDomain: {
    getSnapshot: () => mockView,
    subscribe: (fn) => {
      mockListeners.add(fn);
      return () => mockListeners.delete(fn);
    },
  },
}));

const iso = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const movie = (movieId, offsetDays = 30) => ({ movieId, releaseDate: iso(offsetDays), type: "movie" });
const episode = (showId, episodeId, offsetDays = 7) => ({
  showId,
  episodeId: String(episodeId),
  airDate: iso(offsetDays),
});

function render(element) {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
}
const iconNames = (tree) => tree.root.findAllByType("Ionicons").map((node) => node.props.name);
const iconColors = (tree) => tree.root.findAllByType("Ionicons").map((node) => node.props.color);

beforeEach(() => {
  mockListeners.clear();
  mockView = Object.freeze({ lists: Object.freeze({ movies: [], episodes: [] }) });
  mockSettings = { posterBadges: {}, railPosterSize: "normal", listsGridColumns: 3 };
  mockListStatus = { inWatchList: false, isWatched: false, inFavorites: false, isInOtherLists: false };
  mockActivity = { hasRating: false, hasComment: false };
  mockUser = { uid: "u1" };
});

describe("ListBadges — zil rozeti", () => {
  test("hatırlatması olmayan posterde hiçbir şey çizilmez", () => {
    const tree = render(<ListBadges mediaId={1} mediaType="movie" />);
    expect(tree.toJSON()).toBeNull();
  });

  test("süren film hatırlatması varsa zil çizilir; simge ve renk ortak kayıttan", () => {
    mockSetReminders([movie(1)]);
    const tree = render(<ListBadges mediaId={1} mediaType="movie" />);
    expect(iconNames(tree)).toEqual([REMINDER_BADGE.icon]);
    expect(iconColors(tree)).toEqual([REMINDER_BADGE.color]);
  });

  test("başka filmin hatırlatması bu posteri etkilemez", () => {
    mockSetReminders([movie(2)]);
    expect(render(<ListBadges mediaId={1} mediaType="movie" />).toJSON()).toBeNull();
  });

  test("çıkışı geçmiş film hatırlatması rozet çıkarmaz", () => {
    mockSetReminders([movie(1, -2)]);
    expect(render(<ListBadges mediaId={1} mediaType="movie" />).toJSON()).toBeNull();
  });

  test("dizi posteri: bekleyen bölüm hatırlatması zil çıkarır, film uzayına sızmaz", () => {
    mockSetReminders([], [episode(77, "a")]);
    expect(iconNames(render(<ListBadges mediaId={77} mediaType="tv" />))).toEqual(["notifications"]);
    expect(render(<ListBadges mediaId={77} mediaType="movie" />).toJSON()).toBeNull();
  });

  test("Ayarlar > Poster görünümü'nde kapalıysa çizilmez; diğer rozetler etkilenmez", () => {
    mockSetReminders([movie(1)]);
    mockListStatus = { ...mockListStatus, inFavorites: true };
    mockSettings = { ...mockSettings, posterBadges: { reminder: false } };
    expect(iconNames(render(<ListBadges mediaId={1} mediaType="movie" />))).toEqual(["heart"]);
  });

  test("anahtar hiç yoksa (eski kayıt) açık sayılır", () => {
    mockSetReminders([movie(1)]);
    mockSettings = { ...mockSettings, posterBadges: { watchlist: true } };
    expect(iconNames(render(<ListBadges mediaId={1} mediaType="movie" />))).toEqual(["notifications"]);
  });

  test("çağıranın hide listesi yalnız o çağrı yerinde gizler", () => {
    mockSetReminders([movie(1)]);
    expect(render(<ListBadges mediaId={1} mediaType="movie" hide={["reminder"]} />).toJSON()).toBeNull();
    expect(iconNames(render(<ListBadges mediaId={1} mediaType="movie" />))).toEqual(["notifications"]);
  });

  test("yığın sırası ayar ekranıyla aynı: liste üyelikleri → zil → puan / yorum", () => {
    mockSetReminders([movie(1)]);
    mockListStatus = { inWatchList: true, isWatched: false, inFavorites: true, isInOtherLists: false };
    mockActivity = { hasRating: true, hasComment: true };
    expect(iconNames(render(<ListBadges mediaId={1} mediaType="movie" />))).toEqual([
      "bookmark",
      "heart",
      "notifications",
      "star",
      "chatbubble",
    ]);
  });

  test("arama ekranlarındaki 'chip' çeşidinde de çizilir", () => {
    mockSetReminders([movie(1)]);
    const tree = render(<ListBadges mediaId={1} mediaType="movie" variant="chip" />);
    expect(iconNames(tree)).toEqual(["notifications"]);
  });

  test("hatırlatma eklenince/kaldırılınca poster anında güncellenir", () => {
    const tree = render(<ListBadges mediaId={1} mediaType="movie" />);
    expect(tree.toJSON()).toBeNull();
    mockSetReminders([movie(1)]);
    expect(iconNames(tree)).toEqual(["notifications"]);
    mockSetReminders([]);
    expect(tree.toJSON()).toBeNull();
  });

  test("mediaId yoksa çökmez, rozet çıkmaz", () => {
    mockSetReminders([movie(1)]);
    expect(render(<ListBadges mediaId={undefined} mediaType="movie" />).toJSON()).toBeNull();
  });

  test("oturum henüz çözülmediyse (user null) çökmez", () => {
    mockUser = null;
    mockSetReminders([movie(1)]);
    expect(iconNames(render(<ListBadges mediaId={1} mediaType="movie" />))).toEqual(["notifications"]);
  });
});

describe("useUpcomingReminder — yeniden çizim kapsamı", () => {
  function Probe({ id, type = "movie", enabled = true, counter }) {
    counter.count += 1;
    const has = useUpcomingReminder(id, type, enabled);
    return React.createElement("Probe", { has });
  }

  test("bir hatırlatma değişince YALNIZ ilgili poster yeniden çizilir", () => {
    const a = { count: 0 };
    const b = { count: 0 };
    const tree = render(
      <>
        <Probe id={1} counter={a} />
        <Probe id={2} counter={b} />
      </>,
    );
    const [aBefore, bBefore] = [a.count, b.count];

    mockSetReminders([movie(1)]);
    expect(a.count).toBe(aBefore + 1);
    expect(b.count).toBe(bBefore); // dokunulmayan poster yeniden çizilmedi
    expect(tree.root.findAllByType("Probe").map((n) => n.props.has)).toEqual([true, false]);
  });

  test("ilgisiz bir hatırlatma değişimi hiçbir posteri yeniden çizmez", () => {
    const a = { count: 0 };
    render(<Probe id={1} counter={a} />);
    const before = a.count;
    mockSetReminders([movie(99)], [episode(5, "x")]);
    expect(a.count).toBe(before);
  });

  test("rozet kapalıyken (enabled=false) hiçbir değişimde yeniden çizilmez", () => {
    const a = { count: 0 };
    const tree = render(<Probe id={1} enabled={false} counter={a} />);
    const before = a.count;
    mockSetReminders([movie(1)]);
    expect(a.count).toBe(before);
    expect(tree.root.findByType("Probe").props.has).toBe(false);
  });

  test("açılıp kapanan ayar: enabled false → true olunca güncel durum okunur", () => {
    mockSetReminders([movie(1)]);
    const a = { count: 0 };
    let tree;
    act(() => {
      tree = create(<Probe id={1} enabled={false} counter={a} />);
    });
    expect(tree.root.findByType("Probe").props.has).toBe(false);
    act(() => tree.update(<Probe id={1} enabled counter={a} />));
    expect(tree.root.findByType("Probe").props.has).toBe(true);
  });

  test("söküldüğünde aboneliği bırakır (sızıntı yok)", () => {
    const a = { count: 0 };
    const tree = render(<Probe id={1} counter={a} />);
    expect(mockListeners.size).toBe(1);
    act(() => tree.unmount());
    expect(mockListeners.size).toBe(0);
  });
});
