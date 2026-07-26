#!/usr/bin/env node
// scripts/generate-oss-licenses.js
//
// Üretim bağımlılıklarının (package.json > dependencies, geçişli olarak)
// lisans bilgisini ve LICENSE/NOTICE metinlerini node_modules'tan toplayıp
// assets/ossLicenses.json dosyasına yazar. Ekran bu dosyayı import eder.
//
// Kullanım:  npm run licenses
//
// Not: Liste elle tutulmaz — bağımlılık eklendiğinde/güncellendiğinde bu
// script yeniden çalıştırılmalı (store'a göndermeden önce).

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const OUT_FILE = path.join(ROOT, "assets", "ossLicenses.json");

// Lisans metni olarak kabul edilen dosya adları (küçük harfe çevrilmiş hâlleri).
const LICENSE_FILE_RE =
  /^(licen[cs]e|copying|mit-licen[cs]e|apache-licen[cs]e)([.-].*)?(\.(md|txt|markdown))?$/i;
const NOTICE_FILE_RE = /^notice(\.(md|txt))?$/i;

/** node_modules zincirinde yukarı doğru yürüyerek paket klasörünü bulur. */
function resolvePackageDir(name, fromDir) {
  let dir = fromDir;
  for (;;) {
    const candidate = path.join(dir, "node_modules", name);
    if (fs.existsSync(path.join(candidate, "package.json"))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/** package.json içindeki `license` / eski `licenses` alanını normalize eder. */
function normalizeLicense(pkg) {
  if (typeof pkg.license === "string") return pkg.license;
  if (pkg.license && typeof pkg.license === "object" && pkg.license.type)
    return pkg.license.type;
  // Eski (npm <1.x) biçim: `licenses` string ya da dizi olabilir.
  if (typeof pkg.licenses === "string") return pkg.licenses;
  if (Array.isArray(pkg.licenses)) {
    const types = pkg.licenses.map((l) => (typeof l === "string" ? l : l && l.type)).filter(Boolean);
    if (types.length) return types.join(" OR ");
  }
  return null;
}

function normalizePublisher(pkg) {
  const a = pkg.author;
  if (typeof a === "string") return a.replace(/\s*<[^>]*>/g, "").replace(/\s*\([^)]*\)/g, "").trim();
  if (a && typeof a === "object" && a.name) return a.name;
  return null;
}

function normalizeRepository(pkg) {
  const r = pkg.repository;
  const url = typeof r === "string" ? r : r && r.url;
  if (!url) return pkg.homepage || null;
  return url
    .replace(/^git\+/, "")
    .replace(/\.git$/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/^github:/, "https://github.com/");
}

/** Paket klasöründeki LICENSE / NOTICE dosyalarını okur. */
function readLegalFiles(dir) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return { license: null, notice: null };
  }
  let license = null;
  let notice = null;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const full = path.join(dir, entry.name);
    if (!license && LICENSE_FILE_RE.test(entry.name)) {
      const text = readText(full);
      if (text) license = text;
    } else if (!notice && NOTICE_FILE_RE.test(entry.name)) {
      const text = readText(full);
      if (text) notice = text;
    }
  }
  return { license, notice };
}

function readText(file) {
  try {
    const stat = fs.statSync(file);
    // 200 KB üstü dosyalar lisans metni değildir (ör. bundle) — atla.
    if (stat.size > 200 * 1024) return null;
    return fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n").trim() || null;
  } catch {
    return null;
  }
}

// --- Geçişli üretim bağımlılık grafiğini gez -------------------------------

const rootPkg = readJson(path.join(ROOT, "package.json"));
if (!rootPkg) {
  console.error("package.json okunamadi.");
  process.exit(1);
}

const collected = new Map(); // "name@version" -> kayıt
const missing = [];
const visited = new Set(); // "name|fromDir"

function walk(name, fromDir) {
  const visitKey = `${name}|${fromDir}`;
  if (visited.has(visitKey)) return;
  visited.add(visitKey);

  const dir = resolvePackageDir(name, fromDir);
  if (!dir) {
    if (!missing.includes(name)) missing.push(name);
    return;
  }
  const pkg = readJson(path.join(dir, "package.json"));
  if (!pkg) return;

  const key = `${pkg.name || name}@${pkg.version || "0.0.0"}`;
  if (!collected.has(key)) {
    const legal = readLegalFiles(dir);
    collected.set(key, {
      name: pkg.name || name,
      version: pkg.version || "",
      license: normalizeLicense(pkg) || "UNKNOWN",
      publisher: normalizePublisher(pkg),
      repository: normalizeRepository(pkg),
      licenseText: legal.license,
      noticeText: legal.notice,
    });
  }

  for (const dep of Object.keys(pkg.dependencies || {})) walk(dep, dir);
  // optionalDependencies kurulu olmayabilir; kuruluysa dağıtıma girer.
  for (const dep of Object.keys(pkg.optionalDependencies || {})) walk(dep, dir);
}

for (const dep of Object.keys(rootPkg.dependencies || {})) walk(dep, ROOT);

// --- Lisans metinlerini tekilleştir (aynı metin yüzlerce pakette tekrar eder)

const textIds = new Map(); // sha1 -> id
const texts = {}; // id -> metin

function internText(text) {
  if (!text) return null;
  const hash = crypto.createHash("sha1").update(text).digest("hex");
  if (!textIds.has(hash)) {
    const id = `t${textIds.size}`;
    textIds.set(hash, id);
    texts[id] = text;
  }
  return textIds.get(hash);
}

const packages = [...collected.values()]
  .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))
  .map((p) => {
    const entry = {
      name: p.name,
      version: p.version,
      license: p.license,
      textId: internText(p.licenseText),
    };
    if (p.publisher) entry.publisher = p.publisher;
    if (p.repository) entry.repository = p.repository;
    const noticeId = internText(p.noticeText);
    if (noticeId) entry.noticeId = noticeId;
    return entry;
  });

const summary = {};
for (const p of packages) summary[p.license] = (summary[p.license] || 0) + 1;

const payload = {
  generatedAt: new Date().toISOString().slice(0, 10),
  appVersion: rootPkg.version || "",
  packageCount: packages.length,
  summary: Object.fromEntries(
    Object.entries(summary).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  ),
  texts,
  packages,
};

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(payload), "utf8");

const sizeKb = (fs.statSync(OUT_FILE).size / 1024).toFixed(0);
console.log(`${packages.length} paket -> ${path.relative(ROOT, OUT_FILE)} (${sizeKb} KB)`);

const noText = packages.filter((p) => !p.textId);
if (noText.length) {
  console.warn(
    `UYARI: ${noText.length} pakette LICENSE dosyasi bulunamadi (SPDX kimligi gosterilecek): ` +
      noText.slice(0, 10).map((p) => p.name).join(", ") +
      (noText.length > 10 ? ", ..." : ""),
  );
}
if (missing.length) {
  console.warn(`UYARI: node_modules'ta bulunamayan ${missing.length} paket: ${missing.join(", ")}`);
}
const unknown = packages.filter((p) => p.license === "UNKNOWN");
if (unknown.length) {
  console.warn(
    `UYARI: lisansi belirsiz ${unknown.length} paket elle incelenmeli: ` +
      unknown.map((p) => `${p.name}@${p.version}`).join(", "),
  );
}
