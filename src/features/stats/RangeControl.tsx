import type { StatsRange } from '../../domain/statsCalculator';
import { strings } from '../../strings/en';
import { SegmentedControl } from '../../ui/components';

const r = strings.stats.ranges;
const segments: { value: StatsRange; label: string }[] = [
  { value: '7D', label: r.d7 },
  { value: '30D', label: r.d30 },
  { value: '90D', label: r.d90 },
  { value: '1Y', label: r.y1 },
  { value: 'All', label: r.all },
];

export function RangeControl({ value, onChange }: { value: StatsRange; onChange: (v: StatsRange) => void }) {
  return <SegmentedControl accessibilityLabel={strings.stats.rangeLabel} segments={segments} selected={value} onChange={onChange} />;
}
