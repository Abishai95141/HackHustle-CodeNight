import { useParams } from 'react-router-dom';
import { LeaderboardView } from '@/features/leaderboard/LeaderboardView';

export function PublicLeaderboardPage() {
  const { slug } = useParams();
  return (
    <div className="mx-auto max-w-3xl px-8 py-16">
      <header className="mb-8 space-y-2 text-center">
        <div className="text-2xs uppercase tracking-[0.2em] text-muted-foreground">
          {slug ?? 'event'}
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Leaderboard</h1>
        <p className="text-sm text-muted-foreground">Live · updates as judges score.</p>
      </header>
      <LeaderboardView />
    </div>
  );
}
