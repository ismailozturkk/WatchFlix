// "Hesabı sıfırla" kapsam özeti: satırlar, sayı rozetleri ve beş dilde metin anahtarları.
import { buildResetScopeRows } from "../components/profile/ResetScopeList";
import { RESET_ACCOUNT_COPY } from "../screens/tabs/profile/resetAccountCopy";

jest.mock("react-native", () => ({ View: "View", Text: "Text", StyleSheet: { create: (s) => s } }));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));

const copy = RESET_ACCOUNT_COPY.tr.scope;

describe("buildResetScopeRows", () => {
  it("sayıları rozet olarak yazar, saat yuvarlar", () => {
    const rows = buildResetScopeRows(
      { movies: 12, shows: 3, episodes: 40, minutes: 150, listItems: 7, notes: 2, reminders: 1 },
      copy,
    );
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.count]));
    expect(byKey.movies).toBe("12 film");
    expect(byKey.shows).toBe("3 dizi · 40 bölüm");
    expect(byKey.time).toBe("3 saat");
    expect(byKey.lists).toBe("7 öğe");
    expect(byKey.notes).toBe("2 not · 1 hatırlatıcı");
    expect(byKey.activity).toBeNull();
  });

  it("veri yoksa kalemler yine listelenir, rozet çıkmaz", () => {
    const rows = buildResetScopeRows({}, copy);
    expect(rows).toHaveLength(9);
    expect(rows.every((r) => r.count === null && r.label)).toBe(true);
  });

  it("beş dilde aynı kapsam anahtarları", () => {
    const keys = Object.keys(copy).sort();
    for (const table of Object.values(RESET_ACCOUNT_COPY)) {
      expect(Object.keys(table.scope).sort()).toEqual(keys);
    }
  });
});
