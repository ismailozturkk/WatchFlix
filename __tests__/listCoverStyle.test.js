import {
  buildListCoverStyle,
  readListCoverStyle,
  sameListCoverStyle,
} from "../utils/listCoverStyle";

describe("listCoverStyle", () => {
  it("builds payload from local prefs; direction only for directional styles", () => {
    expect(
      buildListCoverStyle({ gridStyle: 8, allCornersRounded: true, listLayoutDirections: { 8: "left" } }),
    ).toEqual({ gridStyle: 8, rounded: true, direction: "left" });
    expect(
      buildListCoverStyle({ gridStyle: 3, allCornersRounded: false, listLayoutDirections: { 3: "left" } }),
    ).toEqual({ gridStyle: 3, rounded: false, direction: "right" });
    expect(buildListCoverStyle({ gridStyle: 99 })).toBeNull();
  });

  it("reads and validates the profile field", () => {
    expect(readListCoverStyle(null)).toBeNull();
    expect(readListCoverStyle({})).toBeNull();
    expect(readListCoverStyle({ listCoverStyle: { gridStyle: 0 } })).toBeNull();
    expect(readListCoverStyle({ listCoverStyle: { gridStyle: 11, rounded: "yes", direction: "up" } })).toEqual({
      gridStyle: 11,
      rounded: false,
      direction: "right",
    });
  });

  it("compares styles", () => {
    const a = { gridStyle: 2, rounded: true, direction: "right" };
    expect(sameListCoverStyle(a, { ...a })).toBe(true);
    expect(sameListCoverStyle(a, { ...a, rounded: false })).toBe(false);
    expect(sameListCoverStyle(a, null)).toBe(false);
  });
});
