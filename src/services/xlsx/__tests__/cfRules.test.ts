import { dataBarInnerXml, colorScaleInnerXml } from '../cfRules';

describe('cfRules', () => {
  it('builds a deterministic dataBar', () => {
    const a = dataBarInnerXml({ color: 'FF4F7CAC' });
    expect(a).toBe(
      '<dataBar><cfvo type="min"/><cfvo type="max"/><color rgb="FF4F7CAC"/></dataBar>',
    );
    expect(dataBarInnerXml({ color: 'FF4F7CAC' })).toBe(a);
  });

  it('builds a two and three stop colorScale', () => {
    expect(
      colorScaleInnerXml([
        { type: 'min', color: 'FFFFFFFF' },
        { type: 'max', color: 'FF000000' },
      ]),
    ).toBe(
      '<colorScale><cfvo type="min"/><cfvo type="max"/><color rgb="FFFFFFFF"/><color rgb="FF000000"/></colorScale>',
    );
    expect(
      colorScaleInnerXml([
        { type: 'min', color: 'FF000001' },
        { type: 'percentile', val: '50', color: 'FF000002' },
        { type: 'max', color: 'FF000003' },
      ]),
    ).toContain('<cfvo type="percentile" val="50"/>');
  });

  it('escapes values', () => {
    expect(colorScaleInnerXml([
      { type: 'num', val: '1"&<', color: 'FF000000' },
      { type: 'max', color: 'FF000000' },
    ])).toContain('val="1&quot;&amp;&lt;"');
  });

  it('rejects wrong stop counts and bad types', () => {
    expect(() => colorScaleInnerXml([{ type: 'min', color: 'FF000000' }])).toThrow();
    expect(() => dataBarInnerXml({ color: 'red' })).toThrow();
  });
});
