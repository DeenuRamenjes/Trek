import type { TrekDb } from '../../db/client';
import { enqueueAction } from '../../db/repositories';
import type { WidgetPayload } from './adapter';

/** Subset of WidgetTaskHandlerProps the handler needs (react-native-android-widget). */
export type AndroidWidgetEvent = {
  widgetInfo: { width: number };
  widgetAction: 'WIDGET_ADDED' | 'WIDGET_UPDATE' | 'WIDGET_RESIZED' | 'WIDGET_DELETED' | 'WIDGET_CLICK';
  clickAction?: string;
  clickActionData?: Record<string, unknown>;
  renderWidget: (representation: never) => void;
};

export type AndroidHandlerDeps = {
  db: TrekDb;
  buildPayload: () => Promise<WidgetPayload>;
  /** Imports widget actions and pushes the fresh snapshot to every widget instance. */
  refreshWidgets: () => Promise<void>;
  processPending: () => Promise<number>;
  newId: () => string;
  now?: () => Date;
  render: (payload: WidgetPayload, widthDp: number) => unknown;
  tapAction: string;
};

/**
 * Android widget task handler (CLAUDE.md 5.13, 4.7). A row tap inserts a pending_actions row
 * (id `w:<uuid>`) directly, processes the queue, then refreshes. Runs headless in the app's JS
 * runtime, so the app does not need to be open.
 */
export function createAndroidWidgetHandler(deps: AndroidHandlerDeps) {
  const now = deps.now ?? (() => new Date());
  return async (event: AndroidWidgetEvent): Promise<void> => {
    switch (event.widgetAction) {
      case 'WIDGET_CLICK': {
        if (event.clickAction !== deps.tapAction) return;
        const d = event.clickActionData ?? {};
        if (typeof d.goalId !== 'string' || typeof d.date !== 'string') return;
        const action = d.action === 'increment' ? 'increment' : 'done';
        await enqueueAction(deps.db, {
          id: `w:${deps.newId()}`,
          source: 'widget',
          goalId: d.goalId,
          date: d.date,
          slotId: null,
          action,
          value: null,
          createdAt: now().toISOString(),
          processedAt: null,
        });
        await deps.processPending();
        await deps.refreshWidgets();
        return;
      }
      case 'WIDGET_ADDED':
      case 'WIDGET_UPDATE':
      case 'WIDGET_RESIZED':
        event.renderWidget(deps.render(await deps.buildPayload(), event.widgetInfo.width) as never);
        return;
      default:
        return;
    }
  };
}
