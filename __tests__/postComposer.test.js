const {
  validatePost,
  reorderArray,
  buildPollObject,
  tallyVotes,
  POST_TYPES,
} = require("../utils/postComposer");

describe("validatePost", () => {
  test("başlık zorunlu (her tip)", () => {
    expect(validatePost({ type: "text", title: "  ", content: "x" }).error).toBe("title");
  });

  test("review: media + içerik zorunlu", () => {
    expect(validatePost({ type: "review", title: "T", content: "c", selectedMedia: [] }).error).toBe("reviewMedia");
    expect(validatePost({ type: "review", title: "T", content: "", selectedMedia: [{ id: 1 }] }).error).toBe("content");
    expect(validatePost({ type: "review", title: "T", content: "c", selectedMedia: [{ id: 1 }] }).ok).toBe(true);
  });

  test("list: en az 2 içerik", () => {
    expect(validatePost({ type: "list", title: "T", content: "c", selectedMedia: [{ id: 1 }] }).error).toBe("listMedia");
    expect(validatePost({ type: "list", title: "T", content: "c", selectedMedia: [{ id: 1 }, { id: 2 }] }).ok).toBe(true);
  });

  test("text: yalnız başlık + içerik (media gerekmez)", () => {
    expect(validatePost({ type: "text", title: "T", content: "" }).error).toBe("content");
    expect(validatePost({ type: "text", title: "T", content: "bugün ne izlesem" }).ok).toBe(true);
  });

  test("poll: en az 2 geçerli seçenek", () => {
    expect(validatePost({ type: "poll", title: "T", pollOptions: [{ label: "a" }] }).error).toBe("pollOptions");
    expect(validatePost({ type: "poll", title: "T", pollOptions: [{ label: "a" }, { media: { id: 5 } }] }).ok).toBe(true);
    // boş seçenekler sayılmaz
    expect(validatePost({ type: "poll", title: "T", pollOptions: [{ label: "a" }, { label: "  " }] }).error).toBe("pollOptions");
  });

  test("geçersiz tip", () => {
    expect(validatePost({ type: "story", title: "T" }).error).toBe("type");
    expect(POST_TYPES).toContain("poll");
  });
});

describe("reorderArray", () => {
  test("öğeyi taşır (mutasyonsuz)", () => {
    const arr = ["a", "b", "c", "d"];
    expect(reorderArray(arr, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(reorderArray(arr, 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(arr).toEqual(["a", "b", "c", "d"]); // orijinal değişmez
  });

  test("geçersiz/aynı indeks → aynı referans", () => {
    const arr = ["a", "b"];
    expect(reorderArray(arr, 1, 1)).toBe(arr);
    expect(reorderArray(arr, 0, 5)).toBe(arr);
    expect(reorderArray(arr, -1, 0)).toBe(arr);
  });
});

describe("buildPollObject", () => {
  test("media anketi — poster + boş oy haritası", () => {
    const poll = buildPollObject({
      pollType: "media",
      question: "Hangisi?",
      options: [
        { media: { id: 1, type: "movie", poster_path: "/a.jpg" }, label: "Dune" },
        { media: { id: 2, type: "tv", poster_path: "/b.jpg" }, label: "Loki" },
      ],
    });
    expect(poll.type).toBe("media");
    expect(poll.question).toBe("Hangisi?");
    expect(poll.options).toHaveLength(2);
    expect(poll.options[0].media.poster_path).toBe("/a.jpg");
    expect(poll.votes).toEqual({});
  });

  test("boş seçenekleri eler, id atar", () => {
    const poll = buildPollObject({
      pollType: "text",
      question: "Q",
      options: [{ label: "a" }, { label: "  " }, { label: "b" }],
    });
    expect(poll.options).toHaveLength(2);
    expect(poll.options[0].id).toBe("opt_0");
  });
});

describe("tallyVotes", () => {
  test("seçenek başına sayı + toplam", () => {
    const { counts, total } = tallyVotes({ u1: "a", u2: "a", u3: "b" });
    expect(counts).toEqual({ a: 2, b: 1 });
    expect(total).toBe(3);
  });
  test("boş/null oylar sayılmaz", () => {
    expect(tallyVotes({ u1: null }).total).toBe(0);
    expect(tallyVotes({}).total).toBe(0);
  });
});
