export class BaseError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly errorCode?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends BaseError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class NotFoundError extends BaseError {
  constructor(message: string) {
    super(message, 404, 'NOT_FOUND');
  }
}

export class IntegrationError extends BaseError {
  constructor(message: string, statusCode = 500) {
    super(message, statusCode, 'INTEGRATION_ERROR');
  }
}

export class AuthenticationError extends BaseError {
  constructor(message: string) {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export interface ErrorResponse {
  statusCode: number;
  body: {
    error: {
      message: string;
      code?: string;
    };
  };
}

export const formatError = (error: Error | BaseError): ErrorResponse => {
  if (error instanceof BaseError) {
    return {
      statusCode: error.statusCode,
      body: {
        error: {
          message: error.message,
          code: error.errorCode,
        },
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      error: {
        message: 'Internal Server Error',
        code: 'INTERNAL_SERVER_ERROR',
      },
    },
  };
}; 