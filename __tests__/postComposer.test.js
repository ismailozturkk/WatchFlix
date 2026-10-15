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

describe("appendQuickText (hızlı ekle)", () => {
  const { appendQuickText } = require("../utils/postComposer");

  test("boş alana doğrudan yazar", () => {
    expect(appendQuickText("", "Inception", { max: 100 })).toEqual({
      text: "Inception",
      changed: true,
      reason: null,
    });
    // yalnız boşluk da boş sayılır
    expect(appendQuickText("   ", "Inception", { max: 100 }).text).toBe("Inception");
  });

  test("dolu alanı EZMEZ, sonuna ayraçla ekler", () => {
    const r = appendQuickText("Harika bir film", "Inception", { max: 100, separator: " · " });
    expect(r).toEqual({ text: "Harika bir film · Inception", changed: true, reason: null });
  });

  test("varsayılan ayraç paragraf boşluğu (açıklama için)", () => {
    expect(appendQuickText("Notum", "Özet metni").text).toBe("Notum\n\nÖzet metni");
  });

  test("zaten içeriyorsa tekrar eklemez (büyük/küçük harf duyarsız)", () => {
    const r = appendQuickText("INCEPTION hakkında", "Inception", { max: 100 });
    expect(r).toEqual({ text: "INCEPTION hakkında", changed: false, reason: "duplicate" });
  });

  test("eklenecek metin boşsa hiçbir şey değişmez", () => {
    expect(appendQuickText("abc", "  ", { max: 10 })).toEqual({ text: "abc", changed: false, reason: "empty" });
    expect(appendQuickText("abc", null, { max: 10 }).reason).toBe("empty");
  });

  test("sınıra sığmıyorsa ek metin … ile kırpılır", () => {
    const r = appendQuickText("Not", "x".repeat(50), { max: 30, separator: "\n\n" });
    expect(r.changed).toBe(true);
    expect(r.text.length).toBeLessThanOrEqual(30);
    expect(r.text.startsWith("Not\n\n")).toBe(true);
    expect(r.text.endsWith("…")).toBe(true);
  });

  test("boş alanda sınırı aşan metin de kırpılır", () => {
    const r = appendQuickText("", "y".repeat(40), { max: 20 });
    expect(r.text.length).toBeLessThanOrEqual(20);
    expect(r.text.endsWith("…")).toBe(true);
  });

  test("kırpılacak yer 12 karakterden azsa hiç dokunmaz (reason: full)", () => {
    const base = "a".repeat(95);
    const r = appendQuickText(base, "Film adı", { max: 100, separator: " · " });
    expect(r).toEqual({ text: base, changed: false, reason: "full" });
  });

  test("string olmayan alan boş sayılır", () => {
    expect(appendQuickText(undefined, "Ad", { max: 10 }).text).toBe("Ad");
  });

  test("kırpılarak eklenmiş uzun özet ikinci dokunuşta ikilenmez", () => {
    const ozet = "Rüyaların içine girerek fikir çalan bir hırsız. ".repeat(6).trim();
    const ilk = appendQuickText("Notum", ozet, { max: 120 });
    expect(ilk.changed).toBe(true);
    const ikinci = appendQuickText(ilk.text, ozet, { max: 120 });
    expect(ikinci.changed).toBe(false);
    expect(ikinci.reason).toBe("duplicate");
  });

  test("isQuickTextPresent: boş girdilerde false", () => {
    const { isQuickTextPresent } = require("../utils/postComposer");
    expect(isQuickTextPresent("", "x")).toBe(false);
    expect(isQuickTextPresent("abc", "")).toBe(false);
    expect(isQuickTextPresent("Merhaba Inception", "inception")).toBe(true);
  });
});

describe("resolveCloseIntent", () => {
  const { resolveCloseIntent } = require("../utils/postComposer");

  test("onay sayfası açıkken geri/çarpı yalnız onu kapatır", () => {
    // Pencerenin kendisi kapanmamalı: iOS'ta çarpı "çalışmıyor" hatasının tersi.
    expect(resolveCloseIntent({ promptOpen: true, hasContent: true })).toBe("leave-prompt");
    expect(resolveCloseIntent({ promptOpen: true, searchActive: true })).toBe("leave-prompt");
  });

  test("içerik araması açıkken önce aramadan çıkılır", () => {
    expect(resolveCloseIntent({ searchActive: true, hasContent: true })).toBe("close-search");
  });

  test("kaybedilecek içerik yoksa doğrudan kapanır", () => {
    expect(resolveCloseIntent({})).toBe("close");
    expect(resolveCloseIntent({ hasContent: false, isEditing: true })).toBe("close");
  });

  test("içerik varken düzenleme 'iptal et?', yeni paylaşım 'taslağa kaydet?' sorar", () => {
    expect(resolveCloseIntent({ hasContent: true, isEditing: true })).toBe("confirm-edit");
    expect(resolveCloseIntent({ hasContent: true })).toBe("confirm-draft");
  });

  test("taslak zaten kayıtlıysa sormadan kapanır; düzenlemede bu geçerli değil", () => {
    expect(resolveCloseIntent({ hasContent: true, isSavedDraft: true })).toBe("close");
    expect(resolveCloseIntent({ hasContent: true, isEditing: true, isSavedDraft: true })).toBe(
      "confirm-edit",
    );
  });
});
