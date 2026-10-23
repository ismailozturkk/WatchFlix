// İmleçli mesaj sayfaları (services/chatMessagePager.js).
//
// Bozulursa: "daha eski" yüklendikçe okuma sayısı yine karesel büyür, yeni mesaj
// gelince yüklenmiş eski mesajlar listeden düşer, sayfa sınırında aynı mesaj iki
// kez görünür ya da geçmişin sonunda yükleme sonsuza dek "devam ediyor" kalır.

import { createMessagePager } from "../services/chatMessagePager";

// ─── Sahte Firestore sorgu motoru ──────────────────────────────────────────
// orderBy("timestamp","desc") + belge kimliği (eşit zamanda azalan), startAfter /
// endAt belge imleçleri ve limit. Anlık görüntüler `flush()` ile teslim edilir
// (gerçek SDK'daki gibi eşzamansız). Faturalanan okuma = sonuç kümesine EKLENEN
// ya da DEĞİŞEN belge (çıkan belge okunmaz).
function createFakeFirestore(initialCount = 0) {
  let docs = [];
  let version = 0;
  const listeners = new Set();
  const queue = [];
  let billed = 0;

  const put = (id, ts, text = id) => {
    docs = docs.filter((d) => d.id !== id);
    docs.push({ id, ts, text, v: ++version });
  };
  for (let i = 1; i <= initialCount; i += 1) put(`m${String(i).padStart(3, "0")}`, i * 1000);

  // a, b'den ÖNCE mi (azalan zaman, eşitte azalan kimlik)?
  const before = (a, b) => (a.ts !== b.ts ? a.ts > b.ts : a.id > b.id);

  function evaluate(constraints) {
    let list = [...docs].sort((a, b) => (before(a, b) ? -1 : 1));
    for (const c of constraints) {
      if (c.type === "startAfter") list = list.filter((d) => before(c.cursor, d));
      if (c.type === "endAt") list = list.filter((d) => !before(c.cursor, d));
    }
    const lim = constraints.find((c) => c.type === "limit");
    return lim ? list.slice(0, lim.n) : list;
  }

  const toSnap = (d) => ({
    id: d.id,
    ts: d.ts,
    data: () => ({ text: d.text, timestamp: d.ts }),
    metadata: { hasPendingWrites: false },
  });

  function schedule(listener) {
    const result = evaluate(listener.constraints);
    const prev = listener.last;
    const next = new Map(result.map((d) => [d.id, d.v]));
    let changes = 0;
    for (const [id, v] of next) {
      if (prev.get(id) !== v) {
        changes += 1;
        billed += 1;
      }
    }
    for (const id of prev.keys()) if (!next.has(id)) changes += 1;
    if (changes === 0 && listener.delivered) return;
    listener.last = next;
    const snap = { docs: result.map(toSnap), docChanges: () => new Array(changes) };
    queue.push(() => {
      if (!listener.active) return;
      listener.delivered = true;
      listener.next(snap);
    });
  }

  const fs = {
    query: (_ref, ...constraints) => constraints.filter(Boolean),
    orderBy: () => ({ type: "orderBy" }),
    limit: (n) => ({ type: "limit", n }),
    startAfter: (cursor) => ({ type: "startAfter", cursor }),
    endAt: (cursor) => ({ type: "endAt", cursor }),
    onSnapshot: (constraints, next) => {
      const listener = { constraints, next, last: new Map(), active: true, delivered: false };
      listeners.add(listener);
      schedule(listener);
      return () => {
        listener.active = false;
        listeners.delete(listener);
      };
    },
  };

  const changed = () => listeners.forEach(schedule);
  return {
    fs,
    flush() {
      while (queue.length) queue.shift()();
    },
    add(id, ts) {
      put(id, ts);
      changed();
    },
    edit(id, text) {
      const d = docs.find((x) => x.id === id);
      d.text = text;
      d.v = ++version;
      changed();
    },
    remove(id) {
      docs = docs.filter((d) => d.id !== id);
      changed();
    },
    get billed() {
      return billed;
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

function setup(count, pageSize = 30) {
  const db = createFakeFirestore(count);
  let state = null;
  const pager = createMessagePager({
    messagesRef: "messages",
    fs: db.fs,
    pageSize,
    mapDoc: (snap) => ({ id: snap.id, ...snap.data() }),
    onChange: (s) => {
      state = s;
    },
  });
  db.flush();
  return { db, pager, state: () => state, ids: () => state.messages.map((m) => m.id) };
}

describe("createMessagePager", () => {
  test("açılış: en yeni sayfa, yeni→eski sıralı; okuma = sayfa boyu", () => {
    const { db, state, ids } = setup(100);
    expect(state().loaded).toBe(true);
    expect(state().hasMore).toBe(true);
    expect(ids()).toHaveLength(30);
    expect(ids()[0]).toBe("m100");
    expect(ids()[29]).toBe("m071");
    expect(db.billed).toBe(30);
  });

  test("daha eski: sıradaki sayfa eklenir, sınırda tekrar yok", () => {
    const { db, pager, ids } = setup(100);
    expect(pager.loadOlder()).toBe("started");
    db.flush();
    expect(ids()).toHaveLength(60);
    expect(new Set(ids()).size).toBe(60);
    expect(ids()[30]).toBe("m070");
    expect(ids()[59]).toBe("m041");
  });

  test("okuma DOĞRUSAL: 150 mesaja inmek 180 okuma (eski yöntem ~1050)", () => {
    const { db, pager, ids } = setup(300);
    for (let i = 0; i < 4; i += 1) {
      expect(pager.loadOlder()).toBe("started");
      db.flush();
    }
    expect(ids()).toHaveLength(150);
    // açılış 30 + sayfa 0 çapalaması 30 (bir kez) + 4 sayfa × 30
    expect(db.billed).toBe(180);
  });

  test("yükleme sürerken ikinci istek 'busy', sayfa gelince yeniden açılır", () => {
    const { db, pager, state } = setup(100);
    expect(pager.loadOlder()).toBe("started");
    expect(state().loadingOlder).toBe(true);
    expect(pager.loadOlder()).toBe("busy");
    db.flush();
    expect(state().loadingOlder).toBe(false);
    expect(pager.loadOlder()).toBe("started");
  });

  test("çapalamadan sonra yeni mesaj gelince yüklü eski mesaj DÜŞMEZ", () => {
    const { db, pager, ids } = setup(100);
    pager.loadOlder();
    db.flush();
    const before = db.billed;
    db.add("yeni1", 200000);
    db.add("yeni2", 200001);
    db.flush();
    expect(ids()).toHaveLength(62);
    expect(ids().slice(0, 2)).toEqual(["yeni2", "yeni1"]);
    expect(ids()).toContain("m071"); // eski sayfa 0'ın en eskisi yerinde
    expect(db.billed - before).toBe(2); // yalnız yeni iki mesaj okunur
  });

  test("eski sayfadaki düzenleme CANLI gelir (anket oyu / metin düzenleme)", () => {
    const { db, pager, state } = setup(100);
    pager.loadOlder();
    db.flush();
    const before = db.billed;
    db.edit("m050", "düzenlendi");
    db.flush();
    expect(state().messages.find((m) => m.id === "m050").text).toBe("düzenlendi");
    expect(db.billed - before).toBe(1);
  });

  test("sayfada silinen mesaj sonraki sayfanın belgesini çeker: tekilleşir", () => {
    const { db, pager, ids } = setup(100);
    pager.loadOlder();
    db.flush();
    pager.loadOlder();
    db.flush();
    db.remove("m060"); // sayfa 1'den; pencere m040'ı (sayfa 2'nin ilki) içine alır
    db.flush();
    expect(ids()).not.toContain("m060");
    expect(ids().filter((id) => id === "m040")).toHaveLength(1);
    expect(ids()).toHaveLength(89);
  });

  test("geçmişin sonu: kısa sayfadan sonra 'end', hasMore false", () => {
    const { db, pager, state, ids } = setup(45);
    expect(pager.loadOlder()).toBe("started");
    db.flush();
    expect(ids()).toHaveLength(45);
    expect(state().hasMore).toBe(false);
    expect(pager.loadOlder()).toBe("end");
  });

  test("tek sayfadan kısa sohbet: daha eski yok", () => {
    const { pager, state } = setup(12);
    expect(state().hasMore).toBe(false);
    expect(pager.loadOlder()).toBe("end");
  });

  test("ilk sayfa gelmeden istek 'busy'; boş sohbet de yüklendi sayılır", () => {
    const db = createFakeFirestore(0);
    let state = null;
    const pager = createMessagePager({
      messagesRef: "m",
      fs: db.fs,
      mapDoc: (s) => ({ id: s.id }),
      onChange: (s) => {
        state = s;
      },
    });
    expect(pager.loadOlder()).toBe("busy");
    db.flush();
    expect(state).toEqual({ messages: [], loaded: true, hasMore: false, loadingOlder: false });
  });

  test("büyük sayfa (mesaja atlama) istenen boyutta yüklenir", () => {
    const { db, pager, ids } = setup(200);
    expect(pager.loadOlder(50)).toBe("started");
    db.flush();
    expect(ids()).toHaveLength(80);
  });

  test("stop: tüm dinleyiciler kapanır, sonraki değişiklik yayılmaz", () => {
    const { db, pager, state } = setup(100);
    pager.loadOlder();
    db.flush();
    const last = state();
    pager.stop();
    expect(db.listenerCount).toBe(0);
    db.add("geç", 300000);
    db.flush();
    expect(state()).toBe(last);
  });
});
