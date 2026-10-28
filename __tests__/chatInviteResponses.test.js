// __tests__/chatInviteResponses.test.js
//
// Sohbetteki davet kartlarının (düello / CineSwipe odası) YANIT modeli ve Profil çubuğu ↔ sohbet eşlemesi:
//   • saf çekirdek (utils/chatInvites): yanıtlayanlar, izleyicinin yanıtı, CineSwipe kartının fazları
//   • mesaja yazım (services/chatInviteService): yol, alan, bitiş kaydı — Firestore taklit
//   • davet bildirimi kartın kimliğini taşır (services/socialNotificationsService)
//   • Profil çubuğundan yanıt mesaja da yazılır (context/NotificationsContext.respond)
//   • kart kimliği CineSwipe'a taşınır (importantInvites / chatShare rotaları)
//   • metin tablosu bekçisi (utils/cineInviteCopy)

import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("../firebase", () => ({ db: {} }));
const mockUpdates = [];
const mockBatchSets = [];
jest.mock("firebase/firestore", () => ({
  // doc(koleksiyon) = otomatik kimlik.
  doc: (first, ...parts) => ({ path: parts.length ? parts.join("/") : `${first.path}/auto` }),
  collection: (_db, ...parts) => ({ path: parts.join("/") }),
  updateDoc: jest.fn(async (ref, patch) => {
    mockUpdates.push({ path: ref.path, patch });
  }),
  serverTimestamp: () => "NOW",
  increment: (n) => ({ increment: n }),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: (...args) => args,
  where: (...args) => args,
  limit: (n) => n,
  writeBatch: () => ({
    set: (ref, data) => mockBatchSets.push({ path: ref.path, data }),
    update: () => {},
    commit: async () => {},
  }),
}));
jest.mock("../services/groupsService", () => ({ queueGroupUnreadIncrements: jest.fn() }));

// NotificationsContext bağımlılıkları: gelen kutusu taklidi, kart yazımı gözlenir (gerçeği aşağıda requireActual).
let mockItems = [];
const mockRespondApi = jest.fn();
jest.mock("../services/notificationsService", () => ({
  subscribeToNotifications: (_uid, callback) => {
    callback(mockItems, {});
    return () => {};
  },
  markNotificationRead: jest.fn(),
  markAllNotificationsRead: jest.fn(),
  deleteNotification: jest.fn(),
  respondToInvitation: (...args) => mockRespondApi(...args),
}));
const mockWriteInviteResponse = jest.fn(async () => true);
jest.mock("../services/chatInviteService", () => ({
  ...jest.requireActual("../services/chatInviteService"),
  writeInviteResponse: (...args) => mockWriteInviteResponse(...args),
}));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "me" } }) }));
jest.mock("../hooks/useStartupGate", () => ({ __esModule: true, default: () => true }));

const fs = require("fs");
const path = require("path");
const {
  CINE_INVITE_ACCEPTED_MS,
  CINE_INVITE_OPEN_MS,
  cineInviteDone,
  cineInviteView,
  inviteResponders,
  isInviteMessageId,
  myInviteResponse,
} = require("../utils/chatInvites");
const actualService = jest.requireActual("../services/chatInviteService");
const { createSocialNotification } = require("../services/socialNotificationsService");
const { invitationDestination } = require("../utils/importantInvites");
const { buildCineRoomShare, shareRoute } = require("../utils/chatShare");
const { CINE_INVITE_COPY, getCineInviteCopy } = require("../utils/cineInviteCopy");
const { NotificationsProvider, useNotifications } = require("../context/NotificationsContext");

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const NOW = new Date("2026-10-29T12:00:00Z").getTime();

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdates.length = 0;
  mockBatchSets.length = 0;
  mockItems = [];
});

describe("saf çekirdek (utils/chatInvites)", () => {
  test("yanıtlayanlar: geçerli uid + dolu değer; izleyicinin yanıtı kabul önce", () => {
    expect(inviteResponders({ bob: { seconds: 1 }, "a/b": 1, eve: null })).toEqual(["bob"]);
    expect(inviteResponders(["bob"])).toEqual([]);
    expect(myInviteResponse({ accepts: { me: 1 }, uid: "me" })).toBe("accepted");
    expect(myInviteResponse({ declines: { me: 1 }, uid: "me" })).toBe("declined");
    expect(myInviteResponse({ accepts: { bob: 1 }, uid: "me" })).toBeNull();
    expect(myInviteResponse({ accepts: { me: 1 }, uid: null })).toBeNull();
  });

  test("mesaj kimliği yol parçası olarak güvenli olmalı", () => {
    expect(isInviteMessageId("AbC123_-x")).toBe(true);
    ["", "a/b", "../x", 42, null, "x".repeat(65)].forEach((id) => expect(isInviteMessageId(id)).toBe(false));
  });

  test("bitiş kaydı: sayı bozuksa null ama kart yine 'bitti'", () => {
    expect(cineInviteDone({ at: 1, matches: 3 })).toEqual({ matches: 3 });
    expect(cineInviteDone({ at: 1, matches: -1 })).toEqual({ matches: null });
    expect(cineInviteDone(null)).toBeNull();
  });

  const view = (props) => cineInviteView({ viewerUid: "me", sentAt: NOW - 1000, now: NOW, ...props });

  test("alıcı: bekliyor → kabul / ret; bitiş her şeyin önünde", () => {
    expect(view({ isOutgoing: false }).phase).toBe("pending");
    expect(view({ isOutgoing: false, accepts: { me: 1 } })).toMatchObject({ phase: "accepted", mine: "accepted" });
    expect(view({ isOutgoing: false, declines: { me: 1 } })).toMatchObject({ phase: "declined", mine: "declined" });
    // Başka bir grup üyesinin reddi benim kartımı değiştirmez.
    expect(view({ isOutgoing: false, declines: { bob: 1 } }).phase).toBe("pending");
    expect(view({ isOutgoing: false, accepts: { me: 1 }, done: { matches: 2 } })).toMatchObject({ phase: "done", matches: 2 });
  });

  test("gönderen: bekliyor → kabul edildi (öncelikli) / reddedildi; sayılar", () => {
    expect(view({ isOutgoing: true }).phase).toBe("pending");
    expect(view({ isOutgoing: true, declines: { bob: 1 } })).toMatchObject({ phase: "declined", declinedCount: 1, mine: null });
    expect(view({ isOutgoing: true, accepts: { eve: 1 }, declines: { bob: 1 } })).toMatchObject({
      phase: "accepted",
      acceptedCount: 1,
      declinedCount: 1,
    });
  });

  test("süre: yanıtsız 24 sa, kabul edilmiş ama bitmemiş 48 sa; zaman yokken süre işlemez; ret ve bitiş süreye takılmaz", () => {
    const old = (ms) => NOW - ms;
    expect(view({ isOutgoing: false, sentAt: old(CINE_INVITE_OPEN_MS) }).phase).toBe("expired");
    expect(view({ isOutgoing: false, sentAt: old(CINE_INVITE_OPEN_MS - 1) }).phase).toBe("pending");
    expect(view({ isOutgoing: false, sentAt: old(CINE_INVITE_OPEN_MS), accepts: { me: 1 } }).phase).toBe("accepted");
    expect(view({ isOutgoing: false, sentAt: old(CINE_INVITE_ACCEPTED_MS), accepts: { me: 1 } }).phase).toBe("expired");
    expect(view({ isOutgoing: true, sentAt: old(CINE_INVITE_OPEN_MS) }).phase).toBe("expired");
    expect(view({ isOutgoing: false, sentAt: null }).phase).toBe("pending");
    expect(view({ isOutgoing: false, sentAt: { toMillis: () => old(CINE_INVITE_OPEN_MS * 3) }, declines: { me: 1 } }).phase).toBe("declined");
    expect(view({ isOutgoing: true, sentAt: old(CINE_INVITE_OPEN_MS * 3), done: { matches: 0 } }).phase).toBe("done");
  });
});

describe("mesaja yazım (services/chatInviteService)", () => {
  test("yol: grup mesajı ya da sıralı uid'li 1-1 sohbet; kendime / geçersiz kimlik null", () => {
    expect(actualService.inviteMessageRef({ groupId: "g1" }, "m1", "me").path).toBe("groups/g1/messages/m1");
    expect(actualService.inviteMessageRef({ friendUid: "ali" }, "m1", "me").path).toBe("chats/me_ali/messages/m1");
    expect(actualService.inviteMessageRef({ friendUid: "zed" }, "m1", "me").path).toBe("chats/zed_me/messages/m1");
    expect(actualService.inviteMessageRef({ friendUid: "me" }, "m1", "me")).toBeNull();
    expect(actualService.inviteMessageRef({ friendUid: "ali" }, "../m", "me")).toBeNull();
    expect(actualService.inviteMessageRef(null, "m1", "me")).toBeNull();
  });

  test("yanıt yalnız kendi anahtarıma; geçersiz yanıt yazılmaz", async () => {
    expect(actualService.inviteResponsePatch("me", "accepted")).toEqual({ "accepts.me": "NOW" });
    expect(actualService.inviteResponsePatch("me", "declined")).toEqual({ "declines.me": "NOW" });
    expect(actualService.inviteResponsePatch("me", "maybe")).toBeNull();
    await expect(
      actualService.writeInviteResponse({ uid: "me", chat: { friendUid: "ali" }, messageId: "m1", response: "declined" }),
    ).resolves.toBe(true);
    expect(mockUpdates).toEqual([{ path: "chats/me_ali/messages/m1", patch: { "declines.me": "NOW" } }]);
    // Eski bildirim: mesaj kimliği yok → yazım yok.
    await expect(
      actualService.writeInviteResponse({ uid: "me", chat: { friendUid: "ali" }, messageId: undefined, response: "accepted" }),
    ).resolves.toBe(false);
    expect(mockUpdates).toHaveLength(1);
  });

  test("CineSwipe bitiş kaydı: zaman + eşleşme sayısı (sınırlı)", async () => {
    await actualService.markCineInviteDone({ uid: "me", chat: { groupId: "g1" }, messageId: "m1", matches: 3 });
    await actualService.markCineInviteDone({ uid: "me", chat: { groupId: "g1" }, messageId: "m2", matches: 5000 });
    await actualService.markCineInviteDone({ uid: "me", chat: { groupId: "g1" }, messageId: "m3", matches: "x" });
    expect(mockUpdates.map((u) => u.patch.done)).toEqual([
      { at: "NOW", matches: 3 },
      { at: "NOW", matches: 1000 },
      { at: "NOW", matches: 0 },
    ]);
    await expect(actualService.markCineInviteDone({ uid: "me", chat: null, messageId: "m1", matches: 1 })).resolves.toBe(false);
  });
});

describe("davet bildirimi kartın kimliğini taşır", () => {
  test("yalnız davet türlerinde ve geçerli kimlikte", async () => {
    const base = { toUid: "bob", fromUid: "me", fromName: "Ben" };
    await createSocialNotification({ ...base, type: "game_challenge", dayKey: "2026-10-29", messageId: "m1" });
    await createSocialNotification({ ...base, type: "cineswipe_invite", inviteCode: "123456", messageId: "m2" });
    await createSocialNotification({ ...base, type: "post_like", postId: "p1", messageId: "m3" });
    await createSocialNotification({ ...base, type: "game_challenge", dayKey: "2026-10-29", messageId: "a/b" });
    const written = mockBatchSets.filter((s) => s.path.endsWith("/notifications/auto")).map((s) => s.data.messageId);
    expect(written).toEqual(["m1", "m2", undefined, undefined]);
  });
});

describe("kart kimliği CineSwipe'a taşınır", () => {
  test("Profil çubuğundan kabul: sohbet + kart kimliği odaya gider; eski kayıtta kimlik yok", () => {
    const item = { type: "cineswipe_invite", inviteCode: "123456", fromUid: "ali", fromName: "Ali", messageId: "m1" };
    expect(invitationDestination(item).params).toMatchObject({
      inviteChat: { friendUid: "ali", friendName: "Ali" },
      inviteMessageId: "m1",
    });
    expect(invitationDestination({ ...item, messageId: undefined }).params).not.toHaveProperty("inviteMessageId");
    expect(invitationDestination({ ...item, fromUid: undefined }).params).not.toHaveProperty("inviteMessageId");
  });

  test("sohbet kartından: kimlik yalnız sohbet hedefiyle birlikte", () => {
    const share = buildCineRoomShare({ code: "749215" });
    expect(shareRoute(share, { inviteChat: { groupId: "g1" }, inviteMessageId: "m1" }).params.inviteMessageId).toBe("m1");
    expect(shareRoute(share, { inviteMessageId: "m1" }).params).not.toHaveProperty("inviteMessageId");
    expect(shareRoute(share, { inviteChat: { groupId: "g1" }, inviteMessageId: "a/b" }).params).not.toHaveProperty("inviteMessageId");
  });
});

describe("Profil çubuğundan yanıt sohbet kartına da yazılır (NotificationsContext.respond)", () => {
  let ctx;
  let renderer;
  const Probe = () => {
    ctx = useNotifications();
    return null;
  };
  const mount = () => {
    act(() => {
      renderer = create(
        <NotificationsProvider>
          <Probe />
        </NotificationsProvider>,
      );
    });
  };
  afterEach(() => {
    if (renderer) act(() => renderer.unmount());
    renderer = null;
  });

  test("kayıt yanıtlanınca aynı yanıt kartın mesajına gider (grup / 1-1)", async () => {
    mockItems = [
      { id: "n1", type: "game_challenge", fromUid: "ali", dayKey: "2026-10-29", messageId: "m1" },
      { id: "n2", type: "cineswipe_invite", fromUid: "ali", inviteCode: "123456", groupId: "g1", groupName: "Film", messageId: "m2" },
    ];
    mockRespondApi.mockResolvedValue(true);
    mount();
    await act(async () => {
      await expect(ctx.respond("n1", "declined")).resolves.toBe(true);
      await ctx.respond("n2", "accepted");
    });
    expect(mockRespondApi).toHaveBeenCalledWith("me", "n1", "declined");
    expect(mockWriteInviteResponse).toHaveBeenNthCalledWith(1, {
      uid: "me",
      chat: { friendUid: "ali", friendName: "" },
      messageId: "m1",
      response: "declined",
    });
    expect(mockWriteInviteResponse).toHaveBeenNthCalledWith(2, {
      uid: "me",
      chat: { groupId: "g1", groupName: "Film" },
      messageId: "m2",
      response: "accepted",
    });
  });

  test("kayıt yanıtlanamadıysa (zaten yanıtlı) kart yazılmaz; kart yazımı düşse de yanıt döner", async () => {
    mockItems = [{ id: "n1", type: "game_challenge", fromUid: "ali", dayKey: "2026-10-29", messageId: "m1" }];
    mockRespondApi.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    mockWriteInviteResponse.mockRejectedValueOnce(new Error("permission-denied"));
    mount();
    await act(async () => {
      await expect(ctx.respond("n1", "accepted")).resolves.toBe(false);
    });
    expect(mockWriteInviteResponse).not.toHaveBeenCalled();
    await act(async () => {
      await expect(ctx.respond("n1", "accepted")).resolves.toBe(true);
    });
    expect(mockWriteInviteResponse).toHaveBeenCalledTimes(1);
  });
});

describe("metin tablosu (utils/cineInviteCopy)", () => {
  test("her anahtar CineSwipe davet kartında kullanılıyor; bilinmeyen dil İngilizce", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "components/chat/SharedCineRoomMessage.js"), "utf8");
    const unused = Object.keys(CINE_INVITE_COPY.tr).filter((key) => !new RegExp(`copy\\.${key}\\b`).test(src));
    expect(unused).toEqual([]);
    expect(getCineInviteCopy("zz")).toBe(CINE_INVITE_COPY.en);
    expect(getCineInviteCopy("de").statusDone).toBe("Beendet");
  });
});
