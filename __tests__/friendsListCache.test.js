// Arkadaş listesi canlı dinlenmez: profil belgesindeki friendsCount damgası değişince ya da kayıt
// bayatlayınca bir kez okunur (context/FriendsContext.js, maliyet analizi Aşama 2).
import React from "react";
import { act, create } from "react-test-renderer";

global.IS_REACT_ACT_ENVIRONMENT = true;

const mockStore = new Map();
jest.mock("../utils/cacheStore", () => ({
  getJSON: (ns, key, { maxAge } = {}) => {
    const entry = mockStore.get(`${ns}/${key}`);
    if (!entry || (maxAge && Date.now() - entry.t > maxAge)) return null;
    return entry.v;
  },
  setJSON: (ns, key, v) => mockStore.set(`${ns}/${key}`, { t: Date.now(), v }),
}));

const mockServer = { friends: [] };
const mockFetchFriends = jest.fn(async () => mockServer.friends);
const mockSubscribeFriends = jest.fn(() => () => {});
jest.mock("../services/friendsService", () => ({
  fetchFriends: (...args) => mockFetchFriends(...args),
  subscribeToFriends: (...args) => mockSubscribeFriends(...args),
  subscribeToIncomingRequests: (_uid, cb) => (cb([]), () => {}),
  subscribeToOutgoingRequests: (_uid, cb) => (cb([]), () => {}),
  subscribeToBlocked: (_uid, cb) => (cb([]), () => {}),
  sendFriendRequest: jest.fn(),
  acceptFriendRequest: jest.fn(),
  declineFriendRequest: jest.fn(),
  cancelFriendRequest: jest.fn(),
  unfriend: jest.fn(),
  blockUser: jest.fn(),
  unblockUser: jest.fn(),
  checkRelationship: jest.fn(),
}));
const mockProfile = { current: null };
jest.mock("../context/UserProfileContext", () => ({
  useUserProfile: () => ({ profile: mockProfile.current }),
}));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "u1" } }) }));
jest.mock("../services/userService", () => ({ getUserProfile: jest.fn() }));
jest.mock("../utils/i18nText", () => ({ i18nText: (_k, fallback) => fallback }));
jest.mock("@components/AppToast", () => ({ __esModule: true, default: { show: jest.fn() } }));
jest.mock("../hooks/useStartupGate", () => ({ __esModule: true, default: () => true }));
jest.mock("../hooks/useAppActive", () => ({ __esModule: true, default: () => true }));
jest.mock("../hooks/usePremiumGate", () => ({
  usePremiumGate: () => ({ allowed: true, check: () => true, limit: Infinity }),
}));

const { FriendsProvider, useFriends } = require("../context/FriendsContext");

let latest = null;
function Probe() {
  latest = useFriends();
  return null;
}
const friend = (uid) => ({ id: uid, friendUid: uid, friendName: uid });

async function render(tree) {
  const element = (
    <FriendsProvider>
      <Probe />
    </FriendsProvider>
  );
  if (tree) {
    await act(async () => tree.update(element));
    return tree;
  }
  let created;
  await act(async () => {
    created = create(element);
  });
  return created;
}

beforeEach(() => {
  mockStore.clear();
  mockFetchFriends.mockClear();
  mockServer.friends = [friend("a"), friend("b")];
  mockProfile.current = { friendsCount: 2 };
});

test("canlı arkadaş dinleyicisi açılmaz; liste bir kez okunur", async () => {
  const tree = await render();
  expect(mockSubscribeFriends).not.toHaveBeenCalled();
  expect(mockFetchFriends).toHaveBeenCalledTimes(1);
  expect(latest.friends.map((f) => f.id)).toEqual(["a", "b"]);
  expect(latest.isFriend("a")).toBe(true);
  expect(latest.loading).toBe(false);
  act(() => tree.unmount());
});

test("yeni oturumda sayaç aynıysa okuma yok, önbellekten gelir", async () => {
  let tree = await render();
  act(() => tree.unmount());
  mockFetchFriends.mockClear();
  tree = await render();
  expect(mockFetchFriends).not.toHaveBeenCalled();
  expect(latest.friends.map((f) => f.id)).toEqual(["a", "b"]);
  act(() => tree.unmount());
});

test("arkadaşlık bitince (sayaç değişir) liste yeniden okunur", async () => {
  const tree = await render();
  mockServer.friends = [friend("a")];
  mockProfile.current = { friendsCount: 1 };
  await render(tree);
  expect(mockFetchFriends).toHaveBeenCalledTimes(2);
  expect(latest.isFriend("b")).toBe(false);
  act(() => tree.unmount());
});

test("profil belgesi gelmeden okuma yapılmaz", async () => {
  mockProfile.current = null;
  const tree = await render();
  expect(mockFetchFriends).not.toHaveBeenCalled();
  expect(latest.loading).toBe(true);
  act(() => tree.unmount());
});
