// T3 B5: çeviri anahtarla aynı olduğunda yedeğe (Türkçe) düşülmemeli.
import i18n from "../translations";
import { i18nText } from "../utils/i18nText";

afterAll(() => i18n.changeLanguage("tr"));

test("çevirisi anahtarıyla aynı olan metin çeviriden gelir", async () => {
  await i18n.changeLanguage("en");
  expect(i18nText("votes", "oy")).toBe("votes");
});

test("eksik anahtar yedeğe düşer, interpolasyon çalışır", async () => {
  await i18n.changeLanguage("en");
  expect(i18nText("yok_boyle_bir_anahtar_t3", "yedek")).toBe("yedek");
  expect(i18nText("autoI18n.yas_siniri_basligi", "x", { age: 13 })).toBe(
    "This app is for ages 13 and up",
  );
});
