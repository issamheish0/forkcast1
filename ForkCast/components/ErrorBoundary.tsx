// components/ErrorBoundary.tsx
import React, { Component, PropsWithChildren } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  Share,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Button } from "@/components/ui/button";
import { H2, P, Muted } from "@/components/ui/typography";
import { SafeAreaView } from "@/components/safe-area-view";
import { AlertTriangle, RefreshCw, Bug } from "lucide-react-native";
import * as Sentry from "@/lib/sentry-stub";

type Props = PropsWithChildren<{
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  isolate?: boolean; // Whether this boundary should isolate errors from parent boundaries
  showDetails?: boolean; // Whether to show technical error details
}>;

type State = {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorId: string | null;
};

interface ErrorFallbackProps {
  error: Error;
  errorInfo: React.ErrorInfo;
  resetError: () => void;
  reportError: () => void;
}

export class ErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error);
    console.error("Error info:", errorInfo);

    // Generate unique error ID for tracking
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.setState({ errorInfo, errorId });

    // Report to Sentry with enhanced context
    Sentry.withScope((scope) => {
      scope.setTag("errorBoundary", true);
      scope.setTag("retryCount", this.retryCount);
      scope.setContext("errorInfo", {
        componentStack: errorInfo.componentStack,
        errorBoundary: this.constructor.name,
      });
      scope.setLevel("error");
      Sentry.captureException(error);
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.retryCount++;

    if (this.retryCount > this.maxRetries) {
      Alert.alert(
        "Multiple Errors Detected",
        "This component has crashed multiple times. Please restart the app or contact support.",
        [
          { text: "Contact Support", onPress: this.handleReportError },
          {
            text: "Restart App",
            onPress: () => {
              this.setState({
                hasError: false,
                error: null,
                errorInfo: null,
                errorId: null,
              });
              this.retryCount = 0;
            },
          },
        ],
      );
      return;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  handleReportError = async () => {
    const { error, errorInfo, errorId } = this.state;

    if (!error) return;

    const errorReport = `
Error ID: ${errorId}
Error: ${error.message}
Stack: ${error.stack}
Component Stack: ${errorInfo?.componentStack}
Time: ${new Date().toISOString()}
User Agent: ${navigator.userAgent || "Unknown"}
    `.trim();

    try {
      await Share.share({
        message: `Bug Report\n\n${errorReport}`,
        title: "Bug Report",
      });
    } catch (shareError) {
      console.error("Failed to share error report:", shareError);
      Alert.alert(
        "Report Error",
        "Please contact support with the following error ID: " + errorId,
        [{ text: "OK" }],
      );
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent
            error={this.state.error!}
            errorInfo={this.state.errorInfo!}
            resetError={this.handleReset}
            reportError={this.handleReportError}
          />
        );
      }

      return (
        <SafeAreaView className="flex-1 bg-background">
          <ScrollView contentContainerStyle={{ flex: 1 }} className="p-6">
            <View className="flex-1 justify-center items-center">
              {/* Error Icon */}
              <View className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full items-center justify-center mb-6">
                <AlertTriangle size={40} color="#EF4444" />
              </View>

              {/* Error Title */}
              <H2 className="text-center mb-3 text-foreground">
                Oops! Something went wrong
              </H2>

              {/* Error Description */}
              <P className="text-center text-muted-foreground mb-6 max-w-sm">
                We're sorry for the inconvenience. The app encountered an
                unexpected error.
              </P>

              {/* Error ID for support */}
              {this.state.errorId && (
                <View className="bg-muted/50 rounded-lg p-3 mb-6 w-full max-w-sm">
                  <Muted className="text-center text-xs">
                    Error ID: {this.state.errorId}
                  </Muted>
                </View>
              )}

              {/* Technical Details (if enabled) */}
              {this.props.showDetails && this.state.error && (
                <View className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 w-full max-w-md">
                  <Text className="text-red-800 dark:text-red-200 text-sm font-mono">
                    {this.state.error.message}
                  </Text>
                </View>
              )}

              {/* Action Buttons */}
              <View className="w-full max-w-sm space-y-3">
                <Button
                  onPress={this.handleReset}
                  className="w-full"
                  disabled={this.retryCount >= this.maxRetries}
                >
                  <RefreshCw size={16} color="white" />
                  <Text className="text-white ml-2">
                    {this.retryCount >= this.maxRetries
                      ? "Too Many Retries"
                      : "Try Again"}
                  </Text>
                </Button>

                <Button
                  variant="outline"
                  onPress={this.handleReportError}
                  className="w-full"
                >
                  <Bug size={16} color="#666" />
                  <Text className="text-foreground ml-2">Report Bug</Text>
                </Button>
              </View>

              {/* Retry Counter */}
              {this.retryCount > 0 && (
                <Muted className="mt-4 text-center">
                  Retry attempts: {this.retryCount}/{this.maxRetries}
                </Muted>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

// Specialized error boundaries for different app sections
export class NavigationErrorBoundary extends Component<
  PropsWithChildren,
  State
> {
  private navigationTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: PropsWithChildren) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Navigation Error:", error);

    // Always auto-recover - platform-specific timing for best experience
    const recoveryDelay = Platform.OS === "android" ? 2000 : 1000;

    this.navigationTimer = setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null,
      });
    }, recoveryDelay);

    // Still log to Sentry for debugging, but don't show error to user
    Sentry.withScope((scope) => {
      scope.setTag("errorType", "navigation");
      scope.setTag("autoRecovered", true);
      scope.setLevel("warning"); // Downgrade to warning since we auto-recover
      scope.setContext("errorInfo", {
        componentStack: errorInfo.componentStack,
        errorMessage: error.message,
        errorStack: error.stack,
      });
      Sentry.captureException(error);
    });
  }

  componentWillUnmount() {
    if (this.navigationTimer) {
      clearTimeout(this.navigationTimer);
    }
  }

  render() {
    if (this.state.hasError) {
      // NEVER show navigation errors to users - always show loading screen
      // This provides a smooth user experience and auto-recovery
      return (
        <View className="flex-1 justify-center items-center p-4 bg-background">
          <ActivityIndicator size="large" color="#792339" />
          <H2 className="text-center mt-4 mb-2">
            {Platform.OS === "android" ? "Processing..." : "Loading..."}
          </H2>
          <P className="text-center text-muted-foreground">
            {Platform.OS === "android"
              ? "Please wait, this may take a moment..."
              : "Just a moment..."}
          </P>
        </View>
      );
    }

    return this.props.children;
  }
}

export class DataErrorBoundary extends Component<PropsWithChildren, State> {
  constructor(props: PropsWithChildren) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Data Error:", error);
    Sentry.withScope((scope) => {
      scope.setTag("errorType", "data");
      Sentry.captureException(error);
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View className="p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <P className="text-yellow-800 dark:text-yellow-200 text-center">
            Failed to load data. Please try refreshing.
          </P>
          <Button
            variant="outline"
            onPress={() => this.setState({ hasError: false, error: null })}
            className="mt-2"
          >
            <Text>Retry</Text>
          </Button>
        </View>
      );
    }

    return this.props.children;
  }
}
