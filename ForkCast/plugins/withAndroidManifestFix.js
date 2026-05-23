const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Resolves manifest merger conflict between expo-secure-store and airbridge-expo-sdk
 * (io.airbridge:sdk-android).
 *
 * Both declare android:dataExtractionRules and android:fullBackupContent on <application>.
 * This plugin adds tools:replace so the main app manifest wins during Gradle's merger.
 *
 * MUST be listed AFTER expo-secure-store in the plugins array so that
 * expo-secure-store has already set the attributes before we add tools:replace.
 */
module.exports = function withAndroidManifestFix(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Ensure xmlns:tools namespace is declared on <manifest>
    if (!manifest.$["xmlns:tools"]) {
      manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    }

    const application = manifest.application[0];

    // No space after comma — some AGP versions choke on spaces
    const attrsToReplace =
      "android:dataExtractionRules,android:fullBackupContent";

    // Merge with any existing tools:replace value
    const existing = application.$["tools:replace"] || "";
    if (!existing.includes("android:dataExtractionRules")) {
      application.$["tools:replace"] = existing
        ? `${existing},${attrsToReplace}`
        : attrsToReplace;
    }

    return config;
  });
};
