// Yüzde ve büyük harf yardımcıları uygulama diline göre yazar; cihaz diline değil.
// iPhone ekranlarında İngilizce arayüzde "%70" ve "FİLM CHAİN" görülmüştü (5 Kas).
import { percentText, upperText } from "../utils/i18nText";

describe("percentText", () => {
  test("Türkçe işaret önde, diğer diller arkada", () => {
    expect(percentText(70, "tr")).toBe("%70");
    expect(percentText(70, "en")).toBe("70%");
    expect(percentText(70, "es")).toBe("70%");
    expect(percentText(70, "pt-BR")).toBe("70%");
    expect(percentText(70, "de")).toBe("70 %");
  });
});

describe("upperText", () => {
  test("İngilizce'de noktalı İ çıkmaz", () => {
    expect(upperText("Film Chain", "en")).toBe("FILM CHAIN");
  });
  test("Türkçe'de i → İ", () => {
    expect(upperText("Film Zinciri", "tr")).toBe("FİLM ZİNCİRİ");
  });
  test("boş değer güvenli", () => {
    expect(upperText(undefined, "en")).toBe("");
  });
});
