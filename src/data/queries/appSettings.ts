import { useEffect, useId } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/data/client';

/** All known flag keys. Add a new key here AND seed it in 0010 / a follow-up
 *  migration so the row exists when the client reads. */
export type AppSettingKey = 'scores_published' | 'submissions_locked' | 'logging_enabled' | 'winners_announced';

export type AppSettings = {
  scores_published: boolean;
  submissions_locked: boolean;
  logging_enabled: boolean;
  winners_announced: boolean;
};

const DEFAULTS: AppSettings = {
  scores_published: false,
  submissions_locked: false,
  logging_enabled: true,
  winners_announced: false,
};

/** Fetches every row of app_settings and folds it into a typed object.
 *  Keeps a realtime subscription so admin toggles propagate to all clients
 *  within ~1s without a refresh. */
export function useAppSettings() {
  const qc = useQueryClient();
  const id = useId();

  useEffect(() => {
    const channel = supabase
      .channel(`app-settings-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings' },
        () => qc.invalidateQueries({ queryKey: ['app-settings'] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, qc]);

  return useQuery({
    queryKey: ['app-settings'],
    // Defaults are returned when the query hasn't yet resolved, so the app
    // boots without a flash of "wrong" gating.
    placeholderData: DEFAULTS,
    queryFn: async (): Promise<AppSettings> => {
      const { data, error } = await supabase.from('app_settings').select('key, value');
      if (error) throw error;
      const out: AppSettings = { ...DEFAULTS };
      for (const row of data ?? []) {
        const k = row.key as AppSettingKey;
        // value is jsonb; for our flags it's always a JS boolean after parse.
        if (k in out) (out as Record<AppSettingKey, boolean>)[k] = !!row.value;
      }
      return out;
    },
  });
}

/** Convenience: returns just the resolved settings object (with defaults). */
export function useAppSettingsValue(): AppSettings {
  return useAppSettings().data ?? DEFAULTS;
}
