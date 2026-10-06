/**
 * @office-kit/xlsx 0.23.4 does not ship addDataBarRule / addColorScaleRule at
 * runtime. The only hook for these rule kinds is `makeCfRule({ innerXml })`, so
 * this module builds that fragment. Output is deterministic and escaped.
 */
export type CfvoType = 'min' | 'max' | 'num' | 'percent' | 'percentile';

export type ColorStop = { type: CfvoType; val?: string; color: string };

const ARGB = /^[0-9A-Fa-f]{8}$/;

function esc(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cfvo(type: CfvoType, val?: string): string {
  if (type === 'min' || type === 'max') return `<cfvo type="${type}"/>`;
  if (val === undefined) throw new Error(`cfvo ${type} needs a val`);
  return `<cfvo type="${type}" val="${esc(val)}"/>`;
}

function color(argb: string): string {
  if (!ARGB.test(argb)) throw new Error(`Invalid ARGB color: ${argb}`);
  return `<color rgb="${argb.toUpperCase()}"/>`;
}

export function dataBarInnerXml(opts: {
  color: string;
  min?: { type: CfvoType; val?: string };
  max?: { type: CfvoType; val?: string };
}): string {
  const min = opts.min ?? { type: 'min' as const };
  const max = opts.max ?? { type: 'max' as const };
  return `<dataBar>${cfvo(min.type, min.val)}${cfvo(max.type, max.val)}${color(opts.color)}</dataBar>`;
}

export function colorScaleInnerXml(stops: readonly ColorStop[]): string {
  if (stops.length !== 2 && stops.length !== 3) throw new Error('colorScale needs 2 or 3 stops');
  return `<colorScale>${stops.map((s) => cfvo(s.type, s.val)).join('')}${stops
    .map((s) => color(s.color))
    .join('')}</colorScale>`;
}
