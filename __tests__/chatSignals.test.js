// Sohbetin "ekranda açık" bayrağı (inChat) — yazıcı mantığı.
// Okuyucu modeli (çevrimiçi / son görülme / "yazıyor") 10 Kas 2026'da silindi.

import { createChatSignals } from "../services/chatSignals";

const flush = async () => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

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

  test("bağlantı düşünce (arka plan) inChat kapatılır", async () => {
    const { signals, writes, setConn } = makeSignals();
    setConn({ uid: "me", connId: "c1" });
    signals.enterChat("a_b", "me");
    await flush();
    writes.length = 0;

    setConn(null);
    await flush();
    expect(writes).toEqual([["inChat", "a_b", "me", false]]);
  });

  test("ön plana dönünce istenen durum YENİ kimlikle yeniden yazılır", async () => {
    const { signals, writes, setConn } = makeSignals();
    setConn({ uid: "me", connId: "c1" });
    signals.enterChat("a_b", "me");
    setConn(null);
    await flush();
    writes.length = 0;

    setConn({ uid: "me", connId: "c2" });
    await flush();
    expect(writes).toEqual([["inChat", "a_b", "me", "c2"]]);
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
      },
    });
    signals.enterChat("a_b", "me");
    await flush();
    fail = false;
    listeners.forEach((fn) => fn(conn));
    await flush();
    expect(writes).toHaveLength(2);
  });

  test("sohbetten çıkış, gecikmiş giriş yazımından sonra son değer olarak uygulanır", async () => {
    let finishOpen;
    const writes = [];
    const signals = createChatSignals({
      session: {
        getConnection: () => ({ uid: "me", connId: "c1" }),
        subscribe: () => () => {},
      },
      adapter: {
        writeInChat: (_chatId, _uid, value) => {
          writes.push(value);
          if (value === "c1") return new Promise((resolve) => { finishOpen = resolve; });
          return Promise.resolve();
        },
      },
    });

    signals.enterChat("group:g1", "me");
    await flush();
    signals.leaveChat("group:g1", "me");
    await flush();
    expect(writes).toEqual(["c1"]);
    finishOpen();
    await flush();
    expect(writes).toEqual(["c1", false]);
  });

  test("hızlı çıkıp yeniden girince eski kapatma yeni açık bayrağını ezmez", async () => {
    let finishOpen;
    const writes = [];
    const signals = createChatSignals({
      session: {
        getConnection: () => ({ uid: "me", connId: "c1" }),
        subscribe: () => () => {},
      },
      adapter: {
        writeInChat: (_chatId, _uid, value) => {
          writes.push(value);
          if (writes.length === 1) return new Promise((resolve) => { finishOpen = resolve; });
          return Promise.resolve();
        },
      },
    });

    signals.enterChat("group:g1", "me");
    await flush();
    signals.leaveChat("group:g1", "me");
    signals.enterChat("group:g1", "me");
    finishOpen();
    await flush();
    expect(writes.at(-1)).toBe("c1");
  });
});
