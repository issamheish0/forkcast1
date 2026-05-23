import { useCallback, useEffect, useState } from "react";
import {
  AccessibilityInfo,
  useColorScheme,
  PixelRatio,
  AppState,
} from "react-native";
import { useAsyncStorage } from "@react-native-async-storage/async-storage";

export interface AccessibilityOptions {
  /**
   * Generate accessibility label with context
   */
  label: (text: string, context?: string) => string;

  /**
   * Generate accessibility hint for complex interactions
   */
  hint: (action: string, result?: string) => string;

  /**
   * Generate role-based accessibility props
   */
  role: (
    role: AccessibilityRole,
    options?: AccessibilityRoleOptions,
  ) => AccessibilityProps;

  /**
   * Generate state-based accessibility props
   */
  state: (state: AccessibilityState) => AccessibilityProps;

  /**
   * Generate navigation accessibility props
   */
  navigation: (type: NavigationType) => AccessibilityProps;
}

export interface AccessibilityRoleOptions {
  label?: string;
  hint?: string;
  disabled?: boolean;
  selected?: boolean;
  expanded?: boolean;
}

export interface AccessibilityState {
  loading?: boolean;
  error?: boolean;
  success?: boolean;
  disabled?: boolean;
  selected?: boolean;
  expanded?: boolean;
  busy?: boolean;
}

export interface AccessibilityProps {
  accessible?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: any;
  accessibilityActions?: any[];
  accessibilityLiveRegion?: "none" | "polite" | "assertive";
  importantForAccessibility?: "auto" | "yes" | "no" | "no-hide-descendants";
}

type AccessibilityRole =
  | "button"
  | "link"
  | "text"
  | "image"
  | "imagebutton"
  | "header"
  | "search"
  | "tab"
  | "tablist"
  | "menu"
  | "menuitem"
  | "menubar"
  | "switch"
  | "checkbox"
  | "radio";

type NavigationType =
  | "header"
  | "footer"
  | "main"
  | "navigation"
  | "search"
  | "list"
  | "listitem";

export function useAccessibility(): AccessibilityOptions & {
  isScreenReaderEnabled: boolean;
  isReduceMotionEnabled: boolean;
  isHighContrastEnabled: boolean;
  fontScale: number;
  announceMessage: (message: string, priority?: "low" | "high") => void;
  toggleHighContrast: () => void;
} {
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  const [isReduceMotionEnabled, setIsReduceMotionEnabled] = useState(false);
  const [isHighContrastEnabled, setIsHighContrastEnabled] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const colorScheme = useColorScheme();
  const { getItem: getHighContrast, setItem: setHighContrast } =
    useAsyncStorage("highContrast");

  // Initialize accessibility settings
  useEffect(() => {
    const initializeAccessibility = async () => {
      try {
        // Check screen reader
        const screenReaderEnabled =
          await AccessibilityInfo.isScreenReaderEnabled();
        setIsScreenReaderEnabled(screenReaderEnabled);

        // Check reduce motion
        const reduceMotionEnabled =
          await AccessibilityInfo.isReduceMotionEnabled();
        setIsReduceMotionEnabled(reduceMotionEnabled);

        // Get font scale using PixelRatio API
        const scale = PixelRatio.getFontScale();
        setFontScale(scale);

        // Check high contrast setting
        const highContrastSetting = await getHighContrast();
        setIsHighContrastEnabled(highContrastSetting === "true");
      } catch (error) {
        console.error("Failed to initialize accessibility settings:", error);
      }
    };

    initializeAccessibility();

    // Listen for accessibility changes
    const screenReaderSubscription = AccessibilityInfo.addEventListener(
      "screenReaderChanged",
      setIsScreenReaderEnabled,
    );

    const reduceMotionSubscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setIsReduceMotionEnabled,
    );

    // Listen for app state changes to update font scale
    // Font scale changes are detected when the app becomes active
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === "active") {
        const newScale = PixelRatio.getFontScale();
        setFontScale((prevScale) => {
          if (newScale !== prevScale) {
            return newScale;
          }
          return prevScale;
        });
      }
    };

    const appStateSubscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      screenReaderSubscription?.remove();
      reduceMotionSubscription?.remove();
      appStateSubscription?.remove();
    };
  }, [getHighContrast]);

  /**
   * Generate accessibility label with context
   */
  const label = useCallback((text: string, context?: string): string => {
    if (context) {
      return `${text}, ${context}`;
    }
    return text;
  }, []);

  /**
   * Generate accessibility hint for complex interactions
   */
  const hint = useCallback((action: string, result?: string): string => {
    if (result) {
      return `${action}. ${result}`;
    }
    return action;
  }, []);

  /**
   * Generate role-based accessibility props
   */
  const role = useCallback(
    (
      roleType: AccessibilityRole,
      options: AccessibilityRoleOptions = {},
    ): AccessibilityProps => {
      const props: AccessibilityProps = {
        accessible: true,
        accessibilityRole: roleType,
      };

      if (options.label) {
        props.accessibilityLabel = options.label;
      }

      if (options.hint) {
        props.accessibilityHint = options.hint;
      }

      if (
        options.disabled !== undefined ||
        options.selected !== undefined ||
        options.expanded !== undefined
      ) {
        props.accessibilityState = {
          disabled: options.disabled,
          selected: options.selected,
          expanded: options.expanded,
        };
      }

      return props;
    },
    [],
  );

  /**
   * Generate state-based accessibility props
   */
  const state = useCallback(
    (accessibilityState: AccessibilityState): AccessibilityProps => {
      const props: AccessibilityProps = {
        accessible: true,
        accessibilityState,
      };

      // Add live region for dynamic content
      if (
        accessibilityState.loading ||
        accessibilityState.error ||
        accessibilityState.success
      ) {
        props.accessibilityLiveRegion = "polite";
      }

      // Add announcements for state changes
      if (accessibilityState.error) {
        props.accessibilityLabel = "Error occurred";
      } else if (accessibilityState.success) {
        props.accessibilityLabel = "Action completed successfully";
      } else if (accessibilityState.loading || accessibilityState.busy) {
        props.accessibilityLabel = "Loading";
      }

      return props;
    },
    [],
  );

  /**
   * Generate navigation accessibility props
   */
  const navigation = useCallback((type: NavigationType): AccessibilityProps => {
    const props: AccessibilityProps = {
      accessible: true,
    };

    switch (type) {
      case "header":
        props.accessibilityRole = "header";
        props.accessibilityLabel = "Page header";
        break;
      case "footer":
        props.accessibilityLabel = "Page footer";
        break;
      case "main":
        props.accessibilityLabel = "Main content";
        props.importantForAccessibility = "yes";
        break;
      case "navigation":
        props.accessibilityLabel = "Navigation menu";
        break;
      case "search":
        props.accessibilityRole = "search";
        props.accessibilityLabel = "Search";
        break;
      case "list":
        props.accessibilityLabel = "List";
        break;
      case "listitem":
        props.accessibilityLabel = "List item";
        break;
    }

    return props;
  }, []);

  /**
   * Announce message to screen reader
   */
  const announceMessage = useCallback(
    (message: string, priority: "low" | "high" = "low") => {
      if (isScreenReaderEnabled) {
        AccessibilityInfo.announceForAccessibility(message);
      }
    },
    [isScreenReaderEnabled],
  );

  /**
   * Toggle high contrast mode
   */
  const toggleHighContrast = useCallback(async () => {
    const newValue = !isHighContrastEnabled;
    setIsHighContrastEnabled(newValue);
    await setHighContrast(newValue.toString());
    announceMessage(
      newValue ? "High contrast mode enabled" : "High contrast mode disabled",
    );
  }, [isHighContrastEnabled, setHighContrast, announceMessage]);

  return {
    // Accessibility utilities
    label,
    hint,
    role,
    state,
    navigation,

    // Settings
    isScreenReaderEnabled,
    isReduceMotionEnabled,
    isHighContrastEnabled,
    fontScale,

    // Actions
    announceMessage,
    toggleHighContrast,
  };
}

/**
 * Hook for form accessibility
 */
export function useFormAccessibility() {
  const accessibility = useAccessibility();

  const getFieldProps = useCallback(
    (
      label: string,
      options: {
        required?: boolean;
        error?: string;
        description?: string;
        value?: string;
      } = {},
    ): AccessibilityProps => {
      let accessibilityLabel = label;
      let accessibilityHint = "";

      if (options.required) {
        accessibilityLabel += ", required";
      }

      if (options.description) {
        accessibilityHint = options.description;
      }

      if (options.error) {
        accessibilityLabel += ", error";
        accessibilityHint = options.error;
      }

      if (options.value) {
        accessibilityLabel += `, current value: ${options.value}`;
      }

      return {
        accessible: true,
        accessibilityLabel,
        accessibilityHint: accessibilityHint || undefined,
        accessibilityState: {
          disabled: false,
        },
      };
    },
    [],
  );

  const getErrorProps = useCallback((error: string): AccessibilityProps => {
    return {
      accessible: true,
      accessibilityLabel: `Error: ${error}`,
      accessibilityLiveRegion: "assertive",
      importantForAccessibility: "yes",
    };
  }, []);

  return {
    ...accessibility,
    getFieldProps,
    getErrorProps,
  };
}

/**
 * Hook for button accessibility
 */
export function useButtonAccessibility() {
  const accessibility = useAccessibility();

  const getButtonProps = useCallback(
    (
      label: string,
      options: {
        loading?: boolean;
        disabled?: boolean;
        destructive?: boolean;
        hint?: string;
      } = {},
    ): AccessibilityProps => {
      let accessibilityLabel = label;
      let accessibilityHint = options.hint;

      if (options.loading) {
        accessibilityLabel = `${label}, loading`;
      }

      if (options.destructive) {
        accessibilityHint =
          `Warning: This action cannot be undone. ${accessibilityHint || ""}`.trim();
      }

      return {
        accessible: true,
        accessibilityRole: "button",
        accessibilityLabel,
        accessibilityHint: accessibilityHint || undefined,
        accessibilityState: {
          disabled: options.disabled || options.loading,
          busy: options.loading,
        },
      };
    },
    [],
  );

  return {
    ...accessibility,
    getButtonProps,
  };
}
