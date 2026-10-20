import {
  createMessageClientId,
  mergeServerMessages,
  removeOptimisticMessage,
} from "../utils/chatOptimistic";

describe("chat optimistic messages", () => {
  test("keeps the local message visible until Firestore echoes it", () => {
    const optimistic = {
      id: "local-1",
      clientId: "client-1",
      _optimistic: true,
      _chatId: "chat-a",
    };
    const merged = mergeServerMessages([{ id: "old" }], [optimistic], "chat-a");
    expect(merged.map((item) => item.id)).toEqual(["local-1", "old"]);
  });

  test("replaces the local message when the matching server document arrives", () => {
    const optimistic = {
      id: "local-1",
      clientId: "client-1",
      _optimistic: true,
      _chatId: "chat-a",
    };
    const server = { id: "server-1", clientId: "client-1" };
    expect(mergeServerMessages([server], [optimistic], "chat-a")).toEqual([server]);
  });

  test("keeps one optimistic bubble while Firestore still reports a pending write", () => {
    const optimistic = {
      id: "local-1",
      clientId: "client-1",
      _optimistic: true,
      _chatId: "chat-a",
    };
    const localFirestoreEcho = {
      id: "server-1",
      clientId: "client-1",
      _pendingWrite: true,
    };
    expect(
      mergeServerMessages([localFirestoreEcho], [optimistic], "chat-a"),
    ).toEqual([optimistic]);
  });

  test("does not carry a pending message into another chat", () => {
    const optimistic = {
      id: "local-1",
      clientId: "client-1",
      _optimistic: true,
      _chatId: "chat-a",
    };
    expect(mergeServerMessages([], [optimistic], "chat-b")).toEqual([]);
  });

  test("creates unique client ids and removes failed local messages", () => {
    expect(createMessageClientId("u1", () => 42, () => 0.5)).toBe("u1-42-i");
    expect(
      removeOptimisticMessage(
        [
          { id: "local", clientId: "c1", _optimistic: true },
          { id: "server", clientId: "c2" },
        ],
        "c1",
      ),
    ).toEqual([{ id: "server", clientId: "c2" }]);
  });
});
