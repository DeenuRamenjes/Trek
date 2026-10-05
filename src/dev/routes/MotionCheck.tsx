import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { strings } from '../../strings/en';
import { AppText, Button, Card, Screen } from '../../ui/components';
import { TrekMark } from '../../ui/components/TrekMark';
import {
  AnimatedCheck,
  AnimatedNumber,
  Collapse,
  FadeIn,
  PressableScale,
  ScaleIn,
  SlideUp,
  Skeleton,
  Stagger,
  useReduceMotion,
} from '../../ui/motion';
import { useTheme } from '../../ui/ThemeProvider';
import { minTapTarget, radii, spacing } from '../../ui/tokens';

const staggerItems = [1, 2, 3, 4, 5];

/** Dev-only screen that shows every motion primitive so animation can be judged on a device. */
export function MotionCheck() {
  const m = strings.motionCheck;
  const { colors } = useTheme();
  const reduce = useReduceMotion();
  const [run, setRun] = useState(0);
  const [big, setBig] = useState(false);
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  const replay = () => {
    setBig(false);
    setOpen(false);
    setChecked(false);
    setRun((n) => n + 1);
  };

  return (
    <Screen>
      <AppText variant="display">{m.title}</AppText>
      <AppText tone="secondary">{reduce ? m.reduceMotionOn : m.reduceMotionOff}</AppText>
      <Button label={m.replay} icon="refresh" onPress={replay} />

      <View key={run} style={styles.group}>
        <AppText variant="title">{m.presets}</AppText>
        <FadeIn>
          <Card>
            <AppText>{m.fade}</AppText>
          </Card>
        </FadeIn>
        <SlideUp>
          <Card>
            <AppText>{m.slide}</AppText>
          </Card>
        </SlideUp>
        <ScaleIn>
          <Card>
            <AppText>{m.scale}</AppText>
          </Card>
        </ScaleIn>

        <AppText variant="title">{m.stagger}</AppText>
        <Stagger>
          {staggerItems.map((n) => (
            <Card key={n} muted>
              <AppText>{m.staggerItem(n)}</AppText>
            </Card>
          ))}
        </Stagger>

      <Card>
        <PressableScale accessibilityLabel={m.press} style={[styles.press, { backgroundColor: colors.accent }]}>
          <AppText variant="label" tone="onAccent">
            {m.press}
          </AppText>
        </PressableScale>
      </Card>

      <Card>
        <AppText variant="title">{m.number}</AppText>
        <AnimatedNumber value={big ? 100 : 0} />
        <Button label={m.changeNumber} variant="secondary" onPress={() => setBig((v) => !v)} />
      </Card>

      <Card>
        <AppText variant="title">{m.skeleton}</AppText>
        <Skeleton height={16} />
        <Skeleton width="60%" height={16} />
      </Card>

      <Card>
        <AppText variant="title">{m.collapse}</AppText>
        <Button label={m.toggleCollapse} variant="secondary" onPress={() => setOpen((v) => !v)} />
        <Collapse open={open}>
          <AppText tone="secondary">{m.details}</AppText>
        </Collapse>
      </Card>

      <Card>
        <AppText variant="title">{m.check}</AppText>
        <AnimatedCheck checked={checked} color={colors.accent} size={32} />
        <Button label={m.toggleCheck} variant="secondary" onPress={() => setChecked((v) => !v)} />
      </Card>

      <Card>
        <AppText variant="title">{m.mark}</AppText>
        <TrekMark size={64} color={colors.accent} />
      </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.md },
  press: {
    minHeight: minTapTarget,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
