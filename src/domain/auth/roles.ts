export const APP_ROLES = ['super_admin', 'participant', 'volunteer', 'judge', 'rsvp', 'query_team'] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const HOME_BY_ROLE: Record<AppRole, string> = {
  super_admin: '/admin',
  volunteer: '/scan',
  judge: '/judge',
  participant: '/me',
  rsvp: '/rsvp',
  query_team: '/queries',
};

export function homeFor(role: AppRole | null | undefined): string {
  return role ? HOME_BY_ROLE[role] : '/auth/sign-in';
}

export function isStaff(role: AppRole | null | undefined): boolean {
  return (
    role === 'super_admin' ||
    role === 'volunteer' ||
    role === 'judge' ||
    role === 'rsvp' ||
    role === 'query_team'
  );
}

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  participant: 'Participant',
  volunteer: 'Volunteer',
  judge: 'Judge',
  rsvp: 'RSVP',
  query_team: 'Query Team',
};

export function labelForRole(role: AppRole | null | undefined): string {
  return role ? ROLE_LABELS[role] : '—';
}
