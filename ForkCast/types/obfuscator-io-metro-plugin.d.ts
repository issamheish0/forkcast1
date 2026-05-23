declare module "obfuscator-io-metro-plugin" {
  import type { MetroConfig } from "metro-config";

  interface ObfuscatorOptions {
    compact?: boolean;
    sourceMap?: boolean;
    controlFlowFlattening?: boolean;
    controlFlowFlatteningThreshold?: number;
    numbersToExpressions?: boolean;
    simplify?: boolean;
    stringArrayShuffle?: boolean;
    splitStrings?: boolean;
    stringArrayThreshold?: number;
    [key: string]: any;
  }

  interface PluginOptions {
    runInDev?: boolean;
    logObfuscatedFiles?: boolean;
    filter?: (filename: string) => boolean;
    [key: string]: any;
  }

  function obfuscatorPlugin(
    obfuscatorOptions: ObfuscatorOptions,
    pluginOptions: PluginOptions,
  ): Partial<MetroConfig>;

  export = obfuscatorPlugin;
}
