// __tests__/aiConversationStore.test.js
//
// CineMatch sohbet geçmişi — depo API'sinin davranışı (services/userData/aiConversations.js).
// Gerçek motor + gerçek günlük + sahte bulut (helpers/userDataHarness). Buluta
// özgü senaryolar (yeni telefon, çevrimdışı, eski geçmişin taşınması) için bkz.
// aiConversationsCloud.test.js.

const { boot } = require("./helpers/userDataHarness");
const {
  MAX_CONVERSATIONS,
  MAX_DOC_BYTES,
  MAX_MESSAGES,
  docBytes,
  fitMessages,
  flattenNestedArrays,
  limitOf,
  toConversationDoc,
  utf8Length,
} = require("../services/userData/aiConversations");

jest.useFakeTimers();
afterEach(() => jest.clearAllTimers());

const UID = "u1";
const path = (id) => `AiConversations/${UID}/items/${id}`;

const chat = (n, extra = {}) => ({
  id: `chat-${n}`,
  title: `Sohbet ${n}`,
  messages: [{ id: `u${n}`, role: "user", text: "x" }],
  createdAt: n,
  updatedAt: n,
  ...extra,
});

const ids = (h) => h.mods.aiApi.list(UID).map((c) => c.id);
const sync = async (h) => {
  await h.mods.aiConversations.ensureHydrated(UID);
  return h;
};
const flush = (h) => h.mods.worker.flush(UID);

describe("kaydetme", () => {
  test("ilk cevapta sohbeti kaydeder: belge şekli + yerel okuma + bulut yolu", async () => {
    const h = await sync(boot());
    const messages = [
      { id: "u1", role: "user", text: "Bana film öner" },
      { id: "a1", role: "assistant", text: "Arrival" },
    ];

    h.mods.aiApi.save(UID, { id: "chat-1", title: "Bana film öner", messages, createdAt: 100, updatedAt: 100 });

    expect(h.mods.aiApi.list(UID)).toEqual([
      expect.objectContaining({
        v: 1,
        id: "chat-1",
        title: "Bana film öner",
        messages,
        messageCount: 2,
        createdAt: 100,
        updatedAt: 100,
      }),
    ]);

    await flush(h);
    expect(h.remote.db.get(path("chat-1"))).toMatchObject({ id: "chat-1", messageCount: 2 });
  });

  test("aynı sohbette sonraki cevap yeni kayıt açmaz; oluşturulma zamanı korunur", async () => {
    const h = await sync(boot());
    h.mods.aiApi.save(UID, chat(1, { createdAt: 100, updatedAt: 100 }));

    const longer = [
      { id: "u1", role: "user", text: "x" },
      { id: "a1", role: "assistant", text: "Arrival" },
      { id: "u2", role: "user", text: "Bir tane daha" },
      { id: "a2", role: "assistant", text: "Contact" },
    ];
    // Ekran her kayıtta createdAt: şimdi gönderir — depo ilkini korumalı.
    h.mods.aiApi.save(UID, chat(1, { messages: longer, createdAt: 200, updatedAt: 200 }));

    const saved = h.mods.aiApi.list(UID);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ id: "chat-1", createdAt: 100, updatedAt: 200, messageCount: 4 });
    expect(saved[0].messages).toEqual(longer);

    await flush(h);
    expect(h.remote.db.get(path("chat-1"))).toMatchObject({ createdAt: 100, updatedAt: 200 });
  });

  test("bir sohbetin 20 güncellemesi buluta tek yazma olarak gider", async () => {
    const h = await sync(boot());
    for (let i = 1; i <= 20; i += 1) {
      h.mods.aiApi.save(UID, chat(1, { updatedAt: i, messages: [{ id: "u", role: "user", text: `m${i}` }] }));
    }
    await flush(h);
    const writes = h.remote.calls.commit.flat().filter((op) => op.path === path("chat-1"));
    expect(writes).toHaveLength(1);
    expect(h.remote.db.get(path("chat-1")).messages[0].text).toBe("m20");
  });

  test("geçersiz girişte hiçbir şey yazılmaz", async () => {
    const h = await sync(boot());
    expect(h.mods.aiApi.save(UID, null)).toEqual([]);
    expect(h.mods.aiApi.save(UID, { id: "", messages: [] })).toEqual([]);
    expect(h.mods.aiApi.save(UID, { id: "x", messages: "yanlış" })).toEqual([]);
    expect(h.mods.aiApi.save("", chat(1))).toEqual([]);
    expect(h.mods.outbox.counts(UID)).toEqual({ pending: 0, dead: 0 });
  });
});

describe("saklama sınırı", () => {
  test("sınır aşılınca en eski sohbetler cihazdan VE bulutdan silinir", async () => {
    const h = await sync(boot());
    for (let n = 1; n <= 4; n += 1) {
      h.mods.aiApi.save(UID, chat(n), { limit: 3 });
      await flush(h);
    }
    expect(ids(h)).toEqual(["chat-4", "chat-3", "chat-2"]);
    expect([...h.remote.db.keys()].sort()).toEqual([path("chat-2"), path("chat-3"), path("chat-4")]);
  });

  test("geçersiz sınır varsayılana (50) düşer, sohbet kaybolmaz", async () => {
    const h = await sync(boot());
    h.mods.aiApi.save(UID, chat(1), { limit: 0 });
    h.mods.aiApi.save(UID, chat(2), { limit: "x" });
    expect(ids(h)).toHaveLength(2);
    expect(limitOf(0)).toBe(MAX_CONVERSATIONS);
    expect(limitOf(999)).toBe(MAX_CONVERSATIONS);
    expect(limitOf(10)).toBe(10);
  });

  test("sınır düşürülünce geçmiş hemen kırpılır; yeterliyse hiçbir yazma olmaz", async () => {
    const h = await sync(boot());
    for (let n = 1; n <= 5; n += 1) h.mods.aiApi.save(UID, chat(n));
    await flush(h);
    const before = h.remote.calls.commit.length;

    expect(h.mods.aiApi.trim(UID, 10)).toHaveLength(5);
    await flush(h);
    expect(h.remote.calls.commit.length).toBe(before);

    expect(h.mods.aiApi.trim(UID, 2).map((c) => c.id)).toEqual(["chat-5", "chat-4"]);
    await flush(h);
    expect([...h.remote.db.keys()].sort()).toEqual([path("chat-4"), path("chat-5")]);
  });

  test("kaydedilen sohbet kendi kendini silmez (eski updatedAt ile bile)", async () => {
    const h = await sync(boot());
    for (let n = 10; n <= 12; n += 1) h.mods.aiApi.save(UID, chat(n), { limit: 3 });
    h.mods.aiApi.save(UID, chat(1), { limit: 3 }); // en eskisi ama az önce kaydedildi
    expect(ids(h)).toContain("chat-1");
  });
});

describe("silme", () => {
  test("tek sohbet silinir (yerel + bulut)", async () => {
    const h = await sync(boot());
    h.mods.aiApi.save(UID, chat(1));
    h.mods.aiApi.save(UID, chat(2));
    await flush(h);

    h.mods.aiApi.remove(UID, "chat-1");
    expect(ids(h)).toEqual(["chat-2"]);
    await flush(h);
    expect(h.remote.db.has(path("chat-1"))).toBe(false);
    expect(h.remote.db.has(path("chat-2"))).toBe(true);
  });

  test("tümünü temizle geçmişi boşaltır ve sonraki kayıt yeniden başlar", async () => {
    const h = await sync(boot());
    h.mods.aiApi.save(UID, chat(1));
    h.mods.aiApi.save(UID, chat(2));
    await flush(h);

    h.mods.aiApi.clearAll(UID);
    expect(h.mods.aiApi.list(UID)).toEqual([]);
    await flush(h);
    expect(h.remote.db.size).toBe(0);

    h.mods.aiApi.save(UID, chat(3));
    expect(ids(h)).toEqual(["chat-3"]);
  });

  test("boşken temizle ve kırp hiçbir yazma üretmez", async () => {
    const h = await sync(boot());
    h.mods.aiApi.clearAll(UID);
    h.mods.aiApi.trim(UID, 5);
    expect(h.mods.outbox.counts(UID)).toEqual({ pending: 0, dead: 0 });
  });
});

describe("belge şekli ve boyut bütçesi", () => {
  test("undefined alanlar atılır, iç içe diziler düzleşir (Firestore reddeder)", () => {
    const doc = toConversationDoc({
      id: "c",
      title: "t",
      messages: [
        {
          id: "a1",
          role: "assistant",
          aiResponse: { type: "x", rows: [[1, 2], [3]], gizli: undefined },
          posterMap: { k: { found: true, cast: [["a"], "b"] } },
        },
      ],
    });
    expect(doc.messages[0].aiResponse.rows).toEqual([1, 2, 3]);
    expect(doc.messages[0].aiResponse).not.toHaveProperty("gizli");
    expect(doc.messages[0].posterMap.k.cast).toEqual(["a", "b"]);
    expect(JSON.stringify(doc)).not.toMatch(/\[\[/);
  });

  test("flattenNestedArrays girdiyi değiştirmez ve düz değerlere dokunmaz", () => {
    const input = { a: [[1], [2, [3]]], d: new Date(0), n: null, s: "x" };
    const out = flattenNestedArrays(input);
    expect(out.a).toEqual([1, 2, 3]);
    expect(input.a).toEqual([[1], [2, [3]]]);
    expect(out.d).toBe(input.d);
    expect(out.n).toBeNull();
  });

  test("geçersiz girdi → null", () => {
    expect(toConversationDoc(null)).toBeNull();
    expect(toConversationDoc({ id: 5, messages: [] })).toBeNull();
    expect(toConversationDoc({ id: "x" })).toBeNull();
  });

  const turn = (i, size) => [
    { id: `u${i}`, role: "user", text: `soru ${i}` },
    { id: `a${i}`, role: "assistant", text: "y".repeat(size) },
  ];

  test("bütçeyi aşan sohbette EN ESKİ turlar düşer; son tur ve başlık kalır", () => {
    const messages = Array.from({ length: 10 }, (_, i) => turn(i, 60_000)).flat();
    const doc = toConversationDoc({ id: "c", title: "Uzun sohbet", messages });

    expect(docBytes(doc)).toBeLessThanOrEqual(MAX_DOC_BYTES);
    expect(doc.title).toBe("Uzun sohbet");
    expect(doc.messageCount).toBe(doc.messages.length);
    expect(doc.messages.length).toBeLessThan(messages.length);
    // Tam turlar: ilk mesaj kullanıcı mesajı, son mesaj orijinalin son mesajı.
    expect(doc.messages[0].role).toBe("user");
    expect(doc.messages[doc.messages.length - 1].id).toBe("a9");
  });

  test("tek mesaj bile bütçeyi aşsa çökmez, son mesaj kalır", () => {
    const doc = toConversationDoc({
      id: "c",
      title: "t",
      messages: [
        { id: "u", role: "user", text: "q" },
        { id: "a", role: "assistant", text: "z".repeat(MAX_DOC_BYTES + 10) },
      ],
    });
    expect(doc.messages.map((m) => m.id)).toEqual(["a"]);
  });

  test("bütçe KARAKTER değil BAYT ile hesaplanır: ASCII dışı sohbet de tavana sığar", () => {
    // 60 000 Çince karakter ~180 KB eder: 4 tur toplam ~240 000 KARAKTER (karakter bütçesine sığar)
    // ama ~720 KB (bayt bütçesini aşar).
    const wide = (i) => [
      { id: `u${i}`, role: "user", text: "soru" },
      { id: `a${i}`, role: "assistant", text: "你".repeat(60_000) },
    ];
    const messages = Array.from({ length: 4 }, (_, i) => wide(i)).flat();
    expect(JSON.stringify({ messages }).length).toBeLessThan(MAX_DOC_BYTES); // karakter ölçüsüyle sığıyor
    expect(docBytes({ messages })).toBeGreaterThan(MAX_DOC_BYTES); // bayt ölçüsüyle sığmıyor
    const doc = toConversationDoc({ id: "c", title: "t", messages });
    expect(docBytes(doc)).toBeLessThanOrEqual(MAX_DOC_BYTES);
    expect(doc.messages.length).toBeLessThan(messages.length); // en eski turlar düştü
    expect(doc.messages[doc.messages.length - 1].id).toBe("a3");
  });

  test("utf8Length gerçek UTF-8 uzunluğuyla birebir (ASCII, vurgulu, CJK, emoji)", () => {
    for (const sample of ["abc", "şğüıöç İŞ", "你好", "film 🎬 öner", "𝄞"]) {
      expect(utf8Length(sample)).toBe(Buffer.byteLength(sample, "utf8"));
    }
  });

  test("mesaj sayısı tavanı (bütçeden bağımsız)", () => {
    const messages = Array.from({ length: MAX_MESSAGES + 30 }, (_, i) => ({
      id: `m${i}`,
      role: i % 2 === 0 ? "user" : "assistant",
      text: "k",
    }));
    const { messages: kept, dropped } = fitMessages(messages, (list) => ({ messages: list }));
    expect(kept.length).toBeLessThanOrEqual(MAX_MESSAGES);
    expect(dropped).toBe(messages.length - kept.length);
    expect(kept[0].role).toBe("user");
  });
});
