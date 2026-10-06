import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  formatLine,
  installGlobalHandler,
  installRejectionHandler,
  rotatePlan,
  toEntry,
  utf8Length,
  type GlobalErrorHandlerHost,
} from './errorLogCore';

/** Expo-bound side of the error log. Local only: never sent anywhere automatically. */

const appVersion: string = Constants.expoConfig?.version ?? '0.0.0';

function logFiles(): { current: File; rotated: File } {
  const dir = new Directory(Paths.document, 'logs');
  dir.create({ idempotent: true, intermediates: true });
  return { current: new File(dir, 'error.log'), rotated: new File(dir, 'error.1.log') };
}

let tail: Promise<void> = Promise.resolve();

async function append(line: string): Promise<void> {
  const { current, rotated } = logFiles();
  if (!current.exists) current.create();
  const size = current.size ?? 0;
  if (rotatePlan({ current: size }, utf8Length(line)).rotate) {
    if (rotated.exists) rotated.delete();
    await current.copy(rotated);
    current.delete();
    current.create();
    current.write(line);
    return;
  }
  current.write(size > 0 ? current.textSync() + line : line);
}

/** Appends one JSON line. Never throws and never blocks the caller. */
export function logError(context: string, error: unknown): Promise<void> {
  const line = formatLine(toEntry(context, error, new Date(), appVersion));
  const run = async () => {
    try {
      await append(line);
    } catch {
      // Logging must never create new failures.
    }
  };
  tail = tail.then(run, run);
  return tail;
}

/** For `.catch(logCatch('ctx'))` at sites that used to swallow errors. */
export function logCatch(context: string): (error: unknown) => void {
  return (error) => {
    void logError(context, error);
  };
}

let installed = false;

/** Hooks global JS errors and unhandled rejections. Idempotent. */
export function installErrorLogging(): void {
  if (installed) return;
  installed = true;
  const eu = (globalThis as { ErrorUtils?: GlobalErrorHandlerHost }).ErrorUtils;
  if (eu) installGlobalHandler(eu, (c, e) => void logError(c, e));
  installRejectionHandler(globalThis as never, (c, e) => void logError(c, e));
}

/** Copies rotated plus live log into one cache file and opens the share sheet. False when nothing is logged. */
export async function shareErrorLog(): Promise<boolean> {
  await tail;
  const { current, rotated } = logFiles();
  const parts: string[] = [];
  if (rotated.exists) parts.push(await rotated.text());
  if (current.exists) parts.push(await current.text());
  const text = parts.join('');
  if (!text) return false;
  const target = new File(Paths.cache, 'trek-error-log.txt');
  if (target.exists) target.delete();
  target.create();
  target.write(text);
  await Sharing.shareAsync(target.uri, { mimeType: 'text/plain', UTI: 'public.plain-text', dialogTitle: 'trek-error-log.txt' });
  return true;
}
