import { Request, Response, NextFunction } from 'express';

// Log levels enum
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// Current log level (can be configured via environment)
const currentLogLevel = parseInt(process.env.LOG_LEVEL || '1', 10);

// Structured log entry interface
export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  correlationId?: string;
  requestId?: string;
  userId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
}

// Log level string mapping
const logLevelStrings: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
};

// Color codes for terminal output (dev mode)
const logColors: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: '\x1b[36m',   // Cyan
  [LogLevel.INFO]: '\x1b[32m',    // Green
  [LogLevel.WARN]: '\x1b[33m',     // Yellow
  [LogLevel.ERROR]: '\x1b[31m',   // Red
};
const resetColor = '\x1b[0m';

/**
 * Core logging function
 */
function writeLog(entry: LogEntry, level: LogLevel): void {
  if (level < currentLogLevel) return;

  const logString = logLevelStrings[level];
  const timestamp = entry.timestamp;
  
  // Format for different environments
  if (process.env.NODE_ENV === 'development') {
    const color = logColors[level];
    console.log(
      `${color}[${timestamp}] [${logString}]${resetColor} ${entry.message}`,
      entry.error ? `\n${entry.error.stack}` : '',
      entry.metadata ? JSON.stringify(entry.metadata, null, 2) : ''
    );
  } else {
    // Production: structured JSON logging
    console.log(JSON.stringify(entry));
  }
}

/**
 * Generate correlation ID for request tracing
 */
export function generateCorrelationId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Error logging middleware with comprehensive error capture
 */
export function errorLogger(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const correlationId = (req.headers['x-correlation-id'] as string) || generateCorrelationId();
  const requestId = (req.headers['x-request-id'] as string) || correlationId;
  
  const errorEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: logLevelStrings[LogLevel.ERROR],
    message: err.message || 'An unexpected error occurred',
    correlationId,
    requestId,
    userId: req.user?.userId,
    method: req.method,
    path: req.path,
    error: {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    },
    metadata: {
      query: req.query,
      params: req.params,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent'],
        'content-length': req.headers['content-length'],
      },
    },
  };

  writeLog(errorEntry, LogLevel.ERROR);

  // Send error response
  if (!res.headersSent) {
    const statusCode = (err as any).statusCode || 500;
    res.status(statusCode).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
      correlationId,
      requestId,
    });
  }
}

/**
 * Request logging middleware
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const correlationId = (req.headers['x-correlation-id'] as string) || generateCorrelationId();
  const requestId = (req.headers['x-request-id'] as string) || correlationId;
  const startTime = Date.now();

  // Attach IDs to request for downstream use
  (req as any).correlationId = correlationId;
  (req as any).requestId = requestId;

  // Log request start
  const startEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: logLevelStrings[LogLevel.INFO],
    message: `→ ${req.method} ${req.path}`,
    correlationId,
    requestId,
    method: req.method,
    path: req.path,
    metadata: {
      query: req.query,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    },
  };
  writeLog(startEntry, LogLevel.INFO);

  // Capture response finish
  const originalEnd = res.end;
  res.end = function(this: Response, ...args: any[]): Response {
    const duration = Date.now() - startTime;
    
    const endEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: res.statusCode >= 400 ? logLevelStrings[LogLevel.WARN] : logLevelStrings[LogLevel.INFO],
      message: `← ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`,
      correlationId,
      requestId,
      userId: (req as any).user?.userId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
    };
    writeLog(endEntry, res.statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO);

    return originalEnd.apply(this, args as any);
  };

  next();
}

/**
 * Security-focused logging middleware
 */
export function securityLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+=/i,
    /eval\(/i,
    /\.\.\//i,  // Path traversal
    /union\s+select/i,
    /drop\s+table/i,
  ];

  const requestBody = JSON.stringify(req.body);
  const queryString = JSON.stringify(req.query);

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestBody) || pattern.test(queryString)) {
      const securityEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: logLevelStrings[LogLevel.WARN],
        message: 'Suspicious request pattern detected',
        correlationId: (req as any).correlationId,
        requestId: (req as any).requestId,
        method: req.method,
        path: req.path,
        metadata: {
          pattern: pattern.source,
          requestBody: requestBody.substring(0, 500),
          queryString: queryString.substring(0, 200),
          ip: req.ip,
        },
      };
      writeLog(securityEntry, LogLevel.WARN);
      break;
    }
  }

  next();
}

/**
 * Performance monitoring middleware
 */
export function performanceMonitor(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = process.hrtime.bigint();
  const requestId = (req as any).requestId || generateCorrelationId();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;

    // Log slow requests (> 1 second)
    if (durationMs > 1000) {
      const perfEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: logLevelStrings[LogLevel.WARN],
        message: `Slow request detected: ${req.method} ${req.path}`,
        correlationId: (req as any).correlationId,
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: durationMs,
        metadata: {
          slowThreshold: 1000,
          actualDuration: durationMs,
        },
      };
      writeLog(perfEntry, LogLevel.WARN);
    }

    // Log very slow requests (> 5 seconds) as errors
    if (durationMs > 5000) {
      const perfEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: logLevelStrings[LogLevel.ERROR],
        message: `Critical slow request: ${req.method} ${req.path}`,
        correlationId: (req as any).correlationId,
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: durationMs,
        metadata: {
          slowThreshold: 5000,
          actualDuration: durationMs,
        },
      };
      writeLog(perfEntry, LogLevel.ERROR);
    }
  });

  next();
}

// Export for testing and external use
export { writeLog, logLevelStrings };
