// Error codes for the application
export const ErrorCodes = {
  // Validation errors (400)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_JSON: 'INVALID_JSON',
  INVALID_EMAIL: 'INVALID_EMAIL',
  WEAK_PASSWORD: 'WEAK_PASSWORD',

  // Auth errors (401)
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  NO_TOKEN: 'NO_TOKEN',
  INVALID_TOKEN: 'INVALID_TOKEN',

  // Conflict errors (409)
  USER_EXISTS: 'USER_EXISTS',

  // Provider errors
  PROVIDER_NOT_CONFIGURED: 'PROVIDER_NOT_CONFIGURED',
  PROVIDER_ERROR: 'PROVIDER_ERROR',

  // Server errors (500)
  SERVER_ERROR: 'SERVER_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// Application error class
export class AppError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public status: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Helper to create validation errors
export function validationError(message: string): AppError {
  return new AppError(message, ErrorCodes.VALIDATION_ERROR, 400);
}

// Helper to create auth errors
export function authError(message: string, code: ErrorCode = ErrorCodes.UNAUTHORIZED): AppError {
  return new AppError(message, code, 401);
}

// Helper to create provider errors
export function providerError(message: string): AppError {
  return new AppError(message, ErrorCodes.PROVIDER_ERROR, 502);
}

// Helper to create conflict errors
export function conflictError(message: string, code: ErrorCode): AppError {
  return new AppError(message, code, 409);
}

// Global error handler - transforms any error to response
export function handleError(error: unknown): Response {
  // If it's our AppError, use its properties
  if (error instanceof AppError) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          message: error.message,
          code: error.code,
        },
      }),
      {
        status: error.status,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Handle standard Error
  if (error instanceof Error) {
    // Check for specific error types
    if (error.message.includes('JSON')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            message: 'Invalid JSON in request body',
            code: ErrorCodes.INVALID_JSON,
          },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Generic server error
    console.error('Unhandled error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          message: 'Internal server error',
          code: ErrorCodes.SERVER_ERROR,
        },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Unknown error type
  console.error('Unknown error:', error);
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        message: 'Internal server error',
        code: ErrorCodes.SERVER_ERROR,
      },
    }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
