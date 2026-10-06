/** Optional text fields (note, unit, label) never store an empty string: '' is null. */
export function blankToNull(value: string | null | undefined): string | null {
  return value === undefined || value === null || value === '' ? null : value;
}
