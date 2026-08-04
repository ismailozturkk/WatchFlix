// __tests__/typographyRoles.test.js
//
// "Font her yazıya uygulanmıyor" şikayetinin kök nedenleri buradan geçer:
// (a) rol tespitinin yanlış karar vermesi, (b) preset ↔ aile tablosu ile
// yüklenen font manifestinin sessizce ayrışması. İkisi de test edilebilir.
import fs from "fs";
import path from "path";
import {
  DEFAULT_FONT_ROLES,
  FONT_FAMILY_MAP,
  FONT_PRESETS,
  FONT_PRESET_BY_ID,
  REQUIRED_FONT_FAMILIES,
  TEXT_ROLES,
  hasItalicVariant,
  isNumericContent,
  isPresetRecommendedFor,
  isValidPresetId,
  needsSystemFamilyReset,
  normalizeFontRoles,
  normalizeWeight,
  resolveFontFamily,
  resolveTextRole,
} from "../utils/typographyRoles";

const oku = (goreliYol) =>
  fs.readFileSync(path.join(__dirname, "..", goreliYol), "utf8");

describe("katalog bütünlüğü", () => {
  it("system dışındaki her preset'in aile tablosunda karşılığı var", () => {
    const eksik = FONT_PRESETS.filter(
      (preset) => preset.id !== "system" && !FONT_FAMILY_MAP[preset.id],
    ).map((preset) => preset.id);
    expect(eksik).toEqual([]);
  });

  it("aile tablosundaki her anahtar katalogda tanımlı", () => {
    const fazla = Object.keys(FONT_FAMILY_MAP).filter(
      (id) => !FONT_PRESET_BY_ID[id],
    );
    expect(fazla).toEqual([]);
  });

  it("her preset'in iki dilde adı ve açıklaması var", () => {
    for (const preset of FONT_PRESETS) {
      expect(preset.names.tr && preset.names.en).toBeTruthy();
      expect(preset.descriptions.tr && preset.descriptions.en).toBeTruthy();
      expect(preset.bestFor.length).toBeGreaterThan(0);
      expect(preset.bestFor.every((rol) => TEXT_ROLES.includes(rol))).toBe(true);
    }
  });

  it("her rol için en az 20 uygun preset var ve listeler birbirinden farklı", () => {
    const rolListeleri = [];
    for (const rol of TEXT_ROLES) {
      const oneriler = FONT_PRESETS.filter((p) => isPresetRecommendedFor(p.id, rol));
      expect(oneriler.length).toBeGreaterThanOrEqual(20);
      rolListeleri.push(oneriler.map((p) => p.id));
    }
    expect(rolListeleri[0]).not.toEqual(rolListeleri[1]);
    expect(rolListeleri[1]).not.toEqual(rolListeleri[2]);
  });

  it("kullanıcının ortak ve role özel marjinal font sözleşmesini korur", () => {
    const ortak = [
      "matemasie", "novaFlat", "newRocker", "blaka", "novaSquare",
      "bitcountSingle", "kablammo", "denkOne", "rubikGemstones", "smokum",
      "tourney", "butcherman", "chakraPetch",
    ];
    for (const id of ortak) {
      expect(TEXT_ROLES.every((rol) => isPresetRecommendedFor(id, rol))).toBe(true);
    }

    const baslik = [
      "pressStart2P", "fascinateInline", "rubikDoodleShadow", "brunoAceSC",
      "climateCrisis", "ribeyeMarrow", "rubikWetPaint", "sancreek", "bungeeShade",
    ];
    const yazi = [
      "gluten", "gloriaHallelujah", "carattere", "offside", "indieFlower",
      "sairaStencilOne", "courgette", "julee",
    ];
    const rakam = [
      "bitcountSingle", "monoton", "brunoAceSC", "carattere",
      "sairaStencilOne", "rubikWetPaint", "sancreek", "bungeeShade",
    ];
    expect(baslik.every((id) => isPresetRecommendedFor(id, "heading"))).toBe(true);
    expect(yazi.every((id) => isPresetRecommendedFor(id, "body"))).toBe(true);
    expect(rakam.every((id) => isPresetRecommendedFor(id, "numeric"))).toBe(true);
    expect(FONT_PRESETS.filter((preset) => preset.id === "newRocker")).toHaveLength(1);
  });
});

describe("font manifesti", () => {
  // Tablonun ürettiği bir aile yüklenmezse hata OLUŞMAZ; metin sessizce sistem
  // fontuna düşer. Bu testin varlık sebebi tam olarak o sessiz düşüş.
  const manifest = oku("context/TypographyContext.js");
  const yuklenenler = new Set(
    Array.from(manifest.matchAll(/^\s{2}([A-Za-z0-9_]+):\s*require\(/gm)).map(
      (m) => m[1],
    ),
  );

  it("manifest gerçekten okunabildi", () => {
    expect(yuklenenler.size).toBeGreaterThan(30);
  });

  it("tablonun ürettiği her aile manifestte yükleniyor", () => {
    const eksik = REQUIRED_FONT_FAMILIES.filter((ad) => !yuklenenler.has(ad));
    expect(eksik).toEqual([]);
  });

  it("manifestte tabloda hiç kullanılmayan aile yok", () => {
    const kullanilan = new Set(REQUIRED_FONT_FAMILIES);
    const fazla = [...yuklenenler].filter((ad) => !kullanilan.has(ad));
    expect(fazla).toEqual([]);
  });
});

describe("saflık", () => {
  it("utils/typographyRoles.js hiçbir şey import etmez", () => {
    const kaynak = oku("utils/typographyRoles.js");
    expect(kaynak).not.toMatch(/^\s*import\s/m);
    expect(kaynak).not.toMatch(/require\(/);
  });
});

describe("ağırlık normalleştirme", () => {
  it("eksik/metin/ara değerleri kovalara indirir", () => {
    expect(normalizeWeight(undefined)).toBe(400);
    expect(normalizeWeight(null)).toBe(400);
    expect(normalizeWeight("normal")).toBe(400);
    expect(normalizeWeight("bold")).toBe(700);
    expect(normalizeWeight("500")).toBe(500);
    expect(normalizeWeight(650)).toBe(700);
    expect(normalizeWeight("850")).toBe(800);
    expect(normalizeWeight(900)).toBe(800);
  });
});

describe("rakam tespiti", () => {
  it("süslemeli sayıları rakam sayar", () => {
    for (const deger of ["2026", "8.7", "1.284", "%75", "75%", "★ 8.7", "≈1.234", "12:30", "(3)", "+12", "-4", 42]) {
      expect(isNumericContent(deger)).toBe(true);
    }
  });

  it("harf içeren karışık metni rakam saymaz", () => {
    for (const deger of ["24 film", "3 sa 25 dk", "Sezon 2", "1.284 Saat", "S01B04", ""]) {
      expect(isNumericContent(deger)).toBe(false);
    }
  });

  it("parçalı çocuklarda tüm parçaları birleştirip bakar", () => {
    expect(isNumericContent(["8", ".", "7"])).toBe(true);
    expect(isNumericContent([5, " film"])).toBe(false);
  });
});

describe("rol tespiti", () => {
  it("açık rol her kuralı ezer", () => {
    expect(
      resolveTextRole({ explicitRole: "body", fontSize: 30, content: "Başlık" }),
    ).toBe("body");
    expect(
      resolveTextRole({ explicitRole: "numeric", content: "₺149,99" }),
    ).toBe("numeric");
    // Geçersiz bir rol yok sayılır, otomatik karara düşülür.
    expect(resolveTextRole({ explicitRole: "title", fontSize: 26 })).toBe("heading");
  });

  it("girdi her zaman gövdedir ve içeriğe göre değişmez", () => {
    expect(resolveTextRole({ isInput: true, fontSize: 23, fontWeight: "800" })).toBe("body");
    // Kullanıcı "2024" yazınca font rakam ailesine ATLAMAMALI.
    expect(resolveTextRole({ isInput: true, content: "2024", fontSize: 20 })).toBe("body");
  });

  it("saf rakam içeriği punto ne olursa olsun rakamdır", () => {
    expect(resolveTextRole({ fontSize: 82, fontWeight: "900", content: "1284" })).toBe("numeric");
    expect(resolveTextRole({ fontSize: 20, fontWeight: "800", content: "8.7" })).toBe("numeric");
    expect(resolveTextRole({ fontSize: 10, fontWeight: "800", content: "%75" })).toBe("numeric");
    expect(resolveTextRole({ fontSize: 22, fontWeight: "bold", content: 128 })).toBe("numeric");
  });

  it("büyük harfe çevrilmiş küçük puntolu bölüm başlıklarını yakalar", () => {
    // ProfileScreen sectionTitle: 14px, ağırlıksız, uppercase.
    expect(resolveTextRole({ fontSize: 14, textTransform: "uppercase", content: "ÇIKIŞ" })).toBe("heading");
    // CalendarWidget sectionTitle: 13px, ağırlıksız, uppercase.
    expect(resolveTextRole({ fontSize: 13, textTransform: "uppercase", content: "TAKVİM" })).toBe("heading");
    // GameHubScreen sectionTitle: 12px/900 uppercase.
    expect(resolveTextRole({ fontSize: 12, fontWeight: "900", textTransform: "uppercase", content: "OYUNLAR" })).toBe("heading");
  });

  it("punto ve ağırlık eşikleri", () => {
    expect(resolveTextRole({ fontSize: 26, fontWeight: "800", content: "Filmler" })).toBe("heading");
    expect(resolveTextRole({ fontSize: 20, content: "Filmler" })).toBe("heading");
    expect(resolveTextRole({ fontSize: 17, fontWeight: "700", content: "Bölüm" })).toBe("heading");
    expect(resolveTextRole({ fontSize: 15, fontWeight: "800", content: "Kart" })).toBe("heading");
    expect(resolveTextRole({ fontSize: 17, fontWeight: "500", content: "Metin" })).toBe("body");
    expect(resolveTextRole({ fontSize: 15, fontWeight: "600", content: "Metin" })).toBe("body");
  });

  it("eski 13/500 kuralı artık başlık üretmiyor", () => {
    // settingsUi rowTitle 14/500, ChatModal heading3 14/600, username 14/700:
    // bunların hepsi gövde metnidir.
    expect(resolveTextRole({ fontSize: 14, fontWeight: "500", content: "Bildirimler" })).toBe("body");
    expect(resolveTextRole({ fontSize: 14, fontWeight: "600", content: "Alt başlık" })).toBe("body");
    expect(resolveTextRole({ fontSize: 13.5, fontWeight: "600", content: "Seçenek" })).toBe("body");
  });

  it("kullanıcı metni ve dış veri gövde kalır", () => {
    // Sohbet balonu 15/ağırlıksız, film adı 14/ağırlıksız, biyografi 12.
    expect(resolveTextRole({ fontSize: 15, content: "bugün ne izlesek" })).toBe("body");
    expect(resolveTextRole({ fontSize: 14, content: "The Shawshank Redemption" })).toBe("body");
    expect(resolveTextRole({ fontSize: 12, content: "film sever" })).toBe("body");
  });

  it("tek harf ve saf emoji gövde kalır", () => {
    // Avatar baş harfi 18/800: geniş bir display fontu daireden taşar.
    expect(resolveTextRole({ fontSize: 18, fontWeight: "800", content: "İ" })).toBe("body");
    // Wrapped emoji 108px.
    expect(resolveTextRole({ fontSize: 108, content: "🎬" })).toBe("body");
    expect(resolveTextRole({ fontSize: 24, content: "·" })).toBe("body");
  });

  it("stilde punto yoksa RN varsayılanı (14) ile karar verir", () => {
    expect(resolveTextRole({ fontWeight: "900", content: "Etiket" })).toBe("body");
    expect(resolveTextRole({ fontWeight: "900", textTransform: "uppercase", content: "ETİKET" })).toBe("heading");
  });

  it("içerik okunamayan (element çocuklu) metinlerde stile bakar", () => {
    const cocuk = { $$typeof: Symbol.for("react.element"), type: "Text" };
    expect(resolveTextRole({ fontSize: 30, fontWeight: "900", content: cocuk })).toBe("heading");
    expect(resolveTextRole({ fontSize: 12, content: cocuk })).toBe("body");
  });
});

describe("aile çözümü", () => {
  it("system ve bilinmeyen preset null döner (RN kendi fontunu kullanır)", () => {
    expect(resolveFontFamily({ presetId: "system", fontWeight: "700" })).toBeNull();
    expect(resolveFontFamily({ presetId: "yok-boyle-bir-font", fontWeight: "400" })).toBeNull();
  });

  it("ağırlığa göre doğru dosya adını verir", () => {
    expect(resolveFontFamily({ presetId: "inter", fontWeight: "700" })).toBe("Inter_700Bold");
    expect(resolveFontFamily({ presetId: "inter", fontWeight: undefined })).toBe("Inter_400Regular");
    expect(resolveFontFamily({ presetId: "oswald", fontWeight: "900" })).toBe("Oswald_700Bold");
  });

  it("italik varyantı olmayan ailede normal varyanta düşer", () => {
    expect(hasItalicVariant("inter")).toBe(true);
    expect(hasItalicVariant("oswald")).toBe(false);
    expect(resolveFontFamily({ presetId: "inter", fontWeight: "400", italic: true })).toBe("Inter_400Regular_Italic");
    expect(resolveFontFamily({ presetId: "oswald", fontWeight: "400", italic: true })).toBe("Oswald_400Regular");
  });

  it("tek ağırlıklı aileler her ağırlıkta aynı dosyayı verir", () => {
    for (const agirlik of ["400", "500", "600", "700", "900"]) {
      expect(resolveFontFamily({ presetId: "michroma", fontWeight: agirlik })).toBe("Michroma_400Regular");
    }
  });

  it("üç rol birbirinden bağımsız üç farklı aile üretebilir", () => {
    const roller = { heading: "bebasNeue", body: "inter", numeric: "spaceMono" };
    const aileler = TEXT_ROLES.map((rol) =>
      resolveFontFamily({ presetId: roller[rol], fontWeight: "700" }),
    );
    expect(new Set(aileler).size).toBe(3);
  });
});

describe("iç içe metinde sistem fontuna dönüş", () => {
  // React Native'de iç <Text> dış <Text>'in fontFamily'sini native olarak miras
  // alır. Bu yüzden rolü "Sistem"e düşen iç parçaya aile YAZMAMAK, onu dış
  // metnin özel ailesinde bırakır — üç rolün bağımsızlığı tam da burada kırılır.
  it("dış metin özel aile uygularken sistem rolü açıkça sıfırlanmalı", () => {
    expect(needsSystemFamilyReset(null, "Monoton_400Regular")).toBe(true);
  });

  it("dış metin de sistem fontundaysa sıfırlamaya gerek yok", () => {
    expect(needsSystemFamilyReset(null, null)).toBe(false);
    expect(needsSystemFamilyReset(null, undefined)).toBe(false);
  });

  it("iç metnin kendi ailesi varsa sıfırlama yapılmaz", () => {
    expect(needsSystemFamilyReset("Inter_400Regular", "Monoton_400Regular")).toBe(false);
    expect(needsSystemFamilyReset("Inter_400Regular", null)).toBe(false);
  });

  it("gerçek senaryo: başlık Monoton, rakam Sistem -> sayaç sıfırlanır", () => {
    // WatchBadgeDetailModal deseni: uppercase bir başlığın içinde "3/5" sayacı.
    const disRol = resolveTextRole({ fontSize: 11, textTransform: "uppercase", content: "AİLE" });
    const icRol = resolveTextRole({ fontSize: 11, textTransform: "uppercase", content: "3/5" });
    expect(disRol).toBe("heading");
    expect(icRol).toBe("numeric");

    const disAile = resolveFontFamily({ presetId: "monoton", fontWeight: "700" });
    const icAile = resolveFontFamily({ presetId: "system", fontWeight: "700" });
    expect(disAile).toBe("Monoton_400Regular");
    expect(icAile).toBeNull();
    expect(needsSystemFamilyReset(icAile, disAile)).toBe(true);
  });
});

describe("rol haritası normalleştirme", () => {
  it("eksik/bozuk değerleri varsayılana çeker", () => {
    expect(normalizeFontRoles(null)).toEqual(DEFAULT_FONT_ROLES);
    expect(normalizeFontRoles({ heading: "yok" })).toEqual(DEFAULT_FONT_ROLES);
    expect(normalizeFontRoles({ heading: "bebasNeue" })).toEqual({
      heading: "bebasNeue",
      body: "system",
      numeric: "system",
    });
  });

  it("geçerli üçlüyü aynen korur", () => {
    const roller = { heading: "oswald", body: "inter", numeric: "audiowide" };
    expect(normalizeFontRoles(roller)).toEqual(roller);
  });

  it("role uygun olmayan kayıtları sistem fontuna çeker", () => {
    expect(
      normalizeFontRoles({ heading: "monoton", body: "monoton", numeric: "monoton" }),
    ).toEqual({ heading: "monoton", body: "system", numeric: "monoton" });
  });

  it("fazladan alanları taşımaz", () => {
    const sonuc = normalizeFontRoles({ heading: "inter", fontsLoaded: true, x: 1 });
    expect(Object.keys(sonuc).sort()).toEqual([...TEXT_ROLES].sort());
  });

  it("isValidPresetId prototip anahtarlarına kanmaz", () => {
    expect(isValidPresetId("toString")).toBe(false);
    expect(isValidPresetId("constructor")).toBe(false);
    expect(isValidPresetId("inter")).toBe(true);
  });
});
