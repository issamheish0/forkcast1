const { withNativeWind } = require("nativewind/metro");
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Enhanced Supabase resolver workaround
config.resolver = {
  ...config.resolver,
  unstable_conditionNames: ["browser"],
  unstable_enablePackageExports: false,
  extraNodeModules: {
    "@": path.resolve(__dirname, "."),
  },
  alias: {
    ...config.resolver?.alias,
    // Add crypto polyfill if needed
    crypto: require.resolve("expo-crypto"),
  },
};

// Apply NativeWind
const nativeWindConfig = withNativeWind(config, { input: "./global.css" });

module.exports = {
  ...nativeWindConfig,
  transformer: {
    ...nativeWindConfig.transformer,
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: false,
      },
    }),
  },
};
