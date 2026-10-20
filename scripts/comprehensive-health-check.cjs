const fs = require("fs");
const path = require("path");
const babel = require("@babel/core");

console.log("==================================================");
console.log("   COMPREHENSIVE PROJECT HEALTH & ERROR CHECK");
console.log("==================================================");

let totalErrors = 0;
let totalWarnings = 0;

// 1. JSON Validity and Translation Sync Check
console.log("\n[1/4] Checking Translation & Database JSON files...");
const trPath = path.join(__dirname, "../translations/tr.json");
const enPath = path.join(__dirname, "../translations/en.json");
const oscarDbPath = path.join(__dirname, "oscar_6cat_database.json");
const emmyDbPath = path.join(__dirname, "emmy_6cat_database.json");

try {
  const tr = JSON.parse(fs.readFileSync(trPath, "utf8"));
  const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
  console.log("  ✓ translations/tr.json is valid JSON.");
  console.log("  ✓ translations/en.json is valid JSON.");

  // Check critical keys
  const requiredAutoKeys = [
    "oscar_pending_title", "oscar_pending_subtitle", "oscar_pending_toast",
    "oscar_mode_category", "oscar_mode_year", "oscar_select_year", "oscar_year_title",
    "oscar_cat_best_picture", "oscar_cat_international", "oscar_cat_animation",
    "oscar_cat_visual_effects", "oscar_cat_documentary", "oscar_cat_cinematography",
    "emmy_pending_title", "emmy_pending_subtitle", "emmy_pending_toast",
    "emmy_mode_category", "emmy_mode_year", "emmy_select_year", "emmy_year_title",
    "emmy_cat_drama", "emmy_cat_comedy", "emmy_cat_limited", "emmy_cat_animation",
    "emmy_cat_documentary", "emmy_cat_international"
  ];

  for (const k of requiredAutoKeys) {
    if (!tr.autoI18n?.[k]) {
      console.error(`  ✗ Missing key in tr.json autoI18n: ${k}`);
      totalErrors++;
    }
    if (!en.autoI18n?.[k]) {
      console.error(`  ✗ Missing key in en.json autoI18n: ${k}`);
      totalErrors++;
    }
  }

  if (tr.tvShowScreens?.emmy && en.tvShowScreens?.emmy) {
    console.log("  ✓ tvShowScreens.emmy key present in both tr and en.");
  } else {
    console.error("  ✗ Missing tvShowScreens.emmy in translations!");
    totalErrors++;
  }
} catch (err) {
  console.error("  ✗ Translation JSON parse error:", err.message);
  totalErrors++;
}

try {
  const oscarDb = JSON.parse(fs.readFileSync(oscarDbPath, "utf8"));
  const emmyDb = JSON.parse(fs.readFileSync(emmyDbPath, "utf8"));
  console.log(`  ✓ oscar_6cat_database.json valid (${oscarDb.items.length} items).`);
  console.log(`  ✓ emmy_6cat_database.json valid (${emmyDb.items.length} items).`);

  if (oscarDb.items.length !== 58 || emmyDb.items.length !== 58) {
    console.warn("  ⚠ Warning: Database item count is not 58!");
    totalWarnings++;
  }
} catch (err) {
  console.error("  ✗ Database JSON parse error:", err.message);
  totalErrors++;
}

// 2. Syntax & Babel Parsing Check of Key Codebase Files
console.log("\n[2/4] Validating JavaScript & JSX Syntax for Modified/Related Files...");
const keyFiles = [
  "services/oscarService.js",
  "services/emmyService.js",
  "context/MovieContex.js",
  "context/TvShowContex.js",
  "screens/movie/MovieOscar.js",
  "screens/tv/TvShowsEmmy.js",
  "screens/tabs/TvShowScreen.js",
  "screens/tabs/MovieScreen.js",
  "screens/shared/SeeAllScreen.js",
  "components/Skeleton.js",
  "utils/apiCache.js"
];

for (const relPath of keyFiles) {
  const fullPath = path.join(__dirname, "..", relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`  ✗ File does not exist: ${relPath}`);
    totalErrors++;
    continue;
  }

  try {
    const code = fs.readFileSync(fullPath, "utf8");
    babel.parseSync(code, {
      filename: fullPath,
      presets: ["babel-preset-expo"],
      caller: { name: "health-check" }
    });
    console.log(`  ✓ ${relPath} passed Babel parsing without syntax errors.`);
  } catch (err) {
    console.error(`  ✗ Syntax error in ${relPath}:`, err.message);
    totalErrors++;
  }
}

// 3. Scan all project directories for syntax errors
console.log("\n[3/4] Scanning all screens, context, services, components for syntax errors...");
const dirsToScan = ["screens", "context", "services", "components", "utils", "hooks"];

function getAllJsFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (file !== "node_modules" && file !== ".git" && file !== ".expo") {
        getAllJsFiles(filePath, arrayOfFiles);
      }
    } else if (file.endsWith(".js") || file.endsWith(".jsx")) {
      arrayOfFiles.push(filePath);
    }
  });
  return arrayOfFiles;
}

let scannedCount = 0;
for (const d of dirsToScan) {
  const fullDir = path.join(__dirname, "..", d);
  if (fs.existsSync(fullDir)) {
    const files = getAllJsFiles(fullDir);
    for (const f of files) {
      scannedCount++;
      try {
        const code = fs.readFileSync(f, "utf8");
        babel.parseSync(code, {
          filename: f,
          presets: ["babel-preset-expo"],
          caller: { name: "health-check" }
        });
      } catch (err) {
        console.error(`  ✗ Syntax/Babel error in ${path.relative(path.join(__dirname, ".."), f)}:`, err.message);
        totalErrors++;
      }
    }
  }
}
console.log(`  ✓ Successfully scanned ${scannedCount} files across ${dirsToScan.join(", ")}.`);

console.log("\n==================================================");
console.log(`Health Check Summary: ${totalErrors} Errors, ${totalWarnings} Warnings.`);
console.log("==================================================");

if (totalErrors > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
