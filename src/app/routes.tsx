import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { homeFor, type AppRole } from '@/domain/auth/roles';
import { SignInPage } from '@/features/auth/SignInPage';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { UpdatePasswordPage } from '@/features/auth/UpdatePasswordPage';
import { AdminShell } from '@/app/shells/AdminShell';
import { ScanShell } from '@/app/shells/ScanShell';
import { JudgeShell } from '@/app/shells/JudgeShell';
import { ParticipantShell } from '@/app/shells/ParticipantShell';
import { PublicShell } from '@/app/shells/PublicShell';
import { RsvpShell } from '@/app/shells/RsvpShell';
import { QueryTeamShell } from '@/app/shells/QueryTeamShell';
import { AdminDashboardPage } from '@/features/admin/AdminDashboardPage';
import { AdminUsersPage } from '@/features/admin/AdminUsersPage';
import { AdminTeamsPage } from '@/features/admin/AdminTeamsPage';
import { AdminMealsPage } from '@/features/admin/AdminMealsPage';
import { AdminQueriesPage } from '@/features/admin/AdminQueriesPage';
import { AdminJudgingPage } from '@/features/admin/AdminJudgingPage';
import { AdminNotificationsPage } from '@/features/admin/AdminNotificationsPage';
import { AdminProblemStatementsPage } from '@/features/admin/AdminProblemStatementsPage';
import { AdminLogsPage } from '@/features/admin/AdminLogsPage';
import { ScannerPage } from '@/features/scanner/ScannerPage';
import { VolunteerNotifyPage } from '@/features/scanner/VolunteerNotifyPage';
import { RsvpRosterPage } from '@/features/rsvp/RsvpRosterPage';
import { JudgeListPage } from '@/features/judging/JudgeListPage';
import { ParticipantHomePage } from '@/features/participant/ParticipantHomePage';
import { ParticipantTeamPage } from '@/features/participant/ParticipantTeamPage';
import { ParticipantBoardPage } from '@/features/participant/ParticipantBoardPage';
import { ParticipantHelpPage } from '@/features/participant/ParticipantHelpPage';
import { ParticipantNotificationsPage } from '@/features/participant/ParticipantNotificationsPage';
import { ParticipantProblemsPage } from '@/features/participant/ParticipantProblemsPage';
import { PublicLeaderboardPage } from '@/features/leaderboard/PublicLeaderboardPage';
import { NotFoundPage } from '@/features/system/NotFoundPage';
import { LoadingScreen } from '@/components/composite/LoadingScreen';

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
      </Route>

      {/* Public */}
      <Route element={<PublicShell />}>
        <Route path="/board/:slug" element={<PublicLeaderboardPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
