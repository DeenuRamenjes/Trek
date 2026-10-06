import { router } from 'expo-router';
import { useState } from 'react';
import { strings } from '../../strings/en';
import { AppText, Button, Card, Screen, SegmentedControl } from '../../ui/components';
import type { ColorMode } from '../../ui/tokens';
import { previewKeys } from '../preview/registry';

export function DesignPreviewIndex() {
  const [mode, setMode] = useState<ColorMode>('light');
  const p = strings.designPreview;
  return (
    <Screen>
      <AppText variant="display">{p.title}</AppText>
      <AppText tone="secondary">{p.devOnly}</AppText>
      <SegmentedControl
        accessibilityLabel={p.modeLabel}
        selected={mode}
        onChange={setMode}
        segments={[
          { value: 'light', label: p.light },
          { value: 'dark', label: p.dark },
        ]}
      />
      <Card>
        {previewKeys.map((key) => (
          <Button
            key={key}
            variant="plain"
            label={p.screens[key]}
            accessibilityLabel={p.openScreen(p.screens[key])}
            onPress={() => router.push({ pathname: '/design-preview/[screen]', params: { screen: key, mode } })}
          />
        ))}
      </Card>
    </Screen>
  );
}
