jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearCineConversations,
  loadCineConversations,
  saveCineConversation,
  trimCineConversations,
} from "../services/aiCineStore";

describe("AI sohbet geçmişi", () => {
  let storage;

  beforeEach(async () => {
    // Depo (MMKV) testler arasında bellekte kalır; her test temiz bir geçmişle başlasın.
    await clearCineConversations();
    storage = new Map();
    AsyncStorage.getItem.mockImplementation(async (key) => storage.get(key) ?? null);
    AsyncStorage.setItem.mockImplementation(async (key, value) => {
      storage.set(key, value);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("ilk cevapta sohbeti kaydeder", async () => {
    const messages = [
      { id: "u1", role: "user", text: "Bana film öner" },
      { id: "a1", role: "assistant", text: "Arrival" },
    ];

    await saveCineConversation({
      id: "chat-1",
      title: "Bana film öner",
      messages,
      createdAt: 100,
      updatedAt: 100,
    });

    await expect(loadCineConversations()).resolves.toEqual([
      expect.objectContaining({ id: "chat-1", messages }),
    ]);
  });

  test("aynı sohbette sonraki cevap geldiğinde yeni kayıt açmadan kaydı günceller", async () => {
    await saveCineConversation({
      id: "chat-1",
      title: "Bana film öner",
      messages: [
        { id: "u1", role: "user", text: "Bana film öner" },
        { id: "a1", role: "assistant", text: "Arrival" },
      ],
      createdAt: 100,
      updatedAt: 100,
    });

    const updatedMessages = [
      { id: "u1", role: "user", text: "Bana film öner" },
      { id: "a1", role: "assistant", text: "Arrival" },
      { id: "u2", role: "user", text: "Bir tane daha" },
      { id: "a2", role: "assistant", text: "Contact" },
    ];
    await saveCineConversation({
      id: "chat-1",
      title: "Bana film öner",
      messages: updatedMessages,
      createdAt: 200,
      updatedAt: 200,
    });

    const saved = await loadCineConversations();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toEqual(
      expect.objectContaining({
        id: "chat-1",
        createdAt: 100,
        updatedAt: 200,
        messages: updatedMessages,
      }),
    );
  });

  const chat = (n) => ({
    id: `chat-${n}`,
    title: `Sohbet ${n}`,
    messages: [{ id: `u${n}`, role: "user", text: "x" }],
    createdAt: n,
    updatedAt: n,
  });

  test("saklama sınırı aşılınca en eski sohbetler silinir", async () => {
    for (let n = 1; n <= 4; n += 1) {
      await saveCineConversation(chat(n), { limit: 3 });
    }
    const saved = await loadCineConversations();
    expect(saved.map((c) => c.id)).toEqual(["chat-4", "chat-3", "chat-2"]);
  });

  test("geçersiz sınır varsayılana (50) düşer, sohbet kaybolmaz", async () => {
    await saveCineConversation(chat(1), { limit: 0 });
    await saveCineConversation(chat(2), { limit: "x" });
    await expect(loadCineConversations()).resolves.toHaveLength(2);
  });

  test("sınır düşürülünce kayıtlı geçmiş hemen kırpılır; yeterliyse dokunulmaz", async () => {
    for (let n = 1; n <= 5; n += 1) {
      await saveCineConversation(chat(n));
    }
    const writesBefore = AsyncStorage.setItem.mock.calls.length;
    const same = await trimCineConversations(10);
    expect(same).toHaveLength(5);
    expect(AsyncStorage.setItem.mock.calls.length).toBe(writesBefore);

    const trimmed = await trimCineConversations(2);
    expect(trimmed.map((c) => c.id)).toEqual(["chat-5", "chat-4"]);
    await expect(loadCineConversations()).resolves.toHaveLength(2);
  });

  test("tümünü temizle geçmişi boşaltır ve sonraki kayıt yeniden başlar", async () => {
    await saveCineConversation(chat(1));
    await saveCineConversation(chat(2));
    await clearCineConversations();
    await expect(loadCineConversations()).resolves.toEqual([]);

    await saveCineConversation(chat(3));
    const saved = await loadCineConversations();
    expect(saved.map((c) => c.id)).toEqual(["chat-3"]);
  });
});
