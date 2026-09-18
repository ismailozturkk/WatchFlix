import { surfaceBlurAppearance } from "../utils/surfaceBlur";

describe("surface blur theme selection", () => {
  test.each(["#FFFFFF", "#DDF2FC", "#D8E7E1", "#AAAAAA"])(
    "%s uses light glass", (color) => {
      expect(surfaceBlurAppearance(color).tint).toBe("light");
    },
  );
  test.each(["#15171C", "#2A2D33", "#20304F", "#211C2E"])(
    "%s uses dark glass", (color) => {
      expect(surfaceBlurAppearance(color).tint).toBe("dark");
    },
  );
  test("rgba custom surfaces select the same tint as their opaque color", () => {
    expect(surfaceBlurAppearance("rgba(221, 242, 252, 0.95)"))
      .toEqual(surfaceBlurAppearance("#DDF2FC"));
  });
});
