// Sohbet sinyalleri (inChat / typing) + presence okuyucu modeli.

import {
  createChatSignals,
  createTypingController,
  resolveFriendSignals,
  TYPING_IDLE_MS,
} from "../services/chatSignals";
import {
  isLiveFlag,
  isOnlineEffective,
  isOnlineVisible,
  lastSeenMs,
  liveConnectionIds,
} from "../services/presenceModel";

const flush = async () => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

// ─── presenceModel ──────────────────────────────────────────────────────────
describe("presenceModel", () => {
  test("çevrimiçi = en az bir canlı bağlantı kaydı", () => {
    expect(isOnlineEffective({ conns: { a: 1 } })).toBe(true);
    expect(isOnlineEffective({ conns: { a: 1, b: 2 } })).toBe(true);
    expect(isOnlineEffective({ conns: {} })).toBe(false);
    expect(isOnlineEffective({ lastSeen: 5 })).toBe(false);
    expect(isOnlineEffective(null)).toBe(false);
  });

  test("ESKİ ŞEMANIN takılı isOnline:true kalıntısı çevrimiçi sayılmaz", () => {
    expect(isOnlineEffective({ isOnline: true, lastActiveAt: 1 })).toBe(false);
  });

  test("liveConnectionIds null değerli kayıtları saymaz", () => {
    expect(liveConnectionIds({ conns: { a: 1, b: null } })).toEqual(["a"]);
    expect(liveConnectionIds(undefined)).toEqual([]);
  });

  test("isLiveFlag: bayrak yalnız kaydı duran bağlantıya aitse geçerli", () => {
    const presence = { conns: { c1: 100 } };
    expect(isLiveFlag("c1", presence)).toBe(true);
    expect(isLiveFlag("c-dead", presence)).toBe(false);
    expect(isLiveFlag(false, presence)).toBe(false);
    expect(isLiveFlag("", presence)).toBe(false);
    expect(isLiveFlag("c1", null)).toBe(false);
    expect(isLiveFlag("c1", { conns: {} })).toBe(false);
    // Eski istemcinin boolean'ı artık geçerli sayılmaz (takılı kalabiliyordu).
    expect(isLiveFlag(true, presence)).toBe(false);
  });

  test("gizlilik: 'none' hiç göstermez, 'friends' arkadaş değilse göstermez", () => {
    const online = { conns: { a: 1 } };
    expect(isOnlineVisible(online, { onlineStatus: "none" }, { viewerIsFriend: true })).toBe(false);
    expect(isOnlineVisible(online, { onlineStatus: "friends" }, { viewerIsFriend: false })).toBe(false);
    expect(isOnlineVisible(online, { onlineStatus: "friends" }, { viewerIsFriend: true })).toBe(true);
    expect(isOnlineVisible(online, null)).toBe(true);
    expect(isOnlineVisible({ lastSeen: 1 }, null)).toBe(false);
  });

  test("lastSeenMs sayı ve Timestamp'i okur", () => {
    expect(lastSeenMs({ lastSeen: 1234 })).toBe(1234);
    expect(lastSeenMs({ lastSeen: { toMillis: () => 99 } })).toBe(99);
    expect(lastSeenMs({})).toBeNull();
    expect(lastSeenMs(null)).toBeNull();
  });
});

// ─── resolveFriendSignals ───────────────────────────────────────────────────
describe("resolveFriendSignals", () => {
  const meta = { inChat: { f: "c1" }, typing: { f: "c1" } };

  test("bağlantısı canlıysa ikisi de açık", () => {
    expect(resolveFriendSignals(meta, { conns: { c1: 1 } }, "f")).toEqual({
      typing: true,
      inChat: true,
    });
  });

  test("KÖK HATA: arkadaşın soketi öldüyse (kayıt yok) bayraklar takılı kalmaz", () => {
    expect(resolveFriendSignals(meta, { lastSeen: 5 }, "f")).toEqual({
      typing: false,
      inChat: false,
    });
    expect(resolveFriendSignals(meta, null, "f")).toEqual({ typing: false, inChat: false });
  });

  test("başka bir bağlantının kaydı (eski soket) bayrağı canlı yapmaz", () => {
    expect(resolveFriendSignals(meta, { conns: { c2: 1 } }, "f").inChat).toBe(false);
  });

  test("meta boşsa güvenli", () => {
    expect(resolveFriendSignals(null, { conns: { c1: 1 } }, "f")).toEqual({
      typing: false,
      inChat: false,
    });
  });
});

// ─── createTypingController ─────────────────────────────────────────────────
describe("createTypingController", () => {
  test("ilk tuşta HEMEN yazıyor, sonraki tuşlar yeniden yazmaz", () => {
    const send = jest.fn();
    const c = createTypingController({ send });
    c.input(true);
    c.input(true);
    c.input(true);
    expect(send.mock.calls).toEqual([[true]]);
  });

  test("hareketsizlikte kapanır (metin kutuda dursa bile)", () => {
    const send = jest.fn();
    const c = createTypingController({ send });
    c.input(true);
    jest.advanceTimersByTime(TYPING_IDLE_MS + 1);
    expect(send.mock.calls).toEqual([[true], [false]]);
    expect(c.isTyping()).toBe(false);
  });

  test("her tuş hareketsizlik sayacını uzatır", () => {
    const send = jest.fn();
    const c = createTypingController({ send });
    c.input(true);
    jest.advanceTimersByTime(TYPING_IDLE_MS - 500);
    c.input(true);
    jest.advanceTimersByTime(TYPING_IDLE_MS - 500);
    expect(send.mock.calls).toEqual([[true]]);
    jest.advanceTimersByTime(600);
    expect(send.mock.calls).toEqual([[true], [false]]);
  });

  test("boş girdi, stop ve tekrarlı stop doğru davranır", () => {
    const send = jest.fn();
    const c = createTypingController({ send });
    c.input(true);
    c.input(false);
    c.stop();
    c.stop();
    expect(send.mock.calls).toEqual([[true], [false]]);
  });

  test("stop sonrası bekleyen zamanlayıcı sızmaz", () => {
    const send = jest.fn();
    const c = createTypingController({ send });
    c.input(true);
    c.stop();
    jest.advanceTimersByTime(TYPING_IDLE_MS * 3);
    expect(send.mock.calls).toEqual([[true], [false]]);
  });
});

// ─── createChatSignals ──────────────────────────────────────────────────────
function makeSignals() {
  let conn = null;
  const listeners = new Set();
  const session = {
    getConnection: () => conn,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  const writes = [];
  const adapter = {
    writeInChat: (chatId, uid, value) => writes.push(["inChat", chatId, uid, value]),
    writeTyping: (chatId, uid, value) => writes.push(["typing", chatId, uid, value]),
  };
  const signals = createChatSignals({ session, adapter });
  return {
    signals,
    writes,
    setConn: (next) => {
      conn = next;
      listeners.forEach((fn) => fn(conn));
    },
  };
}

describe("createChatSignals", () => {
  test("bağlantı yokken sohbete girmek hiçbir şey yazmaz", async () => {
    const { signals, writes } = makeSignals();
    signals.enterChat("a_b", "me");
    await flush();
    expect(writes).toEqual([]);
  });

  test("bağlantı gelince inChat bağlantı kimliğiyle yazılır", async () => {
    const { signals, writes, setConn } = makeSignals();
    signals.enterChat("a_b", "me");
    setConn({ uid: "me", connId: "c1" });
    await flush();
    expect(writes).toEqual([["inChat", "a_b", "me", "c1"]]);
  });

  test("bağlantı düşünce (arka plan) inChat/typing kapatılır", async () => {
    const { signals, writes, setConn } = makeSignals();
    setConn({ uid: "me", connId: "c1" });
    signals.enterChat("a_b", "me");
    signals.setTyping("a_b", "me", true);
    await flush();
    writes.length = 0;

    setConn(null);
    await flush();
    expect(writes).toEqual(
      expect.arrayContaining([
        ["inChat", "a_b", "me", false],
        ["typing", "a_b", "me", false],
      ]),
    );
  });

  test("ön plana dönünce istenen durum YENİ kimlikle yeniden yazılır", async () => {
    const { signals, writes, setConn } = makeSignals();
    setConn({ uid: "me", connId: "c1" });
    signals.enterChat("a_b", "me");
    signals.setTyping("a_b", "me", true);
    setConn(null);
    await flush();
    writes.length = 0;

    setConn({ uid: "me", connId: "c2" });
    await flush();
    expect(writes).toEqual(
      expect.arrayContaining([
        ["inChat", "a_b", "me", "c2"],
        ["typing", "a_b", "me", "c2"],
      ]),
    );
  });

  test("yığında iki ekran: biri kapanınca bayrak açık kalır, sonuncusu kapatır", async () => {
    const { signals, writes, setConn } = makeSignals();
    setConn({ uid: "me", connId: "c1" });
    signals.enterChat("a_b", "me");
    signals.enterChat("a_b", "me");
    await flush();
    writes.length = 0;

    signals.leaveChat("a_b", "me");
    await flush();
    expect(writes).toEqual([]);

    signals.leaveChat("a_b", "me");
    await flush();
    expect(writes).toEqual(
      expect.arrayContaining([["inChat", "a_b", "me", false]]),
    );
  });

  test("aynı değer tekrar yazılmaz", async () => {
    const { signals, writes, setConn } = makeSignals();
    setConn({ uid: "me", connId: "c1" });
    signals.enterChat("a_b", "me");
    setConn({ uid: "me", connId: "c1" });
    setConn({ uid: "me", connId: "c1" });
    await flush();
    expect(writes.filter((w) => w[0] === "inChat")).toHaveLength(1);
  });

  test("başka kullanıcının bağlantısı bu kullanıcının bayrağına yazılmaz", async () => {
    const { signals, writes, setConn } = makeSignals();
    signals.enterChat("a_b", "me");
    setConn({ uid: "someone-else", connId: "x1" });
    await flush();
    expect(writes).toEqual([]);
  });

  test("yazım başarısız olursa bir sonraki eşitlemede yeniden denenir", async () => {
    let fail = true;
    const writes = [];
    let conn = { uid: "me", connId: "c1" };
    const listeners = new Set();
    const signals = createChatSignals({
      session: {
        getConnection: () => conn,
        subscribe: (fn) => {
          listeners.add(fn);
          return () => listeners.delete(fn);
        },
      },
      adapter: {
        writeInChat: (...args) => {
          writes.push(args);
          return fail ? Promise.reject(new Error("x")) : Promise.resolve();
        },
        writeTyping: () => {},
      },
    });
    signals.enterChat("a_b", "me");
    await flush();
    fail = false;
    listeners.forEach((fn) => fn(conn));
    await flush();
    expect(writes).toHaveLength(2);
  });
});
