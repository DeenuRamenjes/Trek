import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';

/** Thin wrapper over the expo notification APIs so everything else can be tested with a mock. */
export type NotificationResponse = Notifications.NotificationResponse;
export type NotificationRequestInput = Notifications.NotificationRequestInput;
export type ScheduledNotification = Notifications.NotificationRequest;

export const notificationsAdapter = {
  schedule: (request: NotificationRequestInput): Promise<string> => Notifications.scheduleNotificationAsync(request),
  cancel: (identifier: string): Promise<void> => Notifications.cancelScheduledNotificationAsync(identifier),
  listScheduled: (): Promise<ScheduledNotification[]> => Notifications.getAllScheduledNotificationsAsync(),
  setCategory: (identifier: string, actions: Notifications.NotificationAction[]) =>
    Notifications.setNotificationCategoryAsync(identifier, actions),
  setHandler: (handler: Notifications.NotificationHandler | null): void => Notifications.setNotificationHandler(handler),
  setChannel: (id: string, input: Notifications.NotificationChannelInput) => Notifications.setNotificationChannelAsync(id, input),
  deleteChannel: (id: string): Promise<void> => Notifications.deleteNotificationChannelAsync(id),
  listChannels: (): Promise<Notifications.NotificationChannel[]> => Notifications.getNotificationChannelsAsync(),
  getPermissions: (): Promise<Notifications.NotificationPermissionsStatus> => Notifications.getPermissionsAsync(),
  requestPermissions: (): Promise<Notifications.NotificationPermissionsStatus> => Notifications.requestPermissionsAsync(),
  getLastResponse: (): Promise<NotificationResponse | null> => Notifications.getLastNotificationResponseAsync(),
  addResponseListener: (listener: (r: NotificationResponse) => void) => Notifications.addNotificationResponseReceivedListener(listener),
  registerResponseTask: async (name: string): Promise<void> => {
    await Notifications.registerTaskAsync(name);
  },
  defineTask: (name: string, executor: TaskManager.TaskManagerTaskExecutor): void => TaskManager.defineTask(name, executor),
  registerBackgroundTask: (name: string, minimumInterval: number): Promise<void> =>
    BackgroundTask.registerTaskAsync(name, { minimumInterval }),
};
