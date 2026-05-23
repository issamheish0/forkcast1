// Sentry stub — not implemented in ForkCastApp
export const init = (_options: any) => {};
export const captureException = (_error: any, _options?: any) => {};
export const captureMessage = (_message: string) => {};
export const withScope = (callback: (scope: any) => void) => {
  callback({
    setTag: () => {},
    setLevel: () => {},
    setContext: () => {},
    setUser: () => {},
    setExtra: () => {},
  });
};
export const wrap = <T extends (...args: any[]) => any>(fn: T): T => fn;
export const setUser = (_user: any) => {};
export const setTag = (_key: string, _value: string) => {};
export const addBreadcrumb = (_breadcrumb: any) => {};

// Module declaration for @sentry/react-native
// This stub satisfies imports in ErrorBoundary, useErrorHandler, usePerformanceMonitor
export default {
  init,
  captureException,
  captureMessage,
  withScope,
  wrap,
  setUser,
  setTag,
  addBreadcrumb,
};
