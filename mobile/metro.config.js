const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Reduce open file handles — prevents EMFILE on Windows
config.watchFolders = [__dirname];
config.resolver.blockList = [
  /node_modules\/.*/,          // let Metro use its own node_modules cache
];
// Only watch source folders, not the entire drive
config.watcher = {
  ...config.watcher,
  watchman: { deferStates: ["hg.update"] },
};

module.exports = withNativeWind(config, { input: "./global.css" });
