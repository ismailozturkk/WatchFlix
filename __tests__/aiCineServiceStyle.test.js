import {
  buildCineSystemInstruction,
  extractJSONDetailed,
  repairTruncatedJSON,
  resolveStyleRules,
} from "../services/aiCineService";

describe("resolveStyleRules", () => {
  test("varsayılan (dengeli, spoilersız, 5) eski talimatın cümlesini üretir", () => {
    const rules = resolveStyleRules({});
    expect(rules.combinedRule).toBe("Keep every text field to one short spoiler-free sentence.");
    expect(rules.sizeRules).toContain("recommendations: 3–5 items");
    expect(rules.maxItems).toBe(5);
  });

  test("kısa üslup kelime sınırı koyar, ayrıntılı üslup liste tavanını daraltır", () => {
    expect(resolveStyleRules({ responseStyle: "concise" }).combinedRule).toContain("at most 8 words");
    const detailed = resolveStyleRules({ responseStyle: "detailed", maxItems: 8 });
    expect(detailed.combinedRule).toContain("one or two vivid sentences");
    expect(detailed.sizeRules).toContain("at most 9 items in total");
    expect(detailed.sizeRules).toContain("at most 120 words");
  });

  test("hafif spoiler girişe izin verir ama sürprizi asla açmaz", () => {
    const rules = resolveStyleRules({ spoilerLevel: "light" });
    expect(rules.combinedRule).toContain("Light setup is fine");
    expect(rules.combinedRule).toContain("never reveal twists");
  });

  test("geçersiz değerler güvenli varsayılana düşer", () => {
    const rules = resolveStyleRules({ responseStyle: "poetic", spoilerLevel: "x", maxItems: 99 });
    expect(rules.style).toBe("balanced");
    expect(rules.spoilers).toBe("none");
    expect(rules.maxItems).toBe(5);
  });

  test("az öneri isteyince alt sınır üst sınırı aşmaz", () => {
    expect(resolveStyleRules({ maxItems: 3 }).sizeRules).toContain("recommendations: 3–3 items");
    expect(resolveStyleRules({ maxItems: 1 }).sizeRules).toContain("recommendations: 1–1 items");
  });
});

describe("sistem talimatındaki yeni bloklar", () => {
  const target = { id: 949, title: "Heat", mediaType: "movie", year: "1995" };

  test("bağlam ve tekrar engeli verilince talimata girer, verilmezse girmez", () => {
    const plain = buildCineSystemInstruction({ language: "tr" });
    expect(plain).not.toContain("CURRENT MOMENT");
    expect(plain).not.toContain("ALREADY SUGGESTED");

    const rich = buildCineSystemInstruction({
      language: "tr",
      contextBlock: "CURRENT MOMENT (soft context, never announce it): Saturday evening.",
      avoidBlock: "ALREADY SUGGESTED IN THIS CONVERSATION (do NOT suggest these again): Arrival.",
    });
    expect(rich).toContain("CURRENT MOMENT");
    expect(rich).toContain("ALREADY SUGGESTED IN THIS CONVERSATION");
  });

  test("odak yapım yalnız zamirleri çözer; hedef yapım varken yok sayılır", () => {
    const focusOnly = buildCineSystemInstruction({ focusMedia: target });
    expect(focusOnly).toContain("CONVERSATION FOCUS");
    expect(focusOnly).toContain("Heat (1995)");
    expect(focusOnly).not.toContain("AUTHORITATIVE TARGET MEDIA");

    const both = buildCineSystemInstruction({ targetMedia: target, focusMedia: { ...target, title: "Other" } });
    expect(both).toContain("AUTHORITATIVE TARGET MEDIA");
    expect(both).not.toContain("CONVERSATION FOCUS");
  });

  test("benzer önerilerde olay ve anahtar kelimeler türden önce gelir, zayıf eşleşme zorlanmaz", () => {
    const source = {
      ...target,
      overview: "A crew of thieves plans an elaborate bank robbery.",
      tagline: "A perfect crime has a price.",
      keywords: ["heist", "bank robbery"],
      genres: ["Crime", "Drama"],
    };
    const prompt = buildCineSystemInstruction({ focusMedia: source, similarityRequest: true });
    expect(prompt).toContain(source.overview);
    expect(prompt).toContain("heist, bank robbery");
    expect(prompt).toContain("Broad genres (secondary evidence): Crime, Drama");
    expect(prompt).toContain("Shared broad genre labels alone are insufficient");
    expect(prompt).toContain("Each reason must state a specific narrative link");
    expect(prompt).toContain("recommendations: 1–5 items");
    expect(prompt).not.toContain("AUTHORITATIVE TARGET MEDIA");

    const followUp = buildCineSystemInstruction({ focusMedia: source });
    expect(followUp).not.toContain("SIMILARITY REQUEST");
    expect(followUp).not.toContain("Plot premise");
    expect(followUp).toContain("recommendations: 3–5 items");
  });

  test("stil ve sayı tercihleri talimata yansır", () => {
    const prompt = buildCineSystemInstruction({ responseStyle: "concise", spoilerLevel: "light", maxItems: 8 });
    expect(prompt).toContain("at most 8 words");
    expect(prompt).toContain("Light setup is fine");
    expect(prompt).toContain("recommendations: 3–8 items");
  });
});

describe("kesik JSON onarımı", () => {
  const item = (title) => `{"title":"${title}","mediaType":"movie","reason":"neden"}`;

  test("yarım kalan son öğe düşer, öncekiler korunur", () => {
    const text = `{"type":"recommendations","items":[${item("A")},${item("B")},{"title":"C","mediaTy`;
    const repaired = repairTruncatedJSON(text);
    expect(repaired.type).toBe("recommendations");
    expect(repaired.items.map((i) => i.title)).toEqual(["A", "B"]);
  });

  test("tam JSON ya da süslü parantezsiz metin için kurtarma yapılmaz", () => {
    expect(repairTruncatedJSON(`{"type":"general","content":"x"}`)).toBeNull();
    expect(repairTruncatedJSON("merhaba")).toBeNull();
    expect(repairTruncatedJSON(null)).toBeNull();
  });

  test("tırnak içindeki parantezler ve kaçışlar sayımı bozmaz", () => {
    const text = `{"type":"recommendations","items":[{"title":"A } ] \\" B","mediaType":"movie","reason":"x"},{"title":"C"`;
    const repaired = repairTruncatedJSON(text);
    expect(repaired.items).toHaveLength(1);
    expect(repaired.items[0].title).toBe('A } ] " B');
  });

  test("extractJSONDetailed kesik cevabı 'onarıldı' işaretiyle döndürür", () => {
    const whole = extractJSONDetailed("```json\n" + `{"type":"general","content":"x"}` + "\n```");
    expect(whole.value).toEqual({ type: "general", content: "x" });
    expect(whole.repaired).toBe(false);

    const cut = extractJSONDetailed(`{"type":"recommendations","items":[${item("A")},{"title":"B"`);
    expect(cut.repaired).toBe(true);
    expect(cut.value.items).toHaveLength(1);

    expect(extractJSONDetailed("json yok")).toEqual({ value: null, repaired: false });
  });
});
