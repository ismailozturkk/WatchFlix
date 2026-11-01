// plugins/withAlternateAppIcons.js — iOS appiconset biçiminin bekçisi.
//
// 1.5.0 build'inde alternatif simgeler cihazda seçilemedi: her küme TEK ölçülü
// ("universal", 1024x1024) yazılıyordu. Expo birincil simgeyi böyle yazar ve
// actool kabul eder, ama ALTERNATİF kümelerde aynı biçim sessizce boş geçiyor —
// actool `--alternate-app-icon` bayraklarını hatasız alıp pakete hiçbir simge
// dosyası koymuyor, `setAlternateIconName` de cihazda düşüyor. Bu test o biçime
// geri dönülmesini engeller.

const { IOS_ICON_SLOTS, iosImagesJson } = require("../plugins/withAlternateAppIcons");

describe("iOS alternatif simge kümesi", () => {
  const images = iosImagesJson("Glass");

  test("her slot için bir görsel yazılır", () => {
    expect(images).toHaveLength(IOS_ICON_SLOTS.length);
    expect(IOS_ICON_SLOTS.length).toBeGreaterThan(1);
  });

  test("iOS'un gerçekten istediği ana ölçüler var (iPhone 60@2x/@3x, iPad 76@2x/83.5@2x)", () => {
    const has = (idiom, size, scale) =>
      images.some((i) => i.idiom === idiom && i.size === `${size}x${size}` && i.scale === `${scale}x`);
    expect(has("iphone", 60, 2)).toBe(true);
    expect(has("iphone", 60, 3)).toBe(true);
    expect(has("ipad", 76, 2)).toBe(true);
    expect(has("ipad", "83.5", 2)).toBe(true);
  });

  test("tek ölçülü 1024 \"universal\" biçimine DÖNÜLMEZ (1.5.0 hatası)", () => {
    expect(images.some((i) => i.idiom === "universal")).toBe(false);
    expect(images.some((i) => i.size === "1024x1024")).toBe(false);
  });

  test("her görsel idiom + ölçü + ölçek taşır ve dosya adları tekil", () => {
    for (const image of images) {
      expect(image.idiom).toMatch(/^(iphone|ipad)$/);
      expect(image.size).toMatch(/^\d+(\.\d+)?x\d+(\.\d+)?$/);
      expect(image.scale).toMatch(/^[123]x$/);
      expect(image.filename.startsWith("Glass-")).toBe(true);
      expect(image.filename.endsWith(".png")).toBe(true);
    }
    const names = images.map((i) => i.filename);
    expect(new Set(names).size).toBe(names.length);
  });

  test("dosya adı küme adını taşır (kümeler birbirinin dosyasını ezmez)", () => {
    const gold = iosImagesJson("Gold");
    const overlap = gold.filter((g) => images.some((i) => i.filename === g.filename));
    expect(overlap).toHaveLength(0);
  });
});
