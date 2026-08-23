import type { UserRole } from '../../core/auth/types';

export interface RoleWorkspace {
  eyebrow: string;
  title: string;
  description: string;
}

export function roleWorkspace(role: UserRole): RoleWorkspace {
  if (role === 'ADMIN') {
    return {
      eyebrow: 'ADMINISTRATION',
      title: 'Tableau de bord',
      description:
        'Supervisez l’activité du centre depuis votre espace sécurisé.',
    };
  }
  if (role === 'TRAINER') {
    return {
      eyebrow: 'ESPACE FORMATEUR',
      title: 'Bonjour',
      description: 'Retrouvez vos formations et vos activités pédagogiques.',
    };
  }
  return {
    eyebrow: 'ESPACE APPRENANT',
    title: 'Bonjour',
    description: 'Poursuivez votre parcours de formation où que vous soyez.',
  };
}
