import {
  AVATARS,
  CUSTOM_AVATAR_INDEX,
  SOCIAL_AVATAR_INDEX,
  clampAvatarIndex,
  getAvatarSource,
  optimizeAvatarUrl,
} from "../utils/avatars";

describe("avatars utility", () => {
  describe("clampAvatarIndex", () => {
    it("should allow CUSTOM_AVATAR_INDEX (-1) when allowCustom is true", () => {
      expect(clampAvatarIndex(-1, true)).toBe(-1);
      expect(clampAvatarIndex(CUSTOM_AVATAR_INDEX)).toBe(-1);
      expect(clampAvatarIndex(SOCIAL_AVATAR_INDEX)).toBe(-1);
    });

    it("should clamp invalid negative values other than -1 to 0", () => {
      expect(clampAvatarIndex(-2, true)).toBe(0);
      expect(clampAvatarIndex(-99, true)).toBe(0);
    });

    it("should clamp -1 to 0 when allowCustom is false", () => {
      expect(clampAvatarIndex(-1, false)).toBe(0);
    });

    it("should clamp non-numeric and null/undefined values to 0", () => {
      expect(clampAvatarIndex(null)).toBe(0);
      expect(clampAvatarIndex(undefined)).toBe(0);
      expect(clampAvatarIndex("foo")).toBe(0);
      expect(clampAvatarIndex(NaN)).toBe(0);
    });

    it("should clamp values greater than AVATARS.length - 1 to default index 0", () => {
      expect(clampAvatarIndex(999)).toBe(0);
    });

    it("should preserve valid indices", () => {
      expect(clampAvatarIndex(0)).toBe(0);
      expect(clampAvatarIndex(5)).toBe(5);
      expect(clampAvatarIndex(AVATARS.length - 1)).toBe(AVATARS.length - 1);
    });
  });

  describe("getAvatarSource", () => {
    it("should return URI object when given an HTTP URL string", () => {
      const url = "https://lh3.googleusercontent.com/a/photo.jpg";
      expect(getAvatarSource(url)).toEqual({ uri: url });
    });

    it("should return URI object directly when given an object with uri", () => {
      const obj = { uri: "https://example.com/avatar.png" };
      expect(getAvatarSource(obj)).toBe(obj);
    });

    it("should resolve social photoURL when index is -1", () => {
      const photoURL = "https://lh3.googleusercontent.com/a/google_profile.jpg";
      expect(getAvatarSource(-1, photoURL)).toEqual({ uri: photoURL });
      expect(getAvatarSource(CUSTOM_AVATAR_INDEX, photoURL)).toEqual({ uri: photoURL });
    });

    it("should fallback to AVATARS[0] when index is -1 but photoURL is missing", () => {
      expect(getAvatarSource(-1, null)).toBe(AVATARS[0]);
      expect(getAvatarSource(-1, "")).toBe(AVATARS[0]);
    });

    it("should return the bundled avatar asset for standard indices", () => {
      expect(getAvatarSource(0)).toBe(AVATARS[0]);
      expect(getAvatarSource(3)).toBe(AVATARS[3]);
    });

    it("should optimize Google avatar URLs with low-res parameters to 500px", () => {
      const lowRes = "https://lh3.googleusercontent.com/a/photo.jpg=s96-c";
      expect(getAvatarSource(-1, lowRes)).toEqual({
        uri: "https://lh3.googleusercontent.com/a/photo.jpg=s500-c",
      });
    });

    it("should safely fallback for undefined or invalid index", () => {
      expect(getAvatarSource(undefined)).toBe(AVATARS[0]);
      expect(getAvatarSource(null)).toBe(AVATARS[0]);
    });
  });

  describe("optimizeAvatarUrl", () => {
    it("should upgrade Google profile photo size parameter", () => {
      expect(optimizeAvatarUrl("https://lh3.googleusercontent.com/a/123=s96-c")).toBe(
        "https://lh3.googleusercontent.com/a/123=s500-c"
      );
      expect(optimizeAvatarUrl("https://lh3.googleusercontent.com/a/123=s64")).toBe(
        "https://lh3.googleusercontent.com/a/123=s500-c"
      );
    });

    it("should leave regular URLs unchanged", () => {
      expect(optimizeAvatarUrl("https://example.com/photo.png")).toBe(
        "https://example.com/photo.png"
      );
    });
  });
});
