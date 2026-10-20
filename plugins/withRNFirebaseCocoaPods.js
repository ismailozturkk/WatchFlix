const fs = require("fs");
const path = require("path");
const {
  createRunOncePlugin,
  withDangerousMod,
} = require("@expo/config-plugins");

const PLUGIN_NAME = "with-rn-firebase-cocoapods";
const PLUGIN_VERSION = "1.1.0";
const DISABLE_SPM_LINE = "$RNFirebaseDisableSPM = true";

// Firebase iOS SDK sürümü — TÜM EAS profillerinde (development/preview/production)
// aynı olsun diye burada, Podfile düzeyinde sabitlenir.
//
// NEDEN 12.14.0: FirebaseAppCheck 12.15.0–12.18.0 CocoaPods ile DERLENMEZ
// (`unknown receiver 'GACRecaptchaProvider'`): podspec'in getirdiği
// RecaptchaProvider kaynakları yalnız SPM'de var olan bir Swift modülüne
// (google/app-check → AppCheckRecaptchaProvider) başvuruyor. 12.14.0 bu
// dosyalardan ÖNCEKİ son sürüm. Bu proje SPM'yi kapatıp (yukarıdaki satır)
// CocoaPods kullandığı için etkileniyor. @react-native-firebase 26.1.0'ın
// varsayılanı 12.17.0 — sabitleme olmadan derleme düşer.
// Bkz. https://github.com/firebase/firebase-ios-sdk/issues/16477
//
// Düzeltilmiş bir Firebase sürümüne (≥12.19.0) geçerken: önce iOS derlemesinin
// geçtiğini doğrula, sonra bu sabiti ve eas.json'daki FIREBASE_SDK_VERSION
// girdilerini birlikte güncelle (ortam değişkeni Podfile'daki değerin ÜSTÜNE yazar).
const FIREBASE_IOS_SDK_VERSION = "12.14.0";
const FIREBASE_SDK_LINE_PATTERN = /^\$FirebaseSDKVersion\s*=.*$/m;
const firebaseSdkLine = (version) => `$FirebaseSDKVersion = '${version}'`;

const PREPARE_ANCHOR = "prepare_react_native_project!";

const disableRNFirebaseSpm = (podfileContents) => {
  if (podfileContents.includes(DISABLE_SPM_LINE)) {
    return podfileContents;
  }

  if (!podfileContents.includes(PREPARE_ANCHOR)) {
    throw new Error(
      `[${PLUGIN_NAME}] Could not find ${PREPARE_ANCHOR} in the generated Podfile.`,
    );
  }

  return podfileContents.replace(
    PREPARE_ANCHOR,
    `${DISABLE_SPM_LINE}\n\n${PREPARE_ANCHOR}`,
  );
};

const pinFirebaseSdkVersion = (podfileContents, version = FIREBASE_IOS_SDK_VERSION) => {
  const line = firebaseSdkLine(version);
  if (FIREBASE_SDK_LINE_PATTERN.test(podfileContents)) {
    return podfileContents.replace(FIREBASE_SDK_LINE_PATTERN, line);
  }

  if (!podfileContents.includes(PREPARE_ANCHOR)) {
    throw new Error(
      `[${PLUGIN_NAME}] Could not find ${PREPARE_ANCHOR} in the generated Podfile.`,
    );
  }

  // RNFB podspec'leri `$FirebaseSDKVersion`'ı değerlendirme sırasında okur; bu
  // yüzden `prepare_react_native_project!`ten (hiçbir pod henüz yüklenmeden) önce.
  return podfileContents.replace(
    PREPARE_ANCHOR,
    `${line}\n\n${PREPARE_ANCHOR}`,
  );
};

const withRNFirebaseCocoaPods = (config) =>
  withDangerousMod(config, [
    "ios",
    async (modConfig) => {
      const podfilePath = path.join(
        modConfig.modRequest.platformProjectRoot,
        "Podfile",
      );
      const podfileContents = fs.readFileSync(podfilePath, "utf8");
      const nextPodfileContents = pinFirebaseSdkVersion(
        disableRNFirebaseSpm(podfileContents),
      );

      if (nextPodfileContents !== podfileContents) {
        fs.writeFileSync(podfilePath, nextPodfileContents);
      }

      return modConfig;
    },
  ]);

module.exports = createRunOncePlugin(
  withRNFirebaseCocoaPods,
  PLUGIN_NAME,
  PLUGIN_VERSION,
);
module.exports.disableRNFirebaseSpm = disableRNFirebaseSpm;
module.exports.pinFirebaseSdkVersion = pinFirebaseSdkVersion;
module.exports.FIREBASE_IOS_SDK_VERSION = FIREBASE_IOS_SDK_VERSION;
