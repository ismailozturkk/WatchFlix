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
      "react-native-reanimated/plugin", // En sonda olmalı!
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
