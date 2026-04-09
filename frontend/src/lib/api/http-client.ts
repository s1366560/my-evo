// Custom error class for EvoMap API errors
export class EvoMapError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'EvoMapError';
  }
}

// HTTP status code mapping
export const HTTP_STATUS_MAP: Record<number, { code: string; message: string }> = {
  400: { code: 'BAD_REQUEST', message: 'Invalid request parameters' },
  401: { code: 'UNAUTHORIZED', message: 'Authentication required' },
  403: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
  404: { code: 'NOT_FOUND', message: 'Resource not found' },
  409: { code: 'CONFLICT', message: 'Resource conflict' },
  422: { code: 'UNPROCESSABLE', message: 'Unprocessable entity' },
  429: { code: 'RATE_LIMITED', message: 'Too many requests — please try again later' },
  500: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  502: { code: 'BAD_GATEWAY', message: 'Bad gateway' },
  503: { code: 'SERVICE_UNAVAILABLE', message: 'Service temporarily unavailable' },
};

// Unwrap { success, data } envelope — extracts the data field
function unwrapResponse<T>(body: unknown): T {
  const r = body as Record<string, unknown>;
  if (r && 'success' in r && 'data' in r) {
    return r.data as T;
  }
  return body as T;
}

// Response interceptor: throws EvoMapError for 4xx/5xx, returns unwrapped data otherwise
export function handleResponse<T>(response: Response): Promise<T> {
  if (response.status >= 400) {
    let code = 'UNKNOWN';
    let message = 'An unexpected error occurred';

    const mapped = HTTP_STATUS_MAP[response.status];
    if (mapped) {
      code = mapped.code;
      message = mapped.message;
    }

    return response.json().catch(() => ({}))
      .then((body: unknown) => {
        const r = body as Record<string, unknown>;
        // Support both { message } (shared/errors) and { error } (backend) shapes
        if (r && typeof (r as Record<string, unknown>).message === 'string') {
          message = (r as Record<string, unknown>).message as string;
        } else if (r && typeof (r as Record<string, unknown>).error === 'string') {
          message = (r as Record<string, unknown>).error as string;
        }
        if (r && typeof r.code === 'string') {
          code = r.code;
        }
        throw new EvoMapError(message, response.status, code);
      });
  }

  return response.json().then(unwrapResponse<T>) as Promise<T>;
}
