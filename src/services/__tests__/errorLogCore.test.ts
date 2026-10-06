import {
  ERROR_LOG_FILE_MAX_BYTES,
  ERROR_LOG_MAX_BYTES,
  formatLine,
  installGlobalHandler,
  installRejectionHandler,
  rotatePlan,
  toEntry,
  utf8Length,
} from '../errorLogCore';

describe('rotation', () => {
  /** Simulates the file side: two files, rotate drops the older one. */
  function simulate(lines: string[]) {
    let current = 0;
    let rotated = 0;
    let max = 0;
    for (const line of lines) {
      const size = utf8Length(line);
      if (rotatePlan({ current }, size).rotate) {
        rotated = current;
        current = 0;
      }
      current += size;
      max = Math.max(max, current + rotated);
    }
    return { current, rotated, max };
  }

  it('keeps total size within 500 KB with at most one rotated file', () => {
    const line = formatLine(toEntry('ctx', new Error('x'.repeat(900)), new Date(0), '1.0.0'));
    const result = simulate(Array.from({ length: 2000 }, () => line));
    expect(result.max).toBeLessThanOrEqual(ERROR_LOG_MAX_BYTES);
    expect(result.rotated).toBeGreaterThan(0);
    expect(result.current).toBeLessThanOrEqual(ERROR_LOG_FILE_MAX_BYTES);
  });

  it('appends while the live file has room and rotates when it would overflow', () => {
    expect(rotatePlan({ current: 100 }, 50, 200).rotate).toBe(false);
    expect(rotatePlan({ current: 160 }, 50, 200).rotate).toBe(true);
    expect(rotatePlan({ current: 0 }, 500, 200).rotate).toBe(false);
  });
});

describe('entries', () => {
  it('formats one JSON line with timestamp, context, message, stack and version', () => {
    const err = new Error('boom');
    const line = formatLine(toEntry('ctx', err, new Date('2026-01-02T03:04:05Z'), '1.2.3'));
    expect(line.endsWith('\n')).toBe(true);
    expect(JSON.parse(line)).toEqual({
      timestamp: '2026-01-02T03:04:05.000Z',
      context: 'ctx',
      message: 'boom',
      stack: err.stack,
      appVersion: '1.2.3',
    });
  });

  it('handles non-Error values and truncates huge messages', () => {
    expect(toEntry('c', 'plain', new Date(0), 'v').message).toBe('plain');
    expect(toEntry('c', new Error('y'.repeat(5000)), new Date(0), 'v').message.length).toBe(1000);
  });

  it('counts utf8 bytes', () => {
    expect(utf8Length('aé€😀')).toBe(1 + 2 + 3 + 4);
  });
});

describe('handlers', () => {
  it('global handler logs then chains the previous handler', () => {
    const previous = jest.fn();
    let installed: ((e: unknown, fatal?: boolean) => void) | undefined;
    const log = jest.fn();
    installGlobalHandler({ getGlobalHandler: () => previous, setGlobalHandler: (h) => (installed = h) }, log);
    const err = new Error('x');
    installed?.(err, true);
    expect(log).toHaveBeenCalledWith('global.fatal', err);
    expect(previous).toHaveBeenCalledWith(err, true);
  });

  it('works without a previous handler', () => {
    let installed: ((e: unknown) => void) | undefined;
    const log = jest.fn();
    installGlobalHandler({ getGlobalHandler: () => undefined, setGlobalHandler: (h) => (installed = h) }, log);
    expect(() => installed?.(new Error('x'))).not.toThrow();
    expect(log).toHaveBeenCalledWith('global.error', expect.any(Error));
  });

  it('rejection handler uses events, then Hermes tracker, else no-op', () => {
    const log = jest.fn();
    let listener: ((e: { reason?: unknown }) => void) | undefined;
    installRejectionHandler({ addEventListener: (_t, l) => (listener = l) }, log);
    listener?.({ reason: 'r' });
    expect(log).toHaveBeenCalledWith('promise.unhandled', 'r');

    let opts: { onUnhandled: (id: number, e: unknown) => void } | undefined;
    installRejectionHandler({ HermesInternal: { enablePromiseRejectionTracker: (o) => (opts = o) } }, log);
    opts?.onUnhandled(1, 'h');
    expect(log).toHaveBeenCalledWith('promise.unhandled', 'h');

    expect(() => installRejectionHandler({}, log)).not.toThrow();
  });
});
