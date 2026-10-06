import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import type { HexColor } from 'react-native-android-widget';
import { strings } from '../strings/en';
import type { WidgetColors, WidgetPayload } from '../services/widgets/adapter';

export const TAP_ACTION = 'TREK_TAP';
const MEDIUM_MIN_WIDTH = 250;
const RING = 56;

function ringSvg(fraction: number, c: WidgetColors): string {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, fraction)) * circ;
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">' +
    `<circle cx="24" cy="24" r="${r}" fill="none" stroke="${c.border}" stroke-width="5"/>` +
    `<circle cx="24" cy="24" r="${r}" fill="none" stroke="${c.accent}" stroke-width="5" stroke-linecap="round" ` +
    `stroke-dasharray="${dash} ${circ}" transform="rotate(-90 24 24)"/>` +
    '</svg>'
  );
}

/** Android widget body for one theme. `widthDp` picks small (ring + count) or medium (ring + rows). */
export function TrekAndroidWidget({ payload, mode, widthDp }: { payload: WidgetPayload; mode: 'light' | 'dark'; widthDp: number }) {
  const c = payload.colors[mode];
  const snap = payload.snapshot;
  const medium = widthDp >= MEDIUM_MIN_WIDTH;
  const fraction = snap.total > 0 ? snap.done / snap.total : 0;
  const hex = (v: string) => v as HexColor;

  const ring = (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel={`${snap.done} of ${snap.total} done`}
      style={{ width: RING, height: RING, justifyContent: 'center', alignItems: 'center' }}
    >
      <SvgWidget svg={ringSvg(fraction, c)} style={{ width: RING, height: RING }} />
      <TextWidget text={strings.widgetSettings.count(snap.done, snap.total)} style={{ fontSize: 12, color: hex(c.textPrimary), fontWeight: '700' }} />
    </FlexWidget>
  );

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: hex(c.background),
        borderRadius: 24,
      }}
    >
      {ring}
      {medium ? (
        <FlexWidget style={{ flex: 1, marginLeft: 12, flexDirection: 'column', flexGap: 6 }}>
          {snap.total === 0 ? (
            <TextWidget text={strings.widgetSettings.empty} style={{ fontSize: 14, color: hex(c.textSecondary) }} />
          ) : (
            snap.items.slice(0, 4).map((item) => {
              const percent = Math.round(item.progress * 100);
              return (
                <FlexWidget
                  key={item.goalId}
                  clickAction={TAP_ACTION}
                  clickActionData={{ goalId: item.goalId, date: snap.date, action: item.increment ? 'increment' : 'done', slotId: item.slotId }}
                  accessibilityLabel={item.name ? strings.widgetSettings.rowLabel(item.name, percent) : strings.widgetSettings.rowLabelHidden(percent)}
                  style={{ width: 'match_parent', height: 36, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, borderRadius: 12, backgroundColor: hex(c.surface) }}
                >
                  <FlexWidget style={{ flex: 1 }}>
                    <TextWidget
                      text={item.name ?? strings.widgetSettings.hiddenName}
                      maxLines={1}
                      truncate="END"
                      style={{ fontSize: 14, color: hex(item.status === 'done' ? c.textSecondary : c.textPrimary) }}
                    />
                  </FlexWidget>
                  <TextWidget text={`${percent}%`} style={{ fontSize: 12, color: hex(item.status === 'done' ? c.done : c.textSecondary) }} />
                </FlexWidget>
              );
            })
          )}
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}

/** Element pair for renderWidget (light and dark). */
export function renderAndroidWidget(payload: WidgetPayload, widthDp: number) {
  return {
    light: <TrekAndroidWidget payload={payload} mode="light" widthDp={widthDp} />,
    dark: <TrekAndroidWidget payload={payload} mode="dark" widthDp={widthDp} />,
  };
}
