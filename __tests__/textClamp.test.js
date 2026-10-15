const { mayOverflow } = require("../utils/textClamp");

describe("mayOverflow", () => {
  test("kısa metin kesin sığar → ölçmeye gerek yok", () => {
    expect(mayOverflow("Harika film", 3)).toBe(false);
    expect(mayOverflow("a".repeat(36), 3)).toBe(false);
  });

  test("uzun metin sığmayabilir → ölç", () => {
    expect(mayOverflow("a".repeat(37), 3)).toBe(true);
    expect(mayOverflow("kelime ".repeat(200), 4)).toBe(true);
  });

  test("kısa ama çok satırlı metin satır sınırını aşar", () => {
    // 3 satır tam sığar; 4. satır (3 sert satır sonu) taşar.
    expect(mayOverflow("a\nb\nc\nd", 3)).toBe(true);
    expect(mayOverflow("a\nb\nc", 3)).toBe(false);
  });

  test("boş / geçersiz girdi asla ölçer kurdurmaz", () => {
    expect(mayOverflow("", 3)).toBe(false);
    expect(mayOverflow(null, 3)).toBe(false);
    expect(mayOverflow(undefined, 3)).toBe(false);
    expect(mayOverflow("a".repeat(500), 0)).toBe(false);
    expect(mayOverflow("a".repeat(500), NaN)).toBe(false);
  });
});
