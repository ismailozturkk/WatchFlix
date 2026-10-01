// Alternatif uygulama simgeleri için Expo config plugin'i (iOS + Android).
//
// app.json:
//   ["./plugins/withAlternateAppIcons.js", { "icons": [
//     { "name": "Glass",
//       "ios": "./assets/icon_glass/icon.png",
//       "android": { "foregroundImage": "...", "backgroundImage": "...",
//                    "monochromeImage": "..." } }
//   ] }]
// Varsayılan simge `expo.icon` / `android.adaptiveIcon`'dan gelir; burada yalnız
// ALTERNATİFLER tanımlanır. JS tarafındaki katalog utils/appIcons.js — iki taraf
// aynı adları kullanmak zorunda (__tests__/appIcons.test.js bunu doğrular).
//
// NEDEN HAZIR PAKET (expo-alternate-app-icons) DEĞİL: paketin Android modeli
// simge değişince `.MainActivity` bileşenini DEVRE DIŞI bırakıyor. Bu projede
// derin bağlantılar (seelogd:// şeması MainActivity'nin intent-filter'ında) ve
// üç ana ekran widget'ı (Intent(context, MainActivity::class.java)) o bileşene
// bağlı — devre dışıyken ikisi de sessizce ölür. Burada MainActivity HER ZAMAN
// etkindir; yalnız LAUNCHER rolü, aralarında geçiş yapılan `activity-alias`
// bileşenlerine taşınır. Çalışma zamanı modülü: modules/app-icon.
//
//   Android: MainActivity LAUNCHER filtresini kaybeder; `.MainActivityDefault`
//            (etkin) + her alternatif için `.MainActivity<Ad>` (devre dışı)
//            alias'ları eklenir. Simgeler res/mipmap-*/icon_alt_<ad>* olarak
//            üretilir (Expo'nun kendi ic_launcher* dosyalarından ayrı ad:
//            Expo'nun temizlik adımı onlara dokunmasın).
//   iOS:     Images.xcassets/<Ad>.appiconset üretilir ve YALNIZ uygulama
//            hedefinin ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES ayarına
//            eklenir (widget uzantısının katalogunda bu simgeler yok; oraya
//            yazılırsa derleme "eşleşen simge kümesi yok" diye düşer).
//
// SIRA: manifest ve dosya işleri `withFinalizedMod` içinde, yani TÜM diğer
// plugin'lerden sonra. Böylece Expo'nun `getMainActivityOrThrow` kullanan
// yerleşik adımları (şema, intent filtreleri, yönelim) LAUNCHER'ı hâlâ
// bulabiliyor. Artımlı prebuild'de (`--clean`siz) bir önceki çalıştırmanın
// değişikliği `withDangerousMod` ile en başta geri alınır, aynı sebeple.

const fs = require("fs");
const path = require("path");
const {
  AndroidConfig,
  IOSConfig,
  withDangerousMod,
  withFinalizedMod,
  withXcodeProject,
} = require("expo/config-plugins");
const { compositeImagesAsync, generateImageAsync } = require("@expo/image-utils");

const DEFAULT_ALIAS = "Default";
const NAME_PATTERN = /^[A-Z][A-Za-z0-9]*$/;
const ALIAS_PREFIX = ".MainActivity";
const LAUNCHER_CATEGORY = "android.intent.category.LAUNCHER";
const IOS_ALT_ICONS_SETTING = "ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES";

// Adaptif simge katmanı: 108dp * yoğunluk. Expo'nun kendi üretimiyle aynı ölçü.
const BASELINE_PX = 108;
const DENSITIES = [
  ["mipmap-mdpi", 1],
  ["mipmap-hdpi", 1.5],
  ["mipmap-xhdpi", 2],
  ["mipmap-xxhdpi", 3],
  ["mipmap-xxxhdpi", 4],
];

const snakeCase = (name) =>
  name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[\s-]+/g, "_").toLowerCase();

/** Alternatif simgenin res/ dosya adı öneki (`icon_alt_glass`). */
const resourcePrefix = (name) => `icon_alt_${snakeCase(name)}`;

function validateIcons(icons) {
  if (!Array.isArray(icons) || icons.length === 0) {
    throw new Error("withAlternateAppIcons: `icons` dizisi boş olamaz.");
  }
  const seen = new Set();
  for (const icon of icons) {
    if (!icon || typeof icon.name !== "string" || !NAME_PATTERN.test(icon.name)) {
      throw new Error(
        `withAlternateAppIcons: geçersiz simge adı "${icon && icon.name}" (PascalCase olmalı, ör. "Glass").`,
      );
    }
    if (icon.name === DEFAULT_ALIAS) {
      throw new Error(`withAlternateAppIcons: "${DEFAULT_ALIAS}" adı varsayılan simge için ayrılmış.`);
    }
    if (seen.has(icon.name)) {
      throw new Error(`withAlternateAppIcons: "${icon.name}" iki kez tanımlanmış.`);
    }
    seen.add(icon.name);
    if (typeof icon.ios !== "string") {
      throw new Error(`withAlternateAppIcons: "${icon.name}" için ios görsel yolu (string) gerekli.`);
    }
    const android = icon.android || {};
    if (!android.foregroundImage || !android.backgroundImage) {
      throw new Error(
        `withAlternateAppIcons: "${icon.name}" için android.foregroundImage ve android.backgroundImage gerekli.`,
      );
    }
  }
}

function assertFileExists(projectRoot, relativePath, label) {
  const full = path.resolve(projectRoot, relativePath);
  if (!fs.existsSync(full)) {
    throw new Error(`withAlternateAppIcons: ${label} bulunamadı: ${relativePath}`);
  }
}

// ─────────────────────────────── ANDROID ───────────────────────────────────

const isLauncherFilter = (filter) =>
  (filter.category || []).some((c) => c.$ && c.$["android:name"] === LAUNCHER_CATEGORY);

const launcherFilter = () => ({
  action: [{ $: { "android:name": "android.intent.action.MAIN" } }],
  category: [{ $: { "android:name": LAUNCHER_CATEGORY } }],
});

const isOurAlias = (alias) =>
  !!alias.$ && String(alias.$["android:name"] || "").startsWith(ALIAS_PREFIX);

const manifestPathOf = (platformProjectRoot) =>
  path.join(platformProjectRoot, "app", "src", "main", "AndroidManifest.xml");

/**
 * Bu plugin'in manifest değişikliğini GERİ AL (artımlı prebuild için): alias'ları
 * sil, MainActivity'ye LAUNCHER'ı geri ver. Manifest yoksa ya da zaten temizse
 * hiçbir şey yapmaz.
 */
async function revertManifest(platformProjectRoot) {
  const file = manifestPathOf(platformProjectRoot);
  if (!fs.existsSync(file)) return;
  const manifest = await AndroidConfig.Manifest.readAndroidManifestAsync(file);
  const app = AndroidConfig.Manifest.getMainApplication(manifest);
  if (!app) return;

  const aliases = app["activity-alias"] || [];
  if (!aliases.some(isOurAlias)) return;

  const rest = aliases.filter((a) => !isOurAlias(a));
  if (rest.length) app["activity-alias"] = rest;
  else delete app["activity-alias"];

  const main = (app.activity || []).find(
    (a) => a.$ && a.$["android:name"] === ".MainActivity",
  );
  if (main) {
    const filters = main["intent-filter"] || [];
    if (!filters.some(isLauncherFilter)) {
      main["intent-filter"] = [launcherFilter(), ...filters];
    }
  }
  await AndroidConfig.Manifest.writeAndroidManifestAsync(file, manifest);
}

function aliasEntry({ name, enabled, icon, roundIcon }) {
  const attrs = {
    "android:name": `${ALIAS_PREFIX}${name}`,
    "android:enabled": enabled ? "true" : "false",
    "android:exported": "true",
    "android:icon": icon,
    "android:targetActivity": ".MainActivity",
  };
  if (roundIcon) attrs["android:roundIcon"] = roundIcon;
  return { $: attrs, "intent-filter": [launcherFilter()] };
}

async function applyManifest(platformProjectRoot, icons) {
  const file = manifestPathOf(platformProjectRoot);
  const manifest = await AndroidConfig.Manifest.readAndroidManifestAsync(file);
  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  const main = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);

  // Varsayılan alias, uygulamanın kendi simgesini kullanır (Expo üretir).
  const defaultIcon = (app.$ && app.$["android:icon"]) || "@mipmap/ic_launcher";
  const defaultRound = (app.$ && app.$["android:roundIcon"]) || undefined;

  main["intent-filter"] = (main["intent-filter"] || []).filter((f) => !isLauncherFilter(f));

  const kept = (app["activity-alias"] || []).filter((a) => !isOurAlias(a));
  app["activity-alias"] = [
    ...kept,
    aliasEntry({ name: DEFAULT_ALIAS, enabled: true, icon: defaultIcon, roundIcon: defaultRound }),
    ...icons.map((icon) => {
      const res = `@mipmap/${resourcePrefix(icon.name)}`;
      return aliasEntry({ name: icon.name, enabled: false, icon: res, roundIcon: res });
    }),
  ];
  await AndroidConfig.Manifest.writeAndroidManifestAsync(file, manifest);
}

async function layerImage(projectRoot, cacheType, src, scale) {
  const size = Math.round(BASELINE_PX * scale);
  const { source } = await generateImageAsync(
    { projectRoot, cacheType },
    {
      src,
      width: size,
      height: size,
      resizeMode: "cover",
      backgroundColor: "transparent",
    },
  );
  return source;
}

async function generateAndroidIcon(projectRoot, platformProjectRoot, icon) {
  const prefix = resourcePrefix(icon.name);
  const resRoot = path.join(platformProjectRoot, "app", "src", "main", "res");
  const { foregroundImage, backgroundImage, monochromeImage } = icon.android;

  for (const [folder, scale] of DENSITIES) {
    const dir = path.join(resRoot, folder);
    fs.mkdirSync(dir, { recursive: true });

    const foreground = await layerImage(projectRoot, `${prefix}-fg`, foregroundImage, scale);
    const background = await layerImage(projectRoot, `${prefix}-bg`, backgroundImage, scale);

    // API 26 öncesi başlatıcılar için düz (katmansız) simge.
    fs.writeFileSync(
      path.join(dir, `${prefix}.png`),
      await compositeImagesAsync({ foreground, background }),
    );
    // API 26+ uyarlanabilir simge katmanları.
    fs.writeFileSync(path.join(dir, `${prefix}_foreground.png`), foreground);
    fs.writeFileSync(path.join(dir, `${prefix}_background.png`), background);
    if (monochromeImage) {
      fs.writeFileSync(
        path.join(dir, `${prefix}_monochrome.png`),
        await layerImage(projectRoot, `${prefix}-mono`, monochromeImage, scale),
      );
    }
  }

  const anyDpi = path.join(resRoot, "mipmap-anydpi-v26");
  fs.mkdirSync(anyDpi, { recursive: true });
  const layers = [
    `<background android:drawable="@mipmap/${prefix}_background"/>`,
    `<foreground android:drawable="@mipmap/${prefix}_foreground"/>`,
  ];
  if (monochromeImage) layers.push(`<monochrome android:drawable="@mipmap/${prefix}_monochrome"/>`);
  fs.writeFileSync(
    path.join(anyDpi, `${prefix}.xml`),
    `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    ${layers.join("\n    ")}\n</adaptive-icon>\n`,
  );
}

function withAndroidAlternateIcons(config, icons) {
  // En başta: önceki çalıştırmanın manifest değişikliğini geri al.
  config = withDangerousMod(config, [
    "android",
    async (cfg) => {
      await revertManifest(cfg.modRequest.platformProjectRoot);
      return cfg;
    },
  ]);
  // En sonda: simgeleri üret + manifesti uygula.
  return withFinalizedMod(config, [
    "android",
    async (cfg) => {
      const { projectRoot, platformProjectRoot } = cfg.modRequest;
      for (const icon of icons) {
        await generateAndroidIcon(projectRoot, platformProjectRoot, icon);
      }
      await applyManifest(platformProjectRoot, icons);
      return cfg;
    },
  ]);
}

// ──────────────────────────────── iOS ──────────────────────────────────────

async function generateIosIcon(projectRoot, icon) {
  const iosRoot = path.join(projectRoot, "ios");
  const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
  const setDir = path.join(iosRoot, projectName, "Images.xcassets", `${icon.name}.appiconset`);
  fs.mkdirSync(setDir, { recursive: true });

  // App Store simgesi alfa kanalı İÇEREMEZ; kaynak görseller neredeyse opak ama
  // alfa kanallı (254). Expo'nun kendi iOS simgesinde yaptığı gibi düzleştir.
  const { source } = await generateImageAsync(
    { projectRoot, cacheType: `${resourcePrefix(icon.name)}-ios` },
    {
      src: icon.ios,
      width: 1024,
      height: 1024,
      resizeMode: "cover",
      backgroundColor: "#000000",
      removeTransparency: true,
    },
  );
  const fileName = `${icon.name}.png`;
  fs.writeFileSync(path.join(setDir, fileName), source);
  fs.writeFileSync(
    path.join(setDir, "Contents.json"),
    JSON.stringify(
      {
        images: [{ filename: fileName, idiom: "universal", platform: "ios", size: "1024x1024" }],
        info: { version: 1, author: "expo" },
      },
      null,
      2,
    ),
  );
}

/**
 * Yalnız ADI verilen uygulama hedefinin tüm derleme yapılandırmalarına yazar.
 * `updateBuildProperty` hedef adını sessizce yok sayabiliyor (hedef bulunamazsa
 * HİÇBİR yapılandırmaya yazmadan döner); burada bulunamazsa derlemeyi düşürürüz.
 */
function setBuildSettingForTarget(project, targetName, key, value) {
  const unquote = (s) => String(s || "").replace(/^"|"$/g, "");
  const targets = project.pbxNativeTargetSection();
  const targetKey = Object.keys(targets).find(
    (k) => !k.endsWith("_comment") && unquote(targets[k].name) === targetName,
  );
  if (!targetKey) {
    throw new Error(`withAlternateAppIcons: Xcode hedefi bulunamadı: ${targetName}`);
  }
  const list = project.pbxXCConfigurationList()[targets[targetKey].buildConfigurationList];
  const configs = project.pbxXCBuildConfigurationSection();
  let written = 0;
  for (const ref of (list && list.buildConfigurations) || []) {
    if (configs[ref.value]) {
      configs[ref.value].buildSettings[key] = value;
      written += 1;
    }
  }
  if (!written) {
    throw new Error(`withAlternateAppIcons: ${targetName} için derleme yapılandırması bulunamadı.`);
  }
}

function withIosAlternateIcons(config, icons) {
  config = withFinalizedMod(config, [
    "ios",
    async (cfg) => {
      for (const icon of icons) {
        await generateIosIcon(cfg.modRequest.projectRoot, icon);
      }
      return cfg;
    },
  ]);
  return withXcodeProject(config, (cfg) => {
    setBuildSettingForTarget(
      cfg.modResults,
      cfg.modRequest.projectName,
      IOS_ALT_ICONS_SETTING,
      icons.map((icon) => icon.name),
    );
    return cfg;
  });
}

// ─────────────────────────────── GİRİŞ ─────────────────────────────────────

module.exports = function withAlternateAppIcons(config, props) {
  const icons = props && props.icons;
  validateIcons(icons);

  // Plugin, proje kökünde çalışır; yine de Expo'nun bildirdiği kök varsa o.
  const projectRoot = (config._internal && config._internal.projectRoot) || process.cwd();
  for (const icon of icons) {
    assertFileExists(projectRoot, icon.ios, `${icon.name} iOS simgesi`);
    assertFileExists(projectRoot, icon.android.foregroundImage, `${icon.name} Android ön plan`);
    assertFileExists(projectRoot, icon.android.backgroundImage, `${icon.name} Android arka plan`);
    if (icon.android.monochromeImage) {
      assertFileExists(projectRoot, icon.android.monochromeImage, `${icon.name} Android tek renk`);
    }
  }

  config = withAndroidAlternateIcons(config, icons);
  config = withIosAlternateIcons(config, icons);
  return config;
};

module.exports.DEFAULT_ALIAS = DEFAULT_ALIAS;
