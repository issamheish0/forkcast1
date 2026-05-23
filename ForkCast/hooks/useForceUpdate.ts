// hooks/useForceUpdate.ts â€” MOCK STUB (no network calls)
import * as Application from "expo-application";

type UpdateMode = "soft" | "hard";

interface ForceUpdateConfig {
  minimumVersion: string;
  suggestedVersion: string;
  forceUpdateEnabled: boolean;
  updateMode: UpdateMode;
  currentVersion: string;
  needsHardUpdate: boolean;
  needsSoftUpdate: boolean;
  isLoading: boolean;
}

export function useForceUpdate(): ForceUpdateConfig {
  return {
    minimumVersion: "",
    suggestedVersion: "",
    forceUpdateEnabled: false,
    updateMode: "soft",
    currentVersion: Application.nativeApplicationVersion || "0.0.0",
    needsHardUpdate: false,
    needsSoftUpdate: false,
    isLoading: false,
  };
}
