import { Award, Bell, FileText, Gavel, HelpCircle, LayoutDashboard, ScrollText, Trophy, UserCheck, Users, Utensils } from 'lucide-react';
import { StaffShellLayout, type ShellNavItem } from '@/app/shells/StaffShellLayout';

const items: ShellNavItem[] = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/teams', label: 'Teams', icon: Trophy },
  { to: '/admin/rsvp', label: 'RSVP / Check-in', icon: UserCheck },
  { to: '/admin/meals', label: 'Meals', icon: Utensils },
  { to: '/admin/judging', label: 'Judging', icon: Gavel },
  { to: '/admin/winners', label: 'Winners', icon: Award },
  { to: '/admin/notifications', label: 'Notifications', icon: Bell },
  { to: '/admin/problems', label: 'Problem Statements', icon: FileText },
  { to: '/admin/queries', label: 'Queries', icon: HelpCircle },
  { to: '/admin/logs', label: 'Activity Logs', icon: ScrollText },
];

export function AdminShell() {
  return <StaffShellLayout badge="ERP" items={items} />;
}
