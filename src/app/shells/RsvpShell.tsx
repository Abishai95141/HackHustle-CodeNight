import { Trophy, UserCheck } from 'lucide-react';
import { StaffShellLayout, type ShellNavItem } from '@/app/shells/StaffShellLayout';

const items: ShellNavItem[] = [
  { to: '/rsvp', label: 'Roster', icon: UserCheck, end: true },
  { to: '/rsvp/tables', label: 'Tables', icon: Trophy },
];

export function RsvpShell() {
  return <StaffShellLayout badge="RSVP" items={items} />;
}
