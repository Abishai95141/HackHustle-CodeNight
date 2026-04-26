import { UserCheck } from 'lucide-react';
import { StaffShellLayout, type ShellNavItem } from '@/app/shells/StaffShellLayout';

const items: ShellNavItem[] = [{ to: '/rsvp', label: 'Roster', icon: UserCheck, end: true }];

export function RsvpShell() {
  return <StaffShellLayout badge="RSVP" items={items} />;
}
