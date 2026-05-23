// lib/envValidation.ts
interface EnvironmentConfig {
  EXPO_PUBLIC_SUPABASE_URL: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
}

/**
 * Validates and logs environment variables for debugging production issues
 */
export function validateEnvironment(): EnvironmentConfig {
  const config = {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  };

  // Check for common issues
  if (
    config.EXPO_PUBLIC_SUPABASE_URL &&
    !config.EXPO_PUBLIC_SUPABASE_URL.startsWith("https://")
  ) {
    console.warn("⚠️ Supabase URL should start with https://");
  }

  if (
    config.EXPO_PUBLIC_SUPABASE_ANON_KEY &&
    config.EXPO_PUBLIC_SUPABASE_ANON_KEY.length < 100
  ) {
    console.warn("⚠️ Supabase anon key seems too short");
  }

  const missingVars = Object.entries(config)
    .filter(([_, value]) => !value)
    .map(([key, _]) => key);

  if (missingVars.length > 0) {
    const errorMessage = `Missing required environment variables: ${missingVars.join(", ")}`;
    console.error("❌ Environment validation failed:", errorMessage);
    throw new Error(errorMessage);
  }

  return config as EnvironmentConfig;
}

/**
 * Safe environment getter with fallbacks
 */
export function getEnvironmentVariable(
  key: keyof EnvironmentConfig,
  fallback?: string,
): string {
  const value = process.env[key];

  if (!value) {
    if (fallback) {
      console.warn(`Using fallback for ${key}`);
      return fallback;
    }
    throw new Error(`Environment variable ${key} is required but not set`);
  }

  return value;
}
