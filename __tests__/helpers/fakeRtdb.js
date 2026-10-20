// Bellek içi sahte Realtime Database + AppState + auth — entegrasyon testleri için.
//
// Gerçek RTDB'nin test için gereken davranışları taklit edilir:
//   • yollar, çok yollu update (null = sil), boş atalar budanır,
//   • serverTimestamp, push() anahtarı, .info/connected,
//   • onDisconnect: kuyruğa alınır, `disconnect()` (soket ölümü) anında SUNUCU
//     tarafında çalışır; `cancel()` kuyruğu temizler. Tek seferliktir.
// Jest ayarı __tests__/helpers/ altını test saymaz.

const state = {
  tree: {},
  listeners: new Set(),
  connected: false,
  ops: [], // bekleyen onDisconnect işlemleri
  clock: 1000,
  seq: 0,
  appStateListeners: new Set(),
};

const split = (path) => String(path).split("/").filter(Boolean);
const clone = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));

function getAt(path) {
  let cur = state.tree;
  for (const key of split(path)) {
    if (cur == null || typeof cur !== "object") return null;
    cur = cur[key];
  }
  return cur === undefined ? null : cur;
}

function setAt(path, value) {
  const keys = split(path);
  if (keys.length === 0) {
    state.tree = value == null ? {} : value;
    return;
  }
  let cur = state.tree;
  const chain = [];
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (cur[key] == null || typeof cur[key] !== "object") {
      if (value == null) return;
      cur[key] = {};
    }
    chain.push([cur, key]);
    cur = cur[key];
  }
  const last = keys[keys.length - 1];
  if (value == null) delete cur[last];
  else cur[last] = value;
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    const [parent, key] = chain[i];
    if (Object.keys(parent[key]).length === 0) delete parent[key];
    else break;
  }
}

const resolveValue = (v) =>
  v && typeof v === "object" && v[".sv"] === "timestamp" ? (state.clock += 1) : v;

const snapshotOf = (value) => ({
  val: () => clone(value),
  exists: () => value != null,
  get key() {
    return null;
  },
});

function currentValue(path) {
  return path === ".info/connected" ? state.connected : getAt(path);
}

function notify() {
  state.listeners.forEach((l) => l.run());
}

// ─── firebase/database yüzeyi ───────────────────────────────────────────────
const databaseModule = {
  ref: (_db, path) => ({ path: split(path).join("/") || path }),
  serverTimestamp: () => ({ ".sv": "timestamp" }),
  push: (r) => ({ key: `-K${(state.seq += 1).toString(36)}`, path: r.path }),
  get: async (r) => snapshotOf(getAt(r.path)),
  set: async (r, value) => {
    setAt(r.path, resolveValue(value));
    notify();
  },
  update: async (r, values) => {
    Object.entries(values).forEach(([key, value]) => {
      setAt(`${r.path}/${key}`, resolveValue(value));
    });
    notify();
  },
  onValue: (r, cb) => {
    const listener = {
      last: undefined,
      run() {
        const next = JSON.stringify(currentValue(r.path) ?? null);
        if (next === listener.last) return;
        listener.last = next;
        cb(snapshotOf(currentValue(r.path)));
      },
    };
    state.listeners.add(listener);
    listener.run();
    return () => state.listeners.delete(listener);
  },
  onDisconnect: (r) => ({
    set: async (value) => {
      state.ops.push({ path: r.path, value });
    },
    remove: async () => {
      state.ops.push({ path: r.path, value: null });
    },
    cancel: async () => {
      state.ops = state.ops.filter(
        (op) => !(op.path === r.path || op.path.startsWith(`${r.path}/`)),
      );
    },
  }),
};

// ─── test kontrolü ──────────────────────────────────────────────────────────
const appState = {
  currentState: "active",
  addEventListener: (_event, cb) => {
    state.appStateListeners.add(cb);
    return { remove: () => state.appStateListeners.delete(cb) };
  },
};

const fakeAuth = {
  guard: null,
  beforeAuthStateChanged(cb) {
    fakeAuth.guard = cb;
    return () => {
      fakeAuth.guard = null;
    };
  },
};

function reset() {
  state.tree = {};
  state.listeners.clear();
  state.connected = false;
  state.ops = [];
  state.clock = 1000;
  state.seq = 0;
  state.appStateListeners.clear();
  appState.currentState = "active";
  fakeAuth.guard = null;
}

module.exports = {
  databaseModule,
  appState,
  fakeAuth,
  reset,
  /** Soket açıldı (.info/connected → true). */
  connect() {
    state.connected = true;
    notify();
  },
  /**
   * SÜREÇ ÖLDÜRÜLDÜ (swipe-kill / çökme): istemci kodu bir daha ÇALIŞMAZ, bu yüzden
   * .info/connected dinleyicileri tetiklenmez ve istemci hiçbir şey yazamaz; yalnız
   * sunucu bekleyen onDisconnect'leri çalıştırır. Karşı tarafın dinleyicileri çalışır.
   */
  kill() {
    const ops = state.ops;
    state.ops = [];
    ops.forEach((op) => setAt(op.path, resolveValue(op.value)));
    notify();
  },
  /** Soket DÜŞTÜ ama uygulama yaşıyor (ağ değişimi): istemci de olayı görür. */
  disconnect() {
    state.connected = false;
    notify();
    const ops = state.ops;
    state.ops = [];
    ops.forEach((op) => setAt(op.path, resolveValue(op.value)));
    notify();
  },
  /** AppState değişimi (active / inactive / background). */
  emitAppState(next) {
    appState.currentState = next;
    state.appStateListeners.forEach((cb) => cb(next));
  },
  /** Ham veri okuma. */
  read: (path) => clone(getAt(path)),
  /** Doğrudan veri yazma (başka bir kullanıcının/eski sürümün yazımını taklit eder). */
  seed(path, value) {
    setAt(path, value);
    notify();
  },
  pendingDisconnectOps: () => state.ops.map((op) => ({ ...op })),
  /** firebase-admin benzeri (sunucu fonksiyonu için) okuma yüzeyi. */
  adminRtdb: {
    ref: (path) => ({ get: async () => snapshotOf(getAt(path)) }),
  },
};
