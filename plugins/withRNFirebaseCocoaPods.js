const fs = require("fs");
const path = require("path");
const {
  createRunOncePlugin,
  withDangerousMod,
} = require("@expo/config-plugins");

const PLUGIN_NAME = "with-rn-firebase-cocoapods";
const PLUGIN_VERSION = "1.0.0";
const DISABLE_SPM_LINE = "$RNFirebaseDisableSPM = true";

const disableRNFirebaseSpm = (podfileContents) => {
  if (podfileContents.includes(DISABLE_SPM_LINE)) {
    return podfileContents;
  }

  const insertionPoint = "prepare_react_native_project!";
  if (!podfileContents.includes(insertionPoint)) {
    throw new Error(
      `[${PLUGIN_NAME}] Could not find ${insertionPoint} in the generated Podfile.`,
    );
  }

  return podfileContents.replace(
    insertionPoint,
    `${DISABLE_SPM_LINE}\n\n${insertionPoint}`,
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
      const nextPodfileContents = disableRNFirebaseSpm(podfileContents);

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
