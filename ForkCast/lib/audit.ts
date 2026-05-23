// Stub: audit logging — not implemented in ForkCastApp
export async function logAuditEvent(_action: string, _data?: any): Promise<void> {}

export const audit = {
  log: logAuditEvent,
  logSignup: (_data?: any) => {},
  logLogin: (_data?: any) => {},
  logLoginFailed: (_data?: any) => {},
  logLogout: (_userId?: string) => {},
  logOAuthLogin: (_data?: any) => {},
  logPasswordReset: (_data?: any) => {},
  logPasswordResetRequest: (_data?: any) => {},
  logPasswordResetComplete: (_data?: any) => {},
  logProfileUpdate: (_data?: any) => {},
  logProfileUpdated: (_data?: any) => {},
};

// Named alias for backward compatibility
export const auditLogger = audit;
