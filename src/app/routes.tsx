import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { homeFor, type AppRole } from '@/domain/auth/roles';
import { AdminShell } from '@/app/shells/AdminShell';
import { ScanShell } from '@/app/shells/ScanShell';
import { JudgeShell } from '@/app/shells/JudgeShell';
import { ParticipantShell } from '@/app/shells/ParticipantShell';
import { PublicShell } from '@/app/shells/PublicShell';
import { RsvpShell } from '@/app/shells/RsvpShell';
import { QueryTeamShell } from '@/app/shells/QueryTeamShell';
import { LoadingScreen } from '@/components/composite/LoadingScreen';

// Auth pages — keep eager since they're tiny and the most common entry.
import { SignInPage } from '@/features/auth/SignInPage';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { UpdatePasswordPage } from '@/features/auth/UpdatePasswordPage';

// Every feature page is a separate chunk. Vite's dynamic `import()` here
// emits a per-route bundle, so the initial download is just shells + auth.
// First-paint is the most important mobile metric — this drops it dramatically.
const AdminDashboardPage         = lazy(() => import('@/features/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })));
const AdminUsersPage             = lazy(() => import('@/features/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })));
const AdminTeamsPage             = lazy(() => import('@/features/admin/AdminTeamsPage').then((m) => ({ default: m.AdminTeamsPage })));
const AdminMealsPage             = lazy(() => import('@/features/admin/AdminMealsPage').then((m) => ({ default: m.AdminMealsPage })));
const AdminQueriesPage           = lazy(() => import('@/features/admin/AdminQueriesPage').then((m) => ({ default: m.AdminQueriesPage })));
const AdminJudgingPage           = lazy(() => import('@/features/admin/AdminJudgingPage').then((m) => ({ default: m.AdminJudgingPage })));
const AdminNotificationsPage     = lazy(() => import('@/features/admin/AdminNotificationsPage').then((m) => ({ default: m.AdminNotificationsPage })));
const AdminProblemStatementsPage = lazy(() => import('@/features/admin/AdminProblemStatementsPage').then((m) => ({ default: m.AdminProblemStatementsPage })));
const AdminLogsPage              = lazy(() => import('@/features/admin/AdminLogsPage').then((m) => ({ default: m.AdminLogsPage })));
const AdminWinnersPage           = lazy(() => import('@/features/admin/AdminWinnersPage').then((m) => ({ default: m.AdminWinnersPage })));
const ScannerPage                = lazy(() => import('@/features/scanner/ScannerPage').then((m) => ({ default: m.ScannerPage })));
const VolunteerNotifyPage        = lazy(() => import('@/features/scanner/VolunteerNotifyPage').then((m) => ({ default: m.VolunteerNotifyPage })));
const RsvpRosterPage             = lazy(() => import('@/features/rsvp/RsvpRosterPage').then((m) => ({ default: m.RsvpRosterPage })));
const RsvpTeamsPage              = lazy(() => import('@/features/rsvp/RsvpTeamsPage').then((m) => ({ default: m.RsvpTeamsPage })));
const JudgeListPage              = lazy(() => import('@/features/judging/JudgeListPage').then((m) => ({ default: m.JudgeListPage })));
const ParticipantHomePage        = lazy(() => import('@/features/participant/ParticipantHomePage').then((m) => ({ default: m.ParticipantHomePage })));
const ParticipantTeamPage        = lazy(() => import('@/features/participant/ParticipantTeamPage').then((m) => ({ default: m.ParticipantTeamPage })));
const ParticipantBoardPage       = lazy(() => import('@/features/participant/ParticipantBoardPage').then((m) => ({ default: m.ParticipantBoardPage })));
const ParticipantHelpPage        = lazy(() => import('@/features/participant/ParticipantHelpPage').then((m) => ({ default: m.ParticipantHelpPage })));
const ParticipantNotificationsPage = lazy(() => import('@/features/participant/ParticipantNotificationsPage').then((m) => ({ default: m.ParticipantNotificationsPage })));
const ParticipantProblemsPage    = lazy(() => import('@/features/participant/ParticipantProblemsPage').then((m) => ({ default: m.ParticipantProblemsPage })));
const ParticipantWinnersPage     = lazy(() => import('@/features/participant/ParticipantWinnersPage').then((m) => ({ default: m.ParticipantWinnersPage })));
const PublicLeaderboardPage      = lazy(() => import('@/features/leaderboard/PublicLeaderboardPage').then((m) => ({ default: m.PublicLeaderboardPage })));
const NotFoundPage               = lazy(() => import('@/features/system/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

function Protected({
  children,
  allow,
}: {
  children: React.ReactNode;
  allow?: AppRole[];
}) {
  const { user, role, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth/sign-in" replace />;
  if (allow && role && !allow.includes(role)) return <Navigate to={homeFor(role)} replace />;
  return <>{children}</>;
}

function RoleRedirect() {
  const { user, role, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth/sign-in" replace />;
  return <Navigate to={homeFor(role)} replace />;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Auth */}
        <Route path="/auth/sign-in" element={<SignInPage />} />
        <Route path="/auth/forgot" element={<ForgotPasswordPage />} />
        <Route path="/auth/update-password" element={<UpdatePasswordPage />} />

        {/* Role-based root redirect */}
        <Route path="/" element={<RoleRedirect />} />

        {/* Admin */}
        <Route
          element={
            <Protected allow={['super_admin']}>
              <AdminShell />
            </Protected>
          }
        >
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/teams" element={<AdminTeamsPage />} />
          <Route path="/admin/meals" element={<AdminMealsPage />} />
          <Route path="/admin/queries" element={<AdminQueriesPage />} />
          <Route path="/admin/judging" element={<AdminJudgingPage />} />
          <Route path="/admin/rsvp" element={<RsvpRosterPage />} />
          <Route path="/admin/notifications" element={<AdminNotificationsPage />} />
          <Route path="/admin/problems" element={<AdminProblemStatementsPage />} />
          <Route path="/admin/logs" element={<AdminLogsPage />} />
          <Route path="/admin/winners" element={<AdminWinnersPage />} />
        </Route>

        {/* RSVP staff */}
        <Route
          element={
            <Protected allow={['rsvp', 'super_admin']}>
              <RsvpShell />
            </Protected>
          }
        >
          <Route path="/rsvp" element={<RsvpRosterPage />} />
          <Route path="/rsvp/tables" element={<RsvpTeamsPage />} />
        </Route>

        {/* Query team */}
        <Route
          element={
            <Protected allow={['query_team', 'super_admin']}>
              <QueryTeamShell />
            </Protected>
          }
        >
          <Route path="/queries" element={<AdminQueriesPage />} />
        </Route>

        {/* Volunteer scanner */}
        <Route
          element={
            <Protected allow={['volunteer', 'super_admin']}>
              <ScanShell />
            </Protected>
          }
        >
          <Route path="/scan" element={<ScannerPage />} />
          <Route path="/scan/notify" element={<VolunteerNotifyPage />} />
        </Route>

        {/* Judge */}
        <Route
          element={
            <Protected allow={['judge', 'super_admin']}>
              <JudgeShell />
            </Protected>
          }
        >
          <Route path="/judge" element={<JudgeListPage />} />
        </Route>

        {/* Participant */}
        <Route
          element={
            <Protected>
              <ParticipantShell />
            </Protected>
          }
        >
          <Route path="/me" element={<ParticipantHomePage />} />
          <Route path="/me/team" element={<ParticipantTeamPage />} />
          <Route path="/me/board" element={<ParticipantBoardPage />} />
          <Route path="/me/help" element={<ParticipantHelpPage />} />
          <Route path="/me/notifications" element={<ParticipantNotificationsPage />} />
          <Route path="/me/problems" element={<ParticipantProblemsPage />} />
          <Route path="/me/winners" element={<ParticipantWinnersPage />} />
        </Route>

        {/* Public */}
        <Route element={<PublicShell />}>
          <Route path="/board/:slug" element={<PublicLeaderboardPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
