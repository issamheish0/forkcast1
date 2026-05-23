import { NextResponse } from 'next/server'

// Error types for better categorization
export enum ErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  AUTHENTICATION = 'AUTHENTICATION_ERROR',
  AUTHORIZATION = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND_ERROR',
  CONFLICT = 'CONFLICT_ERROR',
  DATABASE = 'DATABASE_ERROR',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE_ERROR',
  RATE_LIMIT = 'RATE_LIMIT_ERROR',
  SERVER = 'SERVER_ERROR'
}

// Custom error class for better error handling
export class APIError extends Error {
  public type: ErrorType
  public statusCode: number
  public details?: Record<string, any>

  constructor(
    type: ErrorType,
    message: string,
    statusCode: number,
    details?: Record<string, any>
  ) {
    super(message)
    this.name = 'APIError'
    this.type = type
    this.statusCode = statusCode
    this.details = details
  }
}

// Error response interface
export interface ErrorResponse {
  error: string
  type: ErrorType
  details?: Record<string, any>
  timestamp: string
  requestId?: string
}

// Create standardized error response
export function createErrorResponse(
  error: APIError | Error,
  requestId?: string
): NextResponse<ErrorResponse> {
  let errorResponse: ErrorResponse

  if (error instanceof APIError) {
    errorResponse = {
      error: error.message,
      type: error.type,
      details: error.details,
      timestamp: new Date().toISOString(),
      requestId
    }
    return NextResponse.json(errorResponse, { status: error.statusCode })
  }

  // Handle unknown errors
  console.error('Unhandled error:', error)
  errorResponse = {
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message,
    type: ErrorType.SERVER,
    timestamp: new Date().toISOString(),
    requestId
  }
  
  return NextResponse.json(errorResponse, { status: 500 })
}

// Database error handler
export function handleDatabaseError(error: any): APIError {
  console.error('Database error:', error)
  
  // Handle common Supabase/PostgreSQL errors
  switch (error.code) {
    case 'PGRST116': // No rows found
      return new APIError(
        ErrorType.NOT_FOUND,
        'Resource not found',
        404,
        { originalError: error.message }
      )
    
    case '23505': // Unique violation
      return new APIError(
        ErrorType.CONFLICT,
        'Resource already exists',
        409,
        { originalError: error.message }
      )
    
    case '23503': // Foreign key violation
      return new APIError(
        ErrorType.VALIDATION,
        'Invalid reference to related resource',
        400,
        { originalError: error.message }
      )
    
    case '23514': // Check constraint violation
      return new APIError(
        ErrorType.VALIDATION,
        'Data validation failed',
        400,
        { originalError: error.message }
      )
    
    case 'PGRST106': // Schema cache error
      return new APIError(
        ErrorType.SERVER,
        'Database schema error',
        500,
        { originalError: error.message }
      )
    
    default:
      return new APIError(
        ErrorType.DATABASE,
        'Database operation failed',
        500,
        { 
          code: error.code,
          originalError: error.message 
        }
      )
  }
}

// Authentication error helper
export function createAuthError(message: string = 'Authentication required'): APIError {
  return new APIError(ErrorType.AUTHENTICATION, message, 401)
}

// Authorization error helper
export function createAuthorizationError(message: string = 'Insufficient permissions'): APIError {
  return new APIError(ErrorType.AUTHORIZATION, message, 403)
}

// Validation error helper
export function createValidationError(
  message: string,
  validationDetails?: Record<string, any>
): APIError {
  return new APIError(
    ErrorType.VALIDATION,
    message,
    400,
    { validation: validationDetails }
  )
}

// Not found error helper
export function createNotFoundError(resource: string): APIError {
  return new APIError(
    ErrorType.NOT_FOUND,
    `${resource} not found`,
    404
  )
}

// Conflict error helper
export function createConflictError(message: string, details?: Record<string, any>): APIError {
  return new APIError(ErrorType.CONFLICT, message, 409, details)
}

// Rate limit error helper
export function createRateLimitError(message: string = 'Too many requests'): APIError {
  return new APIError(ErrorType.RATE_LIMIT, message, 429)
}

// Helper to log errors with context
export function logError(
  error: Error | APIError,
  context: {
    userId?: string
    restaurantId?: string
    endpoint?: string
    method?: string
    requestId?: string
    additionalContext?: Record<string, any>
  }
) {
  const logData = {
    error: {
      message: error.message,
      name: error.name,
      stack: error.stack,
      ...(error instanceof APIError && {
        type: error.type,
        statusCode: error.statusCode,
        details: error.details
      })
    },
    context,
    timestamp: new Date().toISOString()
  }

  // In production, you might want to send this to a logging service
  // like DataDog, Sentry, or CloudWatch
  if (process.env.NODE_ENV === 'production') {
    // Example: Send to external logging service
    // await sendToLoggingService(logData)
    console.error('API Error:', JSON.stringify(logData, null, 2))
  } else {
    console.error('API Error:', logData)
  }
}

// Wrapper for async route handlers with error handling
export function withErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<NextResponse<R>>
) {
  return async (...args: T): Promise<NextResponse<R | ErrorResponse>> => {
    try {
      return await handler(...args)
    } catch (error) {
      // Generate request ID for tracking
      const requestId = Math.random().toString(36).substring(2, 15)
      
      // Log the error with context
      logError(error as Error, {
        requestId,
        endpoint: 'Unknown',
        method: 'Unknown'
      })
      
      return createErrorResponse(error as Error, requestId)
    }
  }
}

// Helper to safely parse JSON from request body
export async function parseRequestBody<T = any>(request: Request): Promise<T> {
  try {
    const text = await request.text()
    if (!text.trim()) {
      throw new APIError(
        ErrorType.VALIDATION,
        'Request body is empty',
        400
      )
    }
    return JSON.parse(text)
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    throw new APIError(
      ErrorType.VALIDATION,
      'Invalid JSON in request body',
      400,
      { originalError: (error as Error).message }
    )
  }
}

// Helper to validate required environment variables
export function validateEnvVar(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

// Helper for timeout handling
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new APIError(
          ErrorType.SERVER,
          errorMessage,
          408
        ))
      }, timeoutMs)
    })
  ])
}