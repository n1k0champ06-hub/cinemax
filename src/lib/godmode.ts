/**
 * godmode.ts — Cinemax God-Mode Console Telemetry & Core Store
 * 
 * Provides a global telemetry logging system, PubSub store for log buffer (FIFO max 500),
 * and fetch monkey-patching middleware to bridge Edge logs from X-GodMode-Logs HTTP headers.
 */

export interface GodModeLog {
  id: string;
  timestamp: string; // HH:mm:ss.SSS
  category: 'EDGE_WORKER' | 'GEMINI_AI' | 'PLAYER' | 'NETWORK' | 'SYSTEM' | 'EXTENSION';
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  metric?: string;
}

class GodModeStore {
  private logs: GodModeLog[] = [];
  private listeners: ((logs: GodModeLog[]) => void)[] = [];
  private isOpen = false;
  private isOpenListeners: ((open: boolean) => void)[] = [];

  getLogs(): GodModeLog[] {
    return this.logs;
  }

  addLog(
    category: GodModeLog['category'],
    level: GodModeLog['level'],
    message: string,
    metric?: string
  ): void {
    const now = new Date();
    const pad = (num: number, size: number) => String(num).padStart(size, '0');
    const timestamp = `${pad(now.getHours(), 2)}:${pad(now.getMinutes(), 2)}:${pad(now.getSeconds(), 2)}.${pad(now.getMilliseconds(), 3)}`;

    const log: GodModeLog = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
      timestamp,
      category,
      level,
      message,
      metric,
    };

    // FIFO queue of max 500 items
    this.logs = [...this.logs, log].slice(-500);
    this.notify();

    // Dev-only physical file logger mirror (Task 2)
    const isDevMode = 
      (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') ||
      (import.meta.env && import.meta.env.DEV);

    if (isDevMode) {
      // Fire-and-forget async call to local development API
      fetch('/api/dev-logger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(log),
      }).catch(() => {
        // Silently handle any fetch errors to avoid crashing the app
      });
    }
  }

  clear(): void {
    this.logs = [];
    this.notify();
  }

  subscribe(listener: (logs: GodModeLog[]) => void): () => void {
    this.listeners.push(listener);
    // Initial call
    listener(this.logs);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      try {
        l(this.logs);
      } catch (e) {
        console.error('[GodModeStore] Listener error:', e);
      }
    });
  }

  getIsOpen(): boolean {
    return this.isOpen;
  }

  setIsOpen(val: boolean): void {
    if (this.isOpen !== val) {
      this.isOpen = val;
      this.isOpenListeners.forEach((l) => {
        try {
          l(val);
        } catch (e) {
          console.error('[GodModeStore] Open listener error:', e);
        }
      });
    }
  }

  subscribeIsOpen(listener: (open: boolean) => void): () => void {
    this.isOpenListeners.push(listener);
    listener(this.isOpen);
    return () => {
      this.isOpenListeners = this.isOpenListeners.filter((l) => l !== listener);
    };
  }
}

export const godModeStore = new GodModeStore();

// Flag to ensure monkey patch is only initialized once
let isFetchIntercepted = false;

export function initFetchInterceptor(): void {
  if (isFetchIntercepted) return;
  isFetchIntercepted = true;

  const originalFetch = window.fetch;

  window.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    // Get URL string
    const urlString =
      typeof input === 'string'
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;

    // Filter out external logging, telemetry, or dev-logger endpoints to avoid cycles
    const isSelfLog = urlString.includes('analytics') || urlString.includes('vercel') || urlString.includes('dev-logger');

    const start = performance.now();
    if (!isSelfLog) {
      // Clean query parameters from logged URL for aesthetics
      const cleanUrl = urlString.split('?')[0];
      godModeStore.addLog('NETWORK', 'INFO', `Request initiated: fetch('${cleanUrl}')`);
    }

    try {
      const response = await originalFetch.call(this, input, init);
      const durationMs = Math.round(performance.now() - start);

      if (!isSelfLog) {
        const cleanUrl = urlString.split('?')[0];

        let bodySnippet = '';
        let hasErrorInBody = false;
        let isEmptyBody = false;

        try {
          const contentType = response.headers.get('Content-Type') || '';
          if (contentType.includes('application/json') || contentType.includes('text/')) {
            const clonedResp = response.clone();
            const text = await clonedResp.text();
            
            const trimmedText = text.trim();
            if (trimmedText === '[]' || trimmedText === '{}' || trimmedText === '') {
              isEmptyBody = true;
            }
            
            try {
              const parsedJson = JSON.parse(text);
              if (parsedJson && (parsedJson.error || parsedJson.ok === false || parsedJson.success === false)) {
                hasErrorInBody = true;
              }
            } catch (_) {}

            bodySnippet = text.length > 200 ? text.substring(0, 200) + '...' : text;
          }
        } catch (e) {
          // Fallback if cloning fails
        }

        // Determine category, level, and message structure
        let logLevel: 'INFO' | 'WARN' | 'ERROR' = 'INFO';
        let logMsg = `Response received: fetch('${cleanUrl}') status ${response.status}`;

        if (response.status >= 400) {
          logLevel = 'ERROR';
          logMsg += bodySnippet ? ` - Body: ${bodySnippet}` : '';
        } else if (hasErrorInBody || isEmptyBody) {
          logLevel = 'WARN';
          logMsg += ` (Potential issue: ${hasErrorInBody ? 'Error in payload' : 'Empty payload'})${bodySnippet ? ` - Body: ${bodySnippet}` : ''}`;
        }

        godModeStore.addLog(
          'NETWORK',
          logLevel,
          logMsg,
          `${durationMs}ms`
        );

        // Check for Edge logs header
        const edgeLogsHeader = response.headers.get('X-GodMode-Logs');
        if (edgeLogsHeader) {
          try {
            // Decode Base64 safely supporting Unicode / UTF-8
            const decodedJson = decodeURIComponent(
              atob(edgeLogsHeader)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
            );
            const edgeLogs = JSON.parse(decodedJson);

            if (Array.isArray(edgeLogs)) {
              edgeLogs.forEach((log: any) => {
                // Ensure structured log fields match standard schema
                godModeStore.addLog(
                  log.category || 'EDGE_WORKER',
                  log.level || 'INFO',
                  log.message || '',
                  log.metric
                );
              });
            }
          } catch (e: any) {
            godModeStore.addLog(
              'SYSTEM',
              'WARN',
              `Failed to parse X-GodMode-Logs header: ${e.message}`
            );
          }
        }
      }

      return response;
    } catch (error: any) {
      const durationMs = Math.round(performance.now() - start);
      if (!isSelfLog) {
        const cleanUrl = urlString.split('?')[0];
        godModeStore.addLog(
          'NETWORK',
          'ERROR',
          `Request failed: fetch('${cleanUrl}') - ${error.message || error}`,
          `${durationMs}ms`
        );
      }
      throw error;
    }
  };

  godModeStore.addLog('SYSTEM', 'INFO', 'Fetch telemetry bridge initialized successfully.');
}
