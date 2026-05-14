const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const { FileStore } = require("metro-cache");

const config = getDefaultConfig(__dirname);

// ✅ Support pnpm symlinks
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(__dirname, "../../node_modules"),
];

// ✅ Forcer Metro à suivre les liens symboliques pnpm
config.resolver.unstable_enableSymlinks = true;

// ✅ Eviter les conflits de cache
config.cacheStores = [
  new FileStore({ root: path.join(__dirname, ".metro-cache") }),
];

// ✅ Watchman — désactiver sur Replit (pas supporté)
config.watchFolders = [
  path.resolve(__dirname),
  path.resolve(__dirname, "../.."),
];

module.exports = config;
