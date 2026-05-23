// Stub: analytics tracking is not implemented in ForkCastApp
export function useAnalytics() {
  const noop = (..._args: any[]) => {};
  return {
    track: noop,
    identify: noop,
    trackImpression: noop,
    trackClick: noop,
    trackPageView: noop,
    trackEvent: noop,
    trackFavoriteAdded: noop,
    trackFavoriteRemoved: noop,
  };
}
