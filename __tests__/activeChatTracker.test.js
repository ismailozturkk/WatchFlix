// Aktif sohbet takibi + foreground bildirim kararı.
//
// Kök hata: tek yuvalı izleyici, üstteki ChatScreen kapanınca altta hâlâ
// görünen sohbeti "açık değil" sayıp banner bastırıyordu.

import {
  chatIdForNotification,
  enterActiveChat,
  isChatActive,
  notificationBelongsToChat,
  pairChatId,
  resetActiveChats,
} from "../services/activeChatTracker";
import {
  PRESENTED,
  SUPPRESSED,
  decideForegroundPresentation,
} from "../utils/notificationPresentation";

beforeEach(() => resetActiveChats());

describe("enterActiveChat", () => {
  test("giriş sohbeti aktif yapar, release düşürür", () => {
    const release = enterActiveChat("a_b");
    expect(isChatActive("a_b")).toBe(true);
    release();
    expect(isChatActive("a_b")).toBe(false);
  });

  test("YIĞIN: üstteki ekran kapanınca alttaki sohbet aktif kalır", () => {
    const releaseA = enterActiveChat("chatA");
    const releaseB = enterActiveChat("chatB");
    releaseB();
    expect(isChatActive("chatA")).toBe(true);
    expect(isChatActive("chatB")).toBe(false);
    releaseA();
    expect(isChatActive("chatA")).toBe(false);
  });

  test("AYNI sohbet iki kez açıksa biri kapanınca diğeri aktif kalır", () => {
    const first = enterActiveChat("chatA");
    const second = enterActiveChat("chatA");
    second();
    expect(isChatActive("chatA")).toBe(true);
    first();
    expect(isChatActive("chatA")).toBe(false);
  });

  test("release idempotent: çift çağrı başkasının sayacını düşürmez", () => {
    const first = enterActiveChat("chatA");
    enterActiveChat("chatA");
    first();
    first();
    expect(isChatActive("chatA")).toBe(true);
  });

  test("boş chatId güvenli", () => {
    const release = enterActiveChat(null);
    expect(() => release()).not.toThrow();
    expect(isChatActive(null)).toBe(false);
    expect(isChatActive(undefined)).toBe(false);
  });
});

describe("chat kimliği çözümü", () => {
  test("pairChatId büyük uid başta, sıradan bağımsız", () => {
    expect(pairChatId("aaa", "bbb")).toBe("bbb_aaa");
    expect(pairChatId("bbb", "aaa")).toBe("bbb_aaa");
    expect(pairChatId("aaa", null)).toBeNull();
  });

  test("açık chatId > groupId > fromUid çifti önceliği", () => {
    expect(chatIdForNotification({ chatId: "x_y", groupId: "g" }, "me")).toBe("x_y");
    expect(chatIdForNotification({ groupId: "g1", fromUid: "u" }, "me")).toBe("g1");
    expect(chatIdForNotification({ fromUid: "friend" }, "me")).toBe("me_friend");
    expect(chatIdForNotification({ fromUid: "friend" }, null)).toBeNull();
    expect(chatIdForNotification(null, "me")).toBeNull();
  });

  test("notificationBelongsToChat yalnız sosyal mesajlarda eşleşir", () => {
    const msg = { kind: "social", type: "message", fromUid: "friend" };
    expect(notificationBelongsToChat(msg, "me_friend", "me")).toBe(true);
    expect(notificationBelongsToChat(msg, "baska_chat", "me")).toBe(false);
    expect(
      notificationBelongsToChat({ ...msg, type: "post_like" }, "me_friend", "me"),
    ).toBe(false);
    expect(
      notificationBelongsToChat({ kind: "reminder", type: "message" }, "me_friend", "me"),
    ).toBe(false);
    expect(
      notificationBelongsToChat(
        { kind: "social", type: "message", groupId: "g1" },
        "g1",
        "me",
      ),
    ).toBe(true);
  });
});

describe("decideForegroundPresentation", () => {
  const active = (id) => id === "me_friend";
  const local = (extra = {}) => ({
    kind: "social",
    type: "message",
    local: true,
    chatId: "me_friend",
    ...extra,
  });

  test("ön planda uzak sosyal push gizlenir (yerel kopya gösteriyor)", () => {
    const remote = { kind: "social", type: "post_like", local: undefined };
    expect(
      decideForegroundPresentation({ data: remote, appActive: true, chatIsActive: active }),
    ).toBe(SUPPRESSED);
  });

  // Sunucu mesaj tetikleyicisinin push'u (functions/socialPush.js): bildirim
  // belgesi yok → yerel kopya yok. Gizlenirse ön planda mesaj bildirimi hiç çıkmaz.
  test("yerel kopyası olmayan (remoteOnly) mesaj push'u ön planda gösterilir", () => {
    const remoteOnly = { kind: "social", type: "message", remoteOnly: true, chatId: "grp-1" };
    expect(
      decideForegroundPresentation({ data: remoteOnly, appActive: true, chatIsActive: active }),
    ).toBe(PRESENTED);
  });

  test("remoteOnly push'u da izlenen sohbetten geldiyse bastırılır", () => {
    const remoteOnly = { kind: "social", type: "message", remoteOnly: true, chatId: "me_friend" };
    expect(
      decideForegroundPresentation({ data: remoteOnly, appActive: true, chatIsActive: active }),
    ).toBe(SUPPRESSED);
  });

  test("izlenen sohbetin yerel mesaj bildirimi tamamen bastırılır", () => {
    expect(
      decideForegroundPresentation({ data: local(), appActive: true, chatIsActive: active }),
    ).toBe(SUPPRESSED);
  });

  test("BAŞKA bir sohbetin mesajı yine gösterilir", () => {
    expect(
      decideForegroundPresentation({
        data: local({ chatId: "me_baska" }),
        appActive: true,
        chatIsActive: active,
      }),
    ).toBe(PRESENTED);
  });

  test("mesaj dışı yerel sosyal bildirim sohbet açıkken de gösterilir", () => {
    expect(
      decideForegroundPresentation({
        data: local({ type: "friend_request" }),
        appActive: true,
        chatIsActive: active,
      }),
    ).toBe(PRESENTED);
  });

  test("sohbet kimliği yoksa bastırma yapılmaz (bilinmeyeni gizleme)", () => {
    expect(
      decideForegroundPresentation({
        data: local({ chatId: undefined }),
        appActive: true,
        chatIsActive: active,
      }),
    ).toBe(PRESENTED);
  });

  test("hatırlatıcı / yayın bildirimleri ön planda gösterilir", () => {
    expect(
      decideForegroundPresentation({
        data: { kind: "reminder" },
        appActive: true,
        chatIsActive: active,
      }),
    ).toBe(PRESENTED);
    expect(
      decideForegroundPresentation({
        data: { kind: "streaming" },
        appActive: true,
        chatIsActive: active,
      }),
    ).toBe(PRESENTED);
  });

  test("uygulama ön planda değilse sosyal kural uygulanmaz", () => {
    expect(
      decideForegroundPresentation({
        data: { kind: "social", type: "message" },
        appActive: false,
        chatIsActive: active,
      }),
    ).toBe(PRESENTED);
  });

  test("data yoksa çökmez ve gösterir", () => {
    expect(
      decideForegroundPresentation({ data: undefined, appActive: true, chatIsActive: active }),
    ).toBe(PRESENTED);
  });

  test("rozet HİÇBİR durumda handler tarafından yazılmaz", () => {
    expect(PRESENTED.shouldSetBadge).toBe(false);
    expect(SUPPRESSED.shouldSetBadge).toBe(false);
  });
});
