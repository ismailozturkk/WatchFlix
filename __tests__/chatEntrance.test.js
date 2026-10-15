import {
  ENTRANCE_WINDOW_MS,
  detectFreshMessages,
  entranceFor,
  messageKey,
  recordFresh,
} from "../utils/chatEntrance";

const ME = "me";
const msg = (id, senderId = "friend", extra = {}) => ({ id, senderId, ...extra });

describe("detectFreshMessages", () => {
  test("flags a new incoming message at the head as receive", () => {
    const prev = [msg("a"), msg("b")];
    const next = [msg("c"), msg("a"), msg("b")];
    expect(detectFreshMessages(prev, next, ME)).toEqual([{ key: "c", kind: "receive" }]);
  });

  test("flags my own new message as send", () => {
    const prev = [msg("a")];
    const next = [msg("m1", ME), msg("a")];
    expect(detectFreshMessages(prev, next, ME)).toEqual([{ key: "m1", kind: "send" }]);
  });

  test("does not flag older messages appended at the tail (history paging)", () => {
    const prev = [msg("a"), msg("b")];
    const next = [msg("a"), msg("b"), msg("c"), msg("d")];
    expect(detectFreshMessages(prev, next, ME)).toEqual([]);
  });

  test("returns nothing when the list is unchanged", () => {
    const list = [msg("a"), msg("b")];
    expect(detectFreshMessages(list, [...list], ME)).toEqual([]);
  });

  test("optimistic → server swap keeps the same key and is not fresh again", () => {
    const optimistic = msg("local-1", ME, { clientId: "c1", _optimistic: true });
    const server = msg("srv-1", ME, { clientId: "c1" });
    const older = msg("a");
    expect(messageKey(optimistic)).toBe(messageKey(server));
    expect(detectFreshMessages([optimistic, older], [server, older], ME)).toEqual([]);
  });

  test("an incoming message that lands behind my pending bubble is still detected", () => {
    const pending = msg("local-1", ME, { clientId: "c1", _optimistic: true });
    const older = msg("a");
    const incoming = msg("f1");
    const prev = [pending, older];
    const next = [pending, incoming, older];
    expect(detectFreshMessages(prev, next, ME)).toEqual([{ key: "f1", kind: "receive" }]);
  });

  test("first message of an empty chat animates", () => {
    expect(detectFreshMessages([], [msg("a")], ME)).toEqual([{ key: "a", kind: "receive" }]);
  });

  test("a big first page into an empty list is a load, not new messages", () => {
    const page = [msg("a"), msg("b"), msg("c"), msg("d"), msg("e")];
    expect(detectFreshMessages([], page, ME)).toEqual([]);
  });

  test("a fully replaced window (no anchor) is not guessed", () => {
    expect(detectFreshMessages([msg("a")], [msg("x"), msg("y")], ME)).toEqual([]);
  });

  test("caps a burst so the screen does not erupt", () => {
    const prev = [msg("old")];
    const burst = ["n1", "n2", "n3", "n4", "n5", "n6"].map((id) => msg(id));
    const result = detectFreshMessages(prev, [...burst, msg("old")], ME);
    expect(result).toHaveLength(4);
  });

  test("tolerates missing input", () => {
    expect(detectFreshMessages(null, [msg("a")], ME)).toEqual([]);
    expect(detectFreshMessages([msg("a")], null, ME)).toEqual([]);
    expect(detectFreshMessages([msg("a")], [], ME)).toEqual([]);
  });
});

describe("entrance registry", () => {
  test("a recorded entry plays inside the window and is silent after it", () => {
    const registry = new Map();
    recordFresh(registry, [{ key: "k", kind: "send" }], 1000);
    expect(entranceFor(registry, "k", 1000 + ENTRANCE_WINDOW_MS - 1)).toBe("send");
    expect(entranceFor(registry, "k", 1000 + ENTRANCE_WINDOW_MS + 1)).toBeNull();
    expect(entranceFor(registry, "missing", 1000)).toBeNull();
  });

  test("stale entries are pruned on the next record", () => {
    const registry = new Map();
    recordFresh(registry, [{ key: "old", kind: "receive" }], 0);
    recordFresh(registry, [{ key: "new", kind: "receive" }], ENTRANCE_WINDOW_MS * 10);
    expect([...registry.keys()]).toEqual(["new"]);
  });
});
