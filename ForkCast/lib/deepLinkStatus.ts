// Stub: Deep link status tracking - not implemented in ForkCastApp
export function getDeepLinkStatusSnapshot() {
  return { isProcessing: false, lastHandledUrl: null, activePath: null as string | null };
}
export function markDeepLinkInitialUrl(_url: string | null) {}
export function markDeepLinkAttempt(_url: string) {}
export function markDeepLinkSuccess(_url: string, _path?: string) {}
export function markDeepLinkFailure(_url: string, _reason?: string) {}
export function markDeepLinkIdle() {}
export function resetDeepLinkStatus() {}

export const deepLinkStatus = {
  setProcessing: (_isProcessing: boolean) => {},
  getIsProcessing: () => false,
  markHandled: (_url: string) => {},
  wasHandled: (_url: string) => false,
};
