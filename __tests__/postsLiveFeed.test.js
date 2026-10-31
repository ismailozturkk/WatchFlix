// Canlı akış yalnız akışı gösteren ekran odaktayken açık (context/PostsContext.js useLiveFeed).
// Eskiden dinleyici uygulama boyunca açıktı ve beğeni/kaydetme koleksiyonları her açılışta okunuyordu.
import React from "react";
import { act, create } from "react-test-renderer";

global.IS_REACT_ACT_ENVIRONMENT = true;

const mockApi = {
  unsub: jest.fn(),
  emit: null,
  subscribeToFreshFeed: jest.fn(),
  fetchFeed: jest.fn(),
  fetchMyLikedPostIds: jest.fn(),
  fetchMyBookmarkIds: jest.fn(),
};

jest.mock("../services/postsService", () => ({
  subscribeToFreshFeed: (...args) => mockApi.subscribeToFreshFeed(...args),
  fetchFeed: (...args) => mockApi.fetchFeed(...args),
  fetchMyLikedPostIds: (...args) => mockApi.fetchMyLikedPostIds(...args),
  fetchMyBookmarkIds: (...args) => mockApi.fetchMyBookmarkIds(...args),
}));
jest.mock("../services/storage", () => ({ Keys: { feed: "feed" }, get: () => null, set: jest.fn() }));
jest.mock("../utils/i18nText", () => ({ i18nText: (_k, fallback) => fallback }));
jest.mock("@components/AppToast", () => ({ __esModule: true, default: { show: jest.fn() } }));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "u1" } }) }));
jest.mock("../context/FriendsContext", () => ({ useFriends: () => ({ isBlocked: () => false }) }));
jest.mock("../context/ConnectivityContext", () => ({ getIsOnline: () => true }));
jest.mock("../hooks/useStartupGate", () => ({ __esModule: true, default: () => true }));
jest.mock("../services/crashReporting", () => ({ captureError: jest.fn() }));
jest.mock("../utils/dataCacheSettings", () => ({ shouldPersistInternetData: () => false }));
jest.mock("../services/hiddenPostsService", () => ({
  hidePost: jest.fn(),
  unhidePost: jest.fn(),
  subscribeHiddenPosts: () => () => {},
}));
// Odak = bağlı olmak: ekran açılınca odaklanır, kapanınca odak gider.
jest.mock("@react-navigation/native", () => {
  const { useEffect } = require("react");
  return { useFocusEffect: (cb) => useEffect(cb, [cb]) };
});

const { PostsProvider, usePosts, useLiveFeed } = require("../context/PostsContext");

let latest = null;
function Probe() {
  latest = usePosts();
  return null;
}
function FeedCard() {
  useLiveFeed();
  return null;
}
function FeedScreen() {
  useLiveFeed({ withMarks: true });
  return null;
}

function renderWith(children) {
  let tree;
  act(() => {
    tree = create(
      <PostsProvider>
        <Probe />
        {children}
      </PostsProvider>,
    );
  });
  return tree;
}

const post = (id) => ({ id, authorId: "a", _createdAtMs: 1 });

beforeEach(() => {
  jest.useFakeTimers();
  latest = null;
  mockApi.unsub.mockReset();
  mockApi.subscribeToFreshFeed.mockReset().mockImplementation((cb) => {
    mockApi.emit = cb;
    return mockApi.unsub;
  });
  mockApi.fetchFeed.mockReset().mockResolvedValue({ posts: [], lastDoc: null });
  mockApi.fetchMyLikedPostIds.mockReset().mockResolvedValue(new Set());
  mockApi.fetchMyBookmarkIds.mockReset().mockResolvedValue(new Set());
});

afterEach(() => {
  jest.useRealTimers();
});

test("akışı gösteren ekran yokken hiçbir akış okuması yapılmaz", () => {
  renderWith(null);
  expect(mockApi.subscribeToFreshFeed).not.toHaveBeenCalled();
  expect(mockApi.fetchFeed).not.toHaveBeenCalled();
  expect(mockApi.fetchMyLikedPostIds).not.toHaveBeenCalled();
  expect(mockApi.fetchMyBookmarkIds).not.toHaveBeenCalled();
});

test("Hub kartı odaktayken dinleyici açılır; beğeni/kaydetme okunmaz", () => {
  renderWith(<FeedCard />);
  expect(mockApi.subscribeToFreshFeed).toHaveBeenCalledTimes(1);
  expect(mockApi.fetchFeed).not.toHaveBeenCalled(); // ilk sayfa dinleyiciden gelir
  expect(mockApi.fetchMyLikedPostIds).not.toHaveBeenCalled();
});

test("odak gidince dinleyici 60 sn sonra kapanır; arada geri dönülürse yeniden kurulmaz", () => {
  const tree = renderWith(<FeedCard />);
  act(() => tree.update(<PostsProvider><Probe /></PostsProvider>));
  act(() => jest.advanceTimersByTime(30 * 1000));
  expect(mockApi.unsub).not.toHaveBeenCalled();

  act(() => tree.update(<PostsProvider><Probe /><FeedCard /></PostsProvider>));
  expect(mockApi.subscribeToFreshFeed).toHaveBeenCalledTimes(1);

  act(() => tree.update(<PostsProvider><Probe /></PostsProvider>));
  act(() => jest.advanceTimersByTime(60 * 1000));
  expect(mockApi.unsub).toHaveBeenCalledTimes(1);
});

test("akış ekranı beğeni/kaydetme kümelerini ilk girişte bir kez okur", async () => {
  renderWith(<FeedScreen />);
  await act(async () => {}); // çözülen okumaların state güncellemesi act içinde
  expect(mockApi.fetchMyLikedPostIds).toHaveBeenCalledTimes(1);
  expect(mockApi.fetchMyBookmarkIds).toHaveBeenCalledTimes(1);
});

test("önbellekten gelen ara snapshot akışı ezmez; sunucu snapshot'ı yüklemeyi bitirir", () => {
  renderWith(<FeedCard />);
  expect(latest.loading).toBe(true);
  act(() => mockApi.emit([post("eksik")], { lastDoc: null, fromCache: true }));
  expect(latest.posts).toEqual([]);
  expect(latest.loading).toBe(true);

  act(() => mockApi.emit([post("p1"), post("p2")], { lastDoc: { id: "p2" }, fromCache: false }));
  expect(latest.posts.map((p) => p.id)).toEqual(["p1", "p2"]);
  expect(latest.loading).toBe(false);
  expect(latest.hasMore).toBe(true);
});
