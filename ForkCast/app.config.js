require("dotenv").config();

const baseConfig = require("./app.json");

// OneSignal mode: "development" only for dev builds, "production" for everything else.
const isDevBuild = process.env.NODE_ENV === "development";
const onesignalMode = isDevBuild ? "development" : "production";

const plugins = (baseConfig.expo.plugins || [])
  // Remove analytics/tracking plugins not needed in ForkCast
  .filter((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return !["react-native-fbsdk-next", "airbridge-expo-sdk"].includes(name);
  })
  .map((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;

    if (name === "onesignal-expo-plugin") {
      const existingConfig = Array.isArray(plugin) ? plugin[1] : {};
      return [
        "onesignal-expo-plugin",
        {
          ...existingConfig,
          mode: onesignalMode,
        },
      ];
    }
    return plugin;
  });

/** @type {import('@expo/config-types').ExpoConfig} */
const config = {
  ...baseConfig.expo,
  android: {
    ...baseConfig.expo.android,
    config: {
      ...(baseConfig.expo.android?.config || {}),
      googleMaps: {
        apiKey:
          process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
          process.env.GOOGLE_MAPS_API_KEY ||
          "",
      },
    },
  },
  plugins,
  extra: {
    ...baseConfig.expo.extra,
    eas: {
      projectId: "92ca58ce-5eaa-4463-895e-1f25f00c4417",
    },
  },
};

module.exports = { expo: config };

