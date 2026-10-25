// Geliştirici araçları release'de açılmasın (kaynak taraması).
//
// UsageDebugScreen maliyet kokpiti, test bildirimleri ve sayaç sıfırlama içerir;
// kullanıcıya görünmemeli. Ekran App.js'te kayıtlı kalabilir (kayıt tek başına
// erişim vermez), ama ona giden HER `navigate("UsageDebugScreen")` çağrısı bir
// `__DEV__` kapısının arkasında olmalı. Kapı, çağrının hemen öncesindeki kodda
// (aynı JSX bloğu ya da aynı if) aranır.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIRS = ["components", "screens", "context", "hooks", "utils", "services"];
const TARGET = /navigate\(\s*["']UsageDebugScreen["']/g;
const LOOKBACK = 500;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

const FILES = [path.join(ROOT, "App.js"), ...DIRS.flatMap((d) => walk(path.join(ROOT, d)))].map((file) => ({
  rel: path.relative(ROOT, file).split(path.sep).join("/"),
  src: fs.readFileSync(file, "utf8"),
}));

describe("geliştirici araçları release kapısı", () => {
  const calls = [];
  for (const { rel, src } of FILES) {
    for (const m of src.matchAll(TARGET)) {
      const before = src.slice(Math.max(0, m.index - LOOKBACK), m.index);
      const line = src.slice(0, m.index).split("\n").length;
      calls.push({ where: `${rel}:${line}`, gated: before.includes("__DEV__") });
    }
  }

  it("UsageDebugScreen'e en az bir giriş var (tarama boşa düşmüyor)", () => {
    expect(calls.length).toBeGreaterThan(0);
  });

  it("her giriş __DEV__ arkasında", () => {
    expect(calls.filter((c) => !c.gated).map((c) => c.where)).toEqual([]);
  });
});
