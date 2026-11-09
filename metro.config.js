const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const rootPrefix = escapeRegExp(__dirname);
const nonAppDirs =
  "(?:\\.claude|\\.codex|\\.agent|\\.agents|functions|website|load-test|dist)";

const existingBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : config.resolver.blockList
    ? [config.resolver.blockList]
    : [];

// Kök dizin altındaki git worktree'leri (.claude/worktrees), Cloud Functions
// (functions/node_modules) ve yardımcı klasörler Windows fs.watch arabelleğini
// taşırıp Metro'nun bellek içi dosya haritasını (Haste/TreeFS) bozmasın.
config.resolver.blockList = [
  ...existingBlockList,
  new RegExp(`^${rootPrefix}[\\\\/]${nonAppDirs}(?:[\\\\/]|$)`),
  new RegExp(`^${nonAppDirs}(?:[\\\\/]|$)`),
];

module.exports = config;
