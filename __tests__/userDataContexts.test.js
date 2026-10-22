// __tests__/userDataContexts.test.js
//
// Yerel-öncelikli katmanın GERÇEK kablolaması: services/userData/index.js +
// firestoreRemote + ProfileNotes / MediaNotes / ProfileReminders / Calendar
// sağlayıcıları (react-test-renderer). Yalnız Firebase SDK'sı, oturum ve bağlantı
// sahte; disk (bellek-içi dosya sistemi) ve MMKV taklidi gerçek akışı izler.
//
// Kanıtladıkları (motor testleri bunları göremez):
//   • hiçbir sağlayıcı Firestore DİNLEYİCİSİ (onSnapshot) açmaz
//   • yerel kopya varken açılışta buluttan SIFIR okuma, ilk karede dolu
//   • yazma anında görünür; buluta arka planda tek batch ile gider
//   • çevrimdışı yazma, bağlantı gelince gider
//   • Takvim aynı yerel kopyadan türer (ikinci okuma yok)
//   • çıkış başka hesaba veri sızdırmaz

const mockCloud = new Map(); // yol → belge
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
    return {
      exists: () => mockCloud.has(ref.path),
      data: () => mockClone(mockCloud.get(ref.path)),
    };
  },
  writeBatch: () => {
    const ops = [];
    return {
      set: (ref, data) => ops.push({ op: "set", path: ref.path, data }),
      delete: (ref) => ops.push({ op: "delete", path: ref.path }),
      commit: async () => {
        if (mockStats.failCommit) throw Object.assign(new Error("offline"), { code: "unavailable" });
        mockStats.commits.push(ops.map((o) => ({ ...o })));
        for (const o of ops) {
          if (o.op === "set") mockCloud.set(o.path, mockClone(o.data));
          else mockCloud.delete(o.path);
        }
      },
    };
  },
  // Dinleyici AÇILMAMALI: açan kod sayaçta görünür.
  onSnapshot: () => {
    mockStats.listeners += 1;
    return () => {};
  },
}));

const mockSession = { user: { uid: "u1" }, online: true };
const mockOnlineListeners = new Set();

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
  subscribeOnline: (fn) => {
    mockOnlineListeners.add(fn);
    return () => mockOnlineListeners.delete(fn);
  },
  useConnectivity: () => ({ isOnline: mockSession.online }),
}));
jest.mock("../services/usageTrackerService", () => ({
  trackFirestoreRead: jest.fn(),
  trackFirestoreWrite: jest.fn(),
  trackFirestoreDelete: jest.fn(),
}));
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({ theme: { border: "#111", secondary: "#222" } }),
}));
jest.mock("../context/LanguageContext", () => ({
  useLanguage: () => ({ language: "tr", t: { today: "Bugün", month: "ay", days: "gün" } }),
}));
jest.mock("../context/AppSettingsContext", () => ({
  useImageQualitySettings: () => ({ getTmdbUrl: (p) => `https://img${p}` }),
}));
jest.mock("../hooks/usePremiumGate", () => ({
  usePremiumGate: () => ({ allows: () => true, check: () => true }),
}));
jest.mock("../components/AppToast", () => {
  const mockApi = {
    show: jest.fn(), hide: jest.fn(), success: jest.fn(), error: jest.fn(), warning: jest.fn(),
    info: jest.fn(), loading: jest.fn(), badge: jest.fn(), premium: jest.fn(), undo: jest.fn(),
    update: jest.fn(), promise: jest.fn(), clear: jest.fn(),
  };
  return { __esModule: true, default: mockApi, toast: mockApi, showToast: mockApi.show };
});
jest.mock("../utils/i18nText", () => ({ i18nText: (_k, fallback) => fallback }));
jest.mock("../services/reminderWidgetService", () => ({
  clearReminderWidget: jest.fn(),
  syncReminderWidget: jest.fn(),
}));

global.IS_REACT_ACT_ENVIRONMENT = true;
jest.useFakeTimers();

// jest.resetModules() her "yeniden başlatma"da React örneğini de yeniler; context
// modülleri ve test renderer AYNI React kopyasını kullanmalı (aksi hâlde hook'lar
// "null dispatcher" ile patlar). Bu yüzden ikisi de boot() içinde, sıfırlamadan
// SONRA yüklenir.
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

/** Uygulamayı "yeniden başlat": bellek gider, dosyalar + MMKV kalır. */
function boot() {
  jest.resetModules();
  rt = {
    React: require("react"),
    TestRenderer: require("react-test-renderer"),
  };
  return {
    userData: require("../services/userData"),
    Notes: require("../context/ProfileNotesContext"),
    Reminders: require("../context/ProfileRemindersContext"),
    Media: require("../context/MediaNotesContext"),
    Calendar: require("../context/CalendarContext"),
  };
}

function mountWith(Provider, useValue) {
  const box = { value: null, renders: 0 };
  function Probe() {
    box.value = useValue();
    box.renders += 1;
    return null;
  }
  let renderer;
  act(() => {
    renderer = rt.TestRenderer.create(
      rt.React.createElement(Provider, null, rt.React.createElement(Probe)),
    );
  });
  return { box, unmount: () => act(() => renderer.unmount()) };
}

const note = (id, extra = {}) => ({
  id,
  type: "note",
  title: "",
  content: `icerik ${id}`,
  todos: [],
  createdAt: Number(id.replace(/\D/g, "")) || 1,
  updatedAt: 1,
  ...extra,
});

const seedCloud = () => {
  mockCloud.set("Notes/u1/items/n1", note("n1", { createdAt: 100 }));
  mockCloud.set("Notes/u1/items/n2", note("n2", { createdAt: 200, scheduledDate: "2026-12-24" }));
  mockCloud.set("MediaNotes/u1/items/movie_5", {
    id: "movie_5", type: "movie", mediaId: 5, text: "harika", updatedAt: 7,
  });
  mockCloud.set("Reminders/u1/movies/10", {
    movieId: 10, movieName: "Film", releaseDate: "2026-11-01", posterPath: "/p.jpg",
  });
  mockCloud.set("Reminders/u1/tvShows/1", { showId: 1, showName: "Dizi" });
  mockCloud.set("Reminders/u1/tvShows/1/episodes/e1", {
    episodeId: "e1", showId: 1, showName: "Dizi", seasonNumber: 1, episodeNumber: 1, airDate: "2026-12-01",
  });
};

beforeEach(() => {
  jest.clearAllTimers();
  mockCloud.clear();
  Object.assign(mockStats, { reads: 0, readPaths: [], listeners: 0, commits: [], failCommit: false });
  mockSession.user = { uid: "u1" };
  mockSession.online = true;
  mockOnlineListeners.clear();
});

describe("yeni cihaz / ilk kurulum: TEK SEFERLİK indirme", () => {
  test("notlar bir kez indirilir, dinleyici HİÇ açılmaz", async () => {
    seedCloud();
    const { Notes, userData } = boot();
    userData.startUserData("u1");
    const { box } = mountWith(Notes.ProfileNotesProvider, Notes.useProfileNotes);
    await flush();

    expect(box.value.notes.map((n) => n.id)).toEqual(["n2", "n1"]); // createdAt azalan
    expect(box.value.loadingNotes).toBe(false);
    expect(mockStats.listeners).toBe(0);
    expect(mockStats.readPaths.filter((p) => p === "Notes/u1/items")).toHaveLength(1);
  });

  test("hatırlatıcılar: filmler + dizi bölümleri, dinleyici yok", async () => {
    seedCloud();
    const { Reminders, userData } = boot();
    userData.startUserData("u1");
    const { box } = mountWith(Reminders.ProfileRemindersProvider, Reminders.useProfileReminders);
    await flush();

    expect(box.value.reminders.movieReminders).toHaveLength(1);
    expect(box.value.reminders.tvReminders).toHaveLength(1);
    expect(box.value.reminders.tvReminders[0].seasons[0].episodes[0].episodeId).toBe("e1");
    expect(mockStats.listeners).toBe(0);
  });
});

describe("yeniden açılış: kopya varken buluttan SIFIR okuma", () => {
  test("üç alan + takvim: ilk karede dolu, okuma yok", async () => {
    seedCloud();
    // 1. oturum: indir
    {
      const { userData } = boot();
      userData.startUserData("u1");
      await flush();
      await Promise.all(userData.ALL_DOMAINS.map((d) => d.ensureHydrated("u1")));
    }
    expect(mockStats.reads).toBeGreaterThan(0);

    // 2. oturum: yeniden aç. jest.resetModules dosya/MMKV mock'unu da sıfırlardı;
    // bu yüzden modülleri yeniden yüklemeden BELLEK katmanlarını düşürüyoruz.
    mockStats.reads = 0;
    mockStats.readPaths = [];
    const fresh = (() => {
      const userData = require("../services/userData");
      // Süreç ölümü: motorun, anlık görüntü katmanının ve günlüğün BELLEĞİ düşer;
      // dosyalar + MMKV kalır. Bu olmadan test bellekteki durumu okurdu.
      require("../services/snapshotCache").resetSnapshotCache();
      userData.__resetUserDataMemory();
      expect(userData.notesDomain.__peekState("u1")).toBeUndefined();
      return userData;
    })();
    const Notes = require("../context/ProfileNotesContext");
    const Reminders = require("../context/ProfileRemindersContext");
    const Media = require("../context/MediaNotesContext");
    const Calendar = require("../context/CalendarContext");
    fresh.startUserData("u1");

    const n = mountWith(Notes.ProfileNotesProvider, Notes.useProfileNotes);
    const r = mountWith(Reminders.ProfileRemindersProvider, Reminders.useProfileReminders);
    const m = mountWith(Media.MediaNotesProvider, Media.useMediaNotes);
    const c = mountWith(Calendar.CalendarProvider, Calendar.useCalendar);

    // İLK KARE (hiç flush yok): veri zaten dolu
    expect(n.box.value.notes).toHaveLength(2);
    expect(r.box.value.reminders.movieReminders).toHaveLength(1);
    expect(m.box.value.mediaNotes).toHaveLength(1);

    await flush();
    await advance(5000);
    expect(mockStats.reads).toBe(0);
    expect(mockStats.listeners).toBe(0);

    // Takvim aynı kopyadan türedi
    expect(Object.keys(c.box.value.noteEvents)).toEqual(["2026-12-24"]);
    expect(c.box.value.reminderEvents["2026-11-01"][0].title).toBe("Film");
    expect(c.box.value.reminderEvents["2026-12-01"][0].eventType).toBe("reminder_tv");
    expect(c.box.value.markedDates["2026-12-24"].dots.map((d) => d.key)).toEqual(["note"]);
  });
});

describe("yazma", () => {
  async function ready() {
    seedCloud();
    const mods = boot();
    mods.userData.startUserData("u1");
    await flush();
    await Promise.all(mods.userData.ALL_DOMAINS.map((d) => d.ensureHydrated("u1")));
    mockStats.reads = 0;
    mockStats.commits = [];
    return mods;
  }

  test("saveNote ANINDA görünür; buluta arka planda tek batch", async () => {
    const { Notes } = await ready();
    const { box } = mountWith(Notes.ProfileNotesProvider, Notes.useProfileNotes);
    await flush();

    let sonuc;
    await act(async () => {
      sonuc = await box.value.saveNote(note("n9", { content: "yeni not", createdAt: 999 }));
    });
    expect(sonuc).toBe(true);
    expect(box.value.notes[0].id).toBe("n9"); // buluta gitmeden görünür
    expect(mockCloud.has("Notes/u1/items/n9")).toBe(false);

    await advance(600);
    expect(mockCloud.get("Notes/u1/items/n9").content).toBe("yeni not");
    expect(mockStats.commits).toHaveLength(1);
    expect(mockStats.reads).toBe(0); // yazmak okuma tetiklemez
  });

  test("todo işaretleme tam belge yazar (kısmi updateDoc değil)", async () => {
    const mods = await ready();
    const { Notes } = mods;
    mockCloud.set("Notes/u1/items/t1", note("t1", { type: "todo", todos: [{ id: "a", text: "x", done: false }], createdAt: 5 }));
    await act(async () => { await mods.userData.notesDomain.resync("u1"); });
    mockStats.commits = [];

    const { box } = mountWith(Notes.ProfileNotesProvider, Notes.useProfileNotes);
    await flush();
    await act(async () => { await box.value.handleToggleTodoItem("t1", "a"); });
    await advance(600);

    const yazilan = mockCloud.get("Notes/u1/items/t1");
    expect(yazilan.todos[0].done).toBe(true);
    expect(yazilan.type).toBe("todo"); // belgenin kalanı korundu
    expect(mockStats.commits[0][0].op).toBe("set");
  });

  test("silme buluta da gider", async () => {
    const { Notes } = await ready();
    const { box } = mountWith(Notes.ProfileNotesProvider, Notes.useProfileNotes);
    await flush();
    await act(async () => { await box.value.handleDeleteNote("n1"); });
    expect(box.value.notes.map((n) => n.id)).not.toContain("n1");
    await advance(600);
    expect(mockCloud.has("Notes/u1/items/n1")).toBe(false);
  });

  test("ÇEVRİMDIŞI yazılan not bağlantı gelince gider", async () => {
    const { Notes } = await ready();
    const { box } = mountWith(Notes.ProfileNotesProvider, Notes.useProfileNotes);
    await flush();

    mockSession.online = false;
    mockStats.failCommit = true;
    await act(async () => { await box.value.saveNote(note("n7", { createdAt: 700 })); });
    await advance(3000);
    expect(box.value.notes[0].id).toBe("n7"); // kullanıcı için sorun yok
    expect(mockCloud.has("Notes/u1/items/n7")).toBe(false);

    mockSession.online = true;
    mockStats.failCommit = false;
    for (const fn of mockOnlineListeners) fn(); // ConnectivityContext: çevrimdışı → çevrimiçi
    await advance(100);
    expect(mockCloud.has("Notes/u1/items/n7")).toBe(true);
  });

  test("medya notu: kaydet/sil", async () => {
    const { Media } = await ready();
    const { box } = mountWith(Media.MediaNotesProvider, Media.useMediaNotes);
    await flush();

    await act(async () => {
      await box.value.saveMediaNote({ type: "tv", mediaId: 99, title: "T", text: "  not  " });
    });
    expect(box.value.mediaNotes.find((n) => n.id === "tv_99").text).toBe("not");
    await advance(600);
    expect(mockCloud.has("MediaNotes/u1/items/tv_99")).toBe(true);

    await act(async () => { await box.value.deleteMediaNote("tv", 99); });
    await advance(600);
    expect(mockCloud.has("MediaNotes/u1/items/tv_99")).toBe(false);
  });

  test("hatırlatıcı eklemek: bağlam, takvim ve bulut hepsi güncellenir, okuma yok", async () => {
    const mods = await ready();
    const r = mountWith(mods.Reminders.ProfileRemindersProvider, mods.Reminders.useProfileReminders);
    const c = mountWith(mods.Calendar.CalendarProvider, mods.Calendar.useCalendar);
    await flush();

    await act(async () => {
      mods.userData.remindersActions.setEpisode("u1", {
        episodeId: "e9", showId: 7, showName: "Yeni Dizi", seasonNumber: 1, episodeNumber: 9, airDate: "2027-01-02",
      });
    });
    expect(r.box.value.reminders.tvReminders.map((s) => s.showId)).toContain(7);
    expect(c.box.value.reminderEvents["2027-01-02"]).toHaveLength(1);

    await advance(600);
    expect(mockCloud.has("Reminders/u1/tvShows/7")).toBe(true); // dizi belgesi türetildi
    expect(mockCloud.has("Reminders/u1/tvShows/7/episodes/e9")).toBe(true);
    expect(mockStats.reads).toBe(0);
  });
});

describe("çıkış / hesap değiştirme", () => {
  test("çıkışta yerel kopya silinir; başka hesap hiçbir şey görmez", async () => {
    seedCloud();
    const mods = boot();
    mods.userData.startUserData("u1");
    await flush();
    await Promise.all(mods.userData.ALL_DOMAINS.map((d) => d.ensureHydrated("u1")));
    expect(mods.userData.notesDomain.getSnapshot("u1").lists.items).toHaveLength(2);

    mods.userData.clearUserLocal("u1");
    mockSession.user = { uid: "u2" };
    expect(mods.userData.notesDomain.getSnapshot("u2").lists.items).toHaveLength(0);
    expect(mods.userData.remindersDomain.getSnapshot("u2").lists.movies).toHaveLength(0);

    // u1 geri gelirse tek seferlik yeniden indirir
    mockSession.user = { uid: "u1" };
    mockStats.reads = 0;
    await mods.userData.notesDomain.ensureHydrated("u1");
    expect(mockStats.reads).toBe(1);
    expect(mods.userData.notesDomain.getSnapshot("u1").lists.items).toHaveLength(2);
  });

  test("hesap silme: istatistik / profil / aktivite okuma önbelleği de diskten düşer", () => {
    seedCloud();
    const mods = boot();
    const snapshot = require("../services/snapshotCache");
    const { cacheKeys } = require("../utils/cacheKeys");
    const keys = [cacheKeys.stats("u1"), cacheKeys.profile("u1"), cacheKeys.activity("u1")];
    const baskasi = cacheKeys.stats("u2");
    for (const key of [...keys, baskasi]) snapshot.publish(key, { watchedMovieCount: 7 }, { immediate: true });
    for (const key of [...keys, baskasi]) expect(snapshot.seed(key).data).toEqual({ watchedMovieCount: 7 });

    mods.userData.purgeUserData("u1");

    // Sıfırlanan bellek yerine DİSKTEN okunsun: bayat tohum yeni hesapta sayaç tutmasın.
    snapshot.resetSnapshotCache();
    for (const key of keys) expect(snapshot.seed(key).data).toBeNull();
    // Başka hesabın önbelleğine dokunulmaz.
    expect(snapshot.seed(baskasi).data).toEqual({ watchedMovieCount: 7 });
  });

  test("hesap silme: bekleyen yazımlar da silinir (bulutta geri oluşmaz)", async () => {
    seedCloud();
    const mods = boot();
    mockSession.online = false;
    mods.userData.startUserData("u1");
    mods.userData.notesDomain.apply("u1", [{ kind: "items", doc: note("n5") }]);
    expect(mods.userData.getSyncStatus("u1").pending).toBe(1);

    mods.userData.purgeUserData("u1");
    expect(mods.userData.getSyncStatus("u1").pending).toBe(0);

    mockSession.online = true;
    mods.userData.nudgeUserData();
    await advance(1000);
    expect(mockStats.commits).toHaveLength(0);
  });
});
