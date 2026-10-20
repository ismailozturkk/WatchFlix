// CineSwipe metin bekçisi: bileşenlerde ve ekranda kullanılan her `copy.<yol>`
// iki dil paketinde (translations/*.json → cineSwipe) tanımlı olmalı ve iki dilin
// anahtar ağacı ile {{değişken}} yer tutucuları birebir aynı olmalı.
//
// Neden gerekli: `useCineCopy` TR paketine düşer; EN'de eksik anahtar çökmez,
// sessizce Türkçe görünür — ya da hiç tanımsızsa boş metin çizilir.
const fs = require("fs");
const path = require("path");

const tr = require("../translations/tr.json").cineSwipe;
const en = require("../translations/en.json").cineSwipe;

const ROOT = path.join(__dirname, "..");
const SOURCE_DIRS = ["components/cineswipe", "screens/cineswipe"];

function sourceFiles() {
  return SOURCE_DIRS.flatMap((dir) =>
    fs
      .readdirSync(path.join(ROOT, dir))
      .filter((file) => file.endsWith(".js"))
      .map((file) => path.join(dir, file)),
  );
}

const resolvePath = (tree, dotted) => dotted.split(".").reduce((node, key) => (node == null ? node : node[key]), tree);

function leaves(tree, prefix = "") {
  return Object.entries(tree).flatMap(([key, value]) =>
    value && typeof value === "object" ? leaves(value, `${prefix}${key}.`) : [[`${prefix}${key}`, value]],
  );
}

const placeholders = (text) => (String(text).match(/\{\{\w+\}\}/g) || []).sort().join(",");

describe("CineSwipe çevirileri", () => {
  test("ekran ve bileşenlerde kullanılan her copy.* anahtarı iki dilde tanımlı", () => {
    const missing = [];
    for (const file of sourceFiles()) {
      const source = fs.readFileSync(path.join(ROOT, file), "utf8");
      for (const match of source.matchAll(/\bcopy\.([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)/g)) {
        const key = match[1];
        if (resolvePath(tr, key) === undefined) missing.push(`${file}: tr ${key}`);
        if (resolvePath(en, key) === undefined) missing.push(`${file}: en ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  test("TR ve EN aynı anahtar ağacına sahip", () => {
    const trKeys = leaves(tr).map(([key]) => key).sort();
    const enKeys = leaves(en).map(([key]) => key).sort();
    expect(enKeys).toEqual(trKeys);
  });

  test("hiçbir metin boş değil ve yer tutucular iki dilde aynı", () => {
    const enMap = new Map(leaves(en));
    const problems = [];
    for (const [key, value] of leaves(tr)) {
      if (typeof value !== "string" || !value.trim()) problems.push(`tr boş: ${key}`);
      const other = enMap.get(key);
      if (typeof other !== "string" || !other.trim()) problems.push(`en boş: ${key}`);
      else if (placeholders(value) !== placeholders(other)) problems.push(`yer tutucu farkı: ${key}`);
    }
    expect(problems).toEqual([]);
  });
});
