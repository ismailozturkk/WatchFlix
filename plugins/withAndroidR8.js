// Android sürüm derlemesinde R8'i Play'in Şubat 2027 şartına (her biri en az %25
// optimizasyon / karartma / küçültme) yetecek biçimde yapılandıran config plugin'i.
// Rehber: docs/planlama/R8_ETKINLESTIRME_UYGULAMA_REHBERI.md
//
// R8'in kendisini expo-build-properties açar (enableMinifyInReleaseBuilds +
// enableShrinkResourcesInReleaseBuilds). Bu plugin onun yapamadıklarını yapar:
//   1. app/build.gradle: proguard-android.txt → proguard-android-optimize.txt
//      (eskisinde -dontoptimize var; onunla optimizasyon oranı %0 kalır),
//   2. gradle.properties: android.r8.optimizedResourceShrinking=true (AGP 8.12'de
//      elle açılır) ve R8 için daha büyük Gradle belleği,
//   3. app/proguard-rules.pro: native/android-r8/keep-rules.pro içeriğini işaretli
//      blok olarak ekler,
//   4. res/raw/seelogd_keep.xml: adıyla okunan kaynakları (Play Billing kayıt
//      dosyaları) kaynak küçültmeye karşı korur.
//
// Seçenekler (kademeli açmak için): { optimize = true, optimizedResourceShrinking = true }.
// Not: bir seçenek kapatılınca önceki prebuild'den kalan gradle.properties satırı
// silinmez (prebuild --clean kullanılmıyor); EAS her derlemede android/'i sıfırdan üretir.

const { withAppBuildGradle, withGradleProperties, withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const RULES_SRC = path.join(__dirname, "..", "native", "android-r8", "keep-rules.pro");
// Adıyla okunan, kaynak küçültmenin silmemesi gereken kaynaklar (tools:keep).
const KEEP_RES_SRC = path.join(__dirname, "..", "native", "android-r8", "res", "raw", "seelogd_keep.xml");
const BEGIN = "# >>> seelogd-r8 (plugins/withAndroidR8.js yazar)";
const END = "# <<< seelogd-r8";
const OLD_DEFAULT = 'getDefaultProguardFile("proguard-android.txt")';
const NEW_DEFAULT = 'getDefaultProguardFile("proguard-android-optimize.txt")';
// Aynı yığında (Expo 57 / RN 0.86 / AGP 8.12) ilk R8 çalıştırması şablonun
// 2 GB / 512 MB değerleriyle Metaspace OOM verdiği raporlandı.
const JVM_ARGS = "-Xmx4g -XX:MaxMetaspaceSize=1g";

// gradle.properties: varsa değeri değiştirir, yoksa ekler (idempotent).
function setGradleProperty(props, key, value) {
  const hit = props.find((p) => p.type === "property" && p.key === key);
  if (hit) hit.value = value;
  else props.push({ type: "property", key, value });
  return props;
}

// build.gradle: -dontoptimize içeren varsayılan dosyayı optimize sürümüyle değiştirir.
function swapDefaultProguardFile(contents) {
  if (contents.includes(NEW_DEFAULT)) return contents;
  if (!contents.includes(OLD_DEFAULT)) {
    throw new Error(
      `withAndroidR8: app/build.gradle içinde ${OLD_DEFAULT} bulunamadı — Expo şablonu değişmiş, plugin güncellenmeli.`,
    );
  }
  return contents.replace(OLD_DEFAULT, NEW_DEFAULT);
}

// proguard-rules.pro: işaretli bloğu ekler ya da yerinde yeniler (idempotent).
function mergeKeepRules(contents, rules) {
  const block = `${BEGIN}\n${rules.trim()}\n${END}`;
  const start = contents.indexOf(BEGIN);
  const end = contents.indexOf(END);
  if (start !== -1 && end > start) {
    return contents.slice(0, start) + block + contents.slice(end + END.length);
  }
  return `${contents.trimEnd()}\n\n${block}\n`;
}

function withAndroidR8(config, { optimize = true, optimizedResourceShrinking = true } = {}) {
  config = withGradleProperties(config, (c) => {
    setGradleProperty(c.modResults, "org.gradle.jvmargs", JVM_ARGS);
    if (optimizedResourceShrinking) {
      setGradleProperty(c.modResults, "android.r8.optimizedResourceShrinking", "true");
    }
    return c;
  });
  if (optimize) {
    config = withAppBuildGradle(config, (c) => {
      c.modResults.contents = swapDefaultProguardFile(c.modResults.contents);
      return c;
    });
  }
  return withDangerousMod(config, [
    "android",
    async (c) => {
      const file = path.join(c.modRequest.platformProjectRoot, "app", "proguard-rules.pro");
      const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
      fs.writeFileSync(file, mergeKeepRules(current, fs.readFileSync(RULES_SRC, "utf8")));
      const rawDir = path.join(c.modRequest.platformProjectRoot, "app", "src", "main", "res", "raw");
      fs.mkdirSync(rawDir, { recursive: true });
      fs.copyFileSync(KEEP_RES_SRC, path.join(rawDir, "seelogd_keep.xml"));
      return c;
    },
  ]);
}

module.exports = withAndroidR8;
module.exports.setGradleProperty = setGradleProperty;
module.exports.swapDefaultProguardFile = swapDefaultProguardFile;
module.exports.mergeKeepRules = mergeKeepRules;
module.exports.RULES_SRC = RULES_SRC;
module.exports.KEEP_RES_SRC = KEEP_RES_SRC;
module.exports.BEGIN = BEGIN;
module.exports.END = END;
