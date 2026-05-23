// Stub: Deep link utilities - not implemented in ForkCastApp
export type DeepLinkRoute = { protected?: boolean; screen?: string; [key: string]: any } | string;
export const DEEP_LINK_ROUTES: DeepLinkRoute[] = [];

export function parseDeepLink(_url: string): { screen?: string; params?: Record<string, string>; route?: DeepLinkRoute; path?: string } {
  return {};
}
export const parseDeepLinkUrl = parseDeepLink;

export function navigateToDeepLink(_route: DeepLinkRoute, _params?: Record<string, any>): boolean {
  return false;
}
export function isSupportedDeepLink(_url: string): boolean {
  return false;
}
export function buildDeepLink(_screen: string, _params?: Record<string, string>): string {
  return '';
}
export type DeepLinkConfig = { screen: string; params?: Record<string, any> };

export function generateDeepLink(_path: string, _scheme?: string): string {
  return '';
}
export function generateUniversalLink(_path: string, _domain?: string): string {
  return '';
}
