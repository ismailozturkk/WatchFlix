#!/usr/bin/env node
"use strict";

// Zevk eşleşmesi v3 çekirdeğinin SUNUCU AYNASINI üretir (rehber Faz 5, adım 1).
//
// Kaynak (tek doğruluk): utils/genreCanon.js, tasteMatchV3.js, tasteMatchV3Adapter.js, matchStrength.js (ESM).
// Hedef: functions/tasteGenreCanon.js, tasteMatchCore.js, tasteMatchAdapter.js, matchStrengthCore.js (CommonJS).
// functions/ klasörü tek başına deploy edildiği için ../utils'e require edilemez; kopya şart.
//
// Kullanım:   node functions/scripts/syncTasteCore.js           → dosyaları yazar
//             node functions/scripts/syncTasteCore.js --check   → fark varsa çıkış kodu 1
// Bekçi: functions/tasteMatchCore.test.js (kopya güncel mi) + __tests__/tasteMatchV3.parity.test.js (aynı sayılar).

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..");
const FILES = Object.freeze([
  { from: "utils/genreCanon.js", to: "functions/tasteGenreCanon.js" },
  { from: "utils/tasteMatchV3.js", to: "functions/tasteMatchCore.js" },
  { from: "utils/tasteMatchV3Adapter.js", to: "functions/tasteMatchAdapter.js" },
  // Havuza giriş kuralı (eşleşme gücü): istemcinin gösterdiği "havuzdasın" ile sunucunun kararı aynı olsun.
  { from: "utils/matchStrength.js", to: "functions/matchStrengthCore.js" },
]);
const MODULE_MAP = Object.freeze({
  "./genreCanon": "./tasteGenreCanon",
  "./tasteMatchV3": "./tasteMatchCore",
});

/** ESM kaynağını CommonJS'e çevirir. Yalnız bu üç dosyanın kullandığı kalıpları tanır; başkası hata verir. */
function toCommonJs(source, from) {
  const names = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  for (const line of lines) {
    let m = /^import \{ ([\w, ]+) \} from "(\.\/\w+)";$/.exec(line);
    if (m) {
      const target = MODULE_MAP[m[2]];
      if (!target) throw new Error(`${from}: bilinmeyen import ${m[2]}`);
      out.push(`const { ${m[1]} } = require("${target}");`);
      continue;
    }
    if (/^import /.test(line)) throw new Error(`${from}: desteklenmeyen import: ${line}`);
    if (/^export default \w+;$/.test(line)) continue; // varsayılan dışa aktarım adlı olarak zaten var
    m = /^export (function|const) (\w+)/.exec(line);
    if (m) {
      names.push(m[2]);
      out.push(line.replace(/^export /, ""));
      continue;
    }
    if (/^export\b/.test(line)) throw new Error(`${from}: desteklenmeyen export: ${line}`);
    out.push(line);
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  const header = [
    "// OTOMATİK ÜRETİLDİ — ELLE DÜZENLEME.",
    `// Kaynak: ${from}. Yeniden üret: node functions/scripts/syncTasteCore.js`,
    "",
    '"use strict";',
    "",
  ];
  return `${header.join("\n")}${out.join("\n")}\n\nmodule.exports = { ${names.join(", ")} };\n`;
}

function build() {
  return FILES.map(({ from, to }) => ({
    to,
    text: toCommonJs(fs.readFileSync(path.join(ROOT, from), "utf8"), from),
  }));
}

if (require.main === module) {
  const check = process.argv.includes("--check");
  let stale = 0;
  for (const { to, text } of build()) {
    const file = path.join(ROOT, to);
    const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n") : null;
    if (current === text) continue;
    stale += 1;
    if (check) console.error(`güncel değil: ${to}`);
    else {
      fs.writeFileSync(file, text);
      console.log(`yazıldı: ${to}`);
    }
  }
  if (check && stale) process.exit(1);
}

module.exports = { toCommonJs, build, FILES };
