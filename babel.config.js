module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      "./scripts/babel-transform-app-text.js",
      [
        "module-resolver",
        {
          root: ["./"],
          extensions: [".js", ".jsx", ".json"],
          alias: {
            "@components": "./components",
            "@context": "./context",
            "@screens": "./screens",
            "@services": "./services",
            "@hooks": "./hooks",
            "@utils": "./utils",
            "@assets": "./assets",
            "@theme": "./theme",
            "@translations": "./translations",
            "@lottie": "./assets/lottie",
          },
        },
      ],
      // NOT: Burada eskiden "react-native-reanimated/plugin" vardı. SDK 55+ ile
      // babel-preset-expo, react-native-worklets kuruluysa worklets eklentisini
      // KENDİSİ ekliyor (babel-preset-expo/build/configs/expo.js). Manuel satır
      // bırakılırsa eklenti iki kez çalışır ve teşhisi zor worklet hataları
      // çıkar. Kapatmak gerekirse preset'e `worklets: false` verilir.
      // (reanimated 4.5'te "react-native-reanimated/plugin" zaten yalnızca
      //  "react-native-worklets/plugin"i yeniden dışa aktaran bir kabuk.)
    ],
    // Release bundle'da console.* çağrılarını kaldır (Metro, dev=false iken
    // BABEL_ENV=production ayarlar). error/warn bilerek hariç: Sentry
    // breadcrumb'ları ve logcat'teki gerçek hata sinyali kaybolmasın.
    env: {
      production: {
        plugins: [["transform-remove-console", { exclude: ["error", "warn"] }]],
      },
    },
  };
};
