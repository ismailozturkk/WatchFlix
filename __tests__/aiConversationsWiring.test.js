// __tests__/aiConversationsWiring.test.js
//
// AI sohbet geçmişinin GERÇEK kablolaması: services/userData/index.js (alan kaydı,
// işçi, eski geçmişin taşınması) + hooks/useAiConversations (react-test-renderer).
// Yalnız Firebase SDK'sı, oturum ve bağlantı sahte; disk (bellek-içi dosya sistemi)
// ve MMKV taklidi gerçek akışı izler. Motor/depo davranışı için bkz.
// aiConversationStore.test.js ve aiConversationsCloud.test.js.
//
// Kanıtladıkları (o testler bunları göremez):
//   • alan `ALL_DOMAINS`ta: giriş indirir, çıkış siler, "yeniden eşitle" çalışır
//   • giriş (`startUserData`) eski yerel geçmişi buluta taşır
//   • hook hiçbir Firestore DİNLEYİCİSİ (onSnapshot) açmaz
//   • kaydet/sil ekranda anında, buluta arka planda tek batch ile gider

const mockCloud = new Map();
const mockStats = { reads: 0, readPaths: [], listeners: 0, commits: [] };
const mockClone = (v) => JSON.parse(JSON.stringify(v));

jest.mock("firebase/firestore", () => ({
  collection: (_db, ...parts) => ({ kind: "col", path: parts.join("/") }),
  doc: (_db, ...parts) => ({ kind: "doc", path: parts.join("/") }),
  getDocs: async (ref) => {
    mockStats.reads += 1;
    mockStats.readPaths.push(ref.path);
    const prefix = `${ref.path}/`;
    const docs = [...mockCloud.entries()]
      .filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/"))
      .map(([p, data]) => ({ id: p.slice(prefix.length), data: () => mockClone(data) }));
    return { empty: docs.length === 0, docs };
  },
  getDoc: async (ref) => {
    mockStats.reads += 1;
    mockStats.readPaths.push(ref.path);
    return { exists: () => mockCloud.has(ref.path), data: () => mockClone(mockCloud.get(ref.path)) };
  },
  writeBatch: () => {
    const ops = [];
    return {
      set: (ref, data) => ops.push({ op: "set", path: ref.path, data }),
      delete: (ref) => ops.push({ op: "delete", path: ref.path }),
      commit: async () => {
        mockStats.commits.push(ops.map((o) => ({ ...o })));
        for (const o of ops) {
          if (o.op === "set") mockCloud.set(o.path, mockClone(o.data));
          else mockCloud.delete(o.path);
        }
      },
    };
  },
  onSnapshot: () => {
    mockStats.listeners += 1;
    return () => {};
  },
}));

const mockSession = { user: { uid: "u1" }, online: true };

jest.mock("../firebase", () => ({
  db: {},
  auth: {
    get currentUser() {
      return mockSession.user;
    },
  },
}));
jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: mockSession.user }),
}));
jest.mock("../context/ConnectivityContext", () => ({
  getIsOnline: () => mockSession.online,
  subscribeOnline: () => () => {},
  useConnectivity: () => ({ isOnline: mockSession.online }),
}));
jest.mock("../services/usageTrackerService", () => ({
  trackFirestoreRead: jest.fn(),
  trackFirestoreWrite: jest.fn(),
  trackFirestoreDelete: jest.fn(),
}));

global.IS_REACT_ACT_ENVIRONMENT = true;
jest.useFakeTimers();

// jest.resetModules() React örneğini de yeniler: test renderer ve hook AYNI
// kopyayı kullanmalı, ikisi de boot() içinde sıfırlamadan SONRA yüklenir.
let rt = null;
const act = (fn) => rt.TestRenderer.act(fn);
const flush = async (rounds = 10) => {
  for (let i = 0; i < rounds; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await Promise.resolve();
    });
  }
};
const advance = async (ms) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await flush();
};

function boot() {
  jest.resetModules();
  rt = { React: require("react"), TestRenderer: require("react-test-renderer") };
  return {
    userData: require("../services/userData"),
    useAiConversations: require("../hooks/useAiConversations").default,
    storage: require("../services/storage"),
  };
}

function mountHook(useValue) {
  const box = { value: null, renders: 0 };
  function Probe() {
    box.value = useValue();
    box.renders += 1;
    return null;
  }
  let renderer;
  act(() => {
    renderer = rt.TestRenderer.create(rt.React.createElement(Probe));
  });
  return { box, unmount: () => act(() => renderer.unmount()) };
}

const path = (id, uid = "u1") => `AiConversations/${uid}/items/${id}`;
const chat = (n, extra = {}) => ({
  id: `chat-${n}`,
  title: `Sohbet ${n}`,
  messages: [
    { id: `u${n}`, role: "user", text: "Bana film öner" },
    { id: `a${n}`, role: "assistant", text: "Arrival", aiResponse: { type: "general", content: "Arrival" } },
  ],
  createdAt: n * 100,
  updatedAt: n * 100,
  ...extra,
});

beforeEach(() => {
  jest.clearAllTimers();
  mockCloud.clear();
  Object.assign(mockStats, { reads: 0, readPaths: [], listeners: 0, commits: [] });
  mockSession.user = { uid: "u1" };
  mockSession.online = true;
});

describe("kayıt ve yaşam döngüsü", () => {
  test("alan ALL_DOMAINS içinde, adı benzersiz ve ad alanı kalıcı dizinde", () => {
    const { userData } = boot();
    const names = userData.ALL_DOMAINS.map((d) => d.name);
    expect(names).toContain("aiConversations");
    expect(new Set(names).size).toBe(names.length);
    expect(require("../utils/cacheStore").isDurableNamespace("aiConversations")).toBe(true);
  });

  test("yeni telefon: giriş geçmişi TEK koleksiyon okumasıyla indirir, dinleyici açılmaz", async () => {
    mockCloud.set(path("chat-1"), { id: "chat-1", title: "A", messages: [], updatedAt: 10 });
    mockCloud.set(path("chat-2"), { id: "chat-2", title: "B", messages: [], updatedAt: 20 });
    const { userData, useAiConversations } = boot();

    userData.startUserData("u1");
    const { box } = mountHook(useAiConversations);
    await flush();

    expect(box.value.conversations.map((c) => c.id)).toEqual(["chat-2", "chat-1"]);
    expect(box.value.ready).toBe(true);
    expect(mockStats.listeners).toBe(0);
    expect(mockStats.readPaths.filter((p) => p === "AiConversations/u1/items")).toHaveLength(1);
  });

  test("çıkışta yerel kopya silinir (bulut yedeği durur); geri girişte tek seferlik iner", async () => {
    mockCloud.set(path("chat-1"), { id: "chat-1", title: "A", messages: [], updatedAt: 10 });
    const { userData } = boot();
    userData.startUserData("u1");
    await flush();
    await userData.aiConversationsDomain.ensureHydrated("u1");
    expect(userData.aiConversations.list("u1")).toHaveLength(1);

    userData.clearUserLocal("u1");
    expect(userData.aiConversations.list("u1")).toHaveLength(0);
    expect(mockCloud.has(path("chat-1"))).toBe(true);

    mockStats.reads = 0;
    await userData.aiConversationsDomain.ensureHydrated("u1");
    expect(mockStats.reads).toBe(1);
    expect(userData.aiConversations.list("u1")).toHaveLength(1);
  });

  test("hesap silme: bekleyen sohbet yazımları da silinir (bulutta geri oluşmaz)", async () => {
    const { userData } = boot();
    mockSession.online = false;
    userData.startUserData("u1");
    userData.aiConversations.save("u1", chat(1));
    expect(userData.getSyncStatus("u1").pending).toBe(1);

    userData.purgeUserData("u1");
    expect(userData.getSyncStatus("u1").pending).toBe(0);

    mockSession.online = true;
    userData.nudgeUserData();
    await advance(1000);
    expect(mockStats.commits).toHaveLength(0);
  });

  test("Önbellek ekranı: 'yeniden eşitle' başka cihazdaki sohbeti getirir, yerel yazımı korur", async () => {
    const { userData } = boot();
    userData.startUserData("u1");
    await flush();
    await userData.aiConversationsDomain.ensureHydrated("u1");
    userData.aiConversations.save("u1", chat(1));
    await advance(600);
    expect(mockCloud.has(path("chat-1"))).toBe(true);

    mockCloud.set(path("telefon-2"), { id: "telefon-2", title: "Diğer", messages: [], updatedAt: 9999 });
    mockSession.online = false;
    userData.aiConversations.save("u1", chat(3));
    mockSession.online = true;

    expect(await userData.resyncUserData("u1", ["aiConversations"])).toBe(true);
    expect(userData.aiConversations.list("u1").map((c) => c.id).sort()).toEqual(["chat-1", "chat-3", "telefon-2"]);
  });
});

describe("eski yerel geçmişin taşınması (gerçek giriş akışı)", () => {
  test("startUserData eski MMKV geçmişini buluta taşır ve yerel anahtarı siler", async () => {
    const { userData, storage } = boot();
    storage.set(storage.Keys.aiCineConversations, [chat(1), chat(2)], { uid: "u1" });
    expect(storage.get(storage.Keys.aiCineConversations, { uid: "u1" })).toHaveLength(2);

    userData.startUserData("u1");
    await flush();
    await advance(600);

    expect(mockCloud.has(path("chat-1"))).toBe(true);
    expect(mockCloud.has(path("chat-2"))).toBe(true);
    expect(storage.get(storage.Keys.aiCineConversations, { uid: "u1" })).toBeNull();
    expect(userData.aiConversations.list("u1").map((c) => c.id)).toEqual(["chat-2", "chat-1"]);
  });

  test("ikinci giriş taşınacak bir şey bulmaz ve fazladan yazma üretmez", async () => {
    const { userData, storage } = boot();
    storage.set(storage.Keys.aiCineConversations, [chat(1)], { uid: "u1" });
    userData.startUserData("u1");
    await flush();
    await advance(600);
    const writes = mockStats.commits.length;

    userData.startUserData("u1");
    await flush();
    await advance(600);
    expect(mockStats.commits.length).toBe(writes);
  });

  test("başka hesabın eski geçmişine dokunulmaz", async () => {
    const { userData, storage } = boot();
    storage.set(storage.Keys.aiCineConversations, [chat(7)], { uid: "u2" });
    userData.startUserData("u1");
    await flush();
    await advance(600);
    expect(storage.get(storage.Keys.aiCineConversations, { uid: "u2" })).toHaveLength(1);
    expect(mockCloud.has(path("chat-7", "u2"))).toBe(false);
  });
});

describe("hook", () => {
  test("kaydet ekranda anında görünür, buluta arka planda tek batch ile gider; sil de öyle", async () => {
    const { userData, useAiConversations } = boot();
    userData.startUserData("u1");
    const { box } = mountHook(useAiConversations);
    await flush();
    expect(box.value.conversations).toEqual([]);

    await act(async () => {
      box.value.save(chat(1));
      box.value.save(chat(2));
    });
    expect(box.value.conversations.map((c) => c.id)).toEqual(["chat-2", "chat-1"]);
    expect(mockCloud.has(path("chat-1"))).toBe(false); // ağ beklenmedi

    await advance(600);
    expect(mockCloud.has(path("chat-1"))).toBe(true);
    expect(mockStats.commits.filter((batch) => batch.some((o) => o.path === path("chat-1")))).toHaveLength(1);

    await act(async () => {
      box.value.remove("chat-1");
    });
    expect(box.value.conversations.map((c) => c.id)).toEqual(["chat-2"]);
    await advance(600);
    expect(mockCloud.has(path("chat-1"))).toBe(false);

    await act(async () => {
      box.value.clearAll();
    });
    await advance(600);
    expect([...mockCloud.keys()].filter((p) => p.startsWith("AiConversations/"))).toEqual([]);
    expect(mockStats.listeners).toBe(0);
  });

  test("trim: yeni sınır hemen uygulanır, hesaptan da siler", async () => {
    const { userData, useAiConversations } = boot();
    userData.startUserData("u1");
    const { box } = mountHook(useAiConversations);
    await flush();
    await act(async () => {
      for (let n = 1; n <= 5; n += 1) box.value.save(chat(n));
    });
    await advance(600);

    await act(async () => {
      box.value.trim(2);
    });
    expect(box.value.conversations.map((c) => c.id)).toEqual(["chat-5", "chat-4"]);
    await advance(600);
    expect([...mockCloud.keys()].sort()).toEqual([path("chat-4"), path("chat-5")]);
  });

  test("refresh: bekleyen yazımı önce gönderir, sonra buluttan yeniden kurar", async () => {
    const { userData, useAiConversations } = boot();
    userData.startUserData("u1");
    const { box } = mountHook(useAiConversations);
    await flush();
    // Girişte kurulan 0 ms'lik ilk boşaltma zamanlayıcısı tükensin; yoksa aşağıdaki
    // kısa ilerletme yazımı kendiliğinden gönderir ve refresh'in flush'ı görünmez olur.
    await advance(600);

    await act(async () => {
      box.value.save(chat(1));
    });
    expect(mockCloud.has(path("chat-1"))).toBe(false); // 350 ms'lik birleştirme penceresi içinde
    mockCloud.set(path("telefon-2"), { id: "telefon-2", title: "Diğer", messages: [], updatedAt: 9999 });

    let ok;
    await act(async () => {
      const pending = box.value.refresh();
      jest.advanceTimersByTime(10);
      ok = await pending;
    });
    await flush();
    expect(ok).toBe(true);
    expect(mockCloud.has(path("chat-1"))).toBe(true); // refresh önce flush etti
    expect(box.value.conversations.map((c) => c.id).sort()).toEqual(["chat-1", "telefon-2"]);
  });

  test("oturum yokken refresh false döner ve ağa gitmez", async () => {
    mockSession.user = null;
    const { useAiConversations } = boot();
    const { box } = mountHook(useAiConversations);
    await flush();
    let ok;
    await act(async () => {
      ok = await box.value.refresh();
    });
    expect(ok).toBe(false);
    expect(mockStats.reads).toBe(0);
  });
});
