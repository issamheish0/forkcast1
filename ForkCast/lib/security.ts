// Stub: security utilities — not implemented in ForkCastApp
export function sanitizeInput(input: string): string {
  return input;
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function hashValue(_value: string): string {
  return _value;
}

export const SecurityMonitor = {
  log: (_event: string, _data?: any) => {},
  logAuthAttempt: (_data?: any) => {},
  logSuspiciousActivity: (_data?: any) => {},
  monitorSuspiciousActivity: (_data?: any) => {},
  checkUserSuspiciousFlags: async (_userId: string) => ({ suspicious: false, isFlagged: false, riskLevel: 'low' as string }),
};

export const RateLimiter = {
  check: (_key: string) => ({ allowed: true, remaining: 10 }),
  reset: (_key: string) => {},
  checkActionRateLimit: (_key: string, _actionOrMax?: string | number) => ({ allowed: true, remaining: 10 }),
};

export const DeviceSecurity = {
  isJailbroken: () => false,
  isEmulator: () => false,
  checkDeviceAccountLimit: async (_userId?: string) => ({ withinLimit: true }),
  registerDeviceForUser: async (_userId: string) => {},
};

export function withSecurityMiddleware<T extends (...args: any[]) => any>(fn: T, _options?: any): T {
  return fn;
}

export const InputValidator = {
  validate: (_input: any, _schema?: any) => ({ valid: true, errors: [] }),
  sanitize: (input: string) => input,
  validatePassword: (password: string) => ({
    valid: password.length >= 8,
    isValid: password.length >= 8,
    strength: (password.length >= 12 ? "strong" : password.length >= 8 ? "medium" : "weak") as "weak" | "medium" | "strong",
    score: password.length >= 12 ? 3 : password.length >= 8 ? 2 : 1,
    feedback: [] as string[],
    errors: [] as string[],
  }),
  validateContent: (_content: string, _options?: any) => ({ valid: true, isValid: true, errors: [] as string[] }),
  isValidEmail: (_email: string) => true,
  isValidPhoneNumber: (_phone: string) => true,
};
