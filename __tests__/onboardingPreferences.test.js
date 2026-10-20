import {
  normalizeOnboardingGenreKeys,
  normalizeOnboardingGenrePreferences,
  resolveOnboardingGenreIds,
} from "../utils/onboardingPreferences";

describe("onboarding discovery preferences", () => {
  test("keeps at most three valid unique genre choices", () => {
    expect(normalizeOnboardingGenreKeys(["action", "action", "scifi", "drama", "crime"]))
      .toEqual(["action", "scifi", "drama"]);
  });

  test("maps cross-media genres to the correct TMDB ids", () => {
    expect(resolveOnboardingGenreIds(["action", "scifi"], "movie")).toEqual([28, 878]);
    expect(resolveOnboardingGenreIds(["action", "scifi"], "tv")).toEqual([10759, 10765]);
  });

  test("keeps movie and TV selections separate while migrating legacy arrays", () => {
    expect(normalizeOnboardingGenrePreferences(["action", "scifi"])).toEqual({
      movie: ["action", "scifi"],
      tv: ["action", "scifi"],
    });
    expect(
      normalizeOnboardingGenrePreferences({
        movie: ["horror", "romance"],
        tv: ["reality", "kids"],
      }),
    ).toEqual({ movie: ["horror", "romance"], tv: ["reality", "kids"] });
    expect(resolveOnboardingGenreIds({ movie: ["horror"], tv: ["reality"] }, "movie"))
      .toEqual([27]);
    expect(resolveOnboardingGenreIds({ movie: ["horror"], tv: ["reality"] }, "tv"))
      .toEqual([10764]);
  });
});
