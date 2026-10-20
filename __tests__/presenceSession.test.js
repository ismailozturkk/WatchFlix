// Presence yazıcı durum makinesi — sahte RTDB/AppState ile.
//
// Kök hata: kullanıcı sohbetteyken uygulamayı doğrudan kapatınca sonsuza dek
// "çevrimiçi" kalıyordu. Burada her senaryo, çevrimiçi kaydının yalnız
// "soket açık + ön plan + oturum" iken durduğunu ve temizlik sırasının
// bozulmadığını kanıtlar.

import {
  INACTIVE_GRACE_MS,
  OP_TIMEOUT_MS,
  createPresenceSession,
} from "../services/presenceSession";

const flush = async () => {
  for (let i = 0; i < 30; i += 1) await Promise.resolve();
};

function makeAdapter({ appState = "active" } = {}) {
  const log = [];
  let connectedCb = null;
  let appStateCb = null;
  let seq = 0;
  const fail = new Set(); // "markOffline" gibi op adları
  const hang = new Set();

  const op = (name, ...args) => {
    log.push([name, ...args]);
    if (hang.has(name)) return new Promise(() => {});
    if (fail.has(name)) return Promise.reject(new Error(`${name} failed`));
    return Promise.resolve();
  };

  const adapter = {
    getAppState: () => appState,
    subscribeConnected: (cb) => {
      connectedCb = cb;
      return () => {
        connectedCb = null;
      };
    },
    subscribeAppState: (cb) => {
      appStateCb = cb;
      return () => {
        appStateCb = null;
      };
    },
    newConnId: (uid) => `${uid}-c${++seq}`,
    arm: (uid, id) => op("arm", uid, id),
    disarm: (uid, id) => op("disarm", uid, id),
    markOnline: (uid, id, stale) => op("online", uid, id, stale),
    markOffline: (uid, id) => op("offline", uid, id),
  };

  return {
    adapter,
    log,
    fail,
    hang,
    setConnected: (v) => connectedCb?.(v),
    setAppState: (s) => appStateCb?.(s),
    names: () => log.map((entry) => entry[0]),
    clear: () => {
      log.length = 0;
    },
  };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("çevrimiçi olma", () => {
  test("önce onDisconnect kurulur, SONRA kayıt yazılır", async () => {
    const f = makeAdapter();
    const s = createPresenceSession(f.adapter);
    s.start("u1");
    f.setConnected(true);
    await flush();
    expect(f.log).toEqual([
      ["arm", "u1", "u1-c1"],
      ["online", "u1", "u1-c1", null],
    ]);
    expect(s.getConnection()).toEqual({ uid: "u1", connId: "u1-c1" });
  });

  test("soket yokken yazmaz", async () => {
    const f = makeAdapter();
    const s = createPresenceSession(f.adapter);
    s.start("u1");
    await flush();
    expect(f.log).toEqual([]);
    expect(s.getConnection()).toBeNull();
  });

  test("uygulama arka planda başlarsa bağlansa bile çevrimiçi yazmaz", async () => {
    const f = makeAdapter({ appState: "background" });
    const s = createPresenceSession(f.adapter);
    s.start("u1");
    f.setConnected(true);
    await flush();
    expect(f.log).toEqual([]);

    f.setAppState("active");
    await flush();
    expect(f.names()).toEqual(["arm", "online"]);
  });

  test("aynı kullanıcı için start tekrarı bir şey yapmaz", async () => {
    const f = makeAdapter();
    const s = createPresenceSession(f.adapter);
    s.start("u1");
    f.setConnected(true);
    await flush();
    f.clear();
    s.start("u1");
    await flush();
    expect(f.log).toEqual([]);
  });
});

describe("ön plan / arka plan", () => {
  test("arka plana geçince önce kayıt silinir, SONRA onDisconnect iptal edilir", async () => {
    const f = makeAdapter();
    const s = createPresenceSession(f.adapter);
    s.start("u1");
    f.setConnected(true);
    await flush();
    f.clear();

    f.setAppState("background");
    await flush();
    expect(f.log).toEqual([
      ["offline", "u1", "u1-c1"],
      ["disarm", "u1", "u1-c1"],
    ]);
    expect(s.getConnection()).toBeNull();
  });

  test("ön plana dönünce onDisconnect YENİDEN kurulur, aynı soket kimliği kullanılır", async () => {
    const f = makeAdapter();
    const s = createPresenceSession(f.adapter);
    s.start("u1");
    f.setConnected(true);
    await flush();
    f.setAppState("background");
    await flush();
    f.clear();

    f.setAppState("active");
    await flush();
    expect(f.log).toEqual([
      ["arm", "u1", "u1-c1"],
      ["online", "u1", "u1-c1", null],
    ]);
  });

  test("KÖK HATA: arka plandayken bağlantı yenilenirse çevrimiçi YAZILMAZ", async () => {
    const f = makeAdapter();
    const s = createPresenceSession(f.adapter);
    s.start("u1");
    f.setConnected(true);
    await flush();
    f.setAppState("background");
    await flush();
    f.clear();

    // Arka planda soket düşer ve yeniden bağlanır (Doze/ağ değişimi).
    f.setConnected(false);
    f.setConnected(true);
    await flush();
    expect(f.log).toEqual([]);
    expect(s.getConnection()).toBeNull();
  });

  test("peş peşe hızlı geçişler tutarlı bir son duruma varır", async () => {
    const f = makeAdapter();
    const s = createPresenceSession(f.adapter);
    s.start("u1");
    f.setConnected(true);
    f.setAppState("background");
    f.setAppState("active");
    f.setAppState("background");
    await flush();
    expect(s.getConnection()).toBeNull();
    // Son durum: arka plan. Kayıt yazıldıysa mutlaka silinmiş olmalı.
    const lastWrite = [...f.names()].reverse().find((n) => n === "online" || n === "offline");
    expect([undefined, "offline"]).toContain(lastWrite);
  });
});

describe("iOS inactive toleransı", () => {
  test("kısa inactive (bildirim merkezi) çevrimiçi durumu bozmaz", async () => {
    const f = makeAdapter();
    const s = createPresenceSession(f.adapter);
    s.start("u1");
    f.setConnected(true);
    await flush();
    f.clear();

    f.setAppState("inactive");
    jest.advanceTimersByTime(INACTIVE_GRACE_MS - 100);
    f.setAppState("active");
    jest.advanceTimersByTime(INACTIVE_GRACE_MS * 2);
    await flush();
    expect(f.log).toEqual([]);
    expect(s.getConnection()).not.toBeNull();
  });

  test("tolerans dolarsa çevrimdışı olur", async () => {
    const f = makeAdapter();
    const s = createPresenceSession(f.adapter);
    s.start("u1");
    f.setConnected(true);
    await flush();
    f.clear();

    f.setAppState("inactive");
    jest.advanceTimersByTime(INACTIVE_GRACE_MS + 10);
    await flush();
    expect(f.names()).toEqual(["offline", "disarm"]);
  });

  test("inactive → background toleransı beklemeden anında çevrimdışı", async () => {
    const f = makeAdapter();
    const s = createPresenceSession(f.adapter);
    s.start("u1");
    f.setConnected(true);
    await flush();
    f.clear();

    f.setAppState("inactive");
    f.setAppState("background");
    await flush();
    expect(f.names()).toEqual(["offline", "disarm"]);
  });
});

describe("soket yeniden bağlanması", () => {
  test("yeni soket yeni kimlik alır ve ölen soketin artığını siler", async () => {
    const f = makeAdapter();
    const s = createPresenceSession(f.adapter);
    s.start("u1");
    f.setConnected(true);
    await flush();
    f.clear();

    f.setConnected(false);
    expect(s.getConnection()).toBeNull();
    f.setConnected(true);
    await flush();
    expect(f.log).toEqual([
      ["arm", "u1", "u1-c2"],
      ["online", "u1", "u1-c2", "u1-c1"],
    ]);
  });

  test("bağlantı kopunca dinleyicilere çevrimdışı bildirilir", async () => {
    const f = makeAdapter();
    const s = createPresenceSession(f.adapter);
    const seen = [];
    s.subscribe((conn) => seen.push(conn && conn.connId));
    s.start("u1");
    f.setConnected(true);
    await flush();
    f.setConnected(false);
    await flush();
    expect(seen).toEqual(["u1-c1", null]);
  });
});

describe("çıkış / hesap değişimi", () => {
  test("stop() kayıt silinene kadar bekler ve onDisconnect'i iptal eder", async () => {
    const f = makeAdapter();
    const s = createPresenceSession(f.adapter);
    s.start("u1");
    f.setConnected(true);
    await flush();
    f.clear();

    let done = false;
    const p = s.stop().then(() => {
      done = true;
    });
    await flush();
    await p;
    expect(done).toBe(true);
    expect(f.log).toEqual([
      ["offline", "u1", "u1-c1"],
      ["disarm", "u1", "u1-c1"],
    ]);
    expect(s.getConnection()).toBeNull();
  });

  test("stop() sonrası bağlantı/ön plan olayları hiçbir şey yazmaz", async () => {
    const f = makeAdapter();
    const s = createPresenceSession(f.adapter);
    s.start("u1");
    f.setConnected(true);
    await flush();
    await s.stop();
    f.clear();

    f.setConnected(true);
    f.setAppState("active");
    await flush();
    expect(f.log).toEqual([]);
  });

  test("offline yazımı reddedilse bile stop() hata fırlatmaz ve durumu sıfırlar", async () => {
    const f = makeAdapter();
    const s = createPresenceSession(f.adapter);
    s.start("u1");
    f.setConnected(true);
    await flush();
    f.fail.add("offline");

    await expect(s.stop()).resolves.toBeUndefined();
    expect(s.getConnection()).toBeNull();
    // Yazım başarısızsa onDisconnect İPTAL EDİLMEZ: sunucu soket ölünce temizler.
    expect(f.names()).not.toContain("disarm");
  });

  test("stop() sonra yeniden start() çalışır", async () => {
    const f = makeAdapter();
    const s = createPresenceSession(f.adapter);
    s.start("u1");
    f.setConnected(true);
    await flush();
    await s.stop();
    f.clear();

    s.start("u2");
    f.setConnected(true);
    await flush();
    expect(f.log[0][0]).toBe("arm");
    expect(f.log[1].slice(0, 2)).toEqual(["online", "u2"]);
  });

  test("hesap değişimi: eski kullanıcı çevrimdışı, yenisi YENİ kimlikle çevrimiçi", async () => {
    const f = makeAdapter();
    const s = createPresenceSession(f.adapter);
    s.start("u1");
    f.setConnected(true);
    await flush();
    f.clear();

    s.start("u2");
    await flush();
    expect(f.log).toEqual([
      ["offline", "u1", "u1-c1"],
      ["disarm", "u1", "u1-c1"],
      ["arm", "u2", "u2-c2"],
      ["online", "u2", "u2-c2", null],
    ]);
    expect(s.getConnection()).toEqual({ uid: "u2", connId: "u2-c2" });
  });

  test("hesap değişiminde eski kullanıcının yazımı reddedilse de yenisi çevrimiçi olur", async () => {
    const f = makeAdapter();
    const s = createPresenceSession(f.adapter);
    s.start("u1");
    f.setConnected(true);
    await flush();
    f.fail.add("offline");

    s.start("u2");
    await flush();
    expect(s.getConnection()).toEqual({ uid: "u2", connId: "u2-c2" });
  });
});

describe("dayanıklılık", () => {
  test("asılı kalan bir ağ çağrısı zaman aşımına uğrar, makine kilitlenmez", async () => {
    const f = makeAdapter();
    f.hang.add("arm");
    const s = createPresenceSession(f.adapter);
    s.start("u1");
    f.setConnected(true);
    await flush();
    expect(s.getConnection()).toBeNull();

    f.hang.delete("arm");
    jest.advanceTimersByTime(OP_TIMEOUT_MS + 10);
    await flush();
    // Zaman aşımı sonrası yeni bir olay (ön plan) makineyi yeniden çalıştırır.
    f.setAppState("background");
    f.setAppState("active");
    await flush();
    expect(s.getConnection()).not.toBeNull();
  });

  test("arm sürerken arka plana geçilirse çevrimiçi yazılmaz, artık onDisconnect temizlenir", async () => {
    const f = makeAdapter();
    let release;
    f.adapter.arm = (uid, id) => {
      f.log.push(["arm", uid, id]);
      return new Promise((resolve) => {
        release = resolve;
      });
    };
    const s = createPresenceSession(f.adapter);
    s.start("u1");
    f.setConnected(true);
    await flush();

    f.setAppState("background");
    release();
    await flush();
    expect(f.names()).not.toContain("online");
    expect(f.names()).toContain("disarm");
    expect(s.getConnection()).toBeNull();
  });
});
