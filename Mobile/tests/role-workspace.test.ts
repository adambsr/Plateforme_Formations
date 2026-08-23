import { roleWorkspace } from '../src/features/workspace/role-workspace';

describe('Role-aware Mobile workspace', () => {
  it.each([
    ['ADMIN', 'ADMINISTRATION'],
    ['TRAINER', 'ESPACE FORMATEUR'],
    ['LEARNER', 'ESPACE APPRENANT'],
  ] as const)('maps %s to its own workspace', (role, eyebrow) => {
    expect(roleWorkspace(role).eyebrow).toBe(eyebrow);
  });
});
