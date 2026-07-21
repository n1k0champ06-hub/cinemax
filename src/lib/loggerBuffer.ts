// Ring buffer for collecting client-side logs for error reporting without memory leaks or performance impact

export interface LogEntry {
  timestamp: string;
  level: 'log' | 'warn' | 'error' | 'info';
  message: string;
}

const MAX_BUFFER_SIZE = 50;
const MAX_MESSAGE_LENGTH = 300;

const logBuffer: LogEntry[] = [];
let isInitialized = false;

function safeSerialize(args: any[]): string {
  try {
    return args
      .map((arg) => {
        if (arg === null) return 'null';
        if (arg === undefined) return 'undefined';
        if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack || ''}`;
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(' ')
      .substring(0, MAX_MESSAGE_LENGTH);
  } catch {
    return '[Unserializable log message]';
  }
}

function pushLog(level: LogEntry['level'], message: string): void {
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS
  const entry: LogEntry = {
    timestamp: timeStr,
    level,
    message,
  };

  logBuffer.push(entry);
  if (logBuffer.length > MAX_BUFFER_SIZE) {
    logBuffer.shift();
  }
}

export function initLoggerBuffer(): void {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
  };

  console.log = (...args: any[]) => {
    try {
      pushLog('log', safeSerialize(args));
    } catch {}
    originalConsole.log.apply(console, args);
  };

  console.warn = (...args: any[]) => {
    try {
      pushLog('warn', safeSerialize(args));
    } catch {}
    originalConsole.warn.apply(console, args);
  };

  console.error = (...args: any[]) => {
    try {
      pushLog('error', safeSerialize(args));
    } catch {}
    originalConsole.error.apply(console, args);
  };

  console.info = (...args: any[]) => {
    try {
      pushLog('info', safeSerialize(args));
    } catch {}
    originalConsole.info.apply(console, args);
  };

  window.addEventListener('error', (event) => {
    try {
      const errorMsg = event.error ? `${event.message} at ${event.filename}:${event.lineno}` : event.message;
      pushLog('error', `[Uncaught Error] ${errorMsg}`);
    } catch {}
  });

  window.addEventListener('unhandledrejection', (event) => {
    try {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
      pushLog('error', `[Unhandled Rejection] ${reason}`);
    } catch {}
  });
}

export function getRecentLogs(limit: number = 30): string[] {
  const slice = logBuffer.slice(-limit);
  return slice.map((item) => `[${item.timestamp}] [${item.level.toUpperCase()}] ${item.message}`);
}

export function clearLoggerBuffer(): void {
  logBuffer.length = 0;
}
