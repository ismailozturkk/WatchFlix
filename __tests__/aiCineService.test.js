import {
  buildCineSystemInstruction,
  buildPosterMap,
  enforceTargetMediaResponse,
  responseToHistoryText,
} from "../services/aiCineService";

describe("compact CineMatch responses", () => {
  test("prompt asks only for AI-owned fields", () => {
    const prompt = buildCineSystemInstruction({ language: "tr" });

    expect(prompt).toContain('"reason":"why it fits"');
    expect(prompt).toContain('"take":"why it is worth considering"');
    expect(prompt).toContain("Never invent TMDB IDs");
    expect(prompt).not.toContain('"rating":');
    expect(prompt).not.toContain('"whereToWatch":');
    expect(prompt).not.toContain('"tips":');
  });

  test("discovery filters are included without overriding named-title requests", () => {
    const prompt = buildCineSystemInstruction({
      language: "tr",
      discoveryPreferences: [
        "AI DISCOVERY FILTERS (chosen explicitly by the user):",
        "- Content type: movies only.",
        "- Preferred genres: Komedi.",
        "- Streaming services: recommend titles available on Netflix only.",
      ].join("\n"),
    });

    expect(prompt).toContain("Content type: movies only");
    expect(prompt).toContain("Preferred genres: Komedi");
    expect(prompt).toContain("available on Netflix only");
    expect(prompt).toContain("Direct questions about named titles");
  });

  test("structured responses keep a compact multi-turn history", () => {
    expect(
      responseToHistoryText({
        type: "recommendations",
        items: [
          { title: "Arrival", mediaType: "movie" },
          { title: "Dark", mediaType: "tv" },
        ],
      })
    ).toBe("recommendations: Arrival, Dark");

    expect(
      responseToHistoryText({
        type: "comparison",
        left: { title: "Dune" },
        right: { title: "Interstellar" },
        verdict: "Choose by mood.",
      })
    ).toBe("comparison: Dune vs Interstellar — Choose by mood.");
  });

  test("TMDB poster map includes similar titles hydrated from details", () => {
    const map = buildPosterMap([
      {
        mediaType: "movie",
        query: "Arrival",
        found: true,
        similar: [
          { mediaType: "movie", query: "Contact", found: true, id: 686 },
        ],
      },
    ]);

    expect(map["movie|arrival"]?.found).toBe(true);
    expect(map["movie|contact"]?.id).toBe(686);
  });

  test("detail entry points stay locked to their authoritative TMDB record", () => {
    const target = { id: 123, mediaType: "tv", title: "The Dark Knight", year: "2000" };
    const result = enforceTargetMediaResponse(
      {
        type: "title_spotlight",
        title: "The Dark Knight",
        mediaType: "movie",
        take: "Batman filmi hakkında yanlış cevap.",
      },
      target,
    );

    expect(result).toEqual({
      type: "title_spotlight",
      title: "The Dark Knight",
      mediaType: "tv",
      take: "Batman filmi hakkında yanlış cevap.",
    });
    expect(buildCineSystemInstruction({ targetMedia: target })).toContain("TMDB ID: 123");
    expect(buildCineSystemInstruction({ targetMedia: target })).toContain(
      "do not replace it with a more popular or similarly named title",
    );
  });
});
