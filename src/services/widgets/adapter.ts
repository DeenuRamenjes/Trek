import { Platform } from 'react-native';
import type { WidgetSnapshot } from '../../domain/widgetSnapshot';

/** Widget name; must match the widget definitions registered by the platform plugins (Task 3). */
export const TREK_WIDGET_NAME = 'TrekWidget';

export type WidgetColors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  onAccent: string;
  done: string;
  partial: string;
};

/** A row tap recorded by the iOS widget button handler in the App Group props. */
export type WidgetPendingAction = {
  id: string;
  goalId: string;
  slotId: string | null;
  date: string;
  action: 'done' | 'increment';
};

/** What both platforms render: the snapshot plus resolved token colors for both themes. */
export type WidgetPayload = {
  snapshot: WidgetSnapshot;
  colors: { light: WidgetColors; dark: WidgetColors };
  hideGoalNames: boolean;
  /** Always empty when pushed; the iOS handler appends taps here. */
  pendingActions: WidgetPendingAction[];
};

export type WidgetsAdapter = {
  pushSnapshot(payload: WidgetPayload): Promise<void>;
  /** Raw action entries stored in the widget props (iOS only; [] elsewhere). Unvalidated. */
  readPendingActions(): Promise<unknown[]>;
};

type IosLayout = (props: WidgetPayload, environment: unknown) => import('react').JSX.Element;
type AndroidRender = (payload: WidgetPayload, widthDp: number) => import('react').JSX.Element | { light: import('react').JSX.Element; dark: import('react').JSX.Element | null };

let iosLayout: IosLayout | null = null;
let androidRender: AndroidRender | null = null;

/** Task 3 registers the widget components here. Until then pushes are no-ops. */
export function registerWidgetRenderers(r: { ios?: IosLayout; android?: AndroidRender }): void {
  if (r.ios) iosLayout = r.ios;
  if (r.android) androidRender = r.android;
}

/* eslint-disable @typescript-eslint/no-require-imports */
let iosWidget: { updateSnapshot(p: WidgetPayload): void; reload(): void; getTimeline(): Promise<{ props?: unknown }[]> } | null = null;
function getIosWidget() {
  if (!iosWidget && iosLayout) {
    const { createWidget } = require('expo-widgets');
    iosWidget = createWidget(TREK_WIDGET_NAME, iosLayout);
  }
  return iosWidget;
}

let lastPayload: WidgetPayload | null = null;

export const widgetsAdapter: WidgetsAdapter = {
  async pushSnapshot(payload) {
    lastPayload = payload;
    if (Platform.OS === 'ios') {
      const w = getIosWidget();
      if (!w) return;
      w.updateSnapshot(payload);
      w.reload();
    } else if (Platform.OS === 'android' && androidRender) {
      const render = androidRender;
      const { requestWidgetUpdate } = require('react-native-android-widget');
      await requestWidgetUpdate({
        widgetName: TREK_WIDGET_NAME,
        renderWidget: (info: { width: number }) => render(payload, info.width),
        widgetNotFound: () => undefined,
      });
    }
  },
  async readPendingActions() {
    if (Platform.OS !== 'ios') return [];
    const w = getIosWidget();
    if (!w) return [];
    const timeline = await w.getTimeline();
    const out: unknown[] = [];
    for (const entry of timeline) {
      const props = entry.props as Partial<WidgetPayload> | undefined;
      if (Array.isArray(props?.pendingActions)) out.push(...props.pendingActions);
    }
    return out;
  },
};

/** Last payload pushed in this process (Android task handler re-render). */
export function getLastWidgetPayload(): WidgetPayload | null {
  return lastPayload;
}
