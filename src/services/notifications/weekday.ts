/** Planner weekday is ISO (0 = Monday … 6 = Sunday); expo weekly triggers use 1 = Sunday … 7 = Saturday. */
export function toExpoWeekday(isoWeekday: number): number {
  return ((isoWeekday + 1) % 7) + 1;
}
