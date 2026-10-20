import { AI_COPY, fillCopy, getAiCopy } from "../utils/aiCopy";

// İki dilin şekli birebir aynı olmalı: eksik bir anahtar ekranda "undefined"
// ya da çökme olarak görünür (kopya tr/en yerel çift, i18n JSON'ları dışında).
function shapeOf(value, path = "") {
  if (Array.isArray(value)) {
    return [`${path}[${value.length}]`, ...value.flatMap((item, i) => (typeof item === "object" ? shapeOf(item, `${path}[${i}]`) : []))];
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .flatMap((key) => shapeOf(value[key], path ? `${path}.${key}` : key));
  }
  return [path];
}

const leaves = (value, path = "") => {
  if (Array.isArray(value)) return value.flatMap((item, i) => leaves(item, `${path}[${i}]`));
  if (value && typeof value === "object") {
    return Object.keys(value).flatMap((key) => leaves(value[key], path ? `${path}.${key}` : key));
  }
  return [[path, value]];
};

const placeholders = (text) => (String(text).match(/\{(\w+)\}/g) || []).sort();

describe("aiCopy tr/en/es paritesi", () => {
  test("üç dilin anahtar şekli aynı", () => {
    expect(shapeOf(AI_COPY.tr)).toEqual(shapeOf(AI_COPY.en));
    expect(shapeOf(AI_COPY.es)).toEqual(shapeOf(AI_COPY.tr));
  });

  test("hiçbir metin boş değil ve hepsi metin", () => {
    ["tr", "en", "es", "pt"].forEach((lang) => {
      leaves(AI_COPY[lang]).forEach(([path, value]) => {
        expect(typeof value).toBe("string");
        expect(`${lang}:${path}:${value.trim().length > 0}`).toBe(`${lang}:${path}:true`);
      });
    });
  });

  test("her anahtarda yer tutucular iki dilde aynı", () => {
    const en = Object.fromEntries(leaves(AI_COPY.en));
    const es = Object.fromEntries(leaves(AI_COPY.es));
    leaves(AI_COPY.tr).forEach(([path, value]) => {
      expect(`${path}:${placeholders(value).join(",")}`).toBe(`${path}:${placeholders(en[path]).join(",")}`);
      expect(`${path}:${placeholders(value).join(",")}`).toBe(`${path}:${placeholders(es[path]).join(",")}`);
    });
  });

  test("getAiCopy yalnız 'tr' için Türkçe, 'es' için İspanyolca verir; bilinmeyen dil İngilizce", () => {
    expect(getAiCopy("tr")).toBe(AI_COPY.tr);
    expect(getAiCopy("en")).toBe(AI_COPY.en);
    expect(getAiCopy("es")).toBe(AI_COPY.es);
    expect(getAiCopy("fr")).toBe(AI_COPY.en);
    expect(getAiCopy(undefined)).toBe(AI_COPY.en);
  });
});

describe("fillCopy", () => {
  test("yer tutucuları doldurur, eksik değeri boş bırakır", () => {
    expect(fillCopy("{n} hakkın kaldı", { n: 2 })).toBe("2 hakkın kaldı");
    expect(fillCopy("{a} ve {b}", { a: "x" })).toBe("x ve ");
    expect(fillCopy("{n} yapım", { n: 0 })).toBe("0 yapım");
    expect(fillCopy(undefined)).toBe("");
  });

  test("gerçek metinlerde hiçbir yer tutucu açıkta kalmaz", () => {
    expect(fillCopy(AI_COPY.tr.actions.addAll, { n: 4 })).toBe("Hepsini izleme listeme ekle (4)");
    expect(fillCopy(AI_COPY.en.notes.filtered, { n: 3 })).not.toMatch(/[{}]/);
  });
});
