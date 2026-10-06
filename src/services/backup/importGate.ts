import type { ValidatedImport } from './importValidate';

/** Invalid rows are skipped only after the user confirmed. */
export function canApplyImport(validated: Pick<ValidatedImport, 'errors'>, confirmedSkipInvalid: boolean): boolean {
  return validated.errors.length === 0 || confirmedSkipInvalid;
}
