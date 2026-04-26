// Edge function: purge-users
// Deletes every auth.users row except the calling super_admin's. Cascades through
// profiles + user_roles via existing FKs. Returns the count of deleted users.
//
// Auth model:
//   - Caller must be authenticated and have role 'super_admin'.
//   - Caller's own account is preserved (never deletes self).
//
// Invoke: supabase.functions.invoke('purge-users')

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');
    const token = authHeader.replace('Bearer ', '');

    const { data: { user: caller }, error: authError } = await createClient(
      supabaseUrl,
      anonKey,
    ).auth.getUser(token);
    if (authError || !caller) throw new Error('Unauthorized');

    const { data: roleRow } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .single();
    if (roleRow?.role !== 'super_admin') {
      throw new Error('Only super admins can purge users');
    }

    // Page through every auth user, preserving the caller.
    let deleted = 0;
    let skipped = 0;
    let page = 1;
    const perPage = 200;
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      const users = data.users ?? [];
      if (users.length === 0) break;

      for (const u of users) {
        if (u.id === caller.id) {
          skipped++;
          continue;
        }
        const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(u.id);
        if (delErr) {
          console.error('purge-users: failed to delete', u.id, delErr.message);
          skipped++;
          continue;
        }
        deleted++;
      }

      // listUsers pagination: if we got less than perPage, that's the last page.
      if (users.length < perPage) break;
      page++;
    }

    return new Response(JSON.stringify({ deleted, skipped }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
