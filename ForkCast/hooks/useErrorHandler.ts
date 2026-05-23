import { useCallback, useState } from "react";
import { Alert } from "react-native";
import * as Sentry from "@/lib/sentry-stub";

export interface ErrorHandlerOptions {
  showAlert?: boolean;
  customMessage?: string;
  logToConsole?: boolean;
  sendToSentry?: boolean;
  retryable?: boolean;
  onRetry?: () => void;
}

export interface ErrorState {
  error: Error | null;
  isError: boolean;
  errorMessage: string | null;
  canRetry: boolean;
}

/**
 * Comprehensive error handling hook
 * Provides standardized error handling, logging, and user feedback
 */
export function useErrorHandler(defaultOptions: ErrorHandlerOptions = {}) {
  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    isError: false,
    errorMessage: null,
    canRetry: false,
  });

  const defaultConfig: Required<ErrorHandlerOptions> = {
    showAlert: true,
    customMessage: "",
    logToConsole: true,
    sendToSentry: !__DEV__,
    retryable: false,
    onRetry: () => {},
    ...defaultOptions,
  };

  /**
   * Handle errors with various options
   */
  const handleError = useCallback(
    (error: Error | string, options: ErrorHandlerOptions = {}) => {
      const config = { ...defaultConfig, ...options };
      const errorObj = typeof error === "string" ? new Error(error) : error;
      const userMessage =
        config.customMessage || getUserFriendlyMessage(errorObj);

      // Update error state
      setErrorState({
        error: errorObj,
        isError: true,
        errorMessage: userMessage,
        canRetry: config.retryable,
      });

      // Log to console
      if (config.logToConsole) {
        console.error("Error handled:", errorObj.message);
        console.error("Stack:", errorObj.stack);
      }

      // Send to Sentry
      if (config.sendToSentry) {
        Sentry.withScope((scope) => {
          scope.setTag("source", "useErrorHandler");
          scope.setLevel("error");
          scope.setContext("errorDetails", {
            message: errorObj.message,
            userMessage,
            retryable: config.retryable,
          });
          Sentry.captureException(errorObj);
        });
      }

      // Show user alert
      if (config.showAlert) {
        const alertButtons = [{ text: "OK", style: "default" as const }];

        if (config.retryable && config.onRetry) {
          // Add retry button with proper typing
          const retryButton = {
            text: "Retry",
            onPress: () => {
              clearError();
              config.onRetry!();
            },
          };
          alertButtons.unshift(retryButton as any);
        }

        Alert.alert("Error", userMessage, alertButtons);
      }
    },
    [defaultConfig],
  );

  /**
   * Handle async operations with automatic error handling
   */
  const handleAsync = useCallback(
    async <T>(
      operation: () => Promise<T>,
      options: ErrorHandlerOptions = {},
    ): Promise<T | null> => {
      try {
        clearError();
        return await operation();
      } catch (error) {
        handleError(error as Error, options);
        return null;
      }
    },
    [handleError],
  );

  /**
   * Handle network errors specifically
   */
  const handleNetworkError = useCallback(
    (error: Error, options: ErrorHandlerOptions = {}) => {
      const networkOptions: ErrorHandlerOptions = {
        customMessage:
          "Network error. Please check your connection and try again.",
        retryable: true,
        ...options,
      };

      handleError(error, networkOptions);
    },
    [handleError],
  );

  /**
   * Handle validation errors
   */
  const handleValidationError = useCallback(
    (error: Error | string, options: ErrorHandlerOptions = {}) => {
      const validationOptions: ErrorHandlerOptions = {
        showAlert: true,
        sendToSentry: false, // Don't send validation errors to Sentry
        ...options,
      };

      handleError(error, validationOptions);
    },
    [handleError],
  );

  /**
   * Handle critical errors that should crash the app
   */
  const handleCriticalError = useCallback(
    (error: Error, options: ErrorHandlerOptions = {}) => {
      const criticalOptions: ErrorHandlerOptions = {
        customMessage: "A critical error occurred. The app needs to restart.",
        sendToSentry: true,
        retryable: false,
        ...options,
      };

      // Add critical tag to Sentry
      Sentry.withScope((scope) => {
        scope.setTag("critical", true);
        scope.setLevel("fatal");
        Sentry.captureException(error);
      });

      handleError(error, criticalOptions);
    },
    [handleError],
  );

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      isError: false,
      errorMessage: null,
      canRetry: false,
    });
  }, []);

  /**
   * Retry the last operation
   */
  const retry = useCallback(() => {
    if (errorState.canRetry && defaultConfig.onRetry) {
      clearError();
      defaultConfig.onRetry();
    }
  }, [errorState.canRetry, defaultConfig.onRetry, clearError]);

  return {
    // Error state
    ...errorState,

    // Error handlers
    handleError,
    handleAsync,
    handleNetworkError,
    handleValidationError,
    handleCriticalError,

    // Actions
    clearError,
    retry,

    // Utilities
    isNetworkError: (error: Error) => isNetworkError(error),
    isValidationError: (error: Error) => isValidationError(error),
  };
}

/**
 * Convert technical errors to user-friendly messages
 */
function getUserFriendlyMessage(error: Error): string {
  const message = error.message.toLowerCase();

  // Network errors
  if (isNetworkError(error)) {
    return "Network error. Please check your connection and try again.";
  }

  // Authentication errors
  if (message.includes("unauthorized") || message.includes("401")) {
    return "Please sign in again to continue.";
  }

  if (message.includes("forbidden") || message.includes("403")) {
    return "You don't have permission to perform this action.";
  }

  // Validation errors
  if (isValidationError(error)) {
    return error.message; // Validation messages are usually user-friendly
  }

  // Database errors
  if (message.includes("database") || message.includes("sql")) {
    return "A database error occurred. Please try again later.";
  }

  // Timeout errors
  if (message.includes("timeout") || message.includes("timed out")) {
    return "The request timed out. Please try again.";
  }

  // Generic server errors
  if (message.includes("500") || message.includes("server error")) {
    return "A server error occurred. Please try again later.";
  }

  // Default fallback
  return "An unexpected error occurred. Please try again.";
}

/**
 * Check if error is a network error
 */
function isNetworkError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("connection") ||
    message.includes("internet") ||
    message.includes("offline") ||
    error.name === "NetworkError"
  );
}

/**
 * Check if error is a validation error
 */
function isValidationError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes("validation") ||
    message.includes("invalid") ||
    message.includes("required") ||
    message.includes("must be") ||
    error.name === "ValidationError" ||
    error.name === "ZodError"
  );
}

/**
 * Hook for handling API errors specifically
 */
export function useApiErrorHandler() {
  const { handleError } = useErrorHandler({
    showAlert: true,
    sendToSentry: true,
    logToConsole: true,
  });

  const handleApiError = useCallback(
    (error: any, endpoint?: string) => {
      // Add API context to error
      if (endpoint) {
        Sentry.withScope((scope) => {
          scope.setTag("api_endpoint", endpoint);
          scope.setContext("api_error", {
            endpoint,
            status: error.status,
            statusText: error.statusText,
          });
          handleError(error);
        });
      } else {
        handleError(error);
      }
    },
    [handleError],
  );

  return { handleApiError };
}

/**
 * Hook for handling form errors
 */
export function useFormErrorHandler() {
  const { handleError } = useErrorHandler({
    showAlert: true,
    sendToSentry: false, // Forms errors are usually user errors
    logToConsole: __DEV__,
  });

  const handleFormError = useCallback(
    (error: Error | string, field?: string) => {
      const errorObj = typeof error === "string" ? new Error(error) : error;

      if (field) {
      }

      handleError(errorObj);
    },
    [handleError],
  );

  return { handleFormError };
}
