import { PET_FALLBACK_URL, petUrl, petUrls } from "../utils/r2";

describe("pet asset sources", () => {
  test("uses direct R2 first and HTTPS image CDN as fallback", () => {
    expect(petUrls("astro")).toEqual([
      petUrl("astro"),
      `${PET_FALLBACK_URL}?url=${encodeURIComponent(petUrl("astro"))}&output=webp`,
    ]);
  });

  test("encodes fallback query values", () => {
    expect(petUrls("pet test")[1]).toBe(
      `${PET_FALLBACK_URL}?url=${encodeURIComponent(
        petUrl("pet test"),
      )}&output=webp`,
    );
  });
});
