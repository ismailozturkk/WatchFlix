import {
  buildReplySnapshot,
  cleanReplyPreview,
  replyGlyph,
  replyKind,
  replyThumb,
} from "../utils/chatReply";

const text = { id: "m1", senderId: "u1", text: "selam" };
const movie = {
  id: "m2",
  senderId: "u2",
  text: "Inception",
  media: { media_type: "movie", title: "Inception", poster_path: "/inc.jpg" },
};
const person = {
  id: "m3",
  senderId: "u2",
  media: { media_type: "person", name: "Nolan", profile_path: "/nolan.jpg" },
};
const collection = {
  id: "m4",
  senderId: "u1",
  kind: "collection",
  items: [{ title: "A" }, { title: "B", poster_path: "/b.jpg" }],
};
const poll = { id: "m5", senderId: "u1", kind: "poll", poll: { question: "Hangisi?" } };

describe("replyKind", () => {
  test("classifies each message shape", () => {
    expect(replyKind(text)).toBe("text");
    expect(replyKind(movie)).toBe("media");
    expect(replyKind(collection)).toBe("collection");
    expect(replyKind(poll)).toBe("poll");
    expect(replyKind(null)).toBe("text");
  });

  test("treats unknown legacy kinds as plain text", () => {
    expect(replyKind({ id: "x", kind: "list", text: "hi" })).toBe("text");
    // kind:"poll" without a poll body cannot be rendered as a poll
    expect(replyKind({ id: "x", kind: "poll", text: "hi" })).toBe("text");
  });
});

describe("replyThumb", () => {
  test("uses the poster of a single media message", () => {
    expect(replyThumb(movie)).toBe("/inc.jpg");
  });

  test("falls back to profile_path for people", () => {
    expect(replyThumb(person)).toBe("/nolan.jpg");
  });

  test("takes the first collection item that has artwork", () => {
    expect(replyThumb(collection)).toBe("/b.jpg");
  });

  test("returns null for text, polls and artwork-less media", () => {
    expect(replyThumb(text)).toBeNull();
    expect(replyThumb(poll)).toBeNull();
    expect(replyThumb({ id: "x", media: { title: "No art" } })).toBeNull();
  });
});

describe("buildReplySnapshot", () => {
  test("text reply carries no optional fields (Firestore rejects undefined)", () => {
    const snapshot = buildReplySnapshot(text, { senderName: "Ali", preview: "selam" });
    expect(snapshot).toEqual({
      messageId: "m1",
      senderId: "u1",
      senderName: "Ali",
      preview: "selam",
      kind: "text",
    });
    expect(Object.values(snapshot)).not.toContain(undefined);
  });

  test("media reply adds thumb and mediaType", () => {
    expect(buildReplySnapshot(movie, { senderName: "Ayşe", preview: "Inception" })).toEqual({
      messageId: "m2",
      senderId: "u2",
      senderName: "Ayşe",
      preview: "Inception",
      kind: "media",
      thumb: "/inc.jpg",
      mediaType: "movie",
    });
  });

  test("collection reply gets a thumb but no mediaType", () => {
    const snapshot = buildReplySnapshot(collection, { senderName: "Ali", preview: "2 içerik" });
    expect(snapshot.thumb).toBe("/b.jpg");
    expect("mediaType" in snapshot).toBe(false);
    expect(snapshot.kind).toBe("collection");
  });

  test("missing senderId becomes an empty string", () => {
    const snapshot = buildReplySnapshot({ id: "z", text: "x" }, { senderName: "?", preview: "x" });
    expect(snapshot.senderId).toBe("");
  });
});

describe("cleanReplyPreview", () => {
  test("drops the legacy poll emoji prefix", () => {
    expect(cleanReplyPreview("📊 Hangisi?", "poll")).toBe("Hangisi?");
  });

  test("leaves other kinds and non-strings alone", () => {
    expect(cleanReplyPreview("📊 not a poll", "text")).toBe("📊 not a poll");
    expect(cleanReplyPreview(undefined, "poll")).toBe("");
  });
});

describe("replyGlyph", () => {
  test("maps kinds to icons, none for plain text", () => {
    expect(replyGlyph("text")).toBeNull();
    expect(replyGlyph("poll")).toBe("stats-chart");
    expect(replyGlyph("collection")).toBe("albums");
    expect(replyGlyph("media", "tv")).toBe("tv");
    expect(replyGlyph("media", "person")).toBe("person");
    expect(replyGlyph("media", "movie")).toBe("film");
    expect(replyGlyph("media")).toBe("film");
  });
});
