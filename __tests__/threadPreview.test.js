import {
  PREVIEW_MAX,
  isLatestMessage,
  latestAfterDelete,
  latestServerMessage,
  previewOf,
} from "../utils/threadPreview";

const m = (id, text, extra = {}) => ({ id, text, ...extra });

describe("previewOf", () => {
  test("metni olduğu gibi, uzunsa kırparak verir; mesaj yoksa boş", () => {
    expect(previewOf(m("a", "selam"))).toBe("selam");
    expect(previewOf(m("a", "x".repeat(500)))).toHaveLength(PREVIEW_MAX);
    expect(previewOf(null)).toBe("");
    expect(previewOf(m("a", undefined))).toBe("");
  });
});

describe("latestServerMessage", () => {
  test("iyimser yerel mesajı atlar", () => {
    const list = [m("local-1", "gidiyor", { _optimistic: true }), m("a", "eski")];
    expect(latestServerMessage(list).id).toBe("a");
  });

  test("excludeId atlanır; boş/geçersiz girdi null", () => {
    expect(latestServerMessage([m("a", "1"), m("b", "2")], { excludeId: "a" }).id).toBe("b");
    expect(latestServerMessage([])).toBeNull();
    expect(latestServerMessage(undefined)).toBeNull();
  });
});

describe("isLatestMessage", () => {
  test("yalnız en yeni sunucu mesajı için true", () => {
    const list = [m("c", "3"), m("b", "2"), m("a", "1")];
    expect(isLatestMessage(list, "c")).toBe(true);
    expect(isLatestMessage(list, "b")).toBe(false);
    expect(isLatestMessage([], "c")).toBe(false);
  });

  test("iyimser mesaj en yeni sayılmaz", () => {
    const list = [m("local-x", "...", { _optimistic: true }), m("a", "1")];
    expect(isLatestMessage(list, "a")).toBe(true);
  });
});

describe("latestAfterDelete", () => {
  const list = [m("c", "3"), m("b", "2"), m("a", "1")];

  test("en yeni silinince bir önceki mesaj önizleme olur", () => {
    expect(latestAfterDelete(list, "c").id).toBe("b");
  });

  test("eski bir mesaj silinince önizleme değişmez (undefined)", () => {
    expect(latestAfterDelete(list, "a")).toBeUndefined();
  });

  test("tek mesaj silinince önizleme boşalır (null)", () => {
    expect(latestAfterDelete([m("a", "1")], "a")).toBeNull();
  });
});
