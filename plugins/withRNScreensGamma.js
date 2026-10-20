const fs = require("fs");
const path = require("path");
const {
  createRunOncePlugin,
  withDangerousMod,
} = require("@expo/config-plugins");

const PLUGIN_NAME = "with-rn-screens-gamma";
const PLUGIN_VERSION = "1.0.0";

// react-native-screens'in DENEYSEL ("gamma") yerel bileşenlerini derlemeye açar.
//
// NEDEN: `react-native-screens/experimental` altındaki `ScrollViewMarker` (sekme
// çubuğunun "kaydırınca küçül" davranışı için, components/navigation/
// TabScrollMarker.js) yalnız pod kurulurken `RNS_GAMMA_ENABLED=1` ise gerçek
// yerel koda sahip. Bayrak yoksa podspec `ios/gamma/**`i derlemeden çıkarıp yerine
// BOŞ taslak sınıflar koyar (ios/stubs/RNSGammaStubs.mm). JS yine de
// `RNSScrollViewMarker`ı oluşturmaya çalışır ve `createNode` yerelde
// `Exception in HostFunction: <unknown>` ile patlar; JS tarafındaki try/catch
// bunu yakalayamaz çünkü hata require'da değil render'da çıkar.
//
// Bayrağı Podfile'a yazıyoruz (eas.json env'i değil): hangi EAS profili ya da yerel
// `expo prebuild` olursa olsun podspec değerlendirilirken (prepare_react_native_
// project!'ten sonraki pod çözümlemesi) ENV zaten ayarlı olur.
const GAMMA_LINE = "ENV['RNS_GAMMA_ENABLED'] = '1'";
const PREPARE_ANCHOR = "prepare_react_native_project!";

const enableRNScreensGamma = (podfileContents) => {
  if (podfileContents.includes(GAMMA_LINE)) {
    return podfileContents;
  }

  if (!podfileContents.includes(PREPARE_ANCHOR)) {
    throw new Error(
      `[${PLUGIN_NAME}] Could not find ${PREPARE_ANCHOR} in the generated Podfile.`,
    );
  }

  return podfileContents.replace(
    PREPARE_ANCHOR,
    `${GAMMA_LINE}\n\n${PREPARE_ANCHOR}`,
  );
};

const withRNScreensGamma = (config) =>
  withDangerousMod(config, [
    "ios",
    async (modConfig) => {
      const podfilePath = path.join(
        modConfig.modRequest.platformProjectRoot,
        "Podfile",
      );
      const podfileContents = fs.readFileSync(podfilePath, "utf8");
      const nextPodfileContents = enableRNScreensGamma(podfileContents);

      if (nextPodfileContents !== podfileContents) {
        fs.writeFileSync(podfilePath, nextPodfileContents);
      }

      return modConfig;
    },
  ]);

module.exports = createRunOncePlugin(
  withRNScreensGamma,
  PLUGIN_NAME,
  PLUGIN_VERSION,
);
module.exports.enableRNScreensGamma = enableRNScreensGamma;
module.exports.GAMMA_LINE = GAMMA_LINE;
