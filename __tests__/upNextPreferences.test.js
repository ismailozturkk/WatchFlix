import { normalizeUpNextPreferences } from "../services/upNextPreferences";

test("gizlenen dizi kimliklerini metne çevirip tekilleştirir", () => {
  expect(
    normalizeUpNextPreferences({ hiddenShowIds: [12, "12", 34, null] })
  ).toEqual({ hiddenShowIds: ["12", "34"], updatedAt: null });
});

test("bozuk tercihte güvenli varsayılana döner", () => {
  expect(normalizeUpNextPreferences(null)).toEqual({
    hiddenShowIds: [],
    updatedAt: null,
  });
});
