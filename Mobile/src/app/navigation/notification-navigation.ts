import { navigationRef } from './navigation-ref';

type NotificationData = Record<string, string | undefined>;

let pending: NotificationData | undefined;

export function openNotification(data: NotificationData): void {
  if (!navigationRef.isReady()) {
    pending = data;
    return;
  }
  switch (data.screen) {
    case 'Catalogue':
      navigationRef.navigate('Catalogue');
      break;
    case 'TrainingDetail':
      if (data.trainingId !== undefined) {
        navigationRef.navigate('TrainingDetail', {
          trainingId: data.trainingId,
        });
      }
      break;
    case 'SessionDetail':
      if (data.sessionId !== undefined) {
        navigationRef.navigate('SessionDetail', { sessionId: data.sessionId });
      }
      break;
    case 'Purchases':
      navigationRef.navigate('Purchases');
      break;
    case 'Certificates':
      navigationRef.navigate('Certificates');
      break;
    default:
      break;
  }
}

export function openPendingNotification(): void {
  if (pending === undefined) return;
  const data = pending;
  pending = undefined;
  openNotification(data);
}
