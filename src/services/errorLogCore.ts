/** Pure error-log helpers. No React or Expo imports; the file-system side lives in errorLog.ts. */

/** Total budget across the live file and the one rotated file. */
export const ERROR_LOG_MAX_BYTES = 500 * 1024;
/** Each of the two files may grow to half of the total budget. */
export const ERROR_LOG_FILE_MAX_BYTES = ERROR_LOG_MAX_BYTES / 2;

const MAX_MESSAGE_CHARS = 1000;
const MAX_STACK_CHARS = 4000;

export function utf8Length(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

export interface RotatePlan {
  /** Move the live file over the rotated one before appending. */
  rotate: boolean;
}

/** Decides whether appending `incoming` bytes to the live file would exceed its budget. */
export function rotatePlan(sizes: { current: number }, incoming: number, fileMax: number = ERROR_LOG_FILE_MAX_BYTES): RotatePlan {
  return { rotate: sizes.current > 0 && sizes.current + incoming > fileMax };
}

export interface ErrorLogEntry {
  timestamp: string;
  context: string;
  message: string;
  stack?: string;
  appVersion: string;
}

export function toEntry(context: string, error: unknown, now: Date, appVersion: string): ErrorLogEntry {
  const isErr = typeof error === 'object' && error !== null && 'message' in error;
  const message = isErr ? String((error as { message: unknown }).message) : String(error);
  const stack = isErr && typeof (error as { stack?: unknown }).stack === 'string' ? (error as unknown as { stack: string }).stack : undefined;
  return {
    timestamp: now.toISOString(),
    context,
    message: message.slice(0, MAX_MESSAGE_CHARS),
    ...(stack ? { stack: stack.slice(0, MAX_STACK_CHARS) } : {}),
    appVersion,
  };
}

/** One JSON line, newline terminated. */
export function formatLine(entry: ErrorLogEntry): string {
  return `${JSON.stringify(entry)}\n`;
}

export interface GlobalErrorHandlerHost {
  getGlobalHandler(): ((error: unknown, isFatal?: boolean) => void) | undefined;
  setGlobalHandler(handler: (error: unknown, isFatal?: boolean) => void): void;
}

/** Logs every unhandled JS error, then calls the previously installed handler. */
export function installGlobalHandler(host: GlobalErrorHandlerHost, log: (context: string, error: unknown) => void): void {
  const previous = host.getGlobalHandler();
  host.setGlobalHandler((error, isFatal) => {
    log(isFatal ? 'global.fatal' : 'global.error', error);
    previous?.(error, isFatal);
  });
}

interface RejectionHost {
  addEventListener?: (type: string, listener: (event: { reason?: unknown }) => void) => void;
  HermesInternal?: {
    enablePromiseRejectionTracker?: (options: { allRejections: boolean; onUnhandled: (id: number, error: unknown) => void }) => void;
  };
}

/** Hooks unhandled promise rejections when the runtime supports it; otherwise a no-op. */
export function installRejectionHandler(host: RejectionHost, log: (context: string, error: unknown) => void): void {
  try {
    if (typeof host.addEventListener === 'function') {
      host.addEventListener('unhandledrejection', (event) => log('promise.unhandled', event.reason));
      return;
    }
    host.HermesInternal?.enablePromiseRejectionTracker?.({
      allRejections: true,
      onUnhandled: (_id, error) => log('promise.unhandled', error),
    });
  } catch {
    // Unsupported runtime: nothing to hook.
  }
}
