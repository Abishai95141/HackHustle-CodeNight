import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/data/types.gen';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** Truthy when both env vars were baked into the build. Used by the App boot
 *  gate to render a clear error screen instead of white-pageing. */
export const SUPABASE_ENV_OK: boolean = !!(url && key);

if (!SUPABASE_ENV_OK) {
  // Don't throw — that would unmount React and leave a blank page. Log the
  // problem so devtools shows it, then create the client with placeholder
  // values so module-level imports don't crash. The boot gate in App.tsx
  // intercepts before any query actually runs.
  console.error(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY at build time. ' +
      'Set both in Vercel → Project Settings → Environment Variables (Production scope) and redeploy.',
  );
}

export const supabase = createClient<Database>(
  url || 'https://missing.supabase.co',
  key || 'missing',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
