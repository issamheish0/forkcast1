import { useCallback, useEffect, useRef, useState } from "react";
import { InteractionManager, DeviceEventEmitter } from "react-native";
import * as Sentry from "@/lib/sentry-stub";

export interface PerformanceMetrics {
  renderTime: number;
  mountTime: number;
  updateCount: number;
  memoryUsage: number;
  firstPaint: number;
  interactionTime: number;
}

export interface PerformanceOptions {
  trackRenders?: boolean;
  trackMemory?: boolean;
  trackInteractions?: boolean;
  sampleRate?: number; // 0-1, defaults to 0.1 (10%)
  onMetric?: (metric: string, value: number) => void;
}

/**
 * Performance monitoring hook
 * Tracks render performance, memory usage, and user interactions
 */
export function usePerformanceMonitor(
  componentName: string,
  options: PerformanceOptions = {},
) {
  const {
    trackRenders = true,
    trackMemory = false,
    trackInteractions = true,
    sampleRate = 0.1,
    onMetric,
  } = options;

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    mountTime: 0,
    updateCount: 0,
    memoryUsage: 0,
    firstPaint: 0,
    interactionTime: 0,
  });

  // Refs for tracking
  const mountTimeRef = useRef<number>(0);
  const renderStartRef = useRef<number>(0);
  const updateCountRef = useRef<number>(0);
  const interactionStartRef = useRef<number>(0);
  const shouldSample = useRef<boolean>(Math.random() < sampleRate);

  // Track component mount time
  useEffect(() => {
    if (!shouldSample.current || !trackRenders) return;

    mountTimeRef.current = performance.now();

    return () => {
      const unmountTime = performance.now() - mountTimeRef.current;
      reportMetric("component_lifetime", unmountTime);
    };
  }, []);

  // Track render performance
  useEffect(() => {
    if (!shouldSample.current || !trackRenders) return;

    const renderTime = performance.now() - renderStartRef.current;
    updateCountRef.current++;

    setMetrics((prev) => ({
      ...prev,
      renderTime,
      updateCount: updateCountRef.current,
    }));

    if (updateCountRef.current === 1) {
      // First render
      reportMetric("first_render", renderTime);
    } else {
      reportMetric("render_time", renderTime);
    }
  });

  // Start tracking render time
  const trackRenderStart = useCallback(() => {
    if (shouldSample.current && trackRenders) {
      renderStartRef.current = performance.now();
    }
  }, [trackRenders]);

  // Track memory usage
  const trackMemoryUsage = useCallback(() => {
    if (!shouldSample.current || !trackMemory) return;

    // Note: Direct memory tracking is limited in React Native
    // This is a simplified approach
    if ((global as any).gc) {
      (global as any).gc();
    }

    // Estimate memory usage based on component updates and interactions
    const estimatedMemory = updateCountRef.current * 0.1; // Rough estimate

    setMetrics((prev) => ({
      ...prev,
      memoryUsage: estimatedMemory,
    }));

    reportMetric("memory_usage", estimatedMemory);
  }, [trackMemory]);

  // Track user interactions
  const trackInteractionStart = useCallback(() => {
    if (shouldSample.current && trackInteractions) {
      interactionStartRef.current = performance.now();
    }
  }, [trackInteractions]);

  const trackInteractionEnd = useCallback(
    (interactionType: string = "default") => {
      if (
        !shouldSample.current ||
        !trackInteractions ||
        !interactionStartRef.current
      )
        return;

      const interactionTime = performance.now() - interactionStartRef.current;

      setMetrics((prev) => ({
        ...prev,
        interactionTime,
      }));

      reportMetric(`interaction_${interactionType}`, interactionTime);
      interactionStartRef.current = 0;
    },
    [trackInteractions],
  );

  // Report metric to monitoring services
  const reportMetric = useCallback(
    (metricName: string, value: number) => {
      if (!shouldSample.current) return;

      // Call custom metric handler
      onMetric?.(metricName, value);

      // Report to Sentry
      Sentry.addBreadcrumb({
        message: `Performance: ${metricName}`,
        category: "performance",
        level: "info",
        data: {
          component: componentName,
          metric: metricName,
          value,
          timestamp: new Date().toISOString(),
        },
      });

      // Log performance warnings
      if (metricName === "render_time" && value > 16) {
        console.warn(
          `Slow render detected in ${componentName}: ${value.toFixed(2)}ms`,
        );
      }

      if (metricName.includes("interaction") && value > 100) {
        console.warn(
          `Slow interaction in ${componentName}: ${value.toFixed(2)}ms`,
        );
      }
    },
    [componentName, onMetric],
  );

  // Start render tracking when component renders
  trackRenderStart();

  return {
    metrics,
    trackInteractionStart,
    trackInteractionEnd,
    trackMemoryUsage,
    reportMetric,
  };
}

/**
 * Hook for optimizing heavy computations
 */
export function useOptimizedComputation<T>(
  computation: () => T,
  dependencies: any[],
  options: {
    deferMs?: number;
    priority?: "high" | "normal" | "low";
  } = {},
) {
  const { deferMs = 0, priority = "normal" } = options;
  const [result, setResult] = useState<T | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const computationRef = useRef<any>(null);

  useEffect(() => {
    if (computationRef.current) {
      clearTimeout(computationRef.current);
    }

    setIsComputing(true);

    const runComputation = () => {
      const startTime = performance.now();

      try {
        const computedResult = computation();
        setResult(computedResult);

        const endTime = performance.now();
        const duration = endTime - startTime;

        // Log slow computations
        if (duration > 50) {
          console.warn(`Slow computation detected: ${duration.toFixed(2)}ms`);
        }
      } catch (error) {
        console.error("Computation error:", error);
      } finally {
        setIsComputing(false);
      }
    };

    if (deferMs > 0) {
      computationRef.current = setTimeout(runComputation, deferMs);
    } else if (priority === "low") {
      // Use InteractionManager for low priority computations
      InteractionManager.runAfterInteractions(runComputation);
    } else {
      runComputation();
    }

    return () => {
      if (computationRef.current) {
        clearTimeout(computationRef.current);
      }
    };
  }, dependencies);

  return { result, isComputing };
}

/**
 * Hook for detecting performance bottlenecks
 */
export function usePerformanceProfiler(componentName: string) {
  const renderCountRef = useRef(0);
  const slowRendersRef = useRef(0);
  const lastRenderTimeRef = useRef(0);

  useEffect(() => {
    const renderStart = performance.now();

    return () => {
      const renderTime = performance.now() - renderStart;
      renderCountRef.current++;
      lastRenderTimeRef.current = renderTime;

      if (renderTime > 16) {
        // Slower than 60fps
        slowRendersRef.current++;
      }

      // Report performance issues
      if (renderCountRef.current % 100 === 0) {
        const slowRenderPercentage =
          (slowRendersRef.current / renderCountRef.current) * 100;

        if (slowRenderPercentage > 20) {
          console.warn(
            `Performance issue in ${componentName}: ${slowRenderPercentage.toFixed(1)}% slow renders`,
          );

          Sentry.addBreadcrumb({
            message: "Performance bottleneck detected",
            category: "performance",
            level: "warning",
            data: {
              component: componentName,
              slowRenderPercentage,
              totalRenders: renderCountRef.current,
              lastRenderTime: renderTime,
            },
          });
        }
      }
    };
  });

  return {
    renderCount: renderCountRef.current,
    slowRenders: slowRendersRef.current,
    lastRenderTime: lastRenderTimeRef.current,
  };
}

/**
 * Hook for lazy loading with performance tracking
 */
export function useLazyLoad<T>(
  loader: () => Promise<T>,
  options: {
    delay?: number;
    retries?: number;
    onLoad?: () => void;
    onError?: (error: Error) => void;
  } = {},
) {
  const { delay = 0, retries = 3, onLoad, onError } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const attemptRef = useRef(0);

  const load = useCallback(async () => {
    if (loading) return;

    setLoading(true);
    setError(null);
    const startTime = performance.now();

    try {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const result = await loader();
      setData(result);

      const loadTime = performance.now() - startTime;

      onLoad?.();
    } catch (err) {
      const error = err as Error;
      attemptRef.current++;

      if (attemptRef.current < retries) {
        // Exponential backoff
        const backoffDelay = Math.pow(2, attemptRef.current) * 1000;
        setTimeout(() => load(), backoffDelay);
      } else {
        setError(error);
        onError?.(error);
      }
    } finally {
      setLoading(false);
    }
  }, [loader, delay, retries, onLoad, onError, loading]);

  return { data, loading, error, load };
}

/**
 * Hook for batch processing to improve performance
 */
export function useBatchProcessor<T, R>(
  processor: (items: T[]) => R[],
  options: {
    batchSize?: number;
    delay?: number;
  } = {},
) {
  const { batchSize = 10, delay = 100 } = options;
  const [queue, setQueue] = useState<T[]>([]);
  const [results, setResults] = useState<R[]>([]);
  const [processing, setProcessing] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const addToQueue = useCallback((items: T[]) => {
    setQueue((prev) => [...prev, ...items]);
  }, []);

  useEffect(() => {
    if (queue.length === 0 || processing) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setProcessing(true);

      const batch = queue.slice(0, batchSize);
      const remaining = queue.slice(batchSize);

      try {
        const batchResults = processor(batch);
        setResults((prev) => [...prev, ...batchResults]);
        setQueue(remaining);
      } catch (error) {
        console.error("Batch processing error:", error);
      } finally {
        setProcessing(false);
      }
    }, delay) as unknown as number;

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [queue, processing, processor, batchSize, delay]);

  return { addToQueue, results, processing, queueLength: queue.length };
}
