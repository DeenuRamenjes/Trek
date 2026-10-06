import { Button, Gauge, HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  background,
  buttonStyle,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  gaugeStyle,
  lineLimit,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import type { WidgetEnvironment } from 'expo-widgets';
import type { WidgetPayload } from '../services/widgets/adapter';

/**
 * iOS widget layout (small: ring + count; medium: ring + up to 4 tappable rows).
 *
 * The 'widget' directive makes babel-preset-expo serialize this function and run it inside the
 * widget extension's JS runtime, so it must not reference anything outside its own body. The
 * Expo UI components and modifiers are provided there as globals. Copy comes from props.labels
 * (built from strings.widgetSettings). A row tap appends an action to
 * props.pendingActions (via the Button's onPress, which Expo UI maps to the native button target); the app imports those into pending_actions (id `w:<random>`).
 */
export function TrekIosWidget(props: WidgetPayload, environment: WidgetEnvironment) {
  'widget';
  const c = environment.colorScheme === 'dark' ? props.colors.dark : props.colors.light;
  const snap = props.snapshot;
  const medium = environment.widgetFamily === 'systemMedium';
  const fraction = snap.total > 0 ? snap.done / snap.total : 0;
  const countText = snap.done + '/' + snap.total;

  const ring = (
    <Gauge
      value={fraction}
      currentValueLabel={<Text modifiers={[font({ size: 16, weight: 'semibold' }), foregroundStyle(c.textPrimary)]}>{countText}</Text>}
      modifiers={[
        gaugeStyle('circularCapacity'),
        tint(c.accent),
        accessibilityLabel(snap.done + ' ' + props.labels.of + ' ' + snap.total + ' ' + props.labels.done),
      ]}
    />
  );

  const makeId = () => 'w:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);

  const rows = snap.items.slice(0, 4).map((item) => {
    const percent = Math.round(item.progress * 100);
    const name = item.name ?? props.labels.hiddenName;
    return (
      <Button
        key={item.goalId}
        onPress={() => ({
          pendingActions: (props.pendingActions ?? []).concat([
            {
              id: makeId(),
              goalId: item.goalId,
              slotId: item.slotId ?? null,
              date: snap.date,
              action: item.increment ? 'increment' : 'done',
            },
          ]),
        })}
        modifiers={[buttonStyle('plain'), accessibilityLabel(name + ', ' + percent + ' ' + props.labels.percent)]}
      >
        <HStack spacing={8}>
          <Gauge
            value={item.progress}
            modifiers={[gaugeStyle('circularCapacity'), tint(item.status === 'done' ? c.done : c.accent), frame({ width: 20, height: 20 })]}
          />
          <Text modifiers={[font({ size: 14 }), foregroundStyle(c.textPrimary), lineLimit(1)]}>{name}</Text>
          <Spacer />
          <Text modifiers={[font({ size: 12 }), foregroundStyle(c.textSecondary)]}>{percent + '%'}</Text>
        </HStack>
      </Button>
    );
  });

  const empty = <Text modifiers={[font({ size: 14 }), foregroundStyle(c.textSecondary)]}>{props.labels.empty}</Text>;

  return (
    <HStack
      spacing={12}
      modifiers={[padding({ all: 12 }), frame({ maxWidth: 10000, maxHeight: 10000 }), containerBackground(c.background, 'widget'), background(c.background)]}
    >
      {ring}
      {medium ? <VStack alignment="leading" spacing={8}>{snap.total === 0 ? empty : rows}</VStack> : null}
    </HStack>
  );
}
