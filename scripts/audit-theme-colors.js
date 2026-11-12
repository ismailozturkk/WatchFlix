#!/usr/bin/env node
// scripts/audit-theme-colors.js
//
// Tema denetimi: temayı kullanan (useTheme) bileşenlerde AÇIK TONLARDA
// kaybolabilecek sabit renkleri listeler. Beş tonlu modelde (çok açık · açık ·
// orta · koyu · AMOLED) bir ekranın iki açık tonda da okunur kalması gerekir.
//
// Yakalananlar:
//   text   — `color:` beyaza yakın sabit renk (#fff, #eee, rgba(255,255,255,…), #aaa, #ccc…)
//   fill   — `backgroundColor:` / `borderColor:` düşük opaklıklı beyaz (≤ 0.3)
//   hexcat — tema token'ına hex opaklık eki (`theme.border + "33"`): token rgba ise geçersiz renk
//
// Her bulgu HATA DEĞİLDİR: afiş/fotoğraf ya da vurgu degradesi üstündeki beyaz
// doğrudur (onları `theme.onMedia.*` / `theme.onAccent` ile işaretlemek niyeti
// açık eder). Satır sonuna `// theme-audit-ok: <neden>` yazılan bulgular atlanır.
//
// Kullanım:
//   node scripts/audit-theme-colors.js            → dosya başına özet
//   node scripts/audit-theme-colors.js --lines    → satır satır
//   node scripts/audit-theme-colors.js --lines components/chat
//   node scripts/audit-theme-colors.js --json     → makine okunur

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const showLines = args.includes("--lines");
const asJson = args.includes("--json");
const scopes = args.filter((a) => !a.startsWith("--"));
const DIRS = scopes.length ? scopes : ["components", "screens"];

const WHITEISH_TEXT = /\bcolor:\s*["'](#f{3}|#f{6}|#e{3}|#e{6}|#ddd|#d{6}|#ccc|#c{6}|#bbb|#b{6}|#aaa|#a{6}|white|rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*[\d.]+\s*\))["']/i;
const LOW_WHITE_FILL = /\b(backgroundColor|borderColor|borderBottomColor|borderTopColor):\s*["']rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*(0?\.[0-2]\d*|0?\.30?)\s*\)["']/i;
const HEX_CONCAT = /\b(theme|colors)\.(border|tab|secondaryt|ai|shadow)\s*\+\s*["'`][0-9a-f]{2}["'`]/i;
const OK_MARK = /theme-audit-ok/;

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  if (fs.statSync(dir).isFile()) {
    out.push(dir);
    return out;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      walk(full, out);
    } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const files = DIRS.flatMap((d) => walk(path.resolve(ROOT, d), []));
const report = [];

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  if (!/useTheme\s*\(|\btheme\.(primary|secondary|text)\b/.test(src)) continue;
  const lines = src.split(/\r?\n/);
  const hits = [];
  lines.forEach((line, i) => {
    if (OK_MARK.test(line)) return;
    if (WHITEISH_TEXT.test(line)) hits.push({ line: i + 1, kind: "text", code: line.trim() });
    else if (LOW_WHITE_FILL.test(line)) hits.push({ line: i + 1, kind: "fill", code: line.trim() });
    if (HEX_CONCAT.test(line)) hits.push({ line: i + 1, kind: "hexcat", code: line.trim() });
  });
  if (hits.length) report.push({ file: path.relative(ROOT, file).replace(/\\/g, "/"), hits });
}

report.sort((a, b) => b.hits.length - a.hits.length);

if (asJson) {
  process.stdout.write(JSON.stringify(report, null, 2));
} else {
  let total = 0;
  for (const r of report) {
    const by = r.hits.reduce((acc, h) => ({ ...acc, [h.kind]: (acc[h.kind] || 0) + 1 }), {});
    total += r.hits.length;
    console.log(`${String(r.hits.length).padStart(4)}  ${r.file}  ${JSON.stringify(by)}`);
    if (showLines) for (const h of r.hits) console.log(`        ${h.line}: [${h.kind}] ${h.code.slice(0, 140)}`);
  }
  console.log(`\n${report.length} dosya, ${total} bulgu`);
}
