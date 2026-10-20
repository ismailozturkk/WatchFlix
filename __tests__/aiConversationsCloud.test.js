// __tests__/aiConversationsCloud.test.js
//
// CineMatch sohbet geçmişinin BULUT sözleşmesi (AiConversations/{uid}/items):
//   • yeni telefon / yeniden kurulum → geçmiş buluttan TEK SEFER gelir
//   • sonraki açılışlarda buluttan okuma YOK
//   • yazma önce yerelde + günlükte, buluta arka planda; çevrimdışı kaybolmaz
//   • eski sürümün yerel (MMKV) geçmişi ilk girişte buluta taşınır
//   • iki hesap birbirinin sohbetini görmez
// Gerçek motor/işçi/günlük + sahte bulut (helpers/userDataHarness).

const { boot, err } = require("./helpers/userDataHarness");

jest.useFakeTimers();
afterEach(() => jest.clearAllTimers());

const UID = "u1";
const path = (id, uid = UID) => `AiConversations/${uid}/items/${id}`;

const richMessages = (n) => [
  { id: `u${n}`, role: "user", text: "Bana korku filmi öner", display: "Korku öner" },
  {
    id: `a${n}`,
    role: "assistant",
    text: "recommendations: Hereditary",
    aiResponse: { type: "recommendations", items: [{ title: "Hereditary", mediaType: "movie" }] },
    posterMap: { "movie|hereditary": { found: true, id: 493922, title: "Hereditary", posterPath: "/p.jpg", genres: ["Korku"] } },
    notes: { removed: 0, relaxed: false, seen: 1, truncated: false },
  },
];

const chat = (n, extra = {}) => ({
  id: `chat-${n}`,
  title: `Sohbet ${n}`,
  messages: richMessages(n),
  createdAt: n * 1000,
  updatedAt: n * 1000,
  ...extra,
});

const ids = (h, uid = UID) => h.mods.aiApi.list(uid).map((c) => c.id);

describe("yeni telefon / yeniden kurulum", () => {
  test("yerel kopya yok → geçmiş buluttan TEK koleksiyon okumasıyla gelir", async () => {
    const h = boot();
    h.remote.seed(path("chat-1"), { id: "chat-1", title: "A", messages: [], updatedAt: 10 });
    h.remote.seed(path("chat-2"), { id: "chat-2", title: "B", messages: [], updatedAt: 30 });
    h.remote.seed(path("chat-3"), { id: "chat-3", title: "C", messages: [], updatedAt: 20 });

    expect(h.mods.aiConversations.getSnapshot(UID).ready).toBe(false);
    await h.mods.aiConversations.ensureHydrated(UID);

    expect(ids(h)).toEqual(["chat-2", "chat-3", "chat-1"]); // en son konuşulan üstte
    expect(h.remote.calls.fetchCollection).toEqual([`AiConversations/${UID}/items`]);
    expect(h.mods.aiConversations.getSnapshot(UID).ready).toBe(true);
  });

  test("mesajlar, yapılandırılmış cevap ve poster haritası bulutla BİREBİR döner", async () => {
    const h = boot();
    await h.mods.aiConversations.ensureHydrated(UID);
    h.mods.aiApi.save(UID, chat(1));
    await h.mods.worker.flush(UID);

    // Telefon kayboldu: yerel kopya + hazır işareti gitti, bulut kaldı.
    h.mods.aiConversations.clearLocal(UID);
    expect(h.mods.aiApi.list(UID)).toEqual([]);

    await h.mods.aiConversations.ensureHydrated(UID);
    const [restored] = h.mods.aiApi.list(UID);
    expect(restored.messages).toEqual(richMessages(1));
    expect(restored).toMatchObject({ id: "chat-1", title: "Sohbet 1", createdAt: 1000 });
  });

  test("bulut boşsa hazır ve boş (hata değil)", async () => {
    const h = boot();
    await h.mods.aiConversations.ensureHydrated(UID);
    expect(h.mods.aiConversations.getSnapshot(UID)).toMatchObject({ ready: true, waiting: false });
    expect(h.mods.aiApi.list(UID)).toEqual([]);
  });

  test("çevrimdışı yeni telefon: 'bekliyor' durumu, bağlantı gelince iner", async () => {
    const h = boot({ online: false });
    h.remote.seed(path("chat-1"), { id: "chat-1", title: "A", messages: [], updatedAt: 10 });

    await h.mods.aiConversations.ensureHydrated(UID);
    expect(h.mods.aiConversations.getSnapshot(UID)).toMatchObject({ ready: false, hydrating: false, waiting: true });
    expect(h.remote.reads()).toBe(0);

    h.env.online = true;
    await h.mods.aiConversations.ensureHydrated(UID);
    expect(ids(h)).toEqual(["chat-1"]);
  });
});

describe("açılışta buluttan okuma yok", () => {
  test("yeniden açılış: disk kopyası senkron gelir, bulut SIFIR okuma", async () => {
    const h = boot();
    h.remote.seed(path("chat-1"), { id: "chat-1", title: "A", messages: [], updatedAt: 10 });
    await h.mods.aiConversations.ensureHydrated(UID);

    h.restart();
    h.remote.calls.fetchCollection.length = 0;
    h.remote.calls.fetchDoc.length = 0;

    expect(ids(h)).toEqual(["chat-1"]); // ilk karede dolu (senkron)
    await h.mods.aiConversations.ensureHydrated(UID);
    expect(h.remote.reads()).toBe(0);
  });
});

describe("yazma", () => {
  test("cevap gelince yerel anında, bulut arka planda", async () => {
    const h = boot();
    await h.mods.aiConversations.ensureHydrated(UID);

    h.mods.aiApi.save(UID, chat(1));
    expect(ids(h)).toEqual(["chat-1"]); // ağ beklenmedi
    expect(h.remote.db.has(path("chat-1"))).toBe(false);
    expect(h.mods.outbox.counts(UID).pending).toBe(1);

    await h.mods.worker.flush(UID);
    expect(h.remote.db.get(path("chat-1"))).toMatchObject({ v: 1, id: "chat-1", messageCount: 2 });
    expect(h.mods.outbox.counts(UID)).toEqual({ pending: 0, dead: 0 });
  });

  test("ÇEVRİMDIŞI yazılan sohbet uygulama kapansa da kaybolmaz, bağlantıda buluta gider", async () => {
    const h = boot();
    await h.mods.aiConversations.ensureHydrated(UID);
    h.env.online = false;

    h.mods.aiApi.save(UID, chat(1));
    await h.mods.worker.flush(UID);
    expect(h.remote.db.has(path("chat-1"))).toBe(false);

    h.restart(); // süreç öldü: bellek gider, günlük + dosyalar kalır
    expect(ids(h)).toEqual(["chat-1"]);

    h.env.online = true;
    await h.mods.worker.flush(UID);
    expect(h.remote.db.has(path("chat-1"))).toBe(true);
    expect(h.mods.outbox.counts(UID)).toEqual({ pending: 0, dead: 0 });
  });

  test("geçici sunucu hatasında günlükte kalır ve tekrar denenir", async () => {
    const h = boot();
    await h.mods.aiConversations.ensureHydrated(UID);
    h.remote.control.fail = () => err("unavailable");

    h.mods.aiApi.save(UID, chat(1));
    await h.mods.worker.flush(UID);
    expect(h.remote.db.has(path("chat-1"))).toBe(false);
    expect(h.mods.outbox.counts(UID).pending).toBe(1);

    h.remote.control.fail = null;
    await h.mods.worker.flush(UID);
    expect(h.remote.db.has(path("chat-1"))).toBe(true);
  });

  test("kural reddi (permission-denied) sohbeti SİLMEZ: yerelde durur, kuyruğu tıkamaz", async () => {
    const h = boot();
    await h.mods.aiConversations.ensureHydrated(UID);
    h.remote.control.fail = () => err("permission-denied");

    h.mods.aiApi.save(UID, chat(1));
    for (let i = 0; i < 4; i += 1) await h.mods.worker.flush(UID);

    expect(ids(h)).toEqual(["chat-1"]); // kullanıcı sohbetini görmeye devam eder
    expect(h.mods.outbox.counts(UID).dead).toBe(1);

    // Kurallar düzelince (yeni oturum) ölü işlem yeniden denenir.
    h.remote.control.fail = null;
    h.mods.outbox.reviveDead(UID);
    await h.mods.worker.flush(UID);
    expect(h.remote.db.has(path("chat-1"))).toBe(true);
  });

  test("buluta giden belgede iç içe dizi / undefined yok", async () => {
    const h = boot();
    await h.mods.aiConversations.ensureHydrated(UID);
    h.mods.aiApi.save(UID, {
      id: "c",
      title: "t",
      messages: [{ id: "a", role: "assistant", aiResponse: { rows: [[1, 2]], x: undefined } }],
    });
    await h.mods.worker.flush(UID);

    const stored = JSON.stringify(h.remote.db.get(path("c")));
    expect(stored).not.toMatch(/\[\[/);
    expect(h.mods.outbox.counts(UID).dead).toBe(0);
  });
});

describe("eski sürümün yerel geçmişi buluta taşınır", () => {
  const legacyList = () => [
    { id: "eski-1", title: "Eski bir", messages: richMessages(1), createdAt: 100, updatedAt: 500 },
    { id: "eski-2", title: "Eski iki", messages: richMessages(2), createdAt: 200, updatedAt: 900 },
  ];
  const putLegacy = (h, list, uid = UID) =>
    h.mods.storage.set(h.mods.storage.Keys.aiCineConversations, list, { uid });
  const legacyLeft = (h, uid = UID) =>
    h.mods.storage.get(h.mods.storage.Keys.aiCineConversations, { uid });

  test("taşır, yerel anahtarı siler, bulutta görünür; ikinci çağrı iş yapmaz", async () => {
    const h = boot();
    putLegacy(h, legacyList());
    await h.mods.aiConversations.ensureHydrated(UID);

    expect(h.mods.aiApi.migrateLegacy(UID)).toBe(2);
    expect(ids(h)).toEqual(["eski-2", "eski-1"]);
    expect(legacyLeft(h)).toBeNull();

    await h.mods.worker.flush(UID);
    expect([...h.remote.db.keys()].sort()).toEqual([path("eski-1"), path("eski-2")]);
    expect(h.remote.db.get(path("eski-2")).messages).toEqual(richMessages(2));

    expect(h.mods.aiApi.migrateLegacy(UID)).toBe(0);
  });

  test("ÇEVRİMDIŞI taşıma: günlük kalıcı, yerel anahtar silinse de kayıp yok", async () => {
    const h = boot({ online: false });
    putLegacy(h, legacyList());

    h.mods.aiApi.migrateLegacy(UID);
    h.restart();
    expect(ids(h)).toEqual(["eski-2", "eski-1"]); // günlükten geri geldi

    h.env.online = true;
    await h.mods.aiConversations.ensureHydrated(UID);
    await h.mods.worker.flush(UID);
    expect(h.remote.db.has(path("eski-1"))).toBe(true);
    expect(ids(h)).toEqual(["eski-2", "eski-1"]);
  });

  test("indirme SÜRERKEN taşıma: bulut + taşınanlar birleşir", async () => {
    const h = boot();
    h.remote.seed(path("bulut-1"), { id: "bulut-1", title: "Bulut", messages: [], updatedAt: 700 });
    putLegacy(h, legacyList());

    const hydrating = h.mods.aiConversations.ensureHydrated(UID);
    h.mods.aiApi.migrateLegacy(UID);
    await hydrating;

    expect(ids(h).sort()).toEqual(["bulut-1", "eski-1", "eski-2"]);
  });

  test("buluttaki/yerel daha yeni sürüm eski kopyayla EZİLMEZ", async () => {
    const h = boot();
    h.remote.seed(path("eski-1"), { id: "eski-1", title: "Güncel", messages: [], createdAt: 100, updatedAt: 9999 });
    await h.mods.aiConversations.ensureHydrated(UID);
    putLegacy(h, legacyList());

    expect(h.mods.aiApi.migrateLegacy(UID)).toBe(1); // yalnız eski-2
    expect(h.mods.aiApi.get(UID, "eski-1").title).toBe("Güncel");
  });

  test("bozuk girdiler atlanır, geçerliler taşınır", async () => {
    const h = boot();
    putLegacy(h, [null, { id: "" }, { id: "x" }, ...legacyList()]);
    await h.mods.aiConversations.ensureHydrated(UID);
    expect(h.mods.aiApi.migrateLegacy(UID)).toBe(2);
  });

  test("taşıma sırasında hata olursa yerel anahtar SİLİNMEZ", async () => {
    const h = boot();
    putLegacy(h, legacyList());
    await h.mods.aiConversations.ensureHydrated(UID);
    const spy = jest.spyOn(h.mods.aiConversations, "apply").mockImplementation(() => {
      throw new Error("disk dolu");
    });

    expect(() => h.mods.aiApi.migrateLegacy(UID)).toThrow("disk dolu");
    expect(legacyLeft(h)).toHaveLength(2);
    spy.mockRestore();
  });

  test("boş / yok → 0, hiçbir yazma yok", () => {
    const h = boot();
    expect(h.mods.aiApi.migrateLegacy(UID)).toBe(0);
    putLegacy(h, []);
    expect(h.mods.aiApi.migrateLegacy(UID)).toBe(0);
    expect(h.mods.outbox.counts(UID)).toEqual({ pending: 0, dead: 0 });
  });
});

describe("başka cihaz ve hesaplar", () => {
  test("yeniden eşitleme başka cihazdaki sohbeti getirir, bekleyen yerel yazımı korur", async () => {
    const h = boot();
    await h.mods.aiConversations.ensureHydrated(UID);
    h.mods.aiApi.save(UID, chat(1));
    await h.mods.worker.flush(UID);

    // İkinci cihaz bulutta yeni bir sohbet açtı.
    h.remote.seed(path("telefon-2"), { id: "telefon-2", title: "Diğer", messages: [], updatedAt: 99999 });
    // Bu cihazda henüz buluta gitmemiş bir cevap var.
    h.env.online = false;
    h.mods.aiApi.save(UID, chat(3));
    h.env.online = true;

    await h.mods.aiConversations.resync(UID);
    expect(ids(h).sort()).toEqual(["chat-1", "chat-3", "telefon-2"]);
  });

  test("başka cihazda silinen sohbet eşitlemede yerelden de kalkar", async () => {
    const h = boot();
    await h.mods.aiConversations.ensureHydrated(UID);
    h.mods.aiApi.save(UID, chat(1));
    h.mods.aiApi.save(UID, chat(2));
    await h.mods.worker.flush(UID);

    h.remote.db.delete(path("chat-1")); // ikinci cihaz sildi
    await h.mods.aiConversations.resync(UID);
    expect(ids(h)).toEqual(["chat-2"]);
  });

  test("iki hesap birbirinin sohbetini görmez; çıkış yalnız yerel kopyayı siler", async () => {
    const h = boot();
    h.remote.seed(path("a", "u1"), { id: "a", title: "u1", messages: [], updatedAt: 1 });
    h.remote.seed(path("b", "u2"), { id: "b", title: "u2", messages: [], updatedAt: 1 });
    await h.mods.aiConversations.ensureHydrated("u1");
    await h.mods.aiConversations.ensureHydrated("u2");

    expect(ids(h, "u1")).toEqual(["a"]);
    expect(ids(h, "u2")).toEqual(["b"]);

    h.mods.aiConversations.clearLocal("u1"); // u1 çıkış yaptı
    expect(ids(h, "u1")).toEqual([]);
    expect(ids(h, "u2")).toEqual(["b"]);
    expect(h.remote.db.has(path("a", "u1"))).toBe(true); // bulut yedeği durur
  });

  test("uid yokken kaydet/sil/temizle sessizce hiçbir şey yapmaz", () => {
    const h = boot();
    expect(h.mods.aiApi.save(null, chat(1))).toEqual([]);
    expect(h.mods.aiApi.remove(null, "x")).toEqual([]);
    expect(h.mods.aiApi.clearAll(null)).toEqual([]);
    expect(h.mods.aiApi.trim(null, 3)).toEqual([]);
    expect(h.mods.aiApi.list(null)).toEqual([]);
  });
});
