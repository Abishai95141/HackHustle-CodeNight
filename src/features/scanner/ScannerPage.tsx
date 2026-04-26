import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { DoorOpen, Utensils } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { supabase } from '@/data/client';
import { useActiveMealSessions } from '@/data/queries/meals';
import { QrCamera } from '@/features/scanner/QrCamera';

// Cooldown between any two successful (or attempted) scans. Volunteers were
// double-tapping the same person; the child QrCamera already dedupes identical
// tokens within 1.5s but distinct decodes (or re-tapping the same person after
// the dedupe window) still raced through. 4s is the user-specified pause.
const SCAN_COOLDOWN_MS = 4000;

type Mode = 'attendance' | 'food';

type ScanLogItem = {
  id: string;
  ok: boolean;
  message: string;
  who: string;
  at: number;
};

export function ScannerPage() {
  const { profile } = useAuth();
  const [mode, setMode] = useState<Mode>('attendance');
  const [meal, setMeal] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<ScanLogItem[]>([]);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const lastScanAt = useRef(0);
  const meals = useActiveMealSessions();

  // Tick a 1Hz countdown so the UI shows the remaining cooldown seconds.
  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const handle = window.setInterval(() => {
      const remain = Math.max(0, SCAN_COOLDOWN_MS - (Date.now() - lastScanAt.current));
      setCooldownLeft(remain);
      if (remain <= 0) window.clearInterval(handle);
    }, 250);
    return () => window.clearInterval(handle);
  }, [cooldownLeft]);

  const handleDecode = useCallback(
    async (token: string) => {
      if (busy) return;

      const sinceLast = Date.now() - lastScanAt.current;
      if (sinceLast < SCAN_COOLDOWN_MS) {
        const wait = Math.ceil((SCAN_COOLDOWN_MS - sinceLast) / 1000);
        toast.info(`Cooling down — wait ${wait}s`);
        setCooldownLeft(SCAN_COOLDOWN_MS - sinceLast);
        return;
      }

      if (mode === 'food' && !meal) {
        toast.error('Pick a meal session first');
        return;
      }
      setBusy(true);
      lastScanAt.current = Date.now();
      setCooldownLeft(SCAN_COOLDOWN_MS);
      try {
        const { data: target, error } = await supabase
          .from('profiles')
          .select('id, name, is_inside_venue, checked_in_day1, attendance_status')
          .eq('qr_token', token)
          .maybeSingle();

        if (error) throw error;
        if (!target) {
          push({ ok: false, who: '—', message: 'Unknown QR code' });
          toast.error('Unknown QR code');
          return;
        }

        // RSVP authority: if a participant has been marked absent, the volunteer
        // scanner refuses every write — entry, exit, or meal. The DB triggers
        // also enforce this server-side; this is the friendly UX path.
        if (target.attendance_status === 'absent') {
          push({ ok: false, who: target.name, message: 'Marked absent — scan invalid' });
          toast.error(`${target.name} · Marked absent — scan invalid`);
          return;
        }

        if (mode === 'attendance') {
          const goingIn = !target.is_inside_venue;
          const scan_type = goingIn ? 'entry' : 'exit';
          const upd = await supabase
            .from('profiles')
            .update({
              is_inside_venue: goingIn,
              last_scan_timestamp: new Date().toISOString(),
              checked_in_day1: goingIn || target.checked_in_day1,
            })
            .eq('id', target.id);
          if (upd.error) throw upd.error;
          await supabase.from('attendance_logs').insert({
            user_id: target.id,
            scan_type,
            scanned_by_staff_id: profile?.id ?? null,
          });
          const msg = goingIn ? 'Entry recorded' : 'Exit recorded';
          push({ ok: true, who: target.name, message: msg });
          toast.success(`${target.name} · ${msg}`);
        } else {
          const ins = await supabase.from('meal_transactions').insert({
            user_id: target.id,
            meal_type: meal!,
            scanned_by_staff_id: profile?.id ?? null,
          });
          if (ins.error) {
            const dup = ins.error.code === '23505';
            // P0001 is the absent-blocking trigger raising EXCEPTION; surface it
            // verbatim. The UI guard above already covers the common case but
            // a stale client cache could miss it — server has the final say.
            const blockedAbsent = ins.error.code === 'P0001';
            const msg = dup
              ? 'Already claimed this meal'
              : blockedAbsent
                ? 'Marked absent — scan invalid'
                : 'Failed to record meal';
            push({ ok: false, who: target.name, message: msg });
            toast.error(`${target.name} · ${msg}`);
          } else {
            push({ ok: true, who: target.name, message: 'Meal claimed' });
            toast.success(`${target.name} · Meal claimed`);
          }
        }
      } catch (err: unknown) {
        const code = (err as { code?: string } | null)?.code;
        const message = (err as { message?: string } | null)?.message;
        if (code === 'P0001' || (typeof message === 'string' && message.includes('marked absent'))) {
          toast.error('Marked absent — scan invalid');
          push({ ok: false, who: '—', message: 'Marked absent — scan invalid' });
        } else {
          console.error(err);
          toast.error('Scan failed');
          push({ ok: false, who: '—', message: 'Scan failed' });
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, mode, meal, profile?.id],
  );

  function push(p: Omit<ScanLogItem, 'id' | 'at'>) {
    const item: ScanLogItem = { ...p, id: crypto.randomUUID(), at: Date.now() };
    setRecent((prev) => [item, ...prev].slice(0, 5));
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col gap-3 px-4 pt-4">
        <div className="grid grid-cols-2 gap-2">
          <ModeButton active={mode === 'attendance'} onClick={() => setMode('attendance')} icon={DoorOpen} label="Attendance" />
          <ModeButton active={mode === 'food'} onClick={() => setMode('food')} icon={Utensils} label="Food" />
        </div>
        {mode === 'food' ? (
          <Select value={meal} onValueChange={setMeal}>
            <SelectTrigger>
              <SelectValue placeholder={meals.isLoading ? 'Loading meals…' : 'Choose meal session'} />
            </SelectTrigger>
            <SelectContent>
              {(meals.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.meal_type}>
                  {s.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
        <QrCamera onDecode={handleDecode} paused={busy || cooldownLeft > 0} />
        {cooldownLeft > 0 ? (
          <div className="text-2xs uppercase tracking-[0.2em] text-muted-foreground">
            Cooldown · {Math.ceil(cooldownLeft / 1000)}s
          </div>
        ) : null}
      </div>

      {recent.length > 0 ? (
        <aside className="border-t border-border bg-card px-4 py-3">
          <div className="mb-2 text-2xs uppercase tracking-[0.2em] text-muted-foreground">Last scans</div>
          <ul className="space-y-1">
            {recent.map((r) => (
              <li
                key={r.id}
                className={cn(
                  'flex items-center justify-between rounded-md border px-3 py-1.5 text-sm',
                  r.ok ? 'border-foreground/30' : 'border-border text-muted-foreground',
                )}
              >
                <span className="truncate">{r.who}</span>
                <span className="ml-3 truncate text-2xs text-muted-foreground">{r.message}</span>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-2 rounded-md border px-4 py-3 text-sm transition-colors',
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-background hover:bg-secondary',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
