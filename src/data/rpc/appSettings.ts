import { supabase } from '@/data/client';
import type { AppSettingKey } from '@/data/queries/appSettings';

export async function setAppSetting(key: AppSettingKey, value: boolean) {
  const { data: { user } } = await supabase.auth.getUser();
  // upsert: insert if missing (defensive), otherwise update.
  // Cast: jsonb columns accept any JSON via the Supabase client, but the
  // generated types insist on the recursive Json type — pass through as-is.
  const { error } = await supabase
    .from('app_settings')
    .upsert(
      {
        key,
        value: value as unknown as never,
        updated_by: user?.id ?? null,
      },
      { onConflict: 'key' },
    );
  if (error) throw error;
}
