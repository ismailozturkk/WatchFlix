module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
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
  };
};
