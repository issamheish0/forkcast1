// Stub: audit logging is not implemented in ForkCastApp
export function useAuditLog() {
  const noop = async (..._args: any[]) => {};
  return {
    logAction: noop,
    logOAuthLogin: noop,
    logLogin: noop,
    logLoginFailed: noop,
    logLogout: noop,
    logSignup: noop,
    logProfileUpdated: noop,
    logPasswordReset: noop,
  };
}
