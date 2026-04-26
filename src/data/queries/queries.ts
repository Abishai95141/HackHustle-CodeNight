import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/data/client';
import type { Database } from '@/data/types.gen';

export type QueryStatus = Database['public']['Enums']['query_status'];
export type QueryCategory = Database['public']['Enums']['query_category'];

export type SupportQuery = {
  id: string;
  user_id: string;
  team_id: string | null;
  category: QueryCategory;
  title: string;
  description: string | null;
  status: QueryStatus;
  admin_notes: string | null;
  created_at: string | null;
  user: { name: string; email: string } | null;
  team: { team_name: string; team_code: string } | null;
};

export function useAdminQueries() {
  return useQuery({
    queryKey: ['admin', 'queries'],
    queryFn: async (): Promise<SupportQuery[]> => {
      const { data, error } = await supabase
        .from('queries')
        .select('*, user:profiles(name, email), team:teams(team_name, team_code)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SupportQuery[];
    },
  });
}

export function useMyQueries(userId: string | undefined) {
  return useQuery({
    queryKey: ['me', 'queries', userId],
    queryFn: async (): Promise<SupportQuery[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('queries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SupportQuery[];
    },
    enabled: !!userId,
  });
}
