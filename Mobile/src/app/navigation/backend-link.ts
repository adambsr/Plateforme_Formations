import type { AppStackParamList } from './types';

type Destination =
  { name: keyof AppStackParamList; params?: object } | undefined;

export function destinationForBackendLink(link: string): Destination {
  const path = link.split(/[?#]/, 1)[0] ?? link;
  const content = path.match(/^\/app\/content\/([^/]+)$/);
  if (content?.[1])
    return { name: 'Content', params: { trainingId: content[1] } };
  const publicTraining = path.match(/^\/trainings\/([^/]+)$/);
  if (publicTraining?.[1])
    return {
      name: 'TrainingDetail',
      params: { trainingId: publicTraining[1] },
    };
  const evaluation = path.match(/^\/app\/evaluations\/([^/]+)$/);
  if (evaluation?.[1])
    return { name: 'Evaluations', params: { evaluationId: evaluation[1] } };
  if (/^\/app\/trainings(?:\/|$)/.test(path))
    return { name: 'ManagedTrainings' };
  const routes: Record<string, keyof AppStackParamList> = {
    '/app': 'Workspace',
    '/app/learner': 'Workspace',
    '/app/trainer': 'Workspace',
    '/app/dashboard': 'AdminDashboard',
    '/app/catalogue': 'Catalogue',
    '/app/sessions': 'Sessions',
    '/app/attendance': 'Attendance',
    '/app/evaluations': 'Evaluations',
    '/app/payments': 'Purchases',
    '/app/certificates': 'Certificates',
    '/app/users': 'AdminUsers',
    '/app/profile': 'Profile',
    '/app/notifications': 'Notifications',
  };
  const name = routes[path];
  return name === undefined ? undefined : { name };
}

export function openBackendLink(
  navigate: (name: keyof AppStackParamList, params?: object) => void,
  link: string,
): boolean {
  const destination = destinationForBackendLink(link);
  if (destination === undefined) return false;
  navigate(destination.name, destination.params);
  return true;
}
