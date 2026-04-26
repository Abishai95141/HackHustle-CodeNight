import { LeaderboardView } from '@/features/leaderboard/LeaderboardView';

export function ParticipantBoardPage() {
  return (
    <div className="mx-auto max-w-md space-y-6 px-6 pb-10 pt-12">
      <header className="space-y-1">
        <div className="text-2xs uppercase tracking-[0.2em] text-muted-foreground">Leaderboard</div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Live rankings</h1>
      </header>
      <LeaderboardView compact />
    </div>
  );
}
