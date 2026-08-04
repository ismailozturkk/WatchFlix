jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  loadCineConversations,
  saveCineConversation,
} from "../services/aiCineStore";

describe("AI sohbet geçmişi", () => {
  let storage;

  beforeEach(() => {
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
});
