import {
  buildCineSystemInstruction,
  buildPosterMap,
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
});
