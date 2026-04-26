import { HelpCircle } from 'lucide-react';
import { StaffShellLayout, type ShellNavItem } from '@/app/shells/StaffShellLayout';

const items: ShellNavItem[] = [{ to: '/queries', label: 'Queries', icon: HelpCircle, end: true }];

export function QueryTeamShell() {
  return <StaffShellLayout badge="Queries" items={items} contentMaxWidth="narrow" />;
}
