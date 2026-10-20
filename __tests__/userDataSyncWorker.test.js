// __tests__/userDataSyncWorker.test.js
//
// Yazma günlüğünü buluta boşaltan işçi: toplu gönderim, çevrimdışı bekleme,
// geri çekilme, zaman aşımı, zehirli işlem ayırma, onay sırası.

const { boot, err } = require("./helpers/userDataHarness");

jest.useFakeTimers();

afterEach(() => {
  jest.clearAllTimers();
});

const note = (id, extra = {}) => ({ id, type: "note", content: id, createdAt: 1, ...extra });
const put = (h, id, extra) =>
  h.mods.notes.apply("u1", [{ kind: "items", doc: note(id, extra) }]);

describe("başarılı akış", () => {
  test("yerel yazma ağı BEKLEMEZ; debounce sonra tek batch ile buluta gider", async () => {
    const h = boot();
    h.mods.worker.start("u1");
    await jest.advanceTimersByTimeAsync(0);
    h.remote.calls.commit.length = 0;

    put(h, "a");
    put(h, "b");
    put(h, "c");
    // henüz gitmedi, ama görünümde ve günlükte
    expect(h.remote.calls.commit).toHaveLength(0);
    expect(h.mods.notes.getSnapshot("u1").lists.items).toHaveLength(3);
    expect(h.mods.outbox.counts("u1").pending).toBe(3);

    await jest.advanceTimersByTimeAsync(400);

    expect(h.remote.calls.commit).toHaveLength(1); // 3 not = 1 ağ turu
    expect(h.remote.calls.commit[0]).toHaveLength(3);
    expect(h.remote.db.get("Notes/u1/items/a")).toMatchObject({ id: "a" });
    expect(h.mods.outbox.counts("u1").pending).toBe(0);
  });

  test("aynı notu 20 kez düzenlemek buluta 1 yazma demek", async () => {
    const h = boot();
    h.mods.worker.start("u1");
    await jest.advanceTimersByTimeAsync(0);
    h.remote.calls.commit.length = 0;

    for (let i = 0; i < 20; i += 1) put(h, "a", { content: `v${i}` });
    await jest.advanceTimersByTimeAsync(400);

    const toplam = h.remote.calls.commit.flat();
    expect(toplam).toHaveLength(1);
    expect(h.remote.db.get("Notes/u1/items/a").content).toBe("v19");
  });

  test("silme de buluta gider", async () => {
    const h = boot();
    h.mods.worker.start("u1");
    put(h, "a");
    await jest.advanceTimersByTimeAsync(400);
    expect(h.remote.db.has("Notes/u1/items/a")).toBe(true);

    h.mods.notes.apply("u1", [{ kind: "items", key: "a" }]);
    await jest.advanceTimersByTimeAsync(400);
    expect(h.remote.db.has("Notes/u1/items/a")).toBe(false);
  });

  test("ONAY SIRASI: anlık görüntü diske indikten SONRA günlükten silinir", async () => {
    // İşçi, anlık görüntünün 300ms'lik erteleme penceresinden ÖNCE gönderir:
    // `beforeAck` olmasaydı günlük, henüz diske inmemiş bir değişiklik için
    // silinirdi (çökmede kayıp).
    const h = boot({ workerOptions: { debounceMs: 20 } });
    h.mods.worker.start("u1");
    // hazır alan: yazımlar anlık görüntüye de gider
    h.mods.notes.apply("u1", []); // load
    await h.mods.notes.ensureHydrated("u1");
    await jest.advanceTimersByTimeAsync(0);

    put(h, "a");
    // ertelenmiş anlık görüntü yazımı bekliyor: disk henüz güncel değil
    const dosyaVar = () => {
      const k = h.mods.cacheKeys.notes("u1");
      return (h.mods.cacheStore.getJSON(...k) || []).some((n) => n.id === "a");
    };
    expect(dosyaVar()).toBe(false);

    let ackAnindaDosyada = null;
    const asil = h.mods.outbox.ack;
    h.mods.outbox.ack = (uid, ids) => {
      ackAnindaDosyada = dosyaVar();
      return asil(uid, ids);
    };
    await jest.advanceTimersByTimeAsync(100); // < 300ms: ertelenmiş yazım hâlâ bekliyor
    h.mods.outbox.ack = asil;

    expect(ackAnindaDosyada).toBe(true);
  });
});

describe("çevrimdışı", () => {
  test("çevrimdışıyken hiç gönderim denenmez; internet gelince nudge ile gider", async () => {
    const h = boot({ online: false });
    h.mods.worker.start("u1");
    put(h, "a");
    await jest.advanceTimersByTimeAsync(1000);

    expect(h.remote.calls.commit).toHaveLength(0);
    expect(h.mods.outbox.counts("u1").pending).toBe(1);
    expect(h.mods.worker.getStatus("u1").waiting).toBe("offline");

    h.env.online = true;
    h.mods.worker.nudge();
    await jest.advanceTimersByTimeAsync(10);

    expect(h.remote.db.has("Notes/u1/items/a")).toBe(true);
    expect(h.mods.worker.getStatus("u1").waiting).toBeNull();
  });

  test("oturum henüz çözülmediyse bekler", async () => {
    const h = boot({ authed: false });
    h.mods.worker.start("u1");
    put(h, "a");
    await jest.advanceTimersByTimeAsync(1000);
    expect(h.remote.calls.commit).toHaveLength(0);
    expect(h.mods.worker.getStatus("u1").waiting).toBe("auth");
  });

  test("uygulama kapanıp açılınca günlük kaldığı yerden gider", async () => {
    const h = boot({ online: false });
    h.mods.worker.start("u1");
    put(h, "a", { content: "offline yazildi" });
    await jest.advanceTimersByTimeAsync(500);

    h.restart(); // süreç öldü
    h.env.online = true;
    h.mods.worker.start("u1");
    await jest.advanceTimersByTimeAsync(10);

    expect(h.remote.db.get("Notes/u1/items/a")?.content).toBe("offline yazildi");
  });
});

describe("geçici hata (geri çekilme)", () => {
  test("unavailable → günlükte kalır, 2sn sonra tekrar dener", async () => {
    const h = boot();
    h.remote.control.fail = () => err("unavailable");
    h.mods.worker.start("u1");
    put(h, "a");
    await jest.advanceTimersByTimeAsync(400);

    expect(h.remote.calls.commit).toHaveLength(1);
    expect(h.mods.outbox.counts("u1").pending).toBe(1);
    expect(h.mods.worker.getStatus("u1").lastError).toBe("unavailable");

    h.remote.control.fail = null;
    await jest.advanceTimersByTimeAsync(2100);

    expect(h.remote.calls.commit).toHaveLength(2);
    expect(h.remote.db.has("Notes/u1/items/a")).toBe(true);
    expect(h.mods.outbox.counts("u1").pending).toBe(0);
  });

  test("bekleme süresi artar (2sn → 5sn)", async () => {
    const h = boot();
    h.remote.control.fail = () => err("unavailable");
    h.mods.worker.start("u1");
    put(h, "a");
    await jest.advanceTimersByTimeAsync(400); // 1. deneme
    await jest.advanceTimersByTimeAsync(2100); // 2. deneme
    expect(h.remote.calls.commit).toHaveLength(2);
    await jest.advanceTimersByTimeAsync(3000); // 5sn dolmadı
    expect(h.remote.calls.commit).toHaveLength(2);
    await jest.advanceTimersByTimeAsync(2200); // 5sn doldu
    expect(h.remote.calls.commit).toHaveLength(3);
  });

  test("ağ gelince nudge bekleme süresini SIFIRLAR", async () => {
    const h = boot();
    h.remote.control.fail = () => err("unavailable");
    h.mods.worker.start("u1");
    put(h, "a");
    await jest.advanceTimersByTimeAsync(400);
    await jest.advanceTimersByTimeAsync(2100);
    await jest.advanceTimersByTimeAsync(5100);
    const sayi = h.remote.calls.commit.length;

    h.remote.control.fail = null;
    h.mods.worker.nudge();
    await jest.advanceTimersByTimeAsync(10);
    expect(h.remote.calls.commit.length).toBe(sayi + 1);
    expect(h.mods.outbox.counts("u1").pending).toBe(0);
  });

  test("zaman aşımı geçici sayılır; yeniden gönderim İDEMPOTENT", async () => {
    const h = boot({ workerOptions: { commitTimeoutMs: 1000 } });
    h.remote.control.hang = true; // SDK cevap vermiyor
    h.mods.worker.start("u1");
    put(h, "a", { content: "x" });
    await jest.advanceTimersByTimeAsync(400);
    await jest.advanceTimersByTimeAsync(1100); // zaman aşımı

    expect(h.mods.outbox.counts("u1").pending).toBe(1);
    expect(h.mods.worker.getStatus("u1").lastError).toBe("deadline-exceeded");

    h.remote.control.hang = false;
    await jest.advanceTimersByTimeAsync(2100);
    expect(h.remote.db.get("Notes/u1/items/a").content).toBe("x");
    expect(h.mods.outbox.counts("u1").pending).toBe(0);
  });
});

describe("zehirli işlem", () => {
  const poisoned = (ops) =>
    ops.some((op) => op.path.endsWith("/bad"))
      ? err("invalid-argument", "Unsupported field value")
      : null;

  test("kötü belge batch'i düşürür; iyi olanlar yine de gider, kötüsü ölüye ayrılır", async () => {
    const h = boot();
    h.remote.control.fail = poisoned;
    h.mods.worker.start("u1");
    put(h, "a");
    put(h, "bad");
    put(h, "c");
    await jest.advanceTimersByTimeAsync(500);

    expect(h.remote.db.has("Notes/u1/items/a")).toBe(true);
    expect(h.remote.db.has("Notes/u1/items/c")).toBe(true);
    expect(h.remote.db.has("Notes/u1/items/bad")).toBe(false);
    expect(h.mods.outbox.counts("u1")).toEqual({ pending: 0, dead: 1 });
  });

  test("ölü işlem YEREL kopyadan silinmez ve tekrar gönderilmez", async () => {
    const h = boot();
    h.remote.control.fail = poisoned;
    h.mods.worker.start("u1");
    put(h, "bad");
    await jest.advanceTimersByTimeAsync(500);
    const sayi = h.remote.calls.commit.length;

    await jest.advanceTimersByTimeAsync(60_000);
    expect(h.remote.calls.commit.length).toBe(sayi); // sonsuz döngü yok
    expect(h.mods.notes.getSnapshot("u1").lists.items.map((n) => n.id)).toEqual(["bad"]);
  });

  test("kuyruk tıkanmaz: ölü işlem sonrası yeni yazımlar gider", async () => {
    const h = boot();
    h.remote.control.fail = poisoned;
    h.mods.worker.start("u1");
    put(h, "bad");
    await jest.advanceTimersByTimeAsync(500);
    put(h, "yeni");
    await jest.advanceTimersByTimeAsync(500);
    expect(h.remote.db.has("Notes/u1/items/yeni")).toBe(true);
  });

  test("permission-denied 3 denemeden sonra ölüye ayrılır (token geç hazırlanabilir)", async () => {
    const h = boot();
    h.remote.control.fail = () => err("permission-denied");
    h.mods.worker.start("u1");
    put(h, "a");
    await jest.advanceTimersByTimeAsync(400);
    expect(h.mods.outbox.counts("u1")).toEqual({ pending: 1, dead: 0 });

    await jest.advanceTimersByTimeAsync(2100);
    await jest.advanceTimersByTimeAsync(5100);
    expect(h.mods.outbox.counts("u1")).toEqual({ pending: 0, dead: 1 });
  });

  test("yeni oturumda ölüler bir kez daha denenir", async () => {
    const h = boot();
    h.remote.control.fail = poisoned;
    h.mods.worker.start("u1");
    put(h, "bad");
    await jest.advanceTimersByTimeAsync(500);
    expect(h.mods.outbox.counts("u1").dead).toBe(1);

    h.remote.control.fail = null; // kural/uygulama düzeldi
    h.restart();
    h.mods.worker.start("u1");
    await jest.advanceTimersByTimeAsync(10);
    expect(h.remote.db.has("Notes/u1/items/bad")).toBe(true);
    expect(h.mods.outbox.counts("u1")).toEqual({ pending: 0, dead: 0 });
  });
});

describe("flushNow (çıkış)", () => {
  test("günlük boşalırsa true", async () => {
    const h = boot();
    h.mods.worker.start("u1");
    put(h, "a");
    const sonuc = h.mods.worker.flushNow("u1", { timeoutMs: 3000 });
    await jest.advanceTimersByTimeAsync(10);
    await expect(sonuc).resolves.toBe(true);
    expect(h.remote.db.has("Notes/u1/items/a")).toBe(true);
  });

  test("çevrimdışıysa zaman aşımında false döner (çıkışı kilitlemez)", async () => {
    const h = boot({ online: false });
    h.mods.worker.start("u1");
    put(h, "a");
    const sonuc = h.mods.worker.flushNow("u1", { timeoutMs: 1500 });
    await jest.advanceTimersByTimeAsync(1600);
    await expect(sonuc).resolves.toBe(false);
  });
});

describe("durum (arayüz için)", () => {
  test("getStatus değişmedikçe AYNI referansı döner (useSyncExternalStore)", () => {
    const h = boot();
    const a = h.mods.worker.getStatus("u1");
    expect(h.mods.worker.getStatus("u1")).toBe(a);
  });

  test("bekleyen sayısı yansır", () => {
    const h = boot({ online: false });
    h.mods.worker.start("u1");
    put(h, "a");
    put(h, "b");
    expect(h.mods.worker.getStatus("u1").pending).toBe(2);
  });
});
