// İzin sayfası metinleri: sekiz dil aynı şekilde, satır sayıları ikon tablosuyla uyumlu.
const { PERMISSION_SHEET_COPY, getPermissionSheetCopy } = require("../components/permissions/permissionSheetCopy");

const shape = (value) => {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, shape(value[k])]));
  }
  return typeof value;
};

const strings = (value) =>
  typeof value === "string" ? [value] : Object.values(value).flatMap(strings);

describe("permissionSheetCopy", () => {
  test.each(["en", "es", "pt", "de", "it", "fr", "ja"])("%s, Türkçeyle aynı şekilde", (lang) => {
    expect(shape(PERMISSION_SHEET_COPY[lang])).toEqual(shape(PERMISSION_SHEET_COPY.tr));
  });

  test.each(["tr", "en", "es", "pt", "de", "it", "fr", "ja"])("%s: boş metin yok, 3 kazanım + 2 kayıp satırı", (lang) => {
    const copy = PERMISSION_SHEET_COPY[lang];
    expect(strings(copy).every((s) => s.trim().length > 0)).toBe(true);
    for (const kind of ["notifications", "mediaLibrary"]) {
      expect(copy[kind].gain).toHaveLength(3);
      expect(copy[kind].lose).toHaveLength(2);
    }
  });

  test("bilinmeyen dil İngilizceye düşer", () => {
    expect(getPermissionSheetCopy("ko")).toBe(PERMISSION_SHEET_COPY.en);
    expect(getPermissionSheetCopy("ja")).toBe(PERMISSION_SHEET_COPY.ja);
  });
});
